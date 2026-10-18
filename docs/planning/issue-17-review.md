# Issue 17 independent review — 2026-10-18

Reviewer: root; sole builder: prescription_builder. The reviewer inspected code and ran independent checks; the reviewer did not implement application fixes.

Owner selected main at execution start: cd678de98b3cb4aeeb3114935e5ac87ee3e79634. Comparison: git diff cd678de98b3cb4aeeb3114935e5ac87ee3e79634...HEAD, with git log cd678de98b3cb4aeeb3114935e5ac87ee3e79634..HEAD --oneline. Final application: 8b4ebdfdcead5ba7d805ca60e19c2e9adefbfd22; documentation head inspected: d80a9779b9e8cc508904a514d15b5cc217c573d1. Subsequent review/delivery commits are documentation only.

## Standards

Zero residual material findings. Inspected feature boundaries, Routes → Controller → Service → Repository, transaction/lock ownership, clinic scope/RLS/runtime ownership checks, immutable clinical revisions, authorization and cache/form state boundaries. Applied the repository code-review skill's Fowler smell heuristics as judgment calls; no additional material smell warranted a finding. Preliminary private treatment-repository imports were replaced with feature-owned persistence; ordinary chart edits and suggestion confirmation now share a lock. Tool-detected line-ending failures were corrected separately.

Sources: AGENTS.md, docs/agents/skill-integration.md and issue-tracker.md, approved architecture/dependency and clinical/access contracts, CONTEXT.md, spec-001 and current live issue17. Read D:/clinic-app/.agents/skills/code-review/SKILL.md; the owner overrides two parallel axis agents with this single independent reviewer covering both axes. The per-ticket skill selection and handoff sources are recorded in HANDOFF.md and the implementation report.

## Spec

Zero residual material findings against the current nine acceptance criteria. The same builder fixed two pinned-review P2 findings: management could not retrieve references beyond the first100 (af828f1, HTTP101-reference regression), and a new blank prescription falsely claimed to be saved (8b4ebdf, initial-new browser assertion). Preliminary review also raised chart-lock alignment, scoped staff lookup, history-protected old-version printing, notification scoping/live completion, and preserving drafts when collapsing lazy sections; inspected the resulting fixes.

Prescription content has no medication reference ID/relation/lookup dependency. Clinical commands retain authors/finalizers/dates and corrections; issuance snapshots identity/template values. Printing reauthorizes and protects superseded history. Explicit supported categories alone generate pending suggestions; confirmation preserves existing chart findings and rejects drafts/stale versions. Manager reference access does not expose patient clinical content. The four approved local contract amendments copied into the branch match current GitHub criteria; unrelated owner edits were preserved.

## Independently observed verification

Root directly recreated only the dedicated fictional clinic-issue7-test Docker project (down/up), then npm run test:db:prepare applied all26 migrations from scratch successfully. Root ran npx vitest run apps/api/test/prescriptions.test.ts apps/api/test/clinical.test.ts: 28/28 passed in2 files,70.91s, exit0. This checked API1541948, unchanged by the subsequent UI-only8b4ebdf. Evidence: C:/Users/ayman/AppData/Local/Temp/clinic-issue17-review-api.log; migration execution is recorded in this chat's tool output.

Root directly checked the pinned diff/log, whitespace, strict UTF8 and absence of replacement characters in all45 changed files at d80a977. Root directly viewed the generated prescription print screenshot, with readable French patient/prescriber/date/actors/medicine/instructions/correction linkage and no unrelated workspace; retained copy: C:/Users/ayman/AppData/Local/Temp/clinic-issue17-print.png. Root inspected the browser assertions and source; root did not independently execute browser journeys.

Root directly read builder execution logs confirming full API113/113 at4fdf0e5 (before later cap/scoped-notification fixes), genuine full browser35/35 at1541948, focused browser3/3 after8b4ebdf's status-only change, and final typecheck/lint/build. Those executions belong to the builder, not the independent reviewer. Root's later28-test run covers the final API and cap regression. Exact paths, earlier red/green milestones and failure history are in issue-17-implementation.md.

## Failures and practical limits

Earlier full browser runs exposed real120/min request-budget regressions. The builder fixed redundant initial reads and scoped invalidation/lazy initial loading without weakening the limit; final coherent35-case run passed. A one-off CSRF403 cause was not established; subsequent affected and full runs passed without auth changes. On resume the disposable DB was stopped; supported restart and fresh migration succeeded. Initial GitHub sandbox connection failure resolved through supported escalation. An interrupted worker/approval attempt hit an account usage limit; no safety denial was bypassed. No current connection blocker remains.

Vite warns about a521.55KB minified SPA chunk (151.70KB gzip). Large histories, unbounded reference management lists and multi-user load remain unbenchmarked. Tests do not establish physical-printer output, assistive-device/axe certification, production proxy/SSE/restore behavior or qualified clinical/legal sufficiency. Existing historical-only denial remains; later historical snapshot delivery is not claimed.

Standards: 0 residual material findings. Spec: 0 residual material findings. Human review/manual merge remains required; no next ticket, production deployment, live migration or real patient data authorized.
