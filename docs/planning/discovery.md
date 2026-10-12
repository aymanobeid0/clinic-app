# Dental clinic app discovery

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. The initial #7 HTTP/session slice was published in draft PR #32; subsequent implementation status is recorded in the linked delivery status. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

## Stated direction

- Dental clinic management app with appointments, patients, billing, treatment plans, and inventory as core capabilities.
- Free tier with paid optional features; limits and packaging are undecided.
- Potential paid capabilities: note transcription, dental chart creation from X-rays, and treatment plan suggestions from X-ray analysis.
- Additional optional features remain to be explored.

## Existing material

The workspace contains a Dentara frontend reference and design documentation. `systemdesign.md` describes an in-memory prototype, not an established production architecture. Its sample languages, currency, and workflows do not establish product requirements.

## Open foundational decisions

1. First target country and working languages.
2. Initial practice size and users.
3. Most important operational problem and first-release success criterion.
4. Initial release boundary for AI capabilities.
5. Meaning of the free tier and intended payer.

## First interview round

- Intended markets: Arab markets and America. Exact first country and meaning of America remain unresolved.
- Interface languages: Arabic, English, and French.
- Initial customer: single-location clinic with a few dentists, a receptionist, and an owner.
- Core problems: scheduling and scattered records, unpaid balances and billing, and tracking treatment plans and follow-up. No priority between these has been chosen.
- Release sequence: core clinic workflows first; AI later.
- Pricing direction: permanently usable free core, paid optional features. Whether free core usage is unlimited remains to be confirmed; the user selected both the free-plan and unlimited-core options.

No implementation or architecture decisions have been accepted yet.

## Second interview round — confirmed product decisions

- First pilot country: Mauritania. America refers to the USA, a future market.
- All five core modules are permanently free, with unlimited patients and staff. Attachment storage, infrastructure costs, and paid feature packaging remain unresolved.
- First release supports the connected journey: appointment, patient record, treatment plan, treatment recording, invoice, payment recording, follow-up.
- Billing includes invoices, partial payments, outstanding balances, and manually recorded payments. Online collection and insurance claims are outside the selected first-release billing scope.
- Patient records include medical history, allergies, clinical notes, attachments including X-rays, and a manually maintained tooth-by-tooth dental chart.
- Inventory includes quantities, stock movements, low-stock alerts, batches, expiry dates, and suppliers. Automatic treatment-based stock deduction has not been selected.

## Delivery scope clarification

- MVP is online first.
- Offline operation, clinic-installed deployment, and any associated alternative pricing models are deferred until after the MVP.
- This does not change the confirmed free core with unlimited patients and staff; paid feature packaging remains open.
- Staff permissions, appointment resources, treatment plan detail, invoicing triggers, attachment storage, and reminders from the third question round remain unanswered.

## Third interview round — confirmed product decisions

- Owner customizes permissions for each staff member. Permission categories and defaults remain open.
- Appointments reserve a dentist and optional chair; authorized staff may explicitly override conflicts.
- Each treatment plan has an ID and related priced procedures. Each procedure is divided into multiple visits; whether one-visit procedures are also supported remains to be clarified.
- Staff explicitly issue invoices for selected procedures.
- Free attachment storage allowance with paid extra storage; allowance and prices remain open.
- Free in-app follow-up tasks and manual message sharing; automated reminder delivery is paid.
- Treatment plan alternatives, tooth association, and patient acceptance were not confirmed by the custom answer.

## Fourth interview round — confirmed decisions and refinements

- Procedure visit counts are not fixed in advance. The doctor decides when a procedure is complete; visits are recorded as care continues. The precise automatic recording trigger remains open.
- One patient visit may include multiple procedures.
- Each procedure has a base price; the doctor may attach extra-work fees to that procedure.
- Partial procedure invoicing is supported up to the agreed total. How extra fees change that total and receive acceptance remains open.
- Plans use draft, presented, accepted, in progress, completed, and cancelled statuses; staff record patient acceptance.
- Procedure scope supports one tooth, multiple teeth, or the whole mouth.
- The doctor may modify an accepted plan according to clinical judgment or patient needs. Version history, renewed acceptance, and effects on existing invoices remain open.
- The user's response about editing accepted plans does not resolve whether alternative proposals are required.

## Fifth interview round — confirmed decisions

- Starting care creates the treatment visit; the doctor selects procedures actually worked on.
- Preserve plan versions and record renewed patient acceptance when treatment scope or price changes. Routine notes do not require renewed acceptance.
- Itemized accepted extra-work fees increase the agreed procedure total and its invoicing ceiling.
- Preserve issued invoices; handle later changes through explicit additional invoices or credit adjustments.
- Alternative proposal comparison is deferred from the MVP; editing and versioning a proposal is supported.
- Acceptance records include who accepted, when, and how, with an optional signed attachment. In-app digital signature is not required for the MVP.

## Inventory and analytics clarification

- MVP stock consumption is recorded manually by batch, without treatment-visit links.
- Linking material consumption to treatment visits is deferred until after the MVP.
- A future BI dashboard will analyze clinic performance. Metrics, release timing, and free/paid packaging remain undecided.
- This answers Q35 only; other questions in that round remain open.

## History pricing clarification

- Owner-facing searchable change history is a paid feature, not part of the free core.
- This answers the packaging portion of Q37. Underlying change recording, free visibility, retention, and paid viewer scope remain to be settled; the user's decision does not imply disabling internal change recording.

## Sixth interview round — remaining answers

- Deposits are patient credit and can be allocated to invoices.
- Authorized staff can record refunds and reverse incorrect payments, with reasons and history.
- Clinic manager selects currency in clinic settings. Number of simultaneous currencies and rules for changing currency after financial activity remain open.
- Permission setup uses editable role presets and individual permissions.
- User owns a clinic and can test the MVP there. Formal pilot acceptance criteria remain open.

## Seventh interview round — confirmed decisions

- Each clinic chooses one currency, locked after its first financial transaction.
- Essential per-record history is free; searchable history across records, advanced history filters, and history reports are paid.
- Staff show or print treatment plans and record acceptance. No patient portal for MVP.
- Pilot the free core first; paid add-on purchasing follows the pilot. Storage limits are visible during the pilot.
- Start with fictional patient data, then controlled real-patient use after access, backups, and data handling have been verified.
- Pilot clinic has four dentists, four chairs, and six staff members. Whether the six include dentists, staff roles, and device setup remain unspecified.
- Existing legacy software covers billing and prescriptions; most work is on paper, without useful patient profiles or clinical history in the software.
- Free operational reports: daily appointments, invoices/payments, outstanding balances, and low/expiring stock.
- Prescription scope and transition of existing patient balances need clarification.

## Eighth interview round — confirmed decisions

- MVP includes manually authored prescriptions and reusable print templates, linked to patients; no automated medication recommendations selected.
- Selected existing patients are created manually with documented opening balances. Historical payments are not recreated as new transactions.
- Pilot staff: one manager who also practices dentistry, three other dentists, two receptionists, three assistants, and one sterilization staff member (ten people total).
- Devices: one PC in each of four treatment rooms and one at reception (five PCs).
- Appointment statuses: booked, confirmed, arrived, in care, completed, cancelled, no-show. Walk-ins may start care without advance booking.
- Clinical notes: editable drafts, preserved finalized notes, and dated corrections.
- Pilot uses one language, not yet specified. Arabic, English, and French remain longer-term requirements.
- Pilot acceptance: dentists and reception staff complete booking, care, plan acceptance, invoicing, deposits/payments, and stock recording; balances reconcile; permissions work; a backup can be restored before expanding beyond the controlled pilot.

## Procedure catalog clarification

- Use a clinic procedure catalog with default prices.
- Doctors may edit procedure prices on patient treatment plans only if the manager grants permission in clinic settings (Q56).
- Permission to edit the shared catalog itself is separate and remains to be confirmed.

## Ninth interview round — confirmed decisions

- Pilot interface and printed documents use French. Arabic and English follow later.
- Every doctor and staff member has an individual account usable from any PC.
- Three account types: manager, doctor, staff. A manager may also practice dentistry. Manager-controlled permissions apply to these accounts; separate receptionist/assistant/sterilization account types are not required.
- Archive patients and preserve finalized clinical and financial records.
- At the storage limit, existing attachments and core workflows remain accessible; only new uploads are paused until space is available.
- Price override permissions follow the procedure catalog clarification above.

## Tenth interview round — confirmed decisions

- Managers retain administration of accounts, permissions, and clinic settings, with optional doctor capabilities.
- Manager and users with catalog-management permission may edit the shared procedure catalog.
- Doctors access assigned patients only; access to other patients requires explicit sharing. Sharing authority, scope, and revocation remain open.
- Automatically generated clinic patient IDs identify patients. Warn on possible duplicates; names and phone numbers are not required to be unique.
- Manual dental chart uses FDI numbering and supports permanent, primary, and mixed dentition.
- Free MVP printing includes plans, invoices, receipts, and prescriptions. Manager-authorized export includes clinic records and attachment files.

## Eleventh interview round — confirmed decisions

- Manager and users with patient-assignment permission can assign or share patients.
- Patients can have explicit assignments to multiple doctors.
- A manager may view clinical records only if also a doctor. Scope of assignment checks for doctor-managers remains open.
- Doctors who treated a patient retain read access after assignment removal. Scope of historical versus future records, and employment/account revocation exceptions, remain open.
- Patient creation requires name and phone; family members may still share the same phone number.
- Inventory receiving records batch, supplier, quantity, expiry where applicable, and purchase cost. Full purchase orders and supplier-payment accounting are outside MVP scope.

## Twelfth interview round — confirmed decisions

- After care assignment removal, treating doctors retain access only to historical care records from their care period; future care requires new sharing.
- Departed doctors can keep a limited historical-care login. This is a continuing restricted account, distinct from fully disabling an account; revocation authority and permitted actions remain open.
- Doctor-managers follow the same patient assignment and sharing rules as other doctors.
- Staff may read or draft clinical content when permitted; doctors finalize it. Managers who are not doctors remain barred from clinical records under the earlier explicit decision.
- Guardian/contact phone numbers may satisfy required patient phone; record whose phone it is and permit shared numbers.

## Thirteenth interview round — confirmed decisions

- Manager can fully revoke former-doctor historical access. Fully disabled accounts cannot sign in; clinical records remain preserved.
- Historical logins are view-only: no edits, financial access, printing, downloads, or exports through the app. This is an application permission boundary, not a guarantee against screenshots or browser capture.
- Staff clinical access is limited to explicitly assigned/shared patients; scheduling and contact access are separate permissions.

## Product discovery checkpoint

The proposed MVP is an online, French-language, single-location clinic application piloted in the user's clinic. It includes scheduling and walk-ins, patient records and manual FDI dental charts, versioned treatment plans and acceptance, manual prescriptions, invoices and patient funds, batch inventory, basic reports, individual accounts and granular permissions, essential per-record history, printing, and authorized exports.

Free core has unlimited patients and staff but a storage allowance. Paid extra storage, searchable history, and reminder automation are planned after the core pilot. AI, offline/local deployment, other languages, USA launch, patient portal, alternative proposals, and visit-linked inventory analysis are deferred. BI packaging is undecided.

Still open for subsequent specification/technical planning: exact storage allowance and commercial pricing; authentication/recovery and account-switching design; hosting and data handling requirements; backup frequency and recovery targets; concurrent-edit handling; detailed dental-chart vocabulary; prescription template fields; historical-access snapshot boundaries; tax/invoice requirements; and pilot scheduling. No stack or production readiness claim is established by this discovery.

User confirmed this product scope and chose to continue the interview into detailed workflows and technical requirements. Detailed specification and implementation have not started.

## Detailed workflows — round fourteen

- Appointments have editable durations, a configurable clinic default, and procedure-based suggestions.
- Starting care creates a visit draft; doctor selects procedures actually worked on. Procedure completion is explicit and separate from visit completion.
- Care may end before note finalization; show a pending-note task.
- Visit note is one free-text field, with the previously agreed draft/finalized/correction lifecycle; structured templates are not selected.
- Procedure completion suggests chart changes for dentist confirmation. Manual findings need not create billable procedures.
- Rescheduling preserves original timing and history. Cancellation/no-show reasons are optional; no automatic cancellation fees.

## Detailed financial workflows — round fifteen

- Procedure discounts are permission-controlled, require a reason, and reduce the agreed invoicing ceiling. Later accepted-price changes follow plan version/acceptance rules.
- Invoice entry starts with patient details; staff choose procedures and charge amounts. Draft/issue lifecycle and numbering are still unresolved by the custom response.
- Staff manually allocate every payment and choose whether invoice settlement uses existing patient credit or newly received money. Excess receipts become patient credit. Whether both sources can be combined remains open.
- Payment methods are manager-configurable; payments are recorded manually, not processed online.
- Cancelled partly performed procedures use an explicit final charge and credit adjustment as needed, retaining performed care and financial history; no automatic refund.
- Catalog price changes apply to new plan items only; existing accepted plans and issued invoices retain their amounts.

## Financial clarification — round sixteen

- Save editable invoice drafts, then explicitly issue with a unique clinic invoice number.
- Staff may combine existing patient credit and newly received money, retaining separate source records.
- User selected invoices only for amounts paid that day. This differs from the previously discussed unpaid/partially paid invoice model; outstanding-balance basis and use of existing credit require clarification before settling the financial model.
- Excess received money is recorded by staff as a separate deposit, rather than automatically folded into the invoice payment entry. Overall receipt reconciliation remains required.

## Financial model refinement — round seventeen

- User clarified the earlier paid-only invoice answer: starting a procedure creates an invoice record supporting multiple payment receipts.
- Patient receives a receipt for each payment. Full settlement produces a final patient invoice showing procedure details and the full amount paid, without the payment breakdown.
- Applying existing patient credit counts as settlement even without new money that day.
- Amounts become due as care is performed, but exact due calculation remains unresolved: full price at procedure start versus increments during care.
- Automatic invoice creation at procedure start revises the earlier explicit-issue workflow; draft/numbering lifecycle, one-versus-many procedure grouping, and final document identity need confirmation.
- Historical invoice/receipt records and adjustments must still be preserved under prior decisions.

## Financial model refinement — round eighteen

- Full agreed procedure price becomes due when the procedure starts; it is not progressively accrued by visit. This supersedes the unresolved incremental-due interpretation.
- Staff issue invoices manually; procedure start does not automatically issue an invoice.
- Use an open invoice with an option to issue a separate invoice for a completed and paid procedure. Whether open invoice means a billing workspace or an already issued document, and how a split transfers charges/payment allocations without duplication, remain open.
- Fully paid final printout retains the original invoice number. Receipt detail remains separate.
- Earlier partial-procedure invoice rules and the protected-issued-invoice rule must be reconciled with the open-invoice/split workflow before specification.

## Financial model refinement — round nineteen

- "Open invoice" means an editable billing workspace for started procedures and payments, distinct from manually issued numbered invoices.
- Numbered receipts may precede invoice issue; allocations reduce procedure due balances and remain linked when invoiced later.
- Official invoices cover whole procedure prices; installments are represented by receipts. This supersedes the earlier selection of partial-procedure invoicing.
- Allow separate invoices for completed procedures and a whole-plan document when treatment is complete. Handling already invoiced procedures in the whole-plan document remains open; duplicate charges must not be silently introduced.

## Financial model resolution — round twenty

- Whole-plan document is a summary referencing issued invoices, not a second charge for already invoiced work.
- Staff may issue a procedure invoice only when that procedure is completed and fully paid.
- Once all procedures are completed, the whole-plan summary may be printed even if a balance remains; show completed care, paid amounts, and remaining due.
- Outstanding balances therefore derive from started procedure charges and allocations, not only issued invoices, since invoice issue happens after full settlement.
- These decisions supersede earlier descriptions of unpaid issued invoices and invoices issued at procedure start. Issued documents remain protected; later adjustments remain explicit and historical records preserved.

## Inventory workflow — round twenty-one

- Track packs only; no conversion to individual item units.
- Staff select batches manually. Expired batches cannot be used for normal consumption.
- Waste, expired disposal, and count corrections use reasoned movements, preserving original history.
- Block negative batch stock.
- Each item has a low-stock threshold; expiry warning period is configurable for the clinic.
- Whether pack quantities permit fractions and when opened packs count as consumed remain open.

## Reliability and pack handling — round twenty-two

- Consume one whole pack when opened; do not track remaining contents or fractional packs.
- Detect concurrent edits and require review rather than silently overwrite.
- Autosave clinical drafts online with visible saving/saved/error states; consequential actions require explicit confirmation.
- During connection loss, preserve unsaved draft in current-tab memory, warn, and retry. No persistent device draft or offline workflow selected.
- Recovery point target: at most one hour of lost work.
- Recovery time target: restore service within one hour, subject to cost and feasibility evaluation. These are requirements to assess, not verified operational capabilities.
- Remaining interview will use grouped decisions followed by consolidated review; deferred commercial and AI questions will not block the MVP plan.

## Grouped defaults — round twenty-three

- Sign-in uses username or phone number and password; email is optional. Invitation, identifier uniqueness, recovery without email, MFA, and idle locking require clarification because the user replaced the grouped account proposal.
- Approved dated chart findings by tooth/surface, missing/extracted teeth, and existing restorations.
- Approved manual prescriptions with medicine, dose, route, frequency, duration, instructions, patient and prescriber details; no automated drug advice.
- Historical access includes records through care-removal timestamp and excludes later entries; implementation must preserve historical versions rather than expose later edits through old records.
- Approved PDF/JPEG/PNG attachments, provisional 1 GB free clinic allowance, visible usage, permission-controlled deletion with reasons, and preservation of finalized-record references/deletion history. DICOM deferred.
- Approved staged pilot transition with fictional data, restore/permission checks, verified opening balances, and explicit cutover; no MVP bulk migration or legacy integration.
- User will maintain hosting. Server budget is USD 10/month; existing VPS reportedly has 6 CPUs, 12 GB RAM, and 200 GB disk. Provider, location, configuration, available capacity, and backup arrangements have not been verified.
- One-hour recovery point and time targets remain subject to feasibility assessment; server specifications alone do not establish recovery capability.

## Account and hosting exceptions — round twenty-four

- Manager creates doctor/staff accounts with username and initial password, to be changed later. Manager may change username and reset password on the account holder's request. Mandatory first-login change timing was not explicitly confirmed.
- Approved manager-assisted recovery and manager offline recovery codes; optional phone sign-in/email from earlier decisions remain planned, subject to detailed identifier design.
- MFA and configurable idle locking are deferred, not mandatory for MVP. Ordinary authenticated sessions, password hashing, and permission enforcement remain necessary technical requirements.
- Existing VPS is in Germany and runs Ubuntu. No backups currently exist; user is willing to subscribe to backup service.
- Assess setup before resolving budget versus recovery target tradeoff. Provider, other workloads, domain, exact Ubuntu version, and backup budget remain unknown; no credentials or infrastructure access requested during discovery.

## Discovery closure — 2026-10-10

User confirmed `mvp-scope.md` as the consolidated MVP baseline and explicitly approved closing discovery with its open technical, hosting, and data-handling items documented for specification. Interview complete; no implementation or infrastructure changes authorized by this closure alone.

## Post-specification stack decision

- User approved the 28-ticket breakdown and GitHub publication, then clarified stack preferences before publication.
- Backend: Node.js and Express with TypeScript.
- Frontend: React; supporting dependencies and frontend TypeScript remain to be settled.
- Database: PostgreSQL with Prisma ORM.
- Deployment: Docker and Nginx on the existing Ubuntu VPS, subject to assessment.
- Maintenance: primarily AI coding tools.
- Versions, frontend tooling, test libraries, and detailed architecture remain unspecified. No implementation or production deployment has started.

## Approved dependencies and ticket publication

- User approved React TypeScript and the supporting dependency/layout proposal; exact versions still require compatibility verification before installation.
- Published 28 approved tickets as GitHub issues #2–#29 with ready-for-agent labels, and verified 49 native blocking relationships.
- The parent specification #1 remains open and was not edited during ticket publication. The local specification includes subsequent stack decisions, which are carried into the foundation ticket.
- Published ticket mapping is recorded in ticket-index.md. No application implementation, dependency installation, or VPS changes performed.

## UI state amendment

- User selected Zustand for local UI state. Use it for shared UI state; TanStack Query remains authoritative for server data, React Hook Form for form state, and React hooks may hold component-private state.
- This does not authorize persistent device clinical drafts or clinical caches. No dependencies installed yet.
