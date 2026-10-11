# Issue #7 — initial implementation slice

Status: initial HTTP/session foundation implemented; issue #7 remains in progress. Owner authorized starting it after prerequisite planning issues #2–#6 were explicitly approved for closure. Evidence merged in PR #30; the one-builder/one-separate-reviewer workflow merged in PR #31. Branch: codex/issue-7-manager-bootstrap, based on merged c037e82.

## Scope and approved seams

This slice adds npm workspaces, shared login-identifier transport schemas, the Express boundary and PostgreSQL-backed anonymous sessions. Clinic identity always requires authentication; no authentication or public manager-registration route grants access yet. Sign-out checks session-bound CSRF and origin; the server enforces a fixed maximum age of 12 hours independently of cookie expiry.

The already approved seams are HTTP/application workflows against real isolated PostgreSQL and a French browser journey. Six HTTP tests verify denied identity, session persistence across application recreation, CSRF/origin/cross-site denial and sign-out replay, absolute expiry, safe 400/413 input errors and absent public registration. No database-table assertions or internal collaborator mocks. A clock is injected only at the system-time boundary. The first test was written before the implementation, but Vitest was unavailable during installation; no behavioral red/green cycle is claimed for this initial tooling slice.

## Actual verification — 2026-10-11

Clean npm ci passed after restoring archive URLs/integrity hashes from the original npm-generated lockfile for exact matching versions. Every registry lock entry has resolution/integrity metadata. Pinned patched entries were preserved; no hash was invented. The preceding incomplete-lock clean install failed, and is not counted as success.

Prisma 7.10 generation and isolated migration/deploy checks passed. Typecheck, lint, all six HTTP tests, API/contracts build and local Argon2 hash/verify passed after the final dependency changes. npm audit reports 0 vulnerabilities. Native/database/build checks ran locally on Windows with Node24.13.0/npm 11.6.2 and a separate Linux PostgreSQL 18.6 container. This does not prove the planned Node 24.21.0/npm 11.19.0 Debian deployment image or frontend/browser behavior.

Test Compose project: clinic-issue7-test, loopback port 55437, fictional credentials, temporary database storage. Existing clinic/Supabase services were untouched. Pulled PostgreSQL 18.6 digest matched the approved candidate; Compose pins the tag plus full digest. Sessions are auth-bootstrap persistence, reviewed separately from clinic RLS; no clinic-owned models or tenant-isolation proof exists yet.

## Dependency revalidation

Approved exact direct candidates resolved without peer/engine errors. Prisma CLI is a root development tool; API runtime retains matching client/adapter 7.10.0. Root overrides pin deepmerge-ts 8.0.2 and mysql2 3.24.5 to remove four initial CLI audit findings. They are CLI transitives; MySQL is not application persistence. Generation and migration checks passed with the major deepmerge override. Reassess/remove overrides when upstream fixes its dependency tree.

Primary references: [Deepmerge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [MySQL2 advisory](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), [deepmerge-ts 8.0.2 metadata](https://registry.npmjs.org/deepmerge-ts/8.0.2), [mysql2 3.24.5 metadata](https://registry.npmjs.org/mysql2/3.24.5). New overrides did not propagate to the workspace-declared CLI on local npm 11.6; declaring the CLI once in root tools applied them. This is a local observation, not a universal npm-version claim; [related upstream report](https://github.com/npm/cli/issues/8258).

## Remaining issue #7 work

Operator-controlled clinic/initial-manager provisioning; mandatory temporary-password replacement; verified recovery email and saved codes; authenticated identities and revocation; clinic RLS/runtime-role isolation; French manager setup/sign-in/out interface and browser smoke journey; relevant credential, failure and concurrency cases. The web workspace currently declares approved dependencies only and is excluded from build. Do not close #7 or claim a complete running clinic application from this slice.

No deployment, live migration, purchase, live email or patient-data use occurred. Real-data/provider/legal/email/recovery/performance gates remain in the prerequisite contracts. Preserve unrelated design relocations. One builder and the same separate reviewer remain required.
