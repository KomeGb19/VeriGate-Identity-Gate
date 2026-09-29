import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  CreateProfileBody,
  DecideVerificationBody,
  GetDashboardSummaryQueryParams,
  ListProfilesParams,
  ListVerificationEventsQueryParams,
  UpdateProfileStatusBody,
  UpdateProfileStatusParams,
} from "@workspace/api-zod";
import {
  db,
  profilesTable,
  sitesTable,
  verificationEventsTable,
} from "@workspace/db";

const router: IRouter = Router();
const STAFF_ID = "gate-staff-demo";
let seedPromise: Promise<void> | null = null;

const seedSites = [
  { id: "cedar-grove", name: "Cedar Grove Academy", type: "school" },
  { id: "lagoon-view", name: "Lagoon View Estate", type: "estate" },
] as const;

const seedProfiles = [
  {
    id: "profile-amara-okafor",
    siteId: "cedar-grove",
    name: "Amara Okafor",
    role: "guardian",
    linkedTo: "Collects: Tobi Okafor",
    photoUrl:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=160&h=160&fit=crop&crop=faces",
  },
  {
    id: "profile-daniel-adebayo",
    siteId: "cedar-grove",
    name: "Daniel Adebayo",
    role: "backup_pickup",
    linkedTo: "Backup for: Maya Bello",
    photoUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces",
  },
  {
    id: "profile-chioma-nwosu",
    siteId: "cedar-grove",
    name: "Chioma Nwosu",
    role: "guardian",
    linkedTo: "Collects: Kene Nwosu",
    photoUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=faces",
  },
  {
    id: "profile-emeka-obi",
    siteId: "lagoon-view",
    name: "Emeka Obi",
    role: "resident",
    linkedTo: "Household: Obi residence",
    photoUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=faces",
  },
  {
    id: "profile-nneka-eze",
    siteId: "lagoon-view",
    name: "Nneka Eze",
    role: "resident",
    linkedTo: "Household: Eze residence",
    photoUrl:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=160&h=160&fit=crop&crop=faces",
  },
  {
    id: "profile-olumide-balogun",
    siteId: "lagoon-view",
    name: "Olumide Balogun",
    role: "visitor",
    linkedTo: "Visiting: Balogun residence",
    photoUrl:
      "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=160&h=160&fit=crop&crop=faces",
    visitorWindowStart: new Date("2026-09-28T08:00:00.000Z"),
    visitorWindowEnd: new Date("2026-09-30T18:00:00.000Z"),
  },
] as const;

async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const existingSites = await db.select({ id: sitesTable.id }).from(sitesTable);
    if (existingSites.length > 0) return;

    await db.insert(sitesTable).values([...seedSites]);
    await db.insert(profilesTable).values(
      seedProfiles.map((profile) => ({
        ...profile,
        status: "active",
        faceDescriptor: null,
      })),
    );
    await db.insert(verificationEventsTable).values([
    {
      id: "event-001",
      siteId: "cedar-grove",
      matchedProfileId: "profile-amara-okafor",
      gateName: "School Gate",
      result: "verified",
      similarityScore: 0.42,
      decisionMs: 1180,
      staffId: STAFF_ID,
      overrideReason: null,
      flaggedSuspicious: false,
      createdAt: new Date("2026-09-29T06:55:00.000Z"),
    },
    {
      id: "event-002",
      siteId: "cedar-grove",
      matchedProfileId: "profile-daniel-adebayo",
      gateName: "School Gate",
      result: "override",
      similarityScore: 0.67,
      decisionMs: 2460,
      staffId: STAFF_ID,
      overrideReason: "Staff confirmed photo ID and authorised backup list.",
      flaggedSuspicious: false,
      createdAt: new Date("2026-09-29T06:48:00.000Z"),
    },
    {
      id: "event-003",
      siteId: "lagoon-view",
      matchedProfileId: "profile-emeka-obi",
      gateName: "Estate Gate",
      result: "verified",
      similarityScore: 0.38,
      decisionMs: 920,
      staffId: STAFF_ID,
      overrideReason: null,
      flaggedSuspicious: false,
      createdAt: new Date("2026-09-29T06:42:00.000Z"),
    },
    {
      id: "event-004",
      siteId: "lagoon-view",
      matchedProfileId: null,
      gateName: "Estate Gate",
      result: "denied",
      similarityScore: 0.83,
      decisionMs: 1640,
      staffId: STAFF_ID,
      overrideReason: null,
      flaggedSuspicious: true,
      createdAt: new Date("2026-09-29T06:34:00.000Z"),
    },
    ]);
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });
  return seedPromise;
}

function toProfileResponse(profile: typeof profilesTable.$inferSelect) {
  return {
    id: profile.id,
    siteId: profile.siteId,
    name: profile.name,
    role: profile.role as
      | "guardian"
      | "backup_pickup"
      | "resident"
      | "visitor",
    linkedTo: profile.linkedTo,
    status: profile.status as "active" | "revoked",
    photoUrl: profile.photoUrl,
    faceDescriptor: profile.faceDescriptor,
    visitorWindowStart: profile.visitorWindowStart,
    visitorWindowEnd: profile.visitorWindowEnd,
    createdAt: profile.createdAt,
  };
}

function toEventResponse(
  event: typeof verificationEventsTable.$inferSelect,
) {
  return {
    id: event.id,
    siteId: event.siteId,
    matchedProfileId: event.matchedProfileId,
    gateName: event.gateName,
    result: event.result as "verified" | "denied" | "override",
    similarityScore: event.similarityScore,
    decisionMs: event.decisionMs,
    staffId: event.staffId,
    overrideReason: event.overrideReason,
    flaggedSuspicious: event.flaggedSuspicious,
    createdAt: event.createdAt,
  };
}

router.get("/sites", async (_req, res, next) => {
  try {
    await ensureSeeded();
    const sites = await db.select().from(sitesTable).orderBy(sitesTable.name);
    res.json(
      sites.map((site) => ({
        id: site.id,
        name: site.name,
        type: site.type as "school" | "estate",
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/sites/:siteId/profiles", async (req, res, next) => {
  try {
    await ensureSeeded();
    const params = ListProfilesParams.parse(req.params);
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.siteId, params.siteId))
      .orderBy(profilesTable.name);
    res.json(profiles.map(toProfileResponse));
  } catch (error) {
    next(error);
  }
});

router.post("/profiles", async (req, res, next) => {
  try {
    await ensureSeeded();
    const body = CreateProfileBody.parse(req.body);
    const [profile] = await db
      .insert(profilesTable)
      .values({
        id: `profile-${randomUUID()}`,
        siteId: body.siteId,
        name: body.name,
        role: body.role,
        linkedTo: body.linkedTo,
        status: "active",
        faceDescriptor: body.faceDescriptor ?? null,
        photoUrl: body.photoUrl,
        visitorWindowStart: body.visitorWindowStart ?? null,
        visitorWindowEnd: body.visitorWindowEnd ?? null,
      })
      .returning();
    res.status(201).json(toProfileResponse(profile));
  } catch (error) {
    next(error);
  }
});

router.patch("/profiles/:profileId/status", async (req, res, next) => {
  try {
    await ensureSeeded();
    const params = UpdateProfileStatusParams.parse(req.params);
    const body = UpdateProfileStatusBody.parse(req.body);
    const [profile] = await db
      .update(profilesTable)
      .set({ status: body.status })
      .where(eq(profilesTable.id, params.profileId))
      .returning();
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(toProfileResponse(profile));
  } catch (error) {
    next(error);
  }
});

router.post("/verification/decide", async (req, res, next) => {
  try {
    await ensureSeeded();
    const body = DecideVerificationBody.parse(req.body);
    let matchedProfileId = body.matchedProfileId ?? null;
    let result = body.result;
    let similarityScore = body.similarityScore;

    const activeProfiles = await db
      .select()
      .from(profilesTable)
      .where(
        and(
          eq(profilesTable.siteId, body.siteId),
          eq(profilesTable.status, "active"),
        ),
      );

    if (body.faceDescriptor?.length) {
      const candidates = activeProfiles
        .filter((profile) => profile.faceDescriptor?.length === body.faceDescriptor?.length)
        .map((profile) => ({
          profile,
          distance: Math.sqrt(
            profile.faceDescriptor!.reduce(
              (sum, value, index) =>
                sum + (value - (body.faceDescriptor?.[index] ?? 0)) ** 2,
              0,
            ),
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
      const best = candidates[0];
      if (best) {
        matchedProfileId = best.profile.id;
        similarityScore = Math.min(1, best.distance);
        if (best.distance <= 0.55) result = "verified";
        else if (best.distance <= 0.75) result = "override";
        else {
          result = "denied";
          matchedProfileId = null;
        }
      }
    }

    if (
      matchedProfileId &&
      !activeProfiles.some((profile) => profile.id === matchedProfileId)
    ) {
      matchedProfileId = null;
      result = "denied";
    }

    const [event] = await db
      .insert(verificationEventsTable)
      .values({
        id: `event-${randomUUID()}`,
        siteId: body.siteId,
        matchedProfileId,
        gateName: body.gateName,
        result,
        similarityScore,
        decisionMs: body.decisionMs,
        staffId: STAFF_ID,
        overrideReason: body.overrideReason ?? null,
        flaggedSuspicious: body.flaggedSuspicious,
      })
      .returning();
    res.status(201).json(toEventResponse(event));
  } catch (error) {
    next(error);
  }
});

router.get("/verification-events", async (req, res, next) => {
  try {
    await ensureSeeded();
    const query = ListVerificationEventsQueryParams.parse(req.query);
    const filters = [];
    if (query.siteId) filters.push(eq(verificationEventsTable.siteId, query.siteId));
    if (query.result) filters.push(eq(verificationEventsTable.result, query.result));
    const events = await db
      .select()
      .from(verificationEventsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(verificationEventsTable.createdAt))
      .limit(query.limit);
    res.json(events.map(toEventResponse));
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/summary", async (req, res, next) => {
  try {
    await ensureSeeded();
    const query = GetDashboardSummaryQueryParams.parse(req.query);
    const events = await db
      .select()
      .from(verificationEventsTable)
      .where(
        query.siteId
          ? eq(verificationEventsTable.siteId, query.siteId)
          : undefined,
      )
      .orderBy(desc(verificationEventsTable.createdAt));
    const totalAttempts = events.length;
    const verifiedCount = events.filter((event) => event.result === "verified").length;
    const overrideCount = events.filter((event) => event.result === "override").length;
    const speeds = events.map((event) => event.decisionMs).sort((a, b) => a - b);
    const middle = Math.floor(speeds.length / 2);
    const medianVerificationSpeed = speeds.length
      ? speeds.length % 2
        ? speeds[middle]
        : Math.round((speeds[middle - 1] + speeds[middle]) / 2)
      : 0;

    res.json({
      totalAttempts,
      verifiedHandoverRate: totalAttempts ? verifiedCount / totalAttempts : 0,
      medianVerificationSpeed,
      overrideRate: totalAttempts ? overrideCount / totalAttempts : 0,
      flaggedCount: events.filter((event) => event.flaggedSuspicious).length,
      recentEvents: events.slice(0, 5).map(toEventResponse),
    });
  } catch (error) {
    next(error);
  }
});

export default router;