---
name: notion-metrics-report
description: >-
  Generates a metrics report from project data, formats it, uploads to Notion,
  and notifies the team on Slack. Use when user says "generate report",
  "publish metrics to Notion", "create Q4 report", or "weekly report workflow".
license: MIT
metadata:
  generated-by: skillify
  version: 0.1.0
  mcp-servers:
    - notion
    - slack
---

# notion-metrics-report

## Prerequisites (MCP Integrations)

This skill requires the following MCP server(s) to be connected so that Claude can interact directly with external services used in this workflow.

### Notion

Search, read, and manage Notion pages and databases.

**Install & run:**
```bash
npx -y notion-mcp-server
```

**Required environment variables:**
- `NOTION_API_KEY` — set this before starting the server.

**Claude Code `.mcp.json` snippet:**
```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "notion-mcp-server"],
      "env": {
        "NOTION_API_KEY": "${NOTION_API_KEY}"
      }
    }
  }
}
```

> Detected automatically (confidence: 70%) — Hostname "notion.so" detected in browser event.

See [references/mcp-notion-setup.md](references/mcp-notion-setup.md) for full setup details.

### Slack

Send messages, manage channels, and interact with Slack workspaces.

**Install & run:**
```bash
npx -y @modelcontextprotocol/server-slack
```

**Required environment variables:**
- `SLACK_BOT_TOKEN` — set this before starting the server.
- `SLACK_TEAM_ID` — set this before starting the server.

**Claude Code `.mcp.json` snippet:**
```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
      }
    }
  }
}
```

> Detected automatically (confidence: 35%) — Hostname "slack.com" detected in window event.

See [references/mcp-slack-setup.md](references/mcp-slack-setup.md) for full setup details.

## Parameters

| Name | Description | Default |
|------|-------------|---------|
| `{PROJECT_NAME}` | Project identifier | `Q4-planning` |
| `{INPUT_FILE}` | Path to metrics CSV data | `data/metrics.csv` |
| `{NOTION_PAGE}` | Target Notion page | - |
| `{SLACK_CHANNEL}` | Slack notification channel | `#reports` |

## Quick Start

Ask Claude: "Help me generate and publish the Q4 metrics report"

## Instructions

### Step 1: Fetch metrics data

Run the data collection script to gather metrics.

```bash
python scripts/fetch_metrics.py --project {PROJECT_NAME}
```

**Expected output:** CSV file created in `data/` directory.

### Step 2: Generate the report

```bash
python scripts/generate_report.py --input {INPUT_FILE} --output report.md
```

### Step 3: Upload to Notion

```bash
python scripts/upload_to_notion.py --page {NOTION_PAGE} --file report.md
```

### Step 4: Notify the team

```bash
python scripts/notify_slack.py --channel {SLACK_CHANNEL} --message '{PROJECT_NAME} report published'
```

## Examples

### Example 1: Weekly metrics report

**User says:** "Generate the weekly metrics report for Q4 planning"

**Actions:**
1. Fetch metrics for Q4-planning project
2. Generate formatted report
3. Upload to the Q4 Planning Notion page
4. Notify #reports Slack channel

**Result:** Report published on Notion with team notification.

### Example 2: Custom project report

**User says:** "Create a report for the onboarding project and post to #onboarding"

**Actions:** Same workflow with `{PROJECT_NAME}=onboarding` and `{SLACK_CHANNEL}=#onboarding`.

## Troubleshooting

### Error: fetch_metrics.py failed

**Cause:** Data source may be unavailable or project name is incorrect.
**Solution:** Verify the project name and data source connectivity.

### Error: upload_to_notion.py - Authentication failed

**Cause:** Notion API key is missing or expired.
**Solution:** Set `NOTION_API_KEY` environment variable with a valid integration token.

### Error: Slack notification failed

**Cause:** Bot token is invalid or channel doesn't exist.
**Solution:** Verify `SLACK_BOT_TOKEN` and channel name.
