-- The migration owner already controls this table and its policies. Its explicit
-- policy lets the narrowly scoped definer function work with FORCE RLS; runtime
-- queries keep their ordinary tenant policy and cannot assume the owner role.
DO $$ BEGIN
 EXECUTE format('CREATE POLICY export_cleanup_owner ON public."ExportArtifact" TO %I USING (true) WITH CHECK (true)', current_user);
END $$;
CREATE FUNCTION public.cleanup_expired_exports() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE deleted integer;
BEGIN
 DELETE FROM public."ExportArtifact" WHERE "expiresAt" <= clock_timestamp();
 GET DIAGNOSTICS deleted = ROW_COUNT;
 RETURN deleted;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_expired_exports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_exports() TO clinic_runtime;
