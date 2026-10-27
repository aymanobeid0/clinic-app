# Consultation execution ticket preparation

2026-10-27. Current owner authorization covers preparing tickets, A backend/contracts and B frontend business logic; no UI/production/automatic merge. Product decisions are settled. Repository Matt `to-tickets` step4 explicitly requires owner approval of the proposed breakdown before publishing; owner approved the breakdown and starting A1 in this chat on2026-10-27. Tickets #104–#107 and their native dependencies are now published; A1 is Building and the dependent issues Blocked.

## Published frontier

1. [A1 standalone entry and same-encounter care](01-consultation-entry.md), after completed #51.
2. [A2 consultation payment and share](02-consultation-payment.md), after merged A1.
3. [A3 settled treatment share](03-treatment-share.md), after merged A1/A2; reuses their configuration and source-linked share/correction output.
4. [B frontend workflows](04-frontend-logic.md), after merged A2/A3 and completed #59.

The owner's layer order overrides the skill's default inclusion of UI in every slice. Each backend slice is independently verifiable through authenticated HTTP/persistence. A1 intentionally delivers the unpaid path; A2 delivers pre-entry payment without exposing an unfinished product UI between stages. No ticket is a silent expansion/reopening of #52â€“#59. Dependent implementation waits for human-approved prerequisite merge; current owner authorization covers execution once those gates are met.

## Current service evidence

Direct GitHub reads on2026-10-27: #2â€“#6 CLOSED with current criteria read, #51 CLOSED, #59 CLOSED. Their current bodies retain approved decision/test/architecture references. Owner's confirmed PR101/103 merges are accepted without new merge checks. Existing #51 and #59 detailed implementation/review reports remain evidence pointers, not tests rerun by this preparation.

Current native blocked-by edges read directly:

| Issue | Blocked by |
| --- | --- |
| #51 | #50 |
| #59 | #56, #57, #58 |
| #60 | #59 |
| #65 | #61 |
| #66 | #64, #65 |
| #69 | #66 |
| #70 | #69 |
| #73 | #67, #68, #70, #72 |
| #74 | #60 |
| #75 | #63, #64, #66, #67, #70, #74 |
| #76 | #61â€“#75 |

All listed UI issues are OPEN and project Backlog. #51 project Done. #59 project was stale Review; synchronized to Done using the owner's prior merged acceptance, not a new PR merge audit. No existing native edge removed. Repository-wide current issue listing has no new consultation/remuneration issue; connector search for consultation returned none. CLI initially failed with `error connecting to api.github.com`; supported elevated read retry succeeded. No unresolved connection blocker.

## Published UI criteria/dependency additions

Preserve every current body/edge and original requirement. Added #107 as a native blocker for #65/#66/#69/#70/#73/#74/#75, since each directly binds new behavior. #76 receives new scenario coverage; its existing UI blockers transitively gate it on B. #60 retains #59 as its blocker: shared shell itself does not require consultation implementation, and no new hidden backend scope belongs there.

| UI owner | Additive acceptance |
| --- | --- |
| #65 | Optional appointment consultation booking, consultation details and unlinked today's work; no implicit clinical access. |
| #66 | Explicit room entry, standalone encounter, add accepted treatment in the same encounter and pending exam notes. |
| #69 | Full-only consultation payment before/after entry, dedicated funds, correct debt/receipt and exact retry. |
| #70 | Existing authorized corrections/refunds retain consultation source/rate links; no new consultation invoice. |
| #73 | Manager/concerned-doctor share reporting, scoped exports and no staff remuneration leakage. |
| #74 | Authorized default consultation price and manager-controlled per-doctor remuneration mode/rate. |
| #75 | Cutoff-bound consultation/own-work snapshots, excluding later changes and active compensation reports. |
| #76 | Connected role coverage of both500/40% sequences, same encounter, pending notes and reservation/correction isolation before scaffold retirement. |

Publication reread bodies before additive updates and compared again before each write. Created #104–#107 in dependency order; native edges #104←#51, #105←#104, #106←#104/#105, #107←#105/#106/#59 read back as intended. Every UI additive body/state and preservation of old native edges was checked after write. Project status reflects actual frontier, not readiness as execution permission. No parent #1/#49 body or completed #52â€“#59 issue is modified.

## Skills, checks and preservation

Read actual repository `.agents/skills/to-tickets/SKILL.md`, `implement/SKILL.md`, `code-review/SKILL.md`, `tdd/SKILL.md` and TDD `tests.md`/`mocking.md`. Read AGENTS/HANDOFF/skill-integration/issue-tracker, consultation approved contract/scope/ADR/glossary, architecture/dependency/recovery and relevant financial/access decisions. Reuse the approved HTTP/isolated persistence seam, with rendered/connected frontend seam for B. Skip new grilling/spec rewriting, UI/design skills and unrelated refactoring. Independent implementation review uses one separate reviewer for both axes, overriding skill fanout. No review pass claimed for these drafts.

Direct checks: current service reads above and source-seam inspection. This paragraph records the earlier preparation phase, before A1: no application test/build/database/service run or branch/commit/PR then. Subsequent A1 activity is recorded separately in its implementation report. Starting HEAD `09b947fcf641e55d6aaf08b25aec3caa2803f565`, branch `codex/error-guidance`. Existing dirty/untracked owner documents, separate Apidog change and stash preserved. Do not touch owner DB55437, ERP/Apidog/manual resources or servers4173/4175. Future tests need verified task-owned fictional isolated resources.

Next: complete #104 implementation/review/PR. Owner selected latest repository state for comparison: main at44cedc2df5a934bdf3737ecf7ef288fe89416e7f. Actual implementation evidence is in ../issue-104-implementation.md. All merges remain human-controlled.
