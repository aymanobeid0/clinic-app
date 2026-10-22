CREATE TABLE "HistoricalRemoval" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, "accountId" uuid NOT NULL,
 cutoff timestamptz NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE("clinicId","patientId","accountId",id),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),
 FOREIGN KEY("clinicId","accountId") REFERENCES "Account"("clinicId",id)
);
CREATE TABLE "HistoricalGrant" (
 "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, "accountId" uuid NOT NULL, "removalId" uuid NOT NULL,
 PRIMARY KEY("clinicId","patientId","accountId"),
 FOREIGN KEY("clinicId","patientId","accountId","removalId") REFERENCES "HistoricalRemoval"("clinicId","patientId","accountId",id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['HistoricalRemoval','HistoricalGrant'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY clinic_scope ON %I USING ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid) WITH CHECK ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT, INSERT ON %I TO clinic_runtime',t);
 END LOOP;
END $$;
GRANT UPDATE, DELETE ON "HistoricalGrant" TO clinic_runtime;
