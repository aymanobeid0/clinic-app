# Issue #8 independent review — 2026-10-13

Reviewer: coordinating root agent, separate from the sole accounts_builder implementation worker. Applied the user-invoked bundled mattpocock-skills:code-review; the owner's one-reviewer rule replaces its two-agent split. Both axes remain separate.

Owner-confirmed fixed point: `b8dc3b51f13e01be085bf815e0f9bba7da65f4cd`. Reviewed implementation: `64335cb2339763e0e9c3eb17063a6c1e35ffe1e0`.

Pinned comparison: `git diff b8dc3b51f13e01be085bf815e0f9bba7da65f4cd...64335cb2339763e0e9c3eb17063a6c1e35ffe1e0`. Commit list: `64335cb Implement individual accounts, permissions and manager recovery`. Both refs resolve and the 27-file diff is non-empty. Subsequent review/publication documentation does not change application code.

Sources: live GitHub issue #8 (unchanged criteria, no comments), closed prerequisite issues #2–#7, merged PR #35, AGENTS.md, docs/agents/issue-tracker.md and skill-integration.md, CONTEXT.md, spec-001-clinic-mvp.md, identity-access-decisions.md including the login amendment, application-architecture.md, dependency-proposal.md, identity-module-design.md and the owner-deferred visual-design scope. Checked the skill's Fowler smell baseline with repository rules taking precedence.

## Standards

No residual material findings. Feature routes/controllers/services/repositories retain ownership; controllers validate transport, services authorize and orchestrate, repositories persist. Identity authentication/readiness checks are shared. Actor validation, target checks, revision comparison and mutation run in one clinic-scoped transaction with consistent lock ordering. The reservation table has composite tenant/account references and FORCE RLS; runtime-role validation includes it. Login method, manager authority and doctor/staff eligibility remain independent. Browser server records use TanStack Query and form drafts use React Hook Form; one-time codes remain account-owned local memory. No generic security-field patch or new dependency was introduced.

Early architecture findings were corrected by the same builder and rechecked: composite reservation references, reservation during provisioning, shared readiness validation and stable loaded revisions for dirty forms. No additional smell finding warrants a change within this scope.

## Spec

No residual material findings for #8. Checked account creation without count caps, manager-only administration and current-password confirmation, retired identifiers, temporary credential replacement, any-PC sessions, live permission reads, explicit promotion/demotion/status workflows, cross-clinic denial, last-manager concurrency, password/session revocation, restricted single-use code/email recovery, expiry/replacement, lost-mail verification and old-address notification. French journeys cover creation/denial, promotion login, recovery, ready-manager code rotation and stale-edit reconciliation.

Earlier specification findings were corrected and rechecked: old verification links surviving reset; missing old-mail notification target; eligibility leakage on failed recovery delivery; recovery rate-limit key parsing; lost-mail field locked in the browser; failed/stale forms losing input; historical-only screen; missing optimistic conflict detection; and inaccessible code rotation for a ready manager.

## Verification and limits

Reviewer independently ran `npm test -- apps/api/test/accounts.test.ts` against the dedicated fictional PostgreSQL runtime: 10/10 passed, one file, 14.13 seconds. Reviewer independently checked the pinned diff for whitespace and inspected application code, migrations and HTTP/browser tests. Builder's final evidence: 26 HTTP tests, six Chromium journeys, typecheck, lint and contracts/API/web builds passed. Reviewer did not independently repeat the entire suite, browser suite or builds.

Capabilities configured here are not proof of future patient/clinical/financial/file scope enforcement or operational SSE revocation. Those consumers do not exist in this slice. Live mail/provider delivery, Linux/native runtime, production role/ingress/security, restoration and real-data/legal gates remain. No production migration, deployment, external mail or real patient data was used. Human approval is required before merge; issue #8 remains open until acceptance.

Standards: 0 residual material findings, no remaining worst issue. Spec: 0 residual material findings, no remaining worst issue.
