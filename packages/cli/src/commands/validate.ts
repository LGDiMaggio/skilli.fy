/**
 * skillify CLI — validate command
 *
 * skillify validate <path>
 *
 * Validates a skill folder against Claude Skill requirements.
 */

import { Command } from "commander";
import chalk from "chalk";
import * as path from "node:path";
import * as fs from "node:fs";
import { validateSkill } from "@skillify/core";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate <path>")
    .description("Validate a skill folder against Claude Skill requirements.")
    .action((skillPath: string) => {
      const resolved = path.resolve(skillPath);

      if (!fs.existsSync(resolved)) {
        console.error(chalk.red(`Path not found: ${resolved}`));
        process.exit(1);
      }

      const stat = fs.statSync(resolved);
      let skillDir: string;
      let skillMdPath: string;

      if (stat.isDirectory()) {
        skillDir = resolved;
        skillMdPath = path.join(resolved, "SKILL.md");
      } else if (path.basename(resolved) === "SKILL.md") {
        skillDir = path.dirname(resolved);
        skillMdPath = resolved;
      } else {
        console.error(chalk.red("Provide a skill folder path or a SKILL.md file."));
        process.exit(1);
      }

      if (!fs.existsSync(skillMdPath)) {
        console.error(chalk.red(`SKILL.md not found in ${skillDir}`));
        process.exit(1);
      }

      const files = listAllFiles(skillDir, skillDir);
      const skillMdContent = fs.readFileSync(skillMdPath, "utf-8");

      const result = validateSkill({ files, skillMdContent });

      if (result.valid && result.issues.length === 0) {
        console.log(chalk.green("✓ Skill is valid — no issues found."));
        return;
      }

      if (result.valid) {
        console.log(chalk.green("✓ Skill is valid (with warnings):"));
      } else {
        console.log(chalk.red("✗ Skill has validation errors:"));
      }

      for (const issue of result.issues) {
        const icon =
          issue.severity === "error"
            ? chalk.red("✗")
            : issue.severity === "warning"
              ? chalk.yellow("⚠")
              : chalk.blue("ℹ");
        console.log(`  ${icon} [${issue.code}] ${issue.message}`);
      }

      if (!result.valid) {
        process.exit(1);
      }
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
