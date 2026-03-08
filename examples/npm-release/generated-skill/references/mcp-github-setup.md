# GitHub MCP Server Setup

Interact with GitHub repos, issues, PRs, and more via the GitHub API.

## Installation

```bash
npx -y @modelcontextprotocol/server-github
```

## Prerequisites

- Node.js 18+

## Environment Variables

- `GITHUB_PERSONAL_ACCESS_TOKEN` — Set this in your environment or .env file.

## Claude Code Configuration

Add to your `.mcp.json`:

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

## Transport

This server uses **stdio** transport.

## Troubleshooting

### Connection refused
Ensure the MCP server is installed and the above environment variables are set.

### Authentication error
Verify your GitHub personal access token is valid and has the required scopes (repo, read:org).
