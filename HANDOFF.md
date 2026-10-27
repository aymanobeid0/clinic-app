# Current handoff

Updated 2026-10-27 UTC. [Earlier history](HANDOFF.history-2026-10-25.md).

Current execution chat: [four concrete consultation ticket drafts and live dependency/UI reconciliation](docs/planning/consultation-tickets/README.md) prepared under the owner's A→B authorization. Matt to-tickets step4 requires approval of this new breakdown before publication; owner question pending. Product contract is settled; no new grilling. Current GitHub/native/project reads succeeded after elevated CLI retry. #59 was CLOSED but project Review: corrected/read back Done using owner-confirmed prior merge. No consultation ticket/body/dependency publication or application implementation yet. Existing owner changes/Apidog/stash preserved. Next: approve breakdown, publish native edges, start A1; prerequisite human merges still gate dependent work.

## Scope and evidence pins

Latest owner authorization2026-10-27: **create a new chat to complete consultation logic using Matt skills**. The new chat should carry accepted scope A (backend/contracts) then B (presentation-independent frontend logic) through the applicable ticket/preparation/implementation/review workflow. This sending chat only prepares the handoff; no product UI, human merge bypass, production/live migrations or real data authorized. Prior planning did not authorize execution; this latest direct instruction does. Branch at handoff `codex/error-guidance`, inspected HEAD `09b947f`; reviewed prior application source `23e4800372ccb676c5234418fac0b74d927224cd`; prior #102 comparison `b1a527830ea8c5aa0412c3b3e45accc19c93f495`.

Completed grill-with-docs, final owner “ok”2026-10-27: [approved integration/evidence](docs/planning/consultation-integration.md#approved-integration), [accepted ADR0002](docs/adr/0002-standalone-consultations-shared-care-and-billing.md). Paid consultation enters share immediately; unpaid debt only at recorded room entry; rate frozen at earlier payment/entry, no duplicate receipt/share. Funds consultation-dedicated; same encounter may continue accepted treatment. Manager/own-doctor visibility and normal refunds. Treatment retains provided-care/settled basis/start-time rate. Planning gap resolved, implementation still pending and separately authorized. No application/service actions.

Execution basis: [A backend/contracts, B frontend logic, then separately authorized UI bindings](docs/planning/consultation-implementation-scope.md). Owner now requests implementation in the new chat; reconcile current execution tickets/blockers with Matt before starting, without reopening agreed product questions. Live issue bodies read2026-10-27: #59 closed; #60/#65/#66/#69/#70/#73/#74/#75/#76 open. Keyword searches found no matching new-feature issues/PR titles; no PR101/103 merge recheck or Project/native-graph/write action. Do not silently assign backend scope to #60 or reopen completed logic. Preserve all dirty/untracked planning/Apidog files and stash; human approval for each merge remains mandatory.

Owner confirmed PR101/PR103 merged; do not repeat merge checks. Sending-chat evidence records #102 CLOSED and Clinic MVP Project Done directly verified/synchronized; not freshly checked in this chat. #52–#59 passed the [logic gate with limitations](docs/planning/frontend-logic-gate-review.md), not final UI/production acceptance.

## Owner-approved journey

[Consolidated journey map, states, fictional scenarios, skills and gaps](docs/planning/post-59-user-journey.md) is the current decision record.

- Reception starts at appointments; doctor/doctor-manager at own appointments, incomplete notes and permitted follow-up. Manager reaches administration from that clinical start. No generic queue of unfinished plans/prescriptions/procedures.
- Appointment → details → patient record; sidebar Patients → search/select → record. Summary first, tabs: chart/plans/visits-notes/prescriptions/files/finances. Create/edit plans inside their tab; manage current visit in Visits and notes. Financial account has Record payment for the current patient. Reception's complete journey accepted.
- Sidebar approved: Appointments, Patients, Follow-up, Inventory, Reports, Clinic administration, within permissions; collapse/expand; bottom Sign out and Settings. Latest owner decision: Settings → Appearance lets **every user choose Pearl blue or Deep teal personally**. Other sections (My account/Appointments/Finances/Documents/Inventory) retain their authority; accounts/permissions manager-only. Do not hide the entire Settings entry based on clinic-settings rights. Theme storage is not yet implemented/selected.
- Inventory, Follow-up and Reports flows approved. Contact tasks separate from pending notes; manual sharing only. Reports: daily appointments/financial activity, current scoped balances by currency, stock alerts, authorized exports. Existing capabilities/content scopes remain.
- Consultation: standalone, optional appointment, new/existing patient, full-only optional payment, individual default-price override; linked calendar or unlinked today's entry. Latest: immediate share at actual payment; unpaid debt only at room entry. No duplicate income/share. Same encounter may continue into treatment; pending exam note allowed. Normal authorized refunds; no special cancellation interview.

Consultation integration is a confirmed gap, not delivered #52–#59 behavior. Map standalone service/default price/start/note/payment before implementation; no dummy plan, fabricated paid flag or silent #60 scope expansion. Raise only concrete conflicts.

## Next action and boundaries

Latest visual feedback: **borderless appointment/content cards by default**; use spacing/tints/row separators, not outlined cards/nested frames or a shadow on every card. Keep functional field/focus outlines. Owner preference overrides reference card-border defaults; generated preview outlines are not approved. Persisted by explicit request in `C:/Users/ayman/.codex/skills/.system/imagegen/SKILL.md` (User UI preference), linked from Product Design0.1.56 `skills/ideate/SKILL.md`; both quick_validate checks PASS, direct readback verified. Project rule also in journey map for implementation. No new images generated for this correction.

Correct visual source: owner-supplied `D:/clinic-visual-system`, not old clinic-app/design. Read correct instructions/tokens/guide and viewed six blue/teal screenshots. tokens.json governs appearance; CSS is export. Owner chose user-selectable blue/teal in Settings for everyone, not one exclusive palette. Preserve approved journeys; source read only, no browser/contrast rerun or UI authorization. Details in journey map.

Owner approved the final starts: non-doctor manager → Financial reports; stock worker → Inventory; assistant → permitted patient list, all within capabilities. Core journey planning is complete; decisions/states/scenarios and the consultation integration gap are recorded in the map. Optional doctor-manager landing remains an idea; exact labels/tab order/collapse persistence are deferred. Before implementation, reconcile consultation behavior/layer ownership; no silent #60 expansion. #60 shared shell/dashboard remains first UI scope after separate authorization/current criteria; #61–#75 feature UI, #76 connected verification/scaffold retirement. No automatic implementation/publication.

This chat performed source inspection, six selected-package screenshot views (plus three earlier wrong-reference views) and documentation checks; no tests/browser/database/service/tracker actions. No independent planning review claimed. Apidog/owner notes retained; no staging/commit/publication/branch switch. Stash `4e97123b318d9c9797845a8e0d07a714e8e1288d` untouched.

## Completed #102 evidence and safety

[Implementation](docs/planning/issue-102-implementation.md), [independent review](docs/planning/issue-102-review.md), [error contract](docs/api/errors.md). Prior builder full Vitest264/264 and type/lint/build/OpenAPI passes; independent HTTP12/12/rendered25/25, Standards0/Spec0. Detailed provenance/limits remain in reports, not rerun here. Bundle advisory remains; mocked checks do not prove connected UI.

Prior issue102 disposable DB/network removed; owner issue7 stopped55437. ERP/Apidog/manual resources and4173/4175 must remain untouched. No ignored credentials, real patient/mail, production/live migrations. No current resource recheck inferred from these historical safety facts.
