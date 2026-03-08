# Skillify

**Convert real workflows into Claude Skills — in minutes, not hours.**

> Record what you do. Extract the steps. Generate a ready-to-use Skill folder.

<p align="center">
  <img src="docs/demo.gif" alt="Skillify demo" width="700" />
</p>

---

> **New?** Start with the [Quickstart Guide](docs/QUICKSTART.md) — get your first skill in 5 minutes.

## What is Skillify?

Skillify is an open-source toolkit that:

1. **Records** a real workflow executed on your computer (terminal commands, file changes, app usage).
2. **Extracts** a clean, parametrized sequence of steps (workflow graph).
3. **Generates** a Claude Skill folder (`SKILL.md` + `scripts/` + `references/` + `assets/`) conforming to the open standard.
4. **Detects** MCP servers relevant to your workflow and generates `.mcp.json` config + setup docs.
5. **Validates** and **packs** the skill into a zip ready for Claude.ai / Claude Code / GitHub.

## Quick Start

```bash
# Install globally
npm install -g skillify

# 1. Record your workflow
skillify record start
# ... do your work (run commands, edit files, use apps) ...
skillify record stop

# 2. List recordings
skillify record list

# 3. Generate a skill from a recording
skillify generate <session-id> --name my-workflow

# 4. Validate the generated skill
skillify validate ./my-workflow

# 5. Pack for upload
skillify pack ./my-workflow
# → my-workflow.zip ready for Claude.ai
```

## Features

| Feature | Status |
|---------|--------|
| Terminal command recording | ✅ MVP |
| File system change detection | ✅ MVP |
| Process start/stop tracking | ✅ MVP |
| Active window focus tracking | ✅ MVP |
| Workflow mining (heuristic) | ✅ MVP |
| Parameter auto-detection | ✅ MVP |
| Skill generation (SKILL.md) | ✅ MVP |
| Skill validation & linting | ✅ MVP |
| Zip packaging | ✅ MVP |
| MCP server detection | ✅ MVP |
| `.mcp.json` generation | ✅ MVP |
| MCP setup reference docs | ✅ MVP |
| Secret/PII redaction | ✅ MVP |
| Paranoid mode (metadata only) | ✅ MVP |
| Browser URL recording | 🔜 v0.2 |
| UI wizard (TUI/web) | 🔜 v0.2 |
| Plugin API | 🔜 v0.2 |
| Skillify as MCP server | 🔜 v1.0 |
| LLM-assisted step extraction | 🔜 v1.0 |

## Architecture

```
packages/
  core/          Event schemas, workflow graph, skill generator, validator, packer
  recorder/      Pluggable providers: terminal, fs, process, window
  mcp/           MCP server registry, detector, .mcp.json generator
  cli/           User-facing CLI commands
```

All packages are TypeScript, validated with [Zod](https://zod.dev), and designed for extensibility.

## MCP Detection

When you record a workflow, Skillify automatically scans for signals (process names, hostnames, terminal commands, file patterns) that match known MCP servers:

- **GitHub** — `git push`, `github.com`, `gh` CLI
- **Notion** — `notion.so`, Notion app
- **Linear** — `linear.app`, Linear app
- **Slack** — `slack.com`, Slack app
- **Docker** — `docker` commands, `Dockerfile`
- **PostgreSQL** — `psql`, `pg_dump`
- **Sentry** — `sentry.io`, `sentry-cli`
- ...and [15+ more](packages/mcp/src/registry.ts)

Detected servers are:
- Listed with confidence scores and reasoning
- Added to `SKILL.md` prerequisites
- Configured in a generated `.mcp.json`
- Documented in `references/` setup guides

## Privacy & Security

- **Local-only** by default — recordings stay on your machine (`~/.skillify/recordings/`)
- **Aggressive redaction** — API keys, tokens, emails, IPs, private keys, connection strings removed automatically
- **Paranoid mode** — `--paranoid` flag captures only metadata (no command output)
- **Configurable** — add custom patterns, allowlist, sensitive path prefixes

## Example Output

Running `skillify generate` produces:

```
my-workflow/
├── SKILL.md              # Full skill with frontmatter, instructions, examples, troubleshooting
├── .mcp.json             # Claude Code MCP configuration (if MCP detected)
├── references/
│   └── mcp-github-setup.md  # MCP server setup guide
└── scripts/              # (if applicable)
```

See [examples/](examples/) for complete sample recordings and generated skills.

## Development

```bash
# Clone
git clone https://github.com/LGDiMaggio/skilli.fy.git
cd skilli.fy

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Type-check
npm run typecheck
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[Apache-2.0](LICENSE)

## Acknowledgements

> **Note:** This initial version (v0.1.0) was developed as a prototype with the assistance of [Claude](https://claude.ai) by Anthropic. The architecture, code, tests, and documentation were produced collaboratively between the author and Claude as a proof-of-concept for workflow-to-skill automation. Future versions will evolve with community contributions and feedback.

---

Built with ♥ for the Claude Skills ecosystem.
