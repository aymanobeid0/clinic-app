# Consultation implementation scope

Prepared 2026-10-27 after owner approval of [the integration contract](consultation-integration.md#approved-integration) and agreement to prepare execution scope. **Local planning only:** no coding, published tickets, issue-body changes, dependencies, migrations or service operations authorized. [ADR0002](../adr/0002-standalone-consultations-shared-care-and-billing.md) records the direction; reuse its decisions rather than another interview.

## Delivery sequence

Two behavior stages precede final UI binding. These are proposed execution scopes, not new GitHub issue numbers or authorization to start them. Each authorized implementation uses one builder and one separate Standards/Spec reviewer; no role fanout. Keep the approved modular monolith and Query/RHF/React/Zustand boundaries.

### A — Backend and shared contracts

Deliver one coherent application-facing consultation capability without requiring a treatment plan:

| Responsibility | Scope / existing seam |
| --- | --- |
| Consultation identity and settings | Patient, responsible doctor, agreed exact price/currency, optional appointment, retained lifecycle/revision. Shared default price with authorized individual override. Manager-controlled remuneration mode/rate for the doctor; salary amounts/payroll are outside scope. Reuse identity/clinic/financial capabilities and explicit patient grants. |
| Recorded room entry and encounter | Explicitly record entry and create/use the clinical encounter. At entry, create the consultation charge once; previously paid funds cover it without new debt. Permit adding/starting accepted-plan treatment in that open encounter without a forced end/start; keep individual procedure completion and encounter end separate. Reuse clinical note/pending/correction lifecycle. |
| Payments and reserved funds | Full-only optional consultation payment, allowed before entry. Existing receipt with consultation-specific funding link/reservation, excluded from freely spendable credit. Reuse shared ledger/settlement/refund/correction machinery; do not create a second finance system. Narrow ordinary-doctor pre-entry funding access to their designated consultation, not generic deposits. |
| Rate and doctor share | Freeze consultation rate at first payment/room-entry event; treatment rate at start. Immediately recognize paid consultation share, even before care; no second recognition on entry. Treatment follows settled provided-care basis. Exact, currency-separated source-linked calculations, including existing credit once and normal corrections/refunds once. Manager and concerned doctor only; no salary payouts or silent zero for missing settings. |
| All existing consumers | Extend authoritative charge projection/types rather than fake plan/item IDs. Keep patient balances, receipts, ordinary treatment eligibility, reports, exports, retained history and cutoff snapshots coherent with the new source. Compensation data must not leak through staff financial reports/files/exports. Consultation payment receipt is agreed; no new consultation invoice feature is implied. |

Primary inspected seams: shared contract index/reporting types; treatment visit service/repository and atomic procedure-start orchestration; clinical note/pending-task resolution; billing projection/funds/service/report/public index; identity financial/clinical scope; scheduling links/settings. [Exact evidence](consultation-integration.md#current-facts-and-reusable-seams) avoids rediscovery. Schema changes may be needed, but no migration execution is authorized by this scope note.

**Backend acceptance:** public authenticated commands/queries can perform both monetary sequences below, same-encounter treatment and pending-note flow using isolated fictional data. Existing financial/clinical/output invariants continue to pass. Shared output types/OpenAPI document the actual new behavior. No unreviewed UI or phantom plan is needed to exercise the capability.

### B — Presentation-independent frontend logic

After A's reviewed behavior is available, expose consultation query/form/command interfaces for search/select/register handoff, optional appointment, agreed price, actual full payment, explicit room-entry/start, same-encounter treatment, note completion and authorized share/settings reads. Reuse existing patient registration/assignment interfaces; consultation creation never fabricates clinical access.

TanStack Query owns scoped projections/refresh; RHF owns current-tab input; React owns private command/output feedback; Zustand is for genuinely shared local UI state. Reuse server contracts and current uncertainty/denial retirement. Distinguish unpaid booking, paid-before-entry, debt-after-entry and paid-after-entry; rate/share values are authoritative server data. All reads/forms have honest loading/empty/validation/failure/denied/conflict states, and consequential retry retains the exact command/path/payload. Scope change retires old drafts/results. No designed components/pages/routes, persistent sensitive state or inline domain arithmetic.

**Logic acceptance:** meaningful rendered hook consumers prove the states/actions, including changed inputs during uncertainty, stale revisions, identity/patient changes and current output authorization. At least one connected fictional API journey verifies the new backend/logic integration; mocked cases remain identified as mocked. This is not final page acceptance.

## Existing UI ownership and tracker preparation

Current GitHub bodies read directly on2026-10-27: #59 CLOSED; #60/#65/#66/#69/#70/#73/#74/#75/#76 OPEN. Their bodies remain UI scopes; none silently owns A/B. Keyword searches returned no matching consultation/commission/remuneration issues or PR titles, not exhaustive proof of all historical work. Missing implementation is established by the inspected code contracts, not open-issue status. Owner-confirmed PR101/PR103 merges were not rechecked. Project items and native dependency graph were not reread or changed.

| UI owner | Later binding / proposed criteria reconciliation |
| --- | --- |
| #60 | Shared shell, approved role starts/navigation/auth and personal blue/teal settings entry. Use owner-supplied `D:/clinic-visual-system`, not the old reference implicitly selected by the ticket title. Borderless content/appointment cards per owner. No backend/share rules hidden here. |
| #65 | Appointment details/booking and consultation modal, optional appointment linkage and doctor-agreed walk-ins/day list. |
| #66 | Patient visits/notes, recorded care entry, consultation and accepted treatment in one encounter, pending notes. |
| #69–#70 | Patient payment/charge/receipt, dedicated consultation funding and existing authorized correction/refund journeys. Preserve original invoice/summary requirements without inventing a consultation invoice. |
| #73 | Current-authority report/export projections and manager/concerned-doctor remuneration view. No expanded BI, arbitrary period reports or payroll. |
| #74 | Authorized default consultation price and doctor remuneration configuration; other-user account/permission administration remains manager-only. |
| #75 | Preserve cutoff-bound permitted history/own-work finances and output restrictions; no new active compensation-report access for historical-only accounts. |
| #76 | Connected multi-role replacement coverage, including the new consultation sequences; scaffold retirement only after real-page replacement. |

Before executing or publishing tickets, prepare the A/B tracker scope and affected acceptance/dependency additions for owner review, preserving existing native edges and completed #52–#59 evidence. Do not reopen those completed stages merely because the approved product scope grew. The current #60 body lists #59 as its blocker; new A/B work must be tracked explicitly before relying on the new capability. No remote changes were made here. Final UI tickets still need their own authorization/current criteria and visual/keyboard/responsive/French verification.

## Focused verification scenarios

1. **Payment first:** consultation500/rate40%, record actual full payment → one receipt500/share200 immediately, no unpaid debt. Funds cannot pay another charge. Change rate50%; record room entry → no second receipt/share; frozen40% remains.
2. **Entry first:** consultation500/rate40%, enter unpaid → due500/share0. Change rate50%; pay500 later → due0/share200, retained40%. Repeat/concurrent commands do not duplicate any effect.
3. **Existing/new patient and visit continuity:** register or select patient, consultation without a plan/appointment, explicit access grant where needed; consultation → accepted treatment in same encounter; procedure charge once, encounter/note not duplicated, completion independent.
4. **Notes/history:** end with draft, find pending note, finalize/correct with originals retained. Historical cutoff excludes later changes. No forced finalization merely to end care.
5. **Authority:** manager and ordinary doctor own consultation; restricted reception finance; non-doctor manager clinical denial; no general deposit authority granted to doctors; share hidden from staff and unrelated doctors, including direct/report/export paths. Disabled/historical restrictions remain.
6. **Money/corrections:** reserved-fund isolation; exact enabled currency; full-only consultation versus existing treatment installments; old credit plus new money counted once; approved refund/reversal/release correct source/share once with original frozen rate. No free-credit overspend or retrospective current-rate rewrite.
7. **Consumers and failures:** patient due/credit/planned projections, reports/export/history/document authorization remain correct; scope changes, stale revisions and unknown outcomes produce truthful states and exact safe retries, not fake success/zero data.

Use existing authenticated HTTP/persistence seams, focused rendered consumers and necessary shared regression checks in proportion to changed financial/clinical behavior. Broader regression is justified by a shared ledger/projection change; run it after relevant source stabilizes. Review against a pinned comparison, fix findings and have the same reviewer recheck. These are future acceptance requirements, **not tests run by this planning task**.

## Planning provenance

Based on accepted grill-with-docs/domain model, prior read-only factual-worker report and the live issue reads above. No new to-spec/to-tickets/implementation workflow invoked: this is a local execution-scope note, not a replacement product spec or ticket publication. No additional agents, branch switch, stash, application edit/test, DB/service, credentials, production, tracker write or PR operation. Actual checks: documentation diff and local file links only; no connection failure encountered.
