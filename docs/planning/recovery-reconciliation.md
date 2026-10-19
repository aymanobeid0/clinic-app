# Recovery reconciliation — Spec 002 / issue #50

Date: 2026-10-18 (Africa/Bamako). Owner authorization: “ok so let us settle that now”, following approval of recovery #49 and tickets #50–#76. This scope reconciles planning/tracker instructions only; it does not authorize application implementation.

## Authority and execution

1. Direct current owner instructions govern scope and authorization.
2. Spec #49 and the subsequent owner clarification govern delivery order: backend/API → presentation-independent frontend business logic → components → pages → app routing → main-app composition.
3. Spec #1 remains the product baseline. Later approved identity, clinical, financial and file decisions override earlier conflicting proposals. Product behavior is not reduced by moving acceptance between stages.
4. Current reconciled issue contracts govern per-ticket execution and native dependencies. Original bodies in clearly labelled superseded archives remain requirement lineage/history, not competing delivery instructions.
5. Historical local publication payloads and original ticket breakdowns are snapshots. They do not authorize work or override the contracts above.

Backend rules and permissions stay authoritative on the server. Frontend feature business logic owns transport/query/form/workflow coordination through clean, focused interfaces. Components render state and emit actions; pages compose components; routing selects pages; the main app composes providers and routing. Do not duplicate database/repository layers in the browser or build speculative abstractions.

No product UI coding is authorized during backend or logic stages. No deletion, automatic ticket progression, automatic merge, production operation or real patient data follows from this reconciliation. Each implementation needs explicit owner authorization. If authoritative instructions conflict, pause the affected work and resolve the precise conflict before editing.

## Requirement ownership

The source issue retains its product requirements; the columns assign backend, logic and designed-UI responsibility. Each original checklist item is retained in its source archive and must be covered by the applicable assigned owner. Source ownership is also added to each recovery ticket, so a worker need not infer lineage from this table alone.

| Source | Backend/status | Frontend business logic | Designed UI / final integration |
|---|---|---|---|
| #7 | Historical implementation; not final UI acceptance | #52 | #60 |
| #8 | Historical implementation; not final UI acceptance | #52 | #60, #74 |
| #9 | Historical implementation; not final UI acceptance | #53 | #61 |
| #10 | Historical implementation; not final UI acceptance | #53 | #62 |
| #11 | Historical implementation; not final UI acceptance | #53, #55 | #65 |
| #12 | Historical implementation; not final UI acceptance | #54 | #63, #75 |
| #13 | Historical implementation; not final UI acceptance | #53, #55 | #64, #65, #74 |
| #14 | Historical implementation; not final UI acceptance | #55 | #64, #68 |
| #15 | Historical implementation; not final UI acceptance | #56 | #66 |
| #16 | Historical implementation; not final UI acceptance | #56, #59 | #66, #73 |
| #17 | Historical implementation; not final UI acceptance | #56 | #67, #74 |
| #18 | Active backend/API owner; not yet accepted | #54, #57 | #75 |
| #19 | Active backend/API owner; not yet accepted | #54 | #68, #64 |
| #20 | Active backend/API owner; not yet accepted | #57 | #69 |
| #21 | Active backend/API owner; not yet accepted | #57 | #69 |
| #22 | Active backend/API owner; not yet accepted | #57 | #70 |
| #23 | Active backend/API owner; not yet accepted | #57 | #70 |
| #24 | Active backend/API owner; not yet accepted | #58 | #71 |
| #25 | Active backend/API owner; not yet accepted | #58 | #72 |
| #26 | Active backend/API owner; not yet accepted | #59 | #60, #73 |
| #27 | Active backend/API owner; not yet accepted | #59 | #73 |
| #28 | Operational rehearsal; separate authorization | — | — |
| #29 | Final pilot gate | — | #76 |

Shared login/onboarding/recovery, sidebar/header/dashboard and route behavior: #60. Catalog administration: #74; patient prescription lookup/issuance: #67. Catalog duration suggestions remain covered by #53/#55 and appointment page #65. Signed acceptance evidence spans #64/#68. Pending-note tasks span #56/#59 and #66/#73. Historical clinical and own-work financial views span #54/#57 and #75. #76 verifies that every original requirement has a real replacement and retires scaffold presentation only after coverage is demonstrated.

## Current states and stage gates

- #7–#17 stay closed as historical implementation records, retaining linked PR/test evidence. Their closed state does not certify final Dentara UI or presentation-independent logic. This task does not newly rerun or certify those backend tests.
- #18–#27 remain open and own only their remaining backend/API work under the reconciled contract. They may close after reviewed backend acceptance plus explicit transfer links; unfinished UI remains tracked by the later owners. There is no duplicate new backend implementation ticket.
- #50 is the reconciliation gate. It remains open for independent review/human acceptance; work does not automatically advance.
- #51 remains blocked by #50 and requires actual backend evidence for every #18–#27 capability, not issue state alone. It has no dependency on later UI. No current task declares the backend complete.
- #52–#59 are frontend-business-logic tickets, after #51. No designed product components, pages, app routing or main-app UI implementation is authorized there.
- #60–#75 are deferred product UI tickets. Their upstream behavior gate and separate owner authorization are required before UI coding. Each page requires approved-design comparison, meaningful French user journey, permissions/failure states, responsive/keyboard checks and a local owner preview.
- #76 requires all replacement UI tickets and verifies the connected application, requirement coverage and scaffold removal conditions.
- #28 may perform separately authorized operational preparation after its existing backend prerequisites. Full acceptance, including its French connected journey, requires #76 evidence; backend acceptance cannot imply restoration success.
- #29 additionally depends natively on #76, retaining its existing clinical/financial/report/export/#28 prerequisites. Real-data/cutover approval is separate.
- No parent issue (#1 or #49), issue state, original implementation history or unrelated local change is changed by publication.

## Resolved contradictions and dependency rules

- Historical access #18: the approved Q31b exception permits cutoff-bound read-only own-performed-work financial snapshots. It does not permit other doctors' finances, later changes, edits or application print/download/export. Authorized inline attachment snapshots follow the approved file/access contract.
- Because complete historical financial verification needs financial records/corrections, #18 also depends on backend #23, not only clinical #12/#14/#16/#17. This is a new genuine prerequisite; it is not described as an original dependency.
- Attachment #19: approved decimal limits are 2,000,000,000 clinic bytes and 20,000,000 file bytes. Count all retained versions, including removed/replaced bytes. Enforce atomic reservations, safe removal/history and clinical/financial/mixed content scopes.
- Backend #18–#27 acquire native #50 blockers. Original native prerequisites stay intact. #18 gains #23; #29 gains #76. The original recovery graph remains intact.
- UI owners are references, never blockers of their backend source issue. This prevents a backend → UI → backend cycle.
- The old “complete all layers in each feature ticket” instruction is superseded by #49. API document content/data/templates and authorized delivery remain backend obligations; final French product screens and browser print journeys stay with the UI owners.

## Evidence and review

Pre-edit live issue bodies/states and recent comment context were captured in the ignored reconciliation workspace before mutations. All original bodies #7–#29 are retained in the proposed issue archives. Writes compare each current issue body with the captured version first and abort on concurrent edits; no blind overwrite is allowed.

Application baseline HEAD: 08314b30e43c90e0292400d537844bdeb8100857. Existing owner comparison main-at-start: 921b3faca47cc3515dbe17f297d93f23b6bbaca3. The launcher changes between those commits precede this scope. The recovery baseline preserves committed state and separately retains unrelated dirty files; it is not a claim that those dirty changes are committed.

Root is the tracker/docs builder; one separate reviewer covers standards and specification, overriding the skill's multiple-reviewer instruction. Selected sources: repository code-review SKILL and skill-integration instructions; writing-for-agents SKILL for concise authority/pointer/stop rules. to-spec/to-tickets history is input; no new ticket decomposition or product discovery is performed. TDD and UI/design implementation skills are skipped because no application code changes.

Verification must account for all 50 updated issue bodies (#7–#29 and #50–#76), unchanged states/parents, complete source ownership, active nonempty API criteria, required native edges and a cycle-free actual graph. Review includes the pinned local documentation diff and before/after tracker snapshots. API/browser suites are intentionally not rerun for this documentation/tracker-only change. See recovery-reconciliation-review.md for actual review findings and final verification provenance.

### Published verification — 2026-10-19

The owner merged the planning/reconciliation documents in PR #77 at main `317f844` before this continuation. Root then applied the independently reviewed 50 GitHub issue-body changes and native dependency additions, using read-before-write checks. Live readback matched every proposed body; all 23 original source archives remained present, every issue state was preserved, and parent bodies/states #1/#49 remained unchanged. The actual native graph contains 55 nodes and 112 edges, has all required original/recovery/new edges, and is acyclic. The verification script returned zero failures. No application code was changed or application/API/browser tests rerun by this continuation.

Issue #50 stays open for human acceptance of the final publication evidence. No later implementation is automatically authorized. The user's unrelated local development-script edit was preserved. Final follow-up evidence is on `codex/recovery-tracker-verification`, based on merged main `317f844`.

