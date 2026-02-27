import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agents, companies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { runAgent } from "@/worker/runtime";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { agentId, message } = body;

  if (!agentId || !message) {
    return NextResponse.json(
      { error: "agentId and message are required" },
      { status: 400 }
    );
  }

  // Get the agent and verify ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const result = await runAgent({
    agentId: agent.id,
    companyId: agent.companyId,
    cycleId: "manual",
    systemPrompt: agent.systemPrompt,
    userMessage: message,
  });

  return NextResponse.json({
    response: result.response,
    tokensUsed: result.tokensUsed,
    logCount: result.logs.length,
  });
}
