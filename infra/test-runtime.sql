-- Only for the dedicated disposable clinic_issue7 database.
DO $$ BEGIN
 IF current_database() <> 'clinic_issue7' THEN RAISE EXCEPTION 'Wrong test database'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clinic_runtime_test') THEN
  CREATE ROLE clinic_runtime_test LOGIN PASSWORD 'fictional-runtime-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT clinic_runtime TO clinic_runtime_test;
