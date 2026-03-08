/**
 * @skillify/recorder — Recording Session Manager
 *
 * Orchestrates multiple providers, collects events into a JSONL file,
 * manages session lifecycle (start/stop/list/load).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { redactObject, type RedactionConfig, type RecordingEvent, type RecordingSession } from "@skillify/core";
import type { RecordingProvider } from "./provider.js";

export interface SessionManagerOptions {
  /** Directory to store recording sessions. Default: ~/.skillify/recordings */
  storageDir?: string;
  /** Redaction config applied to every event before persisting. */
  redaction?: RedactionConfig;
  /** If true, capture only metadata (no command output). */
  paranoidMode?: boolean;
}

export class SessionManager {
  private storageDir: string;
  private providers: RecordingProvider[] = [];
  private currentSession: RecordingSession | null = null;
  private eventStream: fs.WriteStream | null = null;
  private eventCount = 0;
  private redactionConfig: RedactionConfig;
  private paranoid: boolean;

  constructor(opts: SessionManagerOptions = {}) {
    this.storageDir = opts.storageDir ?? path.join(os.homedir(), ".skillify", "recordings");
    this.redactionConfig = opts.redaction ?? {};
    this.paranoid = opts.paranoidMode ?? false;
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  /** Register a provider. Call before start(). */
  addProvider(provider: RecordingProvider): void {
    this.providers.push(provider);
  }

  /** Start a new recording session. */
  async start(): Promise<RecordingSession> {
    if (this.currentSession) {
      throw new Error("A recording session is already active. Stop it first.");
    }

    const sessionId = randomUUID();
    const eventsFile = path.join(this.storageDir, `${sessionId}.jsonl`);

    this.currentSession = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      os: os.platform() as "windows" | "macos" | "linux",
      hostname: os.hostname(),
      cwd: process.cwd(),
      providers: this.providers.map((p) => p.name),
      eventCount: 0,
      filePath: eventsFile,
    };

    // Write session metadata
    const metaPath = path.join(this.storageDir, `${sessionId}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(this.currentSession, null, 2), "utf-8");

    // Open JSONL stream
    this.eventStream = fs.createWriteStream(eventsFile, { flags: "a", encoding: "utf-8" });
    this.eventCount = 0;

    // Start all providers
    const handler = (event: RecordingEvent) => this._handleEvent(event);
    await Promise.all(this.providers.map((p) => p.start(handler)));

    return this.currentSession;
  }

  /** Stop the current recording session. */
  async stop(): Promise<RecordingSession> {
    if (!this.currentSession) {
      throw new Error("No active recording session.");
    }

    // Stop all providers
    await Promise.all(this.providers.map((p) => p.stop()));

    // Close stream
    if (this.eventStream) {
      this.eventStream.end();
      this.eventStream = null;
    }

    // Update session metadata
    this.currentSession.stoppedAt = new Date().toISOString();
    this.currentSession.eventCount = this.eventCount;

    const metaPath = path.join(this.storageDir, `${this.currentSession.id}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(this.currentSession, null, 2), "utf-8");

    const session = { ...this.currentSession };
    this.currentSession = null;
    return session;
  }

  /** List all recorded sessions. */
  listSessions(): RecordingSession[] {
    const metaFiles = fs.readdirSync(this.storageDir).filter((f) => f.endsWith(".meta.json"));
    return metaFiles.map((f) => {
      const raw = fs.readFileSync(path.join(this.storageDir, f), "utf-8");
      return JSON.parse(raw) as RecordingSession;
    });
  }

  /** Load events from a session. */
  loadEvents(sessionId: string): RecordingEvent[] {
    const eventsFile = path.join(this.storageDir, `${sessionId}.jsonl`);
    if (!fs.existsSync(eventsFile)) {
      throw new Error(`Events file not found for session ${sessionId}`);
    }
    const lines = fs.readFileSync(eventsFile, "utf-8").split("\n").filter((l) => l.trim());
    return lines.map((l) => JSON.parse(l) as RecordingEvent);
  }

  /** Get the current session (or null). */
  getActiveSession(): RecordingSession | null {
    return this.currentSession;
  }

  // ─── Internal ──────────────────────────────────────────────
  private _handleEvent(event: RecordingEvent): void {
    // Paranoid mode: strip output from terminal events
    if (this.paranoid && event.source === "terminal") {
      const payload = event.payload as Record<string, unknown>;
      delete payload["output"];
      event.redactionLevel = "full";
    }

    // Redact sensitive data
    const redacted = redactObject(event, this.redactionConfig);

    // Write to JSONL
    if (this.eventStream) {
      this.eventStream.write(JSON.stringify(redacted) + "\n");
      this.eventCount++;
    }

    // Update session event count
    if (this.currentSession) {
      this.currentSession.eventCount = this.eventCount;
    }
  }
}
