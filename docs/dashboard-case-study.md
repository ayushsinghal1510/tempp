# Case study — the practice dashboard

How one dashboard route serves four products, and why it leads with a button
instead of a chart.

**Surface:** `/practice` (learner home) · `src/app/practice/page.tsx`
**Counterpart:** `/educator` (staff home) · `src/app/educator/page.tsx`
**Stack:** Next.js 16 App Router · React 19 server components · Prisma 6 ·
PostgreSQL · Tailwind 4 · Bklit chart primitives
**Date:** July 2026

---

## 1. Context

PrepAI started as an AI interview coach for Indian engineering campus
placement. A student registers a company, uploads a resume, and runs voice
interviews against an agent that scores them turn by turn on a six-point
rubric. The dashboard was the first thing they saw after logging in.

Then the same engine got sold three more times, to buyers who wanted something
adjacent but not identical:

| Tenant | Product | Unit of work | Session called | Scored? |
| ------ | ------- | ------------ | -------------- | ------- |
| `jer`  | Interview coaching for engineering students | company | interview | yes, 6 topics |
| `nim`  | Clinical-communication training for medical students | scenario | encounter | yes, 6 different topics |
| `cus`  | Managed deployment for a corporate customer | workflow | session | **no rubric at all** |
| `nimc` | Outbound admissions calling for counsellors | lead | call | no — fact extraction, not judgement |

These are not four apps. They share one route table, one Prisma schema, one
chart library and one metrics module. A tenant is a configuration object
(`src/lib/tenants/config.ts`), and it selects exactly three things:

1. the rubric each turn is scored against (legitimately empty for two tenants),
2. which features are switched on,
3. the nouns the interface uses.

Everything downstream of the rubric iterates the topic list generically and
never names a topic. That is what lets a new tenant inherit the entire
analytics layer for free — and it is also the constraint that shaped every
decision in this case study.

The `admin`, `student` and `super_admin` dashboards from the original campus
product still exist in the tree but are short-circuited to `redirect("/practice")`,
with their implementations preserved in comments. The product is in
practice-only mode. This case study is about the surface that is actually live.

---

## 2. The problem

The dashboard opened on charts.

That was defensible when the product was one thing and the student was a
motivated final-year engineer checking their score trend. It stopped being
defensible once the thing a student most often came to do was *start the
session their educator assigned them this week*. That action was four
navigations deep:

```
Dashboard → Companies → find the row → company detail → Start
```

Meanwhile the top of the dashboard rendered a 5:1 aspect-ratio line chart of
score-over-time — which for a first-week student is a single dot on an empty
axis, and for a `cus` user is nothing at all, because `cus` has no rubric.

Three failures stacked on top of each other:

**The action was buried.** The page answered "how am I doing?" before "what
should I do?" — the wrong order for a product whose retention problem is
students not running the second session.

**The chrome lied to three tenants out of four.** The header said "Practice
Interview" and the middle nav tab said "Companies" regardless of tenant. A
medical student on `nim` — who has scenarios, not companies, and runs
encounters, not interviews — was greeted by the vocabulary of a product they
had not bought. The onboarding tour was the worst offender: the one screen in
the product whose entire job is orientation confidently walked them through
"Companies" and then listed the *engineering* rubric at them by name.

**Deadlines were decoration.** `PracticeAssignment.dueDate` was stored,
rendered in a table cell, and read by nothing. A student could start an
assignment a month late and the system had no opinion. The educator had no
lever to say "this is closed now" and no lever to reopen it.

**The empty and unscored states rendered as furniture.** On `cus` the KPI row
showed one populated card ("Total sessions") in a four-column grid — which
reads as three broken cards, not as one card.

---

## 3. Constraints

Anything built here had to hold under all four tenants simultaneously:

- **No tenant branching in page code.** A `if (tenant === "nim")` in a React
  component is a bug factory: the fifth tenant means auditing every component
  again. Differences must fall out of `TenantFeatures` and `copy`.
- **Server-rendered, no client fetch waterfall.** The page is an async server
  component. Data arrives before the first byte or it does not arrive.
- **No new per-row queries.** The dashboard already ran one cached batched
  query. Adding a card per unit must not turn that into N+1.
- **Two tenants have zero topics.** Not "topics we haven't configured yet" —
  genuinely zero, forever. Every analytics surface has to render *nothing*
  rather than an axis of dashes.
- **Light and dark, both first-class.** Every colour is a CSS custom property
  with a dark override; nothing is hardcoded.

---

## 4. What was built

The page now reads top to bottom as: **do this → here's the takeaway in a
sentence → here are the numbers → here are the charts.**

```
┌─────────────────────────────────────────────────────────────┐
│  [I] Clinical communication          Ananya  (?) ☾  Log out │  tenant-named
│  Home · Scenarios · Encounters                              │  tenant-named
├─────────────────────────────────────────────────────────────┤
│  Hi Ananya — up next                    All scenarios →     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │▔▔▔▔▔▔▔▔▔▔▔│ │▔▔▔▔▔▔▔▔▔▔▔│ │▔▔▔▔▔▔▔▔▔▔▔│  ← identity stripe│
│  │ Geriatric │ │ Breaking  │ │ Medication│                  │
│  │  intake   │ │ bad news  │ │  review   │                  │
│  │  Due 4 Aug│ │  Overdue  │ │   Locked  │                  │
│  │ Not started│ │2 completed│ │2 completed│                 │
│  │[Start enc.]│ │[Start ano]│ │ ask your  │                 │
│  └───────────┘ └───────────┘ │ educator  │                  │
│                              └───────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Your strongest area is Rapport and you're improving        │  one sentence
│  session over session — focus on Plain language next.       │
├─────────────────────────────────────────────────────────────┤
│  [Total sessions 12] [Improving] [Rapport] [Plain language] │  KPI row
├─────────────────────────────────────────────────────────────┤
│  Sessions over time                                    (i)  │
│  [Scores | By category | Both | Net change]                 │
│  ╭───────────────────────────────────────────────────────╮  │
│  ╰───────────────────────────────────────────────────────╯  │
├──────────────────────────────┬──────────────────────────────┤
│  Average shape          (i)  │  Weakest first          (i)  │
│         ╱◇╲                  │  ▬▬▬▬▬▬▬▬ Plain language     │
│        ◇   ◇                 │  ▬▬▬▬▬▬▬▬▬▬▬ Listening       │
│         ╲◇╱                  │  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬ Rapport      │
└──────────────────────────────┴──────────────────────────────┘
```

Four things are new: the **Up Next** section, a **tenant-aware header, nav and
tour**, an **enforced deadline model**, and **honest empty states**.

---

## 5. Up Next — the design work

### 5.1 It is a pure function

`src/lib/practice/upNext.ts` is not a query. It is a pure function over data
the dashboard already loads:

```ts
export function upNextFrom(
  companies: UpNextCompany[],
  tenant: Tenant,
  resumeCompanyIds: Set<string>,
  now: Date = new Date(),
): UpNextCard[]
```

`getUserCompaniesWithRounds()` already returns, in one cached call: every unit
this student may use, *their* rounds on each, and *their* assignment row. That
is everything a card needs except one fact — whether a resume chat exists —
which is one extra batched `findMany` returning a `Set<string>`.

Total added cost to the page: **one query, zero per-row lookups.**

The `now` parameter is injectable for the same reason `deadlineState`'s is: one
instant classifies the whole list, so two cards sharing a due date cannot
disagree about whether it has passed.

### 5.2 Three states, and the order they're checked in

```ts
export type UpNextState = "ready" | "needs-resume" | "locked";
```

```ts
let state: UpNextState = "ready";
if (deadline && !deadline.canStart) {
  state = "locked";
} else if (features.resume && !resumeCompanyIds.has(company.id)) {
  state = "needs-resume";
}
```

The order matters and is commented in place: **a locked assignment outranks a
missing resume**, because uploading one would not make the session startable.
Telling a student to go upload a resume for something they cannot start is a
small cruelty that costs them a five-minute detour.

The `needs-resume` card links straight to `/practice/companies/[id]/resume-chat`
rather than submitting the start action. `createSession()` would redirect there
anyway — server-side enforcement is unchanged — but linking directly means the
button never lies about what pressing it does.

### 5.3 The sort is a priority argument

```ts
function compareCards(a, b) {
  // 1. anything startable before anything locked
  // 2. never-attempted before already-practised
  // 3. soonest deadline first (no deadline sorts last, whatever the date)
  // 4. title
}
```

Step 2 is the non-obvious one. The intuitive sort puts the thing with the
nearest deadline first. But a student who has already run three sessions on a
unit does not need a prompt to run a fourth — they have demonstrated they know
how to get there. The student who has run zero is the one the card is *for*.
Freshness outranks urgency.

Step 3's tie-break — "a due date is more urgent than no due date, whatever the
date is" — is implemented as `?? Infinity`, so self-registered units with no
deadline sink below every assigned one without a special case.

### 5.4 Colour does two jobs, kept apart

Each card carries a 1px accent stripe whose hue is derived from the unit's id:

```ts
function accentFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % 5;
}
```

This is documented as encoding **identity, never status** — a stable hue so a
student recognises "the amber one" across visits and across pages. It is never
the only thing distinguishing two cards; the title always is.

Everything that *means* something — a deadline badge, a lock — uses the
semantic tokens (`--warning`, `--danger`, `--success`) and is **always paired
with text**. `Overdue 4 Aug` is legible with colour vision entirely absent.

Two implementation details worth recording:

- **Five accents, not six.** The palette is `--chart-1..5` plus `--brand`.
  `--brand` is excluded because it is near-black on light and near-white on
  dark — one card in five would look like an accidentally-unstyled one.
- The stripe is `aria-hidden`. It is decorative; announcing it to a screen
  reader adds noise and no information.

### 5.5 The CTA speaks the tenant's language

```ts
const cta =
  state === "needs-resume" ? "Upload resume to start"
  : sessionsRun > 0        ? `Start another ${sessionNoun}`
  :                          `Start ${sessionNoun}`;
```

"Start interview" · "Start another encounter" · "Start session". The button
text is generated from `copy.sessionNoun`, not from a tenant switch.

### 5.6 The whole module has no tenant branch

The header comment states the rule explicitly:

> Where the three tenants differ is ONLY in what reaches this list and what the
> button says, and both fall out of `TenantFeatures` rather than a tenant
> switch: `jer` mixes assigned and self-registered companies and may divert to a
> resume upload, `nim` shows assigned scenarios, `cus` shows published workflows
> that were never assigned to anyone. No `if (tenant === ...)` below.

`jer` gets resume gating because `features.resume` is true. `cus` gets
org-published workflows with no deadline because `features.assignments` is
false, so no assignment row exists, so `deadlineState` is never called.
Behaviour differs; code does not branch.

---

## 6. Deadlines: from decoration to a rule

`src/lib/practice/deadline.ts` is deliberately the **only** definition of "late"
in the codebase. The student's badge, the educator's roster, and the
server-side refusal all call into it, so they cannot drift into telling
different stories about the same date.

Five states:

| Status | Meaning | `canStart` |
| ------ | ------- | ---------- |
| `none` | No due date was ever set | ✓ |
| `upcoming` | Due date still ahead | ✓ |
| `grace` | Past due, inside the 48h window — counts as late | ✓ |
| `locked` | Past due and past grace | ✗ |
| `unlocked` | Was locked; an educator reopened it. Never locks again | ✓ |

### The 48-hour grace window

```ts
export const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
```

The reasoning is in the source and worth repeating: a hard cutoff at midnight
punishes the wrong thing. A student who was ill, or who tried at eleven and hit
a broken microphone, loses the assignment entirely over a few hours. Two days
is short enough that the deadline still means something and long enough that
the lock, when it comes, is genuinely about not doing the work.

### Two ordering decisions

**Reopen is checked before the clock.** An educator's `unlockedAt` outranks
every time comparison — otherwise the assignment would re-lock the instant they
walked away from it.

**An unparseable date means no deadline.** `Number.isNaN(dueDate.getTime())`
returns `status: "none", canStart: true`. Locking a student out on the strength
of a date the system cannot read is the worse failure mode.

---

## 7. Tenant vocabulary, end to end

Before: the header said "Practice Interview" and the tabs said "Companies" for
everyone. After, every user-visible noun on the chrome is derived.

**`PracticeHeader`** takes `tenant` and reads `label`, `copy`, `features`,
`topics` from the config. The logo mark is `label.charAt(0)`.

**`PracticeNavTabs`** takes `unitLabel` and `sessionLabel` as props rather than
reading the tenant itself — it is a client component for `usePathname()`, and
passing strings keeps the tenant config out of the client bundle. The **hrefs
stay tenant-agnostic on purpose**: renaming `/practice/companies` to
`/practice/scenarios` per tenant would break every existing bookmark for no
gain the label does not already give.

**`GuidedTour`** builds its steps from `stepsFor(copy)` — the unit noun, the
session noun, and `topicLabels.join(", ")` for the tenant's own rubric. The
scores step now reads *"Every encounter scores you 0–10 across 6 areas:
Presence, Rapport, Listening, Empathy, Plain language, Dignity"* to a medical
student, and the engineering rubric to an engineer.

The tour is gated on `features.scoring` and so is its `TourTrigger` — a tour
whose central step explains scoring should not run on a tenant that has none.

**`PracticeSkeleton`** is the interesting edge. It renders via `loading.tsx`
before any session lookup has resolved, so it cannot know the tenant. Rather
than showing a label that would be wrong for three tenants out of four for a
frame, it shows the *shape*: a pulsing bar where the product name goes, three
pulsing bars where the tabs go. The theme toggle and logout button are real,
because those are tenant-invariant and a dead-looking header is worse than a
partial one.

---

## 8. Rendering nothing, honestly

`features.scoring` is false on `cus` and `nimc`. Two tenants where every chart,
KPI, radar and triage surface would be a wall of dashes.

The rule applied throughout: **gate the whole section, never render an empty
one.**

```tsx
{features.scoring && (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <KpiCard label="Total sessions" ... />
    ...
  </div>
)}
```

Note that `Total sessions` moved *inside* the gate. It is a perfectly valid
number on `cus` — but as the sole populated card in a four-column grid it reads
as three broken cards rather than as one card. The count did not disappear; it
moved into the summary sentence, which on an unscored tenant reads:

> You've run 12 sessions. Open any one to play the recording back and read the
> transcript.

The analytics block has a three-way conditional with an explicit comment on why
the third branch exists:

```tsx
{features.scoring && allRounds.length > 0 ? (
  /* the charts */
) : features.scoring ? (
  /* "Run your first session and your progress will show up here." */
) : null}
```

On `cus` there is nothing to chart *ever*, so an empty analytics slot would be
permanent furniture. On `jer`/`nim` with zero rounds it is a temporary state
worth naming.

The Up Next empty state is likewise tenant-specific, derived from features
rather than tenant identity:

```tsx
features.company    ? `Nothing here yet — register a company to run your first interview.`
: features.assignments ? `Nothing assigned yet. Your educator will add scenarios here.`
:                        `Nothing published yet. Workflows your organisation publishes will appear here.`
```

Three genuinely different situations — nothing registered, nothing assigned,
nothing published — and each says whose move it is.

---

## 9. The charts

The analytics half is three cards, all fed from `aggregate()`.

### Sessions over time

`SessionsChart` offers four reads of the same history behind a segmented
control:

| Mode | What it draws |
| ---- | ------------- |
| **Scores** | One area+line: overall score per session |
| **By category** | One line per rubric topic — which areas are moving |
| **Both** | The category lines plus a bolder `--ink` overall on top |
| **Net change** | Session-over-session delta, with the zero line highlighted |

The multi-line modes get a **hover-to-preview / click-to-pin** legend. Pinning
dims the others to 18% via `color-mix(in oklch, …)` rather than swapping to a
grey, so the dimmed line keeps its hue identity. Hover always wins over pin
(`const active = hoveredLegend ?? pinned`), which makes exploration free — you
can look at another series without losing your pinned one.

One guard worth calling out:

```ts
if (len < 2) return <NeedMoreData message={emptyMessage} />;
```

This lives *inside* the chart, not at each call site, with the reason
documented: every caller of a line chart otherwise has to remember the same
rule, and the one that forgets renders an empty axis with a stray dot on it.
All hooks run above it, so the early return is legal.

The x-axis is synthetic. Points are labelled `S1, S2, S3…` on a fabricated
daily date scale, because — as the explainer says — *these are sessions in
order, not calendar dates*. Two sessions a month apart and two an hour apart
should compare as "attempt N vs attempt N+1".

### Average shape (radar) · Weakest first (bars)

The radar plots `overall.avgPerTopic` across `topics.map(t => t.label)` —
6 axes on both scored tenants, which is not a coincidence: `CLINICAL_TOPICS`
was held to six deliberately so it slots into every existing visual with no
changes. `presence` is first so it inherits `--chart-1` from `posture`; both
are the vision-fed topic, so a screenshot of one track reads like the other.

The bars sort ascending and highlight index 0 — weakest first, because the
question the card answers is "what do I practise next", and the answer should
be the top row.

### Chart help, in place

Every chart header carries a `ChartInfoButton` with 2–4 steps from
`src/lib/practice/chartExplainers.ts`. These explain not just what the chart is
but why it might mislead — the "Scale to fit" step exists because a fixed 0–10
axis makes tightly-clustered scores look flat, and a student reading a flat
line as "I'm not improving" is a real failure of the chart.

### And a sentence, above all of it

`summarizeStats()` turns numbers `aggregate()` already computed into one line:

> Your strongest area is Rapport and you're improving session over session —
> focus on Plain language next.

The KPI row uses qualitative labels too — `qualitativeTrend()` returns
"Improving" / "Steady" / "Declining" / "Not enough data" rather than `+0.4`,
with the exact figure on `title` hover. A student who reads no chart on the
page still leaves with the takeaway; the number is there for the one who wants
it.

---

## 10. Data path and the caching bug

```
requireUser(["practice"])                        → session + tenant
  └─ tenantConfig(user.tenant)                   → topics, features, copy
  └─ getUserCompaniesWithRounds(user.id)         → cached, tagged, one query
  └─ resumeChatCompanyIds(user.id)               → only if features.resume
       ├─ upNextFrom(...)                        → pure
       └─ aggregate(allRounds, topics)           → pure
```

`unstable_cache` with per-user tags, a 60s TTL as a safety net, and
`revalidateTag` on every mutation as the real invalidation mechanism.

Two things in `cachedQueries.ts` are worth preserving as lessons.

**Org ids go in the cache key, not in the closure.** Membership is not
derivable from `userId` inside the cached callback, and baking a stale org list
into a cached row would keep showing a workflow to someone who had left the
org. So `memberOrgIds()` runs *outside* and its result is part of the key.

**Dates come back as strings, and the types lie about it.** `unstable_cache`
JSON-serialises what it stores, so every `Date` field returns as a string on a
cache *hit* — while the return type, inherited from Prisma, still says `Date`.
It breaks at runtime, not at compile time. Hence `reviveDates()` and an
explicit `DATE_KEYS` set.

The guard at the top of that function is the scar tissue:

```ts
if (value instanceof Date) return value;
```

A cache *miss* returns live Prisma results where these are already real `Date`
objects. Without the guard they fell through to the object branch — and since a
`Date` has no enumerable own properties, `Object.entries` gives `[]`, rebuilding
it as `{}` and destroying it. The symptom was a page that rendered fine on a
cache hit and threw on a miss, i.e. right after any tag revalidation. And
because `{}` is truthy, it slipped past every `if (!round.completedAt)` guard
downstream and produced `NaN` durations.

`sessionDurationSeconds()` now defends independently:

```ts
if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
```

with the note that *a truthy-but-unparseable timestamp gives NaN here, and NaN
propagates silently all the way into the charts.*

---

## 11. The educator side

`/educator` is the same architecture pointed at a cohort, and it makes the same
lead-with-the-action choice — the top of the page is not a chart either.

Three queries in `Promise.all`, then pure metrics, then a sentence:

> 7 of 24 students are weakest on Plain language — and across 19 students with
> repeat sessions, scores have moved 5.2 → 6.4.

Then the section that justifies the page: **Students who need you.**

```ts
.filter((r) => r.stuck.length > 0)
```

`triageList()` omits students with nothing stuck. It is a to-do list, not a
roster — an educator scanning 200 names for the six that matter is doing the
software's job. The definition of "stuck" is behavioural rather than
score-based: the coach raised the same point repeatedly and the student never
took it on, so it stopped raising it.

Rows sort by number of stuck topics, then by total repeat count, so the most
comprehensively stuck student is first.

The funnel adapts per tenant through `funnelStages`: `jer` reports
assigned → resumeUploaded → started → completed → scored, `nim` drops the
resume stage (no resume gate, so no "stalled at resume" to report), `cus` keeps
only started → completed, `nimc` has none at all — the unit of work there is a
call, not an enrolment progressing through stages.

And the same `scoring` gate applies wholesale, with the same reasoning: nothing
on that page except the quota and the headcount survives a tenant with no
rubric.

---

## 12. Design system notes

**One accent, inverted.** `--brand` is `#18181b` on light and `#e4e4e7` on
dark — near-black and near-white. The product's chrome is monochrome; colour is
reserved for data and for status.

**Chart colours are separate from brand colours.** `--chart-1..5` (indigo
through the rest) are the data palette. They shift on dark (`#4f46e5` →
`#818cf8`) to hold contrast against `--canvas: #09090b`.

**Semantic colours always ship with text.** `--warning-soft`/`--warning`,
`--danger-soft`/`--danger`, `--success-soft`/`--success` back the deadline
badges, and each badge carries its label from `DEADLINE_LABEL` — a shared
constant so the student's badge and the educator's roster say the same word
about the same state.

**Skeletons mirror the real layout.** `PracticeSkeleton` renders a four-up KPI
grid, a tall block, and a two-up grid — the actual page geometry — so the swap
to real content does not reflow.

**`DashboardShell` keeps chrome out of the skeletons.** `user` is optional
specifically so loading states can render the same shell rather than a parallel
copy; the sidebar and header therefore do not shift when the real page swaps
in. Its `ROLE_LABEL` map stays exhaustive against the `Role` enum even for
roles it never renders (`practice` has its own shell), so adding a role is a
type error rather than a blank label.

---

## 13. Trade-offs

**Up Next has no cap.** A student with 30 units gets 30 cards. The sort puts
the right ones first, but this needs a "show more" fold before it meets a large
cohort. Currently deliberate — a fold on a list of four is worse than no fold.

**The accent hash can collide adjacently.** Five buckets, deterministic hash —
two neighbouring cards can share a hue. Acceptable because the accent encodes
identity only and the title always disambiguates, but it is a real visual wart.

**`export const dynamic = "force-dynamic"`.** The page is per-user and
session-gated, so it cannot be statically rendered. The `unstable_cache` layer
is what keeps it cheap; the route itself re-renders every hit.

**Timeline points for unscored rounds are zeros, not gaps.**

```ts
value: r.turns.some((t) => t.topics != null) ? overallScore(r, topics) : 0
```

An abandoned round plots at 0 and drags the line to the floor. Semantically it
should be a gap. Fixing it means teaching the line chart about null points.

**`aggregate()` runs in the request path.** Every metric is recomputed per
render from full turn rows. Fine at current volumes — the queries already
`select: { topics: true }` rather than fetching full turn text — but the
obvious next optimisation is a materialised per-round score.

**`localStorage` gates the tour, not the database.** A student who clears their
browser sees it again; the same student on a second device sees it twice.
`TourTrigger` exists so they can reopen it deliberately, which makes the failure
mode mild.

---

## 14. File map

| Path | Role |
| ---- | ---- |
| `src/app/practice/page.tsx` | The dashboard. Server component, ~215 lines, no data logic |
| `src/lib/practice/upNext.ts` | Card derivation + sort. Pure |
| `src/components/practice/UpNextCards.tsx` | Card rendering, accents, CTA forms |
| `src/lib/practice/deadline.ts` | The single definition of "late" |
| `src/lib/tenants/config.ts` | The four tenants: rubric, features, copy |
| `src/lib/practice/metrics.ts` | `aggregate()` and friends. Rubric passed in, never defaulted |
| `src/lib/practice/summarize.ts` | Numbers → one English sentence |
| `src/lib/practice/cachedQueries.ts` | Tagged caching + date revival |
| `src/lib/practice/chartExplainers.ts` | The (i) button content |
| `src/components/practice/PracticeHeader.tsx` | Tenant-named chrome |
| `src/components/practice/PracticeNavTabs.tsx` | Tenant-named tabs, tenant-agnostic hrefs |
| `src/components/practice/PracticeSkeleton.tsx` | Loading shell that doesn't guess the tenant |
| `src/components/practice/GuidedTour.tsx` | Tour built from the tenant's own nouns |
| `src/components/charts/bklit/SessionsChart.tsx` | Four-mode timeline with pinning legend |
| `src/app/educator/page.tsx` | The staff counterpart |
| `src/lib/practice/educatorMetrics.ts` | Triage, funnel, class-weakest |

One detail in `metrics.ts` deserves the last word, because it is the whole
multi-tenant thesis compressed into an API decision:

```ts
export function aggregate(rounds: RoundWithTurns[], topics: TopicMeta[]): Aggregate
```

`topics` is a **required** argument with no default. The comment explains why:
a default would let a caller silently score a clinical session against the
interview rubric and produce six zeroes that look like real data. The type
system is doing the work that a tenant `switch` would otherwise have to do by
hand, in every consumer, forever.

---

## 15. What's next

- **Fold Up Next past ~6 cards**, with the count in the fold label.
- **Null points in the timeline** so abandoned rounds are gaps, not zeros.
- **Persist tour-seen server-side** on the user row.
- **Materialise per-round overall score** and drop `aggregate()` out of the
  request path.
- **A `nimc` counsellor dashboard.** The calling track currently has a dialler
  and a call list (`NIMC_NAV` is two items on purpose — the v1 surface is "dial
  someone" and "look at what was said"). It has no roll-up at all, and unlike
  `cus` it plausibly wants one: calls per day, connect rate, extraction
  completeness. None of those are rubric scores, so `features.scoring` is the
  wrong gate for it — that will need a fifth config flag rather than a fifth
  branch.
