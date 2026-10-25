# Independent review — #57

Reviewer: `/root/reviewer57`, separate from builder; no implementation edits. Read repository `AGENTS.md`, `HANDOFF.md`, workflow/tracker instructions and `.agents/skills/code-review/SKILL.md`. Applied both Standards and Spec axes and its full smell baseline in one reviewer, overriding skill fanout per owner. Standards sources: approved application architecture, state boundaries and repository instructions; no separate CONTRIBUTING/CODING_STANDARDS file found. Read live #57, relevant Spec001 financial/access/reliability clauses, financial amendment, CONTEXT and implementation evidence. Other implemented backend/access helpers inspected where needed; no speculative redesign or visual review.

Initial comparison: `git diff b50448fe5a6bb815438ebf25b9cd75eafa370930...d08639c52a8f4e4925870166178076ac9f0113d5`. Both refs resolve and diff is nonempty. Commit list: `df8a916` preserves prior owner documentation/tracking; `d08639c` adds billing logic/tests/report. Fixed base is the owner-approved freshly fetched main.

## Standards

- **S1 [P3] Route workflow messages through the translation interface.** `useBillingForm.ts:49,76` embeds the saved and validation French strings directly. Application architecture requires “Build French strings behind a translation interface”; existing feature message files establish the convention. Move these two messages to a billing message interface. This is a documented rule, not a smell judgement. No other actionable standards/smell findings.

## Spec

- **F1 [P2] Prevent pending sibling reads from restoring denied snapshots.** `useBillingDocument.ts:49–56` clears the patient prefix after401/403/404 through `treatmentRead`, but does not cancel or gate earlier sibling reads. Reproduced at the rendered public consumer: start a held workspace refresh, receive print403, observe blank workspace, then release the earlier200; confidential workspace data reappears. The same cancellation/cleanup contract must cover workspace-originated denials and document reads. #57 requires server-authorized access, and the owner explicitly requires scope/cache cleanup and safe lifetimes.
- **F2 [P2] Retire or refresh dynamic summaries after successful changes.** `useBillingForm.ts:46` invalidates billing queries, but `useBillingDocument.ts:48` uses the imperative `useTreatmentRead` observer with `queryFn: skipToken`. Invalidation leaves the displayed summary intact and cannot reload that disabled query. After applying credit or issuing an invoice, a prepared summary can keep old paid/due/invoice references until manually prepared again. Spec001 requires summaries showing current paid/remaining amounts and invoice references. Clear or refresh the dynamic snapshot on relevant successful changes/invalidation; output reauthorization alone does not fix the returned preview state.

Initial totals: Standards1 (worstP3); Spec2 (worstP2). Recheck pending builder fixes.

## Same-reviewer source recheck

Reviewed complete corrected scope against the same fixed main base at `bc0d8ecd0d26e272bf412567084b078da49b5118`, including `git diff d08639c..bc0d8ec` and the newly affected shared read helpers. **S1/F1/F2 resolved; Standards0 / Spec0 residual findings.** French workflow messages now use `billing.messages.ts`. Billing reads opt in to patient-prefix denial cancellation while excluding the rejecting query; other consumers keep their previous default behavior. Both directions of pending-read denial are covered. Billing document invalidation retires the imperative preview and requires a fresh authorized prepare/output request, fixing dynamic summaries without altering immutable backend documents.

Reviewer directly reran `npx playwright test test/billing-workflows.spec.ts`: **7/7 PASS,5.8s**, at unchanged corrected source. This independently verifies confirmation/exact retry, StrictMode patient change, separate balances/output authorization, selected-document cancellation, print403 versus held workspace read, workspace404 versus held output, and successful correction retiring/freshening a prepared summary. Pinned `git diff --check base...bc0d8ec` also PASS. No DB writes or backend resources used. Builder reports affected rendered/real/shared browser17/17 PASS15.0s and typecheck/lint PASS; those broader results are not independently rerun by reviewer. Source accepted for the final full suite; final evidence/handoff/mirror checkpoint remains pending.

## Independently observed verification and limits

- Pinned `git diff --check`: PASS. Independently inspected action-schema/path mapping, existing command retry/payload retention, account/patient/action lifetime keys, Query ownership, document output routes and unchanged server authority.
- F1 reproduced directly using Playwright with the existing test-only consumer and intercepted fictional responses, no DB writes: `afterDenial` blank; `afterEarlierReadReturns {"totals":[{"currency":"EUR","dueMinor":"CONFIDENTIAL"}]}`.
- F2 confirmed through source and a direct public QueryClient/QueryObserver probe matching `useTreatmentRead`: fetch `{dueMinor:'100'}`, invalidate billing/account prefix, observer still returns100 and `isStale:false`. An ad-hoc rendered summary probe failed due a duplicate optimized Query module/provider context in the probe; no successful browser verification of F2 is claimed at this stage.
- Reviewer temporary Vite process on4173 stopped. No resources/DB touched. Builder-reported browser/type/lint results were read, not independently rerun. Final full-suite/build evidence, fixed-source checks, compact handoff/mirror and publication remain pending. Known absent billing-specific SSE endpoint is documented; no backend expansion requested. Final product UI remains deferred.

## Final evidence and handoff checkpoint

Same reviewer directly inspected exact checkpoint `7915d6801a3a3799cfa33d84e9026d4094872a17`, complete updated implementation report, compact HANDOFF and actual temp mirror. `git diff bc0d8ec HEAD -- apps packages` is empty: application/test source remains the accepted `bc0d8ecd0d26e272bf412567084b078da49b5118`. Pinned base-to-checkpoint diffcheck PASS. Both handoff hashes directly match `76E30E0442520346F254EC6AE7BF202334BB1E73BF58788F12310BC1A4608521`.

Reviewer independently read `.local-dev/issue-57-full-tests.log`: START2026-10-25T19:44:07.3698243Z / END19:52:29.1146126Z, exact fixed source at both ends, **26files/259tests passed,499.56s,EXIT0**. This is independent inspection of retained execution output and unchanged source, **not an independent full-suite rerun**. Reviewer directly reran only the seven rendered billing tests described above. Builder reports post-suite build PASS and bundle542.62kB/157.64kB gzip advisory, disposal of only verified issue57 test resources and unchanged stopped owner issue7; no reviewer rebuild or resource mutation is claimed.

Evidence/handoff checkpoint accepted for standing push/PR publication: **Standards0 / Spec0 residual**. Provenance, actual checks/omissions, authorization boundaries, deferred UI and known billing-stream limitation are accounted for. Human review/merge remains required. Publication metadata is still pending at this checkpoint; no PR/remote CI result is inferred.
