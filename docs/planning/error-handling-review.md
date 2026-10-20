# Error-handling maintenance independent review

One independent reviewer, covering Standards and Spec; no implementation fixes or additional agents. Freshly read AGENTS.md, docs/agents/skill-integration.md, tracker rules, repository `.agents/skills/code-review/SKILL.md` and its complete Fowler baseline, relevant application architecture and logging dependency rule. Owner override replaces review fanout. Implementation/TDD and handoff were considered but belong to the builder; no UI/design, discovery or new dependency workflow applies to this backend maintenance review.

Pinned owner comparison main-at-start `883295110e8e76d6518c74556e9fe7dd97df76e0`; initial reviewed HEAD `fb3336733cd009b69dd7d8fdfc87c00d4fa673d6`. Independently resolved both, confirmed nonempty `git diff 883295110e8e76d6518c74556e9fe7dd97df76e0...HEAD`, and read the one-commit log. Spec is the explicit owner maintenance request preserved in error-handling-maintenance.md; no assigned issue/blocker is inferred. Builder reports direct PR80/base verification; reviewer did not repeat that GitHub query.

## Standards

No separate actionable Fowler smell or module-boundary finding. Shared AppError/logger belong to backend infrastructure; feature imports move away from identity-owned error export. Repository search found no remaining IdentityError references in apps/packages. Statuses/messages and feature business logic remain unchanged by the mechanical import/constructor migration. No contracts split, async-wrapper framework, product UI or database change.

The privacy defect below also conflicts with dependency-proposal.md's logging rule excluding credentials and clinical content. It is one underlying finding, tracked under Spec rather than counted twice.

## Spec

**P2 — Prevent Express's raw fallback logging after headers have been sent.** `createErrorHandler` logs safe metadata then forwards the original error, but application.ts installs no downstream error handler. Installed Express `lib/application.js:156` configures finalhandler with `onerror: logerror`; `logerror` at lines 615–617 executes `console.error(err)` outside test mode. Installed finalhandler schedules this callback before destroying the headers-sent socket. A production streaming failure containing patient/SQL/credential information therefore still reaches stderr unsanitized, contrary to the owner contract “log unexpected failures without leaking sensitive data.” Preserve original-error forwarding but supply safe terminal handling so that fallback cannot serialize it. Add a real HTTP regression covering production headers-sent behavior, connection termination and stderr/privacy. Current test's custom downstream handler masks this application composition gap. Builder notified; fix pending same-reviewer recheck.

Other inspected behavior matches scope: Express5 returned promise rejection reaches middleware; AppError, Zod, unique-conflict and body-parser status/French JSON mappings are retained; registered route patterns replace concrete URLs/parameters in structured logs; error names are allowlisted and raw errors/messages/causes/stacks are excluded from Pino fields. The headers guard forwards the same original object.

## Verification and disposition

Reviewer directly executed `npx vitest run apps/api/test/errors.test.ts` on `fb33367`: **7/7 passed**, 963ms, after initial sandbox loopback EACCES failures were resolved through supported escalation. These seven tests do not establish the missing production fallback behavior. Reviewer independently ran `npm run typecheck` and `git diff --check 883295110e8e76d6518c74556e9fe7dd97df76e0...HEAD`: passed. Inspected installed Express/finalhandler source directly for the finding; no external documentation assumption or internal collaborator mock is needed.

Builder reports targeted7, type/lint/build and fresh isolated28 migrations passed; initial full suite is still running. Those are attributed worker results, not independent full-suite execution. Reviewer did not touch the shared integration database. No production operation, live migration, browser acceptance or real patient data used.

Initial disposition: Standards 0 separate findings; Spec 1 P2 unresolved. Hold publication/final approval until fix, meaningful regression, required final checks and same-reviewer recheck. Human merge remains required.

## Same-reviewer recheck

Reviewed fix `4be65b6d789f66aec348dc85b841c830c50bf43c` and the pinned-base diff again. P2 resolved: application composition now uses `installErrorHandling` last; primary middleware still forwards the original exception, and an immediately following terminal handler destroys the response without passing the sensitive error into Express's raw fallback logging. Existing French/status mappings and feature import migration remain unchanged. No additional Standards or Spec findings identified.

Reviewer independently executed all middleware HTTP tests on `4be65b6`: **8/8 passed**, 702ms, through supported escalated loopback execution. New production-mode regression uses the same installed pipeline as application.ts, observes an aborted connection, zero `console.error` calls and one safe Pino entry without the secret. External console capture is an observability boundary, not an internal collaborator mock. Existing separate delegation test still proves the original exception reaches the next handler. Reviewer pinned-base diff check and `npm run typecheck` passed on this fix.

Builder reports the initial full-suite run was interrupted to fix this finding; it establishes no final pass. Final full suite is running on `4be65b6` and must be recorded with final type/lint/build and handoff evidence before publication. Reviewer did not independently rerun that shared-database suite.

Substantive final disposition: **Standards 0 / Spec 0 unresolved findings (one P2 fixed and independently regression-tested)**, subject to completed/recorded builder verification and human review/manual merge.
