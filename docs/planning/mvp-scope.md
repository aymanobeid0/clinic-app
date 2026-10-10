# Dental clinic MVP — consolidated discovery

Status: user-confirmed discovery baseline, approved on 2026-10-10 with the open items below explicitly carried forward into specification. Discovery is complete. This is a product planning baseline, not a production-ready technical specification. Detailed answers and evolution are in `discovery.md`; the latest explicit decisions supersede earlier alternatives.

## Pilot and delivery

Online browser application, initially French, for a single-location clinic in Mauritania. Pilot has four dentists (one also manager), two receptionists, three assistants, one sterilization staff member, four chairs, and five PCs. Arabic/RTL and English follow later; USA expansion is deferred.

## Free MVP

- Unlimited patients and staff; provisional 1 GB attachment allowance per clinic.
- Appointments with dentist, optional chair, editable durations, conflict detection and authorized overrides. Booked, confirmed, arrived, in care, completed, cancelled, no-show; walk-ins supported. Preserve rescheduling history; no automatic cancellation fees.
- Patient ID and duplicate warnings; name and phone required, including identified guardian/contact numbers. Medical history, allergies, attachments, and dated FDI chart for permanent/primary/mixed dentition. Archive patients; preserve finalized records.
- Identified treatment plans with priced procedures, tooth/multiple-tooth/whole-mouth scope, discounts by permission, accepted extra-work fees, versions and acceptance evidence. Scope/price changes require renewed acceptance. Visits continue until doctor explicitly completes procedures; multiple procedures may be treated per visit.
- Starting care creates a visit draft. One free-text clinical note, autosaved with visible status; finalized notes receive dated corrections. Visit can end with pending-note task. Chart updates suggested for confirmation.
- Manually authored, printable prescriptions with patient/prescriber details and medication instructions; no automated medication advice.
- Pack-only inventory, consumed on opening; manual batch choice, receiving costs/suppliers/expiry, reasoned stock movements, no negative stock or expired consumption. Item low-stock thresholds and configurable expiry warnings. No visit links or full purchasing/accounting module.
- Basic appointment, payment, balance, and low/expiring-stock reports; essential per-record history; printing and authorized data/attachment exports.

## Resolved billing model

Starting an accepted procedure makes its full agreed price due in the editable billing workspace. Unstarted procedures are planned future treatment. Staff manually allocate payments to procedure charges, using existing credit, new money, or both. Deposits and excess receipts are explicitly entered separately as patient credit; payment methods are manager-configurable.

Each payment has a numbered receipt, even before invoice issue. Staff manually issue a numbered invoice for a procedure only after it is completed and fully paid. Invoices cover whole procedure prices; installments appear on receipts, not partial invoices. A whole-plan summary at completion shows all care, paid/due totals, and references existing invoices without creating duplicate charges; it may show unpaid balances.

Preserve issued financial documents. Refunds, reversals, cancellation adjustments, and credits are explicit and historical. Existing balances are documented opening balances, not fabricated new payments. Catalog changes do not rewrite agreed prices.

## Accounts and clinical access

Three account types: manager, doctor, staff; individual accounts work from any PC. Manager controls permissions, with optional doctor capabilities. Clinical access requires patient assignment/sharing, including for doctor-managers. Non-doctor managers cannot access clinical records. Permitted staff may read/draft assigned/shared clinical records; doctors finalize.

Manager or assignment-authorized users may assign patients to multiple doctors. Former treating doctors may retain a restricted historical login showing versions through removal from care, excluding future entries. No edits, financial access, printing, downloads, or exports; manager may revoke access entirely. View-only controls cannot prevent screenshots.

Manager creates usernames/passwords and handles requested account changes/resets. Password changes after initial issue and manager recovery codes are planned. Earlier optional phone sign-in and optional email remain to be specified. MFA and idle locking are deferred.

## Reliability and transition

Detect concurrent edits, require review, and explicitly confirm consequential actions. During connection loss keep unsaved drafts only in current-tab memory with warnings/retry. No offline editing or persistent device drafts.

Target at most one hour of lost work and one hour to restore service, subject to infrastructure assessment. User maintains a German Ubuntu VPS reportedly offering 6 CPUs, 12 GB RAM, 200 GB disk at a USD 10/month server budget. No backup service currently exists; user is willing to subscribe. Capacity and recovery capability have not been verified.

Test fictional data and access/restore scenarios before selected real patients. Verify opening balances and define a cutover to avoid duplicate payment entry in legacy software. No bulk migration or legacy integration in MVP.

## Paid later and deferred scope

After core pilot: paid extra storage, searchable history, and automated reminders. Existing files stay accessible at quota; new uploads pause. Exact prices deferred.

Later: transcription, X-ray charting/analysis and treatment suggestions, patient portal, alternative-plan comparisons, inventory-to-visit links and BI, additional languages, offline/local deployments, USA launch. BI packaging remains open.

## Explicit open items for specification and technical assessment

- VPS provider/configuration, Ubuntu version, other workloads, domain, available capacity, backup destination/budget, recovery feasibility and restore testing.
- Hosting/data handling and applicable invoice/prescription requirements must be researched before real-patient deployment; Germany hosting is a stated location, not a compliance conclusion.
- Optional phone login details, identifier uniqueness, initial password-change timing, reset/session invalidation and manager recovery-code lifecycle.
- Exact chart vocabulary, permission matrix, historical snapshot boundaries, document layouts, money rounding, and financial adjustment behavior after settlement.
- File size limits, retention/deletion versus backup policy, export formats, backup retention, and performance acceptance criteria.
- Pilot schedule and evidence checklist. Exact pricing and future AI decisions do not block the core MVP specification.

The implementation stack and application architecture are now selected; see dependency-proposal.md and ../architecture/application-architecture.md. Production infrastructure has not been inspected or changed. Immediate updates use SSE plus REST; hosting and recovery feasibility remain open.
