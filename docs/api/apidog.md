# Clinic API in Apidog

Import [openapi.json](openapi.json). It describes the implemented `/api` HTTP boundary, not an API redesign. The repository contracts and operation metadata are authoritative; regenerate/re-import when they change. No frontend or production documentation endpoint is added.

## Generate and validate

From the repository root with the pinned Node24 dependencies installed:

```powershell
npm run docs:api:generate
npm run docs:api:check
```

Generation uses existing Zod input schemas, shared response types and explicit HTTP operation descriptions. The documentation tool uses the installed TypeScript compiler for JSON transport types; unsupported/non-JSON response shapes fail generation rather than becoming an undocumented arbitrary object. Server refinements (permission, FDI, financial precision, accepted agreement, stock and temporal rules) are not fully expressible in JSON Schema and still apply. The artifact is generated; edit documentation source/contracts, then regenerate instead of editing its JSON.

## Import into Apidog

1. In the intended team/project choose **Import → OpenAPI/Swagger**, then select `docs/api/openapi.json`. A new project can also be created through Import Project. Review the parsed operations, schemas and local server before confirming.
2. Keep the existing domain tags/folders: identity, accounts/access, patients, scheduling, clinical, treatment/catalog, prescriptions, billing, inventory, attachments, reports/tasks and exports.
3. Create/select a **Local fictional data** environment. Use the following nonsecret configuration. The base includes `/api` once; the operation paths do not include it again.

| Setting | Local value |
| --- | --- |
| API base URL | `http://localhost:3000/api` |
| `appOrigin` | `http://localhost:4173` (must equal the server's configured `APP_ORIGIN`) |
| `csrfToken` | Empty until extracted from the current session |
| `managerEmail`, `managerPassword` | Your separately prepared fictional account; **local values only**, shared values empty |

Apidog supports [OpenAPI file/URL imports](https://docs.apidog.com/en/migrate-and-validate-your-api-data-2332468m0), [import conflict options and server environments](https://docs.apidog.com/en/import-options-633930m0). Its [variables guide](https://docs.apidog.com/using-variables-577908m0) distinguishes shared values from local values. Use local values for credentials/tokens, leave shared values empty and do not export local secrets. A temporary request-local variable is not the same as an environment variable's local value. CLI runs may use shared values instead of desktop local values; this task does not configure CLI secrets or CI.

No authenticated Apidog project destination was available during implementation. The deliverable is an import-ready validated file and these instructions, **not** a claim that your Apidog account was changed or an import observed. Review imported operations in your chosen project before treating that separate step as complete. No real patient data or captured production responses belong in the project.

## Cookie/CSRF handshake

The API uses the HttpOnly `clinic.sid` cookie. Do not configure Bearer/JWT authentication. Enable Apidog's normal [cookie management](https://docs.apidog.com/response-and-cookies-in-apidog-629648m0); let `Set-Cookie` replace the cookie on login/recovery. Use the same hostname throughout (`localhost` and `127.0.0.1` have different cookie jars).

1. Send `GET /session`. It requires no authenticated account and returns `{ "csrfToken": "…" }` plus the session cookie.
2. In **Post Processors → Extract Variable**, select Response JSON and JSONPath `$.csrfToken`, targeting the active environment's local `csrfToken` value. Apidog documents this in [Extract Variable](https://docs.apidog.com/en/extract-variable-588468m0). Confirm the local value changed and the shared value stayed empty.
3. For every POST, send `Origin: {{appOrigin}}` and `x-csrf-token: {{csrfToken}}`. The Origin is the configured application origin, not automatically the API base URL. Send JSON for ordinary commands; file uploads are the raw-body exception below.
4. Send `POST /sign-in` with one of the two request forms. These placeholders are substituted locally, never real credentials in shared examples:

```json
{
  "method": "email",
  "email": "{{managerEmail}}",
  "password": "{{managerPassword}}"
}
```

```json
{
  "method": "clinic_username",
  "clinicCode": "{{clinicCode}}",
  "username": "{{username}}",
  "password": "{{employeePassword}}"
}
```

5. Login regenerates both the cookie and CSRF token. Add the same response extraction to sign-in and successful code/email recovery; replace the old token before another write. Check `stage`, then `GET /identity`. `ready` is the normal operational stage; an authenticated setup session is not permission to read clinic records.
6. `POST /sign-out` requires Origin/CSRF too and returns 204 without JSON. Clear local tokens and the old cookie. Password changes/temporary-password replacement return204 and revoke sessions; begin a new session/login handshake. Account disablement/kind change and completed recovery can invalidate other sessions as well.

Sessions have a fixed 12-hour maximum from sign-in, without remember-me. Permission/patient-grant changes apply on the next request and terminate affected streams. Completing a login-email replacement revokes sessions; sign in using the newly verified address when identity returns 401. Recovery links expire after 30 minutes and email-verification links after 24 hours; expired/replaced/single-use tokens cannot be reused.

### Restricted activation and recovery

There is no public registration or test-verification route. Use the existing separately authorized operator provisioning flow and a fictional mail adapter/setup. The shipped server has no live mail provider: requests needing delivery may return 503; documentation does not introduce a bypass.

- `password`: POST the temporary-password replacement; its 204 destroys the session. GET `/session` and sign in again with the new password.
- `email`: request verification for the required address, consume the actual verification token through the authenticated CSRF POST and follow the returned setup state. For a primary manager, the provisioned email must be verified. Ordinary email replacement may return JSON null with 200, not a recovery-code batch.
- `codes`: safely retain the one-time batch locally, then confirm its `batchId` and `saved:true`. Do not capture the batch in shared Apidog examples/history. Recheck identity afterwards.
- Recovery requests do not revoke an account just by being requested. Consuming an expiring single-use recovery link/code rotates credentials/session and enters restricted setup; recovery never lifts disabled/historical-only status.

For repeatable proof without interactive mail/setup, the repository's existing HTTP tests inject fictional delivery in-process against the dedicated PostgreSQL database. They exercise the production application interface without adding a runtime backdoor.

## Exercise representative operations

Use an already activated fictional account with the relevant capabilities. Authorization is checked by the server on every read/write/replay, not by Apidog's folder visibility.

| Workflow | What to verify |
| --- | --- |
| Identity | Anonymous GET identity401; session/login token rotation; forged Origin/CSRF403; sign-out204; role/setup restrictions. |
| Patient | Registration201 with name/phone/contact kind, generated patient identity and duplicate warnings; search uses `q`, `archived`, `offset` in 50-result pages. Contact/archive commands require revisions; archived history remains retained. |
| Clinical | Doctor/staff capability plus active assignment/sharing; non-doctor manager403. Draft/finalization and corrections retain versions. Dynamic `{kind}` is history/chart; note/prescription `{action}` is draft/finalize, with the corresponding input schema. |
| Finance | Unstarted accepted treatment is planned, not due. Starting creates one charge. Preserve exact decimal input strings and currency-separated minor-unit response strings. Deposits, reused credit and new money remain distinct; invoices require completed/fully paid whole procedures. |
| Inventory | Whole-pack receiving/selected-batch consumption; expiry and stale-count conflicts. No fractional conversions or visit linkage. |
| Reports/tasks | UTC date activity versus current balances; authorized own-work totals; task revision conflicts and pending-note scope. Manual share prepares text and sends nothing. |
| Historical | Only an explicit removal grant exposes frozen clinical/own-work data. Later edits are excluded. Mutations and print/download/export denied; only permitted retained clinical file bytes may be viewed inline. |
| Exports | POST returns201 private receipt with size/checksum/expiry. GET content rechecks authorization. JSON/CSV/ZIP are file outputs; expiry 410 before cleanup,404 afterwards. Oversize returns 413 instead of truncation. |

Consequential commands that have `commandId` use a UUID in the body (attachment uploads use the query). After an uncertain response, retry the **same ID and identical payload**; do not regenerate the ID automatically in a preprocessor on every send. A changed payload/new action needs a new ID and current revisions. There is no generic `Idempotency-Key` header. Account/password/recovery operations have their own lifecycle and are not promised generic replay semantics.

For409, read current state/history and reconcile before a new command. A valid schema does not bypass permission, patient/clinic isolation, accepted-version, funds or stock checks.400 is validation,401 session/authentication,403 authority/CSRF,404 missing or invisible object,413 supported limit,429 throttling,500 sanitized unexpected failure,503 unavailable/busy dependency. Global and identity throttling return French JSON. Clients still handle non-JSON proxy/error responses without losing the HTTP status.

## Raw files, document data and streams

- Upload: POST `/patients/{patientId}/attachments` with query `commandId`, `classification`, `name`. Body is a selected **raw binary** PDF/JPEG/PNG with matching `Content-Type`; not multipart/form-data or base64 JSON. Replacement `/.../{attachmentId}/versions` also requires current `revision` and reason. File limit 20,000,000 bytes; retained clinic limit 2,000,000,000 bytes. Removal/replacement never evicts retained versions to free quota.
- Reads/removal/history need the correct `classification` query. Content output is inline/download/print under the separately checked content/output capability. Historical content has a separate route, no classification query, and permits only omitted/inline output. No public object URL is exposed.
- Plans, receipts, invoices, prescriptions and whole-plan summaries return **structured JSON print data**. Apidog does not turn that into the product's final French browser print layout or establish legal sufficiency. Invoices retain their original number/content and omit installment breakdown.
- SSE endpoints return `text/event-stream`; use the client's streaming view and stop the request when finished. Minimal invalidations are not records: refetch through the normal authorized GET. Sessions/permissions/grants are rechecked during streams. Apidog stream rendering was not separately observed; existing application tests verify stream behavior.

## Keep documentation current

Change the shared contract and actual server behavior through the normal authorized workflow; update the operation metadata/guide as needed, regenerate and run `npm run docs:api:check`. The check validates OpenAPI, references and exact route coverage and detects a stale generated artifact. Input schemas describe pre-transform wire data; refinements remain documented server rules. Response types describe authorized transport projections, never a license to retrieve another role's fields.

Re-import into the **same Apidog module/project** and review the method/path match preview. Choose merge/selected-field handling deliberately if preserving local descriptions/examples; avoid Keep Both unless duplicates are intentional. Review server/environment/auth mapping and remove obsolete operations deliberately. Do not automatically publish a docs site or add provider/API credentials for synchronization. Local file import works without exposing a remote specification URL.

Large histories are not universally paginated: inventory/report/history projections and bounded synchronous exports retain their actual limits. Load/production/native compatibility, live mail, provider/legal/retention, restore and pilot acceptance remain separate gates. See [backend acceptance](../planning/issue-51-backend-acceptance.md) and the existing per-feature API notes.

## French field guidance — #102

The implemented [error contract](errors.md) adds optional bounded `fields` for missing/invalid known inputs while retaining `error` and HTTP statuses. Correct the named fields; do not echo submitted values in examples or logs. A401 may mean an incorrect current-password confirmation rather than an expired session; a403 may mean a security check rather than missing business permission. Follow the actual returned cause and recovery instruction.

Export403 with `code:export_scope_changed` retires the old artifact and permits a new server-authorized generation; genuine permission refusal remains blocked. Unknown/5xx consequential outcomes retain exact-command retry semantics. Re-import the regenerated OpenAPI after owner-reviewed merge. This implemented section supersedes earlier planned wording for #102 only; other journey/UI work and the Apidog account remain unchanged.
