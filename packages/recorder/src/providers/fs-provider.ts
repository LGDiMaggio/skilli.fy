/**
 * @skillify/recorder — Filesystem provider
 *
 * Uses chokidar to watch file-system changes in a target directory tree.
 */

import { randomUUID } from "node:crypto";
import * as path from "node:path";
import chokidar from "chokidar";
import type { FsChangePayload, RecordingEvent } from "@skillify/core";
import type { EventCallback, RecordingProvider } from "../provider.js";

export interface FsProviderOptions {
  /** Directories to watch. */
  watchPaths: string[];
  /** Glob patterns to ignore (e.g. node_modules, .git directories). */
  ignored?: string[];
}

export class FsProvider implements RecordingProvider {
  readonly name = "filesystem";
  private watcher: chokidar.FSWatcher | null = null;
  private active = false;
  private opts: FsProviderOptions;

  constructor(opts: FsProviderOptions) {
    this.opts = opts;
  }

  async start(onEvent: EventCallback): Promise<void> {
    if (this.active) return;

    const ignored = this.opts.ignored ?? [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/*.log",
    ];

    this.watcher = chokidar.watch(this.opts.watchPaths, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },
    });

    const emit = (kind: FsChangePayload["kind"], filePath: string, oldPath?: string) => {
      const event: RecordingEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        source: "fs",
        type: "fs.changed",
        redactionLevel: "partial",
        payload: {
          kind,
          path: path.resolve(filePath),
          ...(oldPath ? { oldPath: path.resolve(oldPath) } : {}),
          isDirectory: false, // chokidar fires on files by default
        },
      } as RecordingEvent;
      onEvent(event);
    };

    this.watcher
      .on("add", (p) => emit("create", p))
      .on("change", (p) => emit("modify", p))
      .on("unlink", (p) => emit("delete", p))
      .on("addDir", (p) => {
        const event: RecordingEvent = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          source: "fs",
          type: "fs.changed",
          redactionLevel: "partial",
          payload: { kind: "create", path: path.resolve(p), isDirectory: true },
        } as RecordingEvent;
        onEvent(event);
      });

    this.active = true;
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}
