# PrepAI — product brief for the home page

A knowledge-transfer document for the designer building the home page. It
describes what the product is, who uses it, what happens minute by minute, and
which parts are differentiated enough to earn a section on a landing page.

Everything here is checked against the source. Where something is a stub or not
yet live, it says so — don't design a hero around it.

---

## 1. The product, in one sentence

**PrepAI is a live, voice-and-video conversation you practise with an AI, that
watches and scores you as you speak — and a dashboard your educator reads
afterwards.**

A learner opens a browser, clicks Start, and talks — out loud, on camera — to an
AI that asks real questions, notices how they sit and where they look, coaches
them at the right moments rather than after every sentence, and scores every
turn against a rubric. Their educator opens a dashboard and sees who is stuck,
on what, and who has stopped showing up.

It is not a chatbot with a microphone bolted on, and the home page shouldn't
look like one. The unit of the product is a **session**: a real-time call,
recorded, transcribed, scored and replayable.

---

## 2. One product, fitted to each customer

Every customer gets the same product. What changes is the **conversation they
practise, what they're judged on, and what things are called** — so it arrives
already speaking their language rather than as a generic tool they have to
translate.

There's one route table, one database schema, one chart library, one metrics
module. A customer's configuration selects three things and nothing else:

1. **The scenario** — who the AI plays and what it asks about.
2. **The rubric** — the dimensions each turn is scored on (and whether it's
   scored at all).
3. **The vocabulary** — a session is an *interview* to an engineering student, an
   *encounter* to a medical student, a *call* to a counsellor. Same screen, same
   data, different word.

Everything downstream — every chart, every metric, every roll-up — reads the
rubric generically and never names a dimension. That's why a new customer
inherits the entire analytics layer on day one, already labelled in their own
terms.

**How it's deployed today**, as evidence of range rather than as a product list:

- Interview coaching for engineering students — practise against a real company,
  scored on how you build an answer.
- Clinical-communication training for medical students — talk to a simulated
  patient the teacher authored, scored on empathy, plain language and dignity.
- Conflict-handling and service-recovery roleplay — face a hostile client or an
  unhappy customer at a returns counter, with a running score you watch move.
- Outbound admissions calling — the agent dials a real phone number and comes
  back with a transcript and the facts it collected.
- Bring-your-own — the customer's own admin writes the greeting and the prompt,
  and every user of that organisation has it immediately.

**What this means for the home page.** Don't present these as five products or
five plans. They're **five shapes of the same session**, and the right treatment
is probably one visual of the room with the scenario swapping inside it. The
promise is: *whatever conversation your people need to get good at, this is that
conversation, scored.*

A learner is routed to their organisation's configuration automatically from
their email domain at signup, so a single CTA works for everyone.

---

## 3. The two people in the product

### The learner — student, trainee, candidate, counsellor
Signs in and sees four things: what to do next, doing it, how it went, and (on
the interview configuration) a resume builder.

### The educator — teacher, placement officer, workspace admin
Authors the thing to practise, assigns it to a class with a deadline, then reads
the results. Nav is: Dashboard · Companies (or Scenarios, or Workflows — the
same page, renamed) · Classes · Students · Report.

> The tree also holds a university-admin and a super-admin dashboard from an
> earlier version of the product. Both currently redirect away and are not live.
> Don't design for them.

---

## 4. The learner journey, screen by screen

This is the spine of the product and the thing the home page is selling.

### 4.1 Get in
Sign up, or join a class with a code. Some organisations skip the code entirely
— anything the admin publishes reaches everyone at once.

### 4.2 The dashboard — "Up Next", not charts
The page used to open on charts, which meant a first-week learner saw a single
dot on an empty axis, and the thing they actually came to do was four
navigations away.

It now opens on **Up Next**: a sorted list of cards, each one something they can
start right now, in one of three states — ready, needs-a-resume-first, or locked
because the deadline passed and the educator must reopen it.

Below that: KPI cards, sessions over time, a radar of their average shape across
the rubric, and a weakest-first bar chart. Every chart carries an in-place
explainer, and above all of it sits **one plain sentence in English** saying what
the charts say — because a chart is not an answer.

Deadlines are a real rule, not decoration: a 48-hour grace window, three states,
and the badge the learner sees is driven by the same shared constant as the badge
the educator sees, so they can never say different words about the same state.

### 4.3 The brief — what you're walking into
Before the session, a briefing page. On the interview configuration: live
research on the company — what they do, how they interview, the topics they
drill, sample questions, their values, and the source URLs — plus a personalised
expectation table built from the learner's degree and grades. On the clinical
one: the patient's case.

That research is generated once by an agentic model doing its own live web
search, then **reviewed and edited by the educator before it's published**, and
never re-run. That review step is a trust feature and worth saying out loud.

### 4.4 The live room — the product
What the learner sees and does:

- A pre-flight screen: *"Ready when you are."* Mic and camera are requested. On
  some configurations they choose their interviewer from a set of personas.
- Two tiles: **their own webcam feed**, and the **agent** — which on roleplay
  configurations is a video avatar that visibly switches between angry and calm
  as the trainee manages them.
- A **live transcript** streaming down the side as it's spoken.
- A **push-to-talk hold button**, a connection pill, an elapsed timer, and the
  AI's state — waiting, listening, thinking, speaking.
- On the retail roleplay, **physical scene props render on screen**: the customer
  hands over a receipt, passes the shirt, raises his phone, an escalation form
  appears. Plus a running pass/retry/fail score the trainee watches move.
- The whole session is **recorded** — webcam video plus a two-channel audio mix,
  agent on one side, learner on the other — and uploaded in the background.

Underneath: WebRTC to a voice server, streaming speech-to-text, text-to-speech,
an LLM graph, and a webhook writing each turn to the database as it lands.

### 4.5 The results page — the replay
An animated timeline of every dimension's score turn by turn with **the moments
marked** where something actually happened, a radar showing Start vs Latest,
weakest-first bars, the full transcript, and the recording to play back.

### 4.6 Resume Studio
On the interview configuration: a chat where the agent writes the learner's
resume in real LaTeX, the server compiles it to PDF, and the rendered page sits
live beside the conversation. Every reply can rewrite the document; they download
the PDF whenever they like. Separately, a per-company resume chat where the
resume is the *input* and the output is tailored advice.

---

## 5. The educator journey

1. **Author it.** Type a company and job description → live web research fills in
   a reviewable profile. Or type one line — *"truck driver, 68, newly diagnosed
   diabetes, worried about losing his licence"* — and get back a structured,
   editable patient case. Or just write a greeting and a prompt.
2. **Assign it** to a class, with a due date and a minimum number of sessions.
   Later, change the mode or unlock it for someone who missed it.
3. **Read the dashboard.** Class-wide weakest dimension, a funnel from assigned
   through started to scored, first-vs-latest growth, bail-outs (who quit
   mid-session), quota remaining.
4. **The triage list** — the highest-signal thing in the product. It surfaces
   learners where *the coach kept raising the same point and they never took it
   on*. Since the AI is instructed to permanently drop a point once someone shows
   zero engagement with it, this list is literally "the things the AI has given
   up on." That's a human's job now.
5. **Open one session** — transcript, scores, recording.
6. **Print the report** — a deliberately chrome-free page built to be printed to
   PDF and handed to a head of department.

---

## 6. What's genuinely differentiated

These are all real in the code and each could carry a section.

**It watches, not just listens.** A vision pipeline reads the webcam and reports
what the body and the scene are *doing* — posture, whether the face is straight
on to camera, whether they're fully in frame and well lit, hand gestures. It
reports observations only and is explicitly forbidden from inferring mood,
nerves or confidence from a face. If two people are in frame it refuses to judge
anything visual for that turn, because attributing one person's posture to
another is worse than reporting nothing.

**It coaches on a rhythm, not after every sentence.** Early versions corrected
the learner on every turn, and that's exactly what made it feel like a machine —
no real interviewer corrects you after every sentence, and someone corrected
eight times in a row remembers none of it. Sessions now alternate between turns
that just ask and listen, and checkpoints roughly every fourth answer that stop
and deliver one or two points drawn from the whole stretch.

**Scores are earned upward from zero, never deducted from a number you never
had.** Every dimension starts at 0, and 0 means "not shown yet", not "bad". A
score only moves on a turn where something specific and named happened, so every
point is attached to a stated reason you can click on. Movement is deliberately
asymmetric: +3 is the most that can be gained in a turn, −1 the most that can be
lost, and **a decrease requires a pattern across at least two turns** — because
this is live speech through automatic transcription, and someone losing marks for
a dropped word is being graded on their microphone, not their answer.

**You're never marked down for something nobody told you.** A criticism can only
be recorded on a turn where the flaw was said out loud. Credit isn't bound that
way — earning something has nothing to do with whether the interviewer chose to
mention it.

**Two models, so the scorer can't lie.** The interviewer and the scorer are
separate. The scorer is handed the finished spoken text *after* it's gone to the
speaker, so it can only score what was actually said. Before that split, the
model was self-reporting coaching it had never delivered, and learners were being
marked down for advice nobody gave them.

**It remembers you said you didn't know.** When someone plainly says they don't
know something, that subject closes for the session. This came from a real
failure: a student said he didn't know what an F1 score was, and the agent kept
coming back to it from new angles for the rest of the session. Naming a gap
plainly is now treated as a strength and never coached.

**Recording, transcript and scores are one artefact**, not three tools stitched
together.

---

## 7. Where the product is honest about its limits

Useful so the page doesn't over-promise — and useful as a tone. This product's
voice is measured and specific, not hyped.

- Some configurations are **deliberately not scored at all**, and every chart and
  KPI switches off rather than rendering a page of dashes. *"Some conversations
  shouldn't be scored"* is a defensible thing to say on a landing page.
- The team has written down, at length, the strongest argument against the
  product — that a model fit to past data rewards conformity to the past, which
  lands hardest on vernacular-medium, first-generation, tier-2/3 students — and
  treats it as an argument to be met rather than managed (`docs/human-touch.md`).
  There's a positioning opportunity here: **the product is explicitly not a
  replacement for the educator, and the triage list is the educator's lever.** If
  the page has an objection-handling section, this is what goes in it.
- Transcription failure becoming a score is a known, named defect, and the
  asymmetric scoring rules above exist because of it.

---

## 8. The visual system as it stands

The app already has a design system (`src/app/globals.css`, and §12 of
`docs/dashboard-case-study.md`). The home page needn't obey it, but shouldn't
contradict it.

- **Monochrome chrome, one accent, inverted per theme.** The accent is near-black
  on light, near-white on dark. The interface itself is greyscale.
- **Colour is reserved for two things only: data, and status.** The chart palette
  (indigo-led) is separate from the brand palette and shifts on dark to hold
  contrast.
- **Semantic colours always ship with their word** — every warning, danger and
  success badge carries a text label, never colour alone.
- Light and dark are both first-class; there's a theme toggle.
- Inter, on an 8pt grid. shadcn components, Tailwind 4, and a bespoke chart layer
  — line, radar, funnel, ring, scatter, composed bar-plus-line.
- Skeleton loaders mirror the real page geometry exactly, so nothing reflows.

---

## 9. What the home page needs to do

In priority order:

1. **Show a session in the first screen.** Someone on camera, an agent, a live
   transcript, a score moving. The product is impossible to understand from words
   and instantly obvious from ten seconds of video. If there's one asset to
   commission, it's this.
2. **Name the two audiences separately and early.** The learner buys *"practise
   until it stops being scary."* The educator buys *"I can finally see who's
   stuck without running forty mock interviews myself."* Different promises;
   don't blend them into one paragraph.
3. **Show the range as one room, not five products.** The same session with the
   scenario swapping inside it — interview, patient, angry customer, phone call,
   your own. This is what turns "an interview tool" into something a hospital or
   a retail chain can see themselves in.
4. **Make the scoring legible and trustworthy.** §6 is the real moat and the
   answer to *"why should I believe an AI's judgement?"* A visual of a score
   timeline with one labelled moment — *"gave a number without being asked to,
   +2"* — does more than any adjective.
5. **Handle the objection.** *"Doesn't this replace teachers?"* No — the triage
   list exists to hand the hard cases back to a human, and some configurations
   refuse to score at all.
6. **A soft CTA per audience.** Learners → try a session. Institutions → see the
   educator dashboard, book a walkthrough.

### Not on the home page
- The disabled university-admin and super-admin dashboards.
- Anything implying the AI makes a hiring or pass/fail decision. It coaches and
  reports; the human decides.
- "Human-like AI" as a claim. The documented position is that warmth is the least
  important thing to fix, and that responsiveness, memory and explainability are
  what actually make an interaction feel human. Show those instead.

---

## 10. Where to look in the repo

| What | Where |
|---|---|
| The per-customer configuration, one page, fully commented | `src/lib/tenants/config.ts` |
| The live room — everything the learner sees | `src/components/interview/InterviewRoom.tsx` |
| The scoring rules, in prose, at the top of the file | `src/lib/voice/practiceCustoms.ts` |
| Learner dashboard | `src/app/practice/page.tsx` |
| Results / replay | `src/app/practice/rounds/[id]/page.tsx` |
| Educator dashboard | `src/app/educator/page.tsx` |
| Triage list logic | `src/lib/practice/educatorMetrics.ts` |
| Design system tokens | `src/app/globals.css` |
| Full design case study — 690 lines, worth reading | `docs/dashboard-case-study.md` |
| The objection document | `docs/human-touch.md` |
| Resume Studio | `docs/resume-studio.md` |
| Calling configuration spec | `docs/nimc-spec.md` |
| Demo logins | `docs/logins.md` |

Best single thing to hand the designer alongside this:
**`docs/dashboard-case-study.md`**. It's already written as a design document and
explains why the current screens look the way they do.
