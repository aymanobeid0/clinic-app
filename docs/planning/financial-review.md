# Finance planning review — issue #4

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. Only the initial #7 HTTP/session slice is implemented, in draft PR #32. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Date: 2026-10-11. One independent reviewer checked both standards and specification compliance. Scope: full new financial-decisions.md plus the latest multi-currency paragraph in mvp-scope.md and currency bullet in spec-001-clinic-mvp.md; baseline 506b549 context, unrelated edits excluded.

Standards: no actionable findings. Specification: no actionable contradictions. Worked examples preserve charge/funds accounting, distinguish reused credit from new money, enforce settled-only invoices and retain linked correction history. Multiple currencies/exact precision consistently supersede the older single-currency model; refund approval preserves access restrictions.

Limits: used coordinator-supplied live issue #4 criteria and owner approvals. No independent legal/currency verification, runtime tests or reviewer edits. Authoritative enabled-currency precision, local invoice/receipt/correction/numbering/tax/prescription requirements and reliable doctor-work/source attribution remain explicit verification gates. No legal conformity or runtime correctness claimed. git diff --check passed.

Owner approved the compact decision batch/final confirmation; implementation, publication and issue closure remain unauthorized. Issue #4 remains open; all changes local/uncommitted. Next prerequisite review: #5 clinical, then #6 files/data handling. Use one builder and one separate reviewer when implementation is authorized.
