/**
 * skillify CLI — generate command
 *
 * skillify generate <sessionId> [--name my-skill] [--output ./output]
 *
 * Loads a recording, mines the workflow, detects MCP servers,
 * generates a Claude Skill folder, and validates it.
 */

import { Command } from "commander";
import chalk from "chalk";
import * as path from "node:path";
import * as fs from "node:fs";
import { SessionManager } from "@skillify/recorder";
import {
  mineWorkflow,
  generateSkillManifest,
  generateSkillMarkdown,
  writeSkillToDisk,
  validateSkill,
  type ValidationIssue,
  type McpServerInfo,
} from "@skillify/core";
import { detectMcpServers, generateMcpJson, generateMcpSetupReference } from "@skillify/mcp";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate <sessionId>")
    .description("Generate a Claude Skill from a recorded session.")
    .option("--name <name>", "Override the skill name (kebab-case)")
    .option("--description <desc>", "Manual description for the skill")
    .option("--output <dir>", "Output directory", ".")
    .option("--triggers <phrases>", "Comma-separated trigger phrases")
    .option("--license <license>", "License (e.g. MIT)")
    .option("--no-mcp", "Skip MCP detection")
    .action(async (sessionId: string, opts) => {
      const manager = new SessionManager();

      // 1. Load events
      let events;
      try {
        events = manager.loadEvents(sessionId);
      } catch (err) {
        console.error(chalk.red(`Failed to load session ${sessionId}: ${err}`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Loaded ${events.length} events from session ${sessionId}`));

      // 2. Mine workflow
      console.log(chalk.dim("Mining workflow steps..."));
      const graph = mineWorkflow(events);
      console.log(chalk.green(`✓ Extracted ${graph.steps.length} steps, ${graph.parameters.length} parameters`));

      // 3. Detect MCP servers
      let mcpServerInfos: McpServerInfo[] = [];
      let mcpDetections: Awaited<ReturnType<typeof detectMcpServers>> = [];
      if (opts.mcp !== false) {
        console.log(chalk.dim("Detecting MCP server integrations..."));
        mcpDetections = detectMcpServers(events);
        if (mcpDetections.length > 0) {
          console.log(chalk.green(`✓ Detected ${mcpDetections.length} MCP server(s):`));
          for (const det of mcpDetections) {
            console.log(
              `  ${chalk.bold(det.server.name)} — confidence ${(det.confidence * 100).toFixed(0)}%`,
            );
            for (const reason of det.reasons.slice(0, 2)) {
              console.log(chalk.dim(`    → ${reason}`));
            }
          }
          // Build McpServerInfo array for the generator
          mcpServerInfos = mcpDetections.map((d) => ({
            id: d.server.id,
            name: d.server.name,
            package: d.server.package,
            installInstructions: d.server.installInstructions,
            envVars: d.server.envVars,
            description: d.server.description,
            confidence: d.confidence,
            reasons: d.reasons,
          }));
        } else {
          console.log(chalk.dim("  No MCP servers detected."));
        }
      }

      // 4. Generate skill
      const triggers = opts.triggers
        ? (opts.triggers as string).split(",").map((t: string) => t.trim())
        : undefined;

      const manifest = generateSkillManifest(graph, {
        name: opts.name,
        description: opts.description,
        license: opts.license,
        mcpServers: mcpServerInfos,
        triggerPhrases: triggers,
      });

      console.log(chalk.dim("Writing skill folder..."));
      const skillDir = await writeSkillToDisk(manifest, opts.output);

      // 5. Write MCP config if detected
      if (mcpDetections.length > 0) {
        const mcpJson = generateMcpJson(mcpDetections);
        fs.writeFileSync(
          path.join(skillDir, ".mcp.json"),
          JSON.stringify(mcpJson, null, 2),
          "utf-8",
        );

        // Write reference docs for each MCP server
        const refsDir = path.join(skillDir, "references");
        fs.mkdirSync(refsDir, { recursive: true });
        for (const det of mcpDetections) {
          const refContent = generateMcpSetupReference(det.server);
          fs.writeFileSync(
            path.join(refsDir, `mcp-${det.server.id}-setup.md`),
            refContent,
            "utf-8",
          );
        }
      }

      // 6. Validate
      const files = listAllFiles(skillDir, skillDir);
      const skillMdContent = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
      const validation = validateSkill({ files, skillMdContent });

      console.log();
      if (validation.valid) {
        console.log(chalk.green("✓ Skill is valid!"));
      } else {
        console.log(chalk.red("✗ Skill has validation errors:"));
      }
      printIssues(validation.issues);

      console.log();
      console.log(chalk.bold(`Skill generated at: ${path.resolve(skillDir)}`));
      console.log(
        chalk.cyan("Pack it with: ") +
          chalk.bold(`skillify pack ${skillDir}`),
      );
    });
}

function listAllFiles(dir: string, root: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listAllFiles(full, root));
    } else {
      result.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  }
  return result;
}

function printIssues(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    const icon =
      issue.severity === "error"
        ? chalk.red("✗")
        : issue.severity === "warning"
          ? chalk.yellow("⚠")
          : chalk.blue("ℹ");
    console.log(`  ${icon} [${issue.code}] ${issue.message}`);
  }
}
