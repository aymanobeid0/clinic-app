CREATE TABLE "MedicationReference" ("id" uuid PRIMARY KEY,"clinicId" uuid NOT NULL,"revision" integer NOT NULL,"name" text NOT NULL,"strength" text NOT NULL,"form" text NOT NULL,"active" boolean NOT NULL, UNIQUE("clinicId","id"));
CREATE TABLE "PrescriptionTemplate" ("clinicId" uuid PRIMARY KEY,"revision" integer NOT NULL,"header" text NOT NULL,"footer" text NOT NULL);
ALTER TABLE "MedicationReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicationReference" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "MedicationReference" USING ("clinicId" = current_setting('app.clinic_id',true)::uuid) WITH CHECK ("clinicId" = current_setting('app.clinic_id',true)::uuid);
ALTER TABLE "PrescriptionTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrescriptionTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "PrescriptionTemplate" USING ("clinicId" = current_setting('app.clinic_id',true)::uuid) WITH CHECK ("clinicId" = current_setting('app.clinic_id',true)::uuid);
GRANT SELECT,INSERT,UPDATE ON "MedicationReference","PrescriptionTemplate" TO clinic_runtime;
