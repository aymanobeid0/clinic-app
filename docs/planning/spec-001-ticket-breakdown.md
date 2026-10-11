# Spec 001 — proposed ticket breakdown

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. Only the initial #7 HTTP/session slice is implemented, in draft PR #32. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Status: approved and published as GitHub issues #2–#29. All 28 tickets have ready-for-agent labels; 49 native blocking edges verified. See ticket-index.md for issue links. Planning IDs below remain distinct from GitHub issue numbers.
Parent: https://github.com/aymanobeid0/clinic-app/issues/1

Numbers below are planning IDs, not GitHub issue numbers. On approval, publish in dependency order and replace blocker IDs with real issues/native blocking relationships. Do not close or edit the parent issue.

The first five tickets resolve explicit specification prerequisites. They deliver reviewed decisions and verification evidence rather than application features. All following tickets are vertical slices: each includes relevant persistence, application behavior, French UI/documents, server-side authorization, and behavior tests. No production code exists to prefactor.

1. **Define the selected stack's foundation and assess VPS constraints**  
   **Blocked by:** none.  
   **Delivers:** foundation using the user-selected React/TypeScript frontend, Node.js/Express/TypeScript backend, PostgreSQL/Prisma persistence, and Docker/Nginx deployment. Approved supporting tools: Vite, React Router, TanStack Query, Zustand for shared local UI state, React Hook Form/Zod, PostgreSQL-backed Express sessions, Argon2, Helmet/rate limiting, Multer, Pino, Vitest/Supertest/Playwright, and development lint/format tools. Use one repository, an SPA and same-origin REST API, Docker Compose and private attachment delivery; start with existing design tokens/custom CSS. Verify and pin compatible versions; record measured or explicitly unavailable VPS capacity evidence, recovery-cost options, and performance targets for owner approval. No production deployment or infrastructure mutation is implied. Record unknown provider/domain/workloads and budget tradeoff. The user expects to maintain primarily through AI coding tools.

2. **Resolve identity, permissions, and historical-access contracts**  
   **Blocked by:** none.  
   **Delivers:** reviewed permission matrix for all account types and patient scopes, clinical information in billing/export, historical versions and cutoff semantics, username/phone uniqueness, initial password change, resets, sessions, and recovery codes. Preserve the confirmed non-doctor-manager restriction and deferred MFA/idle locking.

3. **Resolve financial contracts and document rules**  
   **Blocked by:** none.  
   **Delivers:** worked examples and approved rules for rounding, numbering, mixed funds, deposit/receipt presentation, cancellations, refunds/reversals after settlement, and invoice grouping. Distinguish charge, receipt, invoice, and summary. Record applicable document requirements as verified facts or unresolved deployment gates, without silently changing the clinic workflow.

4. **Resolve clinical chart and prescription contracts**  
   **Blocked by:** none.  
   **Delivers:** reviewed chart vocabulary, FDI/surface validation, procedure-to-chart suggestions, finalized/corrected prescription behavior, and prescription/print requirements. No AI or medication recommendation.

5. **Resolve file handling and pilot data requirements**  
   **Blocked by:** none.  
   **Delivers:** reviewed upload-size and quota rules, export formats, retention/deletion/backup policy, and researched hosting/data-handling prerequisites for Mauritania pilot on German hosting. Separate implementation requirements from real-data deployment gates; do not claim compliance without evidence.

6. **Bootstrap a clinic and sign in as its manager**  
   **Blocked by:** 1, 2.  
   **Delivers:** a running French application with persistent clinic identity, initial manager setup, secure sign-in/sign-out, denied unauthenticated requests, test persistence, and one browser smoke journey. No publicly open manager registration by assumption.

7. **Manage staff accounts, permissions, and recovery**  
   **Blocked by:** 6.  
   **Delivers:** manager-created doctor/staff accounts, individual access from any PC, permission editing, requested username/password changes, self password change, manager recovery codes, revocation and verified session behavior. No patient/staff count cap.

8. **Register, find, and archive patients**  
   **Blocked by:** 7.  
   **Delivers:** patient profiles with required name/contact phone, guardian attribution, clinic IDs, duplicate warnings, authorized contact search and archive/reactivation rules. Shared phones remain valid; archival preserves related records.

9. **Assign and share patients with scoped clinical access**  
   **Blocked by:** 8.  
   **Delivers:** multi-doctor and permitted-staff assignment UI, server-enforced access, explicit sharing/removal, and rejection of unauthorized patient identifiers. Doctor-managers follow assignment rules; non-doctor managers cannot read clinical records.

10. **Book and manage appointments and walk-in arrival**  
    **Blocked by:** 8.  
    **Delivers:** dentist/optional-chair bookings, editable duration/defaults, procedure-suggestion interface for later catalog integration, conflict blocks/authorized override, statuses, rescheduling history, cancellation reasons, and walk-in registration. No clinical access granted merely by booking.

11. **Maintain medical history and the manual dental chart**  
    **Blocked by:** 4, 9.  
    **Delivers:** permission-scoped medical history/allergies and dated tooth/surface chart with permanent, primary, and mixed dentition, including essential record history.

12. **Manage the procedure catalog and create a treatment proposal**  
    **Blocked by:** 3, 9.  
    **Delivers:** authorized catalog/default prices, identified draft plans and priced procedure items with tooth/multi-tooth/whole-mouth scope, permitted price overrides and reasoned discounts. Catalog changes preserve existing item prices; integrate duration suggestions with appointments when catalog data is present.

13. **Present, accept, and revise treatment plans**  
    **Blocked by:** 12.  
    **Delivers:** plan lifecycle, printable proposal, acceptance identity/time/method, retained versions and renewed acceptance for changed scope/prices, accepted itemized extras. Signed-attachment evidence connects when ticket 18 lands; text acceptance works independently.

14. **Start visits and record work on planned procedures**  
    **Blocked by:** 10, 13.  
    **Delivers:** booked/walk-in visit drafts, selection of multiple procedures, explicit procedure start/completion across unlimited visit counts, and idempotent start behavior. Expose the settled procedure-start event/transaction boundary for billing; no invoice automatically issued.

15. **Autosave, finalize, and correct visit notes**  
    **Blocked by:** 14.  
    **Delivers:** free-text note drafts, visible autosave states, stale-edit conflict review, tab-memory network-loss protection, finalization/corrections and pending-note tasks after care ends. Financial actions remain explicit.

16. **Confirm chart updates and print manual prescriptions**  
    **Blocked by:** 11, 14.  
    **Delivers:** confirmation of supported procedure-to-chart suggestions, manual prescription creation/reusable printing, and correction history under ticket 4 contracts. No guessed mappings or medication advice.

17. **Provide revocable historical clinical access**  
    **Blocked by:** 11, 13, 15, 16.  
    **Delivers:** restricted former-doctor login reading historical clinical versions through removal cutoff, excluding later entries/edits; no financial/edit/print/download/export routes; manager revocation. Existing versioned slices provide records to verify the historical view.

18. **Upload and manage patient attachments within quota**  
    **Blocked by:** 5, 9.  
    **Delivers:** authorized PDF/JPEG/PNG upload/view, provisional 1 GB quota and usage display, reasoned deletion, preserved finalized references/history, signed acceptance attachment linking when a plan exists. Quota blocks only new uploads. Add coverage for historical accounts if ticket 17 is present; restricted attachment access must be implemented from the outset.

19. **Show due procedure charges and documented opening balances**  
    **Blocked by:** 3, 14.  
    **Delivers:** billing workspace where accepted unstarted treatment is not debt and procedure start creates the full agreed charge exactly once; documented opening balances, separate planned/due totals, and accepted price-adjustment reconciliation.

20. **Record deposits and manually settle procedure charges**  
    **Blocked by:** 19.  
    **Delivers:** manager-configurable methods, explicit deposits/excess entries, manual allocations from new money/existing credit/both, numbered receipts and reprints, and separate credit/debt totals. Transactional/retry-safe operations prevent duplicate receipts and double spending.

21. **Issue settled procedure invoices and whole-plan summaries**  
    **Blocked by:** 20.  
    **Delivers:** manual invoice issue only for completed fully paid procedures, unique numbers and stable reprints, whole-procedure details without installment breakdown, and completion summaries referencing invoices while showing any remaining balance without duplicate charges.

22. **Correct payments, refund funds, and cancel charged treatment**  
    **Blocked by:** 21.  
    **Delivers:** permission-controlled reasoned reversal/refund/credit workflows, partial-care final charge, preserved issued documents and allocations, and post-settlement behavior from ticket 3. No automatic refund or silent deletion.

23. **Receive batches and review stock availability**  
    **Blocked by:** 7.  
    **Delivers:** item/supplier setup, whole-pack receiving with expiry/cost, stock by batch, item thresholds and configurable expiry warnings. Settle expiry date boundaries explicitly in this ticket; no unit conversions or procurement accounting.

24. **Consume packs and record inventory corrections**  
    **Blocked by:** 23.  
    **Delivers:** manual batch selection, consume whole pack on opening, reasoned waste/disposal/count adjustments, immutable movement history, and atomic expired/negative-stock checks under concurrent use. No treatment-visit linkage.

25. **Review daily operations, balances, and follow-up tasks**  
    **Blocked by:** 15, 22, 24.  
    **Delivers:** permission-scoped daily appointment, invoice/payment, balance and low/expiring-stock reports, in-app follow-up tasks and manual message sharing. Reconcile receipts versus applied credit and exclude future treatment from debt; include adjustments rather than relying on issued invoices alone. No automated delivery or advanced BI.

26. **Export authorized clinic records and attachments**  
    **Blocked by:** 5, 17, 18, 22, 24.  
    **Delivers:** manager-authorized export of supported records/documents/files in approved formats, including reconciled financial and stock histories. Apply the settled clinical export permissions rather than bypass non-doctor-manager restrictions. Historical logins cannot export.

27. **Rehearse deployment, backup, and restoration with fictional data**  
    **Blocked by:** 1, 5, 18, 20, 24.  
    **Delivers:** approved test deployment and outside-VPS backups, measured independent restoration of records/files, permission checks after restore, and evidence against one-hour recovery/loss targets. Obtain deployment/service spending authorization at execution time if needed; unresolved recovery-budget tradeoff gates acceptance. This is an operational deliverable, not a substitute for tests in feature tickets.

28. **Validate and cut over the controlled clinic pilot**  
    **Blocked by:** 16, 17, 21, 22, 25, 26, 27.  
    **Delivers:** full fictional-data rehearsal with the clinic's roles, resolved real-data prerequisites, verified opening balances, agreed cutover date, and evidence for booking → care → acceptance → payment/receipt → invoice → stock/report/export. Start selected real-patient use only after prerequisites and restore targets or explicitly accepted revised targets are satisfied.

## Coverage and review notes

- Stories 1–12: 6–9 and 17. Stories 13–19: 8–10 and 14. Stories 20–36: 11–16 and 18. Stories 37–46: 19–22. Stories 47–51: 23–24. Stories 52–60: 15, 18, 25–28 and history embedded in the relevant slices.
- Clinical and inventory branches can progress independently after accounts; billing follows accepted plans and procedure starts. No database-only, API-only, or UI-only feature tickets.
- Ticket 10 can precede the procedure catalog: use clinic duration defaults first, add suggestions in 12. Ticket 18 can precede plans: acceptance evidence linking is integrated when both exist. These are feature-detected integrations, not blocking edges disguised as missing required functionality.
- Prerequisite tickets require owner acceptance of unresolved decisions. Feature tickets are blocked by the relevant prerequisite; do not mark technical questions answered merely by publishing tickets.
- Paid search/storage purchasing/reminder delivery, AI, BI, local/offline options and other deferred features are excluded.
- User approved granularity and blockers, then the stack and supporting dependency proposal. Publication is complete. The parent specification was not edited or closed.
