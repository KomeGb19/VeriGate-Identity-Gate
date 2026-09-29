---
name: Concurrent seed safety
description: Protects startup demo or bootstrap seeding from duplicate inserts when several UI queries arrive at once.
---

Bootstrap seeding must use a shared in-process promise or an equivalent database-level idempotency guard. Checking for existing rows and then inserting without a lock is unsafe because dashboard pages commonly fire several API requests in parallel on first load.

**Why:** The VeriGate overview requested sites, profiles, and summary concurrently; without a guard, the first two site/profile requests raced and one returned a 500 from a duplicate seed insert.

**How to apply:** Wrap one-time seed work in a memoized promise, clear it on failure so a later request can retry, and keep seed identifiers deterministic.