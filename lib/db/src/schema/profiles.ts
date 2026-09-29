import {
  doublePrecision,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sitesTable.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  linkedTo: text("linked_to").notNull(),
  status: text("status").notNull().default("active"),
  faceDescriptor: doublePrecision("face_descriptor").array(),
  photoUrl: text("photo_url").notNull(),
  visitorWindowStart: timestamp("visitor_window_start", {
    withTimezone: true,
  }),
  visitorWindowEnd: timestamp("visitor_window_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable);
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;