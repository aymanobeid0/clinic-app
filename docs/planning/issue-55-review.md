# Issue #55 — independent review

Reviewer: `/root/reviewer55`, the single separate reviewer for both Standards and Spec. Prepared earlier without reviewing the diff; formal review began only after the owner replied **use main** at 12:11 UTC on 2026-10-25. No review fanout and no reviewer implementation edits.

## Comparison and sources

Owner-selected main is pinned to `f8f085e877287875243d248e2f17d4e6c49de662`. Reviewed nonempty comparison:

`git diff f8f085e877287875243d248e2f17d4e6c49de662...4b9a75ca9f17ec9cf1f6f4e78c9e6c1cb50fdbad`

Commit list from the corresponding two-dot log: `3689853` extraction, `0d98a77` Query-owned snapshots, `3a44d3e` transient stream behavior, `4b9a75c` evidence. App/test source pin is `3a44d3e9e9c2a5b821308737f6a4121e80b7e99b`; the next commit changes only HANDOFF and implementation evidence. Current uncommitted owner-ref factual additions were read separately and are outside the pinned source comparison.

Actually read AGENTS, current `docs/agents/skill-integration.md` again for formal review, tracker, CONTEXT, architecture/dependency/reconciliation, Spec001, clinical/financial/identity-access/file amendments, design/tokens, and implementation report. Direct connector reads covered live #55/#49/#11/#13/#14; at 12:17 UTC #55 remained OPEN with unchanged criteria/no comments and #54 CLOSED/COMPLETED. Main fetch/native-blocker provenance remains the builder's separately recorded direct verification.

Skills actually read: repository `.agents/skills/code-review/SKILL.md` including all twelve smell heuristics; TDD SKILL plus tests/mocking references; codebase-design vocabulary; handoff; writing-for-agents for the owner-requested agent instruction addition; installed `build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` plus dependency/parallel references. Applied the owner override of one reviewer covering both axes, agreed existing seams, tracked handoff plus actual OS-temp mirror, and standing publication authorization. No product discovery, new spec/ticket decomposition, UI-design workflow, or implementation/TDD cycle was needed in the reviewer role.

## Standards

**0 actionable findings.** Transport/query/form/workflow coordination is extracted from the temporary scaffold. Backend runtime, contracts/schema/migrations and dependencies are unchanged. Query owns fetched server snapshots and retained/editor reads; RHF owns plan/catalog fields, and React retains private feedback/selection/review markers. The new command lifetime reuses the established StrictMode-safe pattern. Exact sent payloads and command IDs survive uncertain retries; synchronous serialization prevents same-turn duplicate writes. The owner-requested brief instruction faithfully preserves the recorded preference and standing publication/manual-merge boundaries.

Reviewed every changed runtime file and all changed-test responsibilities. Independently normalized/compared the 28 pre-existing test files outside the treatment browser suite: changes are port interpolation only. Test-only port selection and Compose/README guidance are justified by isolation, without changing the owner's default. Applied all twelve smell heuristics as judgement calls; no substantive smell or documented architecture breach requires a change. Tool-enforced formatting/type concerns are not duplicated as findings.

## Spec

**0 actionable findings.** The extracted interfaces cover catalog/default copying, scoped proposals, pricing strings/discount reasons/extras, draft autosave and reconciliation, present/evidence/doctor acceptance/cancellation, version review, signed attachment references, and retained printable reads/reauthorization. Authoritative acceptance, financial and authorization decisions remain on the server. The existing higher browser seam checks retained accepted values, notes versus price/scope changes, conflict/retry behavior, French catalog/duration integration and scope removal; the new signed-evidence consumer uses real authenticated application/storage/PostgreSQL. Lower public workflow/QueryObserver tests are limited to otherwise hidden retry/cache/lifetime contracts.

The scaffold remains temporary and no designed pages/routing/visual redesign or #56 implementation is claimed. Current consumers retain the existing identity-scope remount boundary; future UI must preserve that hosting contract. No product/pilot readiness follows from this review.

## Verification and provenance

Reviewer directly executed against unchanged head `4b9a75c` / source `3a44d3e`:

- `npm run typecheck`: PASS.
- Pinned `git diff --check`: PASS.
- `npx vitest run apps/web/test/treatment-workflow.test.ts`: **3/3 PASS, 707ms** (one file). No database required.
- Direct source/test/diff inspection and original API-plan SHA256 readback: `82E186AF080DB25098E44EEA1B9B097122245C0447967E1D4827528162E64A6A`, still untracked/excluded.
- Inspected `.local-dev/issue-55-full-tests.log` source/start header and actual result **259/259 PASS,26 files,493.08s** at `3a44d3e`. This independently verifies the retained output, not a reviewer full-suite rerun.

Builder-reported/directly executed evidence in the implementation report: final serial browser24/24, full259/259, final type/lint/build/diff PASS; existing539.37kB/157.21kB gzip bundle warning. Reviewer did not rerun browser/DB/full-suite/lint/build, provision a DB, or inspect live mail/deployment/restore/pilot behavior. No reason to repeat those broad passing checks solely for review volume. Earlier concurrent-check browser runs23/24 and the account-conflict draft/teardown failures remain explicit: baseline isolated/onboarding and final current serial runs passed, but the timing cause is unresolved. The final pass does not erase those failures; there is no demonstrated new source defect from that evidence alone.

## Disposition and remaining checkpoint

No builder source fixes requested; therefore no fix-specific red/green cycle is pending. The same reviewer must read back the final evidence/handoff and reviewed source identity before publication. At this inspection the owner-ref append made workspace HANDOFF newer than the actual OS-temp mirror; builder has been told to refresh it at the required final checkpoint. Formal report/source review is complete, while final handoff/evidence reconciliation and publication are pending. No issue states, PRs or remote branches were changed by the reviewer.

Standards: 0 findings, no worst issue. Spec: 0 findings, no worst issue.
