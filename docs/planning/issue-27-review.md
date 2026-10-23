# Issue #27 independent review

Date: 2026-10-23. Reviewer: `review_issue27`, separate from the builder; no implementation fixes made by this reviewer.

Fixed owner-selected base: `973584971e64e2646317b19bd3a21331f7df7301` (main at start). Final reviewed implementation: `67ee5fb4875d2977940942d06cacb60cdf799bb2`.

Comparison: `git diff 973584971e64e2646317b19bd3a21331f7df7301...67ee5fb4875d2977940942d06cacb60cdf799bb2`. Commits: `194c8ba` (export capability) and `67ee5fb` (financial attachment capability correction). The fixed base resolves and the comparison is nonempty.

## Standards

No unresolved actionable standards findings in the final comparison.

Freshly read `docs/agents/skill-integration.md`, `docs/agents/issue-tracker.md` and `D:/clinic-app/.agents/skills/code-review/SKILL.md`. The repository's explicit one-reviewer override replaces the skill's parallel review agents; this reviewer examined both axes without delegation. Applied the documented architecture/module/repository boundaries and the skill's substantive smell baseline, excluding tool-enforced style checks. No new discovery/design skill was needed for this review of settled contracts.

Relevant standards sources: supplied AGENTS.md instructions, `docs/architecture/application-architecture.md`, `docs/planning/dependency-proposal.md`, and `CONTEXT.md`. Persistence now belongs to the concrete export repository; source projections use owning modules' public entry points. No product UI or dependencies were added, and no production operation was executed. The cleanup function has an explicit table reference, fixed search path, revoked PUBLIC execution and an owner-specific FORCE-RLS policy; its runtime grant permits expired-only deletion without exposing bytes or selecting arbitrary deletion targets.

## Spec

No unresolved actionable specification findings in the final comparison.

Directly fetched the current GitHub #27 body/comments, including active backend acceptance criteria and deferred #59/#73/#60/#76 owners. The initial GitHub network failure resolved through supported escalation; it did not establish invalid credentials. Product sources inspected: Spec 001, recovery reconciliation, identity/access and file/data decision contracts, plus existing clinical/treatment/billing/inventory implementations used by the projections. Prerequisite issue/merge verification is builder-reported in `issue-27-implementation.md`, not independently refetched by this reviewer.

Checked current role/patient/clinic boundaries, restricted staff financial fields, doctor own-work scope, historical/disabled denial, retained versions and relationships, ZIP integrity, idempotent replay, expiry, independent cleanup, and resource limits. Generation and permission changes serialize through the existing account/clinic lock; delivery checks current authorization and generation stamps again. Selected exports are synchronous and explicitly bounded; large-history pagination/jobs remain outside this implementation. This review covers backend acceptance only, not the deferred product/browser journey.

## Preliminary findings and disposition

All were reported to the builder before fixes and subsequently inspected in the final source:

| Finding | Final disposition |
| --- | --- |
| Managers bypassed nonfinancial output/read grants | Relevant category and read capabilities enforced. |
| Raw invoices exposed procedure/tooth fields to restricted staff | Invoice items use the same clinical-field restriction as online billing. |
| Expired final bundles persisted without further traffic | Startup and minute sweeps call the narrow expired-only database function. |
| Clinical acceptance-file relationships disappeared | Authorized clinical/mixed version references retained. |
| Generation/storage lacked effective limits | Source-count preflights, artifact/file byte limits, per-clinic storage/count capacity and operation admission enforced. |
| Service performed direct Prisma persistence | Save moved to `ExportsRepository`. |
| Disconnects released admission while work continued | Wrapper retains slot until awaited handler settles; regression exercised. |
| Mixed references lacked financial output/history checks | Staff mixed-reference inclusion requires the corresponding financial grants. |
| Clinical output exposed reception contact fields without their grant | Clinical patient identity limited to ID, number and name. |

The final builder-discovered financial-only attachment overrestriction was also independently inspected: financial ZIP requests select `exports.financial`; mixed requests retain both-class requirements.

## Independently executed verification

- At `194c8ba`, `npx vitest run apps/api/test/exports.test.ts` initially could not connect to isolated PostgreSQL: `EACCES 127.0.0.1:55437`; 14 tests skipped, no application assertions evaluated. Supported escalation succeeded: **14/14 passed**, exit 0, 35.61s, starting 17:31:33. The builder reported its subsequent small selector/test edit while this run was finishing; this run is evidence for the initial pin loaded at startup, not a claim that the final delta was included.
- At final pin `67ee5fb`, independently ran `npx vitest run apps/api/test/exports.test.ts -t 'private ZIP'` through the supported escalation: **1/1 passed**, 13 intentionally filtered, exit 0, 5.53s. This exercises the final delta: eligible staff financial ZIP without patient-export capability succeeds; ordinary doctor opaque financial ZIP remains denied.
- Independently generated attachment/manifest bytes with `serialization.zip` through `node --import tsx` and read them through .NET `System.IO.Compression.ZipArchive`: both entry contents matched, exit 0. This was a working-tree check before pinning; the serializer is unchanged in the reviewed commits.
- Inspected the final delta and complete implementation comparison. No unresolved connection blocker remains.

Builder-reported typecheck/lint/build and database preparation are recorded separately in `issue-27-implementation.md`; this reviewer did not independently rerun those or the complete repository suite. Final full-suite/build verification and handoff/PR publication remain builder responsibilities. The targeted checks use fictional isolated PostgreSQL and injected private storage; they do not prove native-volume deployment, production performance, proxy behavior or real-data readiness. No human merge/deployment approval is implied.

Summary: Standards 0 unresolved findings; Spec 0 unresolved findings. No worst outstanding issue on either axis.
