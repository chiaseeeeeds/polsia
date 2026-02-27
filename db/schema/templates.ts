import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon"),
  config: jsonb("config").notNull(), // TemplateConfig
  isPublic: text("is_public").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
