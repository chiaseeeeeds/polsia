import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  command: text("command").notNull(),
  args: jsonb("args").default([]),
  env: jsonb("env").default({}),
  tools: jsonb("tools").default([]), // list of tool names
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
