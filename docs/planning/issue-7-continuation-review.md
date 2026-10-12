# Issue #7 continuation review — 2026-10-12

One builder and the same separate reviewer (identity_reviewer, resumed) reviewed both standards and specification for continuation since 6e797a5. Owner-approved 506b549 remains overall comparison context. Unrelated design relocations, concurrent AGENTS changes and HANDOFF are excluded. Reviewer made no code edits and did not independently rerun runtime checks.

## Standards

Pass. The owner explicitly approved feature-based Routes -> Controller -> Service -> Repository, now documented in application-architecture.md. Controller owns HTTP/session handling; service owns rules/workflows; repository owns Prisma/scoped atomic persistence. Frontend forms are separate. Initial French encoding and whitespace findings are fixed; UTF-8/no-replacement and staged whitespace checks passed.

## Specification

Pass for #7 fictional-data onboarding/authentication scope; no remaining actionable findings. Owner removed/deferred the concurrent manager-email-login amendment; clinic code plus case-insensitive username remains current. Recovery consumption/staff administration belongs to #8.

Reviewer found a P1 shared-PC recovery-code leak: codes survived authentication loss and could display for another manager. Builder wrote a real browser regression that failed with ten old codes, then fixed it with server-derived clinic/account ownership, clearing on auth loss/sign-in, visible-batch confirmation and account-keyed clinic queries. Same reviewer rechecked the fix and regression: pass, no additional actionable findings.

## Actual builder checks

After final code changes: 12HTTP tests, typecheck, lint, API/contracts/web build and 2Chromium journeys passed. Journeys cover complete French setup/sign-in/out, invalid-login retry, same-page verification links, persistence after reload, mobile 390px/no horizontal overflow and cross-clinic/same-username shared-PC auth loss without exposing old codes. npm audit reports 0 findings; dependency versions did not change. Isolated migrations and test role preparation passed/idempotent.

Runtime tests use loopback fictional PostgreSQL 18.6 and a non-owner runtime role through the real Prisma pool. Local Node 24.13.0/npm 11.6.2. Linux API/native compatibility, deployment proxies/secure cookies and live email delivery are unproven. The shipped runtime intentionally has no live mail adapter and cannot complete live email verification; fake delivery exists only in isolated tests. Operator provisioning requires privileged separate credentials able to insert despite FORCE RLS; a non-super table owner alone is insufficient. Production role provisioning/rehearsal remains gated.

This review does not authorize merge, production deployment, live migration, purchase or patient-data use. PR #32 requires human review/merge; issue #7 remains open until accepted/merged.
