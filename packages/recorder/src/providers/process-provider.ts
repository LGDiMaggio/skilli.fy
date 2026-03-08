/**
 * @skillify/recorder — Process provider
 *
 * Polls running processes at regular intervals to detect process start/stop events.
 * Cross-platform via `tasklist` (Windows) and `ps` (macOS/Linux).
 */

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import * as os from "node:os";
import type { RecordingEvent } from "@skillify/core";
import type { EventCallback, RecordingProvider } from "../provider.js";

export interface ProcessProviderOptions {
  /** Polling interval in ms. Default 5000. */
  pollIntervalMs?: number;
  /** Process names to specifically track. If empty, tracks all notable changes. */
  watchNames?: string[];
  /** Process names to ignore. */
  ignoreNames?: string[];
}

interface ProcessInfo {
  pid: number;
  name: string;
}

export class ProcessProvider implements RecordingProvider {
  readonly name = "process";
  private active = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private previousPids = new Map<number, ProcessInfo>();
  private opts: ProcessProviderOptions;

  constructor(opts: ProcessProviderOptions = {}) {
    this.opts = opts;
  }

  async start(onEvent: EventCallback): Promise<void> {
    if (this.active) return;

    const interval = this.opts.pollIntervalMs ?? 5000;
    const ignoreSet = new Set(
      (this.opts.ignoreNames ?? [
        "System", "svchost", "conhost", "csrss", "wininit", "services",
        "lsass", "smss", "kernel_task", "launchd", "WindowServer",
      ]).map((n) => n.toLowerCase()),
    );

    // Seed with current processes
    this.previousPids = new Map(
      this._listProcesses()
        .filter((p) => !ignoreSet.has(p.name.toLowerCase()))
        .map((p) => [p.pid, p]),
    );

    this.timer = setInterval(() => {
      const current = this._listProcesses().filter(
        (p) => !ignoreSet.has(p.name.toLowerCase()),
      );
      const currentMap = new Map(current.map((p) => [p.pid, p]));

      // Detect new processes
      for (const [pid, info] of currentMap) {
        if (!this.previousPids.has(pid)) {
          if (this.opts.watchNames && this.opts.watchNames.length > 0) {
            if (!this.opts.watchNames.some((n) => info.name.toLowerCase().includes(n.toLowerCase()))) {
              continue;
            }
          }
          const event: RecordingEvent = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            source: "process",
            type: "process.started",
            redactionLevel: "partial",
            payload: { pid, name: info.name, action: "started" },
          } as RecordingEvent;
          onEvent(event);
        }
      }

      // Detect stopped processes
      for (const [pid, info] of this.previousPids) {
        if (!currentMap.has(pid)) {
          const event: RecordingEvent = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            source: "process",
            type: "process.stopped",
            redactionLevel: "partial",
            payload: { pid, name: info.name, action: "stopped" },
          } as RecordingEvent;
          onEvent(event);
        }
      }

      this.previousPids = currentMap;
    }, interval);

    this.active = true;
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  private _listProcesses(): ProcessInfo[] {
    try {
      const platform = os.platform();
      let output: string;

      if (platform === "win32") {
        output = execSync('tasklist /FO CSV /NH', { encoding: "utf-8", timeout: 5000 });
        return output
          .trim()
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.split('","');
            const name = parts[0]?.replace(/^"/, "") ?? "unknown";
            const pid = parseInt(parts[1] ?? "0", 10);
            return { pid, name };
          })
          .filter((p) => !isNaN(p.pid));
      } else {
        output = execSync("ps -eo pid,comm --no-headers", { encoding: "utf-8", timeout: 5000 });
        return output
          .trim()
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            const spaceIdx = trimmed.indexOf(" ");
            const pid = parseInt(trimmed.slice(0, spaceIdx), 10);
            const name = trimmed.slice(spaceIdx + 1).trim();
            return { pid, name };
          })
          .filter((p) => !isNaN(p.pid) && p.name);
      }
    } catch {
      return [];
    }
  }
}
