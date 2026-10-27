# #104 — Standalone consultation entry (A1)

2026-10-27. Owner explicitly approved the four-ticket breakdown and starting A1 in this chat. Published #104–#107, native blockers and additive UI criteria per [tracker preparation/evidence](consultation-tickets/README.md). #104 current body/comments and native #51 blocker read directly; comments empty. #51 is closed and its PR90 merge82ba552ed6a56cee453c3624316382776852c151 is an ancestor of the implementation base. No redundant PR101/103 merge audit. #104 Building; #105–#107 Blocked pending prerequisite human merges.

Branch `codex/issue-104-consultation-entry`, base/user-selected latest-repository comparison `44cedc2df5a934bdf3737ecf7ef288fe89416e7f`. User supplied this comparison preference during implementation. Reviewed/tested source pins and independent review disposition will be recorded before publication.

## Delivered boundary

Consultation identity, exact default/authorized agreed price and optional appointment; explicit clinical room entry creates a real encounter and one charge in the existing ledger. Default/doctor remuneration settings retain dated revisions; entry freezes the configuration. Public visit command adds accepted treatment to that open encounter. Consultation completion is independent from encounter/procedure completion; existing notes/pending/finalization/corrections are reused. Charge outputs have a consultation source with null plan/item IDs, and reports/export/cutoff snapshots reuse authoritative billing projection. Rate snapshots are omitted from ordinary consultation, billing, clinical history and export output; protected manager/concerned-doctor query exposes the frozen rate with zero recognized share on this unpaid path.

This is the approved unpaid A1 slice. Generic treatment payment/corrections cannot operate on consultation charges before the dedicated A2 path is implemented; this prevents partial payments or bypassing source-linked share recognition. #105 owns full consultation payment/reservations/refunds and immediate share; #106 owns settled treatment share; #107 owns frontend business logic. No product UI, payroll, production/live migration or real-data acceptance claimed.

## Skill checkpoint

Fresh #104 selection: actual repository `.agents/skills/implement/SKILL.md`, `tdd/SKILL.md` plus `tests.md`/`mocking.md`, and `code-review/SKILL.md`. Read AGENTS/HANDOFF, skill-integration/issue-tracker, current issue, accepted consultation amendment/ADR/glossary and relevant architecture/dependency/recovery/access/financial contracts. TDD reuses the already-approved authenticated HTTP with real isolated persistence seam; literal expected amounts come from the500/40% example. Initial test failed404 on the absent public remuneration command; implemented the path, then broadened observable workflow regressions. This is not a claim that every assertion had an independent red cycle.

Ticket preparation used actual repository `to-tickets/SKILL.md`; explicit step4 breakdown approval obtained before publishing. Owner's layer order overrides including UI in each tracer slice. Read `handoff/SKILL.md` and `C:/Users/ayman/.agents/skills/pr/SKILL.md` before handoff/PR; repository overrides temp-only handoff and verbose PR format. One builder (root) plus one independent reviewer covering both Standards and Spec replaces review fanout. No new grilling/domain decision/architecture refactor needed. UI/design/React skills skipped: no frontend implementation in A1. No separate QA role; builder runs actual checks, reviewer independently inspects/verifies.

## Builder checks and resources

Docker inspection found only existing ERP services and stopped owner clinic-issue7 DB55437. Created task-owned Compose project `clinic-issue104-test`, container `clinic-issue104-test-database-1`, port127.0.0.1:55444 using the pinned existing PostgreSQL image and fictional test credentials. Inspected Compose ownership label and port binding before preparing. No existing ERP/Apidog/manual resources or4173/4175 servers touched. HTTP tests use in-process Supertest; the Origin4173 string does not start or contact that server. New migration applied only to this disposable fictional DB; no production/live migration.

Initial sandbox DB connection failedEACCES; supported elevated preparation/test retry succeeded. GitHub CLI network read initially failed in preparation; elevated read retry succeeded. No unresolved connection/authentication failure inferred. No credentials copied from ignored files.

Directly observed checks so far: new first public test red404 then green; focused consultation suite5/5 green before further note/appointment assertions; typecheck and lint passed at that working tree. Generated Prisma client and OpenAPI artifact. Expanded focused/shared regressions and final required full suite are pending at this source checkpoint; final results must replace this pending statement before PR. An execution log containing an intentional error-path test does not establish an unexpected failure without its assertion/result.

## Preservation and next gate

Owner's pre-existing accepted planning/glossary/spec amendment is relevant input, not newly invented behavior. Separate owner Apidog addition and unrelated error-planning files remain unstaged. Original stash4e97123b318d9c9797845a8e0d07a714e8e1288d untouched; no reset/checkout/pull/merge of dirty work. Update concise HANDOFF and its OS-temp mirror before PR. Independent review/fixes/recheck still required at this checkpoint. Human reviews/merges; #105 implementation cannot start before #104 is merged.
