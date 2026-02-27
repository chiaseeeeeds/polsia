import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  templateId: uuid("template_id"),
  settings: jsonb("settings").default({}),
  cycleSchedule: text("cycle_schedule").default("0 6 * * *"), // 6 AM daily
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
