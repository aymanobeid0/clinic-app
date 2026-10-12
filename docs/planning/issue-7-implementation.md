# Issue #7 — manager onboarding and authentication

Updated: 2026-10-12. Continued from the published initial session slice in commit 3227073 and documentation commit 6e797a5 on codex/issue-7-manager-bootstrap. Draft PR #32 remains open; owner-approved planning #2–#6 is closed. No merge, deployment or real-data authorization is implied.

## Implemented scope

Operator-only stdin provisioning creates a persistent clinic and initial manager atomically; no public registration endpoint. Clinic-code/case-insensitive username login follows the existing contract. The owner removed/deferred the concurrent manager-email-login proposal on 2026-10-12; revisit it separately after #7.

Temporary passwords expire after 24hours, are replaced once under an account lock, and revoke existing sessions through a credential version. Sign-in regenerates session identity/CSRF and starts a fixed 12-hour maximum. Restricted onboarding requires a real recovery email, single-use 24-hour verification, ten hashed recovery codes shown once and confirmation of saving. Replacement credentials invalidate prior verification tokens/code batches. Lost code display requires current-password-confirmed regeneration. Clinic data stays denied until setup is complete. Recovery consumption, employee accounts and permission management belong to #8.

A replaceable mail adapter is injected only by isolated fictional tests. The shipped runtime has no live delivery adapter and returns 503 for verification requests; no fake verification fallback exists. Live provider/sender/domain/budget/tested delivery remains a gate. Verification links use fragments, are captured/removed from browser history and verified by authenticated CSRF-protected POST.

## Owner-approved organization

On 2026-10-12 the owner requested and approved feature folders with Routes -> Controller -> Service -> Repository. See docs/architecture/application-architecture.md for the explicit file tree/responsibilities. API modules/identity owns all onboarding behavior; middleware owns sessions/CSRF/safe errors; database owns pool/runtime-role checks/scoped transactions. Controllers parse transport schemas and handle HTTP/session changes; services own rules; only repositories query Prisma. Account locks/checks/writes stay inside one transaction. Frontend features/identity has separate forms, typed HTTP operations, query/page actions and a small step-selection view; main only mounts providers.

## Isolation and credentials

Prisma migrations create clinic/account/recovery-code persistence and clinic_runtime capability role without a login. Operator provisioning needs a separate privileged connection able to bypass FORCE RLS; a non-super table owner alone is insufficient. Production role setup remains a rehearsal gate. Runtime operators supply a separate non-owner LOGIN; API startup rejects superuser, bypass-RLS, role/database creation and table-owner permissions. RLS policies restrict clinic/account/code tables using transaction-local scope. The real runtime Prisma pool was checked across two clinics with concurrent transactions, deliberately unfiltered reads and no context after transaction completion. Application authentication and setup restrictions remain mandatory.

Test-only prepare validates the dedicated loopback clinic_issue7 target before invoking Prisma and forces that validated URL, so an ambient DATABASE_URL cannot redirect test migration. Fictional test role has no production credentials. Only clinic-issue7-test Compose was used; other databases/services were untouched.

## Verification and review

Behavioral red/green cycles demonstrated missing sign-in, password replacement and email verification endpoints before implementation. First tooling failure was a missing module, not a successful behavioral test. Later regression/security cases were added after implementation; no blanket test-first claim. Existing approved seams are HTTP/application behavior against isolated PostgreSQL, runtime-pool isolation and the French browser journey.

Builder checks after refactoring: 12HTTP tests and two Chromium French journeys passed. Browser also proves account-loss/switch clears old recovery codes; it covers failed-login retry, initial password replacement, email link capture, codes confirmation, reload persistence and sign-in/out; mobile 390px has no horizontal overflow. Typecheck/lint/build/audit final outcomes and independent review are recorded in issue-7-continuation-review.md. Screenshots and browser downloads remain ignored local artifacts, not published patient data.

Local platform: Windows Node 24.13.0/npm 11.6.2, isolated Linux PostgreSQL 18.6. Planned Node 24.21.0/npm 11.19.0 Linux API/native compatibility and deployment ingress/secure cookies remain unproven. No live email, external purchase, deployment, live migration or patient-data operation occurred.

## Initial dependency evidence retained

Pinned Prisma 7.10 CLI/client/adapter and approved direct candidates remain. Root CLI-only overrides deepmerge-ts 8.0.2 and mysql2 3.24.5 removed four initial audit findings; MySQL is not application persistence. Generation/migration passed with the overrides. Original clean npm ci passed on 2026-10-11 after exact-version archive resolution/integrity metadata was restored from the original npm-generated lock, without invented hashes. No dependency versions changed during continuation; package manifests change scripts only. PostgreSQL 18.6 image digest remains pinned. See issue-7-initial-review.md for the dated initial review and its limitations.

Prisma MCP was used for documentation lookup on transactions/RLS only. No cloud resources were created and no newer ORM API examples replaced pinned 7.10 behavior. Applicable contractual performance/recovery/legal/real-data gates remain in prerequisite decision notes.
