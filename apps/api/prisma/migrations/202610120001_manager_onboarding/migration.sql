-- CreateTable
CREATE TABLE "Clinic" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "temporaryExpiresAt" TIMESTAMPTZ(6),
    "credentialVersion" INTEGER NOT NULL DEFAULT 0,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryEmail" TEXT,
    "verifiedEmail" TEXT,
    "verificationHash" TEXT,
    "verificationExpiresAt" TIMESTAMPTZ(6),
    "codesBatchId" UUID,
    "codesSaved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_code_key" ON "Clinic"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clinicId_username_key" ON "Account"("clinicId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clinicId_verifiedEmail_key" ON "Account"("clinicId", "verifiedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clinicId_id_key" ON "Account"("clinicId", "id");

-- CreateIndex
CREATE INDEX "RecoveryCode_clinicId_accountId_idx" ON "RecoveryCode"("clinicId", "accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_clinicId_accountId_fkey" FOREIGN KEY ("clinicId", "accountId") REFERENCES "Account"("clinicId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
