CREATE TABLE "ExportArtifact" (
 "id" uuid PRIMARY KEY,
 "clinicId" uuid NOT NULL REFERENCES "Clinic"("id"),
 "accountId" uuid NOT NULL,
 "request" jsonb NOT NULL,
 "requestHash" text NOT NULL,
 "stamp" text NOT NULL,
 "bytes" bytea NOT NULL,
 "mediaType" text NOT NULL,
 "sha256" text NOT NULL,
 "expiresAt" timestamptz NOT NULL,
 FOREIGN KEY ("clinicId", "accountId") REFERENCES "Account"("clinicId", "id")
);
CREATE INDEX "ExportArtifact_clinicId_expiresAt_idx" ON "ExportArtifact"("clinicId", "expiresAt");
ALTER TABLE "ExportArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportArtifact" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_isolation ON "ExportArtifact" USING ("clinicId" = nullif(current_setting('app.clinic_id', true), '')::uuid) WITH CHECK ("clinicId" = nullif(current_setting('app.clinic_id', true), '')::uuid);
GRANT SELECT, INSERT, DELETE ON "ExportArtifact" TO clinic_runtime;
