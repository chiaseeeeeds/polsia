"use server";

import { db } from "@/db";
import { companies, agents, agentLogs, agentCycles, metrics } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateCustomer } from "./customers";
import { revalidatePath } from "next/cache";
import type { AgentRole } from "@/types";

const DEFAULT_AGENTS: { role: AgentRole; name: string }[] = [
  { role: "ceo", name: "CEO Agent" },
  { role: "engineer", name: "Engineer Agent" },
  { role: "growth", name: "Growth Manager" },
  { role: "ops", name: "Operations Agent" },
];

export async function getCompanies() {
  const customer = await getOrCreateCustomer();
  return db
    .select()
    .from(companies)
    .where(eq(companies.customerId, customer.id))
    .orderBy(desc(companies.createdAt));
}

export async function getCompany(id: string) {
  const customer = await getOrCreateCustomer();
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.customerId, customer.id)))
    .limit(1);
  return company ?? null;
}

export async function createCompany(data: {
  name: string;
  description?: string;
  templateId?: string;
}) {
  const customer = await getOrCreateCustomer();

  const [company] = await db
    .insert(companies)
    .values({
      customerId: customer.id,
      name: data.name,
      description: data.description ?? null,
      templateId: data.templateId ?? null,
    })
    .returning();

  // Create default agents
  for (const agentDef of DEFAULT_AGENTS) {
    await db.insert(agents).values({
      companyId: company.id,
      role: agentDef.role,
      name: agentDef.name,
      systemPrompt: `You are the ${agentDef.name} for ${company.name}.`,
      config: { mcpServers: [] },
    });
  }

  revalidatePath("/dashboard");
  return company;
}

export async function updateCompany(
  id: string,
  data: { name?: string; description?: string; status?: string; settings?: Record<string, unknown> }
) {
  const customer = await getOrCreateCustomer();

  const [company] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(companies.id, id), eq(companies.customerId, customer.id)))
    .returning();

  revalidatePath("/dashboard");
  return company;
}

export async function deleteCompany(id: string) {
  const customer = await getOrCreateCustomer();
  await db
    .delete(companies)
    .where(and(eq(companies.id, id), eq(companies.customerId, customer.id)));
  revalidatePath("/dashboard");
}

export async function getCompanyAgents(companyId: string) {
  return db
    .select()
    .from(agents)
    .where(eq(agents.companyId, companyId))
    .orderBy(agents.role);
}

export async function getCompanyLogs(companyId: string, limit = 50) {
  return db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.companyId, companyId))
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit);
}

export async function getCompanyCycles(companyId: string, limit = 10) {
  return db
    .select()
    .from(agentCycles)
    .where(eq(agentCycles.companyId, companyId))
    .orderBy(desc(agentCycles.createdAt))
    .limit(limit);
}

export async function getCompanyMetrics(companyId: string) {
  return db
    .select()
    .from(metrics)
    .where(eq(metrics.companyId, companyId))
    .orderBy(desc(metrics.recordedAt))
    .limit(100);
}

export async function getDashboardStats() {
  const customer = await getOrCreateCustomer();

  const companiesList = await db
    .select()
    .from(companies)
    .where(eq(companies.customerId, customer.id));

  const companyIds = companiesList.map((c) => c.id);

  if (companyIds.length === 0) {
    return { companies: 0, activeAgents: 0, cyclesToday: 0, tokensUsed: 0 };
  }

  const agentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(agents)
    .where(
      sql`${agents.companyId} IN ${sql.raw(`('${companyIds.join("','")}')`)}`
    );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cyclesToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentCycles)
    .where(
      and(
        sql`${agentCycles.companyId} IN ${sql.raw(`('${companyIds.join("','")}')`)}`,
        sql`${agentCycles.createdAt} >= ${today}`
      )
    );

  return {
    companies: companiesList.length,
    activeAgents: Number(agentCount[0]?.count ?? 0),
    cyclesToday: Number(cyclesToday[0]?.count ?? 0),
    tokensUsed: 0,
  };
}
