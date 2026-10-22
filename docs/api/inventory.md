# Inventory receiving API — issue #24

Backend acceptance only. Frontend business logic #58, designed UI/French journeys #71, shared navigation #60 and connected coverage/scaffold retirement #76 remain outstanding. Consumption, waste and count corrections are implemented by #25 as documented below. Current availability includes those immutable movements. No patient relationship, procurement accounting, unit conversion or UI is introduced.

All paths are under `/api`; cookie sessions, ready active account, clinic scope, no-store responses and the existing same-origin/CSRF write protections apply. Historical-only accounts cannot use this module. Manager authority does not grant operational inventory capabilities. Responses are JSON with HTTP 200 on successful reads/writes, including replay. Errors use the existing `{error}` envelope: 400 invalid schema/required expiry/unenabled currency; 401 missing/revoked session; 403 missing permission or CSRF; 404 missing or foreign reference; 409 stale revision, reused command, duplicate lot or inactive reference. Unexpected database failures return sanitized 500 and roll back the complete command.

| Method/path | Permission | Request / response |
| --- | --- | --- |
| GET `/inventory` | `inventory.read` | `InventoryProjection` |
| GET `/inventory/receiving` | `inventory.read` | `{receipts: InventoryReceipt[]}` retained history, ascending receivedAt then ID |
| GET `/inventory/settings` | `inventory.read` | `InventorySettings` |
| GET `/inventory/events` | `inventory.read` | SSE minimal `invalidate` events; fetch authorized projection, heartbeat/recheck and closure on revocation/session expiry |
| POST `/inventory/items` | `inventory.receive` | `inventoryItemSchema` → `InventoryItem` |
| POST `/inventory/items/:id` | `inventory.receive` | `inventoryItemUpdateSchema` → `InventoryItem` |
| POST `/inventory/suppliers` | `inventory.receive` | `inventorySupplierSchema` → `InventorySupplier` |
| POST `/inventory/suppliers/:id` | `inventory.receive` | `inventorySupplierUpdateSchema` → `InventorySupplier` |
| POST `/inventory/receiving` | `inventory.receive` | `inventoryReceiveSchema` → immutable `InventoryReceipt` |
| POST `/inventory/settings` | manager authority | `inventorySettingsSchema` → `InventorySettings` |

Exported Zod inputs and transport types are in `packages/contracts/src/inventory.ts`, re-exported from `@clinic/contracts`. No Prisma models are browser contracts. UUID inputs normalize to lowercase. Unknown fields are rejected, including client clinic IDs and patient IDs. IDs are opaque; revision starts at 0 and increments on each edit. Updates require the current revision; reconcile after 409 with a new command UUID. Names trim whitespace, length 1–200; batch numbers trim whitespace, length 1–100, case-sensitive.

Item input: `{commandId,name,active,lowStockThreshold,expiryRequired}`; update adds `revision`. Supplier input: `{commandId,name,active}`; update adds `revision`. Settings input: `{commandId,revision,expiryWarningDays}`. Default settings: `{revision:0,expiryWarningDays:30}`; valid warning days 0–3650. Pack quantities and thresholds are integer numbers, threshold 0–1,000,000,000 and receipt quantity 1–1,000,000,000. A low-stock flag means available packs **less than or equal to** the item's threshold (including zero at threshold zero). Inactive items/suppliers remain listed and their stock/history remains visible; they cannot receive new stock. An item's expiry requirement may change only before its first receipt. Rename/deactivation never rewrites receipt names or supplier identity. No hard delete or receiving correction endpoint is provided.

Receiving input:

```json
{"commandId":"UUID","itemId":"UUID","supplierId":"UUID","batchNumber":"LOT-1","quantityPacks":3,"totalCostMinor":"1500","currency":"MRU","expiresOn":"2026-12-31"}
```

Cost is the **total** batch cost, an exact nonnegative integer minor-unit decimal string, maximum `999999999999999`, without leading zeros except `0`. It is not unit cost, accounts payable or a bill. Currency choices are exposed to inventory readers in `InventoryProjection.currencies`, without granting catalog or clinical access. Currency must be supported and manager-enabled through existing `/catalog/currencies`; precision follows that established currency reference (MRU/EUR/USD=2, JPY=0, KWD=3). For example `1500` MRU minor units means 15.00 MRU for the entire batch. No rounding/conversion. Missing, fractional, signed, exponential or oversized cost strings are invalid.

`expiresOn` is required as a nullable field. Non-null values are valid Gregorian `YYYY-MM-DD`, 1900-01-01 through 9999-12-31; timestamps and invalid leap dates are rejected. It must be non-null for an expiry-required item. Expiry is valid through **23:59:59.999 UTC on that date**; expired means strictly earlier than the projection's `asOfDate` (current UTC date). A batch expiring today is available and expiring. Warning includes unexpired dates from today through today + warning days inclusive; zero warns only for today. Null expiry never expires or warns. Already expired receiving is permitted for honest physical receiving history but contributes zero available packs. #25 must reuse these boundaries when blocking expired consumption. The server recomputes date classifications on every GET; consumers must refetch at UTC midnight as well as on SSE/reconnect. No scheduled midnight event is emitted.

`InventoryReceipt` includes opaque ID, item/supplier IDs and captured names, batch number, whole-pack quantity, exact cost/currency, nullable expiry, server receivedAt UTC timestamp and actor account ID. No patient data. `InventoryProjection` returns enabled currencies as `{code,precision}[]` (code ascending), asOfDate, settings, suppliers, items with availablePacks/lowStock, and batches with expired/expiring/availablePacks. Batches remain visible after expiry. Results currently return the full clinic inventory/history; no pagination or load benchmark is claimed.

All writes require `commandId` UUID, scoped to clinic across inventory operations. Same actor plus same normalized operation/path/payload replays the original receipt, even after a rename/deactivation. Reuse by a different actor or with a changed payload/path/operation conflicts 409. Authorization is checked before replay, so revoked permission cannot retrieve an old receipt. Concurrent identical commands commit once; distinct commands with the same exact item/supplier/batchNumber conflict rather than double-count. A receiving event represents one batch admission; repeat delivery of the same lot requires reconciliation rather than treating a retry as a second receipt. Independent batches may share a supplier batch number if their item or supplier differs.

One PostgreSQL transaction includes current account authorization, clinic inventory advisory lock, references/revisions, batch creation and immutable command receipt. Per-clinic serialization protects receiving versus deactivation/expiry-policy changes and coherent stock reads. Database clinic composite foreign keys, uniqueness/check constraints and forced RLS under restricted runtime role add isolation/integrity; batch and command tables grant no runtime update/delete. SSE publishes after commit only. No whole-host performance, Linux deployment, live migration, real-data or final product acceptance is claimed.

## Consumption and corrections — issue #25

Backend acceptance for #25 is separate from frontend logic #58, designed UI/French journeys #72, shared #60 and final coverage/scaffold retirement #76. No patient or treatment-visit link is accepted.

| Method/path | Permission | Request / response |
| --- | --- | --- |
| GET `/inventory/movements` | `inventory.read` | `{movements: InventoryMovement[]}` immutable non-receiving movements |
| POST `/inventory/consume` | `inventory.consume` | `inventoryConsumeSchema` → `InventoryMovement` |
| POST `/inventory/corrections` | `inventory.adjust` | `inventoryCorrectionSchema` → `InventoryMovement` |

Opening request: `{commandId,batchId,quantityPacks:1}`. Select the received batch explicitly; each request opens exactly one whole pack. Zero, negative, fractional, string or multiple-pack consumption is rejected (400). No patient assignment is required for operational inventory; manager authority alone does not grant read, consume or adjust permission. Receiving, reading, consuming and adjusting permissions are independent. A write-only actor receives their command result but cannot list stock/history without read permission. Historical-only and disabled accounts remain denied.

Waste/disposal request: `{commandId,batchId,revision,kind:"waste"|"disposal",quantityPacks,reason}`. Quantity is a positive whole-pack integer up to 1,000,000,000. Count request: `{commandId,batchId,revision,kind:"count",countedPacks,reason}` records the observed absolute whole-pack count (0–1,000,000,000), deriving a signed adjustment from current remaining stock. A same-count correction records a zero delta and its reason. Reasons trim whitespace, length 1–1000. Unknown fields (including clinic/patient/visit IDs) are rejected. Corrections require the current batch `stockRevision`; every accepted movement increments it, even a zero adjustment. A stale correction returns 409; refetch and reconcile using a new command ID. Overdrawn consumption/waste/disposal returns 409 without a movement. Missing/foreign batch returns 404.

`InventoryMovement` contains opaque id, batchId, kind, signed deltaPacks, resulting balancePacks, per-batch revision, nullable reason (null only for opening), occurredAt UTC and actorId. Movement history orders by occurredAt, then batchId, then revision; per-batch revision preserves order when timestamps tie. Original received quantity/cost/names remain immutable. Batch projections now add `remainingPacks` (received plus all signed movements, including expired stock) and `stockRevision` (initially zero). `availablePacks` equals remainingPacks for unexpired batches, zero for expired ones. Item totals/low-stock use current available packs. No stock value/cost reallocation is implied by a correction.

Consumption uses the same inclusive UTC expiry-day boundary as receiving: allowed on the expiry date, blocked starting the next UTC day. Null expiry remains consumable. Counts and disposal/waste can honestly record expired physical stock, but cannot make it available for use. Existing batches may still be consumed/corrected after reference deactivation; reference inactivity prevents new receiving, not disposal/history management.

The existing clinic-wide lock serializes receiving/reference changes, projections and movements. Authorization, current balance/expiry/revision checks, movement insertion and command receipt commit in one PostgreSQL transaction. Movement rows grant runtime SELECT/INSERT only, with forced RLS, clinic composite foreign keys, unique per-batch revisions and integer/sign/balance/reason checks. No update/delete endpoint or runtime grant exists. Command IDs share the inventory namespace; same normalized operation/payload/actor replays the original movement even after stock changes or expiry. Changed payload/operation or another actor conflicts 409; revoked permissions are checked before replay. Failed transactions leave no movement or command receipt; corrected retries may then succeed. SSE invalidates inventory after commit; existing midnight refetch rules apply.

Current full-history projections have no pagination or load benchmark. No UI/browser acceptance, deployment, production migration or real-data operation is claimed.
