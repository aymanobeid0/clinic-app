# Issue #59 — reporting, follow-up and export frontend logic

Owner authorization: scheduled one-shot run, 2026-10-26 00:00 Africa/Nouakchott/UTC. One builder and one independent Standards/Spec reviewer; fixes and same-reviewer recheck, push/PR authorized. Human merge and all later work remain separate.

Final application/test source pin: `18f9303b06670b908023be0659ce66a100ab842f`. Initial source and review history below provide provenance; this pin includes all fixes.

## Sources and scope

Fresh fetched main/comparison: `4412f3f0d97e3b6bc531a4a06ac021c88869ebb5`, also directly verified PR100 merge commit. Branch `codex/issue-59-reporting-logic`; initial source `d7958accbeefb22992053a4ba6e11d48448fc6b1`. Live #59 and original #16/#26/#27 requirements read; native blockers #56/#57/#58 directly CLOSED. Direct issue/project reconciliation: #52–#58 CLOSED/COMPLETED and Done; #59 OPEN/Building. No criteria or dependencies edited.

Read AGENTS/HANDOFF/workflow/tracker, CONTEXT, recovery reconciliation, relevant Spec001/access/file amendments, architecture/dependency proposal, reporting/export contracts and existing query/command/identity lifetime interfaces. Read both current owner future-work notes: API wording remains planned; journey planning follows that separately authorized correction, not this implementation.

Selected/read exact skills: `D:/clinic-app/.agents/skills/{implement,tdd,code-review,handoff}/SKILL.md`, TDD `tests.md`/`mocking.md`; `C:/Users/ayman/.agents/skills/pr/SKILL.md`; `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` and `rules/rerender-dependencies.md`, `rules/client-event-listeners.md`. Applied existing approved rendered public-hook/HTTP/PostgreSQL seams, targeted red/green slices, required checks and fixed comparison review. Owner overrides two-reviewer fanout and temp-only handoff; TanStack Query retained rather than introducing SWR. Discovery/spec/ticket/prototype/design/research skills skipped: scope/contracts/seams settled; no visual design, dependency or domain-model change.

## Requirement mapping

| Contract/source | Delivered interface and behavior |
| --- | --- |
| #26, Spec001 reports/financial amendments | `useReport`: appointments/date, financial/date, stock, tasks, history and manual share. Shared response types retained verbatim: exact currency strings; new money, credit applied, opening entries, signed adjustments, refunds/reversals/invoices and current due/credit/planned balances remain distinct. No client aggregation, fabricated zeros or substitute data. |
| Access matrix/file amendment | Coarse current-account capability hints; server retains clinic/patient/own-work/content authorization and redaction. Manager financial exception; configurable operational/inventory/patient output; historical-only denied. Scope keys include clinic/account/readiness/permissions. Denied reads cancel siblings and remove confidential snapshots through the existing shared boundary. |
| #16/#26 pending notes and contact tasks | Task list retains separate derived pending-note metadata. RHF create/update commands validate shared schemas, require explicit confirmation, carry revisions and exact-command uncertain retry. Conflicts refetch authoritative state/history for explicit review; no automatic revision rebase. Pending-note IDs cannot be edited as UUID contact tasks. |
| #26 manual sharing | Authorized share GET returns the server's French manual text. No provider, mail, automatic sending, delivery status or browser clipboard side effect. |
| #27/file export contract | `useExport`: transient RHF selections, explicit generation, exact lost-response retry, private receipt, expiry, cleanup and explicit verified-Blob retrieval. Reauthorizes each download via server; SHA256/size checked before returning bytes. No public URL or browser object URL retained. CSV/JSON/ZIP selections reuse the existing discriminated schema; no backend/contracts/schema changes. |
| #49 behavior gate | TanStack Query owns reads; RHF owns drafts; React owns private feedback/receipt lifetime. No genuinely shared UI state required; existing Zustand boundary preserved. SSE invalidations/reconnect refetch, cancellation, UTC stock/current-balance refresh, StrictMode and account/patient transitions handled. No persistent sensitive storage. |

## R3–R10 frontend behavior gate

This is a logic-layer gate for later owner review, not final product delivery or UI authorization. Direct current issue/project states are reconciled above. Existing per-ticket evidence remains authoritative for previously delivered work; no claim that the new mocked suite reruns every earlier real journey.

| Round | Existing boundary/evidence | Current gate evidence |
| --- | --- | --- |
| R3/#52 | Identity/session/accounts/recovery; [report](issue-52-implementation.md) | Existing identity scope and cache retirement reused; full Vitest includes workflow/API regressions. |
| R4/#53 | Patient/access/scheduling; [report](issue-53-implementation.md) | Existing public feature hooks retained; authenticated API/workflow tests in full Vitest; earlier browser evidence remains in report. |
| R5/#54 | Historical records/attachments; [report](issue-54-implementation.md) | Existing record-workflow browser consumers rerun in current gate. |
| R6/#55 | Treatment/catalog/acceptance; [report](issue-55-implementation.md) | Treatment-workflow StrictMode, cancellation and late-scope consumers rerun. |
| R7/#56 | Visits/notes/prescriptions; [report](issue-56-implementation.md) | Care-workflow draft, uncertainty, denial and shared-reader consumers rerun. Pending-note task metadata now exposed through #59. |
| R8/#57 | Billing/documents; [report](issue-57-implementation.md) | Billing-workflow currency/debt/credit, output authorization and stale-sibling consumers rerun. |
| R9/#58 | Inventory; [report](issue-58-implementation.md) | All17 existing inventory workflow cases rerun. |
| R10/#59 | Reports/follow-ups/manual share/exports | New rendered consumers plus authenticated real-DB journey; final results below. |

Final designed UI/components/pages/routes/main composition and connected role journeys remain #60–#76. Scaffold retirement, operational restoration, pilot/legal/provider gates and bundle optimization remain outstanding. This ticket does not certify a usable final clinic UI or production readiness.

## Verification and review ledger

Builder directly observed initial report tracer RED (missing hook), then GREEN1/1; follow-up tracer RED (missing hook), then GREEN2/2; export tracer RED (missing hook), then GREEN3/3. Initial root npm grep forwarding/sandbox readiness attempt was stopped; second attempt found our first server's occupied4173; supported configured workspace execution succeeded. Later accidental root Playwright invocation lacked workspace configuration and was stopped, not counted as behavior red. Its generated root test-results directory was path/reparse checked and removed.

Expanded suite initially12/14: one actual delivery403 feedback defect fixed with local denied state; one update fixture had an empty registered optional date, corrected to the task's actual due date. Then14/14 PASS12.7s. At initial source, builder directly observed52/52 PASS37.8s across reporting16 plus record/treatment/care/billing/inventory workflow consumers. Typecheck/lint/build PASS; existing bundle advisory542.62kB/157.64kB gzip remains deferred.

Independent reviewer `/root/reviewer59` covers both axes. [Review report](issue-59-review.md) records Standards1/P3 message boundary and Spec4/P2 patient command scope, receipt A→B→A resurrection (builder discovered, reviewer confirmed), cleaned artifact404 recovery, and preserving a valid receipt during expired-artifact cleanup. Builder fixes all; public regressions retained. Reviewer independently observed focused404 recovery1/1 PASS4.5s on working-tree fix; no failing-red claim because the fix preceded that execution. Same-reviewer recheck and final pins/results are recorded below.

Full Vitest launched once against verified disposable55438; its existing source/test inputs are unchanged from fresh main, including during subsequent browser-only fixes. This is baseline API/unit regression evidence, not coverage of the new browser-only hooks. Direct result:259/259 PASS,26files,578.68s,EXIT0,start00:07:50 UTC. Log `.local-dev/issue-59-full-tests.log`. Controlled rollback/failure-scenario logs are expected test evidence, not failed assertions.

## Preservation and safety

Owner's five local documentation files were captured unchanged in stash `4e97123b318d9c9797845a8e0d07a714e8e1288d`, then restored on the new fresh-main branch. The stash is retained. API guide/delivery-status edits and both untracked planned-only notes remain separate from #59 source and PR. Required HANDOFF is updated for this run; its prior owner context is recoverable in that stash and retained semantically. Current preserved SHA256: API-error plan `C98D5BF701F311B52EF5B9418A8F44C46F8D8FEDE1C06EFD5BC9308EEA3B8A1D`; journey note `97C2E7D93000736926605B4000F22983A05CCEE6609A8A963E5A75DFF392844E`; Apidog `20A3470AA04322584362068370C84A05CC9941AF2FD163C71757984FCF0AE7AB`; delivery-status `5F06D8A7010AB5E2871E88DAD1AF8333EFE431632F619312DE285CC60F8BA468`.

GitHub CLI initial connection failed; supported escalated read succeeded. Git index sandbox writes denied; supported escalation preserved notes and created the authorized branch. Docker sandbox socket denied; read-only escalation succeeded. Direct inventory showed owner issue7 stopped55437 and no55438 listener. Created only `clinic-issue59-test-database-1`; inspected project/service labels,127.0.0.1:55438 binding and empty mounts before existing38 migrations/test writes. ERP/Apidog/manual resources untouched. No ignored credentials read, real mail/patient data, production or live migration used. Disposable ownership/port/no mounts reverified after checks; only issue59 container/network removed. Direct readback confirms owner issue7 still exited55437. Mirror/publication pins follow below.


## Final builder checks

At application source matching `18f9303b06670b908023be0659ce66a100ab842f`, directly observed `CLINIC_TEST_PORT=55438 npx playwright test reporting-workflows.spec.ts reporting-live.spec.ts` from `apps/web`: **20/20 PASS17.6s** (19 rendered HTTP-boundary cases and one authenticated session/CSRF/real-PostgreSQL journey). The journey creates a real fictional contact task, reads manual sharing, generates an inventory export, revokes its capability and proves delivery is denied. Its first passing run logged a report-stream teardown error while the API/database closed; test teardown now navigates away before shutting services. Live-only rerun at exact final pin: **1/1 PASS6.1s**, no stream teardown error. No runtime workaround was introduced. This small real journey does not re-prove every role/category/financial invariant; existing authenticated API/full-suite evidence supplies those invariants.

Final typecheck/lint PASS at final source. Build PASS at identical application source; existing bundle advisory unchanged. `git diff --check` PASS and application/test diff from final pin empty. Full Vitest inputs unchanged from fetched main throughout its single completed run; final browser checks cover new hook code. No redundant full backend rerun for browser-only review fixes.

Source review disposition and independently executed final checks: see the sole reviewer's report. Owner accepts/merges manually; no next ticket started.
