import { pgTable, text, timestamp, uuid, real, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const metrics = pgTable(
  "metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "revenue", "users", "tweets_sent"
    value: real("value").notNull(),
    unit: text("unit"), // e.g. "USD", "count", "percent"
    source: text("source"), // which agent/tool recorded this
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [
    index("metrics_company_idx").on(table.companyId),
    index("metrics_name_idx").on(table.companyId, table.name),
    index("metrics_recorded_idx").on(table.recordedAt),
  ]
);
