import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { companies, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { runCycle } from "@/worker/orchestrator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the user owns this company
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.clerkId, userId))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.customerId, customer.id)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    const cycleId = await runCycle(id);
    return NextResponse.json({ cycleId, status: "started" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cycle failed" },
      { status: 500 }
    );
  }
}
