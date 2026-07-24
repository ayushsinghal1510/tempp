// ─────────────────────────────────────────────────────────────────────────────
// TIER RESEARCH — Layer 1 of the two-layer research model.
//
// The STABLE, GLOBAL base: "what a company in this salary band actually expects
// of a fresher at an Indian campus placement, how the interviewer should sound,
// how the back-and-forth flows, and what each round is FOR." Authored ONCE
// (web-researched, then hand-written), hardcoded here — never fetched at runtime,
// never per-cohort. Every cohort in a tier reuses this whole brief.
//
// On top of this sits a THIN company-specific layer researched live via Groq
// compound (companyResearch.ts). Three consumers read tier + company together:
// the admin review, the student briefing page, and the live interviewer prompt.
//
// Grounded in 2026 campus-placement reality: fresher DSA is Easy–Medium (not
// Hard); full distributed system design is NOT expected of freshers, though LLD
// can appear at top product companies; service/mass roles weigh communication
// far more than algorithms. The five coachable skills (Framing, Ownership,
// Quantification, Concision, Approach) are the canonical measurement model.
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = "tier_1" | "tier_2" | "tier_3";

export type TierProfile = {
  tier: Tier;
  label: string;
  salaryBand: string;
  /** 2–3 sentence brief on the hiring bar at this tier. */
  bar: string;
  /** What the panel expects FROM THE STUDENT. Admin- and student-facing. */
  studentExpectations: string[];
  /**
   * How the AI interviewer should SOUND at this tier — tone, register, how hard
   * it pushes. Fed into the live interviewer's system prompt.
   */
  interviewerStyle: string;
  /** The shape of the back-and-forth: how a round tends to unfold, in order. */
  questionFlow: string[];
  /** What the 3 COACHING rounds are for at this tier (teach & improve). */
  coachingObjective: string;
  /** What the 2 TEST rounds are for at this tier (measure retention). */
  testingObjective: string;
  /** Concrete "you're doing well if…" cues for the student briefing. */
  whatGoodLooksLike: string[];
  /** Which of the 5 coachable skills the panel weighs most, strongest first. */
  skillEmphasis: string[];
};

export const TIER_PROFILES: Record<Tier, TierProfile> = {
  tier_1: {
    tier: "tier_1",
    label: "Tier 1",
    salaryBand: ">10 LPA",
    bar: "Top product and high-growth companies. They hire for raw problem-solving and depth, and you're competing against the strongest students in the cohort — a correct-but-shallow answer isn't enough. They know you're a fresher and don't expect distributed-systems design, but they will push on Medium data-structure problems, low-level design, and how deeply you actually owned your projects.",
    studentExpectations: [
      "Reach the optimal solution out loud — start with brute force, then improve time and space complexity with clear reasoning.",
      "Handle ambiguity: ask clarifying questions before you code or design, and state your assumptions.",
      "Show deep ownership of at least one project — decisions you drove, not tasks you were handed.",
      "Quantify impact with real numbers (latency, users, %, cost, time saved).",
      "Stay crisp under pressure — no rambling, no filler, no going silent when stuck.",
    ],
    interviewerStyle:
      "Rigorous, probing, and fast-moving, but never hostile. Push past the first answer — ask 'why', 'what's the complexity', and 'what would you change' until you hit the edge of what the student knows. Give little hand-holding: when they stall, offer one nudge, not the answer. Hold a high bar and expect the student to reason toward it. Warm in tone, demanding in substance.",
    questionFlow: [
      "Quick intro, then straight into a Medium data-structure / algorithm problem — think out loud from brute force to optimal.",
      "A low-level design or applied-fundamentals scenario (e.g. design a rate limiter, model a parking lot).",
      "Deep dive on the hardest project on the résumé: a decision made, a trade-off, and what they'd do differently.",
      "A behavioural probe on ownership and measurable impact, pushed until a real number surfaces.",
    ],
    coachingObjective:
      "Raise the ceiling. In coaching rounds, push the student from a working answer to an optimal, well-communicated one — teach them to narrate complexity trade-offs, quantify impact, and reason aloud when stuck. One sharp fix per turn.",
    testingObjective:
      "Prove it holds under pressure. In test rounds there's no coaching — run it like the real Tier-1 panel and measure whether the student independently reaches the bar the coaching rounds set.",
    whatGoodLooksLike: [
      "You restate the problem and your assumptions before diving in.",
      "You name the trade-off you're making and why.",
      "Every project claim has a number attached to it.",
      "When stuck, you reason out loud toward the answer instead of going quiet.",
    ],
    skillEmphasis: [
      "Approach",
      "Quantification",
      "Framing",
      "Ownership",
      "Concision",
    ],
  },

  tier_2: {
    tier: "tier_2",
    label: "Tier 2",
    salaryBand: "4–10 LPA",
    bar: "Solid product and service companies. They hire for reliable fundamentals and coachability — you don't have to be the sharpest in the room, but you must be clear, honest, and demonstrably able to learn. Expect Easy–Medium coding and core CS fundamentals over exotic algorithms.",
    studentExpectations: [
      "A solid grasp of core CS fundamentals — able to explain, not just recite, DBMS, OS, OOP and networking basics.",
      "Explain one project clearly end to end: the problem, your specific part, and the outcome.",
      "Be honest about what you did versus what the team did — no inflating.",
      "Answer in structured, complete sentences.",
      "Show you're coachable — take a hint and visibly improve on the next attempt.",
    ],
    interviewerStyle:
      "Supportive but thorough. Check fundamentals plainly and give a hint when the student is close rather than letting them flounder. Encourage, but don't let vague answers slide — ask them to make it concrete. The register is that of a helpful senior engineer confirming the basics are solid and the person is easy to grow.",
    questionFlow: [
      "Warm intro and a 'walk me through a project you're proud of' — dig into their specific contribution.",
      "An Easy–Medium coding problem (sorting, hashing, two-pointer, basic recursion), reasoned aloud.",
      "Core CS fundamentals — normalization, indexing, process vs thread, OOP principles.",
      "A behavioural / fit question: why this company, how they handle feedback or disagreement.",
    ],
    coachingObjective:
      "Build a reliable floor. In coaching rounds, tighten fundamentals and teach the student to explain a project and answer a question in a clean, structured way — fix hand-waving, reward concrete examples, and make sure a correction sticks.",
    testingObjective:
      "Check retention of the basics. In test rounds, assess — without coaching — whether the student can independently give clear, honest, structured answers and hold their fundamentals together.",
    whatGoodLooksLike: [
      "You walk through a project without hand-waving the technical parts.",
      "You give a real example instead of a generic statement.",
      "You answer the question that was actually asked, then stop.",
      "You take a correction gracefully and apply it next turn.",
    ],
    skillEmphasis: [
      "Framing",
      "Ownership",
      "Concision",
      "Quantification",
      "Approach",
    ],
  },

  tier_3: {
    tier: "tier_3",
    label: "Tier 3",
    salaryBand: "<4 LPA",
    bar: "Mass-recruiting service companies and entry roles. They hire for communication, reliability, and attitude — the technical bar is basic, and clear speaking plus a genuine willingness to learn decide the outcome far more than algorithms.",
    studentExpectations: [
      "Speak clearly and confidently — communication is the single biggest lever here.",
      "Show a genuine willingness to learn and adapt.",
      "Attempt a simple coding-logic or aptitude question and reason it aloud.",
      "Come across as positive and reliable — someone who'll show up and stick around.",
      "Answer honestly and stay on topic.",
    ],
    interviewerStyle:
      "Warm, patient, and encouraging. Put the student at ease and give them room to speak. Focus on drawing out clear, confident communication rather than technical depth; when they attempt a simple problem, reward the attempt and the reasoning even if the answer is off. Never intimidate — the goal is to help a nervous fresher sound like themselves.",
    questionFlow: [
      "A relaxed 'tell me about yourself' and 'why this field' to settle nerves.",
      "A simple coding / logic problem (reverse a string, find the largest number, FizzBuzz).",
      "A couple of basic CS terms and one quantitative-aptitude question.",
      "Fit and reliability: comfort with relocation or shifts, and how they learn something new.",
    ],
    coachingObjective:
      "Build confidence and clarity. In coaching rounds, help the student speak in clear, complete sentences without filler, sound genuinely interested, and attempt simple problems without freezing.",
    testingObjective:
      "Check composure and communication. In test rounds, measure — without coaching — whether the student can hold a clear, confident, on-topic conversation and make a basic attempt on their own.",
    whatGoodLooksLike: [
      "You speak in clear, complete sentences without long pauses or filler.",
      "You sound genuinely interested and willing to learn.",
      "You attempt the simple problem and explain your thinking, even if unsure.",
      "You keep answers relevant and to the point.",
    ],
    skillEmphasis: [
      "Concision",
      "Framing",
      "Ownership",
      "Approach",
      "Quantification",
    ],
  },
};

export function tierProfile(
  tier: Tier | string | null | undefined,
): TierProfile | null {
  if (tier === "tier_1" || tier === "tier_2" || tier === "tier_3") {
    return TIER_PROFILES[tier];
  }
  return null;
}

/** Salary band from LPA: >10 = Tier 1, 4–10 = Tier 2, <4 = Tier 3. */
export function tierForSalary(lpa: number): Tier | null {
  if (!Number.isFinite(lpa) || lpa <= 0) return null;
  if (lpa > 10) return "tier_1";
  if (lpa >= 4) return "tier_2";
  return "tier_3";
}

const TIER_DISPLAY: Record<Tier, { label: string; tone: string }> = {
  tier_1: { label: "Tier 1 (>10 LPA)", tone: "text-success" },
  tier_2: { label: "Tier 2 (4–10 LPA)", tone: "text-warning" },
  tier_3: { label: "Tier 3 (<4 LPA)", tone: "text-danger" },
};

/** Display label + text-tone for a raw LPA — for live-preview UI as the admin types. */
export function tierLabelForSalary(lpa: number): {
  label: string;
  tone: string;
} {
  const tier = tierForSalary(lpa);
  return tier ? TIER_DISPLAY[tier] : { label: "—", tone: "text-faint" };
}
