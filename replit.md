# VeriGate Identity Gate

VeriGate helps school and estate gate staff enrol trusted people, make explicit face-verification decisions, and keep an audit trail for every attempt.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/verigate/src/App.tsx` — responsive overview, enrolment, gate verification, and admin screens.
- `artifacts/verigate/src/index.css` — VeriGate visual tokens and responsive UI styles.
- `lib/api-spec/openapi.yaml` — source of truth for sites, profiles, decisions, events, and dashboard summary APIs.
- `artifacts/api-server/src/routes/verigate.ts` — API handlers and demo seed data.
- `lib/db/src/schema/` — Drizzle tables for sites, profiles, and verification events.

## Architecture decisions

- The first build uses the workspace PostgreSQL database and Drizzle rather than an external database connection so the demo data, schema, and rollback behavior stay inside the project.
- Face capture supports real browser camera access, upload fallback, and face-api.js descriptor generation; every decision still requires an explicit operator action and is logged.
- API startup seeding is guarded against concurrent first requests so parallel dashboard queries cannot duplicate demo rows.
- The app defaults to an admin demo role and includes a gate-staff role switch so the admin-only surface can be exercised before managed authentication is connected.

## Product

- Overview metrics and recent gate activity.
- Consent-gated enrolment with camera or upload capture and optional visitor windows.
- School and estate gate verification with verified, manual confirmation, and not-verified decisions.
- Filterable audit log, suspicious flags, and immediate profile revocation/reactivation.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before checking the server or frontend.
- Preview and API workflows are managed artifact services; restart `artifacts/api-server: API Server` and `artifacts/verigate: web` after code changes that affect runtime behavior.
- Face-api.js models load from a CDN in the browser. If they are unavailable, the UI keeps camera/upload capture available and makes the manual review path explicit.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
