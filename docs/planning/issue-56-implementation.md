# Issue #56 — care progression, notes and prescriptions frontend logic

Owner authorization: originating chat explicitly requested closing #55 and opening this chat to implement #56 with Matt skills. Authorized through checks, independent review/fixes/recheck, local commits and PR publication. No #57, automatic merge or deployment. Builder: primary agent. Branch `codex/issue-56-care-logic`. Fresh fetched main/base and owner-selected review comparison: `c62917bb179e92fe9e3d9d65a8eac25106144ff2` (owner replied “fresh main” in this chat). Initial source `c3061aa7517498f87344ec38231af92afa7d3528`; review-fix/final source `8fb859acbd4a00585f22c74e903a49201c6f0b63`.

## Required preparation and skill provenance

Fresh discovery used this session's installed catalog and accessible `.agents/skills` directories. Actually read `.agents/skills/implement/SKILL.md`, `.agents/skills/tdd/SKILL.md` plus `tests.md` and `mocking.md`, `.agents/skills/code-review/SKILL.md`, `.agents/skills/handoff/SKILL.md`, `.agents/skills/codebase-design/SKILL.md` and `C:/Users/ayman/.agents/skills/pr/SKILL.md`. Also read installed `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` and `rules/rerender-dependencies.md`/`rules/async-parallel.md`. Sources chosen afresh for this ticket; no reliance on #55's skill checkpoint.

Procedures applied: observable vertical red/green tracers at approved rendered seams; regular typechecking; affected single-file/browser checks; stable source pin before final checks; full test suite at final source (the superseded initial run was stopped after review findings); one independent reviewer for both Standards and Spec with builder fixes and same-reviewer recheck; tracked compact handoff and actual OS-temp mirror before publication. Repository/owner override Matt review fanout and handoff temp-only destination. Standing owner publication authorization applies after completed checks/review. Prototype/frontend-design skipped because no new product UI or redesign; research skipped because settled contracts and approved seams exist; domain-modeling skipped because no terminology/ADR change. Codebase-design supplies interface/seam vocabulary, not another discovery interview.

Builder directly read live #56/#49/#15/#16/#17/#55 and comments (all empty), local recovery R7/reconciliation, Spec001, CONTEXT, skill integration/tracker, dependency proposal/architecture and approved clinical/access/financial/file amendments, plus design/tokens as reference. Direct native blocker CLI: #56 blocked by #55 CLOSED. Direct #51 backend gate CLOSED. Direct PR96 MERGED at `695fcb1f7f0f407e14dfedb3b66ad140662b1c2c` (published head `eac9b28ca674aad67e9721f9d2a3a4cd4c272819`), ancestor check passes. Direct PR97 MERGED at base `c62917b`, head `30554e8dcc0c0bd28f33293fb1e6bc58431c8ee9`. No issue mutations or dependency changes.

## Traceable scope and ownership

| Source | Frontend logic delivered / evidence |
| --- | --- |
| #56 / #49 / reconciliation | transport/query/form/command coordination outside visual consumers; scaffold remains temporary; no product pages/components/routes/backend/contracts/schema changes |
| Spec001 care progression and #15 | booked/walk-in multi-procedure selection, revision review, idempotent start retries, explicit individual completion and independent visit end; existing server billing transaction remains authoritative |
| Spec001 note/reliability and #16 | RHF free-text autosave, accurate feedback, immutable uncertain retries, explicit stale comparison/choice, retained finalization/corrections, pending notes after visit end, staff drafting without doctor finalization |
| #17 / clinical amendment | explicit chart suggestion targets and dentist confirmation; manual medication values, explicit independent add-to-reference action, copied prescription fields, retained issued/correction/print versions independent of reference list/template changes |
| Access/file/financial amendments | scoped reads/commands/print reauthorization, denied snapshot cleanup, no history/output bypass, no automatic chart mutation or financial action; unchanged authoritative backend rules |
| Spec001 reliability / #49 | current-tab drafts on transient failure, cancellation/late-result guards, StrictMode-safe lifetimes, account/clinic/permission remount and query cleanup; no persistent sensitive browser storage |

Deferred designed UI belongs to #66/#67/#74, pending-note task presentation to #73 and integrated coverage/scaffold retirement to #76. This ticket does not establish final visual, legal, operational or pilot acceptance.

## Interfaces and state

`useVisits` and `useVisitStartForm` own care commands, server read coordination, RHF selections and explicit revision rereview. Reviewed plan state retains revision identifiers only, while server plans remain in Query. `useCareQuery` supplies actual repeated scoped cancellable reads, optional SSE invalidation/reconnect and denied snapshot removal. `useChartSuggestion` owns parsing/command and chart reread; UI emits explicitly confirmed actions. `useMedicationReferences`, `usePrescriptionMedicine` and template hooks own scoped lookup, copied text and separate retry-safe reference writes; manual prescription work does not depend on lookup success.

Existing note/prescription editors retain distinct RHF workflows with shared `useClinicalDraftScope` for cancellable comparison snapshots in Query and StrictMode-safe ownership. They reset fields/feedback when scope changes and ignore old in-flight writes. Denial clears confidential draft/comparison state and blocks further commands until a fresh scope. Uncertain prescription retries validate the retained sent payload, not newer invalid fields. Finalize cannot bypass dirty/unsaved input through the hook interface. No new Zustand state is required.

`usePrescriptionPrint` retains the chosen immutable issued version in Query and reauthorizes that chosen revision (including current superseded status) before each print. DOM print classes and post-render timing remain private presentation concerns. Patient/list/print snapshots use the same scoped prefix, so denied authorization removes the affected cached clinical data.

## Isolation and failures

Sandbox Git metadata writes failed (`index.lock: Permission denied`); supported escalation fetch/branch succeeded, preserving local handoff and API plan. Docker pipe/CIM inventory was denied in sandbox; supported read-only escalation succeeded. Verified owner `clinic-issue7-test-database-1` stopped on55437; no other listener on55438/55439/3000/4173. Created only `clinic-issue56-test` on verified free55438. Direct inspect proved project label, loopback-only exclusive port and no persistent mounts. Applied existing38 migrations only there via `CLINIC_TEST_PORT=55438 npm run test:db:prepare` PASS. Owner database/manual resources untouched; no ignored credentials read.

One comments connector call used wrong parameter name; corrected `repo_full_name` succeeded. A sandbox browser attempt stayed at readiness and was stopped through its own session; an overlapping escalated launch failed because that test server owned4173. After stopping it, port inspection confirmed free and escalated browser execution succeeded. No credentials/connection defect inferred from sandbox failures. One extraction script used a wrong working directory and another selected an early return; corrected before typecheck/verification. UTF8/LF normalized touched files.

## Builder evidence (directly observed)

- Red: rendered StrictMode note-scope test retained previous patient's confidential text. Green after reset/late-result guards:1/1 PASS2.5s.
- Red: uncertain prescription retry remained stuck when newer form values became invalid. Green after retained-payload validation fix:2/2 rendered tracers PASS3.0s.
- Exploratory browser run:9/10 PASS1.3m; retained prescription preview disappeared after newer issuance. This was before stable source and concurrent source edits occurred; it is diagnostic, not final source evidence. Corrected chosen-version retention/reauthorization and post-render print timing; exact French prescription journey1/1 PASS12.0s (workflow6.7s).
- Rendered lifecycle/transient read set4/4 PASS4.3s: note and prescription scope isolation with late failures, unchanged uncertain retry payload,503 retaining tab input and404 removing unauthorized snapshots.
- Regular typechecks/lint passed, including both after review fixes at `8fb859a`; diffcheck passed (handoff CRLF normalization warning only).
- Initial stable source `c3061aa` affected browser12/12 PASS53.8s. Full suite started15:06:11 UTC, then builder stopped its own session after two independently confirmed findings required source changes. No full-suite result/pass is claimed for that interrupted run. Read-only process/port inventory confirmed no residual test runner/listeners; source stayed unchanged until stopping.
- Reviewer findings were each reproduced through a new rendered public consumer before fixes: shared reader stayed at initial data after another reader unmounted; direct form submission sent unreviewed revision2. Fixed last-reader-aware cleanup and handler-level changed/invalid guard. Same red/green tests each passed1/1 (2.5s and2.7s). Source commit `8fb859a` contains only those fixes and their tests. Final results at the unchanged fixed source are recorded below.

Approved seams reused: actual French authenticated application with real isolated PostgreSQL; minimal rendered test-only consumers for otherwise hidden lifecycle/late-response/read-denial contracts. No new test seam or private-helper tests. Existing application tests already cover concurrent starts/completions/note revisions, staff/doctor boundaries, RLS, reference rename/retirement/recreation/template independence, catalog outage, stale conflicts and print authorization. The full suite will verify them unchanged.

## Independent review and publication

One reviewer `/root/reviewer56` formally reviewed `c62917b...c3061aa`: Standards0 / Spec2, bothP2. Builder read the actual [review report](issue-56-review.md), not just the worker message. Reviewer directly inspected code, ran diffcheck and a public QueryClient/QueryObserver probe demonstrating lost shared invalidation. Builder reproduced both findings at the rendered seam and fixed them in `8fb859a`. Same-reviewer complete-source recheck: **Standards0 / Spec0 residual**, both initial findings resolved; no reviewer implementation edits.

Reviewer independently inspected the retained final full-suite source/start/end/EXIT0/result log and confirmed unchanged application/test source, then directly reran typecheck and pinned diffcheck PASS. That is independent output/source inspection, not a full-suite/browser rerun. Final evidence/handoff/mirror readback follows the evidence commit. No PR/push yet; standing publication authorization applies after that checkpoint.

## Final builder verification — fixed source 8fb859a

All execution below was directly observed by builder with application/tests unchanged from `8fb859acbd4a00585f22c74e903a49201c6f0b63` throughout. No source modifications after the review fixes.

- `CLINIC_TEST_PORT=55438 npx playwright test test/visits.spec.ts test/notes.spec.ts test/prescriptions.spec.ts test/care-workflows.spec.ts` from `apps/web`: **14/14 PASS53.7s**, serial without compiler/build overlap. Eight actual French authenticated application/PostgreSQL journeys plus six rendered intercepted-API/minimal-consumer regressions. Existing French tests are unchanged.
- `CLINIC_TEST_PORT=55438 npm test`: **259/259 PASS,26files,496.62s**, start15:12:24.5907084Z/end15:20:42.2262080Z, EXIT0. `.local-dev/issue-56-full-tests.log` records exact start/end source pin and output. Controlled outage/rollback scenario API error logs are not failed tests. Earlier stopped run remains separately in `.local-dev/issue-56-interrupted-tests*`; no pass claimed for it.
- After suite completion, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and empty application/test diff from8fb859a: **all PASS**. Build warning persists: client542.47kB/157.58kB gzip, above500kB advisory; no bundle optimization in this scope.
- Fresh main re-fetch unchanged `c62917b`. Direct live #56 OPEN/no comments/unchanged update timestamp, native #55 CLOSED. No issue/dependency state mutation. API plan still original hash/untracked/excluded.
- After all DB/browser checks, direct Docker inspect again proved issue56 project/55438/no mounts, then removed only `clinic-issue56-test` container/network. Owner `clinic-issue7-test` remains stopped with original status on55437. No resource or connection blocker remains.

Unrun: Linux verification wrapper/npm-ci, full unrelated browser suites, physical quota/restore/load/security/pilot/provider/legal gates. Existing lockfile/dependencies/contracts/backend were unchanged. Meaningful affected browser and complete Vitest/static/build checks above cover this frontend scope; no final UI or production acceptance is inferred. Read skill-integration/handoff/installed PR skill again before publication preparation; compact tracked handoff and actual OS-temp mirror must be hash-equal before opening PR.

Limitations: no final product UI, new backend behavior, schema/migration changes, deployment/live migration, real patient data, live mail/provider, backup restore, legal/clinical validation or pilot acceptance. Preserve unrelated untracked planned-only API plan unchanged/excluded (SHA256 `82E186AF080DB25098E44EEA1B9B097122245C0447967E1D4827528162E64A6A`).
