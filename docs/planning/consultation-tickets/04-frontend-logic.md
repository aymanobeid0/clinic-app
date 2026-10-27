# B — Expose consultation and remuneration frontend workflows

Status: owner-approved and published 2026-10-27. A1 execution explicitly authorized; dependent stages require prerequisite human-approved merge.

## Parent

Spec #1, approved standalone consultation amendment (ADR0002).

## What to build

Presentation-independent frontend interfaces connect patient registration/selection, optional consultation booking, explicit room entry, payment, same-encounter treatment, notes and permitted remuneration/settings queries to the reviewed API.

## Acceptance criteria

- [ ] Reuse existing patient registration/assignment handoff; selecting/creating consultations never fabricates clinical access. Support optional appointments, default/agreed price, unlinked today's work and existing/new patients.
- [ ] Forms/actions distinguish unpaid booking, paid before entry, due after entry and paid after entry. Consequential payment and room entry remain distinct explicit commands; balances/rates/shares are authoritative server values with no browser domain arithmetic.
- [ ] Continue accepted treatment in the existing consultation encounter, preserve independent procedure completion, end care with pending note, and reuse existing finalization/correction interfaces.
- [ ] Expose authorized default-price/remuneration configuration and manager/own-doctor share queries with honest missing-configuration states. Deny/redact staff, unrelated-doctor and historical-only active report access.
- [ ] TanStack Query owns scoped projections/refresh, RHF current-tab inputs, React private command feedback and Zustand only genuinely shared local state. No persistent sensitive drafts, duplicated backend rules or unnecessary abstractions.
- [ ] Loading/empty/validation/failure/denied/conflict/unknown outcomes are truthful. Changed inputs during uncertainty cannot alter the exact retained command/path/payload retry. Identity/patient/scope changes retire prior drafts, results and output authority.
- [ ] Rendered hook consumers prove both500/40% sequences, stale revisions, scope changes and exact retry. At least one connected fictional API journey proves backend/logic integration; label mocked evidence honestly.
- [ ] Affected existing billing, visit, scheduling, settings, reports/export and historical logic consumers remain valid. No designed components/pages/routes/main-app composition or scaffold retirement; final UI acceptance remains #60–#76.

## Blocked by

- #105 and #106 — reviewed behavior merged into the execution base (A1 transitively).
- #59 — completed frontend behavior gate; #52–#59 remain closed as previous delivered scope.

## Execution boundary

Frontend business logic only after backend merge gates. One builder and one independent Standards/Spec reviewer; actual checks, connected evidence and handoff before PR. Human merge and separate UI authorization remain required. No production/live migration or real data.
