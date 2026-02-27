"use server";

import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateAgent(
  agentId: string,
  data: { systemPrompt?: string; config?: Record<string, unknown> }
) {
  const [updated] = await db
    .update(agents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning();

  revalidatePath("/dashboard");
  return updated;
}
