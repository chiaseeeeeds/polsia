import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  tools: Anthropic.Tool[];
}

const activeConnections = new Map<string, MCPConnection>();

export async function connectMCPServer(
  name: string,
  config: MCPServerConfig
): Promise<MCPConnection> {
  // Return existing connection if available
  const existing = activeConnections.get(name);
  if (existing) return existing;

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
    env: { ...process.env, ...config.env } as Record<string, string>,
  });

  const client = new Client({
    name: `polsia-${name}`,
    version: "1.0.0",
  });

  await client.connect(transport);

  // List available tools
  const toolsResponse = await client.listTools();
  const tools: Anthropic.Tool[] = toolsResponse.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const connection: MCPConnection = { client, transport, tools };
  activeConnections.set(name, connection);

  return connection;
}

export async function callMCPTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const connection = activeConnections.get(serverName);
  if (!connection) {
    throw new Error(`MCP server ${serverName} is not connected`);
  }

  const result = await connection.client.callTool({
    name: toolName,
    arguments: args,
  });

  // Extract text content from result
  if (Array.isArray(result.content)) {
    return result.content
      .map((c) => {
        if (typeof c === "object" && c !== null && "text" in c) {
          return (c as { text: string }).text;
        }
        return JSON.stringify(c);
      })
      .join("\n");
  }

  return JSON.stringify(result.content);
}

export async function disconnectMCPServer(name: string) {
  const connection = activeConnections.get(name);
  if (connection) {
    await connection.client.close();
    activeConnections.delete(name);
  }
}

export async function disconnectAll() {
  for (const [name] of activeConnections) {
    await disconnectMCPServer(name);
  }
}

export function getConnectedServers(): string[] {
  return Array.from(activeConnections.keys());
}
