# A1 — Record standalone consultation entry and continue care

Status: owner-approved and published 2026-10-27. A1 execution explicitly authorized; dependent stages require prerequisite human-approved merge.

## Parent

Spec #1, approved standalone consultation amendment (ADR0002).

## What to build

An authorized user can arrange a standalone consultation for an existing or newly registered patient, with an optional appointment. The doctor explicitly records room entry, examines the patient and can continue accepted-plan treatment within the same encounter. This slice delivers the unpaid entry path; consultation payment is delivered by A2 before frontend integration.

## Acceptance criteria

- [ ] Consultation retains its own identity, patient, responsible doctor, agreed exact price/currency, revision and lifecycle, without a dummy plan. Authorized clinic defaults and individual price override reuse the existing capability model. Optional appointment must match patient/doctor; unlinked consultations are discoverable for today's work.
- [ ] Manager configures each doctor's remuneration mode and percentage, shared by consultations/treatments. No salary amounts/payroll; missing configuration is explicit, never silently treated as zero. Retain dated changes and currency precision.
- [ ] An unpaid booking creates no debt. Explicit room entry atomically creates/uses one encounter and creates one consultation charge in the existing ledger, freezing that consultation's remuneration configuration. Opening details/booking does not record entry.
- [ ] Entry at price500/rate40% yields due500/share0; changing the setting to50% preserves the frozen40%. Recognized share on later payment belongs to A2.
- [ ] Public authenticated commands can add/start accepted-plan procedures in the same open encounter. Existing accepted-revision, performer, start-once charging and completion rules remain. Consultation completion, treatment completion and encounter ending are distinct; the appointment does not complete while care continues.
- [ ] Reuse one encounter-note lifecycle. End care with an unfinished draft, discover its pending task, finalize and correct it without duplicating the note.
- [ ] Extend shared charge outputs to distinguish consultation/treatment without fabricated plan/item IDs. Existing balance, reports, exports and cutoff-bound historical snapshots handle entered consultations and preserve clinical redaction. Invoice eligibility remains treatment-only.
- [ ] No clinical access is inferred from booking/consultation. Active patient grants, doctor ownership, non-doctor manager boundaries, disabled/historical accounts and clinic isolation remain authoritative.
- [ ] Authenticated isolated fictional persistence tests prove no-plan/no-appointment entry, same-encounter treatment, pending notes, scope denials, stale revisions, retries/concurrency and no duplicate charge/encounter/note. Shared contracts/OpenAPI and affected existing consumers remain valid.

## Blocked by

- #51 completed backend evidence gate. Decision prerequisites #2–#6 are closed; relevant approved decisions remain binding.

## Execution boundary

Backend/shared contracts only. One builder and one independent Standards/Spec reviewer, fixed comparison supplied before review, actual checks and handoff evidence. Human merge required before A2/A3 dependent implementation. No product UI, production/live migration or real data.
