# Issue #19 independent review

Reviewer: `review_issue19`, separate from builder. Owner supplied `main`, pinned `a8b5ad6e563d1a8752263087e7cb3486f5e0be11`; initial reviewed commit `c765741`. Commands: `git diff a8b5ad6e563d1a8752263087e7cb3486f5e0be11...c765741`, `git log a8b5ad6e563d1a8752263087e7cb3486f5e0be11..c765741 --oneline` (one implementation commit, nonempty diff).

Freshly read repository `AGENTS.md`, `docs/agents/skill-integration.md`, tracker, `.agents/skills/code-review/SKILL.md`, architecture, recovery reconciliation, CONTEXT, approved file/access contracts, API documentation and implementation record. Current #19 fetched directly through GitHub connector. One reviewer covers both axes; owner single-reviewer rule overrides skill fanout. No other skill is needed for this non-UI review; no fixes implemented by reviewer.

Reviewer also directly fetched current #6/#10/#50 (all closed) and independently confirmed native blocker links #6/#10/#50 via read-only GitHub CLI using supported escalation. No reviewer connection failure or stale local tracker substitution.

## Standards

No documented code-standard violation or actionable baseline smell identified in the initial runtime diff. Backend feature layering, module public entry, tenant scope, immutable retained version grants and separate transport types follow the approved architecture. Required final builder verification/handoff is pending; initial test-first upload provenance is recorded by builder, not independently verified chronology. No claim of universal red-before-green execution.

## Spec

1. **P2 — Corrupt PDF filter-array streams bypass decoding.** `validate-content.ts:71–73` only validates absent filters or the exact string `/FlateDecode`. A page Contents stream containing invalid bytes with `/Filter [/FlateDecode]` is accepted. The approved file contract requires “Reject ... invalid/corrupt files ... before publication.” Reviewer independently constructed this document and invoked the built validator corresponding to the reviewed source; output was `CORRUPT_FILTER_ARRAY_ACCEPTED`. Decode/validate supported filter arrays or reject unsupported filter structures before publication. Builder subsequently reports an authenticated HTTP red regression returning 200 instead of 400; that reproduction is builder evidence.

2. **P2 — Expiry cleanup can lose track of a delayed private write.** `files.service.ts:85–87` discards an expired key and deletes its reservation while a delayed `store.put` may not yet have created the object. The writer can then create it, fail publication because its reservation is absent (`128`), and skip cleanup because the catch only acts when a reservation exists (`163`). The object is unpublished and unaccounted, with no remaining key for future reclamation. The file contract requires “release failed/cancelled upload reservations, and clean abandoned temporary uploads without publishing them.” Preserve sufficient cleanup state and reconcile actual published-version existence before deleting failed objects. This finding is independent code inspection; builder reports a new HTTP delayed-write regression confirming two objects remained where one was expected.

PDF decompression has no expanded-size/time bound during `PDFDocument.load` or stream decoding; reviewer raised this for hardening, without executing a destructive resource-exhaustion probe. API documentation also promises 503 for unavailable storage while missing-object read errors currently become sanitized generic 500; builder notified to normalize behavior or documentation. These concerns are not silently certified as solved by the initial passing suite.

## Independently executed checks

- `npx vitest run apps/api/test/attachments.test.ts`: **10/10 PASS**, 31.39 s, against real isolated PostgreSQL and private temporary disk, initial `c765741` runtime. It overlapped the builder's full suite, so timing is not a performance claim. One intentionally injected disk failure produced the expected sanitized error event.
- `npm run typecheck`: initially failed because generated `@clinic/contracts` declarations lacked the newly added `versions` field. The committed source already had it. After `npm run build --workspace @clinic/contracts`, typecheck passed. This distinguishes a stale generated artifact from a source fix.
- `git diff --check a8b5ad6e563d1a8752263087e7cb3486f5e0be11...c765741`: PASS.
- No independent full-suite, browser, production/Linux native-parser, deployment, live migration, actual 2GB disk-capacity or restore rehearsal run. Current routes safely deny historical-only accounts; #18 separately owns historical grant/cutoff delivery. Conservative rejection of opaque financial files for users whose own-work/restricted-field scope cannot be enforced follows the approved deny-unseparable-content rule.

Initial disposition: Standards 0 findings; Spec 2 P2 findings, both require builder fixes and same-reviewer recheck. Backend-only scope remains distinct from #54/#68/#64/#60/#76.

## Same-reviewer recheck — `162186f`

Re-read the applicable skill-integration checkpoint and inspected the complete updated pinned diff plus `c765741..162186f` (fix `f433c38`, worker-admission follow-up `162186f`). No runtime fixes made by reviewer. A working-tree formatting-only change in `packages/contracts/src/attachments.ts` was visible; it does not change the reviewed contract's meaning.

**Standards:** 0 unresolved findings. Feature/module boundaries and RLS/runtime grants remain intact. Worker execution stays within the API process rather than adding infrastructure; its process-wide admission count lasts until actual worker exit, including disconnected requests. No new UI, production operation or patient-data use was introduced.

**Spec:** Both initial P2s are fixed by independent inspection and the rerun regressions. PDF filters/one-element arrays are now checked in the isolated worker; supported Flate streams use bounded strict zlib decoding, unsupported chains are rejected, and embedded JPEGs are decoded. Cancelled reservation keys survive reaping, do not consume upload quota, and remain discoverable for repeated cleanup; failed writers inspect committed versions before discard even when their active lease is gone. Read failures now become the documented sanitized 503. No unresolved actionable finding identified in the corrected backend scope.

Independently executed on `162186f` runtime:

- `npx vitest run apps/api/test/attachments.test.ts`: **13/13 PASS**, 65.59 s, real isolated PostgreSQL/private disk. This includes the two corrected regressions and storage-read 503 behavior. Concurrent builder full-suite work means this is not a performance benchmark.
- `npm run typecheck`: **PASS**; contract declarations had already been rebuilt after the earlier stale-artifact failure.
- `git diff --check a8b5ad6e563d1a8752263087e7cb3486f5e0be11...162186f`: **PASS**.
- Additional bounded diagnostic against the compiled validator: a small PDF with a Flate stream expanding to 40,000,001 bytes was rejected with **400**. This verifies that explicit stream-budget path, not complete adversarial resource safety.

Limits remain explicit: five-second worker deadline and V8 heap/stack limits are not whole-host/native/ArrayBuffer memory guarantees. PDFDocument loading can process object/XRef streams before the later enumerated-stream budgets; no destructive resource-exhaustion test or host-isolation proof is claimed. Supported PDF content is intentionally conservative, as documented. No independent full-suite/build/Linux native/browser/restore/production checks were run; builder's completed results must be attributed separately. Historical grant/cutoff integration remains #18; logic/UI owners remain outstanding. Final handoff and required builder full-suite result must be completed before PR publication.

Final reviewer disposition at `162186f`: **Standards 0 unresolved; Spec 0 unresolved**. Initial Spec findings: 2 P2, both fixed. Human PR review/manual merge remains required.
