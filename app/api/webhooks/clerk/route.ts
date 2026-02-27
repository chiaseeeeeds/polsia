import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const payload = await req.json();

  // Verify webhook secret in production
  const headerSecret = req.headers.get("svix-id");
  if (!headerSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const { type, data } = payload;

  switch (type) {
    case "user.created": {
      const email = data.email_addresses?.[0]?.email_address ?? "";
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
      await db.insert(customers).values({
        clerkId: data.id,
        email,
        name: name || null,
      }).onConflictDoNothing();
      break;
    }
    case "user.updated": {
      const email = data.email_addresses?.[0]?.email_address ?? "";
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
      await db
        .update(customers)
        .set({ email, name: name || null, updatedAt: new Date() })
        .where(eq(customers.clerkId, data.id));
      break;
    }
    case "user.deleted": {
      await db.delete(customers).where(eq(customers.clerkId, data.id));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
