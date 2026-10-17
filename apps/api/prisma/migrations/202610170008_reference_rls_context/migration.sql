DROP POLICY clinic_scope ON "MedicationReference";
CREATE POLICY clinic_scope ON "MedicationReference" USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
DROP POLICY clinic_scope ON "PrescriptionTemplate";
CREATE POLICY clinic_scope ON "PrescriptionTemplate" USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
