# Current delivery status

As of 2026-10-11 (Africa/Bamako). Machine-readable companion: delivery-status.json. This records execution status; approved specification/decision contracts govern behavior. Original research/review statements remain dated evidence rather than current tracker state.

## Today's completed work

- Prerequisite evidence PR #30 and super-board retirement/workflow PR #31 are merged. Owner explicitly approved closing #2–#6 and starting #7; GitHub confirms those five issues closed and #7 open. Planning acceptance does not remove runtime/legal/real-data gates.
- Commit 3227073 on codex/issue-7-manager-bootstrap starts #7. Draft PR #32 is open and unmerged: https://github.com/aymanobeid0/clinic-app/pull/32 . Project items #2–#6 and PRs #30/#31 are Done; #7 and PR #32 are Building.
- Implemented npm workspaces, TypeScript API/shared contracts, PostgreSQL anonymous sessions, session-bound CSRF/origin checks, fixed server-enforced 12-hour expiry and denied-by-default identity. No authenticated manager access or public registration. Web workspace has dependencies only. See issue-7-implementation.md for exact scope and package/lock adjustments.
- Builder checks passed: clean npm ci, Prisma generation and isolated migration, typecheck, lint, six PostgreSQL HTTP tests, API/contracts build, local Argon2 verification and npm audit (0 findings). Same separate reviewer passed standards/specification for this slice; checks were not independently rerun. See issue-7-initial-review.md. Dedicated test database was shut down; other services untouched.
- Owner requested use of installed Prisma MCP for relevant future ORM work. It has not yet been used for implementation. It does not change the approved PostgreSQL/Prisma stack or authorize deployment.
- TypeScript strict mode is enabled. Express callback parameters may use contextual type inference; missing explicit annotations do not imply any.

## Remaining work and gates

Complete #7 manager provisioning, mandatory password replacement, verified recovery email/codes, authentication/revocation, clinic RLS/runtime-role isolation and French setup/sign-in/out browser journey. Linux API/native compatibility and browser behavior remain unproven. Email provider/sender/delivery, host evidence, backup cost/capacity, restore rehearsal, clinical/legal/data-handling checks remain gates in the prerequisite contracts. Every merge requires human approval; no deployment, live migration, real patient data, purchase or live email is authorized.

## Documentation reconciliation

Historical discovery, planning reviews and foundation proposals now point here so their earlier open/uncommitted/not-installed statements cannot be mistaken for current status. ticket-publication.json retains the original issue publication payload and blocker mapping; it is not a live tracker. package.json/package-lock.json are the installed dependency source of truth; version research retains the original candidates. No historical review has been rewritten to claim later tests or approvals.

Unrelated design relocations remain uncommitted and excluded. HANDOFF.md and the OS temporary copy are updated. The owner authorized publishing this documentation reconciliation to the existing draft PR #32; it changes no application behavior and does not authorize merge. JSON parsing and package/lock consistency were checked; application tests were not rerun for documentation-only edits.
