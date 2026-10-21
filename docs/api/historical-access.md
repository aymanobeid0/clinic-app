# Historical access — issue #18

Backend contract only. Frontend logic remains #54/#57, designed history #75, shared navigation #60, connected coverage/scaffold retirement #76. No product UI is implemented here.

All requests use the existing cookie session, fixed 12-hour session expiry, clinic isolation and no-store responses. Writes require Origin and session CSRF headers. UUIDs identify existing clinic-local records. Historical-only doctor accounts can sign in after normal setup; disabled/unready/non-doctor accounts cannot read snapshots. Ordinary active-care endpoints keep their existing permissions and never become historical endpoints.

## Removal and explicit manager grants

`POST /api/patient-access/:patientId/remove` retains its `{commandId, revision, accountId}` contract. Removing a doctor atomically retains then-available patient identity, clinical revisions, clinical plan/visit/performed-care projections, own-work financial state/invoices and permitted attachment versions. This uses the existing clinic transaction lock shared by authorized writes; a concurrent change commits entirely before or after removal. Times of user-entered observations do not determine availability. The snapshot is captured from committed state during removal, so backdated entries and later edits cannot enter it. Removal does not itself grant historical access.

`GET /api/patient-access/:patientId/history` now includes each event's `id`; clients select the current doctor's removal event rather than supplying a timestamp.

`POST /api/patient-access/:patientId/historical` accepts exactly:

```json
{"commandId":"uuid","revision":2,"accountId":"uuid","removalId":"uuid"}
```

Only a ready active manager may grant historical access. The target must be a doctor without active access, and `removalId` must refer to that doctor's latest current removal with a retained snapshot. The response is the existing `PatientAccess` receipt with incremented patient access revision. Arbitrary cutoffs and cross-patient/clinic removals are rejected. Unchanged command retries return their prior receipt; reuse with different payload/actor and stale revisions return 409. Replaying a pre-revocation grant command never reactivates access.

`POST /api/patient-access/:patientId/revoke` accepts exactly `{commandId, revision, accountId}` and is manager-only. It removes both active and historical access for that patient/account. Reassignment clears any historical grant. Every subsequent removal requires a new explicit grant to its new removal ID. Grant/revoke/share/remove publish an unscoped clinic invalidation after commit.

Legacy removals predating this migration have no trustworthy captured mutable visit state. They cannot be retroactively granted from current records: grant returns 409. There is no guessed backfill or automatic reassignment. A separately authorized real care/reassignment/removal cycle can establish a new cutoff. Captured snapshots remain retained after revocation, with no ordinary purge endpoint.

## Read-only delivery

- `GET /api/historical` returns only the caller's granted `{id, patientNumber, name, cutoff}` summaries from retained identity.
- `GET /api/historical/:patientId` returns `HistoricalSnapshot` from `@clinic/contracts`. Its clinical array groups immutable versions by `kind` (`history`, `chart`, `note:<visitId>`, `prescription:<id>`). Plan versions retain clinical notes/authorship/acceptance/cancellation and item descriptions; amounts, totals, discounts and financial extras are excluded. Performed-care starts retain attribution and links without agreed prices. Visit state and all descriptive names are frozen.
- `financial` uses the existing own-performed-work billing projection at removal. Own-work allocations, balances, adjustments and permitted corrections remain exact minor-unit strings by currency. Other doctors' finances, mixed receipts, unassigned deposits/opening balances and clinic-wide totals are excluded. `invoices` contains only invoices whose every item belongs to the caller. Later reversals/refunds/credits cannot change the frozen response. This grants no financial write/output authority.
- `attachments` contains retained clinical version descriptors available at removal, including versions needed by history. Financial/mixed opaque files are denied because their content cannot safely be separated for own-work scope. Plan evidence references survive only when the referenced clinical version is in that manifest. No storage keys, usage totals or later metadata are returned.
- `GET /api/historical/:patientId/attachments/:attachmentId/versions/:revision/content` delivers only a permitted retained clinical version inline after checksum verification. Optional `output=inline` is accepted; `print`/`download` return 403. Missing retained bytes return 503; an unauthorized/later version returns 404. Slow responses recheck session/grant on clinic invalidation and at most one-second intervals and terminate on loss of access. Already-delivered bytes/browser capture cannot be recalled or prevented.
- `GET /api/historical/:patientId/events` uses existing authorized SSE. Events contain no patient content. Each invalidation/heartbeat rechecks the session and historical grant; revocation/account restrictions terminate the stream. Reconnect performs ordinary authorization again.

401 means no valid current session/account; 403 means denied role/grant/output; 404 means an unavailable scoped record/version; 400 means invalid transport input; 409 means stale/conflicting command or unavailable current removal snapshot. Full revocation, disablement, account-kind/session changes take effect on subsequent direct requests. Historical-only mode overrides manager financial/operational authority. Recovery/reassignment never lifts account restrictions.

No historical mutation, application print/download/export API exists. Readable JSON is an online view contract, not an export permission. Active managers retain the existing approved current clinic-wide financial authority until their account is explicitly restricted; the historical endpoint itself always projects only the requesting doctor's own cutoff snapshot.

Verification and limitations: [implementation record](../planning/issue-18-implementation.md), [independent review](../planning/issue-18-review.md). No production migration, real data, live mail, deployment or browser product-UI acceptance is claimed.
