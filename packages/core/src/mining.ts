/**
 * @skillify/core — Workflow Mining
 *
 * Heuristic engine that transforms a flat list of RecordingEvents
 * into a structured WorkflowGraph (DAG).
 *
 * Strategy (MVP heuristics):
 * 1. Group consecutive events by "activity context" (same app/terminal session).
 * 2. Detect natural boundaries (long pauses, app switches, explicit markers).
 * 3. Derive step titles from dominant action (e.g. "Run tests", "Edit config").
 * 4. Extract parameters from repeated literal values.
 * 5. Build linear edges (sequential), mark errors as troubleshooting.
 */

import type { RecordingEvent } from "./schemas/events.js";
import type { WorkflowGraph, WorkflowStep, WorkflowEdge, WorkflowArtifact } from "./schemas/workflow.js";
import { randomUUID } from "node:crypto";

// ─── Configuration ─────────────────────────────────────────
export interface MiningOptions {
  /** Milliseconds of inactivity that signals a step boundary. Default 30 000. */
  idleThresholdMs?: number;
  /** Minimum events per step. Steps below this are merged with neighbours. Default 1. */
  minEventsPerStep?: number;
  /** Parameter detection: literals that appear ≥ N times are promoted to params. Default 2. */
  paramRepeatThreshold?: number;
}

const DEFAULTS: Required<MiningOptions> = {
  idleThresholdMs: 30_000,
  minEventsPerStep: 1,
  paramRepeatThreshold: 2,
};

// ─── Helpers ───────────────────────────────────────────────
function ts(e: RecordingEvent): number {
  return new Date(e.timestamp).getTime();
}

function inferStepTitle(events: RecordingEvent[]): string {
  // Prioritise terminal commands (they tend to be the most descriptive action)
  const terminalEvents = events.filter((e) => e.source === "terminal");
  if (terminalEvents.length > 0) {
    const cmd = (terminalEvents[0].payload as { command: string }).command;
    const short = cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
    return `Run: ${short}`;
  }

  const fsEvents = events.filter((e) => e.source === "fs");
  if (fsEvents.length > 0) {
    const kinds = [...new Set(fsEvents.map((e) => (e.payload as { kind: string }).kind))];
    return `File changes (${kinds.join(", ")})`;
  }

  const windowEvents = events.filter((e) => e.source === "window");
  if (windowEvents.length > 0) {
    const app = (windowEvents[0].payload as { appName?: string; windowTitle: string }).appName
      ?? (windowEvents[0].payload as { windowTitle: string }).windowTitle;
    return `Switch to ${app}`;
  }

  return `Step (${events.length} events)`;
}

function extractCommands(events: RecordingEvent[]): string[] {
  return events
    .filter((e) => e.source === "terminal")
    .map((e) => (e.payload as { command: string }).command);
}

function extractFilesAffected(events: RecordingEvent[]): string[] {
  return [
    ...new Set(
      events
        .filter((e) => e.source === "fs")
        .map((e) => (e.payload as { path: string }).path),
    ),
  ];
}

function extractErrors(events: RecordingEvent[]): WorkflowStep["errorPatterns"] {
  return events
    .filter((e) => e.source === "terminal" && (e.payload as { exitCode: number | null }).exitCode !== 0 && (e.payload as { exitCode: number | null }).exitCode !== null)
    .map((e) => {
      const p = e.payload as { command: string; exitCode: number | null; output?: string };
      return {
        message: `Command \`${p.command}\` exited with code ${p.exitCode}`,
        cause: p.output ? p.output.slice(0, 200) : undefined,
        solution: "Check command syntax and prerequisites.",
      };
    });
}

// Detect repeated literal values across events to suggest parameters
function detectParameters(events: RecordingEvent[]): WorkflowGraph["parameters"] {
  const literalCounts = new Map<string, number>();
  const threshold = 2;

  for (const e of events) {
    if (e.source === "terminal") {
      const cmd = (e.payload as { command: string }).command;
      // Tokenize by whitespace — look for repeated tokens that aren't common flags/commands
      for (const token of cmd.split(/\s+/)) {
        if (token.length < 4 || /^-/.test(token)) continue;
        literalCounts.set(token, (literalCounts.get(token) ?? 0) + 1);
      }
    }
    if (e.source === "fs") {
      const pathParts = (e.payload as { path: string }).path.split(/[\\/]/);
      for (const part of pathParts) {
        if (part.length < 4) continue;
        literalCounts.set(part, (literalCounts.get(part) ?? 0) + 1);
      }
    }
  }

  return [...literalCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([value]) => ({
      name: value.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
      description: `Detected repeated value: "${value}"`,
      defaultValue: value,
      source: "auto-detected",
    }));
}

// ─── Main mining function ──────────────────────────────────
export function mineWorkflow(
  events: RecordingEvent[],
  opts: MiningOptions = {},
): WorkflowGraph {
  const cfg = { ...DEFAULTS, ...opts };

  if (events.length === 0) {
    return {
      id: randomUUID(),
      name: "empty-workflow",
      description: "No events recorded.",
      steps: [],
      edges: [],
      artifacts: [],
      parameters: [],
    };
  }

  // 1. Sort by timestamp
  const sorted = [...events].sort((a, b) => ts(a) - ts(b));

  // 2. Split into raw groups by idle threshold or source switch
  const groups: RecordingEvent[][] = [];
  let currentGroup: RecordingEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = ts(sorted[i]) - ts(sorted[i - 1]);
    const sourceChanged = sorted[i].source !== sorted[i - 1].source;

    if (gap > cfg.idleThresholdMs || sourceChanged) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(sorted[i]);
  }
  groups.push(currentGroup);

  // 3. Merge tiny groups
  const merged: RecordingEvent[][] = [];
  for (const g of groups) {
    if (g.length < cfg.minEventsPerStep && merged.length > 0) {
      merged[merged.length - 1].push(...g);
    } else {
      merged.push(g);
    }
  }

  // 4. Convert groups → WorkflowSteps
  const steps: WorkflowStep[] = merged.map((group, idx) => ({
    id: `step-${idx + 1}`,
    title: inferStepTitle(group),
    summary: `${group.length} event(s) from ${group[0].source}`,
    inputs: [],
    outputs: [],
    toolsUsed: [...new Set(group.map((e) => e.source))],
    mcpHints: [],
    commands: extractCommands(group),
    filesAffected: extractFilesAffected(group),
    errorPatterns: extractErrors(group),
    durationMs:
      group.length > 1
        ? ts(group[group.length - 1]) - ts(group[0])
        : undefined,
    eventIds: group.map((e) => e.id),
  }));

  // 5. Build sequential edges
  const edges: WorkflowEdge[] = steps.slice(0, -1).map((s, i) => ({
    from: s.id,
    to: steps[i + 1].id,
  }));

  // 6. Collect artifacts (files created)
  const artifacts: WorkflowArtifact[] = events
    .filter((e) => e.source === "fs" && (e.payload as { kind: string }).kind === "create")
    .map((e) => ({
      path: (e.payload as { path: string }).path,
      description: "Created during recording",
    }));

  // 7. Detect parameters
  const parameters = detectParameters(events);

  // 8. Derive a name from the first few steps
  const nameParts = steps
    .slice(0, 3)
    .map((s) => s.title.replace(/^Run:\s*/, "").slice(0, 20))
    .join(" → ");

  return {
    id: randomUUID(),
    name: slugify(nameParts) || "recorded-workflow",
    description: `Workflow with ${steps.length} steps extracted from ${events.length} events.`,
    steps,
    edges,
    artifacts,
    parameters,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
