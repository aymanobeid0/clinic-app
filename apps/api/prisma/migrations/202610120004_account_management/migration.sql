ALTER TABLE "Account" ADD COLUMN kind text NOT NULL DEFAULT 'staff' CHECK (kind IN ('staff','doctor')),
 ADD COLUMN permissions text[] NOT NULL DEFAULT '{}', ADD COLUMN "contactEmail" text,
 ADD COLUMN phone text, ADD COLUMN "historicalOnly" boolean NOT NULL DEFAULT false,
 ADD COLUMN "recoverySetup" boolean NOT NULL DEFAULT false, ADD COLUMN "recoveryHash" text, ADD COLUMN "recoveryExpiresAt" timestamptz;
CREATE TABLE "ReservedUsername" (id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), "accountId" uuid NOT NULL, username text NOT NULL, UNIQUE("clinicId",username), FOREIGN KEY("clinicId","accountId") REFERENCES "Account"("clinicId",id));
INSERT INTO "ReservedUsername" SELECT gen_random_uuid(), "clinicId", id, username FROM "Account";
ALTER TABLE "ReservedUsername" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReservedUsername" FORCE ROW LEVEL SECURITY;
CREATE POLICY reserved_clinic ON "ReservedUsername" TO clinic_runtime USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK ("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT, INSERT ON "ReservedUsername" TO clinic_runtime;
GRANT INSERT ON "Account" TO clinic_runtime;
