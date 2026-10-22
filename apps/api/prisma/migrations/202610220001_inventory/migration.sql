CREATE TABLE "InventoryItem" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 name text NOT NULL CHECK(length(name)>0), active boolean NOT NULL, "lowStockThreshold" integer NOT NULL CHECK("lowStockThreshold" BETWEEN 0 AND 1000000000), "expiryRequired" boolean NOT NULL,
 UNIQUE("clinicId",id)
);
CREATE TABLE "InventorySupplier" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), name text NOT NULL CHECK(length(name)>0), active boolean NOT NULL, UNIQUE("clinicId",id)
);
CREATE TABLE "InventorySettings" (
 "clinicId" uuid PRIMARY KEY REFERENCES "Clinic"(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), "expiryWarningDays" integer NOT NULL DEFAULT 30 CHECK("expiryWarningDays" BETWEEN 0 AND 3650)
);
CREATE TABLE "InventoryBatch" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL, "itemId" uuid NOT NULL, "supplierId" uuid NOT NULL,
 "itemName" text NOT NULL, "supplierName" text NOT NULL, "batchNumber" text NOT NULL,
 "quantityPacks" integer NOT NULL CHECK("quantityPacks" BETWEEN 1 AND 1000000000), "totalCostMinor" bigint NOT NULL CHECK("totalCostMinor" BETWEEN 0 AND 999999999999999), currency text NOT NULL CHECK(currency IN ('MRU','EUR','USD','JPY','KWD')),
 "expiresOn" text CHECK("expiresOn" IS NULL OR ("expiresOn" ~ '^\d{4}-\d{2}-\d{2}$' AND "expiresOn"::date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31')),
 "receivedAt" timestamptz NOT NULL, "actorId" uuid NOT NULL,
 UNIQUE("clinicId",id), UNIQUE("clinicId","itemId","supplierId","batchNumber"),
 FOREIGN KEY("clinicId","itemId") REFERENCES "InventoryItem"("clinicId",id),
 FOREIGN KEY("clinicId","supplierId") REFERENCES "InventorySupplier"("clinicId",id),
 FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
CREATE TABLE "InventoryCommand" (
 "clinicId" uuid NOT NULL, "commandId" uuid NOT NULL, "actorId" uuid NOT NULL, "payloadHash" text NOT NULL, receipt jsonb NOT NULL,
 PRIMARY KEY("clinicId","commandId"), FOREIGN KEY("clinicId","actorId") REFERENCES "Account"("clinicId",id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['InventoryItem','InventorySupplier','InventorySettings','InventoryBatch','InventoryCommand'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY clinic_scope ON %I USING ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid) WITH CHECK ("clinicId" = nullif(current_setting(''app.clinic_id'',true),'''')::uuid)',t);
  EXECUTE format('GRANT SELECT, INSERT ON %I TO clinic_runtime',t);
 END LOOP;
END $$;
GRANT UPDATE ON "InventoryItem","InventorySupplier","InventorySettings" TO clinic_runtime;
