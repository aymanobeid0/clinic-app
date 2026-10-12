# Dental clinic management

A clinic manages patient care, scheduling, treatment, billing, and supplies. The initial customer is a single-location dental clinic.

## Language

**Manager account**:
An individual clinic account responsible for managing staff permissions and clinic settings. Its holder may also practice dentistry. Manager authority is independent from login method: primary clinic managers use verified unique email/password; a doctor granted manager authority keeps clinic-code/username/password login.

**Doctor account**:
An individual account for a treating dentist, with permissions controlled by the clinic manager.

**Staff account**:
An individual non-doctor account with permissions controlled by the clinic manager; it can serve reception, assistance, or sterilization duties.

**Patient**:
A person receiving dental care at a clinic.

**Assigned patient**:
A patient whose clinical record a doctor may access through an explicit care assignment. Access to other patients requires explicit sharing.

**Historical patient access**:
An explicit, revocable manager grant allowing a former treating doctor to view permitted clinical record versions through a specified care-removal cutoff.

**Historical-only account**:
A departed doctor's account restricted to explicitly granted historical patient views, including read-only financial snapshots for their own performed work through the care-removal cutoff, without active-care, operational or financial editing actions.

**Appointment**:
A scheduled visit for a patient with a clinic clinician.

**Treatment plan**:
A proposed set of dental treatments for a patient. A proposal does not itself mean that treatment has been performed.
Each plan has its own ID and contains related priced procedures.

**Planned procedure**:
A treatment item belonging to a treatment plan, with a base price and optional attached extra-work fees. It may span as many visits as the doctor determines necessary, until explicitly marked complete.

**Procedure catalog**:
The clinic's reusable list of procedures and default prices. Doctors may override prices on patient plans only with manager-granted permission.

**Treatment visit**:
A patient care encounter created when the doctor starts care, containing the procedures actually worked on. One encounter can include several procedures.

**Extra-work fee**:
An itemized additional charge attached to a procedure for work beyond its base price. Accepted extra-work fees increase the agreed procedure total.

**Plan version**:
A retained revision of a treatment plan. Changes to scope or price after acceptance require a new acceptance record.

**Acceptance record**:
A record of who accepted a treatment plan version, when, and how, optionally supported by an uploaded signed document.

**Credit adjustment**:
An explicit reduction of an issued charge, preserving the original invoice.

**Patient credit**:
Money received from a patient that has not yet been allocated to invoice charges, including deposits.

**Payment allocation**:
The application of patient funds to a started procedure charge, reducing its outstanding amount. Allocation may precede invoice issue and remains linked when the invoice is issued.

**Refund**:
Money returned to a patient, recorded with a reason and history.

**Payment reversal**:
A recorded correction of an incorrectly entered payment, preserving its history. It is distinct from returning actual money to a patient.

**Dental chart**:
A tooth-by-tooth record of dental conditions and treatments, maintained manually in the first release.

**Invoice**:
A numbered document manually issued by staff for whole procedure charges only after the included procedure is completed and fully paid. It is distinct from receipts and from the editable billing workspace.
_Avoid_: Payment

**Billing workspace**:
The editable view of a treatment plan's started procedure charges and payment allocations, sometimes called an "open invoice" in conversation. Starting a procedure makes its full agreed price due without automatically issuing an invoice.

**Receipt**:
A numbered record of a payment received. Installments have separate receipts and may be recorded before an invoice is issued.

**Whole-plan summary**:
A document showing a treatment plan's procedures, paid amounts, remaining due, and references to issued invoices. It does not create additional charges and may be printed at plan completion before full settlement.

**Outstanding balance**:
The unpaid amount of started procedure charges and documented opening balances, after allocations and explicit adjustments. Unstarted planned procedures are future treatment, not amounts due.

**Payment**:
Money received from a patient and recorded by clinic staff; it may cover only part of an outstanding charge.

**Inventory batch**:
A separately tracked group of units of a supply item, with its own expiry information.

**Free core**:
Appointments, patient records, billing, treatment plans, and inventory available without subscription fees and without limits on patient or staff counts.
