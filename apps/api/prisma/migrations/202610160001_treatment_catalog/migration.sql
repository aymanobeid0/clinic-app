CREATE TABLE "ClinicCurrency" ("clinicId" uuid NOT NULL REFERENCES "Clinic"(id), code text NOT NULL, precision integer NOT NULL CHECK(precision BETWEEN 0 AND 3), PRIMARY KEY("clinicId",code));
CREATE TABLE "CatalogProcedure" (id uuid PRIMARY KEY,"clinicId" uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),name text NOT NULL,currency text NOT NULL,"priceMinor" bigint NOT NULL CHECK("priceMinor">=0),"durationMinutes" integer NOT NULL CHECK("durationMinutes" BETWEEN 5 AND 480),active boolean NOT NULL,UNIQUE("clinicId",id),FOREIGN KEY("clinicId",currency) REFERENCES "ClinicCurrency"("clinicId",code));
CREATE TABLE "TreatmentCommand" ("clinicId" uuid NOT NULL,"commandId" uuid NOT NULL,"actorId" uuid NOT NULL,"payloadHash" text NOT NULL,receipt jsonb NOT NULL,PRIMARY KEY("clinicId","commandId"),FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['ClinicCurrency','CatalogProcedure','TreatmentCommand'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY treatment_clinic ON %I TO clinic_runtime USING ("clinicId"::text=current_setting(''app.clinic_id'',true)) WITH CHECK ("clinicId"::text=current_setting(''app.clinic_id'',true))',t);
 END LOOP; END $$;
GRANT SELECT,INSERT ON "ClinicCurrency","TreatmentCommand" TO clinic_runtime;
GRANT SELECT,INSERT,UPDATE ON "CatalogProcedure" TO clinic_runtime;
