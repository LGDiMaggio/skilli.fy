/**
 * @skillify/core — Redaction Engine
 *
 * Strips secrets, PII, and sensitive paths from recorded events.
 * Runs by default with "partial" redaction; "full" removes almost all payload content.
 */

export interface RedactionConfig {
  /** Extra regex patterns to redact (user-supplied). */
  extraPatterns?: RegExp[];
  /** Allowlisted strings that should never be redacted. */
  allowList?: string[];
  /** Sensitive path prefixes to mask (e.g. /Users/john). */
  sensitivePathPrefixes?: string[];
}

// Built-in patterns matching common secrets / PII
const BUILTIN_PATTERNS: RegExp[] = [
  // API keys / tokens (generic)
  /(?:api[_-]?key|token|secret|password|passwd|bearer)\s*[:=]\s*["']?[A-Za-z0-9\-_.~+/]{8,}["']?/gi,
  // AWS keys
  /AKIA[0-9A-Z]{16}/g,
  // GitHub tokens
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  // npm tokens
  /npm_[A-Za-z0-9]{36,}/g,
  // Generic JWT
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // IPv4 addresses (not loopback)
  /(?<!\.)\b(?!127\.0\.0\.1)(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Private key blocks
  /-----BEGIN\s[\w\s]+PRIVATE KEY-----[\s\S]*?-----END\s[\w\s]+PRIVATE KEY-----/g,
  // Connection strings
  /(?:mysql|postgres|mongodb|redis):\/\/[^\s'"]+/gi,
];

const REDACTED = "[REDACTED]";

export function redactString(
  input: string,
  config: RedactionConfig = {},
): string {
  let text = input;

  const patterns = [...BUILTIN_PATTERNS, ...(config.extraPatterns ?? [])];

  for (const pattern of patterns) {
    // Reset regex state (global flag)
    pattern.lastIndex = 0;
    text = text.replace(pattern, (match) => {
      if (config.allowList?.includes(match)) return match;
      return REDACTED;
    });
  }

  // Mask sensitive path prefixes
  for (const prefix of config.sensitivePathPrefixes ?? []) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "g"), "[SENSITIVE_PATH]");
  }

  return text;
}

/**
 * Deep-redact any string values inside a plain object / array.
 */
export function redactObject<T>(obj: T, config: RedactionConfig = {}): T {
  if (typeof obj === "string") {
    return redactString(obj, config) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, config)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactObject(value, config);
    }
    return result as T;
  }
  return obj;
}
