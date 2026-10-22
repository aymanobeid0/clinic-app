CREATE TABLE "InventoryMovement" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "batchId" uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('consume','waste','disposal','count')),
 "deltaPacks" integer NOT NULL CHECK("deltaPacks" BETWEEN -1000000000 AND 1000000000),
 "balancePacks" integer NOT NULL CHECK("balancePacks" BETWEEN 0 AND 1000000000),
 revision integer NOT NULL CHECK(revision > 0), reason text,
 "occurredAt" timestamptz NOT NULL, "actorId" uuid NOT NULL,
 CHECK ((kind='consume' AND "deltaPacks"=-1 AND reason IS NULL) OR
        (kind IN ('waste','disposal') AND "deltaPacks"<0 AND reason IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 1000) OR
        (kind='count' AND reason IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 1000)),
 UNIQUE("clinicId","batchId",revision),
 FOREIGN KEY("clinicId","batchId") REFERENCES "InventoryBatch"("clinicId",id),
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "InventoryMovement" USING ("clinicId"=nullif(current_setting('app.clinic_id',true),'')::uuid) WITH CHECK ("clinicId"=nullif(current_setting('app.clinic_id',true),'')::uuid);
GRANT SELECT,INSERT ON "InventoryMovement" TO clinic_runtime;
