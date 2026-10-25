## Parent

> Planning snapshot published 2026-10-18. Current contract: [GitHub #55](https://github.com/aymanobeid0/clinic-app/issues/55); current status: [delivery summary](delivery-status.md).

https://github.com/aymanobeid0/clinic-app/issues/49

## What to build

Expose procedure catalog, proposals, versions, pricing, presentation, acceptance and revision behavior.

Recovery planning ID: R6. Frontend business logic only. No new product components, pages, routing or visual UI. Existing scaffold may serve only as a temporary verification consumer.

## Acceptance criteria

- [ ] Verify accepted versions retain their values; changed scope/prices require renewed acceptance; surface conflict and permission states.
- [ ] Maintain a traceable mapping to Spec 001, approved amendments and the original feature criteria; do not count incomplete UI as finished product delivery.
- [ ] Verify observable behavior at the highest applicable existing seam and record checked revision, actual results and omissions.

## Architecture and execution boundaries

Architecture: frontend feature business logic uses clean, focused interfaces and explicit responsibilities, separate from components, pages, app routing and main-app composition. Transport/query/form/workflow logic must not be embedded in visual components. Keep authoritative domain rules and authorization on the backend; do not copy the backend's persistence layers or introduce speculative abstractions into the browser. TanStack Query owns server state, React Hook Form owns form state, Zustand owns shared local UI state and React hooks own private presentation state. Keep sensitive drafts out of persistent browser storage.

Use one builder and one independent reviewer, preserve unrelated work and follow existing approved testing seams. Record actual evidence and limitations. Each implementation requires owner authorization; ready-for-agent is planning readiness only. No production deployment, real patient data or automatic merge is authorized.



## Blocked by

- #54 - https://github.com/aymanobeid0/clinic-app/issues/54

## Reconciled source ownership — 2026-10-18

- #11 — retain all product requirements relevant to this ticket's stated capability, including approved amendments; backend ownership stays with the original issue. This ticket owns only its declared logic or UI portion.
- #13 — retain all product requirements relevant to this ticket's stated capability, including approved amendments; backend ownership stays with the original issue. This ticket owns only its declared logic or UI portion.
- #14 — retain all product requirements relevant to this ticket's stated capability, including approved amendments; backend ownership stays with the original issue. This ticket owns only its declared logic or UI portion.

Frontend architecture: feature business logic → components → pages → app routing → main-app composition. Components render state and emit actions; they do not own transport, query orchestration or authoritative server rules. No product UI coding is authorized during backend/logic stages. A ready-for-agent label is not authorization. If requirements conflict, stop the affected work and resolve the specific conflict before proceeding.
