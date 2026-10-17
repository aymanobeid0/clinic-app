ALTER TABLE "ClinicalRevision" DROP CONSTRAINT "ClinicalRevision_kind_check";
ALTER TABLE "ClinicalRevision" ADD CONSTRAINT "ClinicalRevision_kind_check" CHECK (kind IN ('history','chart') OR kind ~ '^(note|prescription):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
