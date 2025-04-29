import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "./mcp-server";
import * as z from "zod";
import { createTool, createToolDefinition } from "./utils/tools";
import { ToolCapability } from "types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Tool: Get all parent git repos from a given path
const getGitReposTool = createToolDefinition({
  name: "get_git_repos_from_path",
  description: "Get all parent git repositories from a given path (searches up the directory tree)",
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative path to start searching for git repositories")
  }),
  annotations: {
    title: "Get Git Repos From Path",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

// Tool: Get current branch name
const getCurrentBranchTool = createToolDefinition({
  name: "get_current_branch",
  description: "Get the current git branch for a given repository path",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository")
  }),
  annotations: {
    title: "Get Current Branch",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

// Tool: Get git status
const getStatusTool = createToolDefinition({
  name: "get_git_status",
  description: "Get the git status for a given repository path",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository")
  }),
  annotations: {
    title: "Get Git Status",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

// Tool: Get git log
const getLogTool = createToolDefinition({
  name: "get_git_log",
  description: "Get the git log for a given repository path",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
    maxCount: z.number().optional().describe("Maximum number of log entries to return")
  }),
  annotations: {
    title: "Get Git Log",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

// Tool: Get git remotes
const getRemotesTool = createToolDefinition({
  name: "get_git_remotes",
  description: "Get the git remotes for a given repository path",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository")
  }),
  annotations: {
    title: "Get Git Remotes",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

// Tool: Get git config
const getConfigTool = createToolDefinition({
  name: "get_git_config",
  description: "Get the git config for a given repository path",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository")
  }),
  annotations: {
    title: "Get Git Config",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

const gitTools: ToolCapability[] = [
  createTool(getGitReposTool, async ({ path }) => {
    // Find all parent directories with a .git folder
    const found: string[] = [];
    let current = require("path").resolve(path);
    const { sep, dirname, join } = require("path");
    while (true) {
      const gitDir = join(current, ".git");
      try {
        await execAsync(`[ -d "${gitDir}" ] && echo found || echo notfound`);
        const { stdout } = await execAsync(`[ -d "${gitDir}" ] && echo found || echo notfound`);
        if (stdout.trim() === "found") found.push(current);
      } catch {}
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(found),
        },
      ],
    };
  }),
  createTool(getCurrentBranchTool, async ({ path }) => {
    const { stdout } = await execAsync(`git -C "${path}" rev-parse --abbrev-ref HEAD`);
    return {
      content: [
        {
          type: "text",
          text: stdout.trim(),
        },
      ],
    };
  }),
  createTool(getStatusTool, async ({ path }) => {
    const { stdout } = await execAsync(`git -C "${path}" status --porcelain=v1 --branch`);
    return {
      content: [
        {
          type: "text",
          text: stdout,
        },
      ],
    };
  }),
  createTool(getLogTool, async ({ path, maxCount }) => {
    const countArg = maxCount ? `-n ${maxCount}` : "";
    const { stdout } = await execAsync(`git -C "${path}" log ${countArg} --pretty=oneline`);
    return {
      content: [
        {
          type: "text",
          text: stdout,
        },
      ],
    };
  }),
  createTool(getRemotesTool, async ({ path }) => {
    const { stdout } = await execAsync(`git -C "${path}" remote -v`);
    return {
      content: [
        {
          type: "text",
          text: stdout,
        },
      ],
    };
  }),
  createTool(getConfigTool, async ({ path }) => {
    const { stdout } = await execAsync(`git -C "${path}" config --list`);
    return {
      content: [
        {
          type: "text",
          text: stdout,
        },
      ],
    };
  }),
];

export { gitTools };
class GitToolsMcpServer extends McpServer {
  constructor() {
    super({
      name: "git-tools-server",
      version: "1.0.0",
      toolsetConfig: { mode: "readOnly" },
      capabilities: {
        tools: gitTools
      },
      dynamicToolDiscovery: {
        enabled: true,
      }
    });
  }
}

async function main() {
  const server = new GitToolsMcpServer();
  const transport = new StdioServerTransport();
  await server.server.connect(transport);
  console.error("Git Tools MCP server running on stdio");
}

main().catch((error) => console.error(error));
