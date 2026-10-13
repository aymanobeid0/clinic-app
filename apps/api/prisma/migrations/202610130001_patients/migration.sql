ALTER TABLE "Clinic" ADD COLUMN "nextPatientNumber" integer NOT NULL DEFAULT 0;
CREATE TABLE "Patient" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id),
 "patientNumber" integer NOT NULL CHECK ("patientNumber" > 0), "commandId" uuid NOT NULL,
 name text NOT NULL, phone text NOT NULL, "contactKind" text NOT NULL CHECK ("contactKind" IN ('patient','guardian')),
 "contactName" text NOT NULL, archived boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0,
 UNIQUE("clinicId","patientNumber"), UNIQUE("clinicId","commandId"), UNIQUE("clinicId",id)
);
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_clinic ON "Patient" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT,UPDATE ON "Patient" TO clinic_runtime;
GRANT UPDATE ("nextPatientNumber") ON "Clinic" TO clinic_runtime;
