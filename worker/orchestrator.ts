import { db } from "@/db";
import { agentCycles, agents, companies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { runAgent } from "./runtime";
import { broadcast } from "@/lib/sse";
import { readFileSync } from "fs";
import { join } from "path";
import type { AgentRole, CyclePlan } from "@/types";

function loadPrompt(role: AgentRole): string {
  try {
    return readFileSync(join(process.cwd(), "prompts", `${role}.md`), "utf-8");
  } catch {
    return `You are the ${role} agent.`;
  }
}

export async function runCycle(companyId: string): Promise<string> {
  // Get company details
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) throw new Error(`Company ${companyId} not found`);
  if (company.status !== "active") throw new Error(`Company ${companyId} is not active`);

  // Get company agents
  const companyAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.companyId, companyId));

  if (companyAgents.length === 0) throw new Error(`No agents for company ${companyId}`);

  // Create cycle record
  const [cycle] = await db
    .insert(agentCycles)
    .values({
      companyId,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  broadcast(companyId, {
    type: "cycle_start",
    data: { cycleId: cycle.id, status: "running" },
  });

  try {
    // Step 1: CEO creates the plan
    const ceoAgent = companyAgents.find((a) => a.role === "ceo");
    if (!ceoAgent) throw new Error("No CEO agent found");

    const ceoPrompt = ceoAgent.systemPrompt || loadPrompt("ceo");
    const ceoResult = await runAgent({
      agentId: ceoAgent.id,
      companyId,
      cycleId: cycle.id,
      systemPrompt: ceoPrompt,
      userMessage: `You are running the daily cycle for "${company.name}". ${company.description ? `Company description: ${company.description}` : ""}\n\nCreate today's operational plan. Output a JSON object with "goals" (array of strings) and "assignments" (object mapping roles "engineer", "growth", "ops" to arrays of task strings).`,
      tools: [
        {
          name: "think",
          description: "Use this tool to think through your reasoning before creating the plan.",
          input_schema: {
            type: "object" as const,
            properties: { thought: { type: "string", description: "Your internal reasoning" } },
            required: ["thought"],
          },
        },
      ],
    });

    // Parse the CEO's plan
    let plan: CyclePlan;
    try {
      const jsonMatch = ceoResult.response.match(/\{[\s\S]*\}/);
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { goals: ["Run daily operations"], assignments: {} };
    } catch {
      plan = {
        goals: ["Run daily operations"],
        assignments: {
          engineer: ["Review and improve codebase"],
          growth: ["Create social media content"],
          ops: ["Monitor systems and metrics"],
        },
      };
    }

    // Update cycle with plan
    await db
      .update(agentCycles)
      .set({ plan })
      .where(eq(agentCycles.id, cycle.id));

    // Step 2: Execute other agents based on the plan
    const agentsRan: string[] = [ceoAgent.role];
    let totalTokens = ceoResult.tokensUsed;

    const executionOrder: AgentRole[] = ["engineer", "growth", "ops"];

    for (const role of executionOrder) {
      const agent = companyAgents.find((a) => a.role === role);
      if (!agent) continue;

      const tasks = plan.assignments?.[role] ?? [];
      if (tasks.length === 0) continue;

      const agentPrompt = agent.systemPrompt || loadPrompt(role);
      const taskList = tasks.map((t, i) => `${i + 1}. ${t}`).join("\n");

      const result = await runAgent({
        agentId: agent.id,
        companyId,
        cycleId: cycle.id,
        systemPrompt: agentPrompt,
        userMessage: `Today's goals for "${company.name}":\n${plan.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}\n\nYour assigned tasks:\n${taskList}\n\nExecute these tasks now. Report what you accomplished.`,
        tools: [
          {
            name: "think",
            description: "Think through your approach before acting.",
            input_schema: {
              type: "object" as const,
              properties: { thought: { type: "string", description: "Your reasoning" } },
              required: ["thought"],
            },
          },
        ],
      });

      agentsRan.push(role);
      totalTokens += result.tokensUsed;
    }

    // Step 3: Generate cycle summary
    const summary = `Daily cycle completed for ${company.name}. Goals: ${plan.goals.join(", ")}. Agents ran: ${agentsRan.join(", ")}. Total tokens: ${totalTokens}.`;

    await db
      .update(agentCycles)
      .set({
        status: "completed",
        summary,
        agentsRan,
        tokensUsed: totalTokens,
        completedAt: new Date(),
      })
      .where(eq(agentCycles.id, cycle.id));

    broadcast(companyId, {
      type: "cycle_end",
      data: { cycleId: cycle.id, status: "completed" },
    });

    return cycle.id;
  } catch (err) {
    // Mark cycle as failed
    await db
      .update(agentCycles)
      .set({
        status: "failed",
        summary: `Cycle failed: ${err instanceof Error ? err.message : String(err)}`,
        completedAt: new Date(),
      })
      .where(eq(agentCycles.id, cycle.id));

    broadcast(companyId, {
      type: "cycle_end",
      data: { cycleId: cycle.id, status: "failed" },
    });

    throw err;
  }
}
