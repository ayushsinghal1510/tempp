-- The avatar face Mr Muthu wore on a given turn.
--
-- `mm` only. The roleplay model returns `frame` alongside `speak` on every
-- reply, and the voice backend renders that face into the video stream itself
-- — so this column drives nothing visual. It exists so the live room, which
-- already polls the turn list, can compare one turn's face to the previous
-- one's and tell the officer the moment they moved him ("calming down" /
-- "angry again"). That comparison needs history, which only a stored column
-- gives us: the browser never sees `frame` on the wire.
--
-- Nullable, no default, no backfill. Every turn already recorded predates the
-- column, and every other tenant has exactly one face and will never write it.

ALTER TABLE "practice_turns"
  ADD COLUMN "frame" TEXT;
