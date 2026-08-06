#!/usr/bin/env bash
# PrepAI — BUILD ONLY. Produces a runnable .next/ and then stops.
#
#   ./build.sh                 # install, migrate, generate, build
#   SKIP_MIGRATE=1 ./build.sh  # build against the schema already deployed
#   ./build.sh && pm2 start ecosystem.config.js
#
# This is start.sh with the last step removed. start.sh builds AND runs, which
# is wrong under a process manager: pm2 owns the lifecycle, so a build that
# ends in `exec npm run start` either fights pm2 for the port or leaves a
# stray server behind whenever a deploy is interrupted. Nothing below starts a
# server, binds a port, or stays in the foreground.
#
# It assumes node_modules is ABSENT — this runs on a fresh online box where the
# checkout is all that exists.
#
# It also NEVER seeds. start.sh calls `npm run db:seed` when the student table
# looks empty, and that script (prisma/seed.ts) opens by DELETING every B2B
# table. A build that silently wipes a database the moment a count comes back
# zero is how you lose production to a transient connection error. Seeding is a
# separate, deliberate command — see the note printed at the end.
set -euo pipefail
cd "$(dirname "$0")"

step() { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

# ── 1. Database URL ─────────────────────────────────────────────────────────
# Needed at BUILD time, not just at run time: `next build` prerenders pages
# that query Prisma, and `prisma migrate deploy` obviously needs it too.
step "Checking database connection (Neon / hosted Postgres)"
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
  export DATABASE_URL
fi
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set. Add it to .env."
echo "  using ${DATABASE_URL%%@*}@…(hidden)"

# ── 1b. Object storage ──────────────────────────────────────────────────────
# Every session recording and compiled resume lives in R2; nothing binary is on
# local disk or in Postgres any more. Checked here rather than discovered at
# 2am by a student whose interview recording had nowhere to go — the upload
# route throws on a missing variable, deliberately, instead of degrading.
step "Checking object storage (Cloudflare R2)"
for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  if [ -z "$(eval echo \"\${$var:-}\")" ] && [ -f .env ]; then
    eval "$var=\"\$(grep -E '^$var=' .env | head -1 | cut -d= -f2- | tr -d '\"')\""
    eval "export $var"
  fi
  [ -n "$(eval echo \"\${$var:-}\")" ] || fail "$var is not set. See docs/r2-migration.md."
done
echo "  bucket ${R2_BUCKET}"

# ── 2. Dependencies ─────────────────────────────────────────────────────────
step "Installing dependencies"
# `npm ci` over `npm install`: it installs exactly the lockfile and wipes any
# partial node_modules first, which is what you want on a box where the tree is
# missing or half-written. It REQUIRES the lockfile to match package.json, so
# fall back rather than hard-failing a deploy on a lockfile drift.
if [ -f package-lock.json ]; then
  npm ci || { echo "  npm ci failed (lockfile drift?) — falling back to npm install"; npm install; }
else
  npm install
fi

# Check the EXECUTABLES, not just that the directory exists. A partial install
# leaves node_modules/next and node_modules/prisma as empty husks with no
# node_modules/.bin at all — which passes a directory test while nothing runs.
[ -x node_modules/.bin/next ]   || fail "node_modules/.bin/next missing after install."
[ -x node_modules/.bin/prisma ] || fail "node_modules/.bin/prisma missing after install."

# ── 3. Schema + client ──────────────────────────────────────────────────────
# ./node_modules/.bin/prisma, NEVER `npx prisma`. When the local binary is
# missing npx silently falls back to the REGISTRY and pulls the latest major —
# prisma 7, which dropped `url`/`directUrl` from the datasource block and fails
# this schema with P1012. That error reads like the schema is wrong; it isn't,
# the CLI is just the wrong major. This project is pinned to prisma 6.
PRISMA=./node_modules/.bin/prisma

if [ "${SKIP_MIGRATE:-}" = "1" ]; then
  step "Skipping migrations (SKIP_MIGRATE=1)"
else
  step "Applying migrations"
  # `migrate deploy` only ever applies pending migration files. Unlike
  # `migrate dev` it never resets, never reseeds, and never drops anything.
  "$PRISMA" migrate deploy
fi

step "Generating Prisma client"
# Must run AFTER install and BEFORE build: the generated client lives in
# node_modules, so a fresh install leaves it absent and `next build` fails on
# the first `import { PrismaClient }`.
"$PRISMA" generate >/dev/null

# ── 4. Build ────────────────────────────────────────────────────────────────
step "Building production bundle"
npm run build

# ── 5. Done — hand off to pm2 ───────────────────────────────────────────────
step "Build complete"
cat <<'EOF'
  .next/ is ready. This script does not start anything.

  Run it with pm2:
    pm2 start ecosystem.config.js
    pm2 save

  Restart after a rebuild:
    ./build.sh && pm2 restart prepai

  Port 3000 must be free. If pm2 dies with EADDRINUSE, something else already
  has it — most likely a leftover ./start.sh, which ends in `exec npm run
  start` and serves the same port:
    ss -ltnp | grep :3000     # find the holder
  Do not run start.sh and pm2 at the same time; start.sh is the standalone
  path and this one is the pm2 path.

  If the database is empty, seed it deliberately — never as part of a build.
  These are additive and safe to re-run against a live database:
    npx tsx scripts/seed-tenants.ts       # nim + cus
    npx tsx scripts/seed-jer.ts           # jer educator
    npx tsx scripts/seed-nimc.ts          # nimc counsellors
    npx tsx scripts/seed-mm.ts            # mm
    npx tsx scripts/seed-pr.ts            # pr
    npx tsx scripts/repair-memberships.ts # re-enrol orphaned learners (--fix)

  `npm run db:seed` (prisma/seed.ts) is NOT safe — it deletes every B2B table
  before rebuilding the jer demo cohort. Never point it at live data.
EOF
