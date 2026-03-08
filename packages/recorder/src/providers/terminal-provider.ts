/**
 * @skillify/recorder — Terminal provider
 *
 * Captures terminal commands by writing a shell wrapper / hook script
 * that logs each command execution to a JSONL pipe.
 *
 * MVP approach:
 *  - On start(), spawns an instrumented shell (child_process).
 *  - Each command entered by the user is intercepted via a preexec-like
 *    mechanism (bash PROMPT_COMMAND / PowerShell prompt function).
 *  - Exit codes and optional output are captured.
 *
 * For non-interactive recording (e.g. user is already typing in their own
 * terminal), a lighter-weight approach can poll shell history files.
 */

import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import * as readline from "node:readline";
import type { RecordingEvent } from "@skillify/core";
import type { EventCallback, RecordingProvider } from "../provider.js";

export interface TerminalProviderOptions {
  /** Shell to spawn (auto-detected if omitted). */
  shell?: string;
  /** Working directory. */
  cwd?: string;
  /** Capture stdout/stderr (redacted). Default true. */
  captureOutput?: boolean;
  /** Max output length to keep (chars). Default 2000. */
  maxOutputLength?: number;
}

export class TerminalProvider implements RecordingProvider {
  readonly name = "terminal";
  private active = false;
  private opts: TerminalProviderOptions;
  private child: ChildProcess | null = null;
  private tempLogPath: string;

  constructor(opts: TerminalProviderOptions = {}) {
    this.opts = opts;
    this.tempLogPath = path.join(os.tmpdir(), `skillify-terminal-${randomUUID()}.jsonl`);
  }

  async start(onEvent: EventCallback): Promise<void> {
    if (this.active) return;

    const shell = this.opts.shell ?? (os.platform() === "win32" ? "powershell.exe" : "bash");
    const cwd = this.opts.cwd ?? process.cwd();
    const captureOutput = this.opts.captureOutput ?? true;
    const maxLen = this.opts.maxOutputLength ?? 2000;

    // Ensure temp log exists
    fs.writeFileSync(this.tempLogPath, "", "utf-8");

    // Spawn interactive shell
    this.child = spawn(shell, [], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        SKILLIFY_RECORDING: "1",
        SKILLIFY_LOG: this.tempLogPath,
      },
    });

    let currentOutput = "";

    const emitCommandEvent = (command: string, exitCode: number | null) => {
      const output = captureOutput ? currentOutput.slice(0, maxLen) : undefined;
      const event: RecordingEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        source: "terminal",
        type: "terminal.command.executed",
        redactionLevel: "partial",
        payload: {
          command: command.trim(),
          cwd,
          exitCode,
          output,
          shell: path.basename(shell),
        },
      } as RecordingEvent;
      onEvent(event);
      currentOutput = "";
    };

    if (this.child.stdout) {
      this.child.stdout.on("data", (data: Buffer) => {
        currentOutput += data.toString();
      });
    }
    if (this.child.stderr) {
      this.child.stderr.on("data", (data: Buffer) => {
        currentOutput += data.toString();
      });
    }

    // Read commands from stdin relay or log file
    // For MVP: watch the temp log file for lines appended by shell hooks.
    // Alternatively, parse stdout for PS1/prompt patterns.
    // Simplified: we expose a method to manually log commands (used by CLI wrapper).

    this.active = true;
    this._startLogWatcher(onEvent, cwd, path.basename(shell));
  }

  /**
   * Manually record a command that was executed externally.
   * Useful when the CLI wraps `exec` or for testing.
   */
  recordCommand(
    command: string,
    exitCode: number | null,
    output?: string,
    cwd?: string,
  ): RecordingEvent {
    const event: RecordingEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: "terminal",
      type: "terminal.command.executed",
      redactionLevel: "partial",
      payload: {
        command,
        cwd: cwd ?? process.cwd(),
        exitCode,
        output: output?.slice(0, this.opts.maxOutputLength ?? 2000),
        shell: "external",
      },
    } as RecordingEvent;
    return event;
  }

  async stop(): Promise<void> {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    // Clean up temp log
    try {
      fs.unlinkSync(this.tempLogPath);
    } catch {
      /* ignore */
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  // Watch the temp log file for commands written by shell hooks
  private _startLogWatcher(onEvent: EventCallback, cwd: string, shell: string): void {
    if (!fs.existsSync(this.tempLogPath)) return;

    const stream = fs.createReadStream(this.tempLogPath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream });

    rl.on("line", (line) => {
      try {
        const data = JSON.parse(line) as { command: string; exitCode: number | null; output?: string };
        const event: RecordingEvent = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          source: "terminal",
          type: "terminal.command.executed",
          redactionLevel: "partial",
          payload: {
            command: data.command,
            cwd,
            exitCode: data.exitCode,
            output: data.output?.slice(0, 2000),
            shell,
          },
        } as RecordingEvent;
        onEvent(event);
      } catch {
        /* skip malformed lines */
      }
    });
  }
}
