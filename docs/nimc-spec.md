# `nimc` — university admissions calling agent

**Status:** design spec, not built. Data acquisition (how calls get made and
transcribed) is explicitly out of scope here — this covers the model, the
tenant wiring, and the counsellor's screen.

---

## 1. Why this one doesn't fit the practice model

The three existing tenants share a shape that `nimc` inverts on every axis:

| | `jer` / `nim` / `cus` | `nimc` |
|---|---|---|
| Who logs in | the person who was recorded | a counsellor who was not on the call |
| Who is on the call | a `User` | a **lead** — no account, may never have one |
| What is assessed | the logged-in user | the *other* party |
| Unit of work | `PracticeCompany` | a lead |
| Volume | tens of rounds per user | thousands of calls per org |

The load-bearing difference is `PracticeRound.userId → User`. A callee is a
phone number, not an account, and never will be one. Bending `PracticeCompany`
into "a lead" would put a `companyName` on a person and hand every lead the
assignment/deadline/resume machinery they have no use for.

**So: new models (`Lead`, `LeadCall`, `LeadEvent`), not new columns on the
practice tree.**

### What is reused unchanged

- `tenantConfig()` — features and copy, exactly as the other three consume it
- `deadlineState()` — callback due times are the same "due date + grace" problem
- The recording pipeline — filesystem storage keyed by id, and the range-serving
  `GET` route (`src/app/api/practice/rounds/[id]/recording/route.ts`) is already
  the right shape; it needs a sibling for calls with its own auth rule
- `FunnelBar`, `TriageTable` — the educator-side components are the right
  primitives for stage counts and a priority list
- The stereo channel split from the recorder (agent left, lead right) — makes a
  two-lane waveform essentially free

---

## 2. Roles and visibility

**One role: `nimc_counsellor`. Every counsellor sees every lead.**

No per-counsellor assignment, no director view, in v1. This is a deliberate
scope cut for a single-campus pilot, and it has one consequence worth writing
down: **there is no "my leads" filter, so the priority sort is the only thing
standing between a counsellor and 4,000 rows.** The sort is therefore not a
nicety — it is the product. See §5.

Leads belong to a `PracticeOrg` (the existing model already means "the
institution this account belongs to"), so multi-campus works later without a
migration. What is *not* built now is the director role that would read across
orgs.

**Deferred, in the order I'd add it:** lead ownership → a director/manager view
→ per-counsellor throughput. The schema below leaves `ownerId` nullable from
day one so ownership is an additive change rather than a backfill.

---

## 3. Schema

Following existing conventions: `cuid()` ids, `@map` snake_case, enums
lowercase, `createdAt` on everything, comments explaining *why* a field is
nullable.

```prisma
enum Tenant {
  jer
  nim
  cus
  nimc   // ← new
}

enum Role {
  // ...existing
  nimc_counsellor
}

/// Where the lead sits in the admissions funnel. Ordered — the funnel bar
/// and the "furthest reached" roll-up both depend on declaration order.
enum LeadStage {
  new            // never dialled
  attempted      // dialled, never connected
  contacted      // spoke to someone
  interested     // expressed genuine intent
  applied        // application started
  enrolled       // fee paid / seat confirmed
  lost           // explicitly declined, or exhausted
}

/// How warm this lead is RIGHT NOW. Distinct from stage: a lead can be at
/// `interested` and have gone cold, and that pair is exactly the lead a
/// counsellor most needs to see.
enum LeadIntent {
  hot
  warm
  cold
  unknown        // never connected, so nothing to judge
}

/// Verdict, not raw marks. The counsellor needs the conclusion on the row;
/// the marks that produced it live in `Lead.academics`.
enum EligibilityVerdict {
  eligible
  borderline     // meets the course, misses a scholarship or a cutoff band
  not_eligible
  unverified     // claimed on the call, nothing checked
}

/// Why a call ended the way it did. Drives the callback queue.
enum CallOutcome {
  connected
  no_answer
  busy
  invalid_number
  wrong_person
  declined_immediately
  callback_requested
  voicemail
}

model Lead {
  id        String @id @default(cuid())
  orgId     String @map("org_id")
  /// Nullable from day one: v1 has no per-counsellor assignment, and leaving
  /// the column here means adding ownership later is additive rather than a
  /// backfill against a live table.
  ownerId   String? @map("owner_id")

  /// E.164. The identity of a lead — everything else may be unknown after a
  /// call that never connected.
  phone     String
  /// Null until someone actually picks up and gives it.
  name      String?
  email     String?

  stage     LeadStage  @default(new)
  intent    LeadIntent @default(unknown)

  /// Which programme they asked about. Free text, not the Degree enum: a
  /// caller says "computer science" and the mapping to a catalogue entry is
  /// a separate problem we have not solved yet.
  courseInterest String? @map("course_interest")

  eligibility    EligibilityVerdict @default(unverified)
  /// The marks behind the verdict: { tenth, twelfth, board, entranceRank,
  /// stream }. Shape deliberately loose — boards and entrance exams vary by
  /// state and we do not want a migration per exam.
  academics      Json?
  /// Free text, e.g. "Nashik" / "outside Maharashtra". Drives hostel and
  /// travel objections more than it drives eligibility.
  residence      String?

  /// Language the lead was comfortable in. Directly changes who should make
  /// the next call, which is why it is a column and not a tag.
  language       String?
  /// Learned from which attempts actually connected — "weekday evenings".
  bestTimeToReach String? @map("best_time_to_reach")

  /// Who actually decides. In this market it is frequently not the student,
  /// and "father wants a campus visit" is a different next action from
  /// anything the student says.
  decisionMaker  String? @map("decision_maker")
  /// Institutions named on the call as alternatives.
  competingWith  String[] @map("competing_with")

  /// Where the lead came from — ad set, education fair, walk-in, referral.
  source         String?
  campaign       String?

  /// When to call back, from the lead's own words. Read through
  /// deadlineState(), same as PracticeAssignment.dueDate.
  callbackAt     DateTime? @map("callback_at")
  /// Denormalised from LeadCall for sorting — a priority sort over thousands
  /// of rows cannot afford a join per row.
  lastCallAt     DateTime? @map("last_call_at")
  attemptCount   Int       @default(0) @map("attempt_count")

  /// Consent + suppression. Boring until a regulator asks.
  consentAt      DateTime? @map("consent_at")
  doNotCall      Boolean   @default(false) @map("do_not_call")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  org    PracticeOrg @relation(fields: [orgId], references: [id], onDelete: Cascade)
  owner  User?       @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  calls  LeadCall[]
  tags   LeadTag[]

  /// One lead per number per org. The whole point of lead-centric rows.
  @@unique([orgId, phone])
  @@index([orgId, stage])
  @@index([orgId, callbackAt])
  @@map("nimc_leads")
}

model LeadCall {
  id       String @id @default(cuid())
  leadId   String @map("lead_id")

  outcome  CallOutcome
  startedAt DateTime  @map("started_at")
  durationSeconds Int? @map("duration_seconds")

  /// AI-written, counsellor-facing. The single most-read field in the product.
  summary   String?
  /// Speaker-split turns, same shape discipline as PracticeTurn but without
  /// the scoring dict — nothing here is graded.
  turns     LeadTurn[]

  recordingStatus RecordingStatus @default(none) @map("recording_status")

  createdAt DateTime @default(now()) @map("created_at")

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([leadId, startedAt])
  @@map("nimc_lead_calls")
}

model LeadTurn {
  id        String  @id @default(cuid())
  callId    String  @map("call_id")
  turnNumber Int    @map("turn_number")
  /// `agent` or `lead` — reusing Speaker would mean calling a prospective
  /// student "student", which they are not yet.
  speaker   CallSpeaker
  transcript String
  /// Offset from call start, for transcript↔waveform sync. Seconds, not a
  /// timestamp: the player needs a scrub position, not a wall clock.
  offsetSeconds Float? @map("offset_seconds")

  call LeadCall @relation(fields: [callId], references: [id], onDelete: Cascade)

  @@index([callId])
  @@map("nimc_lead_turns")
}

enum CallSpeaker {
  agent
  lead
}

/// Tags are a table, not an enum: the objection taxonomy WILL change every
/// intake season, and a migration per new objection is the wrong cost.
model LeadTag {
  id     String @id @default(cuid())
  leadId String @map("lead_id")
  /// Slug from the taxonomy in §4. Free-form so the model can emit a tag we
  /// have not catalogued yet rather than dropping the signal.
  key    String
  family String
  /// Which call first raised it — lets the drawer jump to the moment.
  callId String? @map("call_id")

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@unique([leadId, key])
  @@index([leadId])
  @@map("nimc_lead_tags")
}
```

### Notes on the shape

- **`attemptCount` and `lastCallAt` are denormalised onto `Lead` on purpose.**
  The default view sorts thousands of rows by priority; computing attempts via
  a join per row is the thing that makes this page slow at 5k leads.
- **`competingWith` is an array, not a tag family.** It is a list of proper
  nouns, not a controlled vocabulary — putting it in `LeadTag` would pollute
  the tag namespace with every college in the state.
- **No `overallScore` anywhere.** Nothing here is graded; `intent` is a
  judgement about the lead, not a mark. See §6 on why `features.scoring` is
  false and what that switches off for free.

---

## 4. Tag taxonomy

Four families. Family matters because the UI groups by it and the aggregate
views only make sense within one.

**`objection` — why they might not come. The highest-value family.**
`fees` · `distance` · `hostel` · `placement_doubt` · `parental_approval` ·
`competing_offer` · `loan_needed` · `scholarship_needed` · `course_not_offered` ·
`timing_batch`

**`interest` — what they engaged with.**
`placement_record` · `campus_facilities` · `faculty` · `curriculum` ·
`internships` · `location` · `fee_structure` · `scholarship`

**`action` — what was promised or is owed.**
`callback_requested` · `brochure_sent` · `campus_visit_planned` ·
`application_link_sent` · `counsellor_escalation` · `fee_quote_sent`

**`quality` — data-hygiene signals, mostly for ops.**
`wrong_number` · `not_the_student` · `language_mismatch` · `duplicate` ·
`do_not_call` · `already_enrolled_elsewhere`

Two rules that keep this useful:

1. **A tag is evidence, never a decision.** `fees` means it came up, not that
   they cannot pay. The decision lives in `stage` and `intent`.
2. **`objection` tags are additive across calls and never auto-cleared.** A
   fee objection that was answered in call 3 is still the reason call 2 went
   badly, and clearing it destroys the trajectory the counsellor is reading.

---

## 5. The screen

One page, one table, one drawer. No sub-navigation.

### 5.1 KPI row

Chosen so that **every card is either an action or a rate** — no vanity totals.
"Calls made" is deliberately absent: nobody does anything differently because
it went from 900 to 950.

| Card | Definition | Why |
|---|---|---|
| **Callbacks due** | `callbackAt <= now`, not `lost`/`doNotCall` | The only card that is also the default filter. Click → table filters. |
| **Connect rate** | connected ÷ dialled, last 7d | The health of the calling itself, not of the leads |
| **Hot leads** | `intent = hot`, not `applied`/`enrolled`/`lost` | The queue that decays fastest |
| **Went cold** | `intent = cold` **and** stage ≥ `interested` | Leads that were won and are being lost — the highest-regret cohort, and invisible on any single-axis view |
| **Applications started** | count at stage ≥ `applied`, this intake | The step a counsellor actually influences |

"Went cold" is the one card here that does not exist in an off-the-shelf CRM
dashboard, and it is the one I would fight to keep — it is the only card that
surfaces *deterioration* rather than volume.

### 5.2 Line chart

Calls per day, three series:

- dialled (faint, context)
- connected (primary)
- reached `interested` (accent)

Plus a compact `FunnelBar` beside it for the stage snapshot. The line chart
answers "is the calling working"; the funnel answers "where do people stop".
Both are needed, neither substitutes for the other.

Two design notes carried from the existing charts: series colours come from
`--chart-*`, and the funnel omits stages the tenant does not use — same rule
`funnelStages` already encodes for the other three tenants.

### 5.3 Table

Rows are **leads**, one per person ever, sorted by a priority score (§5.5).

| Column | Content | Notes |
|---|---|---|
| Lead | name (or number if unknown) · attempt count | Number when nameless — a lead with no name is a real state, not an empty cell |
| Course | `courseInterest` | Free text |
| Eligibility | verdict chip | `eligible` / `borderline` / `not eligible` / `unverified`, colour **and** text |
| Intent | hot / warm / cold chip | ditto |
| Stage | funnel position | |
| Tags | up to 3 chips, `objection` family first, `+n` overflow | Objections first is the point — that is what they prep against |
| Last call | relative time + outcome icon | "2d ago · no answer" |
| Next action | callback due, or the top owed `action` tag | The column that makes the table a worklist rather than a log |

Phone number is **not** a column — it is in the drawer and behind the click-to-call.
It is 10 digits of noise on a row whose identity is already the name, and it
costs the horizontal space the tags need.

Summary, transcript and recording are **not** columns. They do not compress to
a cell, and putting them there is what turns a scannable worklist into a wall.

### 5.4 Drawer (slide-over)

Opens on row click, does not navigate away.

1. **Header** — name, number (click-to-call), stage + intent, eligibility verdict
2. **Next action** — callback time, owed actions, one-click reschedule
3. **Call history** — reverse chronological, each entry collapsible:
   - AI summary (open by default on the most recent)
   - player + **two-lane waveform** (agent / lead, from the existing stereo split)
   - transcript, speaker-split, click a line to seek via `offsetSeconds`
4. **Objections** — every `objection` tag with the call it came from, so a click
   jumps to that moment in that recording
5. **Detail** — academics behind the verdict, residence, language, decision
   maker, competing institutions, source/campaign
6. **Compliance** — consent captured, DNC state

### 5.5 Priority sort

With no per-counsellor assignment (§2), this is the only thing making the page
usable. Descending:

1. Callback overdue — they asked, and we are late
2. Callback due today
3. `hot`, not contacted in 48h — decaying fastest
4. Went cold from `interested` — recoverable, and the most expensive to lose
5. `new`, never dialled
6. `warm`, ordered by staleness
7. Everything else
8. Sunk to the bottom, never hidden: `lost`, `doNotCall`, `invalid_number`

Never *hides* rows — a counsellor who cannot find a lead they remember will
stop trusting the list, and one filter-shaped surprise costs more than the
scroll. Filters are explicit and visible.

---

## 6. Tenant config entry

Every existing flag stays meaningful, which is the check that this belongs in
the same config rather than a parallel one:

```ts
nimc: {
  key: "nimc",
  label: "Admissions calling",
  domains: ["nimc.com"],
  track: "calling",              // ← new track
  topics: [],                    // nothing is graded, same as cus
  features: {
    company: false,
    resume: false,
    research: false,
    scenario: false,
    workflow: false,
    scoring: false,              // switches off every rubric surface for free
    assignments: false,
    autoEnroll: true,            // one org per deployment, no class code
    courseField: false,
  },
  funnelStages: [...],           // see below
  copy: {
    unitSingular: "lead",
    unitPlural: "leads",
    unitTitle: "Lead",
    sessionNoun: "call",
  },
}
```

**`scoring: false` is doing real work.** Everything already gated on it —
KPI rubric cards, radar, topic timelines, the guided tour, `TopicBars` — stays
off with no new conditionals, exactly as it does for `cus`.

**`funnelStages` needs widening.** It is currently
`assigned | resumeUploaded | started | completed | scored`, which is
practice-shaped. `nimc` wants the `LeadStage` values. Cleanest fix is to make
`FunnelStage` a per-tenant string list with labels rather than a shared union —
a small refactor that also stops the other three from carrying stages they do
not use.

**The student-surface guard needs extending.** `scripts/verify-tenant-surface.ts`
scans `/practice/*`; `nimc` will live under its own route and needs the same
banned-noun scan, with `lead` / `call` added to the taxonomy.

---

## 7. Open questions

1. **Does a lead ever become a `User`?** At `enrolled` they plausibly get an
   account. If so, `Lead.userId` is an eventual nullable link — worth deciding
   before the unique constraint on `(orgId, phone)` hardens.
2. **Who resolves duplicates?** Same person, two numbers. `@@unique([orgId,
   phone])` makes them two leads, and nothing merges them today.
3. **Is `courseInterest` free text forever?** It should eventually key a
   programme catalogue so eligibility can be computed rather than asserted.
4. **Retention on recordings.** Admissions calls with minors are a different
   risk profile from practice sessions. The storage layer is filesystem with no
   TTL today.
5. **Who writes `intent`?** Model-inferred per call, counsellor-editable, or
   both with the manual value winning? Affects whether it needs an audit trail.
