# Handoff history index — 12–25 October 2026

Use [HANDOFF](HANDOFF.md) for current work, [delivery status](docs/planning/delivery-status.md) for dated progress, and [the workflow](docs/agents/skill-integration.md) for current authorization rules. This index locates historical evidence; old approvals and pending states do not authorize new work or establish current resource status.

## Original record

The former 231,059-byte, 833-line chronology is retained exactly in Git at `b939251f5cc8fd177e638255b3d116e0d2a4321e:HANDOFF.history-2026-10-25.md` (SHA256 `9d9ad3bec20064a5f5220e3f0097d0f6c8e9f85808d52d06e15f5f751ba81dae`). Its 115 headings include repeated intermediate/pending entries later superseded by final ledgers. Read only the relevant original line range:

[View the fixed original](https://github.com/aymanobeid0/clinic-app/blob/b939251f5cc8fd177e638255b3d116e0d2a4321e/HANDOFF.history-2026-10-25.md), or use `git show b939251f5cc8fd177e638255b3d116e0d2a4321e:HANDOFF.history-2026-10-25.md` locally. Git preserves the original mixed line endings; redirecting terminal output may normalize them. No history was rewritten. This reduces the checked-out file, not existing Git storage or clone history.

If PR commits are not retained in main ancestry (for example, after squash merge/branch deletion), ordinary future clones may lack that exact snapshot. The existing main ancestor `695fcb1f7f0f407e14dfedb3b66ad140662b1c2c:HANDOFF.md` retains the first 823 lines as text; use `git show` with that ref/path as fallback. It is not byte-identical and excludes the final ten publication lines. Their distinct facts are retained below and in the #55 publication record; current scope reports remain the primary lookup.

## Distinct historical notes

Current contracts and workflow remain authoritative. These dated notes preserve provenance rather than repeat their rules:

- **12 October, lines 87–118:** owner requested PR32's revert (PR34), then approved PR35's complete replacement; PR33 alone could not restore the base. No database rollback/deletion. [Identity contract](docs/planning/identity-access-decisions.md), [email review](docs/planning/issue-7-email-login-review.md).
- **12–16 October, lines 106–107, 123–134, 306:** short material questions via structured/modal input, no repeated discovery, economical responses, gradual [identity recommendations](docs/architecture/identity-module-design.md), and then-requested browser repository/project inspection. Current workflow keeps project tracking optional.
- **13–15 October, lines 71–85, 136–148, 210–216:** owner requested tracked AGENTS/HANDOFF sync, superseding older untracked-only notes. Current review/mirror rules: [workflow](docs/agents/skill-integration.md); retired super-board: [audit](docs/agents/skill-conflict-audit.md).
- **15–18 October, lines 242–410:** some #12–#16 worktree archival was protected/refused; #17 was queued and unconfirmed. These are historical observations, not current resource status or proof of removal. Inspect current attachments before cleanup; respect protections.
- **18–19 October, lines 412–434, 467–476:** owner authorized a reusable fictional demo, then reported it unusable and requested removal. Earlier success/running-server claims were superseded. Deleted launch reports are available only through history; [removal review](docs/planning/local-demo-removal-review.md) is retained. No recreation authorization follows.
- **23–24 October, lines 622–698, 740–747:** old publication approval refusals/pending gates were resolved by exact owner approvals for #27/#51/#91/#53. Keep each refusal and its later resolution paired when consulting the original. The later standing rule supersedes those ticket-specific gates.
- **25 October, lines 774–788:** owner said “yes push and always push without permession”, then requested a brief after every implementation. Both are implemented in [the workflow](docs/agents/skill-integration.md); human merge and new-ticket authorization remain separate.
- **25 October, lines 825–833:** previously uncommitted #55 publication note is now in the pinned original: accepted/pushed head `eac9b28ca674aad67e9721f9d2a3a4cd4c272819`, PR96 created 12:22:08Z. Source/test/failure provenance stays in its implementation/review reports; later merge status is in delivery status.

## Evidence by scope

Ranges cover all 833 original lines without gaps. Issue implementations normally have `issue-N-review.md` beside them; #7 instead has [initial](docs/planning/issue-7-initial-review.md), [continuation](docs/planning/issue-7-continuation-review.md) and [email](docs/planning/issue-7-email-login-review.md) reviews. Read both implementation and review for pins/checks/provenance/limits. Historical detail is in the Git locators above; the final #55 publication note is also preserved in its record. These links do not imply sentence-for-sentence duplication.

| Original lines | Scope | Focused record |
| --- | --- | --- |
| 1–20 | #52 identity logic | [Record](docs/planning/issue-52-implementation.md) |
| 21–38 | #26 reports/follow-ups | [Record](docs/planning/issue-26-implementation.md) |
| 39–52 | #23 refunds/reversals | [Record](docs/planning/issue-23-implementation.md) |
| 53–70 | #22 invoices/checkout | [Record](docs/planning/issue-22-implementation.md) |
| 71–119 | Initial #7 and docs sync | [Record](docs/planning/issue-7-implementation.md); distinct notes above |
| 120–135 | #8 account management | [Record](docs/planning/issue-8-implementation.md) |
| 136–148 | Per-ticket skill workflow | [Workflow](docs/agents/skill-integration.md) |
| 149–178 | #9 patient registry | [Record](docs/planning/issue-9-implementation.md) |
| 179–217 | #10 clinical access and docs sync | [Record](docs/planning/issue-10-implementation.md) |
| 218–241 | #11 scheduling | [Record](docs/planning/issue-11-implementation.md) |
| 242–273 | #12 medical history/chart | [Record](docs/planning/issue-12-implementation.md) |
| 274–303 | #13 catalog/plan drafting | [Record](docs/planning/issue-13-implementation.md) |
| 304–323 | #14 plan acceptance | [Record](docs/planning/issue-14-implementation.md) |
| 324–351 | #15 visits | [Record](docs/planning/issue-15-implementation.md) |
| 352–375 | #16 visit notes | [Record](docs/planning/issue-16-implementation.md) |
| 376–411 | #17 prescriptions/amendment | [Record](docs/planning/issue-17-implementation.md) |
| 412–434 | Retired demo launch | Fixed original; note above |
| 435–446 | Recovery publication/#50 | [Reconciliation](docs/planning/recovery-reconciliation.md), [review](docs/planning/recovery-reconciliation-review.md) |
| 447–466 | #20 balances/deposits | [Record](docs/planning/issue-20-implementation.md) |
| 467–476 | Demo removal | [Review](docs/planning/local-demo-removal-review.md) |
| 477–496 | #21 payments | [Record](docs/planning/issue-21-implementation.md) |
| 497–514 | Error-handling maintenance | [Evidence](docs/planning/error-handling-maintenance.md), [review](docs/planning/error-handling-review.md) |
| 515–533 | #19 attachments | [Record](docs/planning/issue-19-implementation.md) |
| 534–555 | #18 historical access | [Record](docs/planning/issue-18-implementation.md) |
| 556–581 | #24 inventory receiving | [Record](docs/planning/issue-24-implementation.md) |
| 582–603 | #25 inventory movements | [Record](docs/planning/issue-25-implementation.md) |
| 604–633 | #27 exports | [Record](docs/planning/issue-27-implementation.md) |
| 634–671 | #51 backend acceptance | [Acceptance map](docs/planning/issue-51-backend-acceptance.md), [review](docs/planning/issue-51-review.md) |
| 672–699 | #91 OpenAPI/Apidog | [Record](docs/planning/issue-91-implementation.md) |
| 700–747 | #53 patient/access/scheduling logic | [Record](docs/planning/issue-53-implementation.md) |
| 748–789 | #54 clinical/attachment logic and preferences | [Record](docs/planning/issue-54-implementation.md) |
| 790–833 | #55 treatment/catalog logic | [Record](docs/planning/issue-55-implementation.md) |
