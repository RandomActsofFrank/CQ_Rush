-- CreateTable
CREATE TABLE "site_config" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callsign" TEXT NOT NULL,
    "frequency" TEXT,
    "mode" TEXT,
    "classSent" TEXT,
    "locationReceived" TEXT,
    "callSignArea" TEXT,
    "name" TEXT,
    "notes" TEXT,
    "rstSent" TEXT,
    "rstReceived" TEXT,
    "deleted" TEXT NOT NULL DEFAULT 'N',
    "createdBy" TEXT,
    "lastEditedBy" TEXT,
    "deletedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "restoredBy" TEXT,
    "restoredAt" TIMESTAMP(3),
    "lastEditedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_history" (
    "id" TEXT NOT NULL,
    "contactId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "operator" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeId" TEXT,

    CONSTRAINT "contact_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_operators" (
    "callsign" TEXT NOT NULL,
    "name" TEXT,
    "frequency" TEXT,
    "mode" TEXT,
    "duplicateUser" TEXT NOT NULL DEFAULT 'N',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bandModeTimestamp" TIMESTAMP(3),

    CONSTRAINT "active_operators_pkey" PRIMARY KEY ("callsign")
);

-- CreateTable
CREATE TABLE "callsign_lookups" (
    "callsign" TEXT NOT NULL,
    "name" TEXT,
    "grid" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callsign_lookups_pkey" PRIMARY KEY ("callsign")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sid" TEXT NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_config_key_key" ON "site_config"("key");

-- CreateIndex
CREATE INDEX "contact_history_contactId_idx" ON "contact_history"("contactId");

-- CreateIndex
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");

-- AddForeignKey
ALTER TABLE "contact_history" ADD CONSTRAINT "contact_history_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
