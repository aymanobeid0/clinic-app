# Finance planning review — issue #4

Date: 2026-10-11. One independent reviewer checked both standards and specification compliance. Scope: full new financial-decisions.md plus the latest multi-currency paragraph in mvp-scope.md and currency bullet in spec-001-clinic-mvp.md; baseline 506b549 context, unrelated edits excluded.

Standards: no actionable findings. Specification: no actionable contradictions. Worked examples preserve charge/funds accounting, distinguish reused credit from new money, enforce settled-only invoices and retain linked correction history. Multiple currencies/exact precision consistently supersede the older single-currency model; refund approval preserves access restrictions.

Limits: used coordinator-supplied live issue #4 criteria and owner approvals. No independent legal/currency verification, runtime tests or reviewer edits. Authoritative enabled-currency precision, local invoice/receipt/correction/numbering/tax/prescription requirements and reliable doctor-work/source attribution remain explicit verification gates. No legal conformity or runtime correctness claimed. git diff --check passed.

Owner approved the compact decision batch/final confirmation; implementation, publication and issue closure remain unauthorized. Issue #4 remains open; all changes local/uncommitted. Next prerequisite review: #5 clinical, then #6 files/data handling. Use one builder and one separate reviewer when implementation is authorized.
