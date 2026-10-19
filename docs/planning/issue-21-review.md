# Issue #21 independent review

Single independent reviewer, covering Standards and Spec; no implementation edits or additional agents. Freshly read AGENTS.md, docs/agents/skill-integration.md, docs/agents/issue-tracker.md and repository `.agents/skills/code-review/SKILL.md`, including its substantive two-axis procedures and complete Fowler smell baseline. Owner/repository one-reviewer override replaces parallel review agents. Implementation/TDD and handoff skills considered but not selected for this inspection/report role; builder owns those procedures. No UI/design or architecture-discovery workflow applies to this existing backend seam.

## Scope and evidence

Owner comparison main-at-start `418bb1c0ff2352d0d77ed2af76a34576808c2818`; reviewed runtime HEAD `b20f3e05130c058e45738cc54630261efe8290d0`. Independently resolved refs, confirmed nonempty `git diff 418bb1c0ff2352d0d77ed2af76a34576808c2818...HEAD`, and read its commit list: preserved cleanup `97905e1`/`241bd7f`, merge `11401b5`, implementation `b20f3e0`. Inspected cleanup report and corresponding deletions/config changes: these preserve the separately authorized removal, do not resurrect the launcher, and retain automated test infrastructure. Their inclusion in the comparison needs disclosure in the PR rather than treating them as newly authorized billing work.

Direct current GitHub #21 body and native blocked_by reads initially failed with `error connecting to api.github.com`; supported escalated retry succeeded. Both native blockers #20/#50 are closed. Current criteria are backend/API only with #57/#69/#60/#76 outstanding. Builder's direct prerequisite/PR79 checks are attributed in issue-21-implementation.md; this reviewer independently resolved the pinned base but did not repeat every decision-issue/merge endpoint read. No unresolved connection blocker.

Inspected approved financial-decisions.md, identity-access-decisions.md, relevant Spec 001 financial/access clauses, recovery reconciliation, application architecture/dependency proposal, CONTEXT and issue20 implementation/review evidence. No separate CONTRIBUTING/coding-standards file was found by targeted filename discovery; documented architecture and repository rules govern alongside the heuristic smell baseline.

## Standards

No substantive documented-standard breach or actionable Fowler-baseline smell identified. Feature routes/controller/service/repository follow the approved concrete structure; transport stays in shared contracts, database queries remain server-side, and financial orchestration stays transactional. No speculative lock redesign, dependency, product UI or state-boundary change. Retained JSON domain snapshots follow the existing immutable financial implementation.

Independent pinned-diff whitespace check initially failed on migration.sql lines 10–11 (CRLF trailing whitespace). Reported to builder for normalization; final recheck remains required. This tooling-enforced cleanup is recorded as verification, not a substantive smell finding.

## Spec

No actionable correctness or scope finding identified in the reviewed runtime diff. New money equals manual charge allocations plus explicit separate deposit, with old credit separately allocated and linked to retained sources. Due and available credit remain exact independent per-currency totals. Credit-only allocation issues no new receipt; new funds issue a retained clinic/year number and snapshot method/identity. Current authorization precedes command replay; whole mixed/unassigned receipts are withheld from doctors while their own charge allocation projection remains available. Doctors cannot view or spend the unassigned pool. Staff projections carry neutral financial references without clinical descriptions.

Clinic treatment lock precedes projection/replay/numbering and writes; command result and settlement commit together. Existing SELECT/INSERT runtime grants, FORCE RLS and receipt uniqueness protect retained financial history. Failed persistence rolls back funds and number issuance. Reconciliation compares adjusted charge to accepted price and refuses reduction below already allocated funds. Corrections/refunds/reallocation remain #23; invoices remain #22.

## Verification and limitations

Reviewer independently ran `npm run typecheck` successfully on `b20f3e0`. Inspected the real PostgreSQL/authenticated HTTP test matrix for deposits, explicit excess, mixed/credit-only allocations, old source links, method revisions, stale commands, currency precision, patient/clinic and current role isolation, concurrent credit use on different charges, injected post-settlement persistence failure, output permissions and UTC yearly numbering. Test inspection is not independent test execution. Reviewer deferred integration execution while builder's full suite uses shared isolated persistence.

Builder reports fresh disposable database 28 migrations and billing 14/14 tests passed, plus type/lint/build passes on `b20f3e0`; full suite was still running when this report was written. These are worker-reported results, not independently rerun claims. The inspected tests do not explicitly exercise mixed-doctor whole-receipt withholding/own-allocation preservation or below-paid reconciliation rejection; code inspection supports those paths, and reviewer recommended focused regressions without claiming they ran.

Initial substantive disposition: Standards 0 / Spec 0 actionable findings. Final required-check results, whitespace correction and any added regression evidence must be recorded before publication. No browser/product/legal/production readiness is established. Human review/merge remains required; no next-ticket progression.

## Same-reviewer final recheck

Reviewed final test/normalization commit `afb0bb72788a233e901bbbd084db12704e1ee402`. No application semantics changed from `b20f3e0`: the migration's last two lines are normalized and two focused HTTP regressions were added. Independently inspected both regressions and reran `git diff --check 418bb1c0ff2352d0d77ed2af76a34576808c2818...HEAD`: passed. This resolves the earlier whitespace failure.

Reviewer directly executed `npx vitest run apps/api/test/billing.test.ts -t 'mixed-doctor settlement|accepted price reconciliation preserves'` on `afb0bb7`: **2 passed, 14 intentionally filtered out**, 6.71s. Initial sandbox attempt could not connect to local PostgreSQL (`EACCES 127.0.0.1:55437`) and executed no assertions; supported escalated retry succeeded. These tests independently establish mixed-doctor whole receipt/print withholding while each doctor retains their own paid/due/allocation projection, plus refusal to reduce a charge below paid funds and correct later gross-charge reconciliation preserving the original receipt. No unresolved access/connection blocker.

Builder reports directly observed full suite on unchanged runtime `b20f3e0`: **128/128 tests, 12/12 files passed, 246.02s**, followed by the added two regressions **2/2 passed** before `afb0bb7` (14 filtered). Builder also reports fresh 28 migrations and type/lint/build passes; the existing frontend bundle warning remains. These results are attributed builder evidence; reviewer independently executed only the two targeted tests, prior typecheck, and diff check described above. The complete original suite plus added regression execution cover all 130 current tests without claiming a single 130-test full run.

Final substantive disposition: **Standards 0 / Spec 0 unresolved findings**. Backend change passes independent review subject to final builder check/handoff recording and human review/manual merge. Deferred logic/UI/browser acceptance remains with #57/#69/#60/#76.
