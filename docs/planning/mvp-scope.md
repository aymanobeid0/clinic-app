# Dental clinic MVP — consolidated discovery

Status: user-confirmed discovery baseline, approved on 2026-10-10 with the open items below explicitly carried forward into specification. Discovery is complete. This is a product planning baseline, not a production-ready technical specification. Detailed answers and evolution are in `discovery.md`; the latest explicit decisions supersede earlier alternatives.

## Pilot and delivery

Online browser application, initially French, for a single-location clinic in Mauritania. Pilot has four dentists (one also manager), two receptionists, three assistants, one sterilization staff member, four chairs, and five PCs. Arabic/RTL and English follow later; USA expansion is deferred.

## Free MVP

- Unlimited patients and staff; 2 GB attachment allowance per clinic.
- Appointments with dentist, optional chair, editable durations, conflict detection and authorized overrides. Booked, confirmed, arrived, in care, completed, cancelled, no-show; walk-ins supported. Preserve rescheduling history; no automatic cancellation fees.
- Patient ID and duplicate warnings; name and phone required, including identified guardian/contact numbers. Medical history, allergies, attachments, and dated FDI chart for permanent/primary/mixed dentition. Archive patients; preserve finalized records.
- Identified treatment plans with priced procedures, tooth/multiple-tooth/whole-mouth scope, discounts by permission, accepted extra-work fees, versions and acceptance evidence. Scope/price changes require renewed acceptance. Visits continue until doctor explicitly completes procedures; multiple procedures may be treated per visit.
- Starting care creates a visit draft. One free-text clinical note, autosaved with visible status; finalized notes receive dated corrections. Visit can end with pending-note task. Chart updates suggested for confirmation.
- Manually authored, printable prescriptions with patient/prescriber details and medication instructions; no automated medication advice.
- Pack-only inventory, consumed on opening; manual batch choice, receiving costs/suppliers/expiry, reasoned stock movements, no negative stock or expired consumption. Item low-stock thresholds and configurable expiry warnings. No visit links or full purchasing/accounting module.
- Basic appointment, payment, balance, and low/expiring-stock reports; essential per-record history; printing and authorized data/attachment exports.

## Resolved billing model

Owner finance follow-up 2026-10-11: multiple manager-selected currencies stay separate with no conversion; amounts are never rounded. financial-decisions.md records the approved compact decision batch, worked examples and manager/concerned-doctor refund approval. Independent finance planning review passed; see financial-review.md.

Starting an accepted procedure makes its full agreed price due in the editable billing workspace. Unstarted procedures are planned future treatment. Staff manually allocate payments to procedure charges, using existing credit, new money, or both. Deposits and excess receipts are explicitly entered separately as patient credit; payment methods are manager-configurable.

Each payment has a numbered receipt, even before invoice issue. Staff manually issue a numbered invoice for a procedure only after it is completed and fully paid. Invoices cover whole procedure prices; installments appear on receipts, not partial invoices. A whole-plan summary at completion shows all care, paid/due totals, and references existing invoices without creating duplicate charges; it may show unpaid balances.

Preserve issued financial documents. Refunds, reversals, cancellation adjustments, and credits are explicit and historical. Existing balances are documented opening balances, not fabricated new payments. Catalog changes do not rewrite agreed prices.

## Accounts and clinical access

Issue #3 owner decisions were reviewed on 2026-10-11; see identity-access-decisions.md for the complete account/action/patient-scope matrix and identity-access-review.md for evidence and remaining gates. These decisions supersede the earlier unresolved identity alternatives.

Manager, doctor and staff accounts are individual. Managers control account permissions and assignment/sharing delegation. All managers have full clinic-wide financial authority, including procedure/tooth references in billing; financial changes preserve transaction/document history. Non-doctor managers may see patient personal details but cannot open clinical charts, diagnoses, visit notes, prescriptions or clinical attachments. Doctor-managers require explicit patient scope for clinical care, just like doctors.

Ordinary doctors see/perform permitted financial actions only for dental work personally performed by them. Permitted staff may handle clinic-wide restricted billing; clinical access requires relevant permission and explicit patient assignment/sharing. Staff draft clinical content and acceptance evidence; doctors finalize, confirm accepted plans, start/complete procedures and sign prescriptions. Clinical attachment upload/replace/remove are separate permission-plus-patient-scope actions for eligible doctors/staff. Financial/mixed action mapping and logical retention are defined in file-data-decisions.md; real-data retention/legal approval remains gated.

Removal ends active care access. Historical access needs an explicit manager grant at the removal cutoff: permitted clinical versions plus read-only own-work financial snapshots, never later changes or other doctors' finances. No historical edits, printing/download/export. Inseparable unauthorized mixed attachments are hidden. Account-wide historical-only status and disabled status cannot be lifted by recovery/reassignment. Full revocation removes all patient grants. Browser capture cannot be prevented.

Login uses stable globally unique clinic code plus case-insensitive clinic-unique username; detailed syntax/no-reuse rules are in the reviewed contract. Manager-issued passwords require replacement before clinic access on first login/reset. Phone sign-in is deferred; doctor/staff phone/email are contact-only. Managers require verified distinct recovery email, an explicit real-accessible-email warning and saved offline single-use codes before setup completion. Recovery, token expiry and session invalidation follow the contract; sessions have a fixed 12-hour maximum, no remember-me. MFA and configurable idle locking remain deferred. Live manager onboarding requires working verified email delivery.

## Reliability and transition

Detect concurrent edits, require review, and explicitly confirm consequential actions. During connection loss keep unsaved drafts only in current-tab memory with warnings/retry. No offline editing or persistent device drafts.

Target at most one hour of lost work and one hour to restore service, subject to infrastructure assessment. User maintains a German Ubuntu VPS reportedly offering 6 CPUs, 12 GB RAM, 200 GB disk at a USD 10/month server budget. No backup service currently exists; user is willing to subscribe. Capacity and recovery capability have not been verified.

On 2026-10-10 the owner identified the provider as Contabo, reported Ubuntu 24 with Dokploy managing Docker deployments, and set an additional off-VPS backup comparison budget of up to USD 5/month. Exact host versions, other workloads, domain and available resources remain unknown. See foundation-infrastructure-assessment.md for evidence, proposed targets and unresolved acceptance gates.

Test fictional data and access/restore scenarios before selected real patients. Verify opening balances and define a cutover to avoid duplicate payment entry in legacy software. No bulk migration or legacy integration in MVP.

## Paid later and deferred scope

After core pilot: paid extra storage, searchable history, and automated reminders. Existing files stay accessible at quota; new uploads pause. Exact prices deferred.

Later: transcription, X-ray charting/analysis and treatment suggestions, patient portal, alternative-plan comparisons, inventory-to-visit links and BI, additional languages, offline/local deployments, USA launch. BI packaging remains open.

## Explicit open items for specification and technical assessment

- VPS provider/configuration, Ubuntu version, other workloads, domain, available capacity, backup destination/budget, recovery feasibility and restore testing.
- Hosting/data handling and applicable invoice/prescription requirements must be researched before real-patient deployment; Germany hosting is a stated location, not a compliance conclusion.
- Identity/access decisions are settled in identity-access-decisions.md; transactional-mail provider/sender/budget/delivery and runtime verification remain gates. Phone sign-in is deferred.
- Clinical and financial owner decisions are recorded in clinical-decisions.md and financial-decisions.md; qualified clinical/prescription validation, enabled-currency precision and applicable document requirements remain real-use gates.
- File/quota/export/logical deletion policy is in file-data-decisions.md; legal retention/purge approval, account-specific hosting/contracts/transfer requirements and recovery/runtime evidence remain gates. Performance targets and operational backup retention are accepted, pending measurements.
- Pilot schedule and evidence checklist. Exact pricing and future AI decisions do not block the core MVP specification.

The implementation stack and application architecture are now selected; see dependency-proposal.md and ../architecture/application-architecture.md. Production infrastructure has not been inspected or changed. Immediate updates use SSE plus REST; hosting and recovery feasibility remain open.
