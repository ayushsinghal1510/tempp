// Builds the interview "company context" from a real cohort + vacancy — this is
// what replaces the old hardcoded COMPANIES/agent presets. Everything the
// interviewer needs about the company now comes from the JD the admin entered.

export type CompanyContext = {
  name: string;
  greeting: string;
  systemPrompt: string;
  questionStyle: string[];
};

const TIER_LABEL: Record<string, string> = {
  tier_1: "Tier 1 (>10 LPA)",
  tier_2: "Tier 2 (4–10 LPA)",
  tier_3: "Tier 3 (<4 LPA)",
};

// The research the admin approved (subset we actually use in the prompt).
export type CompanyResearchLite = {
  about?: string;
  domain?: string;
  interviewStyle?: string;
  signatureTopics?: string[];
  sampleQuestions?: string[];
  values?: string[];
} | null;

// The hardcoded tier base (subset we use in the prompt).
export type TierProfileLite = {
  bar?: string;
  interviewerStyle?: string;
  questionFlow?: string[];
  studentExpectations?: string[];
  coachingObjective?: string;
  testingObjective?: string;
} | null;

export function buildCompanyContext(input: {
  companyName: string;
  candidateName: string;
  jobTitle?: string | null;
  jobDescription?: string | null;
  tier?: string | null;
  salaryLpa?: number | null;
  skillPriorities?: string[];
  research?: CompanyResearchLite;
  tierProfile?: TierProfileLite;
  /** Coaching rounds teach & improve; test rounds only measure retention. */
  roundKind?: "coaching" | "test";
  /** Who the student hears. Defaults to Franklin, which is what the company
   *  flow (customs.ts) still uses; the practice flow passes the interviewer
   *  the student picked so the greeting and the voice agree. */
  interviewerName?: string;
}): CompanyContext {
  const {
    companyName,
    candidateName,
    jobTitle,
    jobDescription,
    tier,
    salaryLpa,
    skillPriorities = [],
    research = null,
    tierProfile = null,
    roundKind = "coaching",
    interviewerName = "Franklin",
  } = input;

  const role = jobTitle?.trim() || "the open role";
  const tierLabel = tier ? TIER_LABEL[tier] ?? "" : "";
  const salaryLine =
    salaryLpa != null ? `~${salaryLpa} LPA` : "";
  const priorities = skillPriorities.length
    ? skillPriorities.join(", ")
    : "Framing, Ownership, Quantification, Concision, Approach";

  // Prefer the researched topics as the interviewer's question style; fall back
  // to generic role-based buckets when there's no research.
  const questionStyle =
    research?.signatureTopics && research.signatureTopics.length > 0
      ? research.signatureTopics
      : [
          "Behavioral (STAR method)",
          `Role-specific technical for ${role}`,
          "Situational / scenario questions",
          "Follow-ups on their own projects",
        ];

  // Company research block (from Groq compound, admin-approved).
  const researchBlock = research
    ? `
COMPANY RESEARCH (what this specific company actually does and asks — use it):
${research.about ? `About: ${research.about}` : ""}
${research.domain ? `Domain: ${research.domain}` : ""}
${research.interviewStyle ? `Interview style: ${research.interviewStyle}` : ""}
${
  research.signatureTopics && research.signatureTopics.length
    ? `Topics they drill: ${research.signatureTopics.join(", ")}`
    : ""
}
${
  research.sampleQuestions && research.sampleQuestions.length
    ? `Representative questions to draw from:\n- ${research.sampleQuestions.join("\n- ")}`
    : ""
}
${
  research.values && research.values.length
    ? `What they value: ${research.values.join(", ")}`
    : ""
}`.replace(/\n{2,}/g, "\n")
    : "";

  // Tier base (hardcoded) — the difficulty bar and register for this salary band.
  const objective =
    roundKind === "test"
      ? tierProfile?.testingObjective
      : tierProfile?.coachingObjective;
  const tierBlock = tierProfile
    ? `
TIER BAR (the standard for this salary band — hold the student to it):
${tierProfile.bar ?? ""}
${tierProfile.interviewerStyle ? `How to sound at this tier: ${tierProfile.interviewerStyle}` : ""}
${
  tierProfile.studentExpectations && tierProfile.studentExpectations.length
    ? `They expect:\n- ${tierProfile.studentExpectations.join("\n- ")}`
    : ""
}
${
  tierProfile.questionFlow && tierProfile.questionFlow.length
    ? `Typical flow:\n- ${tierProfile.questionFlow.join("\n- ")}`
    : ""
}
${
  objective
    ? `THIS ROUND'S OBJECTIVE (${roundKind === "test" ? "TEST — do NOT coach, only assess" : "COACHING — teach and improve"}): ${objective}`
    : ""
}`.replace(/\n{2,}/g, "\n")
    : "";

  const systemPrompt = `${companyName} is hiring for ${role}${
    tierLabel || salaryLine ? ` (${[tierLabel, salaryLine].filter(Boolean).join(", ")})` : ""
  }. Run the practice interview the way a ${companyName} panel actually would for this role.
${tierBlock}${researchBlock}

JOB DESCRIPTION (source of truth for what to ask and what good looks like):
${jobDescription?.trim() || "No detailed JD was provided — ask well-rounded questions for this role and company."}

WHAT TO PRIORITISE:
Weight your questions and coaching toward these skills, strongest priority first: ${priorities}. Pull concrete question topics from the research and JD above rather than asking generic questions.`;

  const greeting = `Hi ${candidateName}, welcome to your ${companyName} practice interview for ${role}. I'm ${interviewerName} — think of me as your coach and interviewer in one. We'll run real ${companyName}-style questions and I'll give you honest feedback as we go. Whenever you're ready, start by telling me a little about yourself.`;

  return { name: companyName, greeting, systemPrompt, questionStyle };
}
