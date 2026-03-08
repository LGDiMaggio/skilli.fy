/**
 * @skillify/recorder — Active Window provider
 *
 * Polls the active/focused window title at regular intervals.
 * Emits window.focus.changed events when the foreground app changes.
 *
 * Cross-platform:
 *  - Windows: PowerShell Get-Process + Win32 GetForegroundWindow
 *  - macOS: osascript
 *  - Linux: xdotool (best-effort)
 */

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import * as os from "node:os";
import type { RecordingEvent } from "@skillify/core";
import type { EventCallback, RecordingProvider } from "../provider.js";

export interface WindowProviderOptions {
  /** Polling interval in ms. Default 2000. */
  pollIntervalMs?: number;
}

interface WindowInfo {
  title: string;
  appName?: string;
  pid?: number;
}

export class WindowProvider implements RecordingProvider {
  readonly name = "window";
  private active = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastWindow: WindowInfo | null = null;
  private opts: WindowProviderOptions;

  constructor(opts: WindowProviderOptions = {}) {
    this.opts = opts;
  }

  async start(onEvent: EventCallback): Promise<void> {
    if (this.active) return;

    const interval = this.opts.pollIntervalMs ?? 2000;

    this.lastWindow = this._getActiveWindow();

    this.timer = setInterval(() => {
      const current = this._getActiveWindow();
      if (!current) return;

      if (
        !this.lastWindow ||
        current.title !== this.lastWindow.title ||
        current.appName !== this.lastWindow.appName
      ) {
        const event: RecordingEvent = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          source: "window",
          type: "window.focus.changed",
          redactionLevel: "partial",
          payload: {
            windowTitle: current.title,
            appName: current.appName,
            pid: current.pid,
          },
        } as RecordingEvent;
        onEvent(event);
        this.lastWindow = current;
      }
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

  private _getActiveWindow(): WindowInfo | null {
    try {
      const platform = os.platform();

      if (platform === "win32") {
        // Use PowerShell to get the foreground window title
        const script = `
          Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
              [DllImport("user32.dll")]
              public static extern IntPtr GetForegroundWindow();
              [DllImport("user32.dll")]
              public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
              [DllImport("user32.dll")]
              public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
            }
"@
          $hwnd = [Win32]::GetForegroundWindow()
          $sb = New-Object System.Text.StringBuilder 256
          [Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
          $title = $sb.ToString()
          $pid = 0
          [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
          $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
          "$title|||$($proc.ProcessName)|||$pid"
        `;
        const output = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
          encoding: "utf-8",
          timeout: 3000,
        }).trim();
        const [title, appName, pidStr] = output.split("|||");
        return {
          title: title || "Unknown",
          appName: appName || undefined,
          pid: pidStr ? parseInt(pidStr, 10) : undefined,
        };
      }

      if (platform === "darwin") {
        const output = execSync(
          `osascript -e 'tell application "System Events" to get {name, unix id} of first application process whose frontmost is true'`,
          { encoding: "utf-8", timeout: 3000 },
        ).trim();
        const parts = output.split(", ");
        return {
          title: parts[0] || "Unknown",
          appName: parts[0],
          pid: parts[1] ? parseInt(parts[1], 10) : undefined,
        };
      }

      // Linux — xdotool
      const _windowId = execSync("xdotool getactivewindow", { encoding: "utf-8", timeout: 2000 }).trim();
      const title = execSync(`xdotool getactivewindow getwindowname`, { encoding: "utf-8", timeout: 2000 }).trim();
      const pid = execSync(`xdotool getactivewindow getwindowpid`, { encoding: "utf-8", timeout: 2000 }).trim();
      return {
        title,
        pid: pid ? parseInt(pid, 10) : undefined,
      };
    } catch {
      return null;
    }
  }
}
