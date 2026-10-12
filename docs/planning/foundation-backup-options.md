# Foundation backup options — issue #2

> Status reconciliation — 2026-10-11: statements below about open issues, uncommitted work, pending planning review or absent implementation describe the original document snapshot. Prerequisite evidence is now merged in PR #30, workflow retirement in PR #31, and owner-approved issues #2–#6 are closed. The initial #7 HTTP/session slice was published in draft PR #32; subsequent implementation status is recorded in the linked delivery status. See [current delivery status](delivery-status.md) for completed work and remaining gates. Approved product rules remain authoritative; later approved contracts supersede discovery proposals.

Date: 2026-10-10. Focused follow-up to [the infrastructure assessment](foundation-infrastructure-assessment.md), requested after the owner asked to evaluate Q2. This is research and a proposed decision, not implementation or purchase approval. No VPS inspection or restore measurements performed.

## Accepted planning direction

Owner decisions recorded and final planning understanding confirmed 2026-10-10: select continuous WAL/base backups with attachment backups every 30 minutes. Accept conditional retention of 7 days of recoverable points plus 4 weekly points, subject to measured size/cost and #6 policy. Warn at $4/month and obtain owner review before exceeding the additional $5/month budget; never silently stop backups at the budget threshold. Select Contabo S3 Object Storage EU/250 GB, subject to #6 approval and final cost/capability checks. B2/Hetzner below are evaluated alternatives, not the selected destination.

Use PostgreSQL base backups plus continuous WAL archiving, with encrypted, versioned attachment backups completed every 30 minutes. Keep 7 days of recoverable points and 4 weekly points only if measured retained size fits the additional $5/month budget and #6 approves region/retention. These are accepted planning choices, not measured guarantees.

The simpler half-hourly logical-dump alternative is credible for a small pilot, but accept it only after a rehearsal proves its complete joint backup and full restore fit the one-hour targets. Daily-only backup is insufficient. Neither storage provider buys replacement compute or a guaranteed one-hour recovery service.

## Database and attachment methods

| Method | Strength | Main cost or risk | Fit to requested targets |
| --- | --- | --- | --- |
| Base backups + continuous WAL; attachment versions every 30 minutes | Database point-in-time recovery; avoids repeatedly dumping the whole database | More operational complexity; complete base/WAL chain must survive; WAL volume and replay time vary | Preferred design for growth. Joint recovery still stops at a point whose attachment bytes exist off-host. |
| Logical dump + coordinated attachment backup every 30 minutes | Fewer database recovery components; logical dumps are portable across PostgreSQL versions | Repeated full dumps; restore rebuild work; only completed snapshots, no WAL replay/PITR | Conditional pilot option if measured lag and restore time pass. |

PostgreSQL documents base backups plus WAL replay as continuous archiving and PITR; logical dumps cannot participate in that chain. Physical recovery is server-version-specific. Sources: [continuous archiving](https://www.postgresql.org/docs/17/continuous-archiving.html), [SQL dump](https://www.postgresql.org/docs/17/backup-dump.html).

`pg_dump` captures a consistent database snapshot at its start while ordinary database operations continue. **Inference:** a dump begun at 10:00 and safely uploaded at 10:12 protects database state from 10:00, not 10:12. With starts every 30 minutes, joint completion must stay within the remaining RPO margin, including failed runs. Sources: [SQL dump](https://www.postgresql.org/docs/17/backup-dump.html).

**Design requirement for either method:** WAL/dumps do not include attachment files. Establish a recovery manifest that identifies database time/backup, attachment versions, checksums and necessary configuration. The implementation must coordinate upload publication, file mutation and deletion so every reference at that recovery point has recoverable bytes. Retain files needed by retained points; a filesystem copy performed at an unrelated time is insufficient. This is project reasoning, not a claim that a provider automatically coordinates application data.

## Destination comparison

### Selected destination — owner decision 2026-10-10

Final planning choices accepted 2026-10-10: Contabo S3 Object Storage in EU, subject to #6 hosting/data-handling approval; plan 250 GB initially with capacity alerts and manual owner approval for expansion. Final country/tax/currency quote remains a purchase gate against the additional USD 5/month budget. No automatic expansion or subscription is authorized. Keep the <=60-minute full replacement-host recovery target as a pilot acceptance gate. If rehearsal fails, return to the owner with measured options for transfer limits, recovery setup, budget or target; no silent target reduction.

Owner clarified Contabo **S3 Object Storage** and accepted same-provider risk for the pilot. VPS and backup storage share Contabo outage/account-access exposure; this is not provider-independent disaster recovery. Keep recovery keys outside Contabo as approved. EU/250 GB is the selected planning baseline; final country/tax-inclusive quote remains unverified and no purchase is authorized.

Contabo's [official Object Storage documentation](https://docs.contabo.com/docs/storage/object-storage/) checked 2026-10-10 documents EU/US Central/Singapore regions, 250 GB capacity increments, versioning, bucket policies and Object Lock (must be enabled at bucket creation). These are documented features, not tested compatibility with the eventual backup tool. Test private access, restricted writer permissions, encrypted recovery and deletion protection before pilot acceptance.

The documented default bandwidth is 10 MB/s (80 Mbit/s). Calculation: 20 GB takes about 33 minutes to transfer; 36 GB consumes an hour before compute provisioning, database recovery or verification. Thus the one-hour replacement-host target requires measured recoverable transfer size and end-to-end rehearsal; capacity purchased is not evidence of restore speed. Confirm effective limits with the selected account. Do not silently relax the target.

The [public product listing](https://contabo.com/en/object-storage/) observed during this comparison lists Europe at EUR 2.49/month per 250 GB and EUR 4.98 for 500 GB. Tax/currency and final account quote remain unverified against the USD 5 budget. Optional automatic capacity expansion must not be enabled without a budget decision; full-capacity alerts and owner escalation remain required.

| Destination | Verified evidence | Budget and operational conclusion |
| --- | --- | --- |
| Backblaze B2 | $6.95/TB/month; first 10 GB free; egress free up to 3× average monthly stored data, then $0.01/GB. A/B/C transactions free; D has separate charges. | Conservative storage-only estimates ignoring free allowance: 50 GB $0.35, 200 GB $1.39, 500 GB $3.48/month. These are all retained backups, not live data. Variable billing needs monitoring. |
| Hetzner Storage Box BX11 | 1 TB; Germany or Finland; SFTP/Restic/Borg options; unlimited traffic; snapshots and restricted subaccounts. | Fixed capacity is attractive if the actual country/tax quote fits $5. The public page fetched here still omits its numeric price; do not substitute unofficial prices. |

Sources checked today: [B2 pricing](https://www.backblaze.com/cloud-storage/pricing), [Storage Box product](https://www.hetzner.com/storage/storage-box/). Estimates exclude tax, other traffic, recovery compute and exceptional API usage; rates must be checked before purchase. At $6.95/TB, $5 buys roughly 719 GB before free allowance and other charges; **calculation**, not a spending cap.

B2 offers an EU region in Amsterdam; region is selected when creating the account, and changing region involves another account/data transfer. Source: [B2 regions](https://www.backblaze.com/docs/cloud-storage-data-regions). Region choice remains a #6 owner decision; “EU” alone is not a data-handling approval.

Hetzner says snapshots reside on the same Storage Box and consume its capacity; host bandwidth is shared and varies. Its product page says data is not mirrored to other servers. Therefore treat its snapshots as an additional local recovery layer, not a second independent destination. Sources: [Storage Box overview](https://docs.hetzner.com/storage/storage-box/general/), [product](https://www.hetzner.com/storage/storage-box/). A backup repository can hold many recovery points independently of the product's native snapshot-slot count; tooling/retention must still be verified.

## Recovery access and deletion protection

Owner accepted an owner-held password manager plus a separate recovery copy on 2026-10-10. Proposed contents: provider account/MFA recovery material, backup decryption keys, read/recovery access, pinned deployment configuration and a tested runbook, all recoverable outside the failed VPS. Do not put secrets in issues or this repository. Verify owner access from a clean machine before acceptance; the arrangement is approved, the recovery test is unperformed.

B2 application keys can be restricted by bucket, prefix and capabilities; use a restricted backup credential on the VPS and separate administrative/deletion control. Explicitly test tool compatibility and version recovery: omission of permanent-delete capability alone is not a complete retention design. Source: [application keys](https://www.backblaze.com/docs/en/cloud-storage-application-keys). Hetzner subaccounts restrict directories, but read-only prevents uploads as well as deletions; it is not an append-only writer. Source: [Storage Box overview](https://docs.hetzner.com/storage/storage-box/general/). Encryption/versioning/deletion protection remain implementation acceptance checks.

## Measurements and remaining decisions

No backup duration, restore throughput, WAL growth, compression/deduplication ratio or recovery-access test is measured. Retention cannot be costed from the live database size alone. Issue #28 must rehearse total replacement-host recovery with fictional data: obtain compute/access, restore configuration/keys, download, replay/rebuild, verify database-file consistency and isolation, then route traffic. Transfer alone for 20 GB at 100 Mbit/s takes about 27 minutes; **illustrative calculation**, excluding overhead and restore work.

Remaining destination evidence and gates (planning choices settled):

- Verify final 250 GB EU quote, supported backup access, encryption/version recovery, deletion protection and capacity monitoring. No subscription authorized.
- Obtain #6 hosting/retention approval and prove end-to-end recovery. Same-provider risk, method and conditional retention are accepted as recorded above.

Host evidence may remain unavailable during planning by owner decision, with deployment gated on obtaining it. This does not establish backup capacity or recovery performance.

Keep issue #2 open until prerequisite decisions and current acceptance criteria are satisfied. Record targets as pending proof; do not lower them silently if rehearsal fails.
