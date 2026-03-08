/**
 * @skillify/core — Packer
 *
 * Writes a SkillManifest to disk and optionally creates a zip archive.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import archiver from "archiver";
import type { SkillManifest } from "./schemas/skill.js";

/**
 * Write the skill folder to disk.
 */
export async function writeSkillToDisk(
  manifest: SkillManifest,
  outputDir: string,
): Promise<string> {
  const skillDir = path.join(outputDir, manifest.folderPath);
  fs.mkdirSync(skillDir, { recursive: true });

  // Write SKILL.md
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), manifest.bodyMarkdown, "utf-8");

  // Create sub-directories if needed
  if (manifest.scripts.length > 0) {
    const scriptsDir = path.join(skillDir, "scripts");
    fs.mkdirSync(scriptsDir, { recursive: true });
    for (const s of manifest.scripts) {
      const filePath = path.join(scriptsDir, s);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `#!/usr/bin/env bash\n# TODO: implement ${s}\n`, "utf-8");
      }
    }
  }

  if (manifest.references.length > 0) {
    const refsDir = path.join(skillDir, "references");
    fs.mkdirSync(refsDir, { recursive: true });
    for (const r of manifest.references) {
      const filePath = path.join(refsDir, r);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `# ${r}\n\nTODO: Add documentation.\n`, "utf-8");
      }
    }
  }

  if (manifest.assets.length > 0) {
    fs.mkdirSync(path.join(skillDir, "assets"), { recursive: true });
  }

  return skillDir;
}

/**
 * Create a zip archive from an existing skill folder.
 */
export async function packSkill(
  skillDir: string,
  outputZipPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outputZipPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(skillDir, path.basename(skillDir));
    archive.finalize();
  });
}
