# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue.
2. Email the maintainer directly with a description of the vulnerability.
3. Include steps to reproduce if possible.
4. Allow reasonable time for a fix before public disclosure.

## Security Considerations

Skillify records user activity on their local machine. Security is a core design principle:

- **Local-only storage**: All recordings are stored locally by default (`~/.skillify/recordings/`)
- **Automatic redaction**: API keys, tokens, emails, passwords, private keys, and connection strings are redacted before storage
- **Paranoid mode**: The `--paranoid` flag limits recording to metadata only (no command output)
- **No network calls**: Skillify does not send data to any remote server during recording
- **YAML safety**: Skill frontmatter is parsed with safe YAML (no code execution)
- **No reserved names**: Skills cannot use names containing "claude" or "anthropic" to prevent impersonation

## Best Practices for Users

- Review generated skills before uploading to Claude.ai
- Use `--paranoid` mode when recording sensitive workflows
- Add custom redaction patterns for domain-specific secrets
- Do not commit `.skillify/recordings/` to version control
