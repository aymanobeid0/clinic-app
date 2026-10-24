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

Initial totals: Standards **0**, Spec **1 P2**. No publication approval implied.

## Same-reviewer recheck — 2026-10-24

Reviewed fixed commit `3c535b21d992575da7f3326ddc490f177b338893` against the same owner baseline, the complete comparison, and the fix diff from `2bd25e3`. The common command handler now reconciles HTTP 401/403 through the registered identity query; account/clinic query denials do the same. The identity query removes cached identity as well as other sensitive records on a failed refetch, so a known password-change success followed by lost network cannot leave the old workspace available. Ordinary 409 does not trigger scope cleanup. The initial P2 is **resolved by inspection and focused regression execution**.

The two added actual-application browser scenarios cover demotion followed by a denied 403 command and password-change 204 followed by network loss. Reviewer inspected them but did not execute them while the builder's full suite was using the isolated database. Also inspected the uncommitted test-only locator correction scoping the password-change fields to their form; it changes no runtime behavior. Builder must record their eventual results and the final test commit separately.

Direct reviewer checks on fixed runtime: `npm run typecheck` **PASS**; `npx vitest run apps/web/test/identity-workflow.test.ts` **6/6 PASS, 853 ms**; pinned comparison `git diff --check` **PASS**. The only pre-existing working-tree modification at that rerun was the browser locator correction, so these focused test results apply to committed focused tests/runtime at `3c535b2`. No database/browser/full-suite/lint/build rerun by reviewer. Full-suite and browser completion remain builder verification, not inferred from this review pass.

Additional applicable sources read for the recheck: `D:/clinic-app/.agents/skills/codebase-design/SKILL.md` for interface/seam vocabulary only; `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` and `rules/rerender-dependencies.md`. Approved TanStack Query/no-sensitive-persistence rules take precedence over generic SWR/storage suggestions. No alternative-design fanout was run.

Final review totals at `3c535b2`: Standards **0 unresolved**, Spec **0 unresolved**. Human review and exact publication approval remain required; product UI, live mail, deployment, restoration and real-data acceptance remain excluded.

## Final test/evidence recheck

Final tested-source commit: `56297f36c563dfc00d8cbcf287dac2aebf760c2b`; runtime remains `3c535b21d992575da7f3326ddc490f177b338893`. Reviewer directly verified no `apps/web/src` diff between those commits and reviewed all intervening test changes. Explicit 403 permission-loss reconciliation was added to the focused public-workflow scenario alongside the real-session 401 case. The demotion browser fixture serves a captured earlier identity until the denied write to prevent SSE from resolving the condition before the write; the write still reaches the real API. Actual backend demotion revokes that session and yields **401**, correcting the earlier fixture assumption of 403. Scoped password-form locators remove ambiguity without changing behavior. No new findings from those changes.

Reviewer independently reran final focused tests at `56297f3`: **6/6 PASS, 594 ms**, including explicit 401, 403 and 409 observations. Pinned comparison diff check **PASS**. Directly inspected final test source; no independent browser/database/full-suite rerun.

Builder reports final identity browser **9/9 PASS, 26.2 s** on the tree committed as `56297f3`; focused **6/6 PASS, 802 ms**; full `npm test` **247/247 PASS, 21 files, 552.84 s**. Full-suite provenance matters: it launched at `2bd25e3` and frontend fixes/tests landed while unchanged backend suites ran. It is not an entire-suite launch from `56297f3`. Exact final frontend coverage is separately pinned by final focused/browser checks. Builder also reports lint/build PASS at runtime `3c535b2`, with the existing >500 kB warning (528.95 kB / 153.70 kB gzip). These are attributed builder execution results, not reviewer-run checks; final documentation must preserve that distinction.

Final inspected source `56297f3`: Standards **0 unresolved**, Spec **0 unresolved**. Publication approval is still separate.

## Final documentation readback

Reviewer read the completed `issue-52-implementation.md`, current #52 `HANDOFF.md` entry and this report. Runtime/test/source pins, initial finding and disposition, final checks, mixed-launch full-suite provenance, skill overrides, omitted checks, unrelated-file preservation, isolated test-project cleanup and separate publication/human-merge authorization are consistently recorded. Intermediate pending statements above are historical and superseded by their final evidence sections. No outstanding checkpoint omission or documentation blocker found. Reviewer directly compared SHA256 of tracked HANDOFF and the actual `C:/Users/ayman/AppData/Local/Temp/clinic-app-HANDOFF.md`: **equal**. Cleanup and builder-run browser/full-suite results remain attributed builder evidence, not reviewer execution. The next commit may contain this evidence-only readback without altering reviewed runtime/tests.
