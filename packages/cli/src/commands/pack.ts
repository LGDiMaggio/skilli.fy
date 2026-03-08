/**
 * skillify CLI — pack command
 *
 * skillify pack <path> [--output <zipPath>]
 *
 * Creates a zip archive ready for upload to Claude.ai.
 */

import { Command } from "commander";
import chalk from "chalk";
import * as path from "node:path";
import * as fs from "node:fs";
import { packSkill } from "@skillify/core";

export function registerPackCommand(program: Command): void {
  program
    .command("pack <path>")
    .description("Zip a skill folder for upload to Claude.ai / Claude Code.")
    .option("--output <zipPath>", "Output zip file path")
    .action(async (skillPath: string, opts) => {
      const resolved = path.resolve(skillPath);

      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        console.error(chalk.red(`Not a directory: ${resolved}`));
        process.exit(1);
      }

      const skillMd = path.join(resolved, "SKILL.md");
      if (!fs.existsSync(skillMd)) {
        console.error(chalk.red(`SKILL.md not found in ${resolved}`));
        process.exit(1);
      }

      const folderName = path.basename(resolved);
      const outputZip =
        opts.output ?? path.join(path.dirname(resolved), `${folderName}.zip`);

      try {
        const zipPath = await packSkill(resolved, outputZip);
        console.log(chalk.green(`✓ Packed: ${zipPath}`));
        const stats = fs.statSync(zipPath);
        console.log(chalk.dim(`  Size: ${(stats.size / 1024).toFixed(1)} KB`));
      } catch (err) {
        console.error(chalk.red(`Failed to pack: ${err}`));
        process.exit(1);
      }
    });
}
