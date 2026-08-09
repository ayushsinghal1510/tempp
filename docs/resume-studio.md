# Resume Studio

A chat-driven resume builder on the `jer` track. The student talks to an agent,
the agent writes their resume in **real LaTeX**, the server compiles it to PDF,
and the rendered page sits beside the conversation. Every reply can rewrite the
document; the student downloads the PDF whenever they like.

It is a sibling of **Resume & career chat**, not a replacement:

| | Resume & career chat | Resume Studio |
|---|---|---|
| Scope | one per (student, company) | one per student, plus tailored variants |
| The resume is | an input — the student uploads it | the output — the agent writes it |
| Produces | advice in chat | a compiled PDF |
| Route | `/practice/companies/[id]/resume-chat` | `/practice/resume-studio` |

Gated on `features.resume`, which is true on `jer` alone. Every other tenant
404s the route and never renders the nav tab.

---

## Provisioning tectonic (required)

**Without this the feature does not work.** There is no TeX in `package.json`
and none is vendored — the server shells out to
[tectonic](https://tectonic-typesetting.github.io), a single static binary that
downloads the TeX packages a document needs into a local cache.

```bash
mkdir -p ~/.local/bin && curl -sL \
  https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
  | tar xz -C ~/.local/bin && chmod +x ~/.local/bin/tectonic
```

On Windows, take the `x86_64-pc-windows-msvc` zip from the same release and
unpack `tectonic.exe` into `%USERPROFILE%\.local\bin`:

```powershell
$dest = "$env:USERPROFILE\.local\bin"
New-Item -ItemType Directory -Force $dest | Out-Null
Invoke-WebRequest -Uri "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip" -OutFile "$env:TEMP\tectonic.zip"
Expand-Archive -Path "$env:TEMP\tectonic.zip" -DestinationPath $dest -Force
```

`resolveBinary()` in `src/lib/resume/compile.ts` looks in `$TECTONIC_BIN`, then
`~/.local/bin/tectonic` (`tectonic.exe` on Windows), then
`/usr/local/bin/tectonic`, then `PATH`. Set `TECTONIC_BIN` if your image puts it
somewhere else.

Verify the toolchain and the shared template:

```bash
npx tsx scripts/verify-resume-latex.ts
```

Run that **after any edit to `src/lib/resume/template.ts`**. That file's preamble
is shared by every resume in the product, so a typo in it breaks every student
at once, and it is exactly the kind of breakage a type check cannot see. The
script caught a missing `\color` package the first time it ran.

**Run it as part of provisioning, not just to check the template.** The first
compile on a cold cache downloads the packages the document needs and can
exceed `compile.ts`'s 60s `TIMEOUT_MS` on its own — measured on Windows at
>60s cold against ~0.6s warm, i.e. the very first student to open the studio
after a fresh deploy would otherwise eat the timeout. The verification run
warms the cache so nobody hits that.

**Timings**: ~15s for the very first compile on a cold package cache (Linux, as
originally measured; over 60s on the Windows box this was re-measured on),
~0.6-1.5s warm. The cache lives under `~/.cache/Tectonic`, so the first compile
after a fresh container is always the slow one.

Note that `npx tsx scripts/verify-resume-latex.ts` cannot run as written: the
resume libs `import "server-only"`, which Next aliases in its bundler but plain
`tsx` cannot resolve (it is not a dependency in `package.json`). Either add the
package or run the script with a resolver shim.

---

## How a turn works

1. The student sends a message to `POST /api/practice/resume-studio/chat`.
2. The model may call the `writeResume` tool with the **complete** LaTeX body.
3. `sanitizeBody()` strips forbidden commands and repairs typography.
4. `compileLatex()` builds it. On success the PDF is cached on the row; on
   failure the LaTeX is saved anyway and the **TeX log is handed back to the
   model as the tool result**, which retries (up to `MAX_STEPS = 4`).
5. The model writes a short chat reply. The client bumps a cache-busting
   version and reloads the preview iframe.

The model writes the **body only** — the preamble in `template.ts` is compiled
in. This is the single most important design decision here: a model asked for a
whole `.tex` file invents packages, redefines `\section` differently every turn,
and drops `\end{document}`, all of which are hard compile failures. Fixing the
preamble reduces the failure surface to "is this valid markup inside a document
that already works".

## Security

`sanitizeBody()` is a security boundary, not a style pass. It strips `\input`,
`\include`, `\openin` and friends: tectonic runs with shell-escape off, so the
model cannot execute anything, but `\input{/etc/passwd}` needs no shell — TeX
reads the file and typesets its contents into a PDF the student then downloads.
That is a file-disclosure primitive reachable by anyone who can get the model to
emit six characters. tectonic is additionally invoked with `--untrusted`.

The PDF route is scoped by `userId` with no exceptions. An id-only lookup would
let any signed-in student read any other's resume by guessing.

## Typography repairs

Two characters compile cleanly and then typeset as **nothing**, which is the
worst bug class this product can have — no error, a valid PDF, and the student
sends an employer a resume reading "idempotencykey layer":

- `\-` — a *discretionary* hyphen. Models emit it believing a backslash escapes
  the hyphen. Nothing needs escaping.
- `U+2011` — a non-breaking hyphen, undefined in the T1 encoding, so the glyph
  is silently dropped.

Both were observed on the first two resumes ever generated here. The prompt
warns against them **and** `repairTypography()` rewrites them, because prompt
compliance is not a guarantee. `~400` (a LaTeX tie, not "approximately") is
rewritten to `$\sim$400` when it follows whitespace.

## It starts working on its own

An empty transcript means one of exactly two things just happened — the student
finished the upload screen, or they forked a tailored variant. In both cases the
only thing they want next is the one thing this page does, so `ResumeStudio.tsx`
sends the opening request itself on mount rather than waiting to be asked. First
draft lands ~8s after the upload form is submitted, with nothing typed.

The guard is a `useRef`, not state, so React's double-invoked development
effects cannot fire two generations at the same empty studio. It keys off
`initialMessages` (the server's state at load) rather than `messages`, which
starts filling the instant it fires and would make the condition self-clearing.

## Tailoring inputs

A variant's prompt gets the company's **job description** first and the Groq
company research second. The JD is weighted higher deliberately: the research
describes the company in general, but the posting is the actual list of things
this resume will be screened against.

`research.interviewStyle` is deliberately excluded — it shapes how a student
should *prepare*, which is the resume-chat coach's job, and including it pulled
the model toward writing interview advice instead of editing the document.

## Known limitation: embellishment

The prompt forbids inventing facts, and after strengthening it the model stopped
adding technologies absent from the student's material (it was previously
claiming Kubernetes because the target company's stack listed it).

**It still embellishes across a bridge it can justify**, and feeding in the job
description made this *worse*, not better. The JD hands the model a checklist,
and it will reach to satisfy a line item. Against a posting requiring "has
shipped something to real users", tailoring produced:

> Delivered the checkout service to external users, handling real-world payment
> flows and gathering production feedback.

The student's notes say only that he worked on the checkout service as an
intern. Nothing about delivering it, and nothing about production feedback.

This is the cost of the JD being in the prompt at all, and it is worth being
clear-eyed about: better-targeted resumes, higher fabrication pressure.

Closing it properly needs a verification pass: a second, cheap model call that
takes each generated bullet plus the source material and flags anything not
supported, either rejecting the write or surfacing it to the student for
confirmation. That is roughly half a day and adds 2-3s per turn, and it is the
right next piece of work here.

Until then the student is the check, which is worth saying out loud in the UI if
this goes in front of real users.
