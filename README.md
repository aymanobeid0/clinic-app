# Clinic app â€” implementation in progress

Issues #7/#8/#9 are merged/closed through PR #35/#36/#38. Issue #9 adds permission-controlled patient registration, contact search/editing, duplicate warnings, archive/reactivation and essential per-record history, with functional French forms and SSE invalidation. No public clinic registration. Live patient data, deployment, live migrations and live email are not authorized.

## Run the app locally

Install Node.js 24 LTS (with npm) and start Docker Desktop. From this folder, run `npm run dev:local`, or double-click `Start-Clinic.cmd`. The launcher installs pinned dependencies when missing or when the lockfile changes, builds contracts, generates Prisma, applies local migrations, and starts API watch and web HMR.

Open **http://127.0.0.1:5173**. The first successful startup creates these fictional demo accounts; all use password `Demo-clinic-2026!`:

| Account   | Sign-in method    | Credentials                |
| --------- | ----------------- | -------------------------- |
| Manager   | Email             | `manager@example.invalid`  |
| Dentist   | Clinic / username | `demo-local` / `dentiste`  |
| Assistant | Clinic / username | `demo-local` / `assistant` |

The dentist and assistant receive explicit access to two fictional patients. The manager can administer accounts, patients and catalog references. The assistant can draft clinical entries; clinical confirmation remains restricted to the dentist. All data, credentials and medication references are demonstration examples.

`Ctrl+C` stops API/web watchers. `npm run dev:local:stop` or `Stop-Clinic.cmd` stops watchers and the dedicated database. Restart with `npm run dev:local`. The persistent Docker volume retains your edits and passwords; subsequent starts never overwrite demo data. The launcher never resets data or removes volumes. If initial demo creation fails partway, it preserves that partial clinic and refuses subsequent startup until repaired; there is no automatic destructive recovery.

Local development uses API port 3001, web port 5173, private runner control port 5174 and a dedicated PostgreSQL `clinic_dev` on loopback port 55438. The launcher ignores ambient database URLs and supplies fixed local owner/runtime targets; direct development entries reject mismatched database URLs and production mode. The restricted runtime role is checked on every startup. The existing test database (55437), API default (3000), Vite default (4173), and `npm run dev` remain independent.

No email is sent. The development entry captures messages in memory and `.local-dev/mailbox.json` (last 100 messages). For activation/recovery testing, open that ignored file and use the latest matching message's fragment URL while signed in as required. First-run manager recovery codes are saved in `.local-dev/demo-recovery-codes.json`; the session secret and runner state are also local ignored files. Do not share these files. Windows permissions follow your local user account; this is a loopback-only fictional workspace, not a production mail or secret store. Production server behavior is unchanged.

Restart the launcher after pulling changes so migrations and generated artifacts are updated. Source edits then reload through API watch/web HMR. Stop any conflicting listener before launching; startup fails clearly when its ports are occupied.

## Local fictional-data checks

Use Node 24, npm and Docker Desktop. Existing databases are not used. The dedicated clinic-issue7-test Compose project uses loopback-only PostgreSQL 18.6 and temporary storage. All checked-in test credentials are fictional.

1. `npm ci` installs the pinned lockfile and generates Prisma/builds contracts.
2. `npm run test:db:up` starts only the dedicated test database.
3. `npm run test:db:prepare` applies migrations and creates the fictional restricted runtime login.
4. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` check API/contracts/web.
5. `npx playwright install chromium`, then `npm run test:browser` prove the French journey. Optional PLAYWRIGHT_BROWSERS_PATH can keep browser downloads in an ignored local directory. The test starts its own loopback API and Vite; ports 3000/4173 must be free.
6. `npm run test:db:down` removes only this disposable project.

The browser test provisions fictional data and injects a fake mail adapter in-process. It never sends email or exposes a fake verification endpoint. API tests also use a real isolated PostgreSQL database. The infrastructure isolation test deliberately omits application filters to prove RLS through the actual runtime Prisma pool.

## Runtime and provisioning

The API requires DATABASE_URL, SESSION_SECRET and APP_ORIGIN. DATABASE_URL must use a non-owner login with clinic_runtime membership; startup rejects superuser, bypass-RLS, database/role-creation and table-owner privileges. Migrations and operator provisioning use separate privileged credentials; provisioning must be able to insert despite FORCE RLS (a non-super table owner alone is insufficient). Production role provisioning still needs rehearsal. Cookie security is enabled by default; COOKIE_SECURE=false is local HTTP only and rejected in production. Local frontend: `npm run dev:web`; API: `npm run dev`.

`npm run provision` is an operator-only stdin JSON tool, not an HTTP registration endpoint. Set PROVISION_DATABASE_URL out of band to the authorized owner connection. Input includes clinicCode, clinicName, username, displayName, globally unique email and temporaryPassword. Use secure stdin rather than command arguments or committed files. Primary managers authenticate by normalized email/password. Before that email is verified, only restricted activation is available; verification must use the provisioned address. Employees and doctors promoted to manager authenticate by clinic code/username/password. Login method and manager authority are independent. Existing pre-amendment manager accounts retain username login until a separately authorized operator conversion; no address is guessed or trusted automatically.

The temporary password expires after 24 hours and must be replaced before access; replacement revokes all sessions and requires sign-in again. Initial password validation accepts 12â€“128 characters without changing the owner's account/recovery lifecycle.

A replaceable mail adapter is accepted by createApplication. The shipped runtime intentionally has no live provider adapter; verification returns 503 until delivery is configured. No fake verification fallback exists in the runtime. Test-only delivery proves the onboarding flow, not live email readiness. Verification URLs use fragments so tokens are not sent in HTTP request URLs; verification remains an authenticated, CSRF-protected POST. Code regeneration requires the current password and invalidates the previous batch; losing the one-time display requires regeneration. Manager recovery consumption and staff administration are implemented in #8. The mail adapter additionally supports sendRecovery and sendNotification; recovery/email replacement remains blocked where the required delivery method is absent.

Production Linux API/native compatibility, ingress/secure-cookie/SSE configuration, actual email delivery, recovery rehearsal and real-data gates remain unproven. See docs/planning/delivery-status.md and issue-7-implementation.md. #7/#8 are complete through merged PR #35/#36. #9 is merged through PR #38. #10 adds explicit multi-account patient assignment/sharing/removal, retained grant history, assignment-specific personal search, French forms and a production clinical authorized-transaction interface; see docs/planning/issue-10-implementation.md for verification and the future clinical-content endpoint integration boundary. Independent review and human PR merge remain required.

## File organization

Owner approved feature folders with Routes -> Controller -> Service -> Repository. Start with apps/api/src/modules/identity/identity.routes.ts; its controller handles HTTP, service implements the rules, and repository contains Prisma queries. application.ts only assembles middleware/routes. Frontend identity screens/forms are in apps/web/src/features/identity. See docs/architecture/application-architecture.md for the file tree and system design.

### Local setup recovery

A clinic without a matching `.local-dev/seeded.json` completion record is treated as incomplete, never silently reseeded. Keep the preceding failure diagnostic and `.local-dev` files. If the completion record was accidentally moved, restore its original copy for this same database. Otherwise ask the project maintainer to finish the failed public onboarding/seed step using the retained local mailbox and accounts; the launcher will not reset the database or replace changed passwords. To inspect an incomplete local clinic during repair, run the guarded development API directly with `node --import tsx apps/api/dev/server.ts` and the frontend separately with `CLINIC_WEB_PORT=5173` and `CLINIC_API_PORT=3001` set in that shell. A maintainer must verify all demo steps before restoring the completion record. Do not substitute another clinic's record or delete the persistent volume as an automatic fix.
