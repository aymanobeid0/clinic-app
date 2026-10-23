// Fictional illustrative examples, not recorded requests or credentials.
const id = "11111111-1111-4111-8111-111111111111";
const at = "2026-10-23T12:00:00.000Z";
const token = "0".repeat(64);
export const examples: Record<
  string,
  { request?: unknown; response?: unknown }
> = {
  "get /session": { response: { csrfToken: token } },
  "post /sign-in": {
    request: {
      method: "email",
      email: "manager@example.invalid",
      password: "{{managerPassword}}",
    },
    response: { stage: "ready", csrfToken: token },
  },
  "get /clinic": {
    response: { name: "Clinique fictive", code: "fictional-clinic" },
  },
  "post /patients": {
    request: {
      commandId: id,
      name: "Patient fictif",
      phone: "70000000",
      contactKind: "patient",
      contactName: "",
    },
    response: {
      patient: {
        id,
        patientNumber: 1,
        name: "Patient fictif",
        phone: "70000000",
        contactKind: "patient",
        contactName: "",
        revision: 0,
        archived: false,
      },
      duplicateWarning: false,
      duplicates: [],
    },
  },
  "post /billing/{id}/opening-balances": {
    request: {
      commandId: id,
      id,
      currency: "MRU",
      amount: "100",
      provenance: "Registre fictif",
      asOf: at,
    },
    response: {
      id,
      currency: "MRU",
      amountMinor: "10000",
      provenance: "Registre fictif",
      asOf: at,
      actorId: id,
      at,
    },
  },
  "get /inventory/settings": {
    response: { revision: 0, expiryWarningDays: 30 },
  },
  "post /inventory/consume": {
    request: { commandId: id, batchId: id, quantityPacks: 1 },
    response: {
      id,
      batchId: id,
      kind: "consume",
      deltaPacks: -1,
      balancePacks: 4,
      revision: 1,
      reason: null,
      occurredAt: at,
      actorId: id,
    },
  },
  "get /historical": { response: [] },
  "post /exports": {
    request: {
      commandId: id,
      category: "patients",
      patientId: id,
      format: "json",
    },
    response: {
      id,
      status: "ready",
      expiresAt: "2026-10-23T12:15:00.000Z",
      mediaType: "application/json",
      size: 128,
      sha256: "0".repeat(64),
    },
  },
};
