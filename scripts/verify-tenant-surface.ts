// Assertions that the STUDENT surface obeys the tenant config it is handed.
//
// Run: npx tsx scripts/verify-tenant-surface.ts
//
// The practice track runs three products off one set of routes, and the way
// that breaks is never dramatic — it's a hardcoded "Companies" tab shown to a
// medical student, or an engineering CGPA table rendered to a customer's staff
// who were never asked for a CGPA. Every one of those is a page reaching past
// tenantConfig() to a literal.
//
// So this checks two different things:
//
//   1. Source-level — no student-facing file under src/app/practice or the
//      shared practice components contains a tenant-specific noun as a
//      literal. Cheap, no database, catches the regression at the moment
//      someone types it.
//   2. Behavioural — upNextFrom() produces the right card state per tenant,
//      including the resume divert that only jer has.
//
// Deliberately NOT a snapshot test of rendered HTML: the point is to pin the
// rule ("the page asks the config"), not the current wording.

import fs from "node:fs";
import path from "node:path";
import { ALL_TENANTS } from "../src/lib/tenants/config";
import { upNextFrom, type UpNextCompany } from "../src/lib/practice/upNext";

let failures = 0;
function assert(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${name}`);
  if (!cond) {
    if (detail) console.log(`         ${detail}`);
    failures++;
  }
}

const ROOT = path.join(__dirname, "..");

/**
 * The tenants that have a student surface at all.
 *
 * `nimc` does not: nobody signs in as the person being called, there are no
 * units to list and no rounds to start, so /practice and upNextFrom() are not
 * routes it ever reaches. Excluded explicitly rather than by letting the
 * generic assertions happen to pass on it — a check that quietly holds for a
 * tenant it was never about is worse than no check.
 */
const STUDENT_TENANTS = ALL_TENANTS.filter((t) => t.track !== "calling");

/** Every .tsx the student actually sees. */
function studentFiles(): string[] {
  const roots = [
    path.join(ROOT, "src/app/practice"),
    path.join(ROOT, "src/components/practice"),
  ];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        out.push(full);
      }
    }
  };
  for (const r of roots) if (fs.existsSync(r)) walk(r);
  return out;
}

/**
 * Nouns that belong to exactly one tenant and must therefore never be typed
 * into a shared page as user-visible text.
 *
 * Matched inside JSX text and string literals only — an href, an import path
 * or an identifier legitimately says "companies" everywhere, because the
 * ROUTES are shared on purpose and only the labels differ.
 */
const BANNED = [
  { word: "Companies", why: "use copy.unitPlural" },
  { word: "Company", why: "use copy.unitTitle" },
  { word: "Practice Interview", why: "use tenantConfig().label" },
  { word: "scenario", why: "use copy.unitSingular" },
  { word: "workflow", why: "use copy.unitSingular" },
];

/**
 * Reduces a source file to the prose a student could actually read on screen:
 * string literals and JSX text, and nothing else.
 *
 * This is the distinction that matters. `const scenario = ...` and
 * `kind === "scenario"` are an identifier and an enum discriminant — the same
 * word, but neither is a label, and PracticeCompanyKind is shared by every
 * tenant anyway. `<th>Company</th>` and `title: "Companies, once"` ARE labels,
 * and those are what this is hunting.
 *
 * Scanning identifiers too was the first attempt and it drowned the real hits
 * in twenty false ones, which is its own kind of failure — a check nobody can
 * read is a check nobody will keep.
 */
function extractProse(source: string): string {
  const cleaned = source
    // Comments first, before anything line-oriented. They discuss the rule.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => !/\bfrom\s+["']/.test(line))
    .map((line) => line.replace(/\/\/.*$/, ""))
    // Attributes that carry machine values, not text.
    .map((line) => line.replace(/(href|className|src|key|id)=\{?["'`][^"'`]*["'`]\}?/g, ""))
    // Equality against a literal is a discriminant, never a label.
    .map((line) => line.replace(/[=!]==?\s*["'`][^"'`]*["'`]/g, ""))
    .join("\n");

  const prose: string[] = [];
  // String literals.
  for (const m of cleaned.matchAll(/["'`]([^"'`\n]{2,})["'`]/g)) {
    prose.push(m[1]);
  }
  // JSX text between tags — no braces, so `{scenario.title}` is excluded.
  for (const m of cleaned.matchAll(/>([^<>{}]+)</g)) {
    prose.push(m[1]);
  }
  return prose.join("\n");
}

/**
 * Files that render for exactly one tenant and may therefore name it.
 *
 * Each is gated by a feature flag at its only call site, so the noun inside is
 * as tenant-correct as anything read from config would be. Listed explicitly
 * rather than inferred: an exemption should cost someone a line of thought.
 */
const TENANT_SPECIFIC: Record<string, string> = {
  "src/app/practice/companies/CompanyForm.tsx":
    "rendered only under features.company (jer)",
  "src/components/practice/CompanyResearchPanel.tsx":
    "rendered only under features.research (jer)",
  "src/components/practice/ScenarioBrief.tsx":
    "rendered only for scenario-kind units (nim)",
  // Pre-auth: no session, so no tenant to read a label from.
  "src/app/practice/login/page.tsx": "pre-auth, tenant not yet known",
  "src/app/practice/signup/page.tsx": "pre-auth, tenant not yet known",
};

function checkSourceLiterals() {
  const files = studentFiles();
  assert("found student-facing files to scan", files.length > 0);

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    // The config and the copy module are where these words are SUPPOSED to be.
    if (rel.includes("tenants/config")) continue;
    if (TENANT_SPECIFIC[rel]) continue;

    const text = extractProse(fs.readFileSync(file, "utf8"));
    for (const { word, why } of BANNED) {
      // Word-boundary, case-sensitive: catches the JSX literal `Companies`
      // without flagging `companyName` or `getUserCompaniesWithRounds`.
      const re = new RegExp(`(?<![A-Za-z])${word}(?![A-Za-z])`);
      const hit = re.test(text);
      assert(
        `${rel}: no hardcoded "${word}"`,
        !hit,
        hit ? `${why} — tenant-specific noun in a shared page` : undefined,
      );
    }
  }
}

/** A company row shaped like the cached query returns. */
function company(over: Partial<UpNextCompany> = {}): UpNextCompany {
  return {
    id: "c1",
    companyName: "Unit One",
    jobTitle: "SDE",
    rounds: [],
    assignments: [],
    ...over,
  };
}

function checkUpNextBehaviour() {
  const now = new Date("2026-07-26T12:00:00Z");

  // jer: no resume uploaded → the card must divert, not offer a start it
  // cannot honour (createSession would redirect).
  const jerNoResume = upNextFrom([company()], "jer", new Set(), now);
  assert(
    "jer without a resume → needs-resume",
    jerNoResume[0].state === "needs-resume",
    `got "${jerNoResume[0].state}"`,
  );

  const jerWithResume = upNextFrom([company()], "jer", new Set(["c1"]), now);
  assert(
    "jer with a resume → ready",
    jerWithResume[0].state === "ready",
    `got "${jerWithResume[0].state}"`,
  );

  // nim/cus/mm have no resume gate at all, so an empty resume set is irrelevant.
  for (const tenant of ["nim", "cus", "mm"] as const) {
    const cards = upNextFrom([company()], tenant, new Set(), now);
    assert(
      `${tenant} never asks for a resume`,
      cards[0].state === "ready",
      `got "${cards[0].state}"`,
    );
    assert(
      `${tenant} shows no job-title subtitle`,
      cards[0].subtitle === null,
    );
  }

  // A locked deadline outranks a missing resume — uploading one would not
  // make the session startable, so offering the upload would be a dead end.
  const lockedPastGrace = upNextFrom(
    [
      company({
        assignments: [
          { dueDate: new Date("2026-07-01T00:00:00Z"), unlockedAt: null },
        ],
      }),
    ],
    "jer",
    new Set(),
    now,
  );
  assert(
    "locked outranks needs-resume",
    lockedPastGrace[0].state === "locked",
    `got "${lockedPastGrace[0].state}"`,
  );

  // An educator's reopen beats the clock, same as deadlineState promises.
  const reopened = upNextFrom(
    [
      company({
        assignments: [
          {
            dueDate: new Date("2026-07-01T00:00:00Z"),
            unlockedAt: new Date("2026-07-20T00:00:00Z"),
          },
        ],
      }),
    ],
    "nim",
    new Set(),
    now,
  );
  assert("a reopened assignment is startable", reopened[0].state === "ready");

  // Ordering: startable before locked, unstarted before practised.
  const ordered = upNextFrom(
    [
      company({ id: "locked", companyName: "Locked" , assignments: [
        { dueDate: new Date("2026-07-01T00:00:00Z"), unlockedAt: null },
      ] }),
      company({
        id: "practised",
        companyName: "Practised",
        rounds: [{ status: "completed" }],
      }),
      company({ id: "fresh", companyName: "Fresh" }),
    ],
    "nim",
    new Set(),
    now,
  );
  assert(
    "most actionable card sorts first",
    ordered.map((c) => c.companyId).join(",") === "fresh,practised,locked",
    `got ${ordered.map((c) => c.companyId).join(",")}`,
  );

  // The CTA is always in the tenant's own noun.
  for (const config of STUDENT_TENANTS) {
    const cards = upNextFrom([company()], config.key, new Set(["c1"]), now);
    assert(
      `${config.key} CTA uses "${config.copy.sessionNoun}"`,
      cards[0].cta.includes(config.copy.sessionNoun),
      `got "${cards[0].cta}"`,
    );
  }

  // Accent stays inside the five-colour palette and is stable per id.
  const a = upNextFrom([company()], "jer", new Set(["c1"]), now)[0].accent;
  const b = upNextFrom([company()], "jer", new Set(["c1"]), now)[0].accent;
  assert("accent is stable for an id", a === b);
  assert("accent is within the palette", a >= 0 && a <= 4, `got ${a}`);
}

/** Config-level invariants the pages above are entitled to rely on. */
function checkConfigCoherence() {
  for (const config of ALL_TENANTS) {
    const { key, features, topics } = config;
    assert(
      `${key}: scoring implies a rubric`,
      features.scoring === topics.length > 0,
      `scoring=${features.scoring} topics=${topics.length}`,
    );
    assert(
      `${key}: resume implies companies`,
      !features.resume || features.company,
    );
    assert(
      `${key}: autoEnroll implies no assignments`,
      !features.autoEnroll || !features.assignments,
    );
    assert(
      `${key}: funnel omits resume stage when there is no resume`,
      features.resume || !config.funnelStages.includes("resumeUploaded"),
    );
    assert(
      `${key}: funnel omits scored stage when nothing is scored`,
      features.scoring || !config.funnelStages.includes("scored"),
    );
    // Both tracks store their unit as a PracticeCompany of kind `workflow`, so
    // the kind alone cannot tell them apart — the live page and the educator
    // detail page both discriminate on these two flags instead. If a tenant
    // ever set both, those branches would silently pick whichever they test
    // first, and the wrong agent would answer the call.
    assert(
      `${key}: roleplay and workflow are mutually exclusive`,
      !(features.roleplay && features.workflow),
    );
  }

  // The calling track has no student journey to funnel, so an empty stage list
  // is the correct value rather than an unfinished one. Pinned so that adding
  // a stage here forces a decision about what a "stage" would even mean when
  // the unit of work is a phone call.
  for (const config of ALL_TENANTS) {
    if (config.track !== "calling") continue;
    assert(
      `${config.key}: calling track has no funnel`,
      config.funnelStages.length === 0,
    );
    assert(
      `${config.key}: calling track assigns nothing`,
      !config.features.assignments && !config.features.scoring,
    );
  }
}

console.log("── source literals ──");
checkSourceLiterals();
console.log("\n── up-next behaviour ──");
checkUpNextBehaviour();
console.log("\n── config coherence ──");
checkConfigCoherence();

console.log(
  failures === 0
    ? "\nALL TENANT SURFACE ASSERTIONS PASSED"
    : `\n${failures} ASSERTION(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
