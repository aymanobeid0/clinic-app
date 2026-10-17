
CREATE TABLE "ProcedureCompletion" (id uuid PRIMARY KEY,"clinicId" uuid NOT NULL,"patientId" uuid NOT NULL,"planId" uuid NOT NULL,"itemId" uuid NOT NULL,"visitId" uuid NOT NULL,snapshot jsonb NOT NULL,UNIQUE("clinicId","planId","itemId"),FOREIGN KEY("clinicId","planId","itemId") REFERENCES "ProcedureStart"("clinicId","planId","itemId"),FOREIGN KEY("clinicId","visitId") REFERENCES "TreatmentVisit"("clinicId",id));
ALTER TABLE "ProcedureCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcedureCompletion" FORCE ROW LEVEL SECURITY;
CREATE POLICY completion_clinic ON "ProcedureCompletion" TO clinic_runtime USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "ProcedureCompletion" TO clinic_runtime;
