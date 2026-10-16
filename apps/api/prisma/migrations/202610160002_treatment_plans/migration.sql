CREATE TABLE "TreatmentPlanRevision" (id uuid PRIMARY KEY,"clinicId" uuid NOT NULL,"patientId" uuid NOT NULL,"planId" uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),"authorId" uuid NOT NULL,snapshot jsonb NOT NULL, UNIQUE("clinicId","patientId","planId",revision),FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),FOREIGN KEY("clinicId","authorId") REFERENCES "Account"("clinicId",id));
ALTER TABLE "TreatmentPlanRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlanRevision" FORCE ROW LEVEL SECURITY;
CREATE POLICY treatment_clinic ON "TreatmentPlanRevision" TO clinic_runtime USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "TreatmentPlanRevision" TO clinic_runtime;
