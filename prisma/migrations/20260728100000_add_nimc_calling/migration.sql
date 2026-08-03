-- The `nimc` tenant: outbound admissions calling. A counsellor types a phone
-- number, the agent dials it over PSTN, and the same voxio webhook that feeds
-- the practice track delivers the transcript — but with flat extracted strings
-- (name, course, percentage) instead of scored topic dicts.
--
-- Same ADD VALUE constraint as the `cus` migration: Postgres permits adding an
-- enum value inside a transaction block (which is how `prisma migrate deploy`
-- runs each file) only if the new value is not USED in that same transaction.
-- Nothing below uses 'nimc' or 'nimc_counsellor' — the new tables key off new
-- types, and no column defaults to either value — so this is safe as one file.

ALTER TYPE "Tenant" ADD VALUE 'nimc';
ALTER TYPE "Role" ADD VALUE 'nimc_counsellor';

CREATE TYPE "CallSpeaker" AS ENUM ('agent', 'lead');

CREATE TYPE "CallOutcome" AS ENUM (
  'connected',
  'no_answer',
  'busy',
  'invalid_number',
  'wrong_person',
  'declined_immediately',
  'callback_requested',
  'voicemail'
);

-- One prospective student, keyed by the number we dial. Created as a silent
-- upsert at dial time — the counsellor never picks from a list — so that
-- repeat calls to the same number group without a later backfill.
CREATE TABLE "leads" (
  "id"              TEXT NOT NULL,
  "org_id"          TEXT NOT NULL,
  "phone"           TEXT NOT NULL,
  "name"            TEXT,
  "course_interest" TEXT,
  "academics"       JSONB,
  "residence"       TEXT,
  "attempt_count"   INTEGER NOT NULL DEFAULT 0,
  "last_call_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- The whole grouping mechanism. Numbers are normalised to E.164 before write;
-- an unnormalised one silently creates a duplicate lead instead of colliding.
CREATE UNIQUE INDEX "leads_org_id_phone_key" ON "leads"("org_id", "phone");
CREATE INDEX "leads_org_id_idx" ON "leads"("org_id");

-- One outbound call. `id` IS the session_id handed to voxio, so the row exists
-- before the phone rings and the webhook correlates with no lookup.
CREATE TABLE "lead_calls" (
  "id"               TEXT NOT NULL,
  "lead_id"          TEXT NOT NULL,
  "counsellor_id"    TEXT NOT NULL,
  "phone"            TEXT NOT NULL,
  "outcome"          "CallOutcome",
  "started_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at"         TIMESTAMP(3),
  "duration_seconds" INTEGER,

  CONSTRAINT "lead_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_calls_lead_id_idx" ON "lead_calls"("lead_id");
CREATE INDEX "lead_calls_counsellor_id_started_at_idx"
  ON "lead_calls"("counsellor_id", "started_at");

-- One utterance. The direct analogue of practice_turns, minus the rubric.
CREATE TABLE "lead_turns" (
  "id"          TEXT NOT NULL,
  "call_id"     TEXT NOT NULL,
  "turn_number" INTEGER NOT NULL,
  "speaker"     "CallSpeaker" NOT NULL,
  "transcript"  TEXT NOT NULL,
  "fields"      JSONB,
  "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lead_turns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_turns_call_id_idx" ON "lead_turns"("call_id");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "practice_orgs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_calls"
  ADD CONSTRAINT "lead_calls_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_calls"
  ADD CONSTRAINT "lead_calls_counsellor_id_fkey"
  FOREIGN KEY ("counsellor_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_turns"
  ADD CONSTRAINT "lead_turns_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "lead_calls"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
