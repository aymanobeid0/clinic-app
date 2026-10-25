## Parent

> Planning snapshot published 2026-10-18. Current contract: [GitHub #76](https://github.com/aymanobeid0/clinic-app/issues/76); current status: [delivery summary](delivery-status.md).

https://github.com/aymanobeid0/clinic-app/issues/49

## What to build

Remove replaced scaffold presentation only after every required journey has a verified real-page replacement; retain/adapt useful tests and complete a fictional-data connected rehearsal.

Recovery planning ID: R27. Deferred product UI stage. Publishing this ticket does not authorize UI coding. Begin only after backend and frontend behavior gates pass and the owner separately authorizes this stage/ticket.

## Acceptance criteria

- [ ] Record all backend/logic/UI requirement coverage and residual gates. Supply evidence to existing #28/#29 without declaring restoration, deployment or real-patient acceptance complete.
- [ ] Maintain a traceable mapping to Spec 001, approved amendments and the original feature criteria; do not count incomplete UI as finished product delivery.
- [ ] Verify observable behavior at the highest applicable existing seam and record checked revision, actual results and omissions.

## Architecture and execution boundaries

Architecture: frontend feature business logic uses clean, focused interfaces and explicit responsibilities, separate from components, pages, app routing and main-app composition. Transport/query/form/workflow logic must not be embedded in visual components. Keep authoritative domain rules and authorization on the backend; do not copy the backend's persistence layers or introduce speculative abstractions into the browser. TanStack Query owns server state, React Hook Form owns form state, Zustand owns shared local UI state and React hooks own private presentation state. Keep sensitive drafts out of persistent browser storage.

Use one builder and one independent reviewer, preserve unrelated work and follow existing approved testing seams. Record actual evidence and limitations. Each implementation requires owner authorization; ready-for-agent is planning readiness only. No production deployment, real patient data or automatic merge is authorized.

Page acceptance also requires approved Dentara reference comparison, French copy, real authorized data, responsive and keyboard/focus behavior, loading/empty/denied/error/conflict states where applicable, working route navigation and a local preview for owner review before further pages.

## Blocked by

- #61 - https://github.com/aymanobeid0/clinic-app/issues/61
- #62 - https://github.com/aymanobeid0/clinic-app/issues/62
- #63 - https://github.com/aymanobeid0/clinic-app/issues/63
- #64 - https://github.com/aymanobeid0/clinic-app/issues/64
- #65 - https://github.com/aymanobeid0/clinic-app/issues/65
- #66 - https://github.com/aymanobeid0/clinic-app/issues/66
- #67 - https://github.com/aymanobeid0/clinic-app/issues/67
- #68 - https://github.com/aymanobeid0/clinic-app/issues/68
- #69 - https://github.com/aymanobeid0/clinic-app/issues/69
- #70 - https://github.com/aymanobeid0/clinic-app/issues/70
- #71 - https://github.com/aymanobeid0/clinic-app/issues/71
- #72 - https://github.com/aymanobeid0/clinic-app/issues/72
- #73 - https://github.com/aymanobeid0/clinic-app/issues/73
- #74 - https://github.com/aymanobeid0/clinic-app/issues/74
- #75 - https://github.com/aymanobeid0/clinic-app/issues/75

## Reconciled source ownership — 2026-10-18

- #29 — retain all product requirements relevant to this ticket's stated capability, including approved amendments; backend ownership stays with the original issue. This ticket owns only its declared logic or UI portion.

Frontend architecture: feature business logic → components → pages → app routing → main-app composition. Components render state and emit actions; they do not own transport, query orchestration or authoritative server rules. No product UI coding is authorized during backend/logic stages. A ready-for-agent label is not authorization. If requirements conflict, stop the affected work and resolve the specific conflict before proceeding.
