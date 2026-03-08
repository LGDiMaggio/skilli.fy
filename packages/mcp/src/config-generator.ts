/**
 * @skillify/mcp — .mcp.json Generator
 *
 * Generates a .mcp.json configuration file for Claude Code / MCP SDK,
 * and reference documentation for SKILL.md prerequisites.
 */

import type { McpDetection } from "./detector.js";
import type { McpServerEntry } from "./registry.js";

/**
 * Shape of .mcp.json for Claude Code.
 * @see https://docs.anthropic.com/en/docs/claude-code/mcp
 */
export interface McpJsonConfig {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
}

/**
 * Generate a .mcp.json config from detected MCP servers.
 */
export function generateMcpJson(detections: McpDetection[]): McpJsonConfig {
  const servers: McpJsonConfig["mcpServers"] = {};

  for (const det of detections) {
    const entry = det.server;
    const args = parseInstallArgs(entry);

    const serverConfig: McpJsonConfig["mcpServers"][string] = {
      command: "npx",
      args: ["-y", entry.package, ...args],
    };

    if (entry.envVars && entry.envVars.length > 0) {
      serverConfig.env = {};
      for (const envVar of entry.envVars) {
        serverConfig.env[envVar] = `\${${envVar}}`;
      }
    }

    servers[entry.id] = serverConfig;
  }

  return { mcpServers: servers };
}

/**
 * Generate SKILL.md prerequisite markdown for an MCP detection.
 */
export function generateMcpPrerequisitesMd(detections: McpDetection[]): string {
  if (detections.length === 0) return "";

  let md = "## Prerequisites (MCP Integrations)\n\n";
  md += "This skill benefits from the following MCP server integrations:\n\n";

  for (const det of detections) {
    const entry = det.server;
    md += `### ${entry.name}\n\n`;
    md += `${entry.description}\n\n`;
    md += `**Install:**\n\`\`\`bash\n${entry.installInstructions}\n\`\`\`\n\n`;

    if (entry.prerequisites && entry.prerequisites.length > 0) {
      md += `**Prerequisites:** ${entry.prerequisites.join(", ")}\n\n`;
    }

    if (entry.envVars && entry.envVars.length > 0) {
      md += "**Required environment variables:**\n";
      for (const env of entry.envVars) {
        md += `- \`${env}\`\n`;
      }
      md += "\n";
    }

    md += `**Why detected:** ${det.reasons.slice(0, 3).join("; ")} `;
    md += `(confidence: ${(det.confidence * 100).toFixed(0)}%)\n\n`;
  }

  return md;
}

/**
 * Generate a reference doc file content for an MCP server setup.
 */
export function generateMcpSetupReference(entry: McpServerEntry): string {
  let md = `# ${entry.name} MCP Server Setup\n\n`;
  md += `${entry.description}\n\n`;
  md += "## Installation\n\n";
  md += `\`\`\`bash\n${entry.installInstructions}\n\`\`\`\n\n`;

  if (entry.prerequisites && entry.prerequisites.length > 0) {
    md += "## Prerequisites\n\n";
    for (const p of entry.prerequisites) {
      md += `- ${p}\n`;
    }
    md += "\n";
  }

  if (entry.envVars && entry.envVars.length > 0) {
    md += "## Environment Variables\n\n";
    for (const v of entry.envVars) {
      md += `- \`${v}\` — Set this in your environment or .env file.\n`;
    }
    md += "\n";
  }

  md += "## Claude Code Configuration\n\n";
  md += "Add to your `.mcp.json`:\n\n";
  md += "```json\n";
  const snippet: McpJsonConfig = {
    mcpServers: {
      [entry.id]: {
        command: "npx",
        args: ["-y", entry.package, ...parseInstallArgs(entry)],
        ...(entry.envVars && entry.envVars.length > 0
          ? { env: Object.fromEntries(entry.envVars.map((v) => [v, `\${${v}}`])) }
          : {}),
      },
    },
  };
  md += JSON.stringify(snippet, null, 2) + "\n";
  md += "```\n\n";

  md += "## Transport\n\n";
  md += `This server uses **${entry.transport}** transport.\n\n`;

  md += "## Troubleshooting\n\n";
  md += "### Connection refused\n";
  md += "Ensure the MCP server is installed and the above environment variables are set.\n\n";
  md += "### Authentication error\n";
  md += `Verify your API key/token is valid and has the required permissions.\n`;

  return md;
}

// ─── Helpers ───────────────────────────────────────────────
function parseInstallArgs(entry: McpServerEntry): string[] {
  // Extract any trailing args from installInstructions (after the package name)
  const parts = entry.installInstructions.split(/\s+/);
  const pkgIdx = parts.findIndex((p) => p === entry.package || p.includes(entry.package));
  if (pkgIdx >= 0 && pkgIdx < parts.length - 1) {
    return parts.slice(pkgIdx + 1);
  }
  return [];
}
