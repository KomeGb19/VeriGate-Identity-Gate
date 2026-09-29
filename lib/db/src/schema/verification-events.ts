import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { sitesTable } from "./sites";

export const verificationEventsTable = pgTable("verification_events", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sitesTable.id),
  matchedProfileId: text("matched_profile_id").references(() => profilesTable.id),
  gateName: text("gate_name").notNull(),
  result: text("result").notNull(),
  similarityScore: doublePrecision("similarity_score").notNull(),
  decisionMs: integer("decision_ms").notNull(),
  staffId: text("staff_id").notNull(),
  overrideReason: text("override_reason"),
  flaggedSuspicious: boolean("flagged_suspicious").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVerificationEventSchema = createInsertSchema(
  verificationEventsTable,
);
export type InsertVerificationEvent = z.infer<
  typeof insertVerificationEventSchema
>;
export type VerificationEvent = typeof verificationEventsTable.$inferSelect;