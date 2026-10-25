# Issue #56 — independent review

Reviewer: `/root/reviewer56`, the single independent reviewer for Standards and Spec. The owner selected **fresh main** in this chat. Fixed comparison: `c62917bb179e92fe9e3d9d65a8eac25106144ff2`; initial source: `c3061aa7517498f87344ec38231af92afa7d3528`. `git diff c62917bb179e92fe9e3d9d65a8eac25106144ff2...c3061aa7517498f87344ec38231af92afa7d3528` is nonempty (22 files, one source commit). `git log c62917b..c3061aa --oneline`: `c3061aa refactor(web): separate care visit and prescription workflows #56`.

## Sources and procedure

Fresh review preparation actually read AGENTS.md, HANDOFF.md, docs/agents/skill-integration.md, tracker rules; installed `.agents/skills/code-review/SKILL.md`, TDD with `tests.md`/`mocking.md`, handoff and codebase-design; installed React best-practices and `rerender-dependencies.md`/`async-parallel.md`. Matt's smell baseline was applied as judgement, with documented repository standards taking precedence. The owner's one-reviewer decision overrides skill fanout; no additional agents were used. Handoff's temp-only destination is overridden by the existing tracked-plus-OS-temp convention. No implementation or fixes were made by the reviewer. Design/prototype and domain-modeling workflows were not applied: no new design, terminology or ADR work is in scope.

Direct live connector reads: #56, #49, original #15/#16/#17 and prerequisite #55 (closed). Local sources: Spec001, approved clinical/access/file/financial amendments, CONTEXT, recovery reconciliation and architecture/dependency proposal; design/tokens as reference. Builder's implementation report is evidence input, not independent execution proof.

## Standards

No separate actionable documented-standard violation or smell finding. Interfaces generally separate transport/query/form coordination from visual consumers; server authorization and domain invariants remain authoritative. Server comparison/print snapshots are held in Query, forms in RHF, private presentation state in React, with no persistent sensitive draft storage. Scope is frontend logic; final product UI remains deferred. The two behavioral findings below concern the extraction's specified contracts and are reported under Spec only.

## Spec

1. **[P2] Preserve a shared care query while another consumer remains mounted** — `apps/web/src/features/clinical/useCareQuery.ts:38–41`. Cleanup unconditionally cancels and removes the exact key. Two medicine rows can share the same clinic/account/name lookup key; retiring one reader can detach the other from the query cache, leaving its old snapshot outside subsequent invalidations. #56 requires observable cache/scope behavior and #49 requires that “cancellation/cache invalidation and session transitions are handled.” A direct public QueryClient/QueryObserver probe confirmed two observers share one read; after one unsubscribed and this cleanup ran, the survivor retained old data, the cache entry was absent, and `invalidateQueries` did not refetch (read count stayed 1). Make cleanup aware of remaining observers while preserving last-reader/scope cleanup. A rendered shared-consumer regression is required; React rerender timing was not established by this probe.

2. **[P2] Enforce explicit plan rereview in the form's public submit action** — `apps/web/src/features/treatment/useVisitStartForm.ts:37–54`. `choices` now comes from current plans, but `onSubmit` does not reject `changed` or `invalid`. After an accepted plan revision changes, directly submitting the form action can send the new unreviewed `planRevision`, allowing a start against values the doctor has not rereviewed. The old reviewed-plan snapshot would send a stale revision and receive a conflict. The scaffold disables its fieldset, but the extracted behavior interface must retain the required rereview contract independently of visual controls. #56 explicitly requires stale conflicts; Spec001 requires reconciliation rather than silent overwrite and #15 retains the explicit reviewed procedure selection. Guard the handler until rereview and verify programmatic submission through the approved rendered consumer seam.

Initial totals: **Standards 0 / Spec 2**, both Spec findings P2. Builder owns fixes; same-reviewer recheck is required.

## Verification and limitations

Reviewer directly executed pinned `git diff --check` PASS and the small public QueryClient/QueryObserver cache probe described above; no private helpers were tested. Independently read the diff and all changed interfaces/consumers. API-plan SHA256 independently verified unchanged: `82E186AF080DB25098E44EEA1B9B097122245C0447967E1D4827528162E64A6A`; it remains unrelated and untracked.

Builder reports source-pinned affected browser 12/12 PASS53.8s and a full-suite run in progress. These are attributed builder reports, not reviewer reruns. Reviewer deliberately did not compete for the builder's browser/database/compiler resources during that run. Final source checks, fixes, evidence/handoff/mirror checkpoint and publication remain pending. No product-UI, deployment, live-data, restore, provider or legal/clinical acceptance is implied.

## Same-reviewer fix recheck — source 8fb859a

Rechecked exact final application/test source `8fb859acbd4a00585f22c74e903a49201c6f0b63` against the same owner-selected base `c62917bb179e92fe9e3d9d65a8eac25106144ff2`. Fix comparison `git diff c3061aa7517498f87344ec38231af92afa7d3528..8fb859acbd4a00585f22c74e903a49201c6f0b63` inspected in full: two hook changes and two rendered-consumer/test additions, no backend/contracts/schema/product UI change.

- Shared-reader finding **resolved**: cleanup closes its own stream but cancels/removes the exact Query only when no observers remain. Other mounted readers continue participating in invalidation; last-reader cleanup remains. The regression mounts two memoized public readers, removes one, invalidates externally and requires the survivor to display independently changed remote text.
- Explicit-rereview finding **resolved**: public `onSubmit` returns a stale-selection error when `changed || invalid`; explicit `review` clears that error and updates reviewed revisions/selection. The regression invokes the extracted submit action independently of disabled visual controls, requires no submitted selection before rereview and then the literal reviewed revision2 afterward.

Builder reports both regressions were independently observed red before each fix and green afterward (shared reader1/1 PASS2.5s; rereview1/1 PASS2.7s). Reviewer inspected the actual tests and fixes; these timings remain builder execution claims, not reviewer browser reruns. Reviewer directly ran final pinned `git diff --check` PASS. No new actionable findings on the complete source comparison: **Standards0 / Spec0 residual** (initial2 Spec findings resolved).

The previous full run on `c3061aa` was stopped after findings demanded source changes; no full-suite pass from that source is claimed. Builder's final14-browser/full-suite/static checks on `8fb859a`, and evidence/handoff/mirror checkpoint, remain pending. No competing reviewer browser/database/compiler run occurred during builder checks.

## Final verification evidence readback

This section supersedes the earlier pending final-check statements. Source remains exactly `8fb859acbd4a00585f22c74e903a49201c6f0b63`. Reviewer independently read `.local-dev/issue-56-full-tests.log` and its output log: exact start `2026-10-25T15:12:24.5907084Z`, end `2026-10-25T15:20:42.2262080Z`, same source at both ends, EXIT0, **259/259 tests in26files PASS496.62s**. Direct HEAD/read-only diff checks found no application/test changes from that source. These establish independent retained-output/source inspection, not a reviewer full-suite execution.

Reviewer then directly executed `npm run typecheck` and pinned `git diff --check` **PASS** after builder checks completed. Independently reread updated implementation report and compact HANDOFF: behavior/trace/skill provenance, two review findings and fixes, failed/interrupted runs, final pins, actual results and omissions are accurately distinguished. API-plan hash remains original and untracked/excluded.

Builder's directly observed final checks are attributed as follows: affected browser **14/14 PASS53.7s** (eight actual authenticated application/PostgreSQL journeys and six rendered minimal-consumer regressions), complete suite as independently output-verified above, then lint/build/diffcheck PASS. Build advisory542.47kB/157.58kB gzip remains documented. Builder reports fresh-main/native-blocker recheck and exclusive issue56 disposable resource cleanup; reviewer did not rerun Docker/database/browser, broad suites, Linux wrapper/npm-ci, deployment/restore/provider/legal/clinical/pilot checks. No product UI or production acceptance is claimed.

Final code outcome remains **Standards0 / Spec0 residual**, initial2 Spec findings resolved by builder and rechecked by this same reviewer. Exact evidence commit and actual OS-temp mirror readback remain the final publication checkpoint; no new code changes or runtime rechecks are requested.
