# Foundation dependency and security research

Research date: 2026-10-10. Scope: issue #2, approved stack in dependency-proposal.md and application-architecture.md. These are exact candidate pins verified against public publisher metadata, not an installed or runtime-tested dependency baseline. No packages, containers or databases were installed or started during this research.

## Recommendation

Use Node.js 24.21.0 LTS (Krypton), bundled npm 11.19.0, TypeScript 6.0.3, React 19.3.0, Express 5.3.0 and Prisma 7.10.0 with its matching PostgreSQL adapter. Use PostgreSQL 18.6. This intersection satisfies the inspected engine and peer ranges. Installation must commit a lockfile and prove the application builds and runs before claiming complete compatibility.

Two findings make copying every `latest` tag unsafe: Prisma CLI's inspected `latest` tag points to **8.0.0-rc.22**, while stable client/adapter releases are 7.10.0; TypeScript's `latest` is **7.0.2**, outside typescript-eslint 8.71.1's supported `>=4.8.4 <6.1.0` peer range. Select stable Prisma 7.10.0 explicitly and TypeScript 6.0.3. Package version numbers here come from registry responses, rather than extrapolation from the research date. [Prisma CLI metadata](https://registry.npmjs.org/prisma/latest), [Prisma 7.10.0](https://registry.npmjs.org/prisma/7.10.0), [TypeScript metadata](https://registry.npmjs.org/typescript), [typescript-eslint metadata](https://registry.npmjs.org/typescript-eslint/8.71.1).

## Exact package candidates

Every row links to version-specific npm publisher metadata containing the exact release, engines and peer dependencies. A dash means no engine constraint was declared, not that every runtime is supported. Optional peers are not extra dependencies to install by default.

| Package | Exact pin | Relevant compatibility metadata |
| --- | --- | --- |
| [react](https://registry.npmjs.org/react/19.3.0) | 19.3.0 | Node >=0.10.0 |
| [react-dom](https://registry.npmjs.org/react-dom/19.3.0) | 19.3.0 | React ^19.3.0 |
| [typescript](https://registry.npmjs.org/typescript/6.0.3) | 6.0.3 | Node >=14.17; within lint peer range |
| [vite](https://registry.npmjs.org/vite/8.3.4) | 8.3.4 | Node ^20.19.0 or >=22.12.0; optional tsx ^4.8.1 |
| [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs/plugin-react/6.1.2) | 6.1.2 | Vite ^8.0.0; same Node floor as Vite |
| [react-router](https://registry.npmjs.org/react-router/8.4.0) | 8.4.0 | Node >=22.22.0; React/React DOM >=19.2.7 |
| [@tanstack/react-query](https://registry.npmjs.org/@tanstack/react-query/5.104.1) | 5.104.1 | React ^18 or ^19 |
| [zustand](https://registry.npmjs.org/zustand/5.0.15) | 5.0.15 | Node >=12.20; React/types >=18 when used |
| [react-hook-form](https://registry.npmjs.org/react-hook-form/7.89.0) | 7.89.0 | Node >=18; React includes ^19 |
| [zod](https://registry.npmjs.org/zod/4.6.5) | 4.6.5 | No engine/peer constraint declared |
| [@hookform/resolvers](https://registry.npmjs.org/@hookform/resolvers/5.9.1) | 5.9.1 | RHF ^7.55.0; optional Zod ^3.25.0 or ^4.0.0 |
| [express](https://registry.npmjs.org/express/5.3.0) | 5.3.0 | Node >=18 |
| [prisma](https://registry.npmjs.org/prisma/7.10.0) | 7.10.0 | Node ^20.19 or ^22.12 or >=24 |
| [@prisma/client](https://registry.npmjs.org/@prisma/client/7.10.0) | 7.10.0 | Same Node range; TypeScript >=5.4.0 |
| [@prisma/adapter-pg](https://registry.npmjs.org/@prisma/adapter-pg/7.10.0) | 7.10.0 | Keep Prisma family on identical release |
| [express-session](https://registry.npmjs.org/express-session/1.19.0) | 1.19.0 | Node >=0.8; PostgreSQL session store required |
| [connect-pg-simple](https://registry.npmjs.org/connect-pg-simple/10.0.0) | 10.0.0 | Node ^18.18 or ^20.9 or >=22 |
| [pg](https://registry.npmjs.org/pg/8.23.1) | 8.23.1 | Node >=16; pg-native optional |
| [argon2](https://registry.npmjs.org/argon2/0.45.1) | 0.45.1 | Node >=16.17; native deployment probe required |
| [helmet](https://registry.npmjs.org/helmet/8.3.0) | 8.3.0 | Node >=18 |
| [express-rate-limit](https://registry.npmjs.org/express-rate-limit/8.7.1) | 8.7.1 | Node >=16; Express >=4.11 |
| [multer](https://registry.npmjs.org/multer/2.4.0) | 2.4.0 | Node >=10.16 |
| [pino](https://registry.npmjs.org/pino/10.4.0) | 10.4.0 | No engine declared |
| [pino-http](https://registry.npmjs.org/pino-http/11.0.0) | 11.0.0 | No engine/peer constraint declared |
| [vitest](https://registry.npmjs.org/vitest/5.0.3) | 5.0.3 | Node ^22.12, ^24 or >=26; Vite includes ^8 |
| [supertest](https://registry.npmjs.org/supertest/7.3.1) | 7.3.1 | Node >=14.18 |
| [@playwright/test](https://registry.npmjs.org/@playwright/test/1.64.0) | 1.64.0 | Node >=20; browser binaries must match this release |
| [tsx](https://registry.npmjs.org/tsx/4.23.15) | 4.23.15 | Node >=18 |
| [eslint](https://registry.npmjs.org/eslint/10.12.0) | 10.12.0 | Node ^20.19, ^22.13 or >=24 |
| [typescript-eslint](https://registry.npmjs.org/typescript-eslint/8.71.1) | 8.71.1 | ESLint ^8.57, ^9 or ^10; TS >=4.8.4 <6.1.0 |
| [prettier](https://registry.npmjs.org/prettier/3.9.10) | 3.9.10 | Node >=14 |

Type candidates: [@types/node 24.19.2](https://registry.npmjs.org/@types/node/24.19.2), [@types/react 19.3.0](https://registry.npmjs.org/@types/react/19.3.0), [@types/react-dom 19.3.0](https://registry.npmjs.org/@types/react-dom/19.3.0), [@types/express 5.0.6](https://registry.npmjs.org/@types/express/5.0.6), [@types/express-session 1.19.0](https://registry.npmjs.org/@types/express-session/1.19.0), [@types/connect-pg-simple 7.0.3](https://registry.npmjs.org/@types/connect-pg-simple/7.0.3), [@types/pg 8.23.1](https://registry.npmjs.org/@types/pg/8.23.1), [@types/multer 2.3.0](https://registry.npmjs.org/@types/multer/2.3.0), [@types/supertest 7.2.1](https://registry.npmjs.org/@types/supertest/7.2.1). Keep Node types on the runtime major; type-check the older connect-pg-simple declaration package against v10 during installation.

RHF compatibility is now metadata-verified: React 19.3.0 satisfies RHF's ^19 peer; RHF 7.89.0 satisfies resolver ^7.55.0; Zod 4.6.5 satisfies resolver ^4.0.0. A real typed form and resolver test remain required. The resolver's many alternative validator peers are optional and do not authorize adding other validation libraries.

## Runtime and image candidates

[Node's first-party release index](https://nodejs.org/dist/index.json) reports v24.21.0, released 2026-09-07, as Krypton LTS with npm 11.19.0. Prisma's [v7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) explicitly support Node 24 and recommend supported LTS releases. Debian Bookworm slim is preferred for the API's native Argon2/OpenSSL deployment check. This is an engineering recommendation pending the image smoke test.

The following official Docker Hub tag APIs returned these manifest digests on the research date. These are registry observations; no image was pulled or executed. Use the tag plus digest when writing Dockerfiles/Compose, and re-verify platform support on the VPS.

| Service | Exact image reference | Registry evidence |
| --- | --- | --- |
| API/build | `node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20` | [Official tag metadata](https://hub.docker.com/v2/repositories/library/node/tags/24.21.0-bookworm-slim) |
| Database | `postgres:18.6-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c` | [Official tag metadata](https://hub.docker.com/v2/repositories/library/postgres/tags/18.6-bookworm) |
| Internal web proxy | `nginx:1.30.5@sha256:9bf97bd7714f5e24c1ccd545ecb9eb5435cb6d109c97cebb15e7e455e0239edb` | [Official tag metadata](https://hub.docker.com/v2/repositories/library/nginx/tags/1.30.5) |

PostgreSQL's [version policy](https://www.postgresql.org/support/versioning/) lists 18.6 as the current supported minor of major 18, supported through November 2030. Nginx's [download page](https://nginx.org/en/download.html) lists 1.30.5 as stable. The guessed `nginx:1.30.5-bookworm` tag returned 404 and must not be used. Docker Engine and Compose plugin are host prerequisites managed through Dokploy; record their actual installed versions from the owner/VPS rather than inventing a host pin. No change to the owner's Dokploy ingress is authorized by these image candidates.

## RLS recommendation

Owner decision 2026-10-10: accepted this RLS baseline through the decision popup. Acceptance selects the design; the runtime-role, Prisma pool and two-clinic verification gates below remain mandatory before claiming isolation is proven.

Recommend enabling PostgreSQL RLS as a second clinic-isolation layer when implementing persistence, with a dedicated non-owner runtime role without BYPASSRLS and separate migration credentials. Apply both USING and WITH CHECK clinic policies; application patient/permission checks remain mandatory. This is feasible with Prisma interactive transactions, but feasibility from documentation is not proof of correct pooled execution. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).

Derive clinic context from server-verified membership. Set it using parameterized `set_config('app.clinic_id', ..., true)` inside the same interactive transaction as all scoped Prisma calls; transaction-local state avoids leaving tenant context on a pooled connection. Missing context must deny access. Do not use session-level SET or run a scoped query outside the transaction. Scope raw SQL, reports, files and worker paths too. Review session/auth bootstrap tables separately because clinic membership is established before ordinary clinic data access. PostgreSQL [set_config documentation](https://www.postgresql.org/docs/current/functions-admin.html) defines the local flag's transaction lifetime.

Before accepting this design, run two-clinic tests through the actual Prisma adapter/pool and runtime role: read/write isolation, forged clinic reference, absent context, rollback, connection reuse, raw SQL, owner-bypass detection and cross-clinic composite FK failure. Live database migrations require separate explicit authorization under repository policy. Isolated fictional-data migrations may run within authorized implementation scope; implementation is not authorized by this note. This document creates no schema or migration.

## CSRF recommendation

Owner decision 2026-10-10: accepted this CSRF baseline through the decision popup. Implementation and security verification remain outstanding.

Use a synchronizer token stored in the server-side session and returned by a same-origin bootstrap endpoint with `Cache-Control: no-store`. Require a matching custom header on every unsafe method, including login/logout and multipart uploads. Generate the pre-login session/token before login and rotate both session ID and token after authentication/privilege changes. Compare tokens safely, reject failures before domain side effects, and keep tokens out of URLs and logs. This uses Node crypto and the approved session store, adding no dependency. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Also verify Origin against the configured public origin, falling back to Referer when appropriate; deny requests with neither for browser write endpoints. Use Fetch Metadata as an additional cross-site rejection signal and Secure/HttpOnly/SameSite=Lax session cookies. SameSite alone does not replace the token. Keep CORS restricted to the same-origin deployment and ensure GET/HEAD/SSE do not mutate domain state. Configure the exact trusted reverse proxy chain for Dokploy before relying on request security metadata. Test missing/wrong tokens, login CSRF, cross-site forms, uploads, token rotation and valid same-origin writes.

## Evidence still required at implementation

Planned execution contract: root npm-workspace scripts `typecheck`, `lint`, `test`, `test:e2e` and `build` must perform actual checks across the relevant workspaces. Use Vitest/Supertest at the HTTP/application boundary against a separate PostgreSQL test service/database with fictional fixtures; never point tests at deployment persistence. Browser tests start the built SPA/API with that isolated persistence and Playwright's matching Chromium binary. Run focused boundary tests while implementing, typecheck regularly, and run the full relevant suite once before review. The foundation does not add private-helper tests solely to mirror implementation. These are script requirements, not commands currently available in this blank repository.

1. Pin direct versions without caret/tilde, resolve and commit npm lockfile; inspect actual dependency tree for peer failures and transitive advisories.
2. Compile shared contracts, API and SPA with TypeScript 6.0.3; prove resolver inference and React rendering with the chosen Router/Query versions.
3. Build the pinned Linux API image, generate Prisma client and exercise Argon2id hash/verify on the target CPU architecture.
4. Against isolated fictional PostgreSQL data, prove Prisma transactions, adapter pooling, session persistence, clinic isolation and CSRF failure/success behavior. Keep live migrations separately authorized; isolated test migrations remain within the later authorized implementation scope.
5. Run the relevant Vitest/Supertest boundary checks and a small Playwright browser check using matching browser binaries. Check Nginx SSE streaming and graceful shutdown through Dokploy ingress.

Until those checks pass, describe this baseline as **metadata-compatible candidate pins**. No lockfile, runtime compatibility, vulnerability-free status, production deployment or restore capability is established by this note.
