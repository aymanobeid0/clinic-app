# Identity module design before issue #8 — 2026-10-12

Design assessment requested through mattpocock-skills:codebase-design. Recommendations only; no implementation or new product decisions. Based on the current identity module, shared contracts, database adapter and browser identity workflow. Keep the owner-approved feature Routes -> Controller -> Service -> Repository organization.

## Keep

The identity module already hides session rotation, password hashing, restricted activation and PostgreSQL locking behind workflow operations. modules/identity/index.ts is the external construction/operator entry point; repositories and IdentityTransaction are internal seams. Concrete database persistence earns its place by keeping clinic context and locking local. Keep application-boundary HTTP tests with real isolated PostgreSQL and browser journeys, rather than mocking each layer.

## Highest leverage for #8

1. Add one exported identity interface for authenticated/authorized execution when other modules actually need it. Callers supply the server actor and required action; identity resolves current account, session version, disabled/setup state and authority. Keep those rules inside identity rather than copying private withAuthenticatedAccount across modules. Do not export the full Prisma Account or let callers choose a clinic ID from request data. Keep transport session handling in the controller/middleware.
2. Account-management workflows should check the acting manager and mutate the target inside the same clinic-scoped transaction. The current withAccount locks only one account; it is useful internally but insufficient alone for last-manager protection and two-account operations. Use deliberate lock ordering/shared serialization for concurrent promotions/demotions/disablement, preserve history and revoke affected sessions. Do not authorize in one transaction then write in another.
3. Keep loginMethod, manager authority and doctor/staff eligibility separate. #7 has loginMethod/isManager but no doctor/staff eligibility or grant model yet. Add those for actual #8 account operations; manager authority must neither switch login credentials nor imply clinical eligibility. Expose named operations such as createAccount, changePermissions, grantManagerAuthority, disableAccount and resetPassword, rather than a generic updateAccount accepting arbitrary security fields.
4. Keep authentication/activation and account administration as focused internal workflows under identity, with routes/controller/service/repository ownership retained. Split service files only when #8 behavior makes them hard to follow. Do not add generic CRUD repositories, framework-level interfaces or layers for hypothetical adapters.

## Seams and adapters

The mail seam is justified by fictional test delivery versus real-provider delivery, although the live adapter is still absent. Preserve that explicit live gate. Clock injection is useful for expiry verification. Database persistence stays the real PostgreSQL adapter in meaningful tests. No need for an in-memory repository solely to test the same implementation twice.

The browser hook currently concentrates identity queries, transient codes, actions and verification-link capture. Keep it for now. If #8 pages reuse authentication state, share the identity query/session interface; keep one-time recovery codes local and account-owned. Continue TanStack Query for server records, local hooks for private UI details and Zustand only for genuinely shared UI state. Do not persist sensitive caches or drafts.

## Suggested verification for #8

Use the existing approved HTTP/browser seams: cross-clinic denial; ordinary doctor denial of manager actions; promoted doctor retains username login; last-manager concurrency; permission/disable/reset revocation on the next request; single-use recovery; and no identifier reuse/history loss. No new tests or runtime checks were run for this read-only design assessment.

## Result

Proceed with incremental #8 workflows inside the existing modular monolith. No architectural rewrite or visual design is needed to start. These recommendations do not authorize live email, production deployment/migration, real data or automatic merge.
