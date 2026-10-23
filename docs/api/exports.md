# Authorized exports — issue #27

Backend/API acceptance only. Frontend logic #59, designed exports #73, shared authentication/navigation #60 and connected coverage #76 remain outstanding. No production migration, deployment or real-data authorization follows.

All routes use the existing authenticated cookie session and `Cache-Control: no-store`. POST requires same-origin + CSRF. There are no public object URLs, export fees or upload-quota charges.

## Transport

`POST /api/exports` accepts the strict `createExportSchema` / `ExportRequest` in `packages/contracts/src/exports.ts`. Every request includes a fresh UUID `commandId`.

| category | selection | format | content |
| --- | --- | --- | --- |
| patients | patientId | json / csv | patient personal summary and retained personal-history versions |
| clinical | patientId | json | minimal patient id/number/name; chart/history/note/prescription versions; clinical plan versions, visits, procedure starts/completions and authorized acceptance-file references, without financial plan prices |
| financial | patientId | json / csv | reconciled billing workspace, per-currency totals, attributable charges/allocations/credits/corrections, deposits, opening balances, receipts and authorized invoices |
| inventory | none | json / csv | item/supplier/batch references, exact receiving costs/currency, remaining/usable stock and immutable movements |
| attachments | patientId, classification, versions:[{id,revision}] | zip | selected authorized retained bytes plus manifest.json |

Returns HTTP201 `ExportReceipt`: `{id,status:'ready',expiresAt,mediaType,size,sha256}`. `size` is exact artifact bytes and `sha256` hashes the complete download. Duplicate commands with identical payload replay the same receipt while available; differing payloads conflict409. After expiry/cleanup use a new command ID; no permanent replay guarantee after artifact deletion.

`GET /api/exports/:id/content` delivers only to the same currently authorized account in the same clinic, with safe generated attachment filename and JSON/CSV/ZIP content type. The shared `ExportReceipt` describes the downloadable result, not a public URL.

JSON envelope: `{schemaVersion:1,generatedAt,category,data}`. Structured projections preserve IDs, revision/version metadata and relationship arrays. CSV is a UTF-8 BOM, CRLF, quoted `path,value` table: paths retain object fields and array indices (for example `data.charges[0].currency`). Exact money remains a string paired with explicit currency; currencies are never combined or converted. Embedded quotes are doubled and spreadsheet formula prefixes are neutralized with a leading apostrophe. Use JSON when reconstructing full types or empty collections.

ZIP uses stored ZIP32 entries at `attachments/<id>/<revision>`; original filename/mediaType/size/sha256/actor/time/class and relationship IDs appear in the manifest. Storage keys and credentials never enter the manifest. Every selected version is verified against its stored size/checksum before publication. An invalid, unavailable or unauthorized file fails the whole export; no partial bundle is published. Retry the same command after a transient failure.

## Authorization and revocation

Nonfinancial output capabilities remain configurable for managers. Patients need `exports.patients` + `patients.read`; inventory needs `exports.inventory` + `inventory.read`. Clinical output additionally needs current clinical patient scope, `clinical.read`, `clinical.history`, `clinical.download` and `exports.patients`; non-doctor managers are always denied. Clinical output includes minimal clinical identity, not reception contact fields. Doctor-managers still need active patient access.

Managers intrinsically have clinic-wide financial export authority. Other financial callers need `exports.financial` + `billing.read`; ordinary doctors are restricted to active patients and personally performed work. Mixed-doctor receipts/invoices are withheld when they cannot safely be separated, while attributable allocations and reconciled totals remain. Staff receive the same restricted financial fields as online billing; procedure/tooth references require their clinical scope. Managers retain the explicit billing-reference exception.

Clinical attachment output needs clinical history/download + current patient scope and patient export capability. Financial/mixed files also require financial export/read/download/history for nonmanagers. Opaque financial bytes are denied to ordinary doctors because their own-work scope cannot separate those bytes; staff additionally require clinical patient scope. Mixed files require both classes. Clinical plan references include mixed attachments only with the corresponding financial output/history rights. Historical-only and disabled accounts cannot create, replay, clean or download exports.

Generation runs under the existing account/clinic authorization lock, serializing permission/grant changes with source reads and publication. Delivery repeats current account/patient/category authorization and checks the generation authorization stamp, including patient-access revision. Revocation or changed grants/permissions invalidate the old artifact; it must be recreated. Artifact checksum is verified before delivery. Authorization linearizes at the final locked check; bytes already delivered cannot be recalled.

## Bounds, expiry and cleanup

Synchronous transactional generation deliberately rejects oversized requests: at most 1,000 source rows per owning module before loading history projections, at most 25 selected attachment versions / 25,000,000 attachment bytes, and 26,000,000 final artifact bytes. Oversize returns413; no artifact is committed. Histories over the supported source bound require a later separately authorized bulk/pagination capability; this implementation does not silently truncate them.

One API instance admits at most four concurrent create/content operations, retaining admission even if the client disconnects until work settles. Clinic locking makes capacity checks and writes atomic: at most20 live artifacts /100,000,000 temporary bytes per clinic; busy returns409/503 and can be retried. This operational capacity is separate from retained upload quota and is measured from actual stored artifact bytes.

Artifacts expire after15minutes. Before cleanup a download returns410; after deletion404. Successful new generation reclaims expired clinic artifacts; `POST /api/exports/cleanup` additionally returns `{deleted:number}` for expired artifacts in the authenticated clinic. The server independently sweeps at startup and every60seconds, so idle clinics are cleaned without another export. Sweep failures log a content-free operational error and retry next interval; downtime defers deletion until startup, while download expiry remains enforced.

The narrow `cleanup_expired_exports()` security-definer database function can only delete already-expired export rows, cannot return their contents, has a fixed search path and is executable only by the runtime role (PUBLIC revoked). The migration owner policy permits that bounded-purpose operation under FORCE RLS; runtime queries still use tenant RLS. New migrations are additive and must be applied through separately authorized deployment processes.
