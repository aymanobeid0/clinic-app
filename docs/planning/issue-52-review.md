# Issue #52 independent review

Reviewer: `/root/reviewer`, one independent worker covering Standards and Spec; no fanout or implementation fixes. Owner-selected comparison: `28b1bb0c2c43dfac998c695b083b3b9503508606`. Initial reviewed commit: `2bd25e3a717bf145c3d6c8751cfd08d0762cf1a7`. Resolved both refs, confirmed nonempty `git diff 28b1bb0c2c43dfac998c695b083b3b9503508606...HEAD` and read the single implementation commit in `git log <base>..HEAD --oneline`.

Fresh skill checkpoint: read `D:/clinic-app/.agents/skills/code-review/SKILL.md`, applicable `tdd/SKILL.md`, `tests.md` and `mocking.md`; read `AGENTS.md` and `docs/agents/skill-integration.md`. The owner/repository single-reviewer override replaces the skill's parallel-axis fanout. Reviewed the full smell baseline as heuristics, suppressing matters covered by tooling. Standards sources: approved application architecture/dependency proposal, state ownership, credential/draft rules and tracker governance; targeted discovery found no separate CONTRIBUTING/CODING_STANDARDS source. New product discovery, design/visual and implementation workflows are unnecessary for this review-only role.

Directly fetched live #52/#49/#7/#8 through the GitHub connector, including source archives and delivery boundaries. Read Spec 001 identity/reliability clauses, Spec 002 stage 2, identity-access-decisions, recovery reconciliation and the builder's trace mapping. No live issue/body or code mutation by reviewer.

## Standards

No actionable documented-standard or heuristic-smell findings in the initial diff. Feature transport, query orchestration and form coordination have focused owners. No backend authority/persistence duplication or dependency/visual scope expansion found. Private React state and React Hook Form are appropriate here; there is no new shared UI state requiring Zustand. Formatting and naming nits are not review blockers.

## Spec

**P2 — reconcile denied identity/account commands before retaining the old scope.** At `apps/web/src/features/identity/useAccounts.ts:21–24`, identity refresh/invalidation only runs after successful action and successful refreshSession. A manager disabled/demoted or expired on another PC can submit an account mutation and receive 401/403; `useIdentityCommand` displays the message while old account records, identity and drafts remain mounted. The same gap follows a successful self-password change if the subsequent session refresh fails: the server has revoked sessions, but browser reconciliation never runs. `sendVerification`/`verifyEmail`/`regenerateCodes`/`confirmSavedCodes` similarly handle denial only as a message. #52 requires “successful and denied transitions … and sensitive cache cleanup”; Spec 002 requires API failure states and session/cache transitions to be handled. Reconcile on authentication/access denial and ensure known session-revoking commands remove sensitive browser state even when the following request fails; preserve ordinary 409/network draft behavior when access is still valid. Add observable regression coverage rather than broadly clearing all drafts for every validation/conflict error.

## Verification provenance and limitations

Reviewer directly ran typecheck successfully and pinned comparison `git diff --check` successfully on initial `2bd25e3`. Independently ran `npx vitest run apps/web/test/identity-workflow.test.ts`: **4/4 PASS, 817 ms**. At the focused rerun, the shared working tree already showed the builder's in-progress test-file edit; this rerun is attributed to that working-tree state rather than silently claiming identical committed test bytes. No reviewer database/browser/full-suite/lint/build execution: builder is using the isolated #52 database and owns those checks. The builder's browser/full-suite claims remain builder-reported, not independently rerun. No deployment, live mail, real-data, restoration or product-design acceptance established.

Initial totals: Standards **0**, Spec **1 P2**. Fix and same-reviewer recheck pending; no publication approval implied.
