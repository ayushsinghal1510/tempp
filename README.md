# PrepAI

AI interview-preparation platform for Indian engineering universities' campus
placement training. Three roles — **super admin** (platform ops), **admin**
(university placement officer / TPO), and **student**.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS 4** · shadcn + **Bklit UI** charts (charts land in the next phase)
- **Prisma 6** · **PostgreSQL**
- Auth: JWT session cookie (`jose`) + `bcryptjs`, role-gated by `src/proxy.ts`

## Prerequisites

- Node 20+
- A PostgreSQL 16 database. A local one runs in Docker:

  ```bash
  docker run -d --name prepai-pg \
    -e POSTGRES_PASSWORD=prepai -e POSTGRES_USER=prepai -e POSTGRES_DB=prepai \
    -p 5432:5432 postgres:16
  ```

## Setup

```bash
npm install
npx prisma migrate dev      # apply schema
npm run db:seed             # load demo data (2 universities, 15 students, 90 rounds)
npm run dev                 # http://localhost:3000
```

### Demo logins (password `password123`)

| Role                | Email                  |
| ------------------- | ---------------------- |
| Super admin         | `ops@prepai.com`       |
| Admin (NIMS)        | `tpo@nims.edu`         |
| Student · Ready     | `aarav.mehta@nims.edu` |
| Student · Unlocked  | `ananya.rao@nims.edu`  |

## The privacy architecture (load-bearing)

The product's core promise is that a student's **coaching** (drill-room) rounds
are private; only **test** rounds are visible to their educator. This is
enforced at the **data-access layer**, not just in the UI:

- `src/lib/auth/rbac.ts` — `roundWhereForViewer()` scopes every round query to
  what a viewer may see; `scopedRoundWhere()` safely narrows it (AND-combines so
  a caller can never widen access); `canViewRound()` / `assertCanViewRound()`
  guard single-record access; webcam visual metrics (`turns.visualFlags`) are
  stripped for any non-owner.
- Coaching → owning student only. Test → student + their university admin +
  super admin. Verified by `npx tsx scripts/verify-rbac.ts`.

## Data model

`prisma/schema.prisma` implements the full brief schema: universities, users,
students, cohorts, vacancies, cohort_students, sessions, rounds, turns,
round_scores, round_feedback, recordings. Per-turn `delta` / `running_score` are
captured but never shown live (surfaced only in the after-round replay).

## Build status

- [x] **Foundation** — DB schema + migrations, auth, 3 roles, API-layer privacy guard, seed
- [x] **Student UI** — dashboard (climbing score line), companies prep hub, round replay (radar + score-timeline + transcript)
- [x] **Admin UI** — dashboard (composed chart + "ready to move up" tile), cohorts list, New Cohort wizard, cohort detail (mispricing scatter + send order + funnel), students list + detail (score growth + radar)
- [x] **Super admin UI** — dashboard (multi-line usage + consumption rings), universities list + detail
- [ ] Company research (currently a canned stub in `actions.ts`, not a live Groq web search)
- [ ] Live interview room (WebRTC voice + webcam) — to be ported from the previous app; "Enter interview" is a placeholder

### Charts (Bklit + bespoke)
Bklit: line (score climb, sparkline, multi-line), radar (5 dimensions), funnel (usage),
ring (consumption). Bespoke SVG: the mispricing scatter (§6 hero) and the composed
bars+line (§9) — Bklit has no scatter-with-quadrants or bar/composed that fit.

The previous Vite voice-interview app (WebRTC room + voice workflow) is preserved
in git history and will be ported into the interview room phase.
