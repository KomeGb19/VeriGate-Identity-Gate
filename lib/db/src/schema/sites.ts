import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sitesTable = pgTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
});

export const insertSiteSchema = createInsertSchema(sitesTable);
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;