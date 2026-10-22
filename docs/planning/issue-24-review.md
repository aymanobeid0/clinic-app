# Issue #24 independent review

Reviewer: separate review worker, covering Standards and Spec, 2026-10-22. Owner comparison `main` pinned to `93094d571ee843a937694b61e731ec9956356222`; initial reviewed HEAD `7cf0579a252b51aa73906a4e3f36d2b7f8fa631c`. Comparison: `git diff 93094d571ee843a937694b61e731ec9956356222...HEAD`. Commits: `2833090`, `7cf0579`. Ref resolves, diff nonempty, independent `git diff --check` passed.

## Fresh role skill checkpoint

Read repository `AGENTS.md`, `docs/agents/skill-integration.md`, and actual `D:/clinic-app/.agents/skills/code-review/SKILL.md`. Applied both substantive axes, including every Fowler baseline smell as a judgment heuristic (names, duplication, feature envy, data clumps, primitive obsession, repeated switches, shotgun surgery, divergent change, speculative generality, message chains, middle man, refused bequest). Owner's one separate reviewer overrides parallel-axis fanout; no other reviewers spawned. Standards sources: architecture, dependency proposal, identity/access and financial decisions, CONTEXT, tracker and recovery reconciliation. Spec sources: live #24 body/comments, Spec 001 inventory/reliability contracts, approved scope, implementation checkpoint and transport contract. No UI work; design/browser skills skipped. TDD/implement/handoff/PR procedures remain builder responsibilities; this worker reports findings without implementing fixes.

Live issue read initially failed with sanitized `error connecting to api.github.com`; supported escalation succeeded. Live #24 is OPEN, has no comments, and native blockers #8/#50 are closed. Direct GitHub PR reads confirm prerequisite PR36 merged at `221e74ae202db4ecf4f95c9beecb1962592cf5a1`, PR85 at comparison SHA. No stale local tracker substituted for these reads.

## Standards

No actionable documented-standard breach or baseline smell in the reviewed implementation. Feature routes/controllers/services/repository follow the approved concrete layout; cross-module currency access uses treatment's public entry. Authorization and writes share identity transactions; clinic-qualified queries, forced RLS and composite constraints complement permissions. Immutable batch/command runtime grants omit UPDATE/DELETE. No patient linkage, browser implementation, dependency or accounting expansion.

## Spec

**P2 — expose enabled currency choices to ordinary inventory consumers.** Initial `InventoryProjection` in `packages/contracts/src/inventory.ts` omits enabled currencies/precision, while `InventoryService.receive` requires a manager-enabled code. Existing GET `/catalog/currencies` uses `withManager` (`treatment.service.ts`); catalog access also requires unrelated authority. An ordinary inventory employee cannot discover valid receiving currency choices through the documented inventory contract. This leaves active #24 criterion “documented transport contracts sufficient for frontend consumers” incomplete. Expose scoped enabled code/precision reference through an inventory-authorized read and verify it with an ordinary inventory employee, including clinic isolation. Builder correction/recheck pending.

Other inspected criteria are implemented: item/supplier revision maintenance, whole packs and exact batch cost, optional/required expiry, explicit UTC inclusive day and warning boundaries, historical receipt names, read/receive independence, manager-only settings, historical/disabled denials, retries and clinic serialization. Consumption/corrections remain #25; frontend logic/UI remain #58/#71/#60/#76.

## Independent verification and limits

Direct reviewer command on initial HEAD: `npx vitest run apps/api/test/inventory.test.ts -t 'retries replay|clinic isolation|availability changes exactly|explicit read and receive'` using supported escalation against only isolated fictional `clinic-issue7-test` PostgreSQL: **4 passed, 9 skipped, 24.82s**. Covers concurrent duplicates/replay, permission independence/revocation/settings, two-clinic rejection/projections and exact UTC rollover. Reviewer did not run the full suite or DB fault trigger test concurrently with builder. Inspected that test's rollback/history/retry assertions and cleanup, without claiming independent execution. Builder test/type/lint/build claims are not independent reviewer results. No load, browser/product, Linux, production migration or real-data evidence is claimed.

## Same-reviewer correction recheck

Final code reviewed: `23308b453749be075eef8a1cdab05d7bae59d7e0` (`Expose authorized receiving currency choices #24`). Inspected its complete incremental diff and repeated full comparison `git diff --check`: PASS. `InventoryProjection.currencies` now supplies enabled `{code,precision}` rows under `inventory.read`, via the owning treatment module's public interface and clinic-scoped repository query. Existing currency enable publishes a clinic-wide invalidation, received by inventory streams; no manager/catalog permission is granted to readers. Documentation describes the field and sorting. The P2 finding is resolved.

Independent corrected-state command: `npx vitest run apps/api/test/inventory.test.ts -t 'inventory readers can discover'`: **1 passed, 13 skipped, 5.74s**, against the same isolated fictional PostgreSQL. Confirms ordinary inventory reader is denied `/catalog/currencies`, can read enabled MRU precision, and sees newly enabled JPY with precision zero in inventory. Earlier mistyped filter `inventory staff discover` selected zero tests (14 skipped); it provides no verification evidence and was replaced with the exact test name above. Cross-clinic query scoping was inspected; the original four-test isolated-clinic run preceded this additive correction and is not represented as a final-SHA rerun.

Final totals: **Standards 0; Spec 0 unresolved** (one P2 found and fixed). Independent review is complete for backend #24. Builder must still finish and record final full-suite and required checks, handoff and PR checkpoints; human approval remains required for merge. Reviewer did not independently rerun typecheck/lint/build or the full suite, and their eventual builder results must retain builder provenance.
