/**
 * @skillify/recorder — Provider interface
 *
 * Each provider watches a specific event source (terminal, fs, process, window)
 * and emits normalized RecordingEvents.
 */

import type { RecordingEvent } from "@skillify/core";

export type EventCallback = (event: RecordingEvent) => void;

export interface RecordingProvider {
  /** Human-readable name (e.g. "terminal", "filesystem"). */
  readonly name: string;
  /** Start watching / capturing. */
  start(onEvent: EventCallback): Promise<void>;
  /** Stop watching. */
  stop(): Promise<void>;
  /** Whether the provider is currently active. */
  isActive(): boolean;
}
