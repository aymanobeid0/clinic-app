# Issue #58 independent review

Reviewer: `/root/reviewer58`, one independent worker covering Standards and Spec, per owner override of Matt's two-worker instruction. Builder fixes remain separate. Fixed fresh-main comparison `ba12e8aa2749862cab582218be7ab1ced8e65012`; reviewed source `947e897d785770f584835ef3a5f98580476b8b98`. Commands: `git diff ba12e8aa2749862cab582218be7ab1ced8e65012...947e897d785770f584835ef3a5f98580476b8b98`, corresponding `git log base..source --oneline`; nonempty comparison inspected. `8a047b1` preserves earlier owner tracking edits separately.

Sources read: repository AGENTS.md, HANDOFF.md, docs/agents/{skill-integration,issue-tracker}.md, `.agents/skills/code-review/SKILL.md` including its full Fowler smell baseline, relevant application-architecture and Spec001 inventory/state rules, docs/api/inventory.md, shared command/read/identity/lifetime implementation and contracts. React source: `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` and `rules/rerender-dependencies.md`. No design, discovery, new testing seam or implementation skill workflow needed for this review role. Live #58/#24/#25 criteria and dependency status in the inherited builder read are provenance from builder execution, not a separate reviewer service read.

## Standards

No actionable documented-standard breach or baseline smell found. Feature hooks keep Query server state and RHF input ownership, reuse transport/shared lifetime mechanisms, and add no product UI/backend/schema. Tool-enforced style/type issues are excluded from smell findings.

## Spec

- **[P2] Refresh stock after a retried command conflicts.** `apps/web/src/features/inventory/useInventoryForm.ts:95` exposes retry directly as `command.retry()`, bypassing the root invalidation used after failed `submit`. #58 requires “retry handling, authorized state and invalidation”; docs/api/inventory.md requires “A stale correction returns 409; refetch and reconcile using a new command ID.” With an initial lost response followed by a stock/expiry/revision409 on retry, the hook surfaces the conflict but leaves the previously read batch availability/revision unchanged until an unrelated event/focus refresh. Independent browser reproduction on pinned source: read5 packs, first POST aborted, retry409 `Stock insuffisant`, stock still5 rather than fresh0. Reconcile retry failure through the same inventory refresh path; retain exact retry command identity.

## Verification and limitations

Reviewer directly ran `npm run test:browser --workspace @clinic/web -- inventory-workflows.spec.ts`: **16/16 PASS,13.7s** on pinned source. Direct pinned `git diff --check` passed. Additional temporary reviewer-only `issue58-review-retry.spec.ts` independently **FAILED1/1**,7.5s including setup: expected `availablePacks:0`, received5. Kept temporarily for builder adoption; no application fix made by reviewer. Browser tests mock only the HTTP boundary and are not a claim of live-server authorization/concurrency proof. Builder full Vitest is still running; reviewer did not run database tests concurrently, nor independently run full suite/type/lint/build. Final evidence/handoff and fix recheck remain pending.

Initial totals: Standards0 (no worst issue); Spec1 (worst P2). Publication is pending the builder fix and same-reviewer recheck.

## Same-reviewer fix recheck

Fixed source `91d343dbccd27c8fe0b35bb1f4712f6aa977f39d` inspected against original source and the pinned base. Builder added inventory-root refresh after undefined retry results; exact retained command replay remains owned by the unchanged shared command workflow. The reviewer reproduction was adopted into the tracked browser suite and the temporary file removed. Reviewer independently reran the complete affected browser file: **17/17 PASS,13.8s** including the formerly failing retry409 case. Pinned diffcheck passed. No new Standards/Spec findings; the one initial Spec/P2 is resolved.

No imported Vitest input changed in the fix: the new feature hooks remain used only by the browser verification harness, and the added `.spec.ts` case is outside Vitest's `.test.ts` inclusion. Keeping the already-running full suite plus final affected browser verification is proportionate; no redundant full-suite restart requested. Full-suite completion and final handoff/evidence checkpoint remain pending.

Recheck totals: Standards0 (no worst issue); Spec0 unresolved (initial P2 fixed).
