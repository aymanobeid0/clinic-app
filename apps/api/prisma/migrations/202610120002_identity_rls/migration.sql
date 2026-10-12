-- Capability role has no credentials. Operators create a separate non-owner LOGIN
-- and grant this role; migrations/provisioning use a separate owner connection.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clinic_runtime') THEN
    CREATE ROLE clinic_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO clinic_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON session TO clinic_runtime;
GRANT SELECT ON "Clinic" TO clinic_runtime;
GRANT SELECT, UPDATE ON "Account" TO clinic_runtime;
GRANT SELECT, INSERT, DELETE ON "RecoveryCode" TO clinic_runtime;
ALTER TABLE "Clinic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Clinic" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RecoveryCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecoveryCode" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_identity ON "Clinic" FOR SELECT TO clinic_runtime
  USING (id::text = current_setting('app.clinic_id', true) OR code = current_setting('app.clinic_code', true));
CREATE POLICY account_clinic ON "Account" TO clinic_runtime
  USING ("clinicId"::text = current_setting('app.clinic_id', true))
  WITH CHECK ("clinicId"::text = current_setting('app.clinic_id', true));
CREATE POLICY codes_clinic ON "RecoveryCode" TO clinic_runtime
  USING ("clinicId"::text = current_setting('app.clinic_id', true))
  WITH CHECK ("clinicId"::text = current_setting('app.clinic_id', true));
ALTER TABLE "Clinic" ADD CONSTRAINT clinic_code_format CHECK (code ~ '^[a-z0-9-]{3,32}$');
ALTER TABLE "Account" ADD CONSTRAINT username_format CHECK (username ~ '^[a-z0-9._-]{3,64}$');
