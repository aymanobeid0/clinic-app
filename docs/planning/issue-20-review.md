# Issue #20 independent review

Reviewer: the single independent reviewer, covering Standards and Spec under the owner override in AGENTS.md and docs/agents/skill-integration.md. No implementation fixes or additional reviewers were delegated.

## Scope and provenance

Freshly read AGENTS.md, docs/agents/skill-integration.md, docs/agents/issue-tracker.md and `.agents/skills/code-review/SKILL.md`. Selected the repository Matt code-review skill for both substantive axes, including its complete Fowler smell baseline; the owner's one-reviewer rule replaces its parallel-agent procedure. Considered implementation/TDD, architecture-discovery, UI/design and handoff skills: not selected because this role inspects an existing backend change and writes its review report; builder owns implementation and handoff. Inspected the approved architecture/dependency proposal, Spec 001 financial/access/lifecycle rules, financial-decisions.md, identity-access-decisions.md, clinical-decisions.md and the implementation contract.

Pinned owner comparison: main at implementation start `ddd123889d777cf209ea14725be8f70380bd5a76`. Reviewed initial implementation HEAD `5b94a95dca756d514dadfb6c3921994ab549ee5c`. Independently resolved both refs, confirmed nonempty `git diff ddd123889d777cf209ea14725be8f70380bd5a76...HEAD`, and read `git log ddd123889d777cf209ea14725be8f70380bd5a76..HEAD --oneline` (one implementation commit). Independently checked merged PR30/44/45 ancestry against the pinned base. Unrelated dirty scripts/local-dev.ts was observed and untouched.

Direct GitHub issue read initially failed with `error connecting to api.github.com`. Supported escalated retry succeeded; current #20 body and native blockers #4/#15/#50 were read directly, all blockers closed. Current backend-only criteria govern; frontend owners #57/#69/#60/#76 remain outstanding. No unresolved connection blocker.

## Standards

No actionable documented-standard breaches or Fowler-baseline smell findings identified. Reviewed feature-owned routes/controller/service/repository, transaction orchestration, public module boundaries, exact monetary transport, clinic scoping, RLS and append-only runtime permissions. Heuristic smells were judged against the approved concrete module layout rather than treated as mandatory abstractions.

## Spec

**P2 — Persist the full range of already valid accepted item amounts.** `BillingEntry.amountMinor` and migration backfill use PostgreSQL bigint. `exactAmountSchema` permits 15 whole digits and three decimals; an item permits 50 extras. Valid accepted KWD items can therefore exceed bigint even though each component fits. A start that previously retained its exact agreed amount now fails the charge insert and rolls back with 500; migration backfill can fail for already retained starts. This conflicts with #20's full agreed charge creation and the approved exact/no-rounding financial contract. Use sufficient exact integer storage for existing valid agreements and regression-test above-int64 start/reconciliation and retained-source backfill. Do not silently narrow already accepted agreements. Finding delivered to builder; pending fix and same-reviewer recheck.

Other inspected behavior: start and charge share the existing authorized transaction and clinic treatment lock; immutable source and command receipts prevent duplicate starts/charges. Opening balances retain provenance without fabricated payments/documents. Current doctor patient/own-work and staff restricted projections are enforced; manager procedure/tooth billing visibility follows the explicit owner exception. Renewed acceptance restores care status, first starts retain the confirmed agreement revision, pending drafts cannot rewrite due debt, reconciliation appends a signed correction and started clinical references cannot be removed/relabelled. Broader cancellation/settlement remains explicitly deferred. No UI/scaffold expansion found.

## Verification and disposition

Directly inspected authenticated HTTP tests using isolated real PostgreSQL, concurrent identical commands, cross-clinic/current doctor/staff access, exact currencies and an injected database-trigger failure proving transaction rollback. Test inspection is not independent execution. Builder reported targeted 19/19 plus expanded renewed-acceptance regression, type/lint/build passes and full suite in progress; these are attributed reports, not independently rerun claims. Reviewer independently ran `git diff --check` successfully; reviewer typecheck is pending completion. No production/live migration or real patient data used.

Initial disposition: Standards 0 findings; Spec 1 P2 finding, unresolved. Review does not authorize merge or next-ticket progression. Final disposition and exact final tested revision will be appended after the fix/recheck and builder verification.

## Same-reviewer final recheck

Reviewed fix commit `68d0299e5638a2aa58bae929e686e1119fb237d8` and the full pinned-base diff again. The P2 is resolved: migration and Prisma storage use exact `numeric(30,0)`/Decimal, inserts pass exact strings, and projections convert `toFixed(0)` to BigInt before arithmetic. Both charge and signed adjustment range are preserved. The rollback-only retained-start migration test executes the shipped SQL and confirms the original exact amount. No new Standards or Spec findings identified.

Reviewer independently executed `npx vitest run apps/api/test/billing.test.ts -t 'large accepted extra-work'` against final implementation commit `68d0299`: **1 passed, 6 skipped**, 4.53s. This directly verifies an authenticated exact `50999999999999999949` start, `-50999999999999899949` adjustment, resulting due and retained-start migration through real isolated PostgreSQL. The supported escalated execution succeeded. Reviewer also independently reran `git diff --check` and `npm run typecheck` on this commit, both passed. The earlier reviewer typecheck on `5b94a95` also completed successfully.

Builder reports the complete billing file **7/7 passed**, fresh disposable database all 27 migrations passed, and final type/lint passed; build/full suite were still running when this recheck was written. These additional checks remain builder-reported and must have their final result recorded in the implementation report/HANDOFF before publication; reviewer did not independently rerun the full suite. The initial superseded full-suite run was interrupted to apply the finding, so it supplies no final pass claim.

Final substantive review disposition: **Standards 0 unresolved findings; Spec 0 unresolved findings (one P2 fixed and independently regression-tested)**. Backend implementation passes independent review, subject to completing and recording the builder's required final checks/handoff. Broader browser/product/production acceptance is outside this review, and human review/merge remains required.
