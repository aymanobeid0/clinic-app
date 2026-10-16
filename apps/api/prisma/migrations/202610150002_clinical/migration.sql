CREATE TABLE "ClinicalRevision" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('history','chart')), revision integer NOT NULL CHECK(revision>0),
 "commandId" uuid NOT NULL, "actorId" uuid NOT NULL, "payloadHash" text NOT NULL,
 at timestamptz NOT NULL, snapshot jsonb NOT NULL, receipt jsonb NOT NULL,
 UNIQUE("clinicId","commandId"), UNIQUE("clinicId","patientId",kind,revision),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
CREATE INDEX clinical_record_date ON "ClinicalRevision"("clinicId","patientId",at);
ALTER TABLE "ClinicalRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClinicalRevision" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinical_clinic ON "ClinicalRevision" TO clinic_runtime
 USING("clinicId"::text=current_setting('app.clinic_id',true))
 WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "ClinicalRevision" TO clinic_runtime;
