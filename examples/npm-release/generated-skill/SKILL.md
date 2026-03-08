---
name: npm-release-workflow
description: >-
  Automates the npm package release process: clone, install, test, bump version,
  build, publish, push tags, and create a GitHub release. Use when user says
  "publish a release", "bump version and publish", "release npm package",
  or "create a new version".
license: MIT
metadata:
  generated-by: skillify
  version: 0.1.0
  mcp-servers:
    - github
---

# npm-release-workflow

## Prerequisites (MCP Integrations)

This skill requires the following MCP server(s) to be connected so that Claude can interact directly with external services used in this workflow.

### GitHub

Interact with GitHub repos, issues, PRs, and more via the GitHub API.

**Install & run:**
```bash
npx -y @modelcontextprotocol/server-github
```

**Required environment variables:**
- `GITHUB_PERSONAL_ACCESS_TOKEN` — set this before starting the server.

**Claude Code `.mcp.json` snippet:**
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

> Detected automatically (confidence: 80%) — Command "git push" matches pattern; Command "gh release create" matches pattern.

See [references/mcp-github-setup.md](references/mcp-github-setup.md) for full setup details.

## Parameters

| Name | Description | Default |
|------|-------------|---------|
| `{PROJECT_NAME}` | Name of the npm package | `my-project` |
| `{VERSION_BUMP}` | Version bump type (patch/minor/major) | `patch` |
| `{BRANCH}` | Target branch | `main` |

## Quick Start

Ask Claude: "Help me publish a new release of my npm package"

## Instructions

### Step 1: Clone the repository

Clone the project repository locally.

```bash
git clone https://github.com/example/{PROJECT_NAME}.git
cd {PROJECT_NAME}
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Run tests

Ensure all tests pass before proceeding.

```bash
npm run test
```

**Expected output:** All tests passing with 0 failures.

### Step 4: Bump version

```bash
npm version {VERSION_BUMP}
```

### Step 5: Build

```bash
npm run build
```

### Step 6: Publish to npm

```bash
npm publish
```

### Step 7: Push tags to GitHub

```bash
git push origin {BRANCH} --tags
```

### Step 8: Create GitHub release

```bash
gh release create v{VERSION} --generate-notes
```

## Examples

### Example 1: Patch release

**User says:** "Publish a patch release for my-project"

**Actions:**
1. Clone / pull latest from main
2. Install dependencies
3. Run tests
4. Bump version (patch)
5. Build
6. Publish to npm
7. Push tags
8. Create GitHub release with auto-generated notes

**Result:** Package published on npm, GitHub release created.

### Example 2: Major release

**User says:** "Release a major version for my-project"

**Actions:** Same as Example 1 but `npm version major` instead of `patch`.

## Troubleshooting

### Error: npm publish failed (403)

**Cause:** You may not have publish permissions or you need to log in first.
**Solution:** Run `npm login` and verify your npm account has publish access.

### Error: Tests failed

**Cause:** One or more test suites are failing.
**Solution:** Fix the failing tests before proceeding with the release.

### Error: git push rejected

**Cause:** Remote has commits not present locally.
**Solution:** Pull latest changes with `git pull --rebase origin main` and resolve conflicts.
