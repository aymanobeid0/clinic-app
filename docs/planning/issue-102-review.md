# Independent review — #102

Reviewer: `/root/reviewer102`, sole reviewer for Standards and Spec under the owner override. Review baseline supplied by builder: `b1a527830ea8c5aa0412c3b3e45accc19c93f495`; initial review compares `git diff b1a527830ea8c5aa0412c3b3e45accc19c93f495` against the in-progress working tree, including the newly added validation/form files. No implementation edits by reviewer. Final source pin/recheck pending.

Read actual `D:/clinic-app/.agents/skills/code-review/SKILL.md`, AGENTS/HANDOFF, skill-integration/tracker, relevant architecture/dependency browser-state/message rules, the saved error plan and cause/recovery review, actual current #102 acceptance criteria, and design/token introductions as scope context. React guidance read from installed `build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` and `rules/rerender-dependencies.md`. Applied two-axis review and the skill's heuristic smell baseline in one worker. No fanout, implementation/TDD/discovery/design workflow by reviewer; this role reports rather than fixes implementation. Initial live GitHub read failed with `error connecting to api.github.com`; supported read-only escalation succeeded. No remaining service blocker or credential-invalid inference. No PR merge check.

## Standards

1. **P3 — translation interface for new browser guidance.** `ValidatedForm.tsx` and `identity.api.ts` initially inline new French error/recovery text. Architecture requires French strings behind a translation interface. Move these strings behind the focused shared validation/transport/form message interface; no translation framework is needed. This is the same documented boundary enforced in #59, not a demand to reorganize unrelated legacy messages. Builder notified; disposition pending.

No other actionable smell or architectural state-boundary violation identified so far. Query/server authority, transient RHF values and private React feedback remain distinct; no persistent sensitive store added.

## Spec

1. **P2 — exclusive numeric limits must be truthful.** Initial `validation.ts` renders every numeric `too_small`/`too_big` as inclusive. Existing positive revision schemas reject zero, but guidance says “supérieure ou égale à 0”. Respect `issue.inclusive` and verify a positive-revision HTTP rejection. Found by inspection; builder has begun correction before any reviewer runtime execution.
2. **P2 — preserve valid login identifiers after rejection.** `SignInForm` unconditionally resets after awaiting `onSubmit`, while `useIdentitySession.signIn` discards `run`'s result with `.then(() => {})`. Thus credential/field/network failure also clears valid email or clinic/username. #102 explicitly requires displaying guidance without silently losing valid non-secret input. Propagate success or otherwise preserve identifiers on failure; deliberate secret clearing may remain. This behavior predates the change but is retained inside a touched consumer covered by the new acceptance criterion. Builder notified; disposition pending.
3. **P2 — named missing-field guidance must cover the existing inventory correction form.** `countedPacks` is a required field of the known count branch, but initially absent from the path/label allowlist. Also the frontend correction schema uses root `.or` branches; `validationFields` skips root `invalid_union`, leaving only generic feedback for a known `kind=count` with a missing count. Include the known field and use the unambiguous discriminated branch (or equivalent safe union handling) to identify the missing field. Require a focused public consumer/HTTP regression. Builder notified; disposition pending.
4. **P2 — unknown response bodies must not invent the security cause.** Initial `readResponse` fallback maps every non-JSON401 to missing/invalid session and every403 to missing business permission. The reviewed contract explicitly distinguishes current-password confirmation401 and CSRF403; when structured cause is unavailable, status alone cannot establish those claimed causes. Use honest generic security/authentication recovery advice for that fallback while preserving known server JSON messages. Builder notified; disposition pending.

## Verification and limitations

Initial findings are source-inspected, not independently reproduced runtime failures. Builder's red/green and passing test statements remain attributed to builder; no reviewer full suite/browser/database/type/lint/build result is claimed yet. Final focused execution and source disposition will be recorded after fixes settle. Reviewer did not touch owner/ERP/Apidog resources, stash, owner notes, databases, credentials or real data. This report is the reviewer's sole file edit.

Initial totals: **Standards1 (worst P3); Spec4 (worst P2). Final residual pending same-reviewer recheck.**

## In-progress source recheck

Builder fixes inspected in the working tree: numeric inclusive/exclusive advice, the dedicated `forms/error.messages.ts` interface, SignIn identifier preservation with deliberate password clearing, neutral body-unavailable401/403 advice, and the known counted-packs label plus preserved discriminated inventory correction schema address the reported findings. No additional blocker identified in that recheck. Shared custom/refinement failures retain safe known-field guidance instead of serializing arbitrary validator messages.

Reviewer independently executed `npx vitest run apps/api/test/errors.test.ts` through supported local-loopback escalation: **11/11 PASS, one file,725ms, exit0**, start09:44:00 UTC, on the then-current working tree. This includes the added exclusive-positive revision regression. No reviewer failing-red execution is claimed: builder fixes preceded this run. No database was used.

Before final acceptance, reviewer requested consumer evidence for the new export-scope discriminator (403 scope-change permits fresh generation while genuine403 remains blocked) and noted that the shared handler's assumed input source (`req.body ?? req.query`) can misattribute query-validation guidance when a JSON body is also supplied. Builder is settling these checks/source; final pin and final execution remain pending.

## Final source recheck — `23e4800`

Reviewed fixed application/test commit `23e4800372ccb676c5234418fac0b74d927224cd` against the unchanged baseline. All initial Standards/Spec findings are resolved by source inspection and relevant focused regressions. Query/body misattribution is removed: the shared boundary consumes the configured validator's safe missing/empty classification and never guesses the failing schema's input source or serializes its raw message. The added GET-with-unrelated-JSON-body HTTP case verifies that distinction. The export machine discriminator is narrowly emitted for the authorization-stamp mismatch; current server generation/delivery authorization remains mandatory, while genuine403 continues to lock the consumer.

Independent final executions at that pin:

- `npx vitest run apps/api/test/errors.test.ts`: **12/12 PASS, one file,916ms, exit0**, start09:47:55 UTC. Database-free Supertest/Express seam; includes missing/nested/bounded safe fields, positive numeric limits, query-source attribution, preserved AppError statuses and safe unexpected/stream logging.
- From `apps/web`, `npx playwright test --config error-review.playwright.config.ts error-guidance.spec.ts reporting-workflows.spec.ts`: **25/25 PASS,20.5s, exit0**, temporary development port4180 released afterward. Existing HTTP-boundary mocks only, no database. Covers native multi-missing feedback, French resolver field feedback, identifier preservation/secret clearing, missing counted-packs guidance, server field feedback with retained input, export scope-change regeneration versus real403 lock, uncertainty/exact retry, scope retirement, expiry/cleanup/hash and report failure/refresh behavior.
- Pinned comparison `git diff --check b1a527830ea8c5aa0412c3b3e45accc19c93f495...23e4800372ccb676c5234418fac0b74d927224cd`: **PASS**. Direct application/test working-tree diff from the reviewed pin was empty before execution.

No independent initial failing-red execution is claimed for review findings: builder fixes preceded reviewer execution. Builder's shared60-browser result, full database suite, type/lint/build, generated OpenAPI freshness and resource-cleanup evidence remain builder work; the reviewer has not independently rerun those checks. Final full-suite/documentation checkpoint was still pending at this source-review completion. Review is not final product UI, complete connected journey, deployment, restoration, legal/pilot, live-mail or production acceptance.

Final source residual: **Standards0 / Spec0**. No source finding blocks publication after the builder completes required verification/documentation and provenance checkpoints. Human merge remains separate.

## Documentation draft checkpoint

Inspected current `issue-102-implementation.md`, `docs/api/errors.md`, staged Apidog patch and generated OpenAPI delta after the source review. They accurately document field bounds/known-path sanitization, neutral cause handling, narrow export recovery, uncertain retries, test provenance and production/UI limits. The staged Apidog change preserves the owner's separate planning paragraph unstaged. The large generated delta comes from reusable error examples/schema additions and JSON429 documentation, not new operations. No new Standards/Spec finding. Builder's full-suite result is explicitly pending in this draft; final HANDOFF/mirror/resource-cleanup and completed result readback remain pending. No further tests run by reviewer at this documentation checkpoint.
