import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "./mcp-server";
import * as z from "zod";
import { createTool, createToolDefinition } from "./utils/tools";
import {
  DynamicToolDiscoveryOptions,
  ToolCapability,
  ToolsetConfig,
} from "./types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Tool: Get all parent git repos from a given path
const getGitReposTool = createToolDefinition({
  name: "get_git_repos_from_path",
  description:
    "Discovers all parent git repositories by searching up the directory tree from the provided path. This tool checks each parent directory for a .git folder and returns all valid git repository paths found. Always use this tool first to obtain a valid repository path before using any other git tool in this suite. Usage: provide an absolute or relative path (such as your project directory or a file path), and the tool will return a list of all parent directories that are git repositories.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "Absolute or relative path to start searching for git repositories"
      ),
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
  description:
    "Returns the name of the currently checked-out branch for a given git repository path. Internally, this tool runs 'git rev-parse --abbrev-ref HEAD' in the specified repository. Before using this tool, always call get_git_repos_from_path to obtain a valid repository path. Usage: provide the path to a git repository (as returned by get_git_repos_from_path) to get the current branch name.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
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
  description:
    "Retrieves the current status of the git repository at the specified path, including branch info and working directory changes. This tool runs 'git status --porcelain=v1 --branch' to provide a machine-readable summary. Always use get_git_repos_from_path first to get a valid repository path. Usage: provide the path to a git repository (from get_git_repos_from_path) to get its status.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
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
  description:
    "Fetches the commit log for the specified git repository path. This tool runs 'git log --pretty=oneline' (optionally limited by maxCount) to return a concise list of commits. Always use get_git_repos_from_path first to get a valid repository path. Usage: provide the repository path (from get_git_repos_from_path) and optionally maxCount to limit the number of log entries returned.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
    maxCount: z
      .number()
      .optional()
      .describe("Maximum number of log entries to return"),
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
  description:
    "Lists all remotes configured for the git repository at the given path. This tool runs 'git remote -v' to show remote names and URLs. Always use get_git_repos_from_path first to get a valid repository path. Usage: provide the repository path (from get_git_repos_from_path) to list its remotes.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
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
  description:
    "Retrieves the git configuration settings for the repository at the specified path. This tool runs 'git config --list' to return all config variables. Always use get_git_repos_from_path first to get a valid repository path. Usage: provide the repository path (from get_git_repos_from_path) to get its configuration.",
  inputSchema: z.object({
    path: z.string().describe("Path to the git repository"),
  }),
  annotations: {
    title: "Get Git Config",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

const gitTools = [
  createTool(getGitReposTool, async ({ path }) => {
    // Find all parent directories with a .git folder
    const found: string[] = [];
    let current = require("path").resolve(path);
    const { sep, dirname, join } = require("path");
    while (true) {
      const gitDir = join(current, ".git");
      try {
        await execAsync(`[ -d "${gitDir}" ] && echo found || echo notfound`);
        const { stdout } = await execAsync(
          `[ -d "${gitDir}" ] && echo found || echo notfound`
        );
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
    const { stdout } = await execAsync(
      `git -C "${path}" rev-parse --abbrev-ref HEAD`
    );
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
    const { stdout } = await execAsync(
      `git -C "${path}" status --porcelain=v1 --branch`
    );
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
    const { stdout } = await execAsync(
      `git -C "${path}" log ${countArg} --pretty=oneline`
    );
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
] satisfies ToolCapability[];

export { gitTools };
export interface GitToolsMcpServerConfig {
  toolsetConfig?: ToolsetConfig;
  dynamicToolDiscovery?: DynamicToolDiscoveryOptions;
  availableTools?: string[];
}

export class GitToolsMcpServer extends McpServer {
  constructor(config: GitToolsMcpServerConfig = {}) {
    super({
      name: "git-tools-server",
      version: "1.0.0",
      toolsetConfig: config.toolsetConfig || { mode: "readOnly" },
      capabilities: {
        tools: config.availableTools?.length
          ? config.availableTools?.length > 0
            ? gitTools.filter((tool) =>
                config.availableTools?.includes(tool.definition.name)
              )
            : gitTools
          : gitTools,
      },
      dynamicToolDiscovery: config.dynamicToolDiscovery || { enabled: true },
      instructions:
        "Git Tools MCP server. This server provides tools for interacting with git repositories. before all requests you have to use the tool get_git_repos_from_path to get the git repositories from a given path. Then you can use the other tools with the path of the git repository.",
    });
  }
}
