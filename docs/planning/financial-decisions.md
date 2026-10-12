# Financial contracts and document rules — issue #4

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. The initial #7 HTTP/session slice was published in draft PR #32; subsequent implementation status is recorded in the linked delivery status. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Date: 2026-10-11. Status: compact owner decision batch approved; independent planning review passed; see financial-review.md. No implementation authorized. Sources: live issue #4, existing billing workflow in Spec 001, and owner popup answers. This consolidated note replaces its earlier pending-question text. Issue #4 is open with no listed blockers at the last read.

## Currency and exact amounts

Managers choose and may add multiple currencies. Every plan, charge, payment, credit and document carries its currency. Keep balances/reports separate by currency; no conversion or cross-currency allocation. Never relabel existing amounts. This supersedes the earlier single locked clinic currency model.

Never round amounts. Validate against the selected currency's verified minor-unit precision, reject excess decimals and require an explicit exact final price when a percentage discount would produce excess precision. Use exact integer minor-unit arithmetic, not binary floating-point money. Totals sum exact stored prices. Verify precision from an authoritative currency source before enabling that currency; do not assume every currency has two decimals. No currency list or conversion service is implicitly selected.

## Charges, funds and documents

Starting an accepted procedure makes its full agreed price due; unstarted procedures are planned work, not debt. Credit allocation never creates new money or another receipt. Every new payment/deposit gets a numbered receipt for the money actually received. Explicit deposits/excess receipts become patient credit. Allocation history links receipt funds to charges; the remaining available credit and charge balance are computed without double counting.

Invoices contain only whole completed, fully paid procedure charges, with each charge included on only one issued invoice. Eligible procedures may be grouped for the same patient and currency, including across plans, preserving procedure/plan references. Installments remain on receipts. Whole-plan summaries reference existing invoices, receipts/allocations and paid/due totals without creating charges. Do not combine currencies into one payable total.

Receipts and invoices have separate sequential clinic/year number series. Numbers are never reused, including void/cancelled documents. Keep issued documents immutable; link corrections to originals rather than overwrite. Allocation/reallocation records are not new receipts. Applicable legal/document requirements are a real-patient deployment gate, not verified by this product contract.

## Corrections, cancellations and approval

Unstarted cancellation creates no charge. Cancellation after start needs an explicit charge adjustment; do not silently remove the full recorded charge. Preserve the original entry and reasoned adjustment history. Refunds return available patient credit only; when money is allocated, first make the explicit necessary charge/credit adjustment or reallocation rather than refunding the same funds twice. Reversal corrects an erroneous payment; it is distinct from returning money. Reallocation changes the link between existing funds and charges without new money or receipts. Keep reason, actor, linked original and approval evidence; issued-document corrections remain linked, never overwritten.

Refunds require approval by a manager or the doctor concerned, limited to that doctor's own performed work. Refunds of unassigned deposits require manager approval. Approval does not bypass financial permissions, currency separation, available-funds checks or record history. Full manager authority and ordinary-doctor own-work scope follow identity-access-decisions.md. Staff require explicit finance capabilities; a staff-entered refund is not executed before the required approval. Approval and execution may be performed by the same authorized manager/doctor; no separate-person requirement was selected.

Existing patient debt is a documented opening balance, not a fabricated payment/receipt. Catalog price changes never rewrite accepted procedure prices. Financial adjustments do not silently change clinical completion or accepted treatment scope; renewed clinical acceptance/revision rules remain in #5.

## Worked examples

Examples use one currency whose precision permits the shown amounts. No conversion and no hidden rounding.

| Case | Entries and result |
| --- | --- |
| Start and mixed funds | Start charge 100; reuse old credit 30 and receive new money 50. Allocate 80 total, 20 remains due. New receipt is 50 only; old credit retains its original receipt/source. |
| Deposit reuse | Receive deposit 120: receipt 120, available credit 120. Later start charge 100 and allocate 100: credit 20, due zero, no additional receipt. Invoice only after completion. |
| Explicit excess receipt | Charge 100; receive 120 with explicit excess-credit entry. Receipt 120, allocated 100, available credit 20. Do not count credit 20 as another payment. |
| Invoice and summary | Completed/fully paid charges 100 and 50 for same patient/currency may share invoice 150. Summary references that invoice, not another charge. A completed but still-due charge remains uninvoiced. |
| No rounding | At two-decimal precision, 10.005 is rejected, never changed to 10.01/10.00. A 12.5% discount on 10 yields 8.75 exactly. A percentage yielding excess precision requires user-entered exact final price. |
| Cancel before start | Cancel planned 100 before starting: no due charge or financial receipt/invoice. Preserve clinical plan history. |
| Cancel after settlement | Paid started charge 100 cancelled with approved charge reduction 40: original charge/payment retained, linked credit adjustment 40 creates credit 40. Approved refund 40 returns it, leaving available credit zero. Original issued invoice is preserved with linked correction if one exists. |
| Mistaken payment reversal | Charge 100 was settled by an erroneous payment 100. Linked reversal invalidates that payment's allocation: charge due 100 again, no cash refund. Preserve original receipt and linked reversal/correction; an already issued invoice cannot be overwritten. |
| Reallocation | Existing received funds 100 allocated to charge A may be moved to charge B for same patient/currency with authorized reason/history. A's due rises, B's falls, no new receipt/money. If issued documents are affected, retain originals and link corrections. |
| Approval and deposit | Staff proposes refund 20 of unassigned deposit credit. Manager approval required before execution; another doctor's approval cannot authorize it as their own work. Execution consumes credit exactly once. |
| Two currencies | Credit 100 in currency A cannot pay charge 100 in currency B. Show A credit 100 and B due 100 separately. |
| Numbering | Receipt year N number 7 remains reserved after reversal; next receipt is 8. Invoice series is independent. New year's sequence is separate; no reuse within a series. |

## Evidence and remaining gates

Owner approved separate currencies/no conversion; mixed credit/new-money and deposit receipts; explicitly rejected rounding; required manager/concerned-doctor refund approval; and confirmed exact-precision validation/final-price entry, correction history, separate yearly numbering and eligible invoice grouping in the final compact popup. Independent planning review passed; see financial-review.md. No issue closure, publication or implementation authorized.

Verify jurisdiction/country-specific invoice, receipt, correction, numbering, tax and prescription requirements before real-patient deployment. No legal conformity is claimed, no tax regime is silently assumed, and verified requirements must return to the owner if they change this workflow. Provider/data-handling and operational prerequisites remain under #6. Detailed clinical ownership attribution/revisions remain under #5; persistence must reliably identify who performed the work before doctor financial access/refund approval is enabled. Multi-doctor/multi-source attribution must not guess or expose other doctors' money.

Later implementation must prove exact arithmetic, currency isolation, concurrent allocation/refund/reversal safety, idempotency, approval enforcement, immutable document corrections and access scopes against isolated fictional data. No application tests, purchase, deployment or live migration occurred. Preserve unrelated local changes and use one builder and one separate reviewer when implementation is authorized.
