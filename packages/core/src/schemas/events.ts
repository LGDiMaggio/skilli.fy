/**
 * @skillify/core — Event Schemas
 *
 * Defines the normalized event types captured during recording.
 * Every event follows a common envelope with a typed payload.
 */

import { z } from "zod";

// ── Redaction level ──────────────────────────────────────────
export const RedactionLevel = z.enum(["none", "partial", "full"]);
export type RedactionLevel = z.infer<typeof RedactionLevel>;

// ── Base event envelope ──────────────────────────────────────
export const BaseEvent = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  source: z.string(),           // e.g. "terminal", "fs", "process", "window", "browser", "clipboard"
  type: z.string(),             // e.g. "terminal.command.executed"
  redactionLevel: RedactionLevel.default("partial"),
  meta: z.record(z.unknown()).optional(),
});
export type BaseEvent = z.infer<typeof BaseEvent>;

// ── Terminal ─────────────────────────────────────────────────
export const TerminalCommandPayload = z.object({
  command: z.string(),
  cwd: z.string(),
  exitCode: z.number().nullable(),
  output: z.string().optional(),       // redacted by default
  shell: z.string().optional(),        // e.g. "bash", "pwsh"
  durationMs: z.number().optional(),
});
export type TerminalCommandPayload = z.infer<typeof TerminalCommandPayload>;

export const TerminalEvent = BaseEvent.extend({
  source: z.literal("terminal"),
  type: z.literal("terminal.command.executed"),
  payload: TerminalCommandPayload,
});
export type TerminalEvent = z.infer<typeof TerminalEvent>;

// ── Filesystem ───────────────────────────────────────────────
export const FsChangeKind = z.enum(["create", "modify", "delete", "rename"]);
export type FsChangeKind = z.infer<typeof FsChangeKind>;

export const FsChangePayload = z.object({
  kind: FsChangeKind,
  path: z.string(),
  oldPath: z.string().optional(),      // for rename
  isDirectory: z.boolean().default(false),
  sizeBytes: z.number().optional(),
});
export type FsChangePayload = z.infer<typeof FsChangePayload>;

export const FsEvent = BaseEvent.extend({
  source: z.literal("fs"),
  type: z.literal("fs.changed"),
  payload: FsChangePayload,
});
export type FsEvent = z.infer<typeof FsEvent>;

// ── Process ──────────────────────────────────────────────────
export const ProcessPayload = z.object({
  pid: z.number(),
  name: z.string(),
  action: z.enum(["started", "stopped"]),
  exitCode: z.number().nullable().optional(),
  execPath: z.string().optional(),
});
export type ProcessPayload = z.infer<typeof ProcessPayload>;

export const ProcessEvent = BaseEvent.extend({
  source: z.literal("process"),
  type: z.enum(["process.started", "process.stopped"]),
  payload: ProcessPayload,
});
export type ProcessEvent = z.infer<typeof ProcessEvent>;

// ── Window / Active app ──────────────────────────────────────
export const WindowFocusPayload = z.object({
  windowTitle: z.string(),
  appName: z.string().optional(),
  pid: z.number().optional(),
});
export type WindowFocusPayload = z.infer<typeof WindowFocusPayload>;

export const WindowEvent = BaseEvent.extend({
  source: z.literal("window"),
  type: z.literal("window.focus.changed"),
  payload: WindowFocusPayload,
});
export type WindowEvent = z.infer<typeof WindowEvent>;

// ── Browser (optional MVP) ───────────────────────────────────
export const BrowserPayload = z.object({
  url: z.string(),
  title: z.string().optional(),
  action: z.enum(["navigate", "download", "upload"]).default("navigate"),
});
export type BrowserPayload = z.infer<typeof BrowserPayload>;

export const BrowserEvent = BaseEvent.extend({
  source: z.literal("browser"),
  type: z.literal("browser.navigation"),
  payload: BrowserPayload,
});
export type BrowserEvent = z.infer<typeof BrowserEvent>;

// ── Clipboard (off by default) ───────────────────────────────
export const ClipboardPayload = z.object({
  action: z.enum(["changed"]),
  hasText: z.boolean(),
  // No content stored — only metadata
});
export type ClipboardPayload = z.infer<typeof ClipboardPayload>;

export const ClipboardEvent = BaseEvent.extend({
  source: z.literal("clipboard"),
  type: z.literal("clipboard.changed"),
  payload: ClipboardPayload,
});
export type ClipboardEvent = z.infer<typeof ClipboardEvent>;

// ── Union of all events ──────────────────────────────────────
export const RecordingEvent = z.discriminatedUnion("source", [
  TerminalEvent,
  FsEvent,
  ProcessEvent,
  WindowEvent,
  BrowserEvent,
  ClipboardEvent,
]);
export type RecordingEvent = z.infer<typeof RecordingEvent>;

// ── Recording session ────────────────────────────────────────
export const RecordingSession = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  stoppedAt: z.string().datetime().optional(),
  os: z.enum(["windows", "macos", "linux"]),
  hostname: z.string().optional(),
  cwd: z.string().optional(),
  providers: z.array(z.string()),      // which providers were active
  eventCount: z.number().default(0),
  filePath: z.string(),               // path to the JSONL events file
});
export type RecordingSession = z.infer<typeof RecordingSession>;
