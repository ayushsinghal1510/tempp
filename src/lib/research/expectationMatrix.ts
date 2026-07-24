// The degree × academic-tier expectation matrix — a display-only reference
// for the drive briefing page's "what we'll focus on for you" panel. This is
// NOT wired into the live LLM system prompt: the interviewer still only
// coaches the 6 communication topics (practiceCustoms.ts); Understanding and
// Correctness here are about calibrating what the STUDENT is shown, not
// about telling the AI to start coaching content-correctness.
//
// Each (degree, academic tier) column is a fixed 20-point emphasis budget
// (0-5 per criterion) split across 12 criteria — comparable within a column,
// not an absolute per-cell bar. Originally a 12-point/0-3 budget, reviewed
// and locked with the user column by column; rescaled to 20-point/0-5
// (×5/3, rounded, rounding drift absorbed into each row's largest original
// cells) for finer-grained display — relative emphasis between criteria is
// unchanged from the original locked values. See the original derivation
// logic (still accurate to the *relative* weights): each degree has a
// tier-2 baseline (technical degrees weight Approach/Understanding/
// Correctness/Numbers highest; business/commerce degrees weight Framing/
// Confidence/Responsibility/Examples/PastExperience highest, with Bcom/Mcom
// keeping more Numbers than BBA/MBA; postgrad variants shift Responsibility
// up from Posture vs their UG counterpart). Tier 1 (>9 CGPA) = baseline
// shifted from Understanding/Correctness toward Confidence/Numbers
// (fundamentals assumed solid, budget moves to refinement). Tier 3
// (<7.5 CGPA) = baseline shifted from Confidence/Approach toward
// Understanding/Correctness (budget moves to shoring up fundamentals).

export const DEGREES = [
  "btech",
  "mtech",
  "bba",
  "mba",
  "bca",
  "mca",
  "bcom",
  "mcom",
] as const;

export type Degree = (typeof DEGREES)[number];

export const DEGREE_LABEL: Record<Degree, string> = {
  btech: "B.Tech",
  mtech: "M.Tech",
  bba: "BBA",
  mba: "MBA",
  bca: "BCA",
  mca: "MCA",
  bcom: "B.Com",
  mcom: "M.Com",
};

export type AcademicTier = "tier_1" | "tier_2" | "tier_3";

export const ACADEMIC_TIER_LABEL: Record<AcademicTier, string> = {
  tier_1: "Tier 1 (>9 CGPA)",
  tier_2: "Tier 2 (7.5–9 CGPA)",
  tier_3: "Tier 3 (<7.5 CGPA)",
};

/** >9 = tier_1, 7.5-9 = tier_2, below = tier_3. */
export function academicTierForCgpa(cgpa: number): AcademicTier {
  if (cgpa > 9) return "tier_1";
  if (cgpa >= 7.5) return "tier_2";
  return "tier_3";
}

export const EXPECTATION_CRITERIA = [
  "posture",
  "framing",
  "approach",
  "numbers",
  "understanding",
  "correctness",
  "confidence",
  "responsibility",
  "handGesture",
  "examples",
  "pastExperience",
  "eyeContact",
] as const;

export type ExpectationCriterion = (typeof EXPECTATION_CRITERIA)[number];

export const CRITERION_LABEL: Record<ExpectationCriterion, string> = {
  posture: "Posture",
  framing: "Framing",
  approach: "Approach",
  numbers: "Numbers",
  understanding: "Understanding",
  correctness: "Correctness",
  confidence: "Confidence",
  responsibility: "Responsibility",
  handGesture: "Hand Gesture",
  examples: "Examples",
  pastExperience: "Past Experience",
  eyeContact: "Eye Contact",
};

type CriterionWeights = Record<ExpectationCriterion, number>;

/** Rows: Pos, Fra, App, Num, Und, Cor, Con, Res, HG, Exa, PEx, EC. Each sums to 20. */
function row(
  posture: number,
  framing: number,
  approach: number,
  numbers: number,
  understanding: number,
  correctness: number,
  confidence: number,
  responsibility: number,
  handGesture: number,
  examples: number,
  pastExperience: number,
  eyeContact: number,
): CriterionWeights {
  return {
    posture,
    framing,
    approach,
    numbers,
    understanding,
    correctness,
    confidence,
    responsibility,
    handGesture,
    examples,
    pastExperience,
    eyeContact,
  };
}

export const EXPECTATION_MATRIX: Record<
  Degree,
  Record<AcademicTier, CriterionWeights>
> = {
  btech: {
    tier_1: row(2, 2, 2, 3, 2, 2, 3, 2, 0, 2, 0, 0),
    tier_2: row(2, 2, 2, 2, 3, 3, 2, 2, 0, 2, 0, 0),
    tier_3: row(2, 2, 2, 2, 4, 4, 0, 2, 0, 2, 0, 0),
  },
  mtech: {
    tier_1: row(0, 2, 3, 3, 2, 2, 3, 3, 0, 2, 0, 0),
    tier_2: row(0, 2, 3, 2, 3, 3, 2, 3, 0, 2, 0, 0),
    tier_3: row(0, 2, 2, 2, 4, 5, 0, 3, 0, 2, 0, 0),
  },
  bca: {
    tier_1: row(2, 2, 2, 2, 2, 2, 3, 2, 0, 3, 0, 0),
    tier_2: row(2, 2, 2, 2, 2, 3, 2, 2, 0, 3, 0, 0),
    tier_3: row(2, 2, 0, 2, 4, 5, 0, 2, 0, 3, 0, 0),
  },
  mca: {
    tier_1: row(0, 2, 2, 3, 2, 2, 3, 3, 0, 3, 0, 0),
    tier_2: row(0, 2, 2, 2, 3, 3, 2, 3, 0, 3, 0, 0),
    tier_3: row(0, 2, 0, 2, 5, 5, 0, 3, 0, 3, 0, 0),
  },
  bba: {
    tier_1: row(0, 3, 2, 3, 0, 0, 4, 2, 0, 2, 2, 2),
    tier_2: row(0, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2),
    tier_3: row(0, 2, 0, 2, 3, 3, 2, 2, 0, 2, 2, 2),
  },
  mba: {
    tier_1: row(0, 3, 2, 3, 0, 0, 5, 3, 0, 2, 2, 0),
    tier_2: row(0, 2, 2, 2, 2, 2, 3, 3, 0, 2, 2, 0),
    tier_3: row(0, 3, 0, 2, 3, 3, 2, 3, 0, 2, 2, 0),
  },
  bcom: {
    tier_1: row(2, 2, 2, 4, 0, 0, 2, 2, 0, 2, 2, 2),
    tier_2: row(1, 1, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2),
    tier_3: row(2, 2, 0, 2, 3, 3, 0, 2, 0, 2, 2, 2),
  },
  mcom: {
    tier_1: row(0, 2, 2, 4, 0, 0, 3, 3, 0, 2, 2, 2),
    tier_2: row(0, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2),
    tier_3: row(0, 2, 0, 3, 3, 3, 0, 3, 0, 2, 2, 2),
  },
};

export type ExpectationEntry = {
  key: ExpectationCriterion;
  label: string;
  weight: number;
};

/** The 12 criteria for a (degree, academic tier), sorted highest-weight first. */
export function expectationRow(
  degree: Degree,
  tier: AcademicTier,
): ExpectationEntry[] {
  const weights = EXPECTATION_MATRIX[degree][tier];
  return EXPECTATION_CRITERIA.map((key) => ({
    key,
    label: CRITERION_LABEL[key],
    weight: weights[key],
  })).sort((a, b) => b.weight - a.weight);
}
