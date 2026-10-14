# Current delivery status

As of 2026-10-14 (Africa/Bamako). Approved specifications/contracts govern behavior; this records execution status. Existing machine-readable companion: delivery-status.json.

Planning #2–#6 are closed with owner approval. #7 and #8 are closed after manually merged PRs #35/#36. Workflow documentation PR #37 is merged; current main is 1201dde. Earlier delivery notes and ticket-publication.json are historical snapshots, not live tracker substitutes. No super-board workflow is active.

#9 is the authorized patient vertical slice on codex/issue-9-patients. Registration, guardian/shared contact support, unique clinic numbers, duplicate warnings, authorized search, explicit contact editing/archive/reactivation, immutable personal history and functional French journeys are implemented. Current grants and mutations share centralized identity authorization within a transaction; no patient cap or destructive delete was introduced. Visual redesign remains deferred. See issue-9-implementation.md and issue-9-review.md.

Independent review against merged main1201dde through d25baa3 found zero residual material standards/spec findings. Reviewer independently reran 11 patient HTTP tests and pinned whitespace checks successfully. Builder reports 37 HTTP tests, nine Chromium journeys, typecheck, lint and contracts/API/web builds passing. Full-suite/build reports are attributed, not independently rerun. Supplemental Chrome sign-in is incomplete because its request Origin omitted port4173; the same proxy passed CSRF with the correct Origin. Security checks were preserved. Published open PR #38: https://github.com/aymanobeid0/clinic-app/pull/38. Issue #9 and PR #38 are in Review; human review/merge remains required and #9 stays open until acceptance.

Clinical assignment/sharing (#10), historical cutoff (#18) and finalized clinical/financial record integrations remain subsequent work. Current archive retains patients and their personal history; future finalized-record retention scenarios are unverified until those records exist.

Remaining operational gates include transactional mail/provider/sender, Linux/native runtime, ingress/secure cookies/SSE, provider/host evidence, backup capacity/cost and restoration, performance/load, qualified clinical/legal and real-data handling. No production deployment, live migration or patient-data authorization exists. Preserve unrelated root design/AGENTS/HANDOFF changes. Dependency versions remain unchanged.
