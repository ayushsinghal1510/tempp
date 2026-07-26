// ─────────────────────────────────────────────────────────────────────────────
// TENANTS — the practice track runs three products off one codebase.
//
//   jer → the original interview coach for engineering students. Educator (or
//         student) registers a company, Groq researches it, the student
//         uploads a resume, then runs scored voice interviews.
//   nim → a clinical-communication trainer for medical students. The educator
//         authors a simulated patient encounter (AI-assisted), assigns it, and
//         the student talks to the patient. No company, no resume, no research.
//   cus → a managed customer deployment. The customer's own admin writes a
//         greeting and a prompt; every user of that customer gets it
//         immediately, with no assignment step. Sessions are recorded and
//         transcribed and NOT scored — there is no rubric at all here, which
//         is why `topics` is legitimately empty and `features.scoring` gates
//         every analytic surface off.
//
// These are NOT separate apps. They share every route, model, chart and metric.
// A tenant selects three things and nothing else:
//   1. the rubric each turn is scored on (empty when nothing is scored),
//   2. which features are switched on,
//   3. the nouns the UI uses.
//
// Everything downstream of the rubric — metrics.ts, educatorMetrics.ts, the
// radar, the timelines — iterates the topic list generically and never names a
// topic, so a tenant gets the entire analytics layer for free.
//
// A user's tenant is decided from their email domain at signup and then STORED
// on the row (User.tenant). It is never recomputed from the email afterwards:
// that is what lets accounts predating the domain rule keep working, and it
// means changing someone's email can't silently move them between products.
// ─────────────────────────────────────────────────────────────────────────────

import type { Tenant } from "@prisma/client";

/** One scored topic: the key the LLM returns, plus how it's drawn. */
export type TopicMeta = { key: string; label: string; color: string };

export type TenantFeatures = {
  /** Companies exist and students may self-register them. */
  company: boolean;
  /** A resume must be uploaded before a session can start. */
  resume: boolean;
  /** Groq company research runs at creation. */
  research: boolean;
  /** Educators author AI-generated patient scenarios. */
  scenario: boolean;
  /** Admins author a bare greeting+prompt workflow. */
  workflow: boolean;
  /**
   * Turns are scored against a rubric. False on `cus`, where the whole point
   * is a plain conversation — every chart, KPI, radar and triage surface is
   * gated on this, since a rubric of zero topics would otherwise render as a
   * page of dashes and empty axes.
   */
  scoring: boolean;
  /**
   * Access comes from a per-student PracticeAssignment. False on `cus`, where
   * anything the admin publishes reaches every user of that org at once — the
   * customer explicitly does not want to assign work person by person.
   */
  assignments: boolean;
  /**
   * A new signup is attached to the tenant's org automatically, with no class
   * code. Only `cus`: one customer, one org, and asking their staff to type a
   * code to reach the thing their own admin just published is friction with
   * nothing behind it.
   */
  autoEnroll: boolean;
  /** Signup collects Degree + CGPA (expectationMatrix is engineering-shaped). */
  courseField: boolean;
};

/** Stages of the educator funnel, in order. Tenants without resumes omit that one. */
export type FunnelStage =
  | "assigned"
  | "resumeUploaded"
  | "started"
  | "completed"
  | "scored";

export type TenantConfig = {
  key: Tenant;
  label: string;
  /** Email domains that map to this tenant at signup. Lowercase, no "@". */
  domains: string[];
  track: "interview" | "clinical" | "custom";
  topics: TopicMeta[];
  features: TenantFeatures;
  funnelStages: FunnelStage[];
  copy: {
    /** What a PracticeCompany row is called here. */
    unitSingular: string;
    unitPlural: string;
    /** Sentence-case, for headings. */
    unitTitle: string;
    /** What a PracticeRound is called to the student. */
    sessionNoun: string;
  };
};

// The original rubric. Order matters — it's the axis order on the radar and
// the series order on every timeline.
const INTERVIEW_TOPICS: TopicMeta[] = [
  { key: "posture", label: "Posture", color: "var(--chart-1)" },
  { key: "framing", label: "Framing", color: "var(--chart-2)" },
  { key: "approach", label: "Approach", color: "var(--chart-3)" },
  { key: "numbers", label: "Numbers", color: "var(--chart-4)" },
  { key: "confidence", label: "Confidence", color: "var(--chart-5)" },
  { key: "example", label: "Example", color: "var(--brand)" },
];

// The clinical rubric, drawn from the established communication instruments
// (Calgary–Cambridge, SEGUE, Kalamazoo) plus the geriatric-specific items
// those general frameworks under-weight.
//
// Held at six deliberately: the radar is a 6-axis chart and the palette is
// --chart-1..5 plus --brand, so this slots into every existing visual with no
// changes. `presence` is first so it inherits the same colour as `posture` —
// both are the vision-fed topic, and keeping them visually consistent means a
// screenshot of one track reads the same way as the other.
const CLINICAL_TOPICS: TopicMeta[] = [
  { key: "presence", label: "Presence", color: "var(--chart-1)" },
  { key: "rapport", label: "Rapport", color: "var(--chart-2)" },
  { key: "listening", label: "Listening", color: "var(--chart-3)" },
  { key: "empathy", label: "Empathy", color: "var(--chart-4)" },
  { key: "plainlanguage", label: "Plain language", color: "var(--chart-5)" },
  { key: "dignity", label: "Dignity", color: "var(--brand)" },
];

export const TENANTS: Record<Tenant, TenantConfig> = {
  jer: {
    key: "jer",
    label: "Interview practice",
    domains: ["jer.com"],
    track: "interview",
    topics: INTERVIEW_TOPICS,
    features: {
      company: true,
      resume: true,
      research: true,
      scenario: false,
      workflow: false,
      scoring: true,
      assignments: true,
      autoEnroll: false,
      courseField: true,
    },
    funnelStages: [
      "assigned",
      "resumeUploaded",
      "started",
      "completed",
      "scored",
    ],
    copy: {
      unitSingular: "company",
      unitPlural: "companies",
      unitTitle: "Company",
      sessionNoun: "interview",
    },
  },
  nim: {
    key: "nim",
    label: "Clinical communication",
    domains: ["nim.com"],
    track: "clinical",
    topics: CLINICAL_TOPICS,
    features: {
      company: false,
      resume: false,
      research: false,
      scenario: true,
      workflow: false,
      scoring: true,
      assignments: true,
      autoEnroll: false,
      // expectationMatrix.ts is btech/mba/bcom-shaped and means nothing for a
      // medical student, so the field is hidden rather than mislabelled.
      courseField: false,
    },
    // No resume gate, so no "stalled at resume" stage to report.
    funnelStages: ["assigned", "started", "completed", "scored"],
    copy: {
      unitSingular: "scenario",
      unitPlural: "scenarios",
      unitTitle: "Scenario",
      sessionNoun: "encounter",
    },
  },
  cus: {
    key: "cus",
    label: "Custom workflow",
    domains: ["cus.com"],
    track: "custom",
    // Genuinely empty, not a placeholder. Nothing is scored here, and every
    // consumer of this list handles zero topics by rendering nothing rather
    // than by rendering an empty chart.
    topics: [],
    features: {
      company: false,
      resume: false,
      research: false,
      scenario: false,
      workflow: true,
      scoring: false,
      assignments: false,
      autoEnroll: true,
      courseField: false,
    },
    // No assignments and no scores, so the only stages that mean anything are
    // whether people started and whether they finished.
    funnelStages: ["started", "completed"],
    copy: {
      unitSingular: "workflow",
      unitPlural: "workflows",
      unitTitle: "Workflow",
      sessionNoun: "session",
    },
  },
};

/** Every tenant config, for iteration. */
export const ALL_TENANTS: TenantConfig[] = Object.values(TENANTS);

export function tenantConfig(tenant: Tenant): TenantConfig {
  return TENANTS[tenant];
}

/** Convenience: the rubric for a tenant. */
export function topicsFor(tenant: Tenant): TopicMeta[] {
  return TENANTS[tenant].topics;
}

/**
 * Which tenant an email address belongs to, or null if the domain isn't one
 * we recognise.
 *
 * Only signup consults this. Login deliberately does not — it reads the stored
 * User.tenant instead, so accounts created before the domain rule existed (and
 * any address an operator adds by hand) keep working without an allowlist to
 * maintain.
 */
export function tenantForEmail(email: string): Tenant | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  for (const config of ALL_TENANTS) {
    if (config.domains.includes(domain)) return config.key;
  }
  return null;
}

/** Human-readable list of accepted domains, for the signup error message. */
export function acceptedDomains(): string[] {
  return ALL_TENANTS.flatMap((t) => t.domains).map((d) => `@${d}`);
}
