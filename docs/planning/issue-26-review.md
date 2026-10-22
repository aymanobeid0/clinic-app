# Independent review — issue #26

Reviewer: separate reviewer worker (one reviewer for both axes), 2026-10-22. Inspected HEAD `4277e65d0205f074dc37cc3aff0b649660c75d70`; owner comparison `main`, pinned by builder to `d95ac606b8dd1e5d550d4f81be2393f63be087d8`. Independently resolved both refs, verified nonempty diff and read `git diff d95ac606b8dd1e5d550d4f81be2393f63be087d8...HEAD` and `git log d95ac606b8dd1e5d550d4f81be2393f63be087d8..HEAD --oneline` (one feature commit).

## Role skill and sources checkpoint

Read actual `D:/clinic-app/.agents/skills/code-review/SKILL.md`, AGENTS.md and docs/agents/skill-integration.md afresh. Applied fixed-point verification, Standards and Spec axes and all Fowler smell heuristics as judgment calls. Owner/repository override replaces skill's parallel reviewer fanout: this worker alone reviews both axes and implements no fixes. Considered but skipped implement/TDD (builder procedures; reviewer verifies behavior without implementing), UI/design (backend-only), discovery/spec/ticket generation (approved contract already exists). Read issue-tracker rules, CONTEXT, approved specification's identity/financial/report/reliability rules, dependency proposal, application architecture, recovery reconciliation, issue implementation evidence and API contract. Reviewed changed module boundaries, current identity/financial projection/funds reconciliation, stream middleware, migration/RLS and HTTP tests.

Direct current GitHub reads independently verified #26 OPEN, no comments, current backend criteria and native blockers #16/#23/#25/#50 all CLOSED. Deferred owners #59/#60/#73/#76 remain OPEN. Initial sandbox reads failed with `error connecting to api.github.com`; supported escalated retry succeeded. This is no evidence of invalid credentials. Builder's merged prerequisite evidence is attributed to docs/planning/issue-26-implementation.md, not independently fetched by this worker.

## Standards

No actionable documented-standard or Fowler-baseline finding. Existing clinic transaction lock and runtime RLS/composite references protect append-only follow-up events; module-owned projections preserve the modular boundaries. No dependencies or UI state changes.

## Spec

1. **[P2] Include the own-work portion of mixed receipt reversals.** `apps/api/src/modules/billing/billing.report.ts` derives its reversal IDs from `state.corrections`. The authoritative billing workspace intentionally hides a correction whose `chargeIds` include another doctor's work. For a manager reversing a receipt allocated across two doctors, each ordinary doctor's report therefore shows its original own new money and updated own due balance but `reversedMoneyMinor: "0"` on reversal day. #26 requires reconciliation with current own-work restrictions; Spec001 financial corrections and aggregates must preserve those restrictions without dropping attributable amounts. Derive authorized aggregate reversal contributions from retained facts and own charge allocations without exposing inseparable correction details. Add HTTP coverage with mixed-doctor allocations and preferably an explicit deposit component, checking manager and both doctors' daily totals and retained document restrictions.

2. **[P2] Expose authorized reporting invalidations.** Reporting routes provide no SSE transport. A report-only account can use projections/tasks but cannot necessarily authorize a scheduling/billing/inventory stream. Pending-note changes publish scoped `notes:<patient>` invalidations, which existing generic streams ignore. API docs' direction to refetch after existing SSE invalidations cannot provide immediate updates for these consumers. Application architecture line 91 requires minimal authorized SSE invalidation after commit, with session/access rechecks and reconnect refetch. Supply a report-authorized stream (or equivalent approved accessible contract), map authorized note changes to neutral invalidations, and test report-only subscribers, current revocation/clinic isolation and absence of clinical payloads.

Summary: Standards 0 findings; Spec 2 findings, both P2. Builder fixes and same-reviewer recheck required before PR.

## Independently observed verification and limitations

- `npx vitest run apps/api/test/reporting.test.ts`: initial sandbox run could not connect to loopback PostgreSQL (`EACCES 127.0.0.1:55437`), all tests skipped; supported escalated rerun **10/10 PASS, 25.69s** at inspected revision. Conditional storage-failure test logged sanitized error type only and passed. Disposable fictional PostgreSQL, no production/live data.
- `npm run typecheck`: PASS; `git diff --check d95ac606b8dd1e5d550d4f81be2393f63be087d8...HEAD`: PASS.
- Full suite, lint/build and TDD red/green execution are builder-reported/pending evidence in implementation record, not independent reruns here. Passing ten tests does not cover the two gaps above. No browser/product UI, production migration, performance/load or deployment acceptance established. Existing handoff/OS-temp refresh and publication checkpoints remain builder responsibilities.
