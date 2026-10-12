ALTER TABLE "Account" ADD COLUMN "loginMethod" text NOT NULL DEFAULT 'clinic_username',
  ADD COLUMN "loginEmail" text,
  ADD COLUMN "isManager" boolean NOT NULL DEFAULT false;
-- Existing #7 accounts were all manager accounts; preserve their login method.
UPDATE "Account" SET "isManager" = true;
CREATE UNIQUE INDEX "Account_loginEmail_key" ON "Account"("loginEmail");
ALTER TABLE "Account" ADD CONSTRAINT login_identity CHECK (
  ("loginMethod" = 'clinic_username' AND "loginEmail" IS NULL) OR
  ("loginMethod" = 'email' AND "loginEmail" IS NOT NULL AND
    "loginEmail" = lower(btrim("loginEmail")))
);
-- Narrow pre-authentication lookup: only the exact email row is visible.
-- This SELECT policy grants no UPDATE or cross-clinic writes.
CREATE POLICY account_email_lookup ON "Account" FOR SELECT TO clinic_runtime
  USING ("loginMethod" = 'email' AND "loginEmail" = current_setting('app.login_email', true));
