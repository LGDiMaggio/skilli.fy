/**
 * @skillify/core — Workflow Graph Schema
 *
 * After recording, events are grouped and transformed into a
 * directed acyclic graph (DAG) of workflow steps.
 */

import { z } from "zod";

// ── Workflow step ────────────────────────────────────────────
export const WorkflowStep = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  inputs: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      defaultValue: z.string().optional(),
      required: z.boolean().default(true),
    })
  ).default([]),
  outputs: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      path: z.string().optional(),
    })
  ).default([]),
  toolsUsed: z.array(z.string()).default([]),
  mcpHints: z.array(z.string()).default([]),       // e.g. "github", "linear"
  commands: z.array(z.string()).default([]),        // terminal commands executed in this step
  filesAffected: z.array(z.string()).default([]),
  errorPatterns: z.array(
    z.object({
      message: z.string(),
      cause: z.string().optional(),
      solution: z.string().optional(),
    })
  ).default([]),
  durationMs: z.number().optional(),
  eventIds: z.array(z.string()).default([]),        // references to original events
});
export type WorkflowStep = z.infer<typeof WorkflowStep>;

// ── Edge between steps ───────────────────────────────────────
export const WorkflowEdge = z.object({
  from: z.string(),
  to: z.string(),
  condition: z.string().optional(),   // e.g. "if tests pass"
});
export type WorkflowEdge = z.infer<typeof WorkflowEdge>;

// ── Artifact ─────────────────────────────────────────────────
export const WorkflowArtifact = z.object({
  path: z.string(),
  pattern: z.string().optional(),     // glob
  description: z.string().optional(),
});
export type WorkflowArtifact = z.infer<typeof WorkflowArtifact>;

// ── Full workflow graph ──────────────────────────────────────
export const WorkflowGraph = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(WorkflowStep),
  edges: z.array(WorkflowEdge),
  artifacts: z.array(WorkflowArtifact).default([]),
  parameters: z.array(
    z.object({
      name: z.string(),               // e.g. "PROJECT_NAME"
      description: z.string().optional(),
      defaultValue: z.string().optional(),
      source: z.string().optional(),   // where detected
    })
  ).default([]),
  metadata: z.record(z.unknown()).optional(),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;
