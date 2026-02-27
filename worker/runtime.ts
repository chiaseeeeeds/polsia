import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { agentLogs, agents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { broadcastLog } from "@/lib/sse";
import type { AgentLogEntry, AgentLogType } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

interface AgentRunParams {
  agentId: string;
  companyId: string;
  cycleId: string;
  systemPrompt: string;
  userMessage: string;
  tools?: Anthropic.Tool[];
  model?: string;
}

interface AgentRunResult {
  response: string;
  tokensUsed: number;
  logs: AgentLogEntry[];
}

async function logEvent(
  agentId: string,
  companyId: string,
  cycleId: string,
  type: AgentLogType,
  content: string,
  metadata?: Record<string, unknown>
): Promise<AgentLogEntry> {
  const [log] = await db
    .insert(agentLogs)
    .values({ agentId, companyId, cycleId, type, content, metadata })
    .returning();

  const entry: AgentLogEntry = {
    id: log.id,
    agentId,
    companyId,
    cycleId,
    type,
    content,
    metadata: metadata as Record<string, unknown>,
    createdAt: log.createdAt,
  };

  // Broadcast to SSE listeners
  broadcastLog(entry);
  return entry;
}

export async function runAgent(params: AgentRunParams): Promise<AgentRunResult> {
  const { agentId, companyId, cycleId, systemPrompt, userMessage, tools, model } = params;
  const logs: AgentLogEntry[] = [];
  let totalTokens = 0;

  // Log the start
  const startLog = await logEvent(agentId, companyId, cycleId, "thought", "Starting agent execution...");
  logs.push(startLog);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Agentic loop - keep running until the model stops using tools
  let continueLoop = true;
  let finalResponse = "";

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
    });

    totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    // Process response content blocks
    const assistantContent: Anthropic.ContentBlock[] = response.content;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === "text") {
        finalResponse = block.text;
        const thoughtLog = await logEvent(
          agentId, companyId, cycleId, "thought", block.text
        );
        logs.push(thoughtLog);
      } else if (block.type === "tool_use") {
        // Log the tool call
        const toolCallLog = await logEvent(
          agentId, companyId, cycleId, "tool_call",
          `Calling tool: ${block.name}`,
          { toolName: block.name, input: block.input }
        );
        logs.push(toolCallLog);

        // Execute tool via MCP or built-in handler
        let toolResult: string;
        try {
          toolResult = await executeToolCall(block.name, block.input as Record<string, unknown>);
        } catch (err) {
          toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
          const errorLog = await logEvent(
            agentId, companyId, cycleId, "error",
            `Tool ${block.name} failed: ${toolResult}`
          );
          logs.push(errorLog);
        }

        // Log tool result
        const resultLog = await logEvent(
          agentId, companyId, cycleId, "tool_result",
          `Result from ${block.name}: ${toolResult.slice(0, 500)}`,
          { toolName: block.name, result: toolResult }
        );
        logs.push(resultLog);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: toolResult,
        });
      }
    }

    // If there were tool uses, add assistant message and tool results, then continue
    if (toolResults.length > 0) {
      messages.push({ role: "assistant", content: assistantContent });
      messages.push({ role: "user", content: toolResults });
    } else {
      continueLoop = false;
    }

    // Safety limit
    if (messages.length > 40) {
      const limitLog = await logEvent(
        agentId, companyId, cycleId, "error",
        "Reached message limit, stopping agent loop"
      );
      logs.push(limitLog);
      continueLoop = false;
    }
  }

  // Update agent stats
  await db
    .update(agents)
    .set({
      totalCycles: sql`${agents.totalCycles} + 1`,
      totalTokens: sql`${agents.totalTokens} + ${totalTokens}`,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  // Log completion
  const completeLog = await logEvent(
    agentId, companyId, cycleId, "summary",
    finalResponse || "Agent completed execution"
  );
  logs.push(completeLog);

  return { response: finalResponse, tokensUsed: totalTokens, logs };
}

// Tool execution - will be enhanced with MCP in Phase 3
async function executeToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  // Built-in tools that don't need MCP
  switch (name) {
    case "think":
      return String(input.thought ?? "");
    case "record_metric":
      return `Metric recorded: ${input.name} = ${input.value}`;
    default:
      return `Tool ${name} is not yet connected. Input: ${JSON.stringify(input).slice(0, 200)}`;
  }
}
