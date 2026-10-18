# Local development runner implementation

Owner-authorized scope after merged PR #47: synchronize local main and provide a repeatable fictional development workspace. Builder works on `codex/local-dev-runner`, comparison base `921b3faca47cc3515dbe17f297d93f23b6bbaca3`. No production entry, live database, deployment or merge changed.

## Fresh skill checkpoint

Read `D:/clinic-app/AGENTS.md`, `docs/agents/skill-integration.md`, tracker rules, relevant architecture, CONTEXT and existing runtime/test contracts. Selected exact `D:/clinic-app/.agents/skills/implement/SKILL.md`: implement the owner-approved scope, verify observable behavior at the existing authenticated HTTP/isolated PostgreSQL seam, run type/lint/build and the existing full suite once, then separate standards/spec review. Owner's single builder and independent reviewer overrides fanout and automatic merge. No new dependencies or testing seam.

Considered TDD skill: no new domain feature or isolated unit seam; actual launcher smoke exercises Docker/process/HTTP behavior instead of mocking infrastructure. Initial development checks exposed stale generated contract/Prisma artifacts and lint discovery of ignored local tool checkouts; generated artifacts were rebuilt and ESLint excludes local tool/runtime directories. Frontend design/React skills skipped because only Vite transport configuration changes. Wizard skipped because all steps are executable locally; no human dashboard/credential setup. PR/handoff checkpoint remains root reviewer's responsibility before publication.

## Behavior

Fixed loopback development database `clinic_dev` on 55438 with persistent named volume; separate owner and restricted runtime assertion. Fixed API3001/web5173 plus authenticated private stop control5174, Node24/npm/Docker checks and pinned dependency installation fingerprint. Docker endpoint must be a local named pipe/Unix socket. Owner migrations and runtime commands receive fixed local URLs regardless of ambient database URL. Production mode and direct dev entries with mismatched URLs fail closed.

Separate dev API uses in-memory fake mail with ignored local mailbox snapshots and persistent local session secret. Fictional demo setup uses operator provisioning plus normal authenticated HTTP onboarding/account/patient/catalog workflows, saving local recovery codes before activation acknowledgment. Existing completed clinics are retained; missing/mismatched completion receipt fails explicitly without resetting data. Production server and default dev/test ports are unchanged. Windows shortcuts and README include login/mail/recovery instructions.

## Builder evidence so far

- Actual first `npm run dev:local`: npm ci 429 packages, zero audit vulnerabilities; contracts and Prisma generated; 26 migrations applied to clinic_dev; runtime role assertion passed; three fictional accounts and assigned patients/catalog/medicine seeded through real HTTP workflows. Dev web/API started.
- Actual HTTP smoke: all three demo logins, dentist/assistant two assigned patients, dentist signing permission vs assistant restriction, manager clinical denial, reference listing and web response passed. Smoke harness corrected initially mistaken permission name and medication response shape; these were verification harness errors, not application failures.
- Ctrl+C followed by immediate restart passed, no pending migrations, existing data retained. Initial source typed/lint checks now pass after generation and correction of one new unused ternary lint expression.
- Frozen runtime source `8919d5f`: final `npm run typecheck`, `npm run lint`, `npm run build` PASS. Existing Vite output warns about a 521.55 kB JavaScript chunk; build exits zero. Logs: `.local-dev/typecheck.log`, `lint.log`, `build.log`.
- Existing complete API suite once: `npm run test:db:up`, `npm run test:db:prepare` (26 migrations), `npm test`: 11 files, 114 tests PASS, 237.21 seconds, exit zero. Dedicated test database 55437 remained separate from persistent dev55438; only disposable test project stopped afterwards. Logs: `.local-dev/test-db.log`, `api-suite.log`, `test-db-stop.log`.
- Real contact edit acknowledged, full `npm run dev:local:stop`, socket probes confirmed API3001/web5173/control5174/database55438 closed, restart retained edited contact/revision and exactly two seeded patients; no reseed. Login/scope smoke repeated successfully. Ignored reproducible `.local-dev/persistence.ts` and `smoke.ts` contain only fictional setup and assertions, never session logs.
- Node import of actual Vite config verified original4173/API3000 defaults and local5173/API3001 overrides. Start with ambient nonlocal DATABASE_URL succeeded against fixed clinic_dev; direct dev entry mismatchedURL, production runner, and remote Docker stop rejected without disrupting active local app. Guard logs under `.local-dev`.
- Final strict UTF-8/LF and `git diff --check` PASS for all17 scoped files; two original README punctuation characters were restored after detecting encoding drift in first freeze. Production `apps/api/src/server.ts` unchanged. No package-lock/dependency changes.
- Independent standards/spec review remains separately attributed to root. Root is responsible for final app state after its own stop/restart smoke and the handoff/PR checkpoint.

Evidence is builder-observed execution at runtime source `8919d5f`, with only final report/README punctuation updated afterwards, not independent review. Logs and smoke scripts are ignored in `.local-dev`; no tokens/cookies/passwords printed. Separate reviewer will report independently performed checks. Unrelated owner HANDOFF/design edits remain unstaged.

## Limitations

Fictional local workspace only. Mailbox/session/recovery files are local development artifacts, not a production secret store. Incomplete initial setup requires explicit maintainer repair through retained public workflows; no automatic reset/reseed. Full browser suite not required for this dev harness; production provider/deployment remain outside scope.
