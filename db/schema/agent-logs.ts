import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { companies } from "./companies";

export const agentLogs = pgTable(
  "agent_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id"),
    type: text("type").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_logs_company_idx").on(table.companyId),
    index("agent_logs_cycle_idx").on(table.cycleId),
    index("agent_logs_created_idx").on(table.createdAt),
  ]
);
