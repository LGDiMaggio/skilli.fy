/**
 * @skillify/mcp — MCP Detector
 *
 * Scans recording events to detect which MCP servers are relevant.
 * Returns ranked suggestions with confidence scores and reasoning.
 */

import type { RecordingEvent } from "@skillify/core";
import { MCP_REGISTRY, type McpServerEntry } from "./registry.js";

export interface McpDetection {
  server: McpServerEntry;
  confidence: number;      // 0–1
  reasons: string[];       // why we think this MCP is relevant
  matchedSignals: string[];
}

/**
 * Detect MCP servers from a list of recording events.
 */
export function detectMcpServers(
  events: RecordingEvent[],
  registry: McpServerEntry[] = MCP_REGISTRY,
): McpDetection[] {
  const detections = new Map<string, McpDetection>();

  for (const entry of registry) {
    const reasons: string[] = [];
    const matched: string[] = [];
    let score = 0;

    // Check process names
    if (entry.signals.processNames) {
      for (const event of events) {
        if (event.source === "process" || event.source === "window") {
          const name =
            event.source === "process"
              ? (event.payload as { name: string }).name?.toLowerCase()
              : (event.payload as { appName?: string }).appName?.toLowerCase() ?? "";
          for (const pn of entry.signals.processNames) {
            if (name.includes(pn.toLowerCase())) {
              score += 0.3;
              reasons.push(`Process/app "${name}" matches known signal "${pn}"`);
              matched.push(`processName:${pn}`);
            }
          }
        }
      }
    }

    // Check hostnames (from browser events or window titles)
    if (entry.signals.hostnames) {
      for (const event of events) {
        let url = "";
        if (event.source === "browser") {
          url = (event.payload as { url: string }).url;
        } else if (event.source === "window") {
          // Heuristic: URLs sometimes appear in window titles
          url = (event.payload as { windowTitle: string }).windowTitle;
        }

        for (const hostname of entry.signals.hostnames) {
          if (url.toLowerCase().includes(hostname.toLowerCase())) {
            score += 0.35;
            reasons.push(`URL/hostname "${hostname}" detected in ${event.source} event`);
            matched.push(`hostname:${hostname}`);
          }
        }
      }
    }

    // Check command patterns
    if (entry.signals.commandPatterns) {
      for (const event of events) {
        if (event.source === "terminal") {
          const cmd = (event.payload as { command: string }).command;
          for (const pattern of entry.signals.commandPatterns) {
            if (new RegExp(pattern, "i").test(cmd)) {
              score += 0.4;
              reasons.push(`Command "${cmd}" matches pattern "${pattern}"`);
              matched.push(`command:${pattern}`);
            }
          }
        }
      }
    }

    // Check file patterns
    if (entry.signals.filePatterns) {
      for (const event of events) {
        if (event.source === "fs") {
          const filePath = (event.payload as { path: string }).path;
          for (const pattern of entry.signals.filePatterns) {
            // Simple glob matching (convert glob to regex)
            const regex = new RegExp(
              pattern
                .replace(/\./g, "\\.")
                .replace(/\*\*/g, ".*")
                .replace(/\*/g, "[^/\\\\]*"),
              "i",
            );
            if (regex.test(filePath)) {
              score += 0.25;
              reasons.push(`File "${filePath}" matches pattern "${pattern}"`);
              matched.push(`file:${pattern}`);
            }
          }
        }
      }
    }

    if (score > 0) {
      // Cap confidence at 1.0 and de-duplicate
      const confidence = Math.min(score, 1.0);
      const uniqueReasons = [...new Set(reasons)];
      const uniqueMatched = [...new Set(matched)];

      detections.set(entry.id, {
        server: entry,
        confidence,
        reasons: uniqueReasons,
        matchedSignals: uniqueMatched,
      });
    }
  }

  // Sort by confidence descending
  return [...detections.values()].sort((a, b) => b.confidence - a.confidence);
}
