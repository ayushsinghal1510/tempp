#!/usr/bin/env bash
# PrepAI — build + run the production server (faster than `next dev`, and it
# avoids the dev-only cross-origin/HMR problems behind the litng proxy).
#
#   ./start.sh              # build + start on port 3000
#   PORT=3200 ./start.sh    # pick a port (match your litng preview port)
#   SEED=force ./start.sh   # wipe + reseed the demo data before starting
#   SKIP_BUILD=1 ./start.sh # skip the build (reuse the previous one)
#
# The database is hosted Postgres (Neon) — set DATABASE_URL in .env. It lives
# outside this studio, so container/studio resets no longer wipe your data.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"

step() { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }

# ── 1. Database URL ─────────────────────────────────────────────────────────
step "Checking database connection (Neon / hosted Postgres)"
# Load DATABASE_URL from .env if it isn't already exported.
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
  export DATABASE_URL
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "  ✗ DATABASE_URL is not set. Add it to .env (see .env.example)." >&2
  exit 1
fi
echo "  using ${DATABASE_URL%%@*}@…(hidden)"

# ── 2. Dependencies ─────────────────────────────────────────────────────────
step "Ensuring dependencies are installed"
if [ -d node_modules ] && [ -d node_modules/next ]; then
  echo "  present."
else
  npm install
fi

# ── 3. Schema + client ──────────────────────────────────────────────────────
step "Applying migrations"
npx prisma migrate deploy
npx prisma generate >/dev/null

# ── 4. Seed (only if empty, unless SEED=force) ──────────────────────────────
COUNT="$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.student.count().then(n => { console.log(n); return p.\$disconnect(); })
  .catch(() => { console.log(0); process.exit(0); });
" 2>/dev/null | tr -d '[:space:]' || echo 0)"
if [ "${SEED:-}" = "force" ] || [ "${COUNT:-0}" = "0" ]; then
  step "Seeding demo data"
  npm run db:seed
else
  step "Demo data already present ($COUNT students) — skipping seed"
  echo "  (run 'SEED=force ./start.sh' to reset it)"
fi

# ── 5. Build ────────────────────────────────────────────────────────────────
if [ "${SKIP_BUILD:-}" = "1" ]; then
  step "Skipping build (SKIP_BUILD=1)"
else
  step "Building production bundle"
  npm run build
fi

# ── 6. Run ──────────────────────────────────────────────────────────────────
step "Starting PrepAI on http://localhost:${PORT}"
echo "  Demo logins (password: password123):"
echo "    super_admin  ops@prepai.com"
echo "    admin        tpo@nims.edu"
echo "    student      ananya.rao@nims.edu"
echo ""
exec npm run start -- -H 0.0.0.0 -p "$PORT"
