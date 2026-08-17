# Demo logins

Every seeded account below uses the same password:

```
password123
```

These are **demo credentials for a demo database**. They are hardcoded in the
seed scripts, so anyone with the repo already has them — nothing is disclosed
here that isn't in `scripts/seed-tenants.ts`. Do not reuse this pattern for a
real deployment, and do not add a real user's password to this file.

Self-registered accounts (people who signed up through `/practice/signup` with
their own address) are deliberately **not** listed. Their passwords aren't in
any seed script, so there would be nothing to write down.

---

## Where to sign in

There are four login pages, and they are not interchangeable — each one is the
entry point for a different surface, and `src/proxy.ts` bounces you back to
your own section's login if you land somewhere you don't belong.

| Page | Who it's for |
|---|---|
| `/login` | platform staff — **currently disabled**, see below |
| `/practice/login` | practice-track learners (all tenants, `mm`/`pr`/`vps` included) |
| `/educator/login` | educators / workspace admins |
| `/nimc/login` | admissions counsellors |

> **`/login` is switched off — practice-only mode.** `src/app/login/page.tsx`
> is a stub that redirects to `/practice`, and the real form is commented out
> below it. So the `super_admin`, `admin` (TPO) and `student` accounts listed
> further down **exist in the database but cannot currently be signed into** —
> there is no reachable form that accepts them. This is a deliberate product
> mode, not wipe damage, and it is unrelated to seeding: re-running any seed
> script will not make those accounts reachable. To restore that surface,
> uncomment the original implementation in that file.

After sign-in you are redirected by role (`homePathForRole`, `session.ts:81`):

| Role | Lands on |
|---|---|
| `super_admin` | `/super` |
| `admin` | `/admin` |
| `student` | `/student` |
| `practice` | `/practice` |
| `practice_admin` | `/educator` |
| `nimc_counsellor` | `/nimc` |

---

## nimc — outbound admissions calling

Tenant `nimc`, org **NIMS Admissions**. Sign in at `/nimc/login`.

| Email | Name |
|---|---|
| `sneha@nimc.com` | Sneha Agarwal |
| `counsellor@nimc.com` | Demo Counsellor |

Seeded by `npx tsx scripts/seed-nimc.ts` (idempotent — safe to re-run).

There is **no signup** on this track. Counsellors are provisioned only, so
without that script there is no way to reach `/nimc` at all.

Dialling additionally needs `NIMC_FROM_NUMBER`, `NIMC_DIAL_URL`,
`NIMC_FLOW_API_KEY` and `USER_API_KEY` in `.env`. Without them
`/api/nimc/call` returns 500 rather than placing a call it can't attribute.
Note `NIMC_FLOW_API_KEY` is **not** the same key as `FLOW_API_KEY` — see the
comment in `.env` for why that distinction matters.

---

## nim — medical practice track

Tenant `nim`, org **NIM Medical College**.

| Email | Name | Role | Sign in at |
|---|---|---|---|
| `educator@nim.com` | Dr Meera Nair | `practice_admin` | `/educator/login` |
| `student@nim.com` | Arjun Menon | `practice` | `/practice/login` |
| `student2@nim.com` | Kavya Reddy | `practice` | `/practice/login` |
| `student3@nim.com` | Rohit Bhat | `practice` | `/practice/login` |

Seeded by `npx tsx scripts/seed-tenants.ts`. Class code `NIM3A7`.

(`ayush@nim.com` was listed here previously. It was added by hand, not by any
seed script, so it did not survive the wipe and cannot be restored by re-running
one. Re-create it through `/practice/signup` if it is still wanted.)

---

## mm — conflict roleplay (Mr Muthu)

Tenant `mm`, org **MM Training**.

| Email | Name | Role | Sign in at |
|---|---|---|---|
| `admin@mm.com` | MM Admin | `practice_admin` | `/educator/login` |
| `user@mm.com` | Sample Officer | `practice` | `/practice/login` |

Seeded by `npx tsx scripts/seed-mm.ts` (idempotent — safe to re-run).

The user runs one fixed simulation: **Mr Muthu**, a 55-year-old aid applicant
who is furious about his nine hundred dollars and will not be talked out of
wanting more. The admin has no dialler and nothing to author — they sign in to
read the sessions back (Sessions, Students, Report), which is the whole reason
the account exists.

Two things are specific to this track:

- **The prompt is fixed.** It lives in `src/lib/voice/muthuPrompt.ts` and is
  compiled into the call. The copy stored on the seeded roleplay row is a
  read-only mirror so the admin can see what their officers are up against —
  editing that row changes what the admin reads and nothing about the call.
  `features.workflow` is false here, so the editor is replaced by a readout and
  `updateWorkflow` refuses the tenant outright.
- **Two faces.** Muthu is an avatar, and the model returns `frame` alongside
  `speak` every turn. He **opens angry** and moves to `normal` only when the
  officer genuinely de-escalates him — and goes straight back to angry when
  they deflect. The face UUIDs and the labels the model must return are paired
  in `MUTHU_FACES` (`src/lib/voice/muthuCustoms.ts`); renaming a label there
  without renaming it in the prompt silently freezes the face.

Self-signup at `/practice/signup` works with an `@mm.com` address and
auto-enrols, same as `cus` — no class code.

---

## pr — retail service recovery (Mr Cheryl)

Tenant `pr`, org **PR Retail Training**.

| Email | Name | Role | Sign in at |
|---|---|---|---|
| `admin@pr.com` | PR Admin | `practice_admin` | `/educator/login` |
| `user@pr.com` | Sample Trainee | `practice` | `/practice/login` |

Seeded by `npx tsx scripts/seed-pr.ts` (idempotent — safe to re-run).

Structurally the second `mm`: one fixed compiled-in simulation, same two-face
avatar. The trainee handles Mr Cheryl returning a defective shirt. The prompt
lives in `src/lib/voice/cherylPrompt.ts` and the copy on the seeded row is a
read-only mirror, exactly as on `mm`.

Self-signup at `/practice/signup` works with a `@pr.com` address and
auto-enrols.

---

## vps — virtual patient simulation (Mr Nair)

Tenant `vps`, org **VPS Clinical Training**.

| Email | Name | Role | Sign in at |
|---|---|---|---|
| `admin@vps.com` | VPS Admin | `practice_admin` | `/educator/login` |
| `user@vps.com` | Sample Trainee | `practice` | `/practice/login` |

Seeded by `npx tsx scripts/seed-vps.ts` (idempotent — safe to re-run).

Structurally the second `pr`: one fixed compiled-in simulation, scene actions,
a running score and an out-of-twenty debrief across four dimensions. A
healthcare trainee consults Mr Nair, an elderly diabetic man who deflects about
a sore on his foot and is carrying a fear he will not name unless he is given
room. The prompt lives in `src/lib/voice/vpsPrompt.ts`; re-run the seed after
editing it to refresh the admin's read-only copy.

**The avatar is a body, not a face.** Where `mm` and `pr` have an angry clip and
a settled one, this patient has three POSES — resting, right hand raised, left
hand raised — so `frame` tracks where his body is and never how he feels. Ask
him to hold up a hand and he does, and keeps it there until told to lower it or
to switch. The room shows the current pose as a chip and the mood banner is
switched off for this tenant, since a raised hand is not a mood.

It is also the only track that sends `faces` as a **manifest object** rather
than a bare list, which is what lets it carry bridge clips: raising a hand plays
a transition, lowering it hard-cuts (transitions are one-directional and only
the two `main→hand` clips exist). Run `npx tsx scripts/verify-vps-faces.ts`
after touching the clips — every way that pairing can break fails silently as a
hard cut or a missing avatar.

**Not the same thing as `nim`,** which also simulates a patient. `nim` is a
six-topic rubric scored every turn across many educator-authored scenarios;
this is one fixed encounter assessed once at the end. A `@vps.com` account
will not see scenario authoring, and a `@nim.com` account will never meet
Mr Nair.

Self-signup at `/practice/signup` works with a `@vps.com` address and
auto-enrols.

---

## cus — custom deployment

Tenant `cus`, org **Custom Deployment**.

| Email | Name | Role | Sign in at |
|---|---|---|---|
| `admin@cus.com` | Workspace Admin | `practice_admin` | `/educator/login` |
| `user@cus.com` | Sample User | `practice` | `/practice/login` |

Seeded by `npx tsx scripts/seed-tenants.ts`.

---

## jer — interview practice (the original track)

### Educator — `/educator/login`

| Email | Name | Org | Class code |
|---|---|---|---|
| `educator@jer.com` | JER Placement Cell | JER Institute | `JERB26` |

Seeded by `npx tsx scripts/seed-jer.ts` (idempotent — safe to re-run).

jer is the one practice track with **no auto-enrol**: a learner signs up at
`/practice/signup` with a `@jer.com` address and then joins with the class code
above. The seed enrols every existing `@jer.com` learner into that class.

`educator@demo.edu` below is the older jer educator, created only by the
destructive `prisma/seed.ts`. `educator@jer.com` exists so the original track
can be restored without wiping anything.

### Platform and college staff — `/login`

| Email | Name | Role |
|---|---|---|
| `ops@prepai.com` | Platform Ops | `super_admin` |
| `tpo@nims.edu` | Priya Sharma (TPO) | `admin` |
| `tpo@lpu.edu` | Rajesh Kumar (TPO) | `admin` |

### Educators — `/educator/login`

| Email | Name | Org |
|---|---|---|
| `educator@demo.edu` | Demo Institute | Demo Institute |

### Students — `/login`

Thirteen seeded students, all `password123`. Any one of them is enough to see
the student surface; they differ only in their seeded round history.

NIMS (`@nims.edu`): `aarav.mehta`, `aditya.patel`, `ananya.rao`, `diya.nair`,
`isha.verma`, `karan.singh`, `meera.iyer`, `nikhil.das`, `rohan.gupta`,
`sara.khan`, `tara.menon`, `vivaan.joshi`

LPU (`@lpu.edu`): `arjun`, `neha`, `simran`

### Practice learners — `/practice/login`

| Email | Name |
|---|---|
| `kapil@jer.com` | Kapil |

---

## Re-seeding

```bash
npx tsx scripts/seed-tenants.ts   # nim + cus, idempotent
npx tsx scripts/seed-jer.ts       # jer educator, idempotent
npx tsx scripts/seed-nimc.ts      # nimc, idempotent
npx tsx scripts/seed-mm.ts        # mm, idempotent
npx tsx scripts/seed-pr.ts        # pr, idempotent
npx tsx scripts/seed-vps.ts       # vps, idempotent
```

All five are upsert-only and safe against the live database.

### After an org wipe, also repair memberships

```bash
npx tsx scripts/repair-memberships.ts        # report only
npx tsx scripts/repair-memberships.ts --fix  # enrol them
```

Deleting a `PracticeOrg` cascades to `PracticeGroup` and then to
`PracticeMember`, so it **silently unenrols every learner while leaving their
accounts intact**. They can still sign in, and their dashboard is empty — which
is why "login works" is not sufficient evidence that a restore succeeded.

The seed scripts do not cover this: each re-enrols only the sample user it
created itself, never people who signed up afterwards. On `cus`/`mm`/`pr`/`vps` the
membership is load-bearing — `isOrgMember` in `src/lib/practice/access.ts` is
the only path to the org's published workflow.

**`prisma/seed.ts` is not.** It opens by deleting every B2B table before
recreating the jer accounts above. Never point it at anything you care about.

To create one more educator without touching anything else:

```bash
npx tsx scripts/create-educator.ts "Institute name" educator@example.com [password] [class name]
```

Password defaults to `password123` if omitted.
