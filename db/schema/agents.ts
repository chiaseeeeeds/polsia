import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // ceo, engineer, growth, ops
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  config: jsonb("config").default({}),
  totalCycles: integer("total_cycles").default(0),
  totalTokens: integer("total_tokens").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
