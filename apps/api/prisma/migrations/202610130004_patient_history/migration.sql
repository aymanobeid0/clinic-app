CREATE TABLE "PatientHistory" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, "actorId" uuid NOT NULL,
 "commandId" uuid NOT NULL, "payloadHash" text NOT NULL, action text NOT NULL,
 at timestamptz NOT NULL, patient jsonb NOT NULL,
 UNIQUE("clinicId","commandId"),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id) ON DELETE RESTRICT,
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id) ON DELETE RESTRICT
);
CREATE INDEX patient_history_record ON "PatientHistory"("clinicId","patientId");
ALTER TABLE "PatientHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientHistory" FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_history_clinic ON "PatientHistory" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "PatientHistory" TO clinic_runtime;
