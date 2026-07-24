CREATE TABLE "AiAssistantConfig" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'GEMINI',
    "model" VARCHAR(100) NOT NULL DEFAULT 'gemini-3.6-flash',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedApiKeys" TEXT,
    "keyCount" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAssistantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAssistantConfig_companyId_key" ON "AiAssistantConfig"("companyId");

ALTER TABLE "AiAssistantConfig"
ADD CONSTRAINT "AiAssistantConfig_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
