-- Dedicated persistent fictional local development database only.
DO $$ BEGIN
 IF current_database() <> 'clinic_dev' OR current_user <> 'clinic_dev_owner' THEN RAISE EXCEPTION 'Dedicated development owner required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_dev_runtime') THEN
  CREATE ROLE clinic_dev_runtime LOGIN PASSWORD 'local-fictional-runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT clinic_runtime TO clinic_dev_runtime;
