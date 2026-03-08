# Skillify — Quickstart Guide

Get your first Claude Skill generated in 5 minutes.

## Prerequisites

- **Node.js 18+** — [download](https://nodejs.org/)
- **npm 9+** — included with Node.js

## 1. Install

```bash
git clone https://github.com/LGDiMaggio/skilli.fy.git
cd skilli.fy
npm install
npm run build
```

## 2. Record a Workflow

Start recording. Skillify will watch your file system, terminal commands, running processes, and active windows.

```bash
# Default providers: terminal, filesystem, process
npx skillify record start

# Or pick specific providers:
npx skillify record start --providers terminal,fs,process,window

# Limit filesystem monitoring to a specific folder:
npx skillify record start --providers terminal,fs --cwd ~/my-project
```

**Now do your workflow:** run commands, create files, edit configs — whatever you normally do.

When you're done:

```bash
npx skillify record stop
```

You'll see something like:

```
✓ Recording stopped — session abc12345-...
Generate a skill with: skillify generate abc12345-...
```

## 3. Generate a Claude Skill

```bash
npx skillify generate <session-id> --name my-workflow --output ./skills
```

Skillify will:

1. **Mine the workflow** — group your recorded events into logical steps
2. **Detect MCP servers** — if you used tools like `git`, Docker, PostgreSQL, Notion, etc., Skillify detects the corresponding MCP server and adds it as a prerequisite in the generated skill
3. **Generate SKILL.md** — complete Claude Skill with frontmatter, instructions, parameters, examples, troubleshooting
4. **Write reference docs** — per-server MCP setup guides in `references/`
5. **Validate** — checks conformance to the Claude Skills standard

### How MCP Detection Works

During your recording, Skillify captures signals from every event:

| Signal type       | Example                                      | Detects            |
|-------------------|----------------------------------------------|--------------------|
| Terminal commands  | `git push`, `docker build`, `psql`          | GitHub, Docker, PostgreSQL |
| File patterns      | `Dockerfile`, `.github/workflows/ci.yml`    | Docker, GitHub     |
| Process names      | `slack`, `notion`, `pgadmin`                | Slack, Notion, PostgreSQL |
| Window titles/URLs | `github.com`, `linear.app`                  | GitHub, Linear     |

If a detected tool has a known MCP server (from our registry of 18+ servers), Skillify:
- Adds the MCP server to the skill's `metadata.mcp-servers` list
- Generates a **Prerequisites (MCP Integrations)** section with install instructions, env vars, and a `.mcp.json` snippet
- Writes a detailed reference doc in `references/mcp-<server>-setup.md`

This way, when Claude loads the skill, it knows exactly which MCP servers to connect.

## 4. Validate

```bash
npx skillify validate ./skills/my-workflow
```

Fix any errors, warnings are optional improvements.

## 5. Pack & Upload

```bash
npx skillify pack ./skills/my-workflow
```

This creates `my-workflow.zip`, ready to upload to **Claude.ai** (Project Knowledge) or use with **Claude Code**.

## Example: Full Flow

```bash
# 1. Start recording
npx skillify record start --providers terminal,fs --cwd ~/my-api

# 2. Do your workflow
cd ~/my-api
git pull origin main
npm install
npm test
docker build -t my-api .
docker push my-api:latest
gh release create v1.2.0 --generate-notes

# 3. Stop recording
npx skillify record stop
# ✓ Recording stopped — session a1b2c3d4-...

# 4. Generate skill
npx skillify generate a1b2c3d4 --name deploy-api --output ./skills
# ✓ Extracted 4 steps, 3 parameters
# ✓ Detected 2 MCP server(s):
#   GitHub — confidence 80%
#   Docker — confidence 65%
# ✓ Skill is valid!

# 5. Validate & pack
npx skillify validate ./skills/deploy-api
npx skillify pack ./skills/deploy-api
# ✓ Packed: ./skills/deploy-api.zip (2.4 KB)
```

The generated `skills/deploy-api/SKILL.md` will include:
- Step-by-step instructions for the deploy workflow
- A **Prerequisites (MCP Integrations)** section with GitHub and Docker MCP setup
- A `.mcp.json` configuration snippet for Claude Code
- Reference docs in `references/mcp-github-setup.md` and `references/mcp-docker-setup.md`

## Available Providers

| Provider    | What it records                          | Flag      |
|-------------|------------------------------------------|-----------|
| `terminal`  | Shell commands, exit codes, output       | `terminal` |
| `fs`        | File create / modify / delete events     | `fs`      |
| `process`   | Running process starts and stops         | `process` |
| `window`    | Active window title and app switches     | `window`  |

## Tips

- Use `--paranoid` flag to strip command output from recordings (keeps only metadata)
- Add `--triggers "deploy the API,push to production"` to include trigger phrases in the skill
- Use `--license Apache-2.0` to set the license in the generated skill
- MCP detection is automatic — no configuration needed

## Next Steps

- Read the [README](../README.md) for architecture details
- See [examples/](../examples/) for complete generated skills
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) to add new MCP servers to the registry
