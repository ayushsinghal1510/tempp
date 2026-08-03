-- The `mm` end-of-session debrief.
--
-- When Mr Muthu decides the meeting is over — either because the officer got
-- somewhere with him or because he walked out — the roleplay graph branches to
-- an assessor model that returns one overall score plus two pieces of markdown.
-- The webhook writes them here.
--
-- Two columns rather than a JSON blob: both are long-form prose read straight
-- onto the results page with no field access, and `overall_score` already
-- exists on this table and is reused for the number, so there is nothing left
-- that needs a schema of its own.
--
-- Nullable and with no default on purpose. Null is meaningful: it is an mm
-- round that was abandoned before Mr Muthu ended it, and every other tenant,
-- none of which produces a debrief at all.

ALTER TABLE "practice_rounds"
  ADD COLUMN "debrief_feedback" TEXT,
  ADD COLUMN "debrief_summary" TEXT;
