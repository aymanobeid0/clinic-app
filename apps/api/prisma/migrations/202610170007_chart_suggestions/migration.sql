ALTER TABLE "CatalogProcedure" ADD COLUMN "chartCategory" text NOT NULL DEFAULT 'manual' CHECK("chartCategory" IN ('manual','extraction','restoration','crown','root_canal','implant'));
CREATE TABLE "ChartSuggestionDecision" ("clinicId" uuid NOT NULL,"patientId" uuid NOT NULL,"completionId" uuid NOT NULL,status text NOT NULL,"actorId" uuid NOT NULL,at timestamptz NOT NULL,PRIMARY KEY("clinicId","completionId"));
ALTER TABLE "ChartSuggestionDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartSuggestionDecision" FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_scope ON "ChartSuggestionDecision" USING ("clinicId"::text=current_setting('app.clinic_id',true)) WITH CHECK("clinicId"::text=current_setting('app.clinic_id',true));
GRANT SELECT,INSERT ON "ChartSuggestionDecision" TO clinic_runtime;
