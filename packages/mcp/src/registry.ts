/**
 * @skillify/mcp — MCP Server Registry
 *
 * Static mapping of known apps / services → MCP server packages.
 * Easily extensible by adding entries to the registry array.
 */

export interface McpServerEntry {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** npm package or GitHub repo for the MCP server. */
  package: string;
  /** Transport type. */
  transport: "stdio" | "http" | "sse";
  /** Signals that help detect this server's relevance. */
  signals: {
    /** Process names that indicate usage (lowercase). */
    processNames?: string[];
    /** Hostnames / domains the user visits. */
    hostnames?: string[];
    /** Terminal commands that indicate usage (regex patterns). */
    commandPatterns?: string[];
    /** File extensions or paths that indicate usage. */
    filePatterns?: string[];
  };
  /** Install instructions (for SKILL.md prerequisites). */
  installInstructions: string;
  /** Prerequisites (e.g. "Node.js 18+"). */
  prerequisites?: string[];
  /** Env vars needed. */
  envVars?: string[];
  /** Description for documentation. */
  description: string;
}

/**
 * Built-in registry of well-known MCP servers.
 * Curated from the official MCP ecosystem.
 */
export const MCP_REGISTRY: McpServerEntry[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    package: "@modelcontextprotocol/server-filesystem",
    transport: "stdio",
    signals: {
      commandPatterns: ["npx.*@modelcontextprotocol/server-filesystem"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-filesystem /path/to/directory",
    prerequisites: ["Node.js 18+"],
    description: "Provides read/write access to local filesystem with configurable allowed directories.",
  },
  {
    id: "github",
    name: "GitHub",
    package: "@modelcontextprotocol/server-github",
    transport: "stdio",
    signals: {
      processNames: ["github desktop", "gh"],
      hostnames: ["github.com", "api.github.com"],
      commandPatterns: [
        "gh\\s",
        "git\\s(push|pull|clone|remote|fetch|log|commit|branch|checkout|merge|rebase|tag)",
        "hub\\s",
        "github[.]com",
      ],
      filePatterns: [".github/**", "*.github.io", ".gitignore", ".gitmodules"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-github",
    prerequisites: ["Node.js 18+"],
    envVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    description: "Interact with GitHub repos, issues, PRs, and more via the GitHub API.",
  },
  {
    id: "gitlab",
    name: "GitLab",
    package: "@modelcontextprotocol/server-gitlab",
    transport: "stdio",
    signals: {
      hostnames: ["gitlab.com"],
      commandPatterns: ["glab\\s"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-gitlab",
    prerequisites: ["Node.js 18+"],
    envVars: ["GITLAB_PERSONAL_ACCESS_TOKEN", "GITLAB_API_URL"],
    description: "Interact with GitLab projects, issues, and merge requests.",
  },
  {
    id: "slack",
    name: "Slack",
    package: "@modelcontextprotocol/server-slack",
    transport: "stdio",
    signals: {
      processNames: ["slack"],
      hostnames: ["slack.com", "app.slack.com"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-slack",
    prerequisites: ["Node.js 18+"],
    envVars: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    description: "Send messages, manage channels, and interact with Slack workspaces.",
  },
  {
    id: "notion",
    name: "Notion",
    package: "notion-mcp-server",
    transport: "stdio",
    signals: {
      processNames: ["notion"],
      hostnames: ["notion.so", "www.notion.so", "api.notion.com"],
    },
    installInstructions: "npx -y notion-mcp-server",
    prerequisites: ["Node.js 18+"],
    envVars: ["NOTION_API_KEY"],
    description: "Search, read, and manage Notion pages and databases.",
  },
  {
    id: "linear",
    name: "Linear",
    package: "linear-mcp-server",
    transport: "stdio",
    signals: {
      processNames: ["linear"],
      hostnames: ["linear.app"],
    },
    installInstructions: "npx -y linear-mcp-server",
    prerequisites: ["Node.js 18+"],
    envVars: ["LINEAR_API_KEY"],
    description: "Manage Linear issues, projects, and teams.",
  },
  {
    id: "figma",
    name: "Figma",
    package: "figma-mcp-server",
    transport: "stdio",
    signals: {
      processNames: ["figma"],
      hostnames: ["figma.com", "www.figma.com"],
      filePatterns: ["*.fig"],
    },
    installInstructions: "npx -y figma-mcp-server",
    prerequisites: ["Node.js 18+"],
    envVars: ["FIGMA_ACCESS_TOKEN"],
    description: "Access Figma files, components, and design data.",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    package: "@modelcontextprotocol/server-postgres",
    transport: "stdio",
    signals: {
      processNames: ["psql", "pgadmin", "pgcli"],
      commandPatterns: ["psql\\s", "pg_dump", "pg_restore", "createdb", "dropdb", "PGPASSWORD", "DATABASE_URL.*postgres"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-postgres postgresql://localhost/mydb",
    prerequisites: ["Node.js 18+", "PostgreSQL connection string"],
    description: "Query and inspect PostgreSQL databases with read-only access.",
  },
  {
    id: "sqlite",
    name: "SQLite",
    package: "@modelcontextprotocol/server-sqlite",
    transport: "stdio",
    signals: {
      commandPatterns: ["sqlite3\\s"],
      filePatterns: ["*.sqlite", "*.db", "*.sqlite3"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-sqlite /path/to/database.db",
    prerequisites: ["Node.js 18+"],
    description: "Query and manage SQLite databases.",
  },
  {
    id: "puppeteer",
    name: "Puppeteer (Browser)",
    package: "@modelcontextprotocol/server-puppeteer",
    transport: "stdio",
    signals: {
      commandPatterns: ["puppeteer", "npx.*puppeteer"],
      filePatterns: ["puppeteer.config.*"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-puppeteer",
    prerequisites: ["Node.js 18+", "Chrome/Chromium"],
    description: "Browser automation — navigate web pages, take screenshots, interact with elements.",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    package: "@modelcontextprotocol/server-brave-search",
    transport: "stdio",
    signals: {
      hostnames: ["search.brave.com"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-brave-search",
    prerequisites: ["Node.js 18+"],
    envVars: ["BRAVE_API_KEY"],
    description: "Web and local search using the Brave Search API.",
  },
  {
    id: "sentry",
    name: "Sentry",
    package: "@sentry/mcp-server",
    transport: "stdio",
    signals: {
      hostnames: ["sentry.io"],
      commandPatterns: ["sentry-cli"],
      filePatterns: [".sentryclirc", "sentry.properties"],
    },
    installInstructions: "npx -y @sentry/mcp-server",
    prerequisites: ["Node.js 18+"],
    envVars: ["SENTRY_AUTH_TOKEN"],
    description: "Access Sentry error monitoring data for debugging and code review.",
  },
  {
    id: "docker",
    name: "Docker",
    package: "docker-mcp-server",
    transport: "stdio",
    signals: {
      processNames: ["docker", "dockerd", "docker desktop", "podman"],
      commandPatterns: ["docker\\s(build|run|push|pull|compose|exec|stop|start|ps|images|logs)", "docker-compose", "podman\\s"],
      filePatterns: ["Dockerfile*", "docker-compose*", ".dockerignore", "compose.y*ml"],
    },
    installInstructions: "npx -y docker-mcp-server",
    prerequisites: ["Node.js 18+", "Docker Engine"],
    description: "Manage Docker containers, images, and compose stacks.",
  },
  {
    id: "vercel",
    name: "Vercel",
    package: "vercel-mcp-server",
    transport: "stdio",
    signals: {
      hostnames: ["vercel.com"],
      commandPatterns: ["vercel\\s", "vc\\s"],
      filePatterns: ["vercel.json", ".vercel/**"],
    },
    installInstructions: "npx -y vercel-mcp-server",
    prerequisites: ["Node.js 18+"],
    envVars: ["VERCEL_TOKEN"],
    description: "Manage Vercel deployments, domains, and projects.",
  },
  {
    id: "supabase",
    name: "Supabase",
    package: "supabase-mcp-server",
    transport: "stdio",
    signals: {
      hostnames: ["supabase.com", "supabase.co"],
      commandPatterns: ["supabase\\s", "npx supabase"],
      filePatterns: ["supabase/**"],
    },
    installInstructions: "npx -y supabase-mcp-server",
    prerequisites: ["Node.js 18+"],
    envVars: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
    description: "Interact with Supabase databases, auth, storage.",
  },
  {
    id: "memory",
    name: "Memory (Knowledge Graph)",
    package: "@modelcontextprotocol/server-memory",
    transport: "stdio",
    signals: {
      commandPatterns: ["npx.*@modelcontextprotocol/server-memory"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-memory",
    prerequisites: ["Node.js 18+"],
    description: "Persistent memory using a local knowledge graph — lets Claude remember information across conversations.",
  },
  {
    id: "google-maps",
    name: "Google Maps",
    package: "@modelcontextprotocol/server-google-maps",
    transport: "stdio",
    signals: {
      hostnames: ["maps.google.com", "maps.googleapis.com"],
      commandPatterns: ["GOOGLE_MAPS_API_KEY"],
    },
    installInstructions: "npx -y @modelcontextprotocol/server-google-maps",
    prerequisites: ["Node.js 18+"],
    envVars: ["GOOGLE_MAPS_API_KEY"],
    description: "Geocoding, directions, place search, and elevation data via Google Maps Platform.",
  },
  {
    id: "aws-kb",
    name: "AWS Knowledge Base",
    package: "@anthropic/aws-kb-retrieval-server",
    transport: "stdio",
    signals: {
      commandPatterns: ["aws\\s", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
      hostnames: ["console.aws.amazon.com", "aws.amazon.com"],
      processNames: ["aws"],
    },
    installInstructions: "npx -y @anthropic/aws-kb-retrieval-server",
    prerequisites: ["Node.js 18+", "AWS credentials"],
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
    description: "Retrieve documents from AWS Bedrock Knowledge Bases.",
  },
];
