import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { connectMCPServer, callMCPTool } from "@/lib/mcp-client";
import { sql } from "drizzle-orm";

// Built-in tools that are always available
const BUILTIN_TOOLS: Anthropic.Tool[] = [
  {
    name: "think",
    description:
      "Use this tool to think through your reasoning step by step before taking action.",
    input_schema: {
      type: "object" as const,
      properties: {
        thought: { type: "string", description: "Your internal reasoning" },
      },
      required: ["thought"],
    },
  },
];

// Maps tool names to their MCP server for routing
const toolServerMap = new Map<string, string>();

export async function buildToolsForAgent(
  mcpServerNames: string[]
): Promise<{
  tools: Anthropic.Tool[];
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>;
}> {
  const tools: Anthropic.Tool[] = [...BUILTIN_TOOLS];

  // Connect to each MCP server and collect tools
  for (const serverName of mcpServerNames) {
    try {
      // Get server config from database
      const [serverConfig] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.name, serverName))
        .limit(1);

      if (!serverConfig) {
        console.warn(`[ToolBuilder] MCP server ${serverName} not found in database`);
        continue;
      }

      const connection = await connectMCPServer(serverName, {
        command: serverConfig.command,
        args: serverConfig.args as string[],
        env: serverConfig.env as Record<string, string>,
      });

      for (const tool of connection.tools) {
        tools.push(tool);
        toolServerMap.set(tool.name, serverName);
      }
    } catch (err) {
      console.error(`[ToolBuilder] Failed to connect to ${serverName}:`, err);
    }
  }

  const executeTool = async (
    name: string,
    input: Record<string, unknown>
  ): Promise<string> => {
    // Handle built-in tools
    if (name === "think") {
      return String(input.thought ?? "");
    }

    // Route to MCP server
    const serverName = toolServerMap.get(name);
    if (!serverName) {
      return `Tool ${name} is not available`;
    }

    return callMCPTool(serverName, name, input);
  };

  return { tools, executeTool };
}
