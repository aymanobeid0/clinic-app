# Issue #15 independent review

Root is the separate reviewer; visit_builder is the sole builder. Scheduled owner authorization covers #15 only and selects merged main at execution start: `14dc2ce9e149e1bcbca847b17d45d817ae01f46a`. PR44 MERGED, native blockers11/14 and decisionissues2–6 closed, verified live. Final application: `b1a9e5ffee1efc9dc51448ddafc9e932cce56c92`; nonempty three-dot diff and commit list verified.

## Standards

Reviewed treatment visit Routes/Controller/Service/Repository, scheduling public interface, caller-owned procedure-start transaction, clinic-scoped composite references, restricted runtime/FORCE RLS, unique immutable start/completion facts, command actor/payload binding and state ownership. Existing identity clinic lock serializes clinical/scheduling transactions; no second independent billing commit. Matt smell baseline applied as judgment under approved architecture. No dependency or generic abstraction introduced.

Preliminary findings sent to and corrected by the same builder: move scheduling business logic from public index to owning service; expose actual public recordProcedureStart(tx, clinicId, accepted snapshot); include new tables in runtime-owner checks; replay current visit state; isolate visit locks from treatment form locks; validate/prune stale selected item keys before submission. Root has not edited application code/tests. Final Standards: zero residual material findings. Final Spec: zero residual material findings.

## Spec

Reviewed booked/walk-in visit drafts, multiple selected accepted procedures, repeated visits without a fixed count, explicit procedure completion independent of visit ending, doctor eligibility/current capability/patient scope and booked doctor/patient matching. One start fact per plan/item preserves exact accepted price, discounts, extras, currency, version, actor and acceptance. Start facts and agenda/plan/visit changes share the transaction; #20 will add its due-charge operation there. No invoice/payment, note finalization, automatic chart mutation or later ticket implementation claimed.

Appointment rescheduling/status paths already reject changes once care starts. Invalid second procedure rolls back agenda writes; retries and conflicts do not create duplicate visits/start/completion events. Routine plan notes retain agreement; new care requires current accepted version. Started plans retain their prior accepted snapshots through in-progress/completed transitions.

## Skills and evidence provenance

Fresh root reads: exact C:/Users/ayman/.agents/skills/implement-spec/SKILL.md; repository .agents/skills/code-review, handoff, TDD+tests/mocking and codebase-design vocabulary; C:/Users/ayman/.agents/skills/pr; bundled build-web-apps/0.1.2 React best-practices plus derived-state reference and frontend-testing-debugging. Read AGENTS/workflow/tracker, spec/scope/CONTEXT, approved financial/clinical/access rules, dependency proposal/application architecture and current design/tokens. Single builder/root reviewer overrides fanout/merger/two review agents/full-spec draining. Approved HTTP/real isolated PostgreSQL and French Playwright seams reused. Browser plugin absent; repository Playwright applies. Existing HANDOFF+OS-temp mirror overrides temp-only handoff. Discovery/grilling/new specification/tickets/redesign/imagegen/provisioning unnecessary; owner deferred UX redesign. No deepening/design-twice workflow needed for existing seam.

Root directly read builder red/green tracer results for walk-in start, multi-visit completion and booked care; seven focused API tests passed17.19s on earlier WIP. This is observation of builder execution, not independent root testing. Final pinned verification and remaining limits follow below.

## Final verification and limits

Root independently recreated only the fictional test database, applied all19 migrations from scratch, and ran node node_modules/vitest/vitest.mjs run apps/api/test/visits.test.ts apps/api/test/scheduling.test.ts apps/api/test/treatment.test.ts on b1a9e5f: **36/36 PASS across3files in69.97s**. Root pinned whitespace and changed-file strictUTF8 checks PASS. Durable root log: OS-temp clinic-15-review-api.log. Main remained14dc2ce at final check.

Builder full92/92 application tests10files195.59s and final30/30Chromium1.3m summaries directly read by root; those are builder-executed runs, not root full-suite reruns. Typecheck/lint/build PASS per builder/durable logs. Root directly viewed clinic-15-visits-375.png and1440.png: readable wrapped controls, actor/time/progress and separate completion/end actions, no observed clipping. Four/fiveviewport overflow, pageidentity/console/keyboard/retry/removal assertions inspected in tests, not independently exercised by root.

Full browser initially28/30 failed under request budget. Samebuilder bounded production fixes avoid empty care reads for proposal-only users and duplicate initial treatment refresh; authorized server initial/reconnect invalidation and error handling remain. Fixture app resets occur after provisioning/before login, never during UI interactions. Affected10/10 then full30/30 passed with unchanged120/min limit and a separate agenda-enabled care scenario. Broad clinic-wide invalidation remains near budget (~100 requests for normal booked scenario;~113 for long synthetic journey); multi-user/load tuning is not proven. Mounting depends on started plans remaining in-progress/completed; later cancellation/revision work must revisit it. These limits are retained, not presented as solved performance.

No independent fullbaseline rerun, physical/assistive-technology/axe/other-browser certification, actual #20 ledger integration, note finalization/chart suggestions, production proxy/load/restore or clinical/legal validation claimed. No live migration/data/deployment/merge. See implementation evidence for exact fresh builder sources/procedures and corrected setup/redgreen/browser failures. Summary: Standards0 and Spec0 residual material findings; human review/manual merge required.
