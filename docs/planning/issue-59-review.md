# Independent review — #59

Reviewer: `/root/reviewer59`, sole independent reviewer for both axes under the owner's override. Comparison: `git diff 4412f3f0d97e3b6bc531a4a06ac021c88869ebb5...HEAD`; initial implementation `d7958accbeefb22992053a4ba6e11d48448fc6b1` (one implementation commit). No implementation edits by reviewer.

Read exact repository `.agents/skills/code-review/SKILL.md`, AGENTS, workflow/tracker, architecture browser-state/module responsibilities, dependency/state baseline, CONTEXT, relevant Spec001/access/file-export clauses, API reporting/export contracts, live #59 and its native blockers (#56/#57/#58 closed). React guidance: installed `C:/Users/ayman/.codex/plugins/cache/openai-curated-remote/build-web-apps/0.1.2/skills/react-best-practices/SKILL.md` and `rules/rerender-dependencies.md`. Applied fixed-ref two-axis review and Fowler smell baseline; owner replaces two parallel axis agents with this reviewer. Design/research/discovery skills unnecessary for this behavior-only change. Inspected all eight initial diff files and relevant shared read/command/StrictMode lifetime code.

## Standards

1. **P3 — feature message interface, resolved.** Architecture requires French strings behind a translation interface. Initial `useExport.ts`/`useFollowUpForm.ts` inlined feedback. Builder introduced focused `reporting.messages.ts`; final inspection confirms all new feedback uses it without a translation framework.

No speculative abstraction or other actionable Fowler smell found. Backend/contracts/schema/product UI remain unchanged.

## Spec

1. **P2 — selected patient must retire command lifetime.** In initial `useFollowUpForm.ts`, RHF reset scope includes `selectedPatient`, but the command key omits it. Switching creation patient while outcome is uncertain preserves the former patient's exact retry/feedback. Include the selected patient in the command lifetime. Independently found by inspection; builder simultaneously identified and corrected it. No independent failing runtime claimed.
2. **P2 — returning account must not restore old receipt.** Initial `useExport.ts` tags local output with the scope string. A→B hides A's receipt; B→A restores it because local scope equals A again. Builder identified this; reviewer confirmed against initial source. Unique lifetime owner tagging addresses it. No independent failing runtime claimed.
3. **P2 — cleaned artifact404 needs fresh-generation recovery.** The documented normal expiry cleanup returns404 after deletion, but initial delivery handling treats it as an account denial and permanently locks submit/retry for that selection. Drop unavailable output and permit a new generation, preserving real401/403 denial. Independently found by inspection. Reviewer added a public-browser404→new-export regression; builder's fix landed before execution, so no red claim. Independent corrected-working-tree check **1/1 PASS4.5s**; temporary test adopted into `reporting-workflows.spec.ts` and temporary file removed.
4. **P2 — expired-artifact cleanup must preserve live output.** Initial `cleanup()` unconditionally drops the ready receipt, although the endpoint only deletes expired artifacts. With a valid receipt and `deleted:0`, cleanup makes the still-valid artifact unreachable through the hook. Independently found by inspection. Builder now preserves an unexpired receipt and corrects the browser expectation. Final independent suite covers this recovery.

## Verification and limitations

Initial sandbox browser attempt failed before test execution because Chromium was unavailable under the sandbox path. Supported escalated workspace invocation succeeded. No reviewer database writes or changes to owner notes. Builder-reported52/52 browser checks and type/lint/build are not independent reviewer executions.

## Final same-reviewer source recheck

Fixed source `18f9303b06670b908023be0659ce66a100ab842f` against unchanged owner base above. Reviewer inspected the complete fix diff and current implementation/gate report, independently ran `npx playwright test reporting-workflows.spec.ts` from `apps/web`: **19/19 PASS11.7s, EXIT0**. This covers exact retries, patient retirement, A→B→A output retirement,404 regeneration,403 denial handling,410 expiry, corrupt bytes, valid receipt after cleanup, manual GET-only sharing, current projections and UTC rollover. Independent diffcheck passed and application/test working-tree diff from fixed pin was empty.

All four Spec findings resolved by inspected source and relevant passing public-browser regressions. No independent failing-runtime provenance is claimed for the initial findings; code fixes preceded the reviewer's runs. Reviewer directly inspected full-suite log footer: **26 files/259 tests PASS578.68s**, start00:07:50; execution/exit0 attribution remains builder's. The full suite's existing inputs are unchanged from main and it does not import the new browser hooks. Builder reports20/20 including authenticated real-DB journey, and live-only1/1 after test teardown adjustment; reviewer did not independently rerun the live/database journey or type/lint/build. No final product UI, complete role journey, production or pilot acceptance established.

Final documentation/publication checkpoint will be recorded separately after builder prepares it.

Initial totals: Standards1 (worst P3); Spec4 (worst P2). **Final residual: Standards0 / Spec0.**

