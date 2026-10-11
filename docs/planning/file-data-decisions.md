# File handling and pilot data requirements — issue #6

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. Only the initial #7 HTTP/session slice is implemented, in draft PR #32. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Date: 2026-10-11. Status: compact owner batch approved with 2 GB quota; independent planning review passed; see file-data-review.md. No implementation authorized. Sources: current issue #6, existing Spec 001/identity contracts and owner answers. This contract supersedes earlier pending-question text. Issue #6 remains open with no listed blockers at last read.

## Upload and quota contract

Allow PDF, JPEG and PNG only; maximum 20 MB per file. Clinic attachment allowance is 2 GB, replacing provisional 1 GB. Define decimal units consistently: 20,000,000 bytes per file and 2,000,000,000 bytes per clinic. Reject wrong content type, invalid/corrupt files, unsupported active content and oversize before publication; extension alone never proves type. Private generated storage keys, authorized delivery and no public static attachment URLs follow approved architecture.

Count actual stored attachment bytes for every retained version, including logically removed files and historical/finalized references. Original and replacement both count while retained; deduplication never silently bypasses per-clinic accounting. Backup replicas and temporary export bundles are operational storage, not additional patient-upload quota consumption. Track their host space independently. Reserve quota atomically for concurrent uploads, release failed/cancelled upload reservations, and clean abandoned temporary uploads without publishing them.

At quota, reject new uploads and replacements that would exceed it, retaining access to existing authorized files and core care/billing. Replacement cannot evict an older referenced version to fit. Show usage and explain that logical removal does not free retained bytes; storage purchases/pricing are deferred, not implicit automatic billing. Finalized references cannot be broken by quota cleanup.

## Authorization and file classes

Server-side authorization applies to metadata, bytes, thumbnails/previews, upload, replace, remove and export; guessed IDs confer no access. Classify files as clinical, financial or mixed. These classes enforce existing access rules; financial labels alone cannot expose clinical records. Changes to classification must not broaden access to existing bytes without the requisite permissions/content check.

| Class/action | Required authorization |
| --- | --- |
| Clinical upload / replace-version / remove | Separate action capability plus active clinical patient access for eligible doctor, doctor-manager or staff; never non-doctor manager |
| Financial upload / replace-version / remove | Separate action capability for doctor/staff; manager intrinsic full financial authority. Ordinary doctor: active patient access and personally performed-work financial scope only. Staff: explicit financial permissions and approved restricted fields. |
| Mixed upload / replace-version / remove | Both financial and clinical authorization for that action/patient/content; non-doctor manager excluded, despite financial authority |
| Read/download/print/export | Relevant output capability and full content/patient scope; managers have financial output authority but no non-doctor clinical access. Historical grants allow only their authorized inline snapshot, never download/print/export or mutations. |

Financial/mixed mutation mapping above resolves its earlier #6 gate. No generic file permission may override own-work financial restrictions, staff restricted financial fields or clinical patient scope. If content cannot safely be filtered/separated, deny delivery/export instead of returning partially hidden metadata with unrestricted bytes. Mixed files must not expose other doctors' finances to an ordinary doctor. Financial permission does not grant clinical charts/notes/prescriptions/attachments; procedure/tooth billing references follow the specific manager exception in identity-access-decisions.md.

## Removal, versions and retention

Permission-controlled removal requires actor/date/reason. Hide the removed attachment from current ordinary lists, but preserve tombstone/history, bytes and version references required by finalized records and authorized historical views. Replacement creates a new version, not an overwrite. Only users authorized for the retained reference/cutoff may view its version; removal never grants new access.

No ordinary permanent deletion or patient merge in MVP. A restricted administrative purge may run only under separately approved retention/legal policy and explicit authorization; it is not an account-manager UI capability or license to erase finalized records. Retention duration is not invented: retain protected versions until an approved schedule permits deletion. Before real patient use, approve purpose-specific record/file/audit/backup retention and lawful exceptions. Patient/financial/clinical corrections retain history independently of file removal.

Backups follow selected off-VPS Contabo S3 EU design: WAL/base backups and 30-minute attachment backups, conditional 7 days of recovery points plus 4 weekly points, budget and one-hour recovery gates. Backup retention is not clinical/legal record retention. Logical deletion is not immediate erasure from backups. Backups expire under the approved operational/legal schedule; no individual backup rewrite is promised. A later authorized purge must track when the last retained backup copy expires and cannot claim immediate complete erasure.

Restoration must reapply subsequent authorized removal/purge instructions before serving data, without resurrecting logically removed files or deleting versions legally required by retained references. Keep protected deletion/purge manifests independently recoverable and include their handling in rehearsal; resolving the manifest's retention/access requirements is part of the approved purge/runbook gate. Restore into isolated fictional-data tests first, not production by default.

## Exports

Free authorized exports use CSV for tabular records, JSON for structured records/relationships/version metadata and a ZIP containing only authorized attachments plus a manifest linking record/file IDs, versions and checksums. Use explicit currency codes and separate currency totals. Exports apply the same current account/patient/own-work/content rules as online access; no historical-account exports. A manager export is not an unrestricted clinical backup: non-doctor managers receive personal/financial permitted data only. Full operational disaster backups are separately restricted infrastructure artifacts, not patient export endpoints.

Recheck authorization during generation and before delivery; revocation prevents delivery even if a job began earlier. Export bundles remain private, expire after a short configured lifetime and are cleaned independently of upload quota. Do not include credentials, session tokens, backup keys or operational secrets. Stream or run durable bounded jobs under approved backend architecture; actual tooling/time limits are implementation choices, not a new infrastructure purchase. Do not accept an attachment export if required content filtering cannot be enforced on its bytes.

## Worked acceptance checks

- Upload exactly 20,000,000 bytes of valid allowed content when enough quota remains: accepted; one byte more: rejected. A renamed executable is rejected.
- Stored versions total 1,990,000,000 bytes; two concurrent 10,000,000-byte uploads cannot both publish. Exactly one fits; failed request leaves no committed orphan/reservation.
- Replace a referenced file: new bytes and retained old bytes both count. Logical removal hides the current link but does not free retained quota or break historical references.
- Non-doctor manager may mutate permitted financial files but is denied clinical/mixed bytes. Ordinary doctor cannot obtain another doctor's financial content through file class or ZIP. Historical account cannot use download/export routes.
- Staff exports include only explicit permitted records/fields and authorized file content; revocation during a job prevents final delivery.
- Restore an old backup in isolation and replay later logical-removal/purge instructions before access. Verify retained finalized references remain recoverable and no deleted current link reappears.

## Hosting evidence and real-data gates

pilot-data-requirements.md records primary-source Mauritanian APD law signposts, EDPB territorial-scope guidance and Contabo public contract/location evidence with explicit limits. Germany VPS remains owner-reported; selected EU backup region is not confirmed Germany-only. Account-specific VPS/backup countries, executed DPA, subprocessors/support access and transfer arrangements remain unavailable. EU hosting alone neither proves Mauritanian outbound-transfer compliance nor automatically brings the non-EU clinic under GDPR.

Before any real patient data: qualified Mauritanian review must determine applicable health-data basis and APD declaration/exemption/authorization/outbound-transfer route; obtain necessary receipts/decisions and provider contract/location evidence; approve retention and patient rights/confidentiality/incident procedures; pass access/security/restore rehearsals and obtain explicit owner pilot authorization. No legal duration, adequacy list, certification or legal compliance claim is invented. See the evidence note for unreadable clauses, unverified amendments/procedures and source limitations. German/EU hosting choice is a planning direction, not deployment permission.

Owner approved upload conditions with clinic quota changed to 2 GB, removal/version/retention behavior, financial/mixed capability boundaries, CSV/JSON/ZIP exports and before-real-data hosting/legal gates. Independent planning review passed; see file-data-review.md. Implementation can later use fictional isolated data under separate authorization; no application implementation, purchase, regulator contact, deployment, live migration or patient-data use occurred.
