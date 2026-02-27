"use server";

import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getTemplates() {
  return db.select().from(templates).where(eq(templates.isPublic, "true"));
}

export async function getTemplate(slug: string) {
  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.slug, slug))
    .limit(1);
  return template ?? null;
}
