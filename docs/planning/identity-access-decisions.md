# Identity, permissions and historical access — issue #3

Updated: 2026-10-11. Status: Q29 consolidated sign-off completed; review findings reconciled with subsequent owner decisions Q30a, Q31b, Q33 and Q36; same-reviewer recheck passed; see identity-access-review.md. No implementation authorized. Sources: live issue #3, Spec 001, and owner decision popups in this chat. This note supersedes its earlier incremental/pending-question text.

## Identifiers and onboarding

Login uses clinic code plus case-insensitive clinic-unique username. Clinic codes are stable globally unique lowercase ASCII letters/digits/hyphens, 3–32 characters. Usernames are 3–64 ASCII letters/digits/dot/underscore/hyphen; trim surrounding whitespace, disallow internal spaces and compare case-insensitively. Display names may use accents/Arabic. Manager-approved renames retain the account/history. Retired usernames cannot be reassigned to another account in the clinic.

Managers create accounts and issue temporary passwords. Initial/reset passwords expire after 24 hours, are single-use and require replacement before clinic-data access. Managers cannot reveal users' later passwords. Doctor/staff phone/email are optional contact details, may be shared, and provide neither sign-in nor self-service recovery. Phone sign-in is explicitly deferred.

Manager accounts require distinct verified recovery email within the clinic, before clinic-data access. Show the explicit warning: “Use a real email address you can access. You will need it to recover your manager account.” Failed mail delivery leaves setup incomplete. Email is not a login identifier; recovery identifies clinic/account. Ordinary email change requires current password, verification of replacement and notification to the previous address. Keep the old verified address until replacement verification.

## Recovery and sessions

Managers may reset doctor/staff accounts; another active manager may reset a manager. Managers also recover with their own offline codes or verified email. Issue 10 single-use recovery codes after manager email verification, show once with save/print, store secure hashes only, and require saved confirmation before setup completion. Current-password-confirmed regeneration invalidates the entire prior set.

Successful manager recovery invalidates remaining old codes and enters restricted setup to verify recovery details and save fresh codes before clinic-data access. If the old mailbox is lost, code/other-manager recovery may replace it with a new distinct verified address; notify the old address but do not require access to it or automatically restore superseded addresses. This restricted recovery is the exception to ordinary current-password-required email changes. If all routes are lost, only a separately authorized documented operator recovery process may restore access; no hidden backdoor.

Recovery-email links expire after 30 minutes; verification links after 24 hours. Credentials/links are single-use and replacements invalidate predecessors of the same purpose. A recovery request alone never disables an account or revokes sessions. Completed recovery/reset does. Password reset/change, completed recovery, account disablement and account-type changes revoke all sessions; sign in again. Sessions last at most 12 hours from sign-in, with no remember-me. Configurable idle locking and MFA remain deferred. Sensitive account/recovery changes require current-password confirmation, except the authenticated restricted recovery route above.

Permission and patient-grant changes apply on the next server request and terminate affected live streams. Recovery cannot enable a disabled account. Historical-only status requires explicit manager restoration; patient reassignment cannot reactivate it. Account restrictions take precedence over grants.

## Permission matrix

All actions are clinic-scoped. G means the relevant explicit manager-granted capability; actions grouped in a row remain separately grantable. P means active patient assignment/sharing and the relevant clinical capability. H means an explicit historical grant at its removal cutoff. Doctor/staff capabilities are not automatic. Manager administration and clinic-wide financial authority are intrinsic; other operational capabilities remain configurable. Financial authority never grants clinical-record access. Doctor-managers have manager financial authority but ordinary doctor patient-scope requirements for clinical care.

| Action | Non-doctor manager | Doctor | Doctor-manager | Staff | Historical-only account |
| --- | --- | --- | --- | --- | --- |
| Accounts, manager promotion, permissions, settings, permitted resets, account/access audit | Intrinsic | No | Intrinsic | No | No |
| Assign/share patients | Intrinsic; personal details only | G | Intrinsic | G | No |
| Historical grants/revocation and account restoration | Manager authority | No | Manager authority | No | No |
| Patient personal details, creation/contact editing | G, clinic-wide personal details | G | G | G, clinic-wide reception scope | Snapshot identity for H only |
| Patient archive/restore | G | G | G | G | No |
| Appointment management / conflict override | Separate G | Separate G | Separate G | Separate G | No |
| Clinical read/history/draft chart, history, plan, note, prescription | Never | Relevant G + P | Relevant G + P | Relevant G + P | H read-only snapshot |
| Finalize clinical content / confirm plan acceptance / start-complete procedure / sign prescription | Never | Relevant G + P | Relevant G + P | Never | Never |
| Draft acceptance evidence | Never | G + P | G + P | G + P | Never |
| Clinical attachment upload / replace-version / remove | Never | Separate G + P | Separate G + P | Separate G + P | Never |
| Catalog management | G | G | G | G | No |
| Billing, payments/receipts, invoices, financial history | Full clinic-wide authority | Relevant G + active patient access, own performed work only | Full clinic-wide authority | Relevant G, clinic-wide restricted fields | Own-work financial snapshot at H cutoff, read-only |
| Refund/reversal / discount / price override | Full clinic-wide financial authority; no clinical editing | Separate G, active patient access and own work; clinical edits also require P | Full financial authority; clinical edits require P | Separate G; clinical plan drafts require P and doctor confirmation | Never |
| Inventory actions / operational reports | Relevant G | Relevant G | Relevant G | Relevant G | No |
| Print / download / each export-report category | Full financial authority; other output G; no clinical records | Relevant G within own-work financial scope; clinical output requires P | Full financial authority; clinical output requires G + P | Relevant G; restricted finances; clinical output requires P | Never |
| Permanent deletion / patient merge | Unavailable pending explicit contracts | Same | Same | Same | No |

Only managers grant account permissions and create/promote managers. Delegated assignment/sharing does not confer account-permission administration or clinical eligibility. Prevent disabling/demoting the last active fully set-up manager. Non-doctor managers may select patients using personal details (name, phone, age, gender), but may not inspect their clinical records. Clinical record history requires clinical capability and patient scope; financial history follows the financial scopes below.

Staff may draft clinical content and acceptance evidence; doctors finalize/confirm consequential clinical actions. An authorized assigned/shared doctor may review/finalize another author's draft while preserving author/finalizer attribution. Finalized changes create dated revisions, never overwrites; detailed revision behavior remains in #5. Clinical printing/downloading requires document capability and P.

## Financial scope and clinical boundaries

Owner Q36 explicitly supersedes the previous restricted-manager financial fields and configurable manager financial authority. All managers have full clinic-wide financial authority: procedure names/tooth references in billing, amounts, payments, balances, receipts, invoices, refunds, reversals, discounts, financial reports and exports. Full authority preserves transaction/document history and correction rules under #4; it never authorizes erasing ledger entries. A non-doctor manager still cannot open charts, diagnoses, clinical notes, prescriptions or clinical attachments. A doctor-manager needs P for those records.

Ordinary doctors with active patient access see and perform only manager-permitted financial actions for dental work personally performed by them. Assignment/sharing to another doctor's patient does not expose that other doctor's financial details. Staff with explicit billing permissions may handle clinic-wide restricted billing: patient identity, neutral charge references, amounts, dates and payment/completion eligibility; hide procedure names, tooth details, diagnoses, notes and clinical attachments unless the staff user separately has the relevant active clinical access. Clinical permissions alone never provide financial authority.

Apply these scopes to every endpoint, search, document, attachment, report/export and aggregate. Ordinary doctors' reports/totals must exclude other doctors' work, not reveal it indirectly. Historical scope takes precedence over ordinary clinic-wide operational capabilities for that patient. Manager financial authority is the explicit clinic-wide exception while the manager account is active; an account placed in historical-only mode loses that authority too. Account disablement/full revocation always takes precedence.

## Attachment authorization

Q30a: clinical upload, replace/version and removal are separate G capabilities requiring P for doctors, doctor-managers and eligible staff; never for non-doctor managers or historical users. Removal cannot destroy versions required by retained history. Replacing preserves prior versions. File retention/physical deletion remains gated on #6.

Financial files obey the financial scope above and must not provide a route to clinical records. Financial/mixed upload, replacement and removal now use the separate action capabilities and combined content scopes in file-data-decisions.md: manager full financial authority, ordinary doctor active own-work scope, explicitly permitted staff scope, and both financial/clinical access for mixed files. These actions are not inferred from a generic billing grant. A mixed file requiring clinical access is not available to a non-doctor manager even though billing may show procedure/tooth references. Staff restricted billing and doctor own-work/historical scopes must be enforced on file contents, not just metadata.

## Historical access and revocation

Removal immediately ends active patient access. Historical read-only access requires an explicit manager grant at the care-removal cutoff. Return permitted record and attachment versions available then, excluding later entries, later edits to older records and later uploads. Plain clinical attachments may be viewed inline; application printing/download/export and all mutations are prohibited. Browser capture cannot be prevented.

Q31b supersedes the earlier blanket prohibition of historical financial viewing: a doctor may see read-only financial details for their own performed dental work through the historical cutoff, never other doctors' finances or later financial changes. Q28 still applies to other financial content: redact unauthorized prices/discounts/totals/payments/balances and hide mixed attachments when unauthorized content cannot safely be separated. Authorized own-work financial information may be rendered in a structured read-only view. This exception permits no financial editing, printing, downloading or exporting.

Historical grants are patient-specific. A departed doctor may separately be placed in account-wide historical-only mode, leaving explicitly granted clinical and own-work financial snapshots and no operational/financial mutations. Active reassignment restores normal authorized current access only if account status permits. Every subsequent removal requires a new explicit historical grant/cutoff; never silently advance it. Full patient revocation removes all grants; later access needs a new explicit authorized grant. Recovery cannot lift disabled/historical-only status; only explicit manager restoration may do so.

## Review evidence and remaining gates

Owner accepted Q1–Q28 and confirmed the consolidated contract/review baseline in Q29. One reviewer found zero standards findings and two P2 specification gaps: attachment authorization and historical restrictions versus clinic-wide financial/output access. Q30a, Q31b, Q33 and Q36 resolve/revise the relevant owner boundaries as recorded above. Proposed blanket non-doctor-manager patient restrictions in Q32a/Q34 were rejected and are not policy. Q36 is the final manager financial authority decision. Same-reviewer recheck passed after correcting the historical-only glossary definition: zero residual standards/spec findings within this planning scope. See identity-access-review.md for reviewed snapshot hash, checks and limitations. Issue #3 remains open; no publication/closure authorized.

Email delivery is a new explicit dependency: use a replaceable transactional-mail adapter with isolated fake delivery for fictional tests. Live manager onboarding/pilot requires provider selection, sender/domain configuration, budget and tested delivery. No purchase or external email sending authorized. Never use fake verification to bypass the live setup requirement.

Other prerequisite contracts remain in #2/#4/#5/#6: runtime/security proof, finance behavior/document requirements, clinical revisions, file versioning/retention and data handling. They may not weaken these approved access boundaries. Required later verification includes cross-clinic isolation; the complete role/action/patient-scope matrix; denied clinical leakage in finance/reports/files; historical cutoff/version and revocation behavior; recovery single-use/expiry and session invalidation; last-manager safety; and delivery/setup failures. No runtime checks have run.

Security implementation should follow the existing foundation CSRF/session baseline and [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): secure random tokens, protected storage, single use, generic/rate-limited recovery responses and no automatic login after reset. Token durations above are owner-approved product choices. No application implementation, credentials, purchase, live migration, deployment or patient-data use is authorized by this planning note.
