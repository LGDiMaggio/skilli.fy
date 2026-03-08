/**
 * Tests for @skillify/mcp — detection, config generation
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { RecordingEvent } from "@skillify/core";
import { detectMcpServers } from "../detector.js";
import { generateMcpJson, generateMcpPrerequisitesMd, generateMcpSetupReference } from "../config-generator.js";
import { MCP_REGISTRY } from "../registry.js";

function makeTerminalEvent(command: string): RecordingEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    source: "terminal",
    type: "terminal.command.executed",
    redactionLevel: "partial",
    payload: { command, cwd: "/project", exitCode: 0, output: "", shell: "bash" },
  } as RecordingEvent;
}

function makeFsEvent(filePath: string): RecordingEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    source: "fs",
    type: "fs.changed",
    redactionLevel: "partial",
    payload: { kind: "create", path: filePath, isDirectory: false },
  } as RecordingEvent;
}

function makeWindowEvent(title: string, appName?: string): RecordingEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    source: "window",
    type: "window.focus.changed",
    redactionLevel: "partial",
    payload: { windowTitle: title, appName: appName ?? "browser" },
  } as RecordingEvent;
}

describe("detectMcpServers", () => {
  it("detects GitHub from git commands", () => {
    const events = [makeTerminalEvent("git push origin main")];
    const results = detectMcpServers(events);
    expect(results.some((r) => r.server.id === "github")).toBe(true);
  });

  it("detects Notion from hostname in window", () => {
    const events = [makeWindowEvent("My Page — notion.so")];
    const results = detectMcpServers(events);
    expect(results.some((r) => r.server.id === "notion")).toBe(true);
  });

  it("detects Docker from docker commands", () => {
    const events = [makeTerminalEvent("docker build -t myimage .")];
    const results = detectMcpServers(events);
    expect(results.some((r) => r.server.id === "docker")).toBe(true);
  });

  it("detects PostgreSQL from psql command", () => {
    const events = [makeTerminalEvent("psql -h localhost -U postgres mydb")];
    const results = detectMcpServers(events);
    expect(results.some((r) => r.server.id === "postgres")).toBe(true);
  });

  it("detects Sentry from sentry config file", () => {
    const events = [makeFsEvent("/project/.sentryclirc")];
    const results = detectMcpServers(events);
    expect(results.some((r) => r.server.id === "sentry")).toBe(true);
  });

  it("detects SQLite from .sqlite file pattern", () => {
    const events = [makeFsEvent("/project/data.sqlite")];
    const results = detectMcpServers(events);
    expect(results.some((r) => r.server.id === "sqlite")).toBe(true);
  });

  it("sorts by confidence descending", () => {
    const events = [
      makeTerminalEvent("git push origin main"),
      makeTerminalEvent("gh release create v1.0"),
      makeWindowEvent("github.com — Pull Requests"),
      makeTerminalEvent("psql -h localhost"),
    ];
    const results = detectMcpServers(events);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it("returns empty for unrelated events", () => {
    const events = [makeTerminalEvent("echo hello"), makeFsEvent("/tmp/notes.txt")];
    const results = detectMcpServers(events);
    expect(results).toHaveLength(0);
  });
});

describe("generateMcpJson", () => {
  it("produces valid .mcp.json structure", () => {
    const events = [makeTerminalEvent("git push origin main")];
    const detections = detectMcpServers(events);
    const config = generateMcpJson(detections);
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers["github"]).toBeDefined();
    expect(config.mcpServers["github"].command).toBe("npx");
  });
});

describe("generateMcpPrerequisitesMd", () => {
  it("produces markdown with server info", () => {
    const events = [makeTerminalEvent("git push origin main")];
    const detections = detectMcpServers(events);
    const md = generateMcpPrerequisitesMd(detections);
    expect(md).toContain("GitHub");
    expect(md).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
  });
});

describe("generateMcpSetupReference", () => {
  it("produces reference doc content", () => {
    const github = MCP_REGISTRY.find((s) => s.id === "github")!;
    const md = generateMcpSetupReference(github);
    expect(md).toContain("# GitHub MCP Server Setup");
    expect(md).toContain("Environment Variables");
    expect(md).toContain(".mcp.json");
  });
});
