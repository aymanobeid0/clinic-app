# Frontend logic gate review — #52–#59

Date: 2026-10-26, Africa/Bamako (UTC). Decision: **PASS WITH LIMITATIONS** for the frontend business-logic stage. No new blocking Standards or Spec finding identified in the inspected scope. This permits separately authorized next-stage planning; it does not certify completed UI, a usable connected clinic application, or production readiness.

## Scope and method

Owner requested review only, accepted PR101 as merged and expressly prohibited rechecking its merge. No PR merge/state request was made. Current GitHub #59 criteria and issue states were read directly: #52–#59 CLOSED; #60–#76 and #28/#29 OPEN. The initial GitHub connection failure was resolved by supported read-only escalation; no connection blocker remains. Project status was not reread or changed; prior Project evidence remains attributed to the implementation report.

Read `D:/clinic-app/.agents/skills/code-review/SKILL.md`, AGENTS, HANDOFF, skill-integration/tracker, architecture/dependency boundaries, recovery reconciliation, relevant Spec001 report/access/reliability clauses, reporting/export API contracts, #59 implementation/review records, and relevant requirement maps/final-review evidence for #52–#58. Applied Standards (including the skill's heuristic smell baseline) and Spec axes in this single review. Owner overrides multi-agent fanout; the prior builder and independent reviewer already completed their required roles. No new builder/reviewer roles were created. Implementation/TDD/design skills were skipped because this task neither implements nor designs anything.

Pinned comparison: `git diff 4412f3f0d97e3b6bc531a4a06ac021c88869ebb5...18f9303b06670b908023be0659ce66a100ab842f`. Both source commits in that range are #59 implementation/fix commits; the nonempty diff contains nine reporting source/test files. The broader historical frontend stage is not treated as newly implemented by #59. Publication head supplied by owner: `b1a527830ea8c5aa0412c3b3e45accc19c93f495`; its delta from tested source contains only HANDOFF and the two #59 reports. Direct working-tree comparison of web/API/contracts against tested source was empty.

Directly inspected reporting hooks/access/messages, browser scenarios and live-test source, shared query/command/identity/StrictMode lifetimes and full-suite log footer. Earlier slices were checked through their requirement/evidence maps and final review dispositions, not a fresh line-by-line audit of every #52–#58 source file. No test suite, browser, database, container, migration or production operation was run in this review. Code inspection and log reading do not constitute independent test execution.

## Standards

**0 new actionable findings** in inspected code. Query owns server projections and refresh; RHF owns transient forms; React owns private feedback and export receipts. No new shared UI state requires Zustand, and no server state or sensitive drafts were moved into a persistent store. Shared transport schemas remain reused; backend domain rules, tenant/patient authorization and financial reconciliation remain authoritative. Coarse frontend access hints only disable impossible operations; they are not an authorization boundary.

New messages use `reporting.messages.ts`. Hooks remain separate from product pages/routes/composition; test harnesses are verification consumers. No new dependency, persistence layer or speculative browser domain architecture was introduced. Prior Standards P3 (inline message boundary) is resolved in source; no additional refactor is justified for this gate.

## Spec and requirement coverage

**0 new blocking findings** in inspected behavior. The [implementation map](issue-59-implementation.md#requirement-mapping) traces #16/#26/#27 and approved amendments; the [reconciliation map](recovery-reconciliation.md#requirement-ownership) preserves later UI ownership.

| Gate | Covered responsibility and evidence boundary |
| --- | --- |
| R3 / #52 | Identity, sessions, accounts/recovery and confidential-cache retirement. [Mapping and pinned checks](issue-52-implementation.md); [final review](issue-52-review.md). Identity scope includes clinic/account/readiness/permissions/kind/authority/restrictions. |
| R4 / #53 | Patients, assignments and scheduling, explicit conflicts/overrides and draft preservation. [Mapping](issue-53-implementation.md), [resolved choice-search draft finding](issue-53-review.md). Earlier real-browser evidence is historical, not a fresh #59 rerun. |
| R5 / #54 | Clinical record/history and private attachment lifetimes. [Mapping](issue-54-implementation.md), [review](issue-54-review.md). Shared StrictMode lifetime retires real unmount/scope owners while allowing synchronous replay. |
| R6 / #55 | Catalog/treatment versions, acceptance and explicit workflow coordination. [Mapping/checks](issue-55-implementation.md), [review](issue-55-review.md). Record/treatment consumers participate in the reported shared browser gate. |
| R7 / #56 | Visit progression, note drafts/finalization/corrections and prescriptions. [Mapping/checks](issue-56-implementation.md), [review](issue-56-review.md). #59 exposes derived pending-note metadata without converting it into editable contact tasks. |
| R8 / #57 | Charges/credit/payment/document/correction coordination with exact currency values and current output authorization. [Mapping/checks](issue-57-implementation.md), [review](issue-57-review.md). No client recomputation of authoritative balances. |
| R9 / #58 | Inventory reads, whole-pack writes, revisions, expiry and uncertain retry. [Mapping/checks](issue-58-implementation.md), [review](issue-58-review.md). All 17 inventory consumers are included in the reported shared run. |
| R10 / #59 | Authorized reports, follow-up/history/manual sharing and private export lifecycle. [Implementation](issue-59-implementation.md), [sole independent review](issue-59-review.md). Final affected browser checks and one real-DB journey supplement broad mocked cases. |

Observed #59 behavior interfaces retain success, pending/busy, honest empty and failure states without invented totals or zero fallbacks. Financial activity and current due/credit/planned balances stay distinct exact server strings. Invalid dates/IDs suppress requests; historical-only/unready/capability-denied scopes suppress operations. Server denials clear confidential snapshots and reset forms through shared boundaries. Access remains server checked, including export delivery after revocation.

Follow-up writes require confirmation and supplied revision; uncertain retries retain the exact command/payload despite edited input. A selected-patient change retires that command. Conflicts invalidate current projections for explicit revision review; they do not silently rebase. Manual sharing is GET-only preparation, with no sending/provider/clipboard side effect. Pending-note identifiers cannot pass contact-task update UUID validation.

Account/scope changes hide stale feedback immediately, cancel reads/downloads and retire command ownership; A→B→A cannot resurrect an export receipt. This is client retirement, not a guarantee that an already submitted server write was cancelled. SSE invalidation/reconnect and UTC rollover refresh authoritative reads. Export delivery verifies size/hash before returning a private Blob; expiry and 404/410 allow regeneration, genuine denial locks the affected lifetime, and cleanup preserves a valid receipt. The prior four Spec P2 findings are resolved in inspected source and have targeted regressions in the existing review record.

## Evidence provenance

| Evidence | What this review can conclude |
| --- | --- |
| Vitest 259/259, 26 files, 578.68 s | Directly read `.local-dev/issue-59-full-tests.log` footer. Execution and exit0 remain builder-attributed. Existing API/unit inputs were unchanged; this suite does not import the new browser hooks and cannot establish their acceptance. |
| Shared browser 52/52 | Builder-recorded result before #59 review fixes across reporting and record/treatment/care/billing/inventory consumers. Not a final-source rerun of all eight stages. |
| Final affected browser 20/20 | Builder-recorded 19 HTTP-mocked rendered cases plus one authenticated session/CSRF/PostgreSQL task/share/export-revocation journey at final application source. Live-only 1/1 rerun addresses test teardown noise. This review inspected the scenarios, not their execution. |
| Independent final 19/19, 11.7 s; Standards0/Spec0 | Prior sole reviewer reports independent rendered execution and final source recheck after fixes. This is separate-reviewer evidence, not execution by this review. No independent full-suite/live/type/lint/build claim. |
| Final type/lint/build/diff checks | Builder-recorded passes with the documented source equivalence. Existing bundle advisory remains. No fresh execution here. |

## Findings, limits and follow-up

1. **Evidence limit, nonblocking for logic:** no single final-source connected browser journey spans all roles and #52–#59. Broad hook failures/races use mocked HTTP; one real journey does not prove every role/export category or financial invariant. Accept the bounded gate using per-slice evidence; require connected role/task/navigation, denied/conflict/retry/refresh and document journeys during #60–#76. API passes cannot be relabelled as UI acceptance. Do not retire the scaffold before #76 replacement coverage.
2. **Known recovery-message gap, nonblocking for this stage:** shared API Zod handling still returns generic `Requête invalide.` (`apps/api/src/middleware/errors.ts`). Hooks propagate server text; this proves neither truthful cause-specific wording nor helpful field guidance across failures. The [saved error plan](api-validation-errors-plan.md) correctly leaves the contract/correction unimplemented. Review actual triggering conditions, safe French wording and frontend recovery mapping before journey planning; preserve uncertainty, authorization concealment and exact retries. This review does not establish the cause of the owner's earlier onboarding error.
3. **P3 documentation currency:** HANDOFF and #59 publication paragraphs still say merge pending/open, while the owner confirms merge and current #59 is CLOSED. Those paragraphs are historical publication snapshots, not the present gate decision. They do not show missing implementation. This review leaves the specifically protected files/reports unchanged; reconcile current pointers in the next authorized documentation update without erasing provenance.
4. **Outside acceptance:** visual UI, responsive/keyboard/print quality, complete navigation and connected app acceptance remain #60–#76. Deployment/restore/pilot/legal/provider/live-mail/real-data gates remain separate; the bundle advisory is not resolved here. No production-readiness inference follows from passing this gate.

Next agreed work is separately authorized server-error review/correction under the saved plan, then [user-journey planning](post-59-user-journey.md) without visual UI details. Neither was started. No acceptance criteria, native dependencies, tracker/project records, stash, credentials, owner notes or existing service resources were changed. Only this review document was added.

Final axis totals: **Standards 0 new actionable findings; Spec 0 new blocking findings. Gate: PASS WITH LIMITATIONS.**
