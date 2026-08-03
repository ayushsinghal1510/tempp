# "It lacks human touch"

Notes from working through one educator's objection to the `jer` interview
track, and what it turned out to be about.

This is a strategy document, not a spec. It records what was said, what the
codebase actually does, and which of the two the problem lives in. Where it
describes a person's motives it is guessing, and says so — see
[Reading people from paraphrase](#reading-people-from-paraphrase) at the end,
which is the part most worth remembering.

---

## 1. What "human touch" can mean

The phrase is doing an enormous amount of work. Almost every use of it below
was collected from one conversation, which is itself the point: it is the
single most available way to decline something, and it costs the speaker
nothing to say.

Sorted by whether you can do anything about it.

### A. Product properties — real, and buildable

| Meaning | What it actually asks for |
|---|---|
| **Responsiveness** | Did it react to *me*, visibly, in the moment? Evidence of reception rather than an assertion of it. |
| **Recognition** | Does it know who I specifically am? (Named in the literature as *uniqueness neglect* — see §5.) |
| **Adaptivity** | Can it be surprised? Follow a thread it didn't plan? Or does it run its script regardless. |
| **Repair** | When it misunderstands mid-conversation, can it recover the way a person does? |
| **Explainability** | Can I find out *why* it judged me that way. Opacity reads as inhuman. |
| **Recourse** | Is there anyone to appeal to when it's wrong. A verdict with no appeal is not a human interaction. |
| **Judgment vs measurement** | A person weighs context. A rubric sums axes. Being scored feels different from being understood. |
| **Warmth / affect** | Tone, encouragement, emotional register. The obvious reading — and per the research, the *least* reliable thing to fix. |
| **Embodiment** | Face, voice quality, presence, turn-taking rhythm. |

### B. Epistemic claims — arguments, not feelings

| Meaning | The claim |
|---|---|
| **"AI learns from the past"** | A model fit to past data rewards conformity to the past. It cannot recognise merit that doesn't match the template. In India this lands hardest on vernacular-medium, first-generation, tier-2/3 students. **The sharpest argument anyone made in this conversation.** |
| **Acquisition ≠ assessment** | A language-teaching position: capability develops through interaction and negotiated meaning with someone who notices what *you* specifically don't know. Scoring a performance is a different activity from developing a skill. |
| **Standing to judge** | Judgment requires a judge who can be held responsible. A machine cannot be. |

### C. Trust and accountability

| Meaning | The concern |
|---|---|
| **Accountability** | Who is answerable when it gets someone wrong. |
| **Asymmetric tail risk** | One bad interaction becomes an anecdote that circulates for years; a thousand adequate ones are invisible. Buyers price the tail; users experience the median. |
| **Devil you know** | Documented preference for human evaluators *despite* acknowledged human bias — the failure mode is at least familiar. |

### D. Social and institutional — a product costume over something else

| Meaning | What's underneath |
|---|---|
| **Status** | What *adopting* says about the buyer. "We are the kind of institution that gives students human attention." Adopting admits you can't. |
| **Role preservation** | What happens to the person whose function this overlaps. Rarely stated directly; almost never stated by the person it applies to. |
| **Labour displacement** | It works, and deploying it is *my* unpaid coordination work. |
| **Social permission** | Personally convinced, unwilling to go first. Waiting for a peer institution to move. |
| **Category reputation** | "I've seen these kinds of things." An inherited verdict, no direct experience — and often no direct experience anywhere in the chain. |
| **The polite no** | Unfalsifiable, costless, and makes the speaker sound thoughtful rather than obstructive. Reached for reflexively when the real reason is budget, authority, or disinterest. |

### E. Genuine defects that get called "human touch"

Because it's the nearest available word, not because the speaker is confused.

- **Mis-hearing.** ASR failure on accent, code-switching, poor audio — a
  student says something good, the system scores what it thought it heard.
- **Latency and turn-taking.** Gaps in the wrong places read as inattention.
- **Scripted repetition.** Asking something already answered is the single
  most reliable way to prove nobody is listening.

### The useful cut

**Falsifiable** (A, E) — build, then demonstrate.
**Arguable** (B) — meet on the merits; these deserve a real answer, not management.
**Not about the product at all** (C, D) — no feature moves these. Peer proof,
economics, and giving the objector something to gain do.

Diagnosis matters because the categories have disjoint fixes, and the default
instinct — add warmth — addresses the least important row of the least
important category.

---

## 2. How this particular conversation moved

Recorded in order, because every new fact overturned the previous reading.
That pattern is the finding.

1. **"Students loved it, an educator said it lacks human touch."**
   Initial read: the objection comes from non-users; make the buyer a user.
2. **"She used the interview herself, then said *not ours, others*."**
   Re-read as the *third-person effect* — judging that a medium affects others
   more than oneself. Advice: force the imagined constituency to speak.
3. **"She never looked at the dashboard. Not even the demo."**
   Both readings collapse. This is a **category verdict from priors**, not an
   experience report. No demo can reach it, because no demo was consulted.
4. **The Bharat English Test precedent.** A company proposed an AI interview;
   it was **denied** on human-touch grounds. So the cited precedent is a
   *rejection, not a failure* — no deployment, no bad experience, no evidence.
   Each refusal becomes the citation for the next refusal. Self-reinforcing and
   evidence-free, which is exactly why demos bounce off it.
5. **"At the end of the day AI learns from past experiences."** The best
   argument made by anyone here. See §1B.
6. **"A transcription failure can become a score."** Confirmed defect. See §3.
7. **"Students aren't serious. We'd arrange sessions for 5–7 days, then they'd
   go on their own — but that's a lot of management."**
   The pivot. This is not an objection to the product; it **assumes the product
   works**, and prices the rollout. The blocker is *labour*, and it lands on
   her. It also independently reproduces the published finding that
   faculty-embedded pilots work where launch emails don't.
8. **"Don't do it at JECRC — do it for Arya, Amity, places that have nothing."**
   Third instance of *not us, them*. Reads as status, or as someone with no
   budget authority doing you a favour. Distinguishable cheaply — see §6.
9. **"She's an English teacher."** In most Indian engineering colleges the
   English/communications faculty *is* the soft-skills department: spoken
   English, GDs, mock interviews, resume writing. That is not adjacent to this
   product's surface area, it **is** this product's surface area. The
   job-overlap reading gets materially more credible. It also explains the BET
   citation — English assessment is her field, so that was domain knowledge
   rather than a vague rumour.

---

## 3. What the codebase actually does

Findings from reading the source during this discussion. These are facts, not
interpretation.

### The educator has no seat on `jer`

`src/lib/tenants/config.ts`:

```
jer:  scenario: false,  workflow: false     ← authors nothing
nim:  scenario: true                        ← educator authors the encounter
cus:  workflow: true                        ← admin authors the prompt
```

`nim` educators author the patient. `cus` admins write the prompt. **jer
educators author nothing.** Their entire nav — Dashboard, Companies, Classes,
Students, Report — is observation. A person looking at that is correct to
conclude it does their job without them and gives them nothing back.

### Her subject is absent from the rubric

`INTERVIEW_TOPICS` is posture, framing, approach, numbers, confidence, example.
**None of them is about English** — no fluency, grammar, vocabulary,
pronunciation, or discourse. `nim` has `plainlanguage`; `jer` has no language
axis at all. The product operates in an English teacher's classroom, on her
students, and reports nothing in her domain.

### There is a spoken-English corpus nobody is using

`PracticeTurn.transcript` stores every student turn (`schema.prisma:718`).
That is a longitudinal record of students speaking under pressure, per student,
across repeated sessions — something no teacher can otherwise collect. It is
currently used for interview scoring and then discarded as linguistic data.

### A mis-transcription becomes a score, silently

Confirmed by the team. The shape, from `src/app/api/practice/webhook/route.ts`:
the transcription node returns `out.user_input`, the response node returns the
six-topic dict, both in the same payload. There is **no confidence field** in
the documented shape.

Why this is worse than a generic bug:

- **Biased downward.** Garbled text reads as incoherent — low `framing`, low
  `confidence`. ASR noise doesn't produce random scores, it produces bad ones.
- **Silent.** `PracticeTurn.topics` carries no uncertainty marker.
- **Unevenly distributed.** Heavier accents, mid-answer code-switching, cheap
  mics, noisy rooms.

So the abstract objection — *AI penalises students who don't fit the pattern* —
has a literal running instantiation, arriving by a completely different
mechanism, hitting the same students.

**Mitigating:** both `transcript` and `topics` sit on the same row, so the
evidence for an appeal already exists. And every raw webhook body is logged
verbatim to `WebhookEvent` before parsing, so whether Soniox confidence is
*already arriving* undocumented can be checked by querying history — no
voice-server change needed to find out.

### The teacher is the notification system

`PracticeAssignment` already carries `dueDate`, `minSessions`, `unlockedAt`
(`schema.prisma:509-515`), plus `deadline.ts` and an `AssignPanel`. Someone
thought carefully about cohort work.

But there is **no outbound channel anywhere in the repo** — no email, no
WhatsApp, no reminders. The system can set a deadline and lock an assignment
and cannot tell a single student that either happened. The only way a student
learns they have work is by voluntarily logging in.

That is the 5–7 days, stated literally. She is the cron job.

Compounding it: `jer` has no auto-enrol, so sixty students must each reach
`/practice/signup` and type `JERB26`. That's a room, a projector, and an hour —
day one of her week, before anything else happens.

### The live room shows the student nothing

`InterviewRoom.tsx:444` — `startVAD` computes RMS every animation frame and
collapses it to a boolean. There is **no analyser on the microphone at all**;
only the remote AI stream has one. While a student answers for ninety seconds,
the only feedback on screen is a border colour, an icon tint, and the text
`AI · listening` (`:1376`, `:1388`, `:1398`). The machine has a status
indicator; the human has none.

### Smaller findings

- `DashboardShell` hardcodes `PrepAI` and takes no tenant, while
  `PracticeHeader` is tenant-aware. A `nim` educator sees "PrepAI"; her
  students see "Clinical communication". The fix landed on one shell only.
- `DashboardShell`'s sidebar is `hidden md:flex` with no mobile replacement —
  under 768px an educator has zero navigation.
- `seed-tenants.ts` doesn't re-assert `role` in its update clauses (unlike
  `seed-jer.ts`), so a drifted role survives a re-seed silently. Its group
  creation also hardcodes a globally-unique `joinCode` without upserting on it.
- `build.sh:37` redacts the connection string backwards — `${DATABASE_URL%%@*}`
  keeps `user:password` and hides the host. Should be `${DATABASE_URL##*@}`.

---

## 4. What the outside research says

From a literature pass run separately; kept here because it's what the
product decisions above lean on.

- **Uniqueness neglect** (Longoni et al., 2019) — resistance to algorithmic
  judgment in subjective or personal contexts, driven by a belief the algorithm
  can't account for what makes *me* different. Stronger in people who see
  themselves as more unique. Extends well beyond the medical settings it was
  first measured in.
- **Applicant reactions are genuinely mixed**, not uniformly negative. Some
  studies find AI evaluation perceived as *more* procedurally fair than a human
  recruiter; others find no difference but lower favourability. The consistent
  complaint is **opacity and unaccountability**, not inferior judgment.
- **What reduces resistance:** human-in-the-loop framing (AI supports rather
  than replaces — this *eliminated* uniqueness neglect in the original work);
  explicitly framing the AI's attention as personalised; and sensitising people
  to AI's potential to reduce human bias.
- **What doesn't reliably work:** making it more human-like.
  Anthropomorphism's effects are context-dependent and unreliable — which
  makes "add warmth" the obvious response and the wrong one.
- **Education is adopting, not refusing.** Cal State Fullerton shipped a
  generative practice-interview trainer in 2025 for dissemination across the
  CSU system; Renmin University runs interview simulation through a career
  centre; a Hangzhou quasi-experiment found AI mock interviews improved both
  perceived employability and real interview performance.
- **On rollout:** broad launch emails don't create sustained usage;
  faculty-embedded pilots with advisor follow-up do. And: don't make a tool
  part of a required student experience if you can't explain its scoring in
  plain language.

---

## 5. What to build

Ordered by leverage, not by effort.

**1. Stop scoring what you didn't hear.**
Show the student the transcript their score was computed from — both fields are
already on the row, so this is a UI change with no schema or voice-server work.
Then: a dispute on a turn drops it from the aggregate rather than scoring it
low. Then: mine `WebhookEvent` for whether confidence is already arriving.
This is a correctness fix first and an argument second.

**2. Remove the 5–7 days.**
An outbound channel (WhatsApp, most likely), roster import to delete the
signup day, a preset multi-day program she starts once, and turning the
existing funnel counts into actions — `assignmentFunnel` and `triageList`
already compute exactly who is stuck where; today that's a number she reads and
then chases by hand.

**3. Give the educator a seat.**
Authoring on `jer` (focus areas, must-probe list, difficulty), an educator note
on a round that the **student sees**, and a co-signed report. This is the only
work that makes human-in-the-loop *true* rather than positioned — and it is the
same fix whether her concern is status, role, or pedagogy.

**4. Report on English.**
A language view built from the transcript corpus — fluency trajectory, error
patterns, vocabulary range, code-switch frequency, filler density. First thing
on this list that gives *her* a reason to want this in her building. Needs a
check on whether turn storage retains enough to support it.

**5. Show the student they're being heard.**
Lift the RMS out of `startVAD`, add a second analyser on the mic, render both
as reactive waveforms. Not anthropomorphism — a waveform claims nothing, it's
evidence of reception. Worth doing on its own merits; will not change any
buyer's mind. Persisting the envelope later yields talk-time ratio, hesitation
before answering, and interruption overlap — real coaching data, and it lands
on the educator surface.

**Deliberately not on this list:** warmer voice, an avatar for `jer`, more
natural TTS. The avatar tech already exists (`MUTHU_FACES`) and porting it here
as an answer to this objection would be the expensive path to the least
reliable fix.

---

## 6. Open questions

- **What exactly is the Bharat English Test proposal?** Who proposed, who
  denied, on what stated grounds. Currently second-hand.
- **Does usage sustain after the supervised window?** Her claim was "then they
  will do their own." Nothing currently measures this, and it decides whether
  the 5–7 days is a one-time cost or a treadmill. This is the most important
  unmeasured number in the product.
- **Is there a named contact at Arya?** A referral with a person attached is an
  asset; one that stays a category was a polite no. One question separates them.
- **Can a mis-transcription be detected post-hoc** from `WebhookEvent` history?
- **What would she want to know about her students' spoken English?** The one
  question that treats her as the expert she is, and that she can answer
  without endorsing anything.

---

## Reading people from paraphrase

Worth recording, because it nearly went wrong repeatedly.

Across this discussion the read on one person changed five times — non-user,
then third-person effect, then category verdict, then labour objection, then
status, then role overlap. **Every reversal came from a new fact, not from more
thinking.** Each intermediate reading was confidently argued and wrong.

The specific trap: once you decide someone is protecting their job, everything
further they say gets discounted as self-interest — which makes them
unfalsifiable to you in exactly the way "human touch" was unfalsifiable to
them. That is expensive here, because the same person supplied the two most
useful pieces of information in the entire conversation: that adoption requires
a supervised 5–7 day ramp, and that the product's value is highest where the
human alternative is absent. Both are correct, both match published findings,
and both would have been discarded by a confident enough psychological read.

The objections were also, repeatedly, **more right about the product than the
product was**. "It penalises students who don't fit the pattern" turned out to
be literally true through a mechanism nobody had considered. Treat the
objection as information about the system before treating it as information
about the objector.
