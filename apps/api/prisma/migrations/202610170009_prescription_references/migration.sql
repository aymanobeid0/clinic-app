ALTER TABLE "MedicationReference" ADD FOREIGN KEY("clinicId") REFERENCES "Clinic"(id);
ALTER TABLE "PrescriptionTemplate" ADD FOREIGN KEY("clinicId") REFERENCES "Clinic"(id);
ALTER TABLE "PrescriptionCommand" ADD FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id);
ALTER TABLE "ProcedureCompletion" ADD CONSTRAINT "ProcedureCompletion_clinic_patient_id_key" UNIQUE("clinicId","patientId",id);
ALTER TABLE "ChartSuggestionDecision" ADD FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id);
ALTER TABLE "ChartSuggestionDecision" ADD FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id);
ALTER TABLE "ChartSuggestionDecision" ADD FOREIGN KEY("clinicId","patientId","completionId") REFERENCES "ProcedureCompletion"("clinicId","patientId",id);
