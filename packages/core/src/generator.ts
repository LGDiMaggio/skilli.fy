/**
 * @skillify/core — Skill Generator
 *
 * Converts a WorkflowGraph into a ready-to-upload Claude Skill folder:
 *   skill-name/
 *     SKILL.md
 *     scripts/   (optional)
 *     references/ (optional)
 *     assets/    (optional)
 */

import { stringify as yamlStringify } from "yaml";
import type { WorkflowGraph } from "./schemas/workflow.js";
import type { SkillFrontmatter, SkillManifest } from "./schemas/skill.js";

// ─── Options ───────────────────────────────────────────────

/** Compact descriptor passed from the MCP detector into the generator. */
export interface McpServerInfo {
  /** Unique identifier (matches registry id). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** npm package or repo. */
  package: string;
  /** Install shell command. */
  installInstructions: string;
  /** Required environment variables. */
  envVars?: string[];
  /** Short description. */
  description: string;
  /** Detection confidence (0–1). */
  confidence: number;
  /** Human-readable reasons why this MCP was detected. */
  reasons: string[];
}

export interface GeneratorOptions {
  /** Override the skill name (kebab-case). Defaults to workflow graph name. */
  name?: string;
  /** Manual description; if omitted, auto-generated from the workflow. */
  description?: string;
  /** License string (e.g. "MIT"). */
  license?: string;
  /** Compatibility note. */
  compatibility?: string;
  /** Extra metadata key-values. */
  metadata?: Record<string, unknown>;
  /** MCP servers detected during the recording, with full info. */
  mcpServers?: McpServerInfo[];
  /** Trigger phrases the user confirmed/added. */
  triggerPhrases?: string[];
}

// ─── Helpers ───────────────────────────────────────────────
function buildDescription(graph: WorkflowGraph, opts: GeneratorOptions): string {
  if (opts.description) return opts.description;

  const stepSummaries = graph.steps
    .slice(0, 5)
    .map((s) => s.title)
    .join(", ");

  const triggerPart =
    opts.triggerPhrases && opts.triggerPhrases.length > 0
      ? ` Use when user says ${opts.triggerPhrases.map((t) => `"${t}"`).join(", ")}.`
      : "";

  return `${graph.description} Steps include: ${stepSummaries}.${triggerPart}`;
}

function buildFrontmatter(graph: WorkflowGraph, opts: GeneratorOptions): SkillFrontmatter {
  const fm: SkillFrontmatter = {
    name: opts.name ?? graph.name,
    description: buildDescription(graph, opts).slice(0, 1024),
  };

  if (opts.license) fm.license = opts.license;
  if (opts.compatibility) fm.compatibility = opts.compatibility;

  const meta: Record<string, unknown> = { ...(opts.metadata ?? {}) };
  if (opts.mcpServers && opts.mcpServers.length > 0) {
    meta["mcp-servers"] = opts.mcpServers.map((s) => s.id);
  }
  meta["generated-by"] = "skillify";
  meta["version"] = "0.1.0";
  if (Object.keys(meta).length > 0) fm.metadata = meta;

  return fm;
}

function renderSteps(graph: WorkflowGraph): string {
  return graph.steps
    .map((step, idx) => {
      let md = `### Step ${idx + 1}: ${step.title}\n\n`;
      md += `${step.summary}\n\n`;

      if (step.commands.length > 0) {
        md += "```bash\n";
        for (const cmd of step.commands) {
          md += `${cmd}\n`;
        }
        md += "```\n\n";
      }

      if (step.filesAffected.length > 0) {
        md += `**Files affected:** ${step.filesAffected.join(", ")}\n\n`;
      }

      if (step.inputs.length > 0) {
        md += "**Inputs:**\n";
        for (const input of step.inputs) {
          md += `- \`${input.name}\`${input.description ? ` — ${input.description}` : ""}${input.defaultValue ? ` (default: \`${input.defaultValue}\`)` : ""}\n`;
        }
        md += "\n";
      }

      return md;
    })
    .join("");
}

function renderParameters(graph: WorkflowGraph): string {
  if (graph.parameters.length === 0) return "";

  let md = "## Parameters\n\n";
  md += "| Name | Description | Default |\n|------|-------------|----------|\n";
  for (const p of graph.parameters) {
    md += `| \`{${p.name}}\` | ${p.description ?? "-"} | ${p.defaultValue ? `\`${p.defaultValue}\`` : "-"} |\n`;
  }
  md += "\n";
  return md;
}

function renderTroubleshooting(graph: WorkflowGraph): string {
  const allErrors = graph.steps.flatMap((s) => s.errorPatterns);
  if (allErrors.length === 0) {
    return (
      "## Troubleshooting\n\n" +
      "### Error: Command failed with non-zero exit code\n" +
      "**Cause:** A prerequisite may be missing or the command syntax is wrong.\n" +
      "**Solution:** Verify that all dependencies are installed and paths are correct.\n\n"
    );
  }

  let md = "## Troubleshooting\n\n";
  for (const err of allErrors.slice(0, 5)) {
    md += `### Error: ${err.message}\n`;
    if (err.cause) md += `**Cause:** ${err.cause}\n`;
    if (err.solution) md += `**Solution:** ${err.solution}\n`;
    md += "\n";
  }
  return md;
}

function renderExamples(graph: WorkflowGraph, opts: GeneratorOptions): string {
  let md = "## Examples\n\n";

  // Example 1 — basic run
  md += "### Example 1: Run the full workflow\n\n";
  md += "**User says:** ";
  if (opts.triggerPhrases && opts.triggerPhrases.length > 0) {
    md += `"${opts.triggerPhrases[0]}"\n\n`;
  } else {
    md += `"Execute the ${graph.name} workflow"\n\n`;
  }
  md += "**Actions:**\n";
  for (const step of graph.steps) {
    md += `1. ${step.title}\n`;
  }
  md += "\n**Result:** Workflow completed successfully.\n\n";

  // Example 2 — with parameters
  if (graph.parameters.length > 0) {
    md += "### Example 2: Run with custom parameters\n\n";
    md += "**User says:** \"Run the workflow with ";
    md += graph.parameters.map((p) => `${p.name}=example`).join(", ");
    md += "\"\n\n";
    md += "**Actions:** Same as Example 1 but using the provided parameter values.\n\n";
  }

  return md;
}

function renderMcpPrerequisites(opts: GeneratorOptions): string {
  if (!opts.mcpServers || opts.mcpServers.length === 0) return "";

  let md = "## Prerequisites (MCP Integrations)\n\n";
  md += "This skill requires the following MCP server(s) to be connected ";
  md += "so that Claude can interact directly with external services used ";
  md += "in this workflow.\n\n";

  for (const server of opts.mcpServers) {
    md += `### ${server.name}\n\n`;
    md += `${server.description}\n\n`;

    // Install command
    md += "**Install & run:**\n";
    md += `\`\`\`bash\n${server.installInstructions}\n\`\`\`\n\n`;

    // Environment variables
    if (server.envVars && server.envVars.length > 0) {
      md += "**Required environment variables:**\n";
      for (const v of server.envVars) {
        md += `- \`${v}\` — set this before starting the server.\n`;
      }
      md += "\n";
    }

    // .mcp.json snippet for Claude Code
    md += "**Claude Code `.mcp.json` snippet:**\n";
    md += "```json\n";
    const snippet: Record<string, unknown> = {
      command: "npx",
      args: ["-y", server.package],
    };
    if (server.envVars && server.envVars.length > 0) {
      snippet["env"] = Object.fromEntries(
        server.envVars.map((v) => [v, `\${${v}}`]),
      );
    }
    md += JSON.stringify({ mcpServers: { [server.id]: snippet } }, null, 2) + "\n";
    md += "```\n\n";

    // Confidence
    md += `> Detected automatically (confidence: ${(server.confidence * 100).toFixed(0)}%) — `;
    md += server.reasons.slice(0, 2).join("; ") + ".\n\n";

    // Self-contained reference link
    md += `See [references/mcp-${server.id}-setup.md](references/mcp-${server.id}-setup.md) for full setup details.\n\n`;
  }

  return md;
}

// ─── Main generator ────────────────────────────────────────
export function generateSkillMarkdown(
  graph: WorkflowGraph,
  opts: GeneratorOptions = {},
): { frontmatter: SkillFrontmatter; markdown: string } {
  const fm = buildFrontmatter(graph, opts);

  const yamlBlock = yamlStringify(fm).trim();

  let md = `---\n${yamlBlock}\n---\n\n`;
  md += `# ${fm.name}\n\n`;
  md += renderMcpPrerequisites(opts);
  md += renderParameters(graph);
  md += "## Quick Start\n\n";
  md += `Ask Claude: "Help me ${graph.steps[0]?.title.toLowerCase() ?? "run this workflow"}"\n\n`;
  md += "## Instructions\n\n";
  md += renderSteps(graph);
  md += renderExamples(graph, opts);
  md += renderTroubleshooting(graph);

  return { frontmatter: fm, markdown: md };
}

/**
 * Build the full SkillManifest (in-memory representation of the skill folder).
 */
export function generateSkillManifest(
  graph: WorkflowGraph,
  opts: GeneratorOptions = {},
): SkillManifest {
  const { frontmatter, markdown } = generateSkillMarkdown(graph, opts);

  const scripts: string[] = [];
  const references: string[] = [];
  const assets: string[] = [];

  // If MCP servers are suggested, add reference docs
  if (opts.mcpServers && opts.mcpServers.length > 0) {
    for (const server of opts.mcpServers) {
      references.push(`mcp-${server.id}-setup.md`);
    }
  }

  return {
    folderPath: frontmatter.name,
    frontmatter,
    bodyMarkdown: markdown,
    scripts,
    references,
    assets,
  };
}
