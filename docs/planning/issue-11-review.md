# Issue #11 independent review

Owner authorized #11 with `C:/Users/ayman/.agents/skills/implement-spec/SKILL.md` and selected merged main `eb90ef9c5d759405242036c8fedfcaad06fffb60` as the fixed comparison. Root is the separate reviewer; appointments_builder is the sole builder. The owner instruction replaces the skill's two parallel reviewers with one reviewer covering both axes.

Reviewed application: `c217425525887c567e694d96e948c86ed9e1d02b`, using `git diff eb90ef9...c217425` and the corresponding commit list. Subsequent evidence/publication commits must remain documentation-only.

## Standards

No residual material findings. Inspected the complete new scheduling implementation, routes/controller/service/repository separation, shared identity additions, contracts, SQL/schema, tests and frontend changes. Current authorization and mutation use the existing clinic lock/transaction; cross-clinic composite references, restricted runtime and FORCE RLS remain intact. Immutable appointment history and actor/payload-bound receipts preserve attribution/retry behavior. Clinical permissions remain guarded; manager settings access does not imply operational or patient clinical access.

Applied repository standards and Matt code-review's Fowler baseline. Early findings were sent to the same builder, who fixed persisted request-field leakage, inconsistent dentist readiness, postcommit reauthorization, settings access, midnight filtering, form resets, transient choices, lost-response handling, stale-row selection, form clipping and test assertions that could pass without a successful endpoint. Broad formatting churn was removed. A committed SQL CRLF whitespace finding was corrected in `3311cb4`; final pinned whitespace check passed. The reviewer made no application fixes.

## Specification

No residual material findings for #11's scheduling scope. Checked current GitHub issue criteria/native blocker #9, approved specification/scope, identity permission matrix, architecture/dependency decisions and design references. Verified booking/default duration, independent dentist/chair conflicts with explicit permitted override, half-open intervals, retained reschedules and optional cancellation reasons, free cancellation, arrived walk-ins, no automatic grants, clinic isolation, revisions, retry receipts and guarded streams. French forms provide the observable workflow and responsive/error states.

The seven scheduling states are represented; in-care/completed transitions are reserved for #15's atomic clinical visit integration. This ticket does not fake clinical visit creation. The future catalog interface reports unavailable with no suggestions until catalog integration. The custom dated agenda needs no new calendar library. Neither later integration is claimed implemented.

## Verification and provenance

- Root independently executed `node node_modules/vitest/vitest.mjs run apps/api/test/scheduling.test.ts apps/api/test/patient-access.test.ts`: **17/17 PASS**, two files, **43.45s**, against application `c2d840a` while subsequent changes were UI-only and migration line endings. Root inspected those later changes through `c217425`; backend behavior/tests were unchanged. No claim of an independent full-suite or browser rerun.
- Root directly ran the pinned full `git diff --check` through `c217425`: PASS. Inspected desktop/mobile screenshots in OS temp; the initial fieldset scroll trap was reported to the builder and corrected. Final screenshot inspection is recorded in the handoff.
- Builder-reported checks and observed failures are in [implementation evidence](issue-11-implementation.md). Those results remain attributed to the builder. Skill reads, reports and checklists alone do not establish execution.
- Fresh reviewer sources: repository `.agents/skills/code-review/SKILL.md`, `tdd/SKILL.md` with tests/mocking references, `codebase-design/SKILL.md`, `handoff/SKILL.md`; exact owner-requested implement-spec; bundled React and frontend-testing-debugging instructions; current AGENTS and skill-integration workflow. Reviewed both standards and specification, retaining the owner's single-reviewer/manual-merge overrides. PR writing source `C:/Users/ayman/.agents/skills/pr/SKILL.md` read before publication.

No live email, production migration/deployment or real patient data used. Actual clinical visits, real catalog suggestion data, production ingress/SSE, restore/performance and qualified clinical/legal gates remain outside this ticket. Human review/manual merge is still required.
