"use server";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function getOrCreateCustomer() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.clerkId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [customer] = await db
    .insert(customers)
    .values({
      clerkId: userId,
      email: "", // will be updated by Clerk webhook
    })
    .returning();

  return customer;
}

export async function getCustomer() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.clerkId, userId))
    .limit(1);

  return customer ?? null;
}

export async function updateCustomerStripe(
  clerkId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
) {
  await db
    .update(customers)
    .set({
      stripeCustomerId,
      stripeSubscriptionId,
      membershipTier: "pro",
      updatedAt: new Date(),
    })
    .where(eq(customers.clerkId, clerkId));
}
