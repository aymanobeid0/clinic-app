CREATE TABLE "PatientAccessState" (
 "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, revision integer NOT NULL DEFAULT 0,
 PRIMARY KEY("clinicId","patientId"),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id) ON DELETE RESTRICT
);
CREATE TABLE "PatientGrant" (
 "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, "accountId" uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('assigned','shared')), active boolean NOT NULL DEFAULT true,
 PRIMARY KEY("clinicId","patientId","accountId"),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id) ON DELETE RESTRICT,
 FOREIGN KEY("clinicId","accountId") REFERENCES "Account"("clinicId",id) ON DELETE RESTRICT
);
CREATE TABLE "PatientAccessHistory" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, "actorId" uuid NOT NULL,
 "accountId" uuid NOT NULL, "commandId" uuid NOT NULL, "payloadHash" text NOT NULL,
 action text NOT NULL, at timestamptz NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE("clinicId","commandId"),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id) ON DELETE RESTRICT,
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id) ON DELETE RESTRICT,
 FOREIGN KEY("clinicId","accountId") REFERENCES "Account"("clinicId",id) ON DELETE RESTRICT
);
CREATE INDEX patient_access_history_record ON "PatientAccessHistory"("clinicId","patientId");
ALTER TABLE "PatientAccessState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientAccessState" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PatientGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientGrant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PatientAccessHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientAccessHistory" FORCE ROW LEVEL SECURITY;
CREATE POLICY access_state_clinic ON "PatientAccessState" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
CREATE POLICY patient_grant_clinic ON "PatientGrant" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
CREATE POLICY access_history_clinic ON "PatientAccessHistory" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT,UPDATE ON "PatientAccessState","PatientGrant" TO clinic_runtime;
GRANT SELECT,INSERT ON "PatientAccessHistory" TO clinic_runtime;
