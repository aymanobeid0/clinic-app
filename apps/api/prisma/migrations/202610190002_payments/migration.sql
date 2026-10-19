ALTER TABLE "BillingEntry" DROP CONSTRAINT "BillingEntry_kind_check";
ALTER TABLE "BillingEntry" ADD CHECK(kind IN ('charge','opening','adjustment','settlement'));
CREATE TABLE "BillingMethod" (
 "clinicId" uuid NOT NULL REFERENCES "Clinic"(id), id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0), snapshot jsonb NOT NULL,
 PRIMARY KEY("clinicId",id,revision)
);
ALTER TABLE "BillingMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingMethod" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "BillingMethod" USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "BillingMethod" TO clinic_runtime;
CREATE UNIQUE INDEX billing_receipt_number ON "BillingEntry"("clinicId",(snapshot->>'receiptNumber')) WHERE kind='settlement' AND snapshot->>'receiptNumber' IS NOT NULL;
