-- Isolated application-session persistence. No existing clinic database is targeted.
CREATE TABLE "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSONB NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);
CREATE INDEX "session_expire_idx" ON "session" ("expire");
