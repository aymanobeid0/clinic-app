# Current handoff

Updated 2026-10-25 UTC. Earlier evidence: [history index](HANDOFF.history-2026-10-25.md).

## Scope and pins

Owner explicitly authorized this chat to implement #58 through proportionate checks, one independent Standards/Spec reviewer, fixes/recheck and push/PR. No merge, #59, production operation, real mail or patient data. Final product UI remains deferred. Follow [AGENTS.md](AGENTS.md) and [workflow](docs/agents/skill-integration.md); prioritize usable delivery and minimal time/tokens.

Branch `codex/issue-58-inventory-logic`; fresh fetched main/owner-selected comparison `ba12e8aa2749862cab582218be7ab1ced8e65012`. Initial source `947e897d785770f584835ef3a5f98580476b8b98`; review-fixed source `91d343dbccd27c8fe0b35bb1f4712f6aa977f39d`. Existing authorized #57 completion/fresh-main tracking edits preserved separately in original `6cd7a8d`, cherry-picked as `8a047b1`; not attributed to inventory implementation. #57 is owner-confirmed merged PR99 and directly CLOSED/COMPLETED, Project Done; no redundant service merge check. #50-#57 complete.

## Delivery and evidence

#58 exposes scoped stock/receiving/movement/settings reads and RHF item/supplier/settings/receive/consume/reasoned correction commands, exact uncertain retry and invalidation, server errors, independent capabilities, transient drafts and UTC-midnight refresh. Reuses contracts/transport/query/StrictMode-safe command lifetime. No backend/contracts/schema, product components/pages/routes or main-app composition changes. UI belongs to #71/#72/#60; final coverage/scaffold retirement #76. Details, exact skill sources/procedures/overrides and provenance: [implementation](docs/planning/issue-58-implementation.md), [review](docs/planning/issue-58-review.md).

Builder observed final affected browser17/17 PASS14.5s at fixed source, post-fix type/lint/build and diffcheck PASS. One independent reviewer `/root/reviewer58` independently16/16 PASS13.7s, Standards0/Spec1 P2: retry409 left stock stale. Builder adopted failing regression/fixed; same reviewer independently17/17 PASS13.8s with Standards0/Spec0 unresolved. Full Vitest directly259/259 PASS26files,556.45s, EXIT0, start20:15:45 UTC against isolated55438; log `.local-dev/issue-58-full-tests.log`. Its existing inputs are unchanged by browser-only correction; do not imply full-suite checked the new hooks. Initial sandbox test-first attempt never executed; no fabricated red provenance. The review correction has independently reproduced red and builder green.

Known limits: browser HTTP boundary mocks, no new live inventory journey or final UI acceptance; backend real-DB invariants covered by existing full suite completed. Existing bundle advisory542.62kB/157.64kB gzip; optimization explicitly deferred. Operational/legal/provider/pilot gates remain separate.

## Tracker and safety

Direct live #58 OPEN/no comments; native blocker #52 CLOSED/COMPLETED, prerequisites present in fetched main. Project moved Backlog to Building. After checks/recheck: push/open human-review PR, attach and verify head/base/state, then Project Review. Close/Done only after owner-approved merge. No changes to other criteria/dependencies.

Only disposable `clinic-issue58-test` on verified free127.0.0.1:55438 created; project/service labels, binding/no mounts inspected before existing38 migrations/runtime preparation. Owner `clinic-issue7-test-database-1` remains stopped55437 and untouched; preserve ERP/Apidog/manual resources. Ownership/port/no mounts reverified after checks; disposable issue58 container/network removed; owner issue7 directly remains stopped55437. No ignored credentials read. GitHub/Git/Docker/browser sandbox failures resolved by supported escalation; no current connection blocker.

Preserve excluded untracked planned-only `docs/planning/api-validation-errors-plan.md`, SHA256 `82E186AF080DB25098E44EEA1B9B097122245C0447967E1D4827528162E64A6A`. Established mirror `C:/Users/ayman/AppData/Local/Temp/clinic-app-HANDOFF.md` must refresh/hash-match before PR.

Next: final same-reviewer evidence checkpoint, then push/open PR under existing authorization. Suggested skills: already-read repository Matt implement/TDD/code-review/handoff and installed PR guidance. Reuse this ticket's stable context; do not start #59.
