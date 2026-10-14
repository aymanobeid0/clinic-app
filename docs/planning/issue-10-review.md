# Issue #10 independent review — 2026-10-14

Reviewer: coordinating root agent, separate from the sole patient_access_builder. Applied the requested Matt code-review instructions and Fowler baseline. The owner's single-reviewer override replaces parallel review agents; both axes remain separate.

Owner-confirmed base: `09fa41c531193c7f8e00e2756da3819c2ce48c8f`, merged PR #38. Reviewed head: `1d7dd68007ac2f8dcc55c8eea553312e2a0a7b80`. Pinned command: `git diff 09fa41c531193c7f8e00e2756da3819c2ce48c8f...1d7dd68007ac2f8dcc55c8eea553312e2a0a7b80`. Both refs resolve; the diff is nonempty. Commits: `40c76b8 Implement patient assignment and scoped clinical access (#10)` and `1d7dd68 Show readable patient access history attribution (#10)`. Later review/publication documentation does not change application code.

Sources: freshly verified GitHub #10 criteria/no comments, closed native blocker #9 and merged PR #38; AGENTS.md, issue-tracker.md, skill-integration.md, CONTEXT.md, spec-001-clinic-mvp.md, identity-access-decisions.md, clinical-decisions.md, mvp-scope.md, approved architecture/dependencies, identity-module-design recommendations and functional-only design scope. Current main remained the selected base before publication.

## Standards

Zero residual material findings. Identity centralizes actor readiness, current capabilities and patient grants within the same clinic-serialized transaction as consuming work. Doctor eligibility, manager authority and login method remain independent. The operational permission interface rejects clinical capabilities; the clinical interface supplies the checked clinic/account/patient context. Tenant-composite references, FORCE RLS, runtime non-owner checks and immutable history grants cover the three new tables. Routes/controllers/services/repositories retain approved responsibilities. TanStack Query owns server state; forms and pending commands remain in current-tab memory. Dependencies are unchanged.

Same-builder corrections were rechecked: candidate policy excludes staff with only doctor-only capabilities; readiness rules share one policy; both actual SSE consumers share one guarded transport helper; one per-application notifier connects patient/account/grant mutations after commit; initial abandoned streams do not register heartbeats. Unrelated formatter churn was removed. The small PatientUpdates alias retains existing module vocabulary while sharing the real notifier implementation; it does not introduce a new abstraction hierarchy.

## Spec

Zero residual material findings within the scoped #10 implementation. Managers and delegated assigners can select personal patient details without acquiring ordinary personal editing or clinical authority. Explicit multiple-doctor/staff assignment/sharing, removal, revision conflicts, immutable retry receipts and dated access history are persisted and demonstrated in French. Non-doctor managers cannot obtain clinical authority; doctor-managers need relevant capability plus active patient scope; staff cannot finalize. Current permissions, account restrictions and removals override prior grants on subsequent application requests. Assignment streams terminate after delegation revocation.

Same-builder fixes preserve an editor/pending command through candidate refresh failures, prevent switching patient targets during ambiguous/in-flight commands, identify the selected patient and removal target clearly, use role-neutral labels and show readable author/target names. Stable audit IDs and snapshots remain intact; history names are resolved through minimal clinic-scoped projections.

The owner delegated the clinical-content boundary choice to the coordinator. The chosen implementation proves clinical authorization at the public application transaction interface, using fictional Patient rows as consuming read/write/rollback fixtures. These are not clinical records or clinical HTTP endpoints. Actual charts, medical history, notes, documents and clinical-stream integration remain their originating tickets. Future consumers must filter records by the supplied clinic and patient context and verify their real endpoints; clinic RLS does not automatically supply patient-level filtering. No extra note feature or fake permission-probe endpoint was introduced. Historical-cutoff grants/views remain #18.

## Verification and limits

Root independently executed `npm test -- apps/api/test/patient-access.test.ts` on final committed head1d7dd68: 8/8 passed, 17.29 seconds. An earlier root run passed 8/8 in18.27s before the readable-history correction. Root inspected the pinned code/migration/test diff and independently checked final three-dot whitespace: pass. Root viewed desktop/mobile focused screenshots and confirmed selected patient, French controls, role-neutral grant labels and readable history attribution.

Builder-reported full HTTP execution on40c76b8: 45 tests/six files passed48.15s. After the final history projection change, builder reran the affected eight API tests successfully17.18s, all13 Chromium journeys35.2s, typecheck, lint and contracts/API/web builds. The other37 HTTP tests were not rerun after that projection-only correction. Root did not independently repeat full HTTP/browser suites or builds. The first strict normal-browser console assertion flagged the expected anonymous `/api/identity`401; the exception is restricted to that request, with other normal-flow warnings/errors failing. Deliberate aborted responses, candidate503 and stale409 are tested negative paths.

Evidence: issue-10-implementation.md; OS-temp clinic-access-desktop.png and clinic-access-mobile.png. Browser viewports1280x720 and390x844; screenshots capture the assignment region. Named Browser plugin/skill is absent; the approved repository Playwright path supplied rendered verification. No supplemental CUA application sign-in success is claimed.

Actual future clinical-content integration, historical version selection, production ingress/SSE, real mail, load/performance, backup restoration and clinical/legal real-data gates remain unverified. No production migration/deployment, live email or real patient data was used. Human review/merge remains required; no next ticket is authorized.

Standards: 0 residual material findings. Spec: 0 residual material findings for the recorded scope; future clinical endpoint integrations remain explicitly unverified.
