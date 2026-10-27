CREATE TABLE "ConsultationRevision" (
 "clinicId" uuid NOT NULL, id uuid NOT NULL, "patientId" uuid NOT NULL, "doctorId" uuid NOT NULL,
 revision integer NOT NULL CHECK (revision > 0), snapshot jsonb NOT NULL,
 PRIMARY KEY("clinicId",id,revision),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),
 FOREIGN KEY("clinicId","doctorId") REFERENCES "Account"("clinicId",id)
);
CREATE INDEX consultation_patient ON "ConsultationRevision"("clinicId","patientId");
CREATE TABLE "ConsultationSetting" (
 "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), key text NOT NULL,
 revision integer NOT NULL CHECK (revision > 0), snapshot jsonb NOT NULL,
 PRIMARY KEY("clinicId",key,revision)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ConsultationRevision','ConsultationSetting'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY clinic_scope ON %I USING ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid) WITH CHECK ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT, INSERT ON %I TO clinic_runtime',t);
 END LOOP;
END $$;
