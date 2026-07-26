// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL SCENARIO GENERATION — the nim (medical) counterpart to
// companyResearch.ts.
//
// An educator types a one-line brief ("truck driver, 68, newly diagnosed
// diabetes, worried about losing his licence") and gets back a structured
// patient case they can review, edit and publish. The published object is
// injected into the simulated patient's system prompt (clinicalCustoms.ts).
//
// Unlike company research this does NOT use `groq/compound`. Compound's whole
// value is live web search, and there is nothing to look up: the patient is
// fictional by design. A plain fast model is both cheaper and quicker, and the
// output is better because nothing drags it toward a real person's details.
//
// Same failure posture as company research: throws with a readable message so
// the educator flow can surface it, and the educator can always write the case
// by hand instead.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";

export type ClinicalScenario = {
  /** Short encounter title, e.g. "Mr Sharma, 78 — new diabetes diagnosis". */
  title: string;
  patientName: string;
  patientAge: number;
  /** Who they are as a person: work, family, living situation, temperament. */
  patientBackground: string;
  /** Why they are in front of the student today, in the patient's own terms. */
  presentingIssue: string;
  /** How they feel walking in — the emotional starting point of the encounter. */
  emotionalState: string;
  /** Hard of hearing, low health literacy, speaks little English, in pain… */
  communicationBarriers: string[];
  /** What they will NOT volunteer unless the student earns it. */
  hiddenConcern: string;
  /** An accompanying relative, or null if they came alone. Drives `dignity`. */
  accompaniedBy: string | null;
  /** The patient's first spoken line, in character. */
  openingLine: string;
  /** What the educator wants the student to practise. */
  learningObjectives: string[];
  /** Notes for the educator only — never shown to the student. */
  educatorNotes: string;
};

export type ScenarioInput = {
  /** The educator's free-text brief. */
  brief: string;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Deliberately not `groq/compound` — see the header comment.
const GROQ_MODEL = "openai/gpt-oss-120b";

/** The exact JSON shape we ask the model to return. */
const SHAPE = `{
  "title": "string — short encounter title, e.g. 'Mr Sharma, 78 — new diabetes diagnosis'",
  "patientName": "string — a realistic Indian name, with the title they'd expect to be called by",
  "patientAge": 0,
  "patientBackground": "string — a full paragraph: their work or former work, who they live with, how they generally carry themselves, anything that shapes how they'd talk to a young doctor",
  "presentingIssue": "string — a full paragraph on why they are here today, described the way the PATIENT would describe it, not in clinical language",
  "emotionalState": "string — how they feel walking in, and how that shows in their behaviour (guarded, chatty to cover nerves, dismissive, tearful)",
  "communicationBarriers": ["string — 2-4 concrete barriers, e.g. 'hard of hearing on the left, will ask you to repeat things'"],
  "hiddenConcern": "string — the thing they are actually most worried about and will NOT say unless the student builds enough trust to ask well",
  "accompaniedBy": "string or null — e.g. 'his daughter Priya, 40, who tends to answer for him', or null if alone",
  "openingLine": "string — the patient's first spoken sentence, fully in character",
  "learningObjectives": ["string — 3-5 communication skills this encounter is designed to exercise"],
  "educatorNotes": "string — a short paragraph for the educator on what good and poor handling look like here"
}`;

function firstJsonObject(text: string): unknown {
  // The model may wrap JSON in prose or fences — pull the first {...} block.
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
  return v
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function normaliseScenario(raw: unknown): ClinicalScenario {
  const o = (raw ?? {}) as Record<string, unknown>;
  const age = Number(o.patientAge);
  const accompanied = o.accompaniedBy;
  return {
    title: String(o.title ?? "").trim(),
    patientName: String(o.patientName ?? "").trim(),
    // Geriatric communication is the point of the exercise, so an unparseable
    // or missing age falls back into that band rather than to 0.
    patientAge: Number.isFinite(age) && age > 0 ? Math.round(age) : 70,
    patientBackground: String(o.patientBackground ?? "").trim(),
    presentingIssue: String(o.presentingIssue ?? "").trim(),
    emotionalState: String(o.emotionalState ?? "").trim(),
    communicationBarriers: asStringArray(o.communicationBarriers),
    hiddenConcern: String(o.hiddenConcern ?? "").trim(),
    accompaniedBy:
      accompanied == null ||
      accompanied === "" ||
      String(accompanied).toLowerCase() === "null"
        ? null
        : String(accompanied).trim(),
    openingLine: String(o.openingLine ?? "").trim(),
    learningObjectives: asStringArray(o.learningObjectives),
    educatorNotes: String(o.educatorNotes ?? "").trim(),
  };
}

/**
 * Turn an educator's one-line brief into a structured, editable patient case.
 * Throws with a readable message on failure.
 */
export async function generateScenario(
  input: ScenarioInput,
): Promise<ClinicalScenario> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set — add it to the environment to generate scenarios.",
    );
  }

  const brief = input.brief.trim();
  if (!brief) {
    throw new Error("Describe the patient first — even one line is enough.");
  }

  const prompt = `Write a simulated patient for a medical student's communication practice session.

The educator's brief:
"""
${brief}
"""

This encounter exists to train COMMUNICATION, not diagnosis. The student already knows the medicine. What they are bad at is talking to an older patient and making them feel comfortable, respected and heard. Build a patient who will expose that.

Return ONLY a JSON object with exactly this shape (no commentary before or after):
${SHAPE}

Rules:
- Write a person, not a case file. They have a job or a former job, opinions, a way of speaking, something they are proud of and something they are frightened of.
- The patient must be REACTIVE, not a puzzle: the material a student uncovers should depend on how well they ask, which is exactly what "hiddenConcern" is for.
- Set the age in the brief if one is given. Otherwise make them elderly (65+), since that is the population this training targets.
- Do NOT make the medicine hard. The clinical content should be ordinary and unambiguous — no rare diagnoses, no diagnostic puzzles. Difficulty must come from the human being, not the disease.
- Barriers must be things the student can actually work around in conversation (hearing, literacy, pace, an interrupting relative, embarrassment) — never anything that just blocks the encounter.
- Indian setting. Use realistic Indian names, and Hinglish where a patient of that age and background would naturally use it.
- Never include a diagnosis the student is meant to guess, and never include clinical instructions for the student.`;

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
              "You write simulated patients for medical communication training, and you return strict JSON. You are writing a human being for a student to talk to, not a clinical vignette.",
          },
          { role: "user", content: prompt },
        ],
        // Higher than company research (0.3): that job is recall and must not
        // drift, this one is characterisation and benefits from variety, so
        // two scenarios from similar briefs don't come out as the same person.
        temperature: 0.8,
      }),
    });
  } catch {
    throw new Error("Could not reach Groq — check the network and try again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Scenario generation failed (${res.status}). ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("Groq returned an empty response.");
  }

  const result = normaliseScenario(firstJsonObject(content));
  if (!result.patientName || !result.presentingIssue) {
    throw new Error(
      "The generated scenario came back incomplete — try again, or write it by hand.",
    );
  }
  return result;
}
