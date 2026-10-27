# #106 — Settled treatment share (A3)

Owner directly authorized execution in this chat on 2026-10-27, including publication, one builder and one independent combined Standards/Spec reviewer. No merge/#107/UI/production/live migration/real-data authorization. Owner's prerequisite merge confirmation accepted without inspecting PR109 or prior merges. Fresh `git fetch origin main` pinned base/comparison `4e22e4d432a174e6ee370495b847067f76dea94e`; branch `codex/issue-106-treatment-share`.

Current #106 body/comments/native blockers read using issue REST endpoints: open, no comments; native #104/#105 closed, no open blockers. Backend/shared-contract scope. Approved integration, ADR0002, financial/access contracts and architecture govern implementation.

## Skills and execution

Read actual repository `.agents/skills/implement/SKILL.md`, `tdd/SKILL.md` and supporting `tests.md`/`mocking.md`, `code-review/SKILL.md`, `handoff/SKILL.md`; PR source `C:/Users/ayman/.agents/skills/pr/SKILL.md`. Read AGENTS, HANDOFF, skill-integration, issue-tracker, CONTEXT, dependency/architecture/recovery documents and consultation integration/scope/ADR0002. Apply already approved authenticated HTTP with fictional PostgreSQL persistence seam, no new product interview. One independent reviewer covers both axes, overriding review skill fanout. Existing HANDOFF plus OS-temp mirrors overrides temp-only destination. UI/design/React, new discovery/spec/ticket skills and separate QA role unnecessary for this bounded approved backend change.

First new HTTP test failed 404 for absent treatment remuneration endpoint, then passed after implementation. Start records privately retain remuneration snapshot once in the clinical-start/charge transaction; general visit projections strip it, billing keeps public start facts only. No schema migration or second ledger. Missing settings retained explicitly as null; older starts without the field remain legacy_unsnapshotted, never assigned today's rate. Salary has null percentage share. Exact rational calculation reuses consultation arithmetic; effective allocations reuse common retained funds projection and original settlement/credit sources. Releases/refunds/reversals/approved reductions preserve frozen rate. Manager/concerned active doctor query uses existing financial patient/account scope; no remuneration in exports or retained cutoff snapshots.

## Direct builder verification so far

- Sandbox fetch denied `.git/FETCH_HEAD`; elevated fetch succeeded. GitHub reads failed connection; elevated read succeeded. Docker pipe denied; elevated ownership/port check succeeded. No credential-invalid inference. No PR109/prior-merge audit.
- Verified no listener/resource on55445 and no issue106 project. Created only `clinic-issue106-test` using existing pinned `infra/compose.test.yml`; inspected label and127.0.0.1:55445 binding on `clinic-issue106-test-database-1`. Explicit TEST_DATABASE_URL and CLINIC_TEST_PORT target55445. Sandbox preparation failed Prisma schema engine; elevated preparation applied existing39 migrations. Sandbox test confirmed EACCES to55445; elevated tests work. No ignored credential files read.
- First mixed-funds/start-rate test red404 then green1/1. Four focused treatment tests passed after correcting fixture table name and using a real receipt for payment reversal (credit-only allocations are not receipts). Currency test setup corrected to public400 currency-mismatch response, then passed1/1; fractional KWD unit and salary behavior proven. Adjustment chain passed alongside these checks. Not every assertion claims its own red cycle.
- Typecheck passed after building shared contracts. Lint initially found one unused destructured field; corrected. Required final checks and independent review pending below; no completion claim yet.

## Preservation

Owner changes `docs/api/apidog.md`, `docs/planning/delivery-status.md` and untracked `api-error-messages-review.md`/`api-validation-errors-plan.md` preserved and excluded. Stash4e97123b318d9c9797845a8e0d07a714e8e1288d untouched. No ERP/Apidog/manual resources,4173/4175 servers, owner DB55437 or real mail/data touched. HTTP Origin4173 is in-process configuration, not a server connection. Task DB removal follows completed verification and ownership recheck.
