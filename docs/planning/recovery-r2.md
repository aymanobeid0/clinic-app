## Parent

> Planning snapshot published 2026-10-18. Current contract: [GitHub #51](https://github.com/aymanobeid0/clinic-app/issues/51); current status: [delivery summary](delivery-status.md).

https://github.com/aymanobeid0/clinic-app/issues/49

## What to build

Demonstrate the complete MVP API using authenticated workflows, stable contracts and isolated PostgreSQL.

Recovery planning ID: R2. Preparation/backend gate. No product UI coding.

## Acceptance criteria

- [ ] Record backend acceptance independently of issue closure or UI completion. Verify fresh migrations, permissions/isolation, retries, conflicts, relevant concurrency and required checks; identify unresolved operational gates.
- [ ] Maintain a traceable mapping to Spec 001, approved amendments and the original feature criteria; do not count incomplete UI as finished product delivery.
- [ ] Verify observable behavior at the highest applicable existing seam and record checked revision, actual results and omissions.

## Architecture and execution boundaries

Architecture: frontend feature business logic uses clean, focused interfaces and explicit responsibilities, separate from components, pages, app routing and main-app composition. Transport/query/form/workflow logic must not be embedded in visual components. Keep authoritative domain rules and authorization on the backend; do not copy the backend's persistence layers or introduce speculative abstractions into the browser. TanStack Query owns server state, React Hook Form owns form state, Zustand owns shared local UI state and React hooks own private presentation state. Keep sensitive drafts out of persistent browser storage.

Use one builder and one independent reviewer, preserve unrelated work and follow existing approved testing seams. Record actual evidence and limitations. Each implementation requires owner authorization; ready-for-agent is planning readiness only. No production deployment, real patient data or automatic merge is authorized.



## Blocked by

- #50 - https://github.com/aymanobeid0/clinic-app/issues/50
- Backend acceptance evidence for #18 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #19 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #20 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #21 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #22 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #23 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #24 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #25 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #26 (original UI acceptance remains tracked separately; issue closure is not required by this gate).
- Backend acceptance evidence for #27 (original UI acceptance remains tracked separately; issue closure is not required by this gate).

## Reconciled source ownership — 2026-10-18

Cross-cutting recovery gate; use the complete issue-to-layer mapping in the recovery reconciliation report.

Frontend architecture: feature business logic → components → pages → app routing → main-app composition. Components render state and emit actions; they do not own transport, query orchestration or authoritative server rules. No product UI coding is authorized during backend/logic stages. A ready-for-agent label is not authorization. If requirements conflict, stop the affected work and resolve the specific conflict before proceeding.

Backend acceptance is now the active scope of #18–#27. Their UI requirements remain explicitly transferred to later owners. Record evidence for each capability rather than infer completion from issue state. No dependency from backend completion to future product pages is allowed.
