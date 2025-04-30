#!/usr/bin/env node

import { GitToolsMcpServer } from "../index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfigFromCommanderAndEnv } from "./config";

async function main() {
  const server = new GitToolsMcpServer(getConfigFromCommanderAndEnv());
  const transport = new StdioServerTransport();
  await server.server.connect(transport);
  server.server.sendLoggingMessage(
    {
      level: "info",
      data: "MCP server started",
    },
  )
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
