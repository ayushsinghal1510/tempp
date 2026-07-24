// ─────────────────────────────────────────────────────────────────────────────
// COMPANY RESEARCH — Layer 2 of the two-layer research model.
//
// A thin, company-specific layer researched LIVE (once, at cohort creation) via
// Groq's `groq/compound` agentic model, which does its own web search. The admin
// reviews and edits the result before approving the cohort; the approved object
// is stored on Cohort.companyResearch (Json) and reused forever — never re-run.
//
// Both the student briefing page and the live interviewer read this alongside the
// hardcoded tier profile (tierProfiles.ts).
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

export type CompanyResearch = {
  /** 1–2 sentence description of what the company does. */
  about: string;
  /** Industry / domain, e.g. "Fintech — payments infrastructure". */
  domain: string;
  /** Tools / stack they're known to use (empty if unknown). */
  techStack: string[];
  /** How they run interviews — rounds, format, overall vibe. */
  interviewStyle: string;
  /** Themes / topics they're known to drill in interviews. */
  signatureTopics: string[];
  /** 3–5 representative questions a candidate might face. */
  sampleQuestions: string[];
  /** What they screen for culturally / their stated values. */
  values: string[];
  /** URLs the research drew from, for the admin to trust the result. */
  sources: string[];
};

export type ResearchInput = {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  tier: "tier_1" | "tier_2" | "tier_3";
  salaryLpa: number;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "groq/compound";

const TIER_HINT: Record<string, string> = {
  tier_1: "a high-paying top-tier role (>10 LPA) — expect a demanding, deep interview",
  tier_2: "a solid mid-tier role (4–10 LPA) — expect a fundamentals-focused interview",
  tier_3: "an entry-level role (<4 LPA) — expect a communication-focused interview",
};

/** The exact JSON shape we ask the model to return. */
const SHAPE = `{
  "about": "string — a full paragraph (3-5 sentences) on what the company does, its products, size/stage, and what makes it distinctive",
  "domain": "string — industry/domain, specific (e.g. 'Fintech — payments infrastructure for SMBs')",
  "techStack": ["string — 4-8 concrete technologies/tools they use or that fit their domain"],
  "interviewStyle": "string — a full paragraph on how they run interviews: number and type of rounds, format (coding/verbal/take-home), difficulty, and overall vibe",
  "signatureTopics": ["string — 5-7 specific topics/themes they drill in interviews for this role"],
  "sampleQuestions": ["string — 5-6 concrete, realistic questions a candidate might actually face"],
  "values": ["string — 4-6 things they screen for culturally, each with a short phrase of context"],
  "sources": ["url — the real URLs you actually used"]
}`;

function firstJsonObject(text: string): unknown {
  // compound may wrap JSON in prose or fences — pull the first {...} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

function normalise(raw: unknown): CompanyResearch {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    about: String(o.about ?? "").trim(),
    domain: String(o.domain ?? "").trim(),
    techStack: asStringArray(o.techStack),
    interviewStyle: String(o.interviewStyle ?? "").trim(),
    signatureTopics: asStringArray(o.signatureTopics),
    sampleQuestions: asStringArray(o.sampleQuestions),
    values: asStringArray(o.values),
    sources: asStringArray(o.sources),
  };
}

/**
 * Research one company via Groq compound (web-search enabled). Returns a
 * structured, editable draft. Throws with a readable message on failure so the
 * admin flow can surface it.
 */
export async function researchCompany(
  input: ResearchInput,
): Promise<CompanyResearch> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set — add it to the environment to run company research.",
    );
  }

  const prompt = `Research the company "${input.companyName}" for a campus placement interview in India.
Role: ${input.jobTitle}. This is ${TIER_HINT[input.tier] ?? "a campus role"}.
Job description provided by the placement office:
"""
${input.jobDescription || "(none provided)"}
"""

Search the web for accurate, current information about this specific company and how it interviews freshers/campus candidates for this kind of role. Focus on what actually helps a student prepare.

Return ONLY a JSON object with exactly this shape (no commentary before or after):
${SHAPE}

Rules:
- This is prep guidance for students, not a fact sheet — every field MUST be filled with a complete, useful brief. Do not leave fields empty.
- Anchor to THIS company wherever you find real information. Where company-specific detail is thin (common for smaller companies), generalise sensibly from the company's domain and this tier's typical interview so the student still gets a realistic, actionable brief — but keep it plausible for this company, never contradict what you found.
- Prefer depth over caution: full paragraphs for "about" and "interviewStyle", and the full requested count of items for every list.
- Only "sources" must be strictly real — list the actual URLs you used, and leave it empty rather than inventing a URL.`;

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a placement-prep researcher. You search the web and return strict JSON that helps Indian engineering students prepare for a specific company's interview.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });
  } catch {
    throw new Error("Could not reach Groq — check the network and try again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Groq research failed (${res.status}). ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("Groq returned an empty response.");
  }

  const result = normalise(firstJsonObject(content));
  if (!result.about && result.signatureTopics.length === 0) {
    throw new Error("Research came back empty — try again or edit manually.");
  }
  return result;
}
