/**
 * Tests for @skillify/core — workflow mining, generation, validation, redaction
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { RecordingEvent } from "../schemas/events.js";
import { mineWorkflow } from "../mining.js";
import { generateSkillMarkdown } from "../generator.js";
import { validateFrontmatter, validateSkill } from "../validator.js";
import { redactString, redactObject } from "../redaction.js";

// ── Helpers ─────────────────────────────────────────────────
function makeTerminalEvent(command: string, exitCode: number = 0, tsOffset = 0): RecordingEvent {
  return {
    id: randomUUID(),
    timestamp: new Date(Date.now() + tsOffset).toISOString(),
    source: "terminal",
    type: "terminal.command.executed",
    redactionLevel: "partial",
    payload: {
      command,
      cwd: "/home/user/project",
      exitCode,
      output: `Output of: ${command}`,
      shell: "bash",
    },
  } as RecordingEvent;
}

function makeFsEvent(kind: "create" | "modify" | "delete", filePath: string, tsOffset = 0): RecordingEvent {
  return {
    id: randomUUID(),
    timestamp: new Date(Date.now() + tsOffset).toISOString(),
    source: "fs",
    type: "fs.changed",
    redactionLevel: "partial",
    payload: { kind, path: filePath, isDirectory: false },
  } as RecordingEvent;
}

// ── Mining ──────────────────────────────────────────────────
describe("mineWorkflow", () => {
  it("returns empty graph for no events", () => {
    const graph = mineWorkflow([]);
    expect(graph.steps).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("groups consecutive terminal events into steps", () => {
    const events = [
      makeTerminalEvent("npm install", 0, 0),
      makeTerminalEvent("npm test", 0, 1000),
      makeTerminalEvent("npm run build", 0, 2000),
    ];
    const graph = mineWorkflow(events);
    expect(graph.steps.length).toBeGreaterThanOrEqual(1);
    expect(graph.steps[0].commands.length).toBeGreaterThan(0);
  });

  it("splits steps on source change", () => {
    const events = [
      makeTerminalEvent("npm install", 0, 0),
      makeFsEvent("modify", "/home/user/project/package.json", 5000),
      makeTerminalEvent("npm test", 0, 10000),
    ];
    const graph = mineWorkflow(events);
    expect(graph.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("captures error patterns from failed commands", () => {
    const events = [makeTerminalEvent("npm test", 1, 0)];
    const graph = mineWorkflow(events);
    const errors = graph.steps.flatMap((s) => s.errorPatterns);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("exited with code 1");
  });

  it("detects parameters from repeated values", () => {
    const events = [
      makeTerminalEvent("deploy my-project", 0, 0),
      makeTerminalEvent("test my-project", 0, 1000),
      makeFsEvent("modify", "/home/user/my-project/config.json", 2000),
    ];
    const graph = mineWorkflow(events);
    const paramNames = graph.parameters.map((p) => p.defaultValue);
    expect(paramNames).toContain("my-project");
  });
});

// ── Generator ───────────────────────────────────────────────
describe("generateSkillMarkdown", () => {
  it("produces valid YAML frontmatter", () => {
    const events = [
      makeTerminalEvent("npm install", 0, 0),
      makeTerminalEvent("npm test", 0, 1000),
    ];
    const graph = mineWorkflow(events);
    const { markdown } = generateSkillMarkdown(graph, { name: "test-skill" });
    expect(markdown).toMatch(/^---\n/);
    expect(markdown).toContain("name: test-skill");
    expect(markdown).toContain("description:");
  });

  it("includes MCP prerequisites when specified", () => {
    const events = [makeTerminalEvent("git push", 0, 0)];
    const graph = mineWorkflow(events);
    const { markdown } = generateSkillMarkdown(graph, {
      name: "mcp-test",
      mcpServers: [
        {
          id: "github",
          name: "GitHub",
          package: "@modelcontextprotocol/server-github",
          installInstructions: "npx -y @modelcontextprotocol/server-github",
          envVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
          description: "Interact with GitHub repos, issues, PRs.",
          confidence: 0.8,
          reasons: ['Command "git push" matches pattern'],
        },
      ],
    });
    expect(markdown).toContain("Prerequisites (MCP Integrations)");
    expect(markdown).toContain("GitHub");
    expect(markdown).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
    expect(markdown).toContain(".mcp.json");
  });

  it("includes examples section", () => {
    const events = [makeTerminalEvent("echo hello", 0, 0)];
    const graph = mineWorkflow(events);
    const { markdown } = generateSkillMarkdown(graph, { name: "example-test" });
    expect(markdown).toContain("## Examples");
  });

  it("includes troubleshooting section", () => {
    const events = [makeTerminalEvent("fail-cmd", 1, 0)];
    const graph = mineWorkflow(events);
    const { markdown } = generateSkillMarkdown(graph, { name: "trouble-test" });
    expect(markdown).toContain("## Troubleshooting");
  });
});

// ── Validator ───────────────────────────────────────────────
describe("validateFrontmatter", () => {
  it("passes valid frontmatter", () => {
    const md = `---\nname: my-skill\ndescription: Does X. Use when user says Y.\n---\n\n# My Skill`;
    const result = validateFrontmatter(md);
    expect(result.valid).toBe(true);
  });

  it("rejects missing frontmatter", () => {
    const result = validateFrontmatter("# No frontmatter here");
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("FM_MISSING");
  });

  it("rejects invalid YAML", () => {
    const md = "---\n: broken yaml [[\n---\n";
    const result = validateFrontmatter(md);
    expect(result.valid).toBe(false);
  });

  it("rejects non-kebab-case name", () => {
    const md = `---\nname: My Skill\ndescription: test description\n---\n`;
    const result = validateFrontmatter(md);
    expect(result.valid).toBe(false);
  });

  it("rejects reserved names", () => {
    const md = `---\nname: claude-skill\ndescription: test description\n---\n`;
    const result = validateFrontmatter(md);
    expect(result.valid).toBe(false);
  });

  it("rejects XML brackets in description", () => {
    const md = `---\nname: my-skill\ndescription: Use <tags> here\n---\n`;
    const result = validateFrontmatter(md);
    expect(result.valid).toBe(false);
  });

  it("warns on short description", () => {
    const md = `---\nname: my-skill\ndescription: Short.\n---\n`;
    const result = validateFrontmatter(md);
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === "FM_DESC_SHORT")).toBe(true);
  });

  it("warns on missing trigger phrases", () => {
    const md = `---\nname: my-skill\ndescription: A long description that explains the skill fully.\n---\n`;
    const result = validateFrontmatter(md);
    expect(result.issues.some((i) => i.code === "FM_DESC_NO_TRIGGER")).toBe(true);
  });
});

describe("validateSkill", () => {
  it("reports missing SKILL.md", () => {
    const result = validateSkill({ files: ["README.md"], skillMdContent: "" });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_SKILL_MD")).toBe(true);
  });

  it("warns about README.md in skill folder", () => {
    const md = `---\nname: test\ndescription: A long test description with stuff.\n---\n# Test`;
    const result = validateSkill({ files: ["SKILL.md", "README.md"], skillMdContent: md });
    expect(result.issues.some((i) => i.code === "HAS_README")).toBe(true);
  });
});

// ── Redaction ───────────────────────────────────────────────
describe("redactString", () => {
  it("redacts API keys", () => {
    const input = "api_key=AKIA1234567890ABCDEF";
    expect(redactString(input)).not.toContain("AKIA1234567890ABCDEF");
  });

  it("redacts emails", () => {
    const input = "Contact user@example.com for details";
    expect(redactString(input)).not.toContain("user@example.com");
  });

  it("redacts GitHub tokens", () => {
    const input = "token=ghp_1234567890abcdef1234567890abcdef12345678";
    expect(redactString(input)).not.toContain("ghp_1234567890abcdef");
  });

  it("redacts connection strings", () => {
    const input = "DB=postgres://user:pass@host:5432/mydb";
    expect(redactString(input)).not.toContain("user:pass@host");
  });

  it("respects allowList", () => {
    const input = "found ghp_1234567890abcdef1234567890abcdef12345678 in logs";
    const result = redactString(input, { allowList: ["ghp_1234567890abcdef1234567890abcdef12345678"] });
    expect(result).toContain("ghp_1234567890abcdef1234567890abcdef12345678");
  });
});

describe("redactObject", () => {
  it("redacts sensitive path prefixes in strings", () => {
    const input = "/home/john/secrets/data.txt is the file";
    const result = redactString(input, { sensitivePathPrefixes: ["/home/john/secrets"] });
    expect(result).not.toContain("/home/john/secrets");
    expect(result).toContain("[SENSITIVE_PATH]");
  });

  it("recursively redacts strings in deep objects", () => {
    const event = {
      nested: {
        deep: { value: "ghp_1234567890abcdef1234567890abcdef12345678" },
      },
    };
    const result = redactObject(event);
    expect((result as any).nested.deep.value).not.toContain("ghp_1234567890abcdef");
  });
});
