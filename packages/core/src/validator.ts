/**
 * @skillify/core — Skill Validator
 *
 * Validates a skill folder (on disk or in-memory SkillManifest)
 * against Claude Skill requirements.
 */

import { SkillFrontmatter } from "./schemas/skill.js";
import { parse as yamlParse } from "yaml";

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  path?: string; // field or file path
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ─── Frontmatter validation ─────────────────────────────────
export function validateFrontmatter(raw: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Extract YAML block (handle both \n and \r\n line endings)
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    issues.push({
      severity: "error",
      code: "FM_MISSING",
      message: "SKILL.md must start with YAML frontmatter delimited by ---",
    });
    return { valid: false, issues };
  }

  let parsed: unknown;
  try {
    parsed = yamlParse(match[1]);
  } catch {
    issues.push({
      severity: "error",
      code: "FM_INVALID_YAML",
      message: "Frontmatter is not valid YAML.",
    });
    return { valid: false, issues };
  }

  // Validate with zod
  const result = SkillFrontmatter.safeParse(parsed);
  if (!result.success) {
    for (const err of result.error.issues) {
      issues.push({
        severity: "error",
        code: "FM_SCHEMA",
        message: `${err.path.join(".")}: ${err.message}`,
        path: err.path.join("."),
      });
    }
    return { valid: false, issues };
  }

  const fm = result.data;

  // Warnings
  if (fm.description.length < 30) {
    issues.push({
      severity: "warning",
      code: "FM_DESC_SHORT",
      message: "Description is very short — include WHAT the skill does and WHEN to use it.",
    });
  }

  if (!/use when/i.test(fm.description) && !/trigger/i.test(fm.description)) {
    issues.push({
      severity: "warning",
      code: "FM_DESC_NO_TRIGGER",
      message: "Description should include trigger phrases (e.g. 'Use when user says ...').",
    });
  }

  return { valid: issues.every((i) => i.severity !== "error"), issues };
}

// ─── Full skill folder validation ────────────────────────────
export interface SkillFiles {
  /** Relative paths of all files inside the skill folder. */
  files: string[];
  /** Raw content of SKILL.md. */
  skillMdContent: string;
}

export function validateSkill(skill: SkillFiles): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. SKILL.md must exist
  const hasSkillMd = skill.files.some(
    (f) => f === "SKILL.md" || f.endsWith("/SKILL.md") || f.endsWith("\\SKILL.md"),
  );
  if (!hasSkillMd) {
    issues.push({
      severity: "error",
      code: "MISSING_SKILL_MD",
      message: "Skill folder must contain a file named exactly SKILL.md (case-sensitive).",
    });
    return { valid: false, issues };
  }

  // 2. No README.md inside skill folder
  if (skill.files.some((f) => /readme\.md$/i.test(f))) {
    issues.push({
      severity: "warning",
      code: "HAS_README",
      message: "Skill folder should not contain README.md — put all docs in SKILL.md or references/.",
    });
  }

  // 3. Validate frontmatter
  const fmResult = validateFrontmatter(skill.skillMdContent);
  issues.push(...fmResult.issues);

  // 4. Size guidance
  const words = skill.skillMdContent.split(/\s+/).length;
  if (words > 5000) {
    issues.push({
      severity: "warning",
      code: "SKILL_MD_LARGE",
      message: `SKILL.md is ~${words} words. Consider moving detailed docs to references/ for progressive disclosure.`,
    });
  }

  // 5. Folder naming (try to infer from files)
  const topDirMatch = skill.files[0]?.match(/^([^/\\]+)/);
  if (topDirMatch) {
    const folderName = topDirMatch[1];
    if (folderName !== folderName.toLowerCase() || /[_ ]/.test(folderName)) {
      issues.push({
        severity: "warning",
        code: "FOLDER_NAME",
        message: `Skill folder "${folderName}" should be kebab-case (lowercase, hyphens only).`,
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}
