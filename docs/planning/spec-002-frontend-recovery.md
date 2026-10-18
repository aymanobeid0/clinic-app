# Spec 002 — Backend completion and frontend recovery

Published issue: https://github.com/aymanobeid0/clinic-app/issues/49. Label: ready-for-agent.

## Problem Statement

The owner expected a usable dental clinic application following the approved Dentara design. Instead, implemented features were exposed as a long collection of forms inside the onboarding layout. The application lacks the intended shared workspace, dashboard, sidebar navigation and coherent patient journeys. Functional implementation and test results were communicated as product UI progress, obscuring this gap.

Useful backend behavior, contracts, frontend integrations and tests exist. Discarding them indiscriminately would lose work without completing the product. The backend is also not finished: current GitHub issues #18–#29 remain open. A controlled recovery must separate backend completion, frontend behavior and visual delivery, with explicit evidence at each stage.

## Solution

Preserve the current implementation, stop developing the scaffold as product UI, and complete the remaining backend/API scope first. After a backend acceptance gate, build a clean frontend behavior layer separated from visual components, then implement the approved Dentara application page by page. Replace the scaffold only when its required workflows have working replacements.

This specification changes the delivery sequence of Spec 001, not its approved clinical, financial, access or data-handling rules. Existing feature tickets must be reconciled during ticket planning so backend-only delivery is not incorrectly reported as complete delivery of their original French UI criteria.

## User Stories

1. As the clinic owner, I want the current implementation preserved in Git, so that recovery does not destroy useful work.
2. As the clinic owner, I want the scaffold explicitly identified as an internal development tool, so that I can distinguish it from the intended product.
3. As the clinic owner, I want frontend product development paused during backend completion, so that the agreed sequence is respected.
4. As the maintainer, I want one bounded inventory of existing capabilities and gaps, so that later rounds do not repeatedly rediscover the project.
5. As the clinic owner, I want existing completed backend behavior retained where verified, so that we avoid rebuilding functioning features unnecessarily.
6. As a former treating doctor, I want explicitly granted historical access bounded by the approved cutoff, so that later clinical information remains protected.
7. As authorized clinic staff, I want attachments and quota behavior enforced by the API, so that file access is safe independently of screen controls.
8. As billing staff, I want started procedure charges and documented opening balances, so that future planned treatment is not counted as debt.
9. As billing staff, I want deposits, allocations, receipts and invoices to follow approved contracts, so that patient balances remain explainable.
10. As authorized staff, I want financial corrections to retain history, so that refunds, reversals and credit adjustments remain distinct.
11. As inventory staff, I want whole-pack receiving, consumption and reasoned corrections, so that stock remains traceable and cannot become negative through concurrent requests.
12. As a permitted user, I want operational reports and exports restricted to my authorized scope, so that aggregation cannot bypass patient or clinic permissions.
13. As the maintainer, I want documented request, response, validation, authorization and failure behavior, so that frontend work does not guess API contracts.
14. As the maintainer, I want backend workflows tested through authenticated application requests, so that changing the UI does not remove their evidence.
15. As the clinic owner, I want a clear backend completion gate, so that an open issue or passing subset is not mistaken for a finished backend.
16. As the frontend developer, I want API transport, queries, mutations and workflow behavior separated from visual components, so that screens can change without duplicating application rules.
17. As the frontend developer, I want explicit ownership of server, form and local UI state, so that the recovery preserves the approved architecture.
18. As a clinic user, I want useful loading, empty, denied, validation, saving, conflict and network-error states, so that each action has an understandable outcome.
19. As a clinic user, I want sensitive drafts kept only in current-tab memory, so that recovery does not introduce unsafe browser persistence.
20. As a clinic user, I want a coherent dashboard after normal active-account login, so that I have a clear starting point for daily work.
21. As a clinic user, I want a persistent sidebar and header, so that I can move between workflows without losing the application structure.
22. As a clinic user, I want every displayed sidebar destination to open a real page in the main content area with a distinct URL and active navigation state, so that navigation is predictable.
23. As an authorized user, I want navigation and pages appropriate to my permissions, so that unavailable actions are not presented as usable features.
24. As reception staff, I want a dedicated searchable patient list and patient profile, so that patient work is not buried in unrelated forms.
25. As a doctor, I want an assigned patient's clinical workspace to connect history, dental chart, treatment plans, visits, notes and prescriptions, so that care follows a coherent journey.
26. As reception staff, I want a dedicated appointment workspace, so that booking and arrival tasks are understandable.
27. As authorized clinic staff, I want billing, inventory, administration and reporting in their appropriate pages, so that unrelated workflows do not compete on one screen.
28. As a French-speaking clinic user, I want the approved French interface and documents, so that the delivered pilot matches its language scope.
29. As a clinic user, I want usable narrow-screen layouts, keyboard navigation and visible focus, so that the workspace remains accessible across supported devices.
30. As the clinic owner, I want each UI round demonstrated in the local app against its design reference, so that I review the actual result rather than a progress claim.
31. As the clinic owner, I want dashboard values derived from authorized real application data, so that prototype samples are never mistaken for operational figures.
32. As the maintainer, I want scaffold code removed only after its required behavior has a verified replacement, so that cleanup does not silently delete workflows or tests.
33. As the pilot owner, I want connected role-based rehearsal and demonstrated restoration before real use, so that UI completion is not mistaken for production readiness.
34. As the clinic owner, I want backend status, frontend behavior status and product UI status reported separately, so that incomplete work remains visible.

## Implementation Decisions

### Preservation and bounded reconciliation

- Preserve a recoverable Git reference before later replacement or deletion. Preserve unrelated local changes, fictional development data, approved design assets, contracts and useful tests. This specification authorizes no deletion, implementation or merge.
- Freeze product UI development now. Retain the existing scaffold only for internal verification; do not present it as the final UI. Backend work may make narrowly necessary compatibility changes to keep it usable, but does not expand it into new product screens.
- During ticket decomposition, perform one targeted capability reconciliation against current GitHub criteria and implementation evidence. Record backend/API, frontend behavior and product UI separately. Closed feature tickets do not establish that their intended UX is complete; retain their history and identify UI gaps explicitly.
- Do not blindly reopen or close tickets, rewrite their criteria, delete code, or duplicate implemented behavior. Use the subsequent ticket plan to map existing requirements to backend completion and later frontend acceptance. Until explicitly reconciled, original feature UI criteria remain outstanding where absent.

### Stage 1 — Finish the backend/API

- Complete the remaining in-scope application capabilities under Spec 001 and its approved amendments. Current candidate backend scopes are historical access (#18), attachments (#19), billing (#20–#23), inventory (#24–#25), operational reports/tasks (#26), and authorized export (#27). These issue numbers are a snapshot verified on 2026-10-18, not a substitute for current blockers when executing a ticket.
- Respect native dependencies and prerequisite decisions; numeric order alone does not define readiness. Preserve existing verified capabilities from #7–#17 while completing cross-module integrations.
- Retain the selected modular monolith, feature ownership, Routes → Controller → Service → Repository organization, shared transport contracts, PostgreSQL/Prisma persistence, server authorization, clinic isolation, SSE/REST synchronization and consequential transaction boundaries.
- Provide stable, explicit API contracts covering successful responses, validation, denial, not-found behavior, conflicts, retry/idempotency and supported pagination. No new framework or schema redesign is implied. Do not move authoritative business or authorization rules into the browser.
- Backend gate: every required MVP backend capability has traceable acceptance evidence; authenticated workflow, isolation, permission, failure and relevant concurrency tests pass against isolated persistence; fresh migrations and required type/lint/build checks pass; frontend consumers have usable contracts; unresolved operational/legal/provider constraints are stated explicitly.
- Operational rehearsal (#28) and controlled pilot (#29) are separate gates. Their UI-dependent scenarios occur after the real frontend exists. Backend completion does not imply production readiness, successful restoration or real-patient authorization. Infrastructure work retains separate execution authorization.

### Stage 2 — Separate frontend behavior from presentation

- After the backend gate, establish a clean frontend organization by feature. Preserve the approved React/TypeScript stack and transport contracts rather than start an unrelated application.
- API clients own transport; feature hooks/query modules own server interaction and cache behavior; focused workflow/form logic owns application-facing coordination and validation; visual components render state and emit user actions. Components may compose hooks and own private presentation state. Do not require a generic abstraction or a separate class for every operation.
- TanStack Query owns server records; React Hook Form owns form state; Zustand owns genuinely shared local UI state; React hooks own private UI state. Clear sensitive state on account/clinic change or logout. Do not persist sensitive drafts to browser storage.
- Reuse existing integrations only after checking behavior and boundaries. Extract logic embedded in scaffold components incrementally, without copying server business rules into the client. Shared validation improves feedback but never replaces server checks.
- Behavior-layer gate: interfaces and state ownership are clear, API success/failure states are supported, cancellation/cache invalidation and session transitions are handled, and relevant tests demonstrate externally observable behavior. Avoid building a speculative framework before a real consumer exists; minimal harnesses may verify integration without being represented as product pages.

### Stage 3 — Build and connect the real frontend

- Use the approved Dentara design, tokens and prototype as visual references. Spec 001 and later approved owner decisions govern behavior; prototype-only features and sample values are not new requirements.
- First deliver the shared application shell and actual dashboard: persistent sidebar, header, responsive main content region, route-based navigation and a useful authorized operational overview. The dashboard is the normal active-user landing page; incomplete onboarding and historical-only sessions retain their required restricted journeys.
- Every displayed sidebar destination must lead to a functional page in the main content region. Support refresh, direct links, back/forward, active state and understandable denied/not-found handling. During staged delivery, omit unfinished destinations rather than expose dead controls or claim complete coverage.
- Follow with the patient list/profile and patient clinical workspace; then connect appointments, treatment/visit/prescription journeys and relevant administration, billing, inventory, report/export workflows. Decomposition may follow workflow dependencies, but the shell/dashboard precede remaining product pages.
- Use real authorized application data and honest empty/error states. Do not invent financial values, fake live synchronization or placeholder charts. Advanced BI and other deferred prototype features remain out of scope.
- Include French language, responsive layouts, semantic controls, keyboard/focus behavior, accessible labels, confirmation of consequential actions, save/conflict/retry states and authorized print/document behavior in page acceptance.
- Page gate: show the rendered page against the relevant design reference, exercise its primary workflow with fictional data and appropriate roles, verify navigation and failure states, and run relevant regression checks. Backend success alone does not pass this gate. Present each completed round through the persistent local development workflow for owner review before proceeding to further product pages.
- Replace and remove scaffold presentation only when required journeys are covered by the real application and useful tests have been retained or adapted. Avoid leaving two permanent product frontends.

### Delivery governance

- This recovery sequence supersedes the former assumption that every upcoming ticket must deliver backend and final UI simultaneously. It does not waive the eventual UI/document acceptance of any feature.
- Subsequent use of to-tickets must make stage dependencies, acceptance gates, remaining UI requirements and evidence explicit. No automatic ticket draining is authorized.
- Use one builder and one independent reviewer covering standards and specification compliance, scoped checks, human-reviewed pull requests and human-approved merges. Distinguish inspected evidence, executed checks and worker reports.
- Report exactly what is complete at each layer. A functioning testing form is not a designed page; a visual mock is not a connected workflow; a ready-for-agent label is not execution authorization.

## Testing Decisions

- Reuse the owner-approved primary seam: authenticated HTTP/application workflows against real isolated PostgreSQL. Prior art includes the existing identity, patient, scheduling and clinical suites. Prefer observable results and retained records over private-helper tests or tests that mirror component implementation.
- Cover affected identity/access, patients, scheduling, clinical care, billing, inventory, attachments, reporting/export and cross-module transactions. Exercise clinic/patient isolation, role restrictions, historical cutoffs, stale revisions, network/retry behavior and relevant financial/stock concurrency.
- Reuse the existing small Playwright browser seam when connecting the new UI. Validate French journeys, route navigation, forms, state feedback, printing and role-specific views through the actual rendered application. Do not add a second general end-to-end framework.
- Use focused behavior-layer integration checks where they establish a contract not already covered through the higher application/browser boundary; avoid testing internal hook implementation details for coverage alone.
- Compare screenshots of rendered pages with approved reference states at comparable viewport sizes. Screenshots complement interaction and accessibility checks; they do not prove functional correctness or accessibility compliance alone.
- Restore verification remains a separate operational rehearsal because application/browser tests cannot establish backup recovery. Use fictional data throughout development and rehearsal.
- These reuse the testing seams already approved by the owner; no new testing-seam approval is needed for this specification. If future decomposition requires a genuinely new seam, propose it before depending on it.
- Run checks appropriate to actual changes. Document commands, results, tested revision and material omissions; do not run unrelated full suites or repeat broad discovery merely to produce activity.

## Out of Scope

- Immediate deletion of the frontend, resetting Git history, rewriting the backend wholesale, replacing the approved stack, or discarding verified tests and integrations.
- Implementation, ticket publication/decomposition, alteration of existing issue acceptance criteria, automatic issue closure, PR merge or deployment under this specification-writing request.
- New clinical, financial or access rules; new product features beyond Spec 001 and approved amendments; advanced BI, AI features, additional pilot languages or other deferred capabilities.
- Production deployment, live migrations, real patient data, real email delivery or service spending without the required separate authorization.
- Declaring the backend finished from issue status alone, or declaring the product/pilot ready from backend tests alone.

## Further Notes

Parent product contract: https://github.com/aymanobeid0/clinic-app/issues/1. This is a delivery-recovery specification, not a replacement clinical/business specification.

The owner explicitly chose the sequence: finish backend/API → separate frontend behavior → implement designed components/pages and connect that behavior. Existing product UI work remains frozen until its gate is reached. The earlier dashboard-first corrective implementation was stopped before application edits; it is not the active delivery order.

Next planning action: use to-tickets to reconcile remaining backend work and create explicit frontend recovery tickets/dependencies. Publishing this specification with ready-for-agent records planning readiness only. Individual implementation still requires owner authorization and satisfied prerequisites. Human review of the specification remains available through the published issue.
