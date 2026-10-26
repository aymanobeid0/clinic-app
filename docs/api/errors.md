# French error guidance (#102)

The API retains HTTP statuses and the required French `error` string. Validation failures may additionally return `fields`, a map of known contract field paths to safe French guidance:

```json
{
  "error": "Vérifiez les champs saisis.",
  "fields": {
    "username": "Ce champ est obligatoire.",
    "temporaryPassword": "Saisissez au moins 12 caractères."
  }
}
```

Paths use dot notation and zero-based array indices, e.g. `items.0.amount`. At most 20 known paths are returned (160 characters per path, 256 per message). Submitted values, arbitrary property names, raw validator messages, SQL and secrets are never included. Unknown/ambiguous union or request-level failures retain the summary; supported discriminator branches identify their actual fields. Custom cross-field rules receive safe guidance on an explicitly known path; their internal rule text is not serialized. Domain rules and schema limits are unchanged.

The browser retains these fields in its HTTP error and maps them into the affected RHF form where applicable, with a French field-naming summary for other consumers. Existing forms report all invalid native-required fields in French and display resolver feedback; valid non-secret input remains in current-tab memory. Login failure preserves identifiers and deliberately clears the password. Account/scope retirement and actual access denial still clear confidential state. Nothing is persisted to browser storage.

Read the returned cause rather than assigning one from the status alone:

| Condition | Guidance / recovery |
| --- | --- |
| Missing/invalid field, 400 | Correct the named fields; native/resolver checks run before transport. |
| Malformed JSON, 400 | Correct the request format. |
| Oversized JSON, 413 | Reduce the request content; file and export bounds are separate. |
| Missing/invalidated session, 401 | Reconnect. Invalid login credentials and incorrect current-password confirmation have distinct messages; not every401 means session expiry. |
| Business permission refusal, 403 | The action requires authority the caller does not have; do not bypass it. |
| Origin/site/CSRF failure, 403 | Refresh the security context before an explicit retry; do not automatically replay a consequential write. |
| Incomplete setup / historical-only state, 403 | Complete setup / respect the historical read-only action boundary. |
| Stale revision, 409 | Refresh current state, review the retained input and explicitly reconfirm. Stock, expiry and financial prerequisite failures retain their own business reason. |
| Missing or concealed object, 404 | Remain neutral; the response does not reveal another clinic/patient's record. |
| Expired export, 410 or404 after cleanup | Generate a new artifact. |
| Rate limit, 429 | Global and identity limiters return French JSON; wait and respect retry metadata. |
| Unexpected failure, 500 | The result cannot be confirmed. Read current state and use the existing exact-command retry path when outcome is uncertain. |

Export authorization-stamp mismatch alone additionally returns `code:"export_scope_changed"` with403. The old receipt is retired and generation can be requested again through current server authorization. Genuine denial continues to lock the consumer. This is the sole new machine discriminator; clients must not compare translated strings to decide authorization or unlock every403.

Clients handle non-JSON error bodies without losing the HTTP status. When no structured cause is available, guidance stays neutral rather than asserting a particular permission/session failure. Network/5xx/unreadable successful-write outcomes retain the identical consequential command ID/payload; never generate a new ID automatically to escape uncertainty. A successful status does not authorize cross-scope data retention.

See [OpenAPI](openapi.json) and [implementation evidence](../planning/issue-102-implementation.md). No hosted Apidog changes, production operation or final designed UI acceptance follows from this contract.
