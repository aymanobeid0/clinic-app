CREATE TABLE "BillingEntry" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('charge','opening','adjustment')),
 "sourceId" uuid NOT NULL, "performedBy" uuid, currency text NOT NULL,
 "amountMinor" numeric(30,0) NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE("clinicId",kind,"sourceId"),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),
 FOREIGN KEY("clinicId",currency) REFERENCES "ClinicCurrency"("clinicId",code),
 FOREIGN KEY("clinicId","performedBy") REFERENCES "Account"("clinicId",id),
 CHECK(kind = 'adjustment' OR "amountMinor" >= 0)
);
CREATE INDEX billing_patient ON "BillingEntry"("clinicId","patientId");
CREATE TABLE "BillingCommand" (
 "clinicId" uuid NOT NULL,"commandId" uuid NOT NULL,"actorId" uuid NOT NULL,
 "payloadHash" text NOT NULL, receipt jsonb NOT NULL, PRIMARY KEY("clinicId","commandId")
);
ALTER TABLE "BillingEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "BillingEntry" USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
ALTER TABLE "BillingCommand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingCommand" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "BillingCommand" USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "BillingEntry","BillingCommand" TO clinic_runtime;

-- Existing retained starts are authoritative charge sources, never new care or payments.
-- Migration uses the operator role (as all existing migrations do).
INSERT INTO "BillingEntry"(id,"clinicId","patientId",kind,"sourceId","performedBy",currency,"amountMinor",snapshot)
SELECT id,"clinicId","patientId",'charge',id,(snapshot->>'performedBy')::uuid,
 snapshot->>'currency',(snapshot->>'agreedMinor')::numeric(30,0),snapshot FROM "ProcedureStart";
