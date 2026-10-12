# Issue #7 email-login amendment review — 2026-10-12

Scope: owner-approved primary-manager email/password login and independent manager authority. Original owner comparison context: 506b549. This amendment is the scoped working delta from merged main 54911fe, including new migration and email-login tests; unrelated AGENTS/design/HANDOFF changes excluded. Same separate identity_reviewer checked standards and specification; one builder implemented/fixed.

## Standards
Pass. No remaining actionable findings. Feature-based routes/controller/service/repository boundaries remain intact. Reviewer inspected code/tests and ran git diff --check, without independently rerunning runtime tests.

## Specification
Pass. Primary manager provisioning reserves a normalized globally unique login email; unverified sessions permit restricted activation only. Employees and doctors granted manager authority retain clinic-code/username/password login. Login method and authority are separate persisted attributes. Exact-email pre-authentication lookup has a SELECT-only RLS policy, without clinic visibility or write authorization.

Reviewer P2: the initial database constraint coupled email login to manager authority, preventing demotion while preserving login. Fixed by removing that coupling and keeping email verification independent of manager authority. A real HTTP regression first failed at the original database constraint, then passed: unverified demoted account denied clinic access, successful email verification without manager codes, retained email login. Manager recovery codes remain manager-only. No residual standards/specification findings after same-reviewer recheck.

## Builder verification
16 HTTP tests against isolated persistent PostgreSQL; 3 Chromium journeys; typecheck; lint; contracts/API/web builds; whitespace checks: pass after final fix. Tests cover primary-manager login/no username bypass, normalized concurrent uniqueness, narrow email RLS, ordinary employee/promoted doctor setup, demotion verification and shared-PC recovery-code isolation. Audit not rerun: no dependency changes; previous PR32 audit recorded zero findings. Only dedicated fictional test database was reset to reapply the unpublished migration; no live migration occurred.

## Limitations
No public manager registration, live email adapter/sending, production deployment, live migration or real patient data. Live email/provider setup, production roles, Linux/native compatibility and existing infrastructure/legal gates remain. Existing accounts retain username login rather than guessing verified email; live conversion requires a separately authorized operator procedure. Account creation/promotion/demotion APIs, permission administration and recovery consumption remain #8; operator-only fictional fixtures prove authentication invariants here. Visual design is deferred. Human review and merge approval are still required.