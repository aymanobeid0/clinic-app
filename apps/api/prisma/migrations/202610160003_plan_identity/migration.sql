CREATE TABLE "TreatmentPlanIdentity" ("clinicId" uuid NOT NULL,"planId" uuid NOT NULL,"patientId" uuid NOT NULL,PRIMARY KEY("clinicId","planId"),UNIQUE("clinicId","patientId","planId"),FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id));
INSERT INTO "TreatmentPlanIdentity" SELECT DISTINCT "clinicId","planId","patientId" FROM "TreatmentPlanRevision";
ALTER TABLE "TreatmentPlanRevision" ADD FOREIGN KEY("clinicId","patientId","planId") REFERENCES "TreatmentPlanIdentity"("clinicId","patientId","planId");
ALTER TABLE "TreatmentPlanIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlanIdentity" FORCE ROW LEVEL SECURITY;
CREATE POLICY treatment_clinic ON "TreatmentPlanIdentity" TO clinic_runtime USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "TreatmentPlanIdentity" TO clinic_runtime;
