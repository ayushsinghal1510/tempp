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
//   nimc → outbound admissions calling. A counsellor types a phone number and
//         the agent dials it over PSTN; the webhook returns a transcript plus
//         flat extracted strings (name, course, percentage) rather than scored
//         topics. Also unscored, so `topics` is empty here too.
//   pr → retail service-recovery roleplay. A frontline trainee handles Mr
//         Cheryl, a firm customer returning a defective shirt. Structurally the
//         second `mm`: same compiled-in simulation, same two-face avatar. What
//         it adds is physical scene actions (he hands over a receipt, passes
//         the shirt, raises his phone) that the room renders on screen, and a
//         running pass/retry/fail score the trainee can watch move.
//   mm → conflict-handling roleplay. A user faces a fixed hostile client (Mr
//         Muthu, an aggrieved aid applicant) rendered as a two-faced avatar
//         that visibly switches between angry and calm as the user manages
//         him; the org's admin reads the sessions back. Unscored like cus, but
//         unlike cus the prompt is compiled in rather than admin-authored —
//         the difficulty of the simulation IS the product, so it is not
//         something a customer can accidentally sand down.
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
   * The session is a fixed, compiled-in roleplay against a multi-face avatar
   * rather than anything authored in the product. Only `mm`.
   *
   * This is separate from `workflow` on purpose: both tracks run the same
   * PracticeCompany-of-kind-`workflow` plumbing, so this is what tells the live
   * page which customs builder to hand it to (buildMuthuCustoms vs
   * buildWorkflowCustoms). `workflow: false` alongside it is what keeps the
   * educator's authoring form and the save action off the prompt.
   */
  roleplay: boolean;
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
  track: "interview" | "clinical" | "custom" | "calling" | "roleplay";
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
    /**
     * What the AI side of a transcript line is called — the label in front of
     * `turn.speak` on the round page and the educator's session page.
     *
     * Config rather than a `track === "clinical" ? "Patient" : "Coach"` at each
     * of those two call sites, which is what this replaced. That ternary had no
     * room for a third answer, and "Coach" is not a harmless default: on `mm`
     * the voice on the other side is a man shouting at you, and labelling him
     * the coach misreads the whole transcript.
     */
    agentNoun: string;
  };
};

// The original rubric. Order matters — it's the axis order on the radar and
// the series order on every timeline.
// FIVE topics, not six. `approach` was folded into `framing` — both asked how
// the answer was BUILT, so a single "you dived in before structuring it"
// moment had to be arbitrarily filed under one of them and neither score told
// the truth alone. Must stay in step with TOPIC_KEYS in voice/practiceCustoms.ts.
//
// Every surviving topic KEEPS ITS ORIGINAL COLOUR, which is why --chart-3 is
// now unused here: re-packing the palette would have silently recoloured four
// topics that did not change, and a student comparing an old session to a new
// one would see their confidence line change colour for no reason.
//
// Rounds recorded before this still carry an `approach` key in their topics
// JSON. Nothing reads it now, so it is inert rather than lost — old sessions
// simply render four lines plus posture instead of five.
const INTERVIEW_TOPICS: TopicMeta[] = [
  { key: "posture", label: "Posture", color: "var(--chart-1)" },
  { key: "framing", label: "Framing", color: "var(--chart-2)" },
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
      roleplay: false,
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
      agentNoun: "Coach",
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
      roleplay: false,
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
      agentNoun: "Patient",
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
      roleplay: false,
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
      agentNoun: "Agent",
    },
  },
  nimc: {
    key: "nimc",
    label: "Admissions calling",
    domains: ["nimc.com"],
    track: "calling",
    // Empty for the same reason as `cus`: nothing here is scored. The agent
    // extracts facts (name, course, percentage), not rubric judgements.
    topics: [],
    features: {
      company: false,
      resume: false,
      research: false,
      scenario: false,
      // The prompt is a fixed admissions script compiled into
      // src/lib/voice/nimcPrompt.ts, not something an admin authors per-org.
      workflow: false,
      roleplay: false,
      scoring: false,
      // The counsellor dials whoever they like; there is nothing to assign.
      assignments: false,
      autoEnroll: true,
      courseField: false,
    },
    // No student funnel at all — the unit of work is a call, not an enrolment
    // that progresses through stages. Empty is meant literally, and every
    // consumer already renders nothing for a zero-length list.
    funnelStages: [],
    copy: {
      unitSingular: "lead",
      unitPlural: "leads",
      unitTitle: "Lead",
      sessionNoun: "call",
      agentNoun: "Sneha",
    },
  },
  mm: {
    key: "mm",
    label: "Conflict roleplay",
    domains: ["mm.com"],
    track: "roleplay",
    // Empty, like cus and nimc. Nothing here is scored — the point of the
    // exercise is the recording the admin reads back, and putting a six-axis
    // rubric on "did you survive an angry man" would invent precision that
    // isn't there. Every consumer already renders nothing for zero topics.
    topics: [],
    features: {
      company: false,
      resume: false,
      research: false,
      scenario: false,
      // False on purpose, and it is the pair below that matters: the greeting
      // and prompt are compiled into src/lib/voice/muthuPrompt.ts, so the
      // educator gets no authoring form and saveWorkflow refuses this tenant.
      workflow: false,
      roleplay: true,
      scoring: false,
      // One simulation, everyone runs it. Same reasoning as cus — asking an
      // admin to assign the only thing in the product person by person is
      // friction with nothing behind it.
      assignments: false,
      autoEnroll: true,
      courseField: false,
    },
    // No assignment step and no scores, so — exactly as on cus — the only
    // stages that carry information are started and completed.
    funnelStages: ["started", "completed"],
    copy: {
      unitSingular: "roleplay",
      unitPlural: "roleplays",
      unitTitle: "Roleplay",
      sessionNoun: "session",
      agentNoun: "Mr Muthu",
    },
  },
  pr: {
    key: "pr",
    label: "Retail service recovery",
    domains: ["pr.com"],
    track: "roleplay",
    // Empty for the same reason as mm. This track IS assessed — out of twenty,
    // across four dimensions — but that happens once at the end, in prose, not
    // as a per-turn rubric. `topics` is what drives the radar and the turn-by-
    // turn timelines, and there is nothing per-turn to put in them.
    topics: [],
    features: {
      company: false,
      resume: false,
      research: false,
      scenario: false,
      workflow: false,
      // Same compiled-in-simulation switch as mm. What tells the two apart at
      // the call site is the tenant key, not this flag — see the live page.
      roleplay: true,
      // False despite the /20 debrief: `scoring` gates the six-topic rubric
      // surfaces (radar, timelines, weakest-first, triage), none of which this
      // track produces data for. The end-of-session assessment renders through
      // the roleplay debrief panel instead.
      scoring: false,
      assignments: false,
      autoEnroll: true,
      courseField: false,
    },
    funnelStages: ["started", "completed"],
    copy: {
      unitSingular: "roleplay",
      unitPlural: "roleplays",
      unitTitle: "Roleplay",
      sessionNoun: "session",
      agentNoun: "Mr Cheryl",
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
