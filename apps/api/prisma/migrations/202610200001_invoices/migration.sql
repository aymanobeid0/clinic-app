CREATE TABLE "BillingInvoice" (
 id uuid PRIMARY KEY, "clinicId" uuid NOT NULL REFERENCES "Clinic"(id),
 "patientId" uuid NOT NULL, number text NOT NULL, snapshot jsonb NOT NULL,
 UNIQUE("clinicId",number), UNIQUE("clinicId",id),
 FOREIGN KEY("clinicId","patientId") REFERENCES "Patient"("clinicId",id)
);
CREATE INDEX "BillingInvoice_clinicId_patientId_idx" ON "BillingInvoice"("clinicId","patientId");
CREATE TABLE "BillingInvoiceCharge" (
 "clinicId" uuid NOT NULL, "chargeId" uuid NOT NULL REFERENCES "BillingEntry"(id), "invoiceId" uuid NOT NULL,
 PRIMARY KEY("clinicId","chargeId"),
 FOREIGN KEY("clinicId","invoiceId") REFERENCES "BillingInvoice"("clinicId",id)
);
ALTER TABLE "BillingInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingInvoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "BillingInvoice" USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
ALTER TABLE "BillingInvoiceCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingInvoiceCharge" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "BillingInvoiceCharge" USING("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "BillingInvoice", "BillingInvoiceCharge" TO clinic_runtime;
