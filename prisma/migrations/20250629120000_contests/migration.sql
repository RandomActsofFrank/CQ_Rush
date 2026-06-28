-- CreateTable
CREATE TABLE "contests" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleset" TEXT NOT NULL DEFAULT 'field-day',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("slug")
);

-- Default Field Day contest (settings backfilled from legacy site_config in seed)
INSERT INTO "contests" ("slug", "name", "ruleset", "settings", "sortOrder", "updatedAt")
VALUES ('field-day', 'ARRL Field Day', 'field-day', '{}', 0, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "contestSlug" TEXT NOT NULL DEFAULT 'field-day';

-- Backfill existing rows
UPDATE "contacts" SET "contestSlug" = 'field-day' WHERE "contestSlug" IS NULL OR "contestSlug" = '';

-- CreateIndex
CREATE INDEX "contacts_contestSlug_idx" ON "contacts"("contestSlug");
CREATE INDEX "contacts_contestSlug_deleted_idx" ON "contacts"("contestSlug", "deleted");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contestSlug_fkey" FOREIGN KEY ("contestSlug") REFERENCES "contests"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
