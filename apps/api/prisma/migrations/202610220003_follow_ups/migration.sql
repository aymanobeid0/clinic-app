CREATE TABLE "FollowUpEvent" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "taskId" uuid NOT NULL, "patientId" uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0), "actorId" uuid NOT NULL, "commandId" uuid NOT NULL,
 "payloadHash" text NOT NULL, at timestamptz NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE("clinicId","commandId"), UNIQUE("clinicId","taskId",revision),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id),
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
CREATE INDEX "FollowUpEvent_clinicId_patientId_idx" ON "FollowUpEvent"("clinicId","patientId");
ALTER TABLE "FollowUpEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowUpEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "FollowUpEvent" USING ("clinicId"=nullif(current_setting('app.clinic_id',true),'')::uuid) WITH CHECK ("clinicId"=nullif(current_setting('app.clinic_id',true),'')::uuid);
GRANT SELECT,INSERT ON "FollowUpEvent" TO clinic_runtime;
