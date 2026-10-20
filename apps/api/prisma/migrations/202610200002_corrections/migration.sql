ALTER TABLE "BillingEntry" DROP CONSTRAINT "BillingEntry_kind_check";
ALTER TABLE "BillingEntry" ADD CHECK(kind IN ('charge','opening','adjustment','settlement','correction'));
