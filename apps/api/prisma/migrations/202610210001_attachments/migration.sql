CREATE TABLE "Attachment" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), "patientId" uuid NOT NULL,
 classification text NOT NULL CHECK (classification IN ('clinical','financial','mixed')),
 revision integer NOT NULL CHECK(revision > 0), removed boolean NOT NULL DEFAULT false, events jsonb NOT NULL,
 UNIQUE("clinicId","patientId",id),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id)
);
CREATE INDEX ON "Attachment"("clinicId","patientId");
CREATE TABLE "AttachmentVersion" (
 key uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "patientId" uuid NOT NULL, "attachmentId" uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0), size integer NOT NULL CHECK(size BETWEEN 1 AND 20000000), snapshot jsonb NOT NULL,
 UNIQUE("clinicId","attachmentId",revision),
 FOREIGN KEY("clinicId","patientId","attachmentId") REFERENCES "Attachment"("clinicId","patientId",id)
);
CREATE INDEX ON "AttachmentVersion"("clinicId","patientId");
CREATE TABLE "AttachmentReservation" (
 key uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), "patientId" uuid NOT NULL,
 "commandId" uuid NOT NULL, "actorId" uuid NOT NULL, "payloadHash" text NOT NULL,
 size integer NOT NULL CHECK(size BETWEEN 1 AND 20000000), "expiresAt" timestamptz NOT NULL,
 UNIQUE("clinicId","commandId"),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id)
);
CREATE TABLE "AttachmentCommand" (
 "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), "commandId" uuid NOT NULL, "actorId" uuid NOT NULL,
 "payloadHash" text NOT NULL, receipt jsonb NOT NULL, PRIMARY KEY("clinicId","commandId")
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Attachment','AttachmentVersion','AttachmentReservation','AttachmentCommand'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY clinic_scope ON %I USING ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid) WITH CHECK ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT, INSERT ON %I TO clinic_runtime',t);
 END LOOP;
END $$;
GRANT UPDATE ON "Attachment" TO clinic_runtime;
GRANT DELETE ON "AttachmentReservation" TO clinic_runtime;
