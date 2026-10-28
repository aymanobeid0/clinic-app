# #107 — Independent Standards/Spec review

2026-10-28. One separate reviewer, both axes, under the owner's one-builder/one-reviewer override. No implementation fixes, additional reviewers, tracker changes, production actions or resource creation/deletion by this reviewer.

Comparison/base supplied by builder from fresh main: `d79e6c7683c44b908b0b8b35cc11ae95c6526d80`. Reviewed source: `b6a2bc203aa2027c0f0c01a4855cf5b164422ba4`. Both resolve; nonempty diff13 files. Exact comparison: `git diff d79e6c7683c44b908b0b8b35cc11ae95c6526d80...b6a2bc203aa2027c0f0c01a4855cf5b164422ba4`. Commit list: `b6a2bc2 feat: expose consultation frontend workflows (#107)`. Application-source working diff from pin was empty during review.

## Sources and procedure

Independently read actual `.agents/skills/code-review/SKILL.md`, AGENTS.md, docs/agents/skill-integration.md and issue-tracker; the installed React skill at `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md`, with rerender-derived-state-no-effect and rerender-move-effect-to-event references. Applied the review skill's documented-standards and Fowler smell baseline, treating smells as judgment calls and skipping tooling-enforced checks. Owner overrides the skill's two parallel agents with this single combined independent review. TDD/implement/handoff/PR execution remain builder responsibilities; no new discovery/design or separate QA role needed for this logic-only review.

Current GitHub107 independently fetched with `gh issue view107 --json body,comments,state`; OPEN, comments empty. Native dependency endpoint independently read:105/106/59 CLOSED. Used elevated reads because the parent had already established sandbox DNS failure. No connection blocker remained. Product basis: current107, approved consultation integration, ADR0002, consultation-implementation-scope, architecture, financial and identity/access decisions. Inspected new feature hooks and existing treatment command/read lifetime, identity retirement, visit/note/billing API paths and access guards. Builder implementation report is supporting provenance, not a substitute for code inspection or my own execution.

## Standards

0 findings. Scope stays in frontend business logic and verification consumers; no product components/pages/routes/main-app or scaffold retirement. Query retains server projections, RHF owns inputs, React owns command feedback, and no unnecessary Zustand or persistent sensitive state was added. Amounts/shares/rates come from server projections, existing schema validation and exact-command transport are reused. Shared command/form helpers serve existing concrete callers; no actionable baseline smell found.

## Spec

1 finding, P2 — **coordinate server-denial retirement across the consultation scope**. Current107 requires “Identity/patient/scope changes retire prior drafts, results and output authority” and truthful denied states. In `useConsultationForms.ts:107–110` and `useConsultationCare.ts`, the command lifetime key uses `active:<consultationId>` while consultation/share queries use the `active` root (`useConsultationQueries.ts:33–44`). The reused command workflow clears only its own key prefix on401/403/404, so a rejected payment leaves previously read consultation and remuneration data visible. Separately, `useCommandForm` only resets for its own command's denial or an explicitly changed caller token (`useConsultationForms.ts:30–35`); an authoritative patient-query403 leaves a mounted booking draft intact. Relying on a later SSE fetch or future visual caller glue is insufficient for the delivered logic's observed denial. Keep a distinct selected-command lifetime if needed, but coordinate denial invalidation/retirement with the patient read scope and retire mounted drafts/uncertain authority on authoritative denial. Add focused rendered regressions for both manifestations without weakening exact retry.

Independent rendered diagnostic at the reviewed pin confirmed:

- Load mocked consultation and share40%/20000minor, type booking price500 and payment500, return403 from payment: payment draft became empty, but share still rendered `{"rate":"40","shareNumerator":"2000000","shareDenominator":"100"}` and consultation rows remained visible.
- Return403 from the patient consultation GET and explicitly refetch: rows became empty, but booking price remained `500`.

This is one shared retirement defect with two manifestations, not two independently ranked findings. It is a frontend stale-data/draft problem; no claim of a backend authorization bypass. Recheck by the same reviewer is required after the builder fix.

## Independently executed evidence and limits

- `git diff --check d79e6c7683c44b908b0b8b35cc11ae95c6526d80...b6a2bc203aa2027c0f0c01a4855cf5b164422ba4`: passed.
- In apps/web, `$env:CLINIC_TEST_PORT='55445'; npx playwright test --config playwright.consultations.config.ts consultation-workflows.spec.ts consultation-live.spec.ts`: **12/12 passed,29.8s**. Includes10 explicitly mocked consumer cases and2 real authenticated fictional API/PostgreSQL journeys covering both500/40% sequences, retained rate, same encounter, procedure completion and pending-note/finalization. Persistence is real; only mail delivery and the10 labeled boundary cases are mocked. The existing tests do not cover the demonstrated denial defect.
- Separate no-file Node/Playwright diagnostic: start `npm exec vite -- --config vite.consultations.config.ts`, run `node --input-type=module -e` with chromium and API boundary routes against the existing care harness; first payment POST403, then patient GET403. Directly observed values recorded above. Task Vite4187 runner stopped afterward. No source/test edits made to reproduce.
- Only task-owned4187/3187 and existing fictional DB55445 used. No owner4173/4175/55437, ERP/Apidog, real data/mail, migrations or new resources touched. Builder full suite/static checks are not claimed as independently rerun. This is hook/API behavior review, not final designed UI, browser-layout, deployment or real-patient acceptance.

Summary at b6a2bc2: Standards0; Spec1 (worst P2, coordinated denial retirement). Pending builder fix and same-reviewer recheck.

## Same-reviewer recheck1 — c7cd52f (partial fix)

Reviewed `c7cd52f3237752b6e2410a1fb549159f0592db6e` against the same main/base; commit after initial pin: `c7cd52f fix: retire consultation state together on denied access (#107)`. Read the complete correction diff, including consultation.authority, command lifetime/denial keys, read suspension and recovery, two added regressions and the date-relative API fixture. Independent diff check passed. The date fixture now changes the actual booking date by one day, preserving the original changed-payload assertion when today's date equals the previous constant; no API behavior change.

Standards remain0. The ephemeral per-QueryClient Zustand store contains only genuinely shared local suspension flags; server projections remain in Query and no persistent drafts/state are introduced. Command lifetime discrimination is separate from common patient-denial scope, so direct denial now masks related reads, resets mounted drafts and retires uncertain workflow instances.

Spec P2 remains open for a recovery race in `useConsultationQueries.ts:63–68`: `query.refetch()` can resolve a canceled read as reverted cached success, so `!result.error` is not evidence of a fresh authorized read. Installed query-core's Query.fetch explicitly returns reverted data for CancelledError when prior data exists (query.ts near778); QueryObserver also swallows thrown errors unless requested otherwise. Thus `throwOnError:true` alone cannot establish fresh success for the existing-data cancellation path.

Independent no-file Node/Playwright diagnostic at c7cd52f: load consultation/share, hold all subsequent GET responses, click Relire to start a held patient read, then return403 from payment. Rows were cleared but the rendered denied flag became `false`;10 subsequent reads were held, with **zero fresh successful reads after denial**. The prior canceled read had resumed authority. The fix needs proof tied to the particular fresh recovery fetch and denial generation, while preserving uncertain-command retirement.

Also confirmed an integration defect in the default browser test discovery: `apps/web/playwright.config.ts` includes every .spec.ts, including consultation-live, while its4173 runner proxies3000 and this suite requires4187/3187. The isolated suite should be excluded from the default runner and exposed through a discoverable dedicated script. This is a second P2 integration finding at c7cd52f; builder raised the same issue during recheck. No owner4173 service was used to reproduce it; it follows directly from the two configured origins/proxies and test discovery.

Independent execution: same14 rendered tests (12 prior +2 direct-denial regressions) **14/14 passed,36.4s** at c7cd52f with CLINIC_TEST_PORT55445. Direct-denial reset and ordinary fresh-read recovery now pass; these cases do not cover canceled-refetch recovery. Manual diagnostic Vite4187 runner stopped after the observed race. No implementation edits or additional agents. Summary at c7cd52f: Standards0; Spec2 P2 (recovery race within original retirement finding; default test discovery). Further builder fixes and same-reviewer recheck pending.

## Final same-reviewer recheck — c278c42

Final reviewed source: `c278c4200bc64f4856e7112ea8cc65e27f8431d1`, same base `d79e6c7683c44b908b0b8b35cc11ae95c6526d80`. Latest commit `c278c42 fix: require fresh consultation recovery and isolate browser discovery (#107)`. Read the complete correction and full cumulative application diff; checked the unchanged source pin. Independent cumulative diff check passed.

**Both P2 findings resolved.** Recovery no longer resumes from an ordinary observer refetch. Suspended recovery uses a Query-owned fresh fetch, with a success marker set only by its actual non-aborted transport; a monotonically versioned suspension must still match before resume. A canceled/reverted cached outcome cannot meet this condition. A fresh identity/patient/scope still creates a distinct lifetime, and suspended command instances are disposed, preserving exact retry only while the original authority remains current. The local Zustand map contains only shared suspension state, not projections or sensitive drafts. Default Playwright discovery now ignores consultation specs, with a dedicated `test:consultations` script for the isolated config.

Independently executed at c278c42:

- In apps/web, `$env:CLINIC_TEST_PORT='55445'; npm run test:consultations -- consultation-workflows.spec.ts consultation-live.spec.ts`: **15/15 passed,22.6s**. Includes13 labeled mocked cases and2 real authenticated API/PostgreSQL journeys, the original direct-denial regressions, cancellation/late-success retirement and explicit fresh authorized recovery. No Prisma teardown errors observed.
- `npm run test:browser -- --list`: **104 tests/18files**, no consultation specs. Read-only discovery starts no4173 server. `npm run test:consultations -- consultation-workflows.spec.ts consultation-live.spec.ts --list`: **15tests/2files**. Unfiltered isolated script discovery includes the intentionally compatible workflow regressions too: **72tests/8files**. Listing works without CLINIC_TEST_PORT; execution's55445 guard remains before connecting.
- Additional independent no-file Node/Playwright diagnostic against the existing care harness: first payment500 loses its response and becomes uncertain; patient-read403 suspends/clears it; a subsequent authorized fresh patient read restores the scope with empty payment inputs and uncertain=false; payment600 then sends a **new command ID**. Exactly2 POSTs, amounts500 then600; the retired unknown command did not return after reauthorization. All boundary responses in this diagnostic are mocked and labeled as such. Temporary Vite4187 runner stopped afterward.

No implementation edits, extra agents, migrations/resource mutations or owner services used by this reviewer. Typecheck/lint/build/full Vitest suite remain builder-run evidence; no claim that this reviewer reran them. Final designed UI, deployment, real mail/patient use and manual merge remain outside this review.

Final review disposition at c278c42: **Standards0; Spec0; both reported P2s resolved.** Proceed with the builder's final pinned verification/handoff and human-reviewed PR; no merge authorization implied.
