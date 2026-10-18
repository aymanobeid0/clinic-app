CREATE TABLE "PrescriptionCommand" ("clinicId" uuid NOT NULL,"commandId" uuid NOT NULL,"actorId" uuid NOT NULL,"payloadHash" text NOT NULL,"receipt" jsonb NOT NULL,PRIMARY KEY("clinicId","commandId"));
ALTER TABLE "PrescriptionCommand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrescriptionCommand" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "PrescriptionCommand" USING ("clinicId"::text = current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text = current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "PrescriptionCommand" TO clinic_runtime;
