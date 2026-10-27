# A2 â€” Receive consultation payment and recognize its reserved share

Status: owner-approved and published 2026-10-27. A1 execution explicitly authorized; dependent stages require prerequisite human-approved merge.

## Parent

Spec #1, approved standalone consultation amendment (ADR0002).

## What to build

Record actual full consultation payment before or after room entry using the normal receipt and shared ledger. Funds remain dedicated to this consultation; payment immediately contributes to its responsible doctor's share at the rate frozen at the earlier payment/entry event.

## Acceptance criteria

- [ ] Payment is optional and full-only for the agreed consultation amount. No fabricated paid flag, consultation installments or new invoice feature. Preserve ordinary treatment installments.
- [ ] Before entry, actual payment creates one normal receipt and consultation-reserved funds, excluded from freely spendable patient credit and unrelated settlement. It recognizes consultation share immediately and freezes the rate if not already frozen; it does not assert care entry or create unpaid debt.
- [ ] Price500/rate40%, pay before entry => receipt500/share200. Change rate50%, enter => frozen40%/share200, due0, no second receipt/income/share. Entry first at40% => due500/share0, later rate50% and payment500 => due0/share200.
- [ ] Room entry atomically covers the single charge with its reserved payment once. Retried/concurrent payment and entry commands produce one financial effect and truthful replay/conflict responses.
- [ ] Honor doctor/reception payment capabilities. Ordinary-doctor pre-entry access is limited to their designated consultation with active patient scope; generic deposits and another doctor's funds remain denied. A payment does not expand clinical access.
- [ ] Reuse ordinary authorized release/refund/reversal/correction approval and retained source links. Corrections affect the original consultation funds/share once at its frozen rate; neither release then refund nor entry then payment double-counts money. No separate cancellation/refund policy.
- [ ] Manager and concerned doctor can read exact currency-separated source-linked consultation shares; reception/unrelated doctors cannot read them through direct endpoints, receipts, reports, exports, history or files. Historical-only accounts retain cutoff-bound own-work snapshots without gaining active remuneration-report access.
- [ ] Shared patient balances, credit sources, receipts, financial daily activity, exports and historical snapshots reconcile reservation/payment/entry/corrections. No parallel ledger; no rounding patient money, silent zero for missing configuration or payroll payout.
- [ ] Authenticated isolated fictional persistence tests prove both500/40% sequences, normal corrections, reservation isolation, permissions/redaction, retries/races and affected financial/output regressions. Contracts/OpenAPI document the actual public behavior.

## Blocked by

- A1 â€” merged standalone consultation identity, room entry, source projection and remuneration configuration/snapshot.

## Execution boundary

Backend/shared contracts only; approved architecture/testing seams. One builder and one independent Standards/Spec reviewer; handoff and evidence before PR. Human merge before dependent frontend logic. No product UI, production/live migration or real data.
