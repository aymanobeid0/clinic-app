# Current delivery status

As of 2026-10-12 (Africa/Bamako). Machine-readable companion: delivery-status.json. Approved specifications/contracts govern behavior; this document records execution status.

Prerequisite evidence PR #30 and super-board retirement/workflow PR #31 are merged. Owner approved closing planning #2–#6 and starting #7; #7 stays open. Native blocker edges remain intact. No super-board workflow is active.

Draft PR #32 currently contains the initial session slice and documentation. Local continuation adds operator-provisioned manager onboarding/authentication, clinic RLS/runtime-role verification and the French React journey. The owner approved feature-based Routes -> Controller -> Service -> Repository organization on 2026-10-12, now implemented and documented in application-architecture.md. The concurrent manager-email-login amendment was removed/deferred by the owner; clinic-code/username login remains current.

See issue-7-implementation.md for behavior, dependency evidence and verification. Builder passed 12HTTP tests and two Chromium journeys after refactoring; final checks and the same separate reviewer passed, recorded in issue-7-continuation-review.md. Prisma MCP was used only for documentation lookup. No cloud resources were created.

Remaining gates: human review/merge, live transactional email/provider/sender/delivery, Linux API/native compatibility, ingress/secure cookies, host evidence, backup cost/capacity/restore rehearsal and qualified clinical/legal/real-data handling checks. Recovery consumption/account/permission administration is subsequent #8. Production deployment/live migrations/patient data require separate authorization.

Historical discovery/review files are dated snapshots. ticket-publication.json is the original issue publication payload and blocker mapping, not a live status tracker. package.json/package-lock.json hold installed dependency pins; no dependency versions changed during this continuation. All JSON/config consistency and whitespace checks should pass before commit. Preserve unrelated design relocations and local HANDOFF; exclude them from implementation commits.
