# Clinic app — implementation in progress

Prerequisite evidence is in docs/planning; issue #7 is the first application slice. There is no public registration route. Live patient data, deployment and live migrations are not authorized.

## Local fictional-data checks

Use Node 24 (deployment candidate in .node-version), npm and Docker Desktop. Existing databases are not used. This slice uses the explicitly named clinic-issue7-test Compose project, PostgreSQL 18.6, a loopback-only port and temporary storage. The credentials in compose.test.yml are fictional test values only.

1. `npm ci` — install the committed lockfile.
2. `npm run test:db:up` — start only the dedicated disposable test database.
3. `npm run db:generate --workspace @clinic/api` — generate the Prisma client.
4. `npm run db:migrate --workspace @clinic/api` — apply the isolated test migration (the Prisma config defaults only to the named local test database).
5. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
6. `npm run test:db:down` — stop only this test project's database.

TEST_DATABASE_URL may select another explicitly isolated fictional-data database. Never point these tests or migrations at a live clinic. The runtime server requires DATABASE_URL, SESSION_SECRET and APP_ORIGIN; no production credential defaults are provided. COOKIE_SECURE defaults on, and may be disabled only for local HTTP development.

The initial slice implements the persistent anonymous session and denied identity boundary. Manager provisioning, onboarding, authenticated identity and the French browser journey remain in issue #7; the web workspace currently declares dependencies only and is not part of the build. No complete sign-in or clinic-isolation claim is made at this stage.
