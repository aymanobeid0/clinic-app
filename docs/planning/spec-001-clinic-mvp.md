# Spec 001 — Dental clinic management MVP

> Recovery execution — 2026-10-18: Spec #49 and the owner's subsequent clarification supersede the original simultaneous backend/UI delivery order. This remains the product baseline; later approved identity/clinical/financial/file decisions govern conflicting earlier wording. See [the recovery reconciliation](recovery-reconciliation.md) for layer ownership, current gates and preserved outstanding UI requirements.

Date: 2026-10-10
Status: first specification; product baseline and testing seams confirmed. Published as https://github.com/aymanobeid0/clinic-app/issues/1 with label ready-for-agent.
Scope: French-language online pilot for a single-location clinic in Mauritania.

## Problem Statement

The pilot clinic has four dentists, including its manager, two receptionists, three assistants, and one sterilization staff member. It operates four chairs and five PCs. Its legacy software handles billing and prescriptions, while most care remains on paper. Staff cannot reliably follow a patient from booking through clinical history, treatment, payment, and follow-up in one place.

The clinic needs connected records, clear outstanding balances, controlled staff access, and usable stock tracking without paying for the core modules. Its owner will maintain hosting on an existing Ubuntu VPS and must assess backup and recovery capability before real-patient use.

## Solution

Provide a browser application with individual accounts usable from any clinic PC. Connect appointments, patient profiles, manual dental charting, treatment plans, visits, prescriptions, billing, inventory, and basic reports. Deliver the pilot interface and printed documents in French.

Keep patient and staff counts unlimited in the free core, with a 2 GB attachment allowance per clinic. Validate the core in the owner's clinic before adding paid purchasing for storage, searchable history, and automated reminders.

Starting a procedure creates the full amount due in a billing workspace. Payments receive receipts. Staff issue a procedure invoice only after that procedure is completed and fully paid. A whole-plan summary references invoices and can show remaining debt without duplicating charges.

## User Stories

1. As a manager, I want to create individual doctor and staff accounts, so that actions have an identifiable author.
2. As a clinic user, I want to sign in from any clinic PC, so that I can work wherever needed.
3. As a manager, I want to change a requested username or reset a password, so that staff can recover access.
4. As a manager, I want offline recovery codes, so that I can recover my own account.
5. As a manager, I want configurable permissions, so that access reflects each person's duties.
6. As a doctor-manager, I want both administrative and clinical capabilities, so that I can run the clinic and treat assigned patients.
7. As a manager, I want to assign and explicitly share patients, so that care can involve several authorized clinicians.
8. As a doctor, I want access to assigned or shared patients, so that unrelated records remain restricted.
9. As permitted staff, I want to read and draft clinical content for assigned/shared patients, so that I can assist the dentist.
10. As a doctor, I want to finalize clinical content, so that responsibility for the record is explicit.
11. As a former treating doctor, I want authorized historical read access, so that I can review care from my period of involvement.
12. As a manager, I want to revoke historical access, so that a departed person's account can be fully disabled.
13. As a receptionist, I want patient registration with name and phone, so that patients can be identified and contacted.
14. As a receptionist, I want guardian/contact numbers and duplicate warnings, so that children and shared family numbers are supported.
15. As a receptionist, I want an automatic patient ID, so that names and phones need not uniquely identify a patient.
16. As a receptionist, I want to book a dentist and optional chair with editable duration, so that appointments fit clinic capacity.
17. As authorized staff, I want explicit conflict overrides, so that exceptional bookings are intentional.
18. As a receptionist, I want appointment status and rescheduling history, so that today's workload is clear.
19. As a doctor, I want to start a walk-in visit, so that advance booking is not required for care.
20. As a doctor, I want medical history, allergies, and attachments in the patient profile, so that clinical context is available.
21. As a doctor, I want a dated FDI chart with adult, primary, and mixed dentition, so that tooth findings are recorded accurately.
22. As a doctor, I want tooth/surface findings and existing restorations, so that the chart describes observed conditions without generating charges.
23. As a manager, I want a shared procedure catalog and default prices, so that planning starts consistently.
24. As a permitted doctor, I want to override a plan item's price, so that patient-specific pricing can be agreed.
25. As an authorized user, I want reasoned discounts, so that reductions are explicit and reviewable.
26. As a doctor, I want an identified treatment plan with tooth, multiple-tooth, or whole-mouth procedures, so that care is organized.
27. As staff, I want to record who accepted a plan, when, and how, so that agreement is documented.
28. As a doctor, I want versioned plan changes and renewed acceptance for scope or price changes, so that the accepted agreement remains visible.
29. As a doctor, I want itemized accepted extra-work fees, so that additional work changes the agreed total explicitly.
30. As a doctor, I want one visit to cover several procedures, so that records match actual care.
31. As a doctor, I want to decide when each procedure is complete, so that visit counts need not be fixed in advance.
32. As a doctor, I want an autosaved free-text visit draft, so that routine note entry is simple.
33. As a doctor, I want a pending-note task when care ends before finalization, so that unfinished documentation is visible.
34. As a doctor, I want dated corrections to finalized notes, so that the original record remains preserved.
35. As a doctor, I want to confirm suggested chart updates after procedure completion, so that clinical chart changes remain deliberate.
36. As a doctor, I want manually authored printable prescriptions, so that the pilot replaces the legacy prescription workflow.
37. As billing staff, I want started procedures to become due at their full agreed price, so that outstanding treatment balances are clear.
38. As billing staff, I want to manually allocate payments, so that the patient's chosen procedures receive the money.
39. As billing staff, I want to combine existing credit and new money, so that settlement reflects funds actually available.
40. As billing staff, I want separate deposit entries for excess funds, so that unallocated patient credit is explicit.
41. As a patient, I want a numbered receipt for every payment, so that installments are documented.
42. As billing staff, I want to issue invoices for completed and fully paid procedures, so that final documents match the clinic's workflow.
43. As staff, I want a whole-plan summary showing procedures, totals, balances, and invoice references, so that patients can understand the entire plan.
44. As a manager, I want configurable payment methods, so that recorded methods match clinic practice.
45. As authorized staff, I want reasoned refunds, reversals, and credit adjustments, so that corrections preserve financial history.
46. As billing staff, I want documented opening balances, so that selected existing patients can transition without fabricated receipts.
47. As inventory staff, I want batch receiving with supplier, packs, expiry, and cost, so that stock is traceable.
48. As inventory staff, I want to select a batch and consume a whole pack when opened, so that stock entry stays simple.
49. As inventory staff, I want expired-use and negative-stock blocks, so that recorded stock movements remain valid.
50. As authorized inventory staff, I want reasoned waste, disposal, and count adjustments, so that corrections preserve history.
51. As staff, I want low-stock and expiry alerts, so that supplies can be reviewed in time.
52. As a manager, I want basic operational reports, so that I can review appointments, payments, balances, and stock.
53. As a permitted user, I want essential history on each record, so that finalized changes and corrections can be understood without a paid search feature.
54. As authorized staff, I want printable plans, receipts, invoices, and prescriptions, so that patients receive useful documents.
55. As a manager, I want authorized clinic data and attachment exports, so that the clinic can retrieve its records.
56. As clinic staff, I want existing files to remain readable at the storage quota, so that upload limits do not interrupt core care.
57. As a clinic user, I want visible save status and edit-conflict handling, so that I do not silently lose work.
58. As a clinic owner, I want tested backup restoration, so that recovery requirements are assessed before real use.
59. As clinic staff, I want archived patients to retain finalized records, so that historical care is preserved.
60. As the pilot owner, I want a controlled cutover with verified balances, so that the new and legacy systems do not independently duplicate payments.

## Implementation Decisions

### Current state and architectural boundaries

The workspace has product discovery, a domain glossary, design references, and prototype documentation. No production backend, persistence, authentication, test suite, stack, or deployment is established. Prototype sample data and in-memory behavior are not production contracts.

Organize the future application around identity/access, patient records, scheduling, clinical care/plans, billing, inventory, attachments/documents, and reporting. These are responsibility boundaries, not a decision to deploy separate services. The user selected React with TypeScript for the frontend, Node.js and Express with TypeScript for the backend, PostgreSQL with Prisma ORM, and Docker with Nginx for deployment. Supporting libraries, versions, service layout, and persistence details require review. Prefer one application-facing behavior boundary for automated testing. Maintenance will primarily use AI coding tools.

All authoritative access checks must apply at the server boundary, including reads, writes, history, file access, printing, and exports. Hiding interface controls alone is insufficient. Permission settings must not allow a non-doctor manager to acquire clinical access contrary to the confirmed rule. The reviewed matrix in identity-access-decisions.md governs account/action/patient scope; financial/mixed attachment action permissions and content scopes are defined in file-data-decisions.md.

### Identity and clinic settings

Frontend state responsibilities: use Zustand for shared local UI state, TanStack Query for server records, and React Hook Form for form state. Component-private state can use React hooks. Do not persist clinical drafts or sensitive state to browser storage; connection-loss drafts remain in current-tab memory.

- Manager, doctor and staff accounts follow the complete reviewed identity/access matrix in identity-access-decisions.md (owner decisions through Q36; review evidence in identity-access-review.md). That contract settles identity, permissions, historical cutoff and recovery choices previously carried as open items here.
- Managers create usernames/temporary passwords and handle authorized changes/resets. Primary clinic managers use globally unique normalized verified email/password. Employees and doctors promoted to manager retain stable clinic code plus case-insensitive clinic-unique username/password; login method is independent from manager authority. Clinic codes are globally unique; exact syntax, lengths and no username reuse are in the contract. Initial/reset temporary passwords expire after 24 hours and must be replaced before clinic access.
- Ordinary doctor/staff phone/email are optional contact-only fields; shared contacts allowed. Phone sign-in is deferred. Primary manager email is globally unique and serves login/recovery; promoted doctor-managers keep username login and require distinct verified recovery email within clinic, with the explicit warning to use a real accessible email and verification before clinic access. Ten single-use offline codes must be saved before manager setup completes.
- Recovery/reset never reveals existing passwords. Ordinary email changes require current password, new-address verification and old-address notification; restricted code/other-manager recovery may replace a lost address after verification. Recovery links expire after 30 minutes, verification links after 24 hours; single-use/replacement invalidation and code rotation follow the contract.
- Password reset/change, completed recovery, disablement and account-type changes revoke all sessions. Permission/grant changes apply on the next server request and terminate affected streams. Fixed 12-hour maximum sessions, no remember-me; MFA/configurable idle locking deferred. Recovery never lifts account restrictions. Protect the last active fully set-up manager from disablement/demotion.
- All managers have full clinic-wide financial authority, including procedure/tooth references in billing, financial documents/reports/exports and correction actions; immutable history remains mandatory. Non-doctor managers may see patient personal details, but never clinical charts, diagnoses, visit notes, prescriptions or clinical attachments. Doctor-managers need active patient scope for clinical records.
- Ordinary doctors' financial visibility/actions require the relevant capability and active patient access and cover only dental work personally performed by them. Permitted staff may handle clinic-wide restricted billing; without separate clinical access, expose identity, neutral charge references, amounts, dates and eligibility, not clinical descriptions. Apply financial scopes to documents, searches, files, reports and aggregates.
- Managers choose multiple currencies with separate charges/payments/credits/balances, no conversion and no relabeling existing amounts. Preserve exact amounts; reject unsupported precision rather than round. Catalog management and patient-plan price overrides remain separate capabilities; catalog changes preserve agreed plan prices. See financial-decisions.md for owner-approved examples, receipt/invoice rules and refund approval; independent finance planning review passed; see financial-review.md.

### Patient access and history

- Patients may have multiple assigned doctors. Managers or assignment-authorized users grant sharing; non-doctor managers use patient personal details without opening clinical records. Account permission administration remains manager-only.
- Clinical capabilities require explicit patient scope, including for doctor-managers and staff. Staff may draft history/chart/plan/note/prescription and acceptance evidence; doctors finalize, confirm accepted plans, start/complete procedures and sign prescriptions. Authorized doctors may review/finalize another user's draft with retained author/finalizer attribution. Finalized changes create dated revisions; detailed clinical workflow remains in #5.
- Clinical attachment upload, replace/version and removal are separate capabilities plus active clinical patient scope for eligible doctors/staff, never non-doctor managers or historical users. Preserve versions needed by history/retention. Financial/mixed attachment mutations use file-data-decisions.md capabilities and combined content scopes. Logical removal preserves retained versions; ordinary permanent deletion is unavailable, and administrative purge requires approved retention/legal policy.
- Removal immediately ends active care access; historical read-only access requires an explicit manager grant at removal cutoff. Return then-available permitted record/file versions; exclude later entries, later edits to old records and later uploads. Historical financial visibility is limited to the doctor's own performed work at cutoff, read-only. Other financial content is redacted; hide inseparable mixed attachments with unauthorized content.
- Historical access prohibits all edits and print/download/export actions. Plain permitted clinical attachments may be viewed inline; browser capture cannot be prevented. Account-wide historical-only mode loses operational and clinic-wide financial authority, retaining only explicit historical snapshots. Active reassignment cannot lift disabled/historical-only account status. Every subsequent removal needs a new explicit historical grant/cutoff; full revocation removes all patient grants.
- Archive rather than delete finalized history. Patient merge/permanent deletion are unavailable until explicit contracts are approved. Clinical document actions require document permission plus active patient clinical access; financial authority cannot open clinical records.

### Scheduling and clinical workflows

- Scheduling states: booked, confirmed, arrived, in care, completed, cancelled, no-show. Define valid transition and reversal rules during implementation design.
- Start time/duration are editable; use a clinic default and procedure suggestions. Reserve dentist and optional chair. Conflicts require a permitted explicit override.
- Starting care creates a visit draft, including for walk-ins. Retrying a start action must not create duplicate visits or duplicate charges.
- Select procedures actually treated; completing a visit does not complete every procedure. Doctor explicitly completes procedures after any required number of visits.
- Plans have identifiers, related procedures, version history, and draft/presented/accepted/in-progress/completed/cancelled lifecycle. Renew acceptance for scope or price changes; routine notes do not require it.
- Acceptance includes who, when, how, and optional signed attachment. No patient portal or mandatory digital signature.
- Dental chart uses approved FDI permanent/primary/mixed positions, valid surface combinations and coexisting dated manual findings in clinical-decisions.md. Extraction/restoration/crown/root-canal/implant completion may suggest explicit chart events only after dentist confirmation; unsupported mappings stay manual. Unknown is not sound; final changes retain revisions.
- Notes use a single free-text field with draft/finalized/correction lifecycle. Pending-note tasks survive visit completion.
- Prescriptions follow clinical-decisions.md: manual medicine/dose/route/frequency/duration/instructions, patient/prescriber/date and reusable French print header/footer. Eligible doctors and clinic managers manage clinic-scoped medication reference entries, with name autocomplete and explicit doctor add-missing-entry. This grants non-doctor managers reference-data access only, never patient prescriptions. Selection copies name/strength/form into editable fields; every saved prescription draft/issued version stores its own values without required catalog ID, live relation or lookup. Catalog edits/removal/recreation never alter saved prescriptions or original-version reprints, and catalog failure cannot block valid manual prescribing. Dose and instructions remain doctor-entered/reviewed. Doctors finalize; corrections create linked replacements and mark old versions superseded. No automatic medication recommendation; qualified/legal validation remains a real-use gate.

### Billing invariants and documents

The following supersedes earlier interview alternatives concerning partial invoices, unpaid issued invoices, or automatic invoice issue:

1. An accepted but unstarted procedure is future treatment, not debt.
2. Starting it makes its full agreed price due exactly once. The billing workspace is not an issued invoice.
3. Agreed price reflects accepted discounts and extra-work fees. Subsequent scope/price changes require versioned acceptance and explicit financial adjustment, without rewriting issued documents.
4. Staff manually allocate funds to started procedure charges. Payments can precede invoice issue and combine credit with new money without counting either twice.
5. Excess funds are entered separately as a deposit. Reconcile all money received with allocated payment plus separately recorded deposit; existing credit applied is not a new cash receipt.
6. Give numbered receipts for payments; receipt presentation for credit-only and mixed settlements must distinguish new money from previously receipted deposits.
7. Staff manually issue a numbered invoice only for a completed, fully paid procedure. It covers the whole procedure; installments are receipt entries, not partial invoices.
8. Once issued, reprints retain the invoice number. Prevent duplicate charge-bearing invoices for the same procedure; eligible whole completed/fully paid procedures may be grouped for the same patient/currency under financial-decisions.md.
9. At plan completion, print a whole-plan summary even with unpaid amounts. It references existing invoices and does not introduce charges.
10. Outstanding amounts derive from started charges and opening balances less allocations and explicit charge adjustments, not from unpaid issued invoices. Show available patient credit separately from debt.
11. Refunds represent money returned; reversals correct erroneous entries; credits reduce charges. Record actor, reason, links, and history. Reallocation and linked issued-document corrections follow financial-decisions.md; refunds require manager or concerned own-work doctor approval.
12. Partly performed cancellation requires an explicit final charge and credit adjustment as needed. No automatic refund or deletion of performed care.

Use atomic financial operations and retry-safe commands so concurrent allocation cannot spend patient credit twice. Use financial-decisions.md: separate manager-selected currencies, exact minor-unit amounts with no rounding, excess-precision rejection and separate yearly receipt/invoice sequences. Verify enabled-currency precision and legally required document content before real use; no compliance claim is made.

### Inventory, files, and reports

- One stock unit is a whole pack. Consume on opening; no fractional stock or unit conversion.
- Receive batches with supplier, quantity, cost, and expiry where applicable. Staff select consumption batches manually.
- Block expired consumption and negative stock, including concurrent requests. Waste/disposal/count correction are separate reasoned movements.
- Per-item low-stock thresholds and configurable clinic expiry warning window. Expiry boundary/date handling requires explicit design.
- PDF/JPEG/PNG uploads; 2 GB clinic quota with 20 MB per file, counting all retained versions. Show usage and block new uploads at quota while retaining existing file and core access.
- file-data-decisions.md defines reasoned logical removal, protected finalized/history versions, separate financial/mixed capabilities and permission-filtered CSV/JSON/attachment ZIP exports. Retained versions count toward quota. No ordinary permanent deletion; restricted purge requires approved retention/legal policy, with deletion instructions reapplied after restoration.
- Free reports cover daily appointments, invoices/payments, outstanding balances, and low/expiring stock. Report cash receipts separately from applied existing credit and future planned care.
- Free authorized printing/export and essential per-record history. Cross-record searchable history is paid later; free record history remains necessary for corrections and accepted plan versions.

### Reliability and operational constraints

- Autosave drafts with visible saving/saved/error states. Explicitly confirm consequential actions.
- Detect stale concurrent edits and require reconciliation. Do not silently overwrite another user's changes.
- During network loss retain the current draft in tab memory, warn, and retry safely. No cross-restart device persistence or offline workflow.
- Recovery point target: at most one hour of lost work. Recovery time target: service restored within one hour. Both require cost/feasibility assessment and measured restoration, not assumptions based on VPS size.
- Existing German Ubuntu VPS is user-reported at 6 CPUs, 12 GB RAM, 200 GB disk; USD 10/month server budget. On 2026-10-10 the owner identified Contabo, Ubuntu 24 and Dokploy, with up to USD 5/month additional budget for off-VPS backup comparisons. No backups currently exist. Shared workloads, domain, exact host versions and available capacity remain unknown. The approved Dokploy ingress adaptation and proposed acceptance targets are recorded in foundation-infrastructure-assessment.md.

## Testing Decisions

### Approved testing seams

Use the highest practical application-facing boundary with real test persistence and authenticated identities to exercise commands and queries across workflows. There is no existing production test seam or prior suite to reuse. Avoid testing private helpers merely to mirror their implementation.

Use a small browser suite for French forms, save/error indicators, role-specific views, printing, and the connected staff journey. Use a separate operational restore rehearsal because application tests cannot prove backup recovery. The user approved these seams; no testing framework has been selected.

### Behavior and acceptance scenarios

1. Register a child using a guardian phone also used by another patient; generate distinct IDs and warn without rejecting a legitimate shared number.
2. Book overlapping dentist/chair slots; deny ordinary conflicting writes and permit only an authorized explicit override. Preserve reschedule history.
3. Start one visit with several procedures; retry without duplicating the visit or charges. End care with a pending note; complete procedures independently.
4. Save conflicting plan/note revisions from two users; require review and preserve both users' recoverable input.
5. Finalize a note, add a dated correction, and prove the original remains readable. Later edits are invisible to a historical-access account beyond its cutoff.
6. Test doctor, doctor-manager, non-doctor manager, staff, historical login, and disabled account across read/write/file/print/export endpoints. Include direct requests bypassing UI controls and access to another patient's identifier.
7. Present and accept a plan; add scope/price changes and require renewed acceptance. Catalog changes do not change its prior accepted amounts.
8. For a 3,000 procedure, show no debt before start and 3,000 after start. Record a 1,000 payment with receipt, show 2,000 due, and prevent invoice issue while unfinished or unpaid.
9. Complete and settle that procedure; manually issue once, reprint the same number, and preserve separate installment receipts.
10. Settle a 1,000 charge with 300 existing credit and 700 new money. Reduce credit by 300, record only 700 new money, and never create a second receipt for the original deposit as a new receipt of funds.
11. Receive 1,500 for a 1,000 charge through explicit 1,000 payment and 500 deposit entries; reconcile money received and available credit.
12. Race two credit allocations; prevent overspending. Retry financial submissions without duplicate receipts, invoices, or movements.
13. Cancel partly performed care and explicitly adjust its charge; preserve care, prior payments, and any issued document. Test refund versus reversal as different external behaviors once adjustment contracts are resolved.
14. Complete a plan containing separately invoiced work and an unpaid completed procedure; its summary shows all procedures, references existing invoices, and creates no duplicate debt.
15. Receive whole packs, consume selected batches, dispose expired stock, and correct a count with reasons. Reject fractions, expired consumption, and concurrent overconsumption.
16. Fill the storage quota; block uploads while allowing existing authorized files and core operations. Deny file access through guessed identifiers and historical download routes.
17. Reconcile opening balances, deposits, allocations, refunds, and report totals. Verify archived patients retain finalized history.
18. Simulate network loss and stale responses: visible unsaved/error state, tab-memory draft retained, no false saved confirmation, retry without duplication.
19. Restore database and attachment backups into a separate test environment, verify record/file consistency and access controls, and measure data-loss window and elapsed restoration time against targets.

Pilot acceptance requires the four dentists and reception staff to complete the connected journey with reconciled balances and stock, verified permissions, and demonstrated restoration. Begin with fictional data; move to selected real patients only after technical/data-handling prerequisites are resolved. Set a cutover date to avoid independent duplicate payment entry in the legacy application.

## Out of Scope

- Paid subscription/add-on checkout during the core pilot; exact commercial prices.
- AI transcription, automated X-ray charting, diagnosis, or treatment suggestions.
- Offline editing, persistent local drafts, clinic-installed deployment, and local network operation.
- Arabic/RTL and English delivery in this first French pilot; USA rollout.
- Patient portal, digital-signature requirement, alternative-plan comparisons.
- Visit-linked inventory use, automated procedure consumption, BI dashboard, purchase orders, supplier accounts, or full accounting.
- Online payment processing, insurance claims, multicurrency within a clinic, and automatic cancellation fees.
- Bulk migration, legacy integration, DICOM, MFA, and configurable idle locking in this MVP.
- Deploying to or changing the VPS, or claiming legal/clinical compliance from this specification alone. The selected stack is recorded above; production deployment requires its own operational verification.

## Further Notes

### Open items and gates

Before implementation of affected behavior: use the reviewed identity-access-decisions.md matrix, identifier/recovery lifecycle and historical-sharing boundaries. Use clinical-decisions.md for chart/revision/prescription/drug-catalog rules, financial-decisions.md for exact multi-currency accounting and corrections, and file-data-decisions.md for upload/quota/retention/export capabilities. Performance targets are accepted in foundation-infrastructure-assessment.md, pending measurement. Transactional-email delivery and runtime/security verification remain gates; no unresolved choice may be silently assumed.

Before real-patient pilot: assess the actual VPS, provider/location/data handling requirements, applicable invoice and prescription requirements, domain/TLS configuration, outside-VPS backups and recovery budget; run restoration and permission scenarios; confirm operational ownership, cutover date, and evidence checklist. Budget versus recovery targets remains explicitly undecided pending assessment.

This is one overarching MVP spec suitable for later decomposition into vertical implementation tickets. It does not mark unresolved areas ready for implementation. Paid and future features need subsequent specifications.

Tracker: GitHub Issues, aymanobeid0/clinic-app. Published issue: https://github.com/aymanobeid0/clinic-app/issues/1. Label: ready-for-agent. This overarching specification is ready for agent planning and decomposition; explicitly unresolved prerequisites must be resolved before implementing affected behavior.
