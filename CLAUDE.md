# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                  # next dev on :3000
npm run build                # next build --webpack (NOT turbopack — see below)
npm run lint                 # eslint
./node_modules/.bin/tsc --noEmit    # typecheck (no npm script for it)

./node_modules/.bin/prisma migrate dev      # new migration
./node_modules/.bin/prisma generate
npm run db:studio
```

**Never `npx prisma`.** When the local binary is absent npx pulls prisma 7 from the
registry, which dropped `url`/`directUrl` from the datasource block and fails this
schema with P1012 — an error that reads like the schema is broken. Always
`./node_modules/.bin/prisma`. Same reasoning is spelled out in `build.sh`.

`--webpack` on the build is deliberate: Next 16's Turbopack build externalises the
generated Prisma client under a content-hashed module name the runtime can't
resolve, so every DB call under `next start` throws "Cannot find module". See also
`serverExternalPackages` in `next.config.ts`.

### Running it

```bash
./start.sh                   # standalone: migrate, seed-if-empty, build, serve
PORT=3200 ./start.sh
SKIP_BUILD=1 ./start.sh

./build.sh                   # build only, for pm2 — never seeds, never serves
pm2 start ecosystem.config.js
./build.sh && pm2 restart prepai
```

`start.sh` and pm2 both bind :3000 — do not run them together.

### Seeding

`npm run db:seed` (`prisma/seed.ts`) **deletes every B2B table** before rebuilding the
jer demo cohort. Never point it at live data. The per-tenant seeds are additive and
safe to re-run:

```bash
npx tsx scripts/seed-tenants.ts       # nim + cus
npx tsx scripts/seed-jer.ts           # jer educator
npx tsx scripts/seed-nimc.ts          # nimc counsellors (only way they exist)
npx tsx scripts/seed-mm.ts
npx tsx scripts/seed-pr.ts
npx tsx scripts/seed-vps.ts
npx tsx scripts/seed-demo-educator.ts # --dry-run supported
npx tsx scripts/repair-memberships.ts # --fix to actually enrol
```

### Verification scripts (this repo's test suite)

There is no test framework. Invariants are asserted by standalone tsx scripts —
run the relevant one after touching its subject:

```bash
npx tsx scripts/verify-rbac.ts             # B2B privacy guard (src/lib/auth/rbac.ts)
npx tsx scripts/verify-practice-access.ts  # practice access guard (src/lib/practice/access.ts)
npx tsx scripts/verify-tenant-surface.ts   # student UI obeys its tenant config
npx tsx scripts/verify-r2.ts               # every DB key has a matching R2 object
npx tsx scripts/verify-resume-latex.ts     # Resume Studio LaTeX toolchain
npx tsx scripts/verify-vps-faces.ts        # vps frame/avatar-clip pairing
```

`_shot.mjs` / `_render.mjs` are ad-hoc playwright-core screenshot harnesses (log in
via `/api/auth/login`, copy the cookie, screenshot a route). They hardcode ports and
a Chrome path — edit rather than trust.

## Architecture

Two products share one Next.js App Router codebase, one Prisma schema, and one auth
system.

**B2B university track** (`/super`, `/admin`, `/student`) — the original placement-
training product. `University → Cohort → Vacancy → Session → Round → Turn`, with
super-admin ops on top. Queries live in `src/lib/queries/`, mutations in
`src/lib/actions/{super,admin,student}.ts`.

**Practice track** (`/practice` learner, `/educator` staff, `/nimc` calling) — the
multi-tenant product that everything new is built on. Models are the `Practice*`
family plus `Lead`/`LeadCall`/`LeadTurn` for nimc. Reads in
`src/lib/practice/`, mutations in `src/lib/actions/{practice,educator}.ts`.

`src/app/(landing)/` is the marketing page — pure CSS modules with its own font
stack and palette, isolated from the app's Tailwind theme. It is pinned to its light
palette so `.dark` can't reach it; scope additions with `:where()` rather than a
`.landing` prefix so the landing's own cascade order survives.

### `src/lib/tenants/config.ts` is the centre of the practice track

Seven tenants (`jer`, `nim`, `cus`, `nimc`, `mm`, `pr`, `vps`) run off identical routes,
models, charts and metrics. A tenant selects exactly three things: the **rubric**
(`topics`, legitimately empty on the four unscored tracks), which **features** are on,
and the **nouns** the UI uses (`copy`). Read the file's header comment before
touching it — every field carries the reasoning for its value.

Consequences that constrain new code:

- Nothing downstream of the rubric may name a topic. `metrics.ts`,
  `educatorMetrics.ts`, the radar and the timelines iterate the topic list
  generically, which is how a new tenant gets the whole analytics layer for free.
- Rubric-consuming helpers take `topics: TopicMeta[]` as a **required** argument.
  A default would let a clinical session be scored against the interview rubric and
  produce six zeroes that look like real data.
- `features.scoring === false` gates every chart, KPI, radar and triage surface —
  zero topics must render *nothing*, not an empty chart.
- A user's tenant is decided from their email domain at signup and then **stored** on
  `User.tenant`. Never recomputed from the email.

### Auth and routing

JWT session cookie (`jose`) verified in `src/proxy.ts` (middleware) for
`/super`, `/admin`, `/student`, `/educator`, `/nimc`. Wrong-role access bounces to
that role's own home, which **looks identical to a rejected password** — the usual
cause of a "login is broken" report is using the wrong login page. There are four:
`/login` (super/admin/student), `/educator/login`, `/practice/login`, `/nimc/login`.

`/practice/*` is **not** in the middleware matcher; those pages guard themselves via
`requireUser(["practice"], "/practice/login")` from `src/lib/auth/session.ts`.

Session cookies switch to `SameSite=None; Secure` over HTTPS so the app works inside
the litng cloudspaces preview iframe.

### Two access-control layers, both at the data layer

Neither is a UI concern; add call sites, don't reimplement the rule.

`src/lib/auth/rbac.ts` (B2B) — coaching rounds are private to the owning student;
test rounds are visible to the student, their university admin, and super admin.
Compose round queries with `scopedRoundWhere()`, which AND-combines so a caller can
only ever narrow. **Never** spread `{ ...roundWhereForViewer(v), ...extra }` — that
lets `extra` override the guard's `type`/`session` constraints and silently widen
access. Webcam metrics (`Turn.visualFlags`) go to the owning student only.

`src/lib/practice/access.ts` (practice) — a user reaches a `PracticeCompany` three
ways and only three: they created it, an educator assigned it, or it is a published
`kind: "workflow"` in an org they belong to (the `cus` org-wide case, deliberately
narrowed to workflows). `getAccessibleCompany` returns null for both "missing" and
"denied" so company ids don't leak. `roundVisibilityForEducator()` is the single
choke point for the drill/assessment split: `drill` → analytics only, `assessment`
→ transcript and recording too.

### Voice sessions

`src/components/interview/InterviewRoom.tsx` (~2k lines, client) is the room for
every track. It builds a "customs" JSON payload, POSTs an SDP offer to
`${VX_SERVER}/rtc/offer/audio`, and renders whatever comes back.

Customs builders in `src/lib/voice/` — one per track, each embedding its system
prompt and workflow graph: `customs.ts` (jer B2B interview),
`practiceCustoms.ts` (jer practice), `clinicalCustoms.ts` (nim),
`workflowCustoms.ts` (cus, admin-authored), `muthuCustoms.ts` +
`muthuPrompt.ts` (mm), `cherylCustoms.ts` + `cherylPrompt.ts` (pr),
`vpsCustoms.ts` + `vpsPrompt.ts` (vps), `nimcCustoms.ts` + `nimcPrompt.ts`
(PSTN). `voiceCustoms.ts` holds the shared
TTS/STT key shapes. `workflow-json/` has dumped payloads per tenant for reference.

Avatar tracks send a `faces` manifest. Every builder except `vpsCustoms.ts` sends
it as a **bare list** of `{uuid,label,usage}` expression refs, which the backend
wraps as expressions-only — that shape cannot carry transitions. `vps` sends the
**object** form (`{expressions, transitions:[{uuid,from,to}]}`) so the avatar
bridges between poses instead of hard-cutting. Two things about that are easy to
get wrong: transitions must be **nested inside `faces`** (the DB's write API
takes them as a sibling field and merges them, but the runtime only reads the
merged form, so a top-level `transitions` customs key is silently ignored), and
they are **one-directional** — the reverse of a defined pair is not implied.
`label` on an expression is the string the model returns as `frame`, and `"main"`
is special: the lipsync engine resolves it as the idle face it falls back to
between turns.

Two backends: `NEXT_PUBLIC_VX_SERVER` for audio-only tracks, and
`NEXT_PUBLIC_VX_SERVER_GPU` for the avatar tracks (`cus`, `mm`, `pr`, `vps` — exactly the
set that negotiates video), which need a GPU box. `NIMC_DIAL_URL` is a third,
separate host for PSTN. Which server a session uses is picked in `InterviewRoom` by
`workflow || roleplay`.

Voice/STT/TTS config keys are **not** cosmetic. The backend drivers read specific key
names and silently ignore everything else — `language` vs `language-hints` on soniox
shipped Devanagari transcripts to English-only sessions for weeks. Every key block in
`voiceCustoms.ts` documents which backend file it was verified against and which
adjacent keys are inert. Verify against the backend source before adding a key.

The telephony key stays server-side (`src/app/api/nimc/call/route.ts`). Only
`NEXT_PUBLIC_FLOW_API_KEY` is exposed, because the WebRTC offer must originate in the
browser anyway.

### Turn ingestion — `src/app/api/practice/webhook/route.ts`

The voice backend POSTs here once per conversational turn (when its graph reaches the
`ask_for_input` stopping node). Every raw body is written to `WebhookEvent`
unconditionally *before* any parsing, so a shape change loses nothing.

Payload shape facts that are easy to get wrong, all confirmed against live data and
documented inline: there is no top-level `variables` — each node's output is in its
own `responses[i].out`; `session_id` (the round id) repeats on every item; the
roleplay debrief and the final turn arrive in the **same** payload, so neither branch
may return early. `out.score` means different things on `mm` (end-of-round) and `pr`
(per-turn running score) — read the extractors' comments before touching them.
Unknown "kink" types from the model are cleared rather than stored, so an invented
type downgrades a turn instead of rendering an uncoloured chip.

### Caching

Practice reads go through `unstable_cache` in `src/lib/practice/cachedQueries.ts`,
tagged with helpers from `cacheTags.ts` (`practice:user:*`, `practice:company:*`,
`practice:round:*`). Every mutation in `actions/practice.ts` and the webhook
revalidates the matching tags; the 60s TTL is a safety net, not the mechanism.

Two traps live here. `unstable_cache` JSON-serialises, so **every `Date` comes back a
string on a cache hit while the Prisma type still says `Date`** — hence
`reviveDates()` and its `DATE_KEYS` set, which must list every `DateTime` column
reaching a cached read. And anything not derivable from the arguments inside the
closure (org membership, in practice) must be resolved outside and folded into the
cache key.

### Object storage

Recordings and compiled resume PDFs live in Cloudflare R2 (`src/lib/r2.ts`,
`practice/recordingStorage.ts`). Nothing binary is on local disk or in Postgres.
Rows carry the **key**, not a URL, so a bucket rename or a public/presigned switch
doesn't rewrite every row. Missing R2 env throws rather than degrading —
`build.sh` fails the build without it. `data/recordings/` remains a read-only
fallback for pre-migration rows. See `docs/r2-migration.md`.

### Charts

`src/components/charts/` is a large hand-rolled visx/d3 primitive library (line,
area, bar, radar, ring, scatter, composed) with its own animation and phase
orchestration, plus `charts/bklit/` wrappers. Prefer composing the existing
primitives over adding a chart library.

## Conventions

- Comments here explain **why**, often at length, and frequently record a bug the
  current shape prevents. They are load-bearing documentation — read them before
  changing the code they sit on, and preserve the reasoning when you edit.
- Server Components for reads, server actions for mutations. `"use client"` only
  where interaction demands it.
- Path alias `@/*` → `src/*`. shadcn config in `components.json` (style `base-nova`,
  Bklit registry).
- Theme is CSS custom properties in `src/app/globals.css` (the "valley" palette:
  `--canvas`, `--ink`, `--muted`, `--line`, `--brand`, `--success`/`--warning`/
  `--danger` and their `-soft` variants, `--chart-1..5`). Use the semantic tokens,
  not raw hex.

## Docs

`docs/` is written for humans and is worth reading before large changes:
`logins.md` (full demo roster + which page each role signs in at),
`r2-migration.md`, `resume-studio.md` (needs `tectonic` provisioned or the feature
is dead), `nimc-spec.md`, `dashboard-case-study.md` (why one dashboard serves four
products), `human-touch.md`, `product-brief-for-design.md`.

## Known stubs

Company research on the B2B side is a canned stub, not a live Groq web search. The
B2B "Enter interview" placeholder predates the ported room; the practice track is
where the live interview actually runs. `vision_id` (the 1fps frame analyser that
produces `visualFlags`) is commented out in `src/lib/voice/customs.ts` — visual
metrics render empty rather than wrong.
