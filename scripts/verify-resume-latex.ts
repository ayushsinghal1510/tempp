// Verifies the Resume Studio LaTeX toolchain end to end:
//
//   npx tsx scripts/verify-resume-latex.ts
//
// Run this after provisioning tectonic on a new machine, and after any edit to
// src/lib/resume/template.ts. The preamble there is shared by every resume in
// the product, so a typo in it breaks every student at once — and it is exactly
// the kind of breakage that never shows up in a type check.
//
// Writes the compiled PDFs to /tmp so the layout can be eyeballed, and exits
// non-zero on the first failure so it can gate a deploy.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildDocument, starterBody, sanitizeBody } from "../src/lib/resume/template";
import { compileLatex, TectonicMissingError } from "../src/lib/resume/compile";

// A realistic body exercising every macro the model is told to use. If the
// prompt in src/lib/resume/prompt.ts gains a macro, add it here too.
const FULL_BODY = String.raw`\begin{center}
  {\Huge \scshape Ayush Singhal} \\ \vspace{2pt}
  \small +91 90000 00000 $|$ \href{mailto:ayush@jer.com}{ayush@jer.com} $|$
  \href{https://github.com/example}{github.com/example}
\end{center}

\section{Education}
\resumeList
  \resumeHeading{JECRC University}{2021 -- 2025}{B.Tech, Computer Science --- CGPA 8.4}{Jaipur}
\resumeListEnd

\section{Experience}
\resumeList
  \resumeHeading{Backend Engineering Intern}{Jun 2024 -- Dec 2024}{Acme Payments}{Remote}
  \resumeBullets
    \resumeItem{Cut p99 checkout latency 40\% by replacing an N+1 query with a single indexed join, across ~120k daily orders.}
    \resumeItem{Shipped an idempotency layer that eliminated duplicate charges (\$18k/mo in refunds avoided).}
  \resumeBulletsEnd
\resumeListEnd

\section{Projects}
\resumeList
  \resumeSubItem{Resume Studio --- Next.js, Postgres, LaTeX}{2025}
  \resumeBullets
    \resumeItem{Chat-driven resume builder compiling real LaTeX to PDF server-side.}
  \resumeBulletsEnd
\resumeListEnd

\section{Skills}
\resumeList
  \resumeItem{\textbf{Languages}: TypeScript, Python, Go}
  \resumeItem{\textbf{Tools}: Postgres, Prisma, Docker}
\resumeListEnd`;

// The exact shape that broke production: \resumeBullets with no \item ahead of
// it. Must compile, via repairStructure() rather than by being well-formed.
const MALFORMED_SKILLS = String.raw`\section{Skills}
\resumeList
  \resumeBullets
    \resumeItem{TypeScript, Node, Postgres, Docker}
  \resumeBulletsEnd
\resumeListEnd`;

async function check(label: string, body: string): Promise<boolean> {
  process.stdout.write(`  ${label} … `);
  const started = Date.now();
  const result = await compileLatex(buildDocument(body));
  const ms = Date.now() - started;

  if (!result.ok) {
    console.log(`FAILED (${ms}ms)`);
    console.log(`\n${result.log}\n`);
    return false;
  }

  const out = join(tmpdir(), `resume-verify-${label.replace(/\W+/g, "-")}.pdf`);
  await writeFile(out, result.pdf);
  console.log(`ok — ${(result.pdf.length / 1024).toFixed(1)}KB in ${ms}ms → ${out}`);
  return true;
}

async function main() {
  console.log("\nResume Studio — LaTeX toolchain check\n");

  // The sanitizer is pure, so check it before spending 15s on a compile.
  process.stdout.write("  sanitizeBody strips \\input … ");
  const dirty = sanitizeBody(String.raw`\input{/etc/passwd} \usepackage{xcolor} hello`);
  if (dirty.includes("\\input") || dirty.includes("\\usepackage")) {
    console.log(`FAILED — got: ${dirty}`);
    process.exit(1);
  }
  console.log("ok");

  // Regression: models write \- constantly and it deletes the hyphen from the
  // rendered PDF without erroring. See the comment in sanitizeBody.
  process.stdout.write("  sanitizeBody repairs invisible hyphens … ");
  const cases: [string, string][] = [
    [String.raw`cross\-platform per\-line\-item`, "cross-platform per-line-item"],
    ["idempotency‑key real‑time", "idempotency-key real-time"],
    ["used by ~400 students", "used by $\\sim$400 students"],
    [String.raw`used by \~400 students`, "used by $\\sim$400 students"],
    ["Fig.~1 stays a tie", "Fig.~1 stays a tie"],
    ["“quoted” and ’apostrophe", "''quoted'' and 'apostrophe"],
    ["cut latency ≈40\\% and 2× throughput", "cut latency $\\approx$40\\% and 2$\\times$ throughput"],
    // Accented names must survive untouched — LaTeX renders them correctly.
    ["José Müller", "José Müller"],
  ];
  for (const [input, want] of cases) {
    const got = sanitizeBody(input);
    if (got !== want) {
      console.log(`FAILED\n    input: ${input}\n    want:  ${want}\n    got:   ${got}`);
      process.exit(1);
    }
  }
  console.log("ok");

  // Regression: \resumeBullets straight after \resumeList is a hard compile
  // error ("perhaps a missing \item"), and the model writes it in Skills.
  process.stdout.write("  sanitizeBody repairs bullets-without-item … ");
  const nested = sanitizeBody("\\resumeList\n  \\resumeBullets\n  \\resumeBulletsEnd\n\\resumeListEnd");
  if (!nested.includes("\\item{}")) {
    console.log(`FAILED — got: ${nested}`);
    process.exit(1);
  }
  console.log("ok");

  let passed = true;
  passed = (await check("starter", starterBody("Ayush Singhal", "ayush@jer.com"))) && passed;
  passed = (await check("full", FULL_BODY)) && passed;
  passed = (await check("malformed-skills", MALFORMED_SKILLS)) && passed;

  console.log(passed ? "\nAll good.\n" : "\nTemplate is broken — fix before deploying.\n");
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  if (err instanceof TectonicMissingError) {
    console.error(`\n✗ ${err.message}\n`);
    console.error("  Install it with:");
    console.error("    mkdir -p ~/.local/bin && curl -sL \\");
    console.error("      https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \\");
    console.error("      | tar xz -C ~/.local/bin && chmod +x ~/.local/bin/tectonic\n");
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
