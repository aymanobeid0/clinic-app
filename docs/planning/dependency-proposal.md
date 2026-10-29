# Supporting dependency proposal

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. The initial #7 HTTP/session slice was published in draft PR #32; subsequent implementation status is recorded in the linked delivery status. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Status: approved by user on 2026-10-10. No dependencies installed; versions are not locked yet. Official documentation was consulted; React Hook Form documentation could not be fetched and its compatibility must be verified before installation.

Foundation follow-up on 2026-10-10: foundation-version-research.md records exact metadata-compatible package/image candidates, including React Hook Form peer compatibility and the planned test execution contract. No installation, lockfile or runtime compatibility is established yet. foundation-infrastructure-assessment.md records the owner's Contabo/Dokploy facts, approved ingress adaptation, backup budget and remaining acceptance proposals.

## Confirmed stack

React and TypeScript frontend; Node.js/Express/TypeScript backend; PostgreSQL with Prisma; Docker and Nginx. Maintenance primarily through AI coding tools.

## Proposed application layout

One repository with frontend, backend, and shared validation/API contracts. A React SPA communicates with an Express REST API under the same public origin. Nginx serves built frontend assets and proxies API requests; PostgreSQL and API run as separate Docker Compose services. Database is not exposed publicly. Private attachments use persistent storage and authorized API delivery, not public static URLs. The modular-monolith layout was approved on 2026-10-10; see docs/architecture/application-architecture.md.

## Dependencies to approve

| Area | Proposed tools | Purpose |
| --- | --- | --- |
| Frontend build | Vite and its React plugin | Develop and build the React/TypeScript SPA. |
| Routing | React Router, declarative mode | Patient, calendar, billing, inventory and settings URLs. |
| API data | TanStack Query and native fetch | Queries, mutations, invalidation and loading/error states. Do not persist clinical caches on the device. |
| Shared local UI state | Zustand | Shared dialogs, selections and view preferences. Keep server records in TanStack Query and form values in React Hook Form. No persistent clinical drafts or sensitive state in browser storage. Component-private state may remain in React hooks. |
| Forms | React Hook Form, Zod, Hook Form resolvers | Form state and shared input validation; server remains authoritative. |
| Sessions | express-session, connect-pg-simple and pg | Server-side sessions persisted in PostgreSQL; secure HttpOnly cookies. No production MemoryStore. Explicit CSRF defense is required for cookie-authenticated writes. |
| Passwords | argon2 | Password hashing using Argon2id, with deployment compatibility tested. |
| HTTP protections | Helmet and express-rate-limit | Security headers and abuse limits, with reverse-proxy settings explicitly validated. |
| Uploads | Multer | Route-scoped multipart handling with limits, content verification and permission checks. |
| Logging | Pino and pino-http | Structured operational logs with clinical content, credentials, cookies and sensitive request bodies excluded/redacted. |
| Automated tests | Vitest, Supertest, Playwright | Application-boundary HTTP/persistence tests and a small browser suite against isolated test data. |
| Development | tsx, ESLint, typescript-eslint, Prettier | Backend development execution, type-aware linting and consistent formatting. Production compiles TypeScript. |
| Local/deployment services | Docker Compose | Define API, PostgreSQL and Nginx services and persistent volumes. Backups must be outside the VPS. |

Core React/React DOM, Express, Prisma CLI/client, TypeScript and PostgreSQL are already selected, not additional choices. Prisma's required PostgreSQL driver adapter and matching packages will be included according to the approved version. Add corresponding TypeScript type packages where necessary.

## Validation decision

On 2026-10-10, the owner explicitly confirmed Zod after comparing it with class-validator. Share Zod transport schemas between React forms and Express, deriving TypeScript types from schemas. The backend independently validates incoming data; authorization, financial/stock invariants and database-dependent business rules remain in backend modules and transactions. class-validator is not part of the selected baseline.

## UI and document proposal

Use existing design tokens with custom CSS and reusable accessible components initially; no large UI framework selected implicitly. Use browser print layouts for plans, receipts, invoices and prescriptions. Existing calendar prototype is a reference only: calendar library selection, license and required views require a focused check in the appointment ticket. No PDF service or charting library needed for the first dependency baseline.

Owner amendment, 2026-10-29: adopt **Radix Primitives** for compound controls that need accessibility behavior, such as dialogs, confirmation dialogs, tabs, dropdown menus and popovers. Keep the approved Clinic Visual Language tokens and custom CSS; Radix Themes and a styled component framework are not selected. Prefer native HTML for simple buttons, inputs, selects and disclosure controls when it meets the need. Add only the primitive packages used, pin exact compatible versions and commit the lockfile. First adoption: `@radix-ui/react-tabs` 1.2.1 for the designed sign-in tabs; npm peer metadata admits the pinned React19 stack. Future primitives require composition-level keyboard/focus checks; Radix does not replace labels, contrast, authorization or application tests.

## Version and compatibility policy

After approval, verify mutually compatible stable releases and pin exact versions with a committed lockfile and explicit container image versions. Choose an actively supported Node LTS meeting Vite, Express, Prisma and native Argon2 requirements; validate the Linux image and PostgreSQL combination together. Do not treat the website's latest version label as a tested compatibility matrix. The proposed list is not a claim that exact versions have been verified together.

Zustand was explicitly selected by the user for local UI state after the initial proposal approval. SSE plus REST was approved for immediate updates at launch; native EventSource adds no required client library. No Redis, queue service, JWT authentication, online payment SDK, or AI SDK is proposed for the initial core. Revisit only when a feature needs one. Authentication approval here does not override deferred MFA/idle locking or unresolved recovery contracts.

## Source documentation

- Vite: https://vite.dev/guide/
- React Router: https://reactrouter.com/start/declarative/installation
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react
- Forms: https://react-hook-form.com/get-started
- Validation: https://zod.dev/
- Express sessions: https://expressjs.com/en/resources/middleware/session/
- PostgreSQL session store: https://github.com/voxpelli/node-connect-pg-simple
- Argon2: https://github.com/ranisalt/node-argon2
- Helmet: https://helmet.js.org/
- Rate limits: https://express-rate-limit.mintlify.app/overview
- Uploads: https://expressjs.com/en/resources/middleware/multer.html
- Logging: https://github.com/pinojs/pino
- Vitest: https://vitest.dev/guide/
- Supertest: https://github.com/forwardemail/supertest
- Playwright: https://playwright.dev/docs/intro
- Prisma compatibility: https://docs.prisma.io/docs/orm/reference/system-requirements
- Compose: https://docs.docker.com/compose/
- PostgreSQL recovery: https://www.postgresql.org/docs/current/backup.html
