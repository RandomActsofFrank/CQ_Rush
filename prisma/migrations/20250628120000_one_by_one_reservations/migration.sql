CREATE TABLE "one_by_one_reservations" (
    "id" INTEGER NOT NULL,
    "callsign" TEXT NOT NULL,
    "coordinator" TEXT,
    "event_name" TEXT,
    "requestor" TEXT,
    "requestor_call" TEXT,
    "requestor_addr" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "license_name" TEXT,
    "grid" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_by_one_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "one_by_one_reservations_callsign_idx" ON "one_by_one_reservations"("callsign");
CREATE INDEX "one_by_one_reservations_start_date_end_date_idx" ON "one_by_one_reservations"("start_date", "end_date");
