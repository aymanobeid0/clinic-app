# Issue #9 independent review — 2026-10-14

Reviewer: coordinating root agent, separate from the sole patients_builder. Applied the requested Matt code-review instructions with the owner's single-reviewer override; standards and specification findings remain separate.

Owner-directed comparison uses merged main `1201dde9e23bbefc9a2075cd2cfa9c6e5d577c44`, confirmed unchanged on GitHub on October 14. Reviewed head: `d25baa39bbb52d7bff9384f4dd93d832032fde91`. Pinned command: `git diff 1201dde9e23bbefc9a2075cd2cfa9c6e5d577c44...d25baa39bbb52d7bff9384f4dd93d832032fde91`. Both refs resolve and the 28-file diff is nonempty. Commits: `1550581 feat: register search and archive clinic patients (#9)`; `d25baa3 docs: clarify pinned checks and normalize patient migration lines`. Later review/publication documentation does not modify application code.

Sources: current GitHub #9 criteria, closed blocker #8, merged PRs #36/#37, AGENTS.md, issue-tracker.md, skill-integration.md, CONTEXT.md, spec-001-clinic-mvp.md, mvp-scope.md, approved architecture/dependency and identity decisions, identity-module-design.md, design references and owner-deferred visual redesign. Checked the skill's Fowler smell baseline, with repository architecture taking precedence.

## Standards

Zero residual material findings. Routes/controllers/services/repositories keep approved responsibilities. The public identity authorized-transaction interface centralizes current actor readiness and explicit permissions; checks and patient mutations share the clinic-serialized transaction. Manager authority does not bypass patient grants. Tenant composite foreign keys, FORCE RLS and runtime-role verification cover patients and immutable personal history. TanStack Query owns server records; form drafts and retry commands remain in tab memory. Dependencies are unchanged. Layer delegation follows the approved architecture rather than constituting a standalone middle-man violation.

Same-builder corrections were independently rechecked: original registration receipts prevent later-edit disclosure; retries retain their original revision; permission updates no longer remount and discard unrelated drafts; read revocation hides duplicate details and clears query state; invalidations arriving during heartbeat authorization are coalesced; streaming cleanup handles closed responses. The initial pinned SQL whitespace failure was corrected to LF without changing SQL semantics. No remaining baseline smell warrants additional scope.

## Spec

Zero residual material findings for #9. Required name/phone, guardian attribution, automatic clinic numbering, legitimate shared numbers, duplicate warnings, authorized search, uncapped registration with pagination, explicit edit/archive/reactivation, immutable personal history, French journeys and failure/concurrency behavior are implemented. Explicit current grants, readiness, tenant isolation, conflict detection and receipt redaction are enforced through observable application boundaries. Archive changes status rather than deleting patient/history records.

Finalized clinical/financial records do not exist yet: their retention integration tests must be added with those tickets. This review verifies the current non-deleting archive and retained personal history, not nonexistent finalized-record integrations. Assignment/sharing and historical clinical cutoffs remain #10/#18; patient read permission cannot establish those future clinical rights. No unsupported finished-MVP claim is made.

## Verification and limits

Root independently executed `npm test -- apps/api/test/patients.test.ts`: 11/11 HTTP tests passed, 14.68 seconds, against isolated fictional PostgreSQL. Root inspected the pinned application/test/migration diff and independently ran its final `git diff --check`: pass. Root inspected the builder's mobile screenshot; it shows functional French patient forms without horizontal clipping at the captured width.

Builder-reported final execution on the implementation tree: 37 HTTP tests/five files (35.65s), nine Chromium journeys (25.3s), typecheck, lint and contracts/API/web builds passed; targeted patient browser journeys 3/3. Those full suites/builds were not independently rerun by root. Tests ran before the final SQL newline-only correction; equivalent SQL had been applied to the disposable database. See issue-9-implementation.md for red/green evidence, screenshot paths, deliberately aborted network cases and teardown fixes.

Supplemental live Chrome preview sign-in remained incomplete: 403 diagnostics showed a matching session/CSRF token but the forwarded Origin parsed as loopback host without port4173. The builder independently sent a request through the same Vite proxy with the correct Origin; it passed CSRF and reached the expected401 for a nonexistent fictional identity. This isolates the observed preview failure to the supplemental browser request Origin; no application/security changes were made. Root observed the UI rejection; diagnostic flags/proxy check are builder-reported. The prior automated Chromium journeys remain separate passing evidence. A normal-browser manual journey can be repeated by the owner; no manual success is claimed.

Performance/load, distributed notifications, ingress/proxy SSE, Linux/native runtime, live mail, backup restoration and real-data/legal gates remain unverified. No production deployment/migration, real patient data or live email was authorized or used. Human approval remains required to merge.

Standards: 0 residual material findings. Spec: 0 residual material findings, with future finalized-record integration explicitly unverified.
