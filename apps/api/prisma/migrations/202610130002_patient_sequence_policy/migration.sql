CREATE POLICY clinic_patient_sequence ON "Clinic" FOR UPDATE TO clinic_runtime
 USING (id::text=current_setting('app.clinic_id',true))
 WITH CHECK (id::text=current_setting('app.clinic_id',true));
