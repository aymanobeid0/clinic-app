# Issue #16 independent review

Root is the separate reviewer; note_builder is the sole builder. Scheduled owner authorization covers #16 only and selects execution-start merged main `203181d321f4ad1e57fbfd53e64246a1f39166da` (PR45). Live #16 criteria/native blocker #15 and decisions #2–#6 were checked; PR45 is merged and main remained unchanged at final live read. Application commit: `c0ad508dc8f65672975b1caf2d6046b418ecdeee`. Reviewed nonempty `git diff 203181d...c0ad508` and its one-commit log.

## Standards

Reviewed Routes/Controller/Service/Repository ownership, treatment public encounter projection, existing identity clinic transaction lock, append-only ClinicalRevision persistence/FORCE RLS, command actor/payload binding, canonical UUIDs and current permissions on reads/writes/retries. Notes use existing React Hook Form/local tab state and TanStack Query server state; no sensitive browser persistence, dependency, financial operation or new test seam. Applied Matt smell heuristics as judgment under repository architecture. Optional scoped invalidations have a concrete autosave purpose; global events and heartbeat still reauthorize streams.

Same-builder fixes from review: canonical note keys/UUID routing, distinguish comparison fetch from saving, map actual warning tokens, remove duplicate/empty note refreshes and preserve existing formatting. Builder additionally reproduced and fixed uppercase-created visit snapshot identity using canonical database IDs. Root did not edit application code/tests. No residual material Standards findings.

## Spec

Free text is retained exactly. Autosave acknowledges the submitted text without replacing newer typing; an uncertain request keeps its original command. Stale revisions retain input and require server comparison plus an explicit choice. Doctor-only finalization preserves staff authorship and finalizer attribution; immutable original/finalized corrections retain dates and permission-controlled history. Ended visits display pending notes without requiring finalization. Current read/patient scope applies even to replays; superseded receipt content is redacted after history access loss. Financial actions remain explicit. No residual material Spec findings.

## Skills and provenance

Fresh root reads: exact C:/Users/ayman/.agents/skills/implement-spec/SKILL.md; D:/clinic-app/.agents/skills/code-review/SKILL.md (pinned diff, standards/spec, Fowler baseline), tdd/SKILL.md plus tests.md/mocking.md, handoff/SKILL.md; C:/Users/ayman/.agents/skills/pr/SKILL.md; bundled build-web-apps/0.1.2 React best-practices plus derived-state reference and frontend-testing-debugging. Read current AGENTS/workflow/tracker, approved spec/scope/CONTEXT/access/clinical rules, architecture/dependencies and relocated root design/tokens. Builder sources/procedures are separately attributed in issue-16-implementation.md. Reading is not execution evidence.

Owner/repository overrides: #16 only, one builder/root reviewer rather than fanout/merger/two reviewers, same-builder fixes, approved authenticated HTTP/isolated PostgreSQL/French Playwright seams reused; existing HANDOFF plus OS-temp mirror rather than temp-only. Browser plugin absent, so repository Playwright used. Discovery/grilling/new specification/tickets, redesign/prototyping/imagegen/provisioning unnecessary; UX research deferred. Existing public seams did not need a new deepening/design-twice exercise. Root did not independently execute the builder's UI-engineering skill or browser journeys.

## Verification and limits

Pinned diff whitespace and changed-file strict UTF-8 checks passed. Root directly read builder full API 96/96 (161.75s), frozen-source typecheck/lint/build and final frozen Chromium 32/32 (1.6m) logs. Full API precedes the last canonical-ID fix/new fifth note case; builder focused note/uppercase 5/5 passed afterward. These are builder-executed checks, not root full-suite reruns. Root directly viewed narrow correction, refreshed desktop correction and French network-error/retry images; readable wrapping, retained text and controls observed. Four viewport/keyboard/console/storage assertions were inspected in tests, not independently exercised by root.

First full browser run had an actual 429 care regression; same-builder removed duplicate note refreshes/empty pre-visit loading without changing 120/min. A subsequent remote-completion timeout and proposal-retry CSRF403 are retained in evidence. Concurrent build/Vite reload is a hypothesis for the latter, not proven by a failed trace. Unchanged proposal retry passed three traced repetitions, and final frozen full run passed all32. No identity changes or hidden mid-journey rate resets.

Long-record per-visit database reads/history growth and clinic multi-user request/load behavior remain unbenchmarked. No assistive-technology/axe/other-browser certification, clinical/legal validation, production proxy/restore/deployment/live migration/real data/email/merge claimed. Current-tab protection does not survive closing the tab; the UI says so. Historical-only operational notes and later ticket work remain outside scope. Human review/manual merge required.

Independent fresh-database results follow before publication.

Root independently recreated only the fictional PostgreSQL project, applied all20 migrations from scratch and ran `node node_modules/vitest/vitest.mjs run apps/api/test/visits.test.ts apps/api/test/clinical.test.ts apps/api/test/patient-access.test.ts` on c0ad508: **32/32 PASS across3files in63.74s**, exit0. Durable logs: real OS-temp clinic-16-review-migrate.log and clinic-16-review-api.log. No independent fullbaseline/browser rerun claimed. Summary: Standards0 and Spec0 residual material findings; ready for human review.

Publication: PR46 https://github.com/aymanobeid0/clinic-app/pull/46 is OPEN, non-draft and MERGEABLE against main; attached to this chat. Only documentation follows the reviewed application commit. Disposable database stopped; builder API/Vite ports cleared. One-time implement-clinic-issue-16 automation PAUSED. Human review/manual merge remains the next step; no later issue authorized.
