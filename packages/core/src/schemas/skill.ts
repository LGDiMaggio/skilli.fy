/**
 * @skillify/core — Skill Schema
 *
 * Defines the expected structure of a generated Claude Skill,
 * including YAML frontmatter fields and folder layout.
 */

import { z } from "zod";

// ── Skill frontmatter ────────────────────────────────────────
export const SkillFrontmatter = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Must be kebab-case, lowercase alphanumeric with hyphens")
    .max(100)
    .refine((n) => !n.includes("claude") && !n.includes("anthropic"), {
      message: "Skill name must not contain 'claude' or 'anthropic' (reserved)",
    }),
  description: z
    .string()
    .max(1024)
    .refine((d) => !d.includes("<") && !d.includes(">"), {
      message: "Description must not contain XML angle brackets (< >)",
    }),
  license: z.string().optional(),
  compatibility: z.string().max(500).optional(),
  "allowed-tools": z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;

// ── Skill on disk ────────────────────────────────────────────
export const SkillManifest = z.object({
  folderPath: z.string(),
  frontmatter: SkillFrontmatter,
  bodyMarkdown: z.string(),
  scripts: z.array(z.string()).default([]),
  references: z.array(z.string()).default([]),
  assets: z.array(z.string()).default([]),
});
export type SkillManifest = z.infer<typeof SkillManifest>;
