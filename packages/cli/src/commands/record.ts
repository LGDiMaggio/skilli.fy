/**
 * skillify CLI — record commands
 *
 * skillify record start [--providers terminal,fs,process,window] [--cwd .]
 * skillify record stop
 * skillify record list
 */

import { Command } from "commander";
import chalk from "chalk";
import { SessionManager } from "@skillify/recorder";
import { FsProvider, TerminalProvider, ProcessProvider, WindowProvider } from "@skillify/recorder";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const LOCK_FILE = path.join(os.homedir(), ".skillify", ".recording.lock");

export function registerRecordCommand(program: Command): void {
  const record = program
    .command("record")
    .description("Record a workflow on your computer.");

  // ─── start ────────────────────────────────────────────────
  record
    .command("start")
    .description("Start recording events (terminal, filesystem, processes, window).")
    .option(
      "--providers <list>",
      "Comma-separated provider list: terminal,fs,process,window",
      "terminal,fs,process",
    )
    .option("--cwd <dir>", "Working directory to watch", process.cwd())
    .option("--paranoid", "Capture only metadata (no command output)", false)
    .action(async (opts) => {
      if (fs.existsSync(LOCK_FILE)) {
        console.error(
          chalk.red("A recording session is already active. Run `skillify record stop` first."),
        );
        process.exit(1);
      }

      const manager = createManager(opts.paranoid);
      const providerNames = (opts.providers as string).split(",").map((p: string) => p.trim());

      for (const name of providerNames) {
        switch (name) {
          case "terminal":
            manager.addProvider(new TerminalProvider({ cwd: opts.cwd }));
            break;
          case "fs":
            manager.addProvider(new FsProvider({ watchPaths: [opts.cwd] }));
            break;
          case "process":
            manager.addProvider(new ProcessProvider());
            break;
          case "window":
            manager.addProvider(new WindowProvider());
            break;
          default:
            console.warn(chalk.yellow(`Unknown provider: ${name}`));
        }
      }

      const session = await manager.start();

      // Write lock file so `stop` can find the session
      fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
      fs.writeFileSync(
        LOCK_FILE,
        JSON.stringify({ sessionId: session.id, pid: process.pid }),
        "utf-8",
      );

      console.log(chalk.green(`✓ Recording started — session ${session.id}`));
      console.log(chalk.dim(`  Providers: ${providerNames.join(", ")}`));
      console.log(chalk.dim(`  CWD: ${opts.cwd}`));
      console.log(chalk.dim(`  Events file: ${session.filePath}`));
      console.log();
      console.log(
        chalk.cyan("Perform your workflow now. When done, run: ") +
          chalk.bold("skillify record stop"),
      );

      // Keep process alive until killed or `stop` signals
      process.on("SIGINT", async () => {
        await manager.stop();
        cleanupLock();
        console.log(chalk.yellow("\nRecording stopped (interrupted)."));
        process.exit(0);
      });

      process.on("SIGTERM", async () => {
        await manager.stop();
        cleanupLock();
        process.exit(0);
      });
    });

  // ─── stop ─────────────────────────────────────────────────
  record
    .command("stop")
    .description("Stop the active recording session.")
    .action(async () => {
      if (!fs.existsSync(LOCK_FILE)) {
        console.error(chalk.red("No active recording session found."));
        process.exit(1);
      }

      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8")) as {
        sessionId: string;
        pid: number;
      };

      // Send SIGTERM to the recording process
      try {
        process.kill(lock.pid, "SIGTERM");
      } catch {
        // Process may already be gone
      }

      cleanupLock();
      console.log(chalk.green(`✓ Recording stopped — session ${lock.sessionId}`));
      console.log(
        chalk.cyan("Generate a skill with: ") +
          chalk.bold(`skillify generate ${lock.sessionId}`),
      );
    });

  // ─── list ─────────────────────────────────────────────────
  record
    .command("list")
    .description("List all recorded sessions.")
    .action(() => {
      const manager = createManager(false);
      const sessions = manager.listSessions();

      if (sessions.length === 0) {
        console.log(chalk.dim("No recordings found."));
        return;
      }

      console.log(chalk.bold("Recorded sessions:\n"));
      for (const s of sessions) {
        const status = s.stoppedAt ? chalk.green("done") : chalk.yellow("active");
        console.log(
          `  ${chalk.cyan(s.id)}  ${status}  ${s.eventCount} events  ${s.startedAt}`,
        );
      }
    });
}

function createManager(paranoid: boolean): SessionManager {
  return new SessionManager({ paranoidMode: paranoid });
}

function cleanupLock(): void {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* ignore */
  }
}
