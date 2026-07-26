// Objective metrics for the clinical track, computed from data the webhook
// already stores — PracticeTurn.transcript (the student's words) and
// PracticeTurn.speak (the patient's). No new capture, no extra model call.
//
// These exist alongside the 6-topic rubric rather than inside it, and that is
// the point: the rubric scores are a model's judgement, and a model's judgement
// is the thing an educator is most entitled to be sceptical about. These two
// are counted, not judged. They come out the same every time you compute them,
// which is what makes them worth putting in front of someone who has to defend
// a mark.

import type { PracticeTurn } from "@prisma/client";

/** The turn fields these metrics read. Everything else can stay unselected. */
export type TurnText = Pick<PracticeTurn, "transcript" | "speak">;

function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export type TalkRatio = {
  studentWords: number;
  patientWords: number;
  /** studentWords / (studentWords + patientWords), 0–1. Null when silent. */
  ratio: number | null;
};

/**
 * How much of the encounter the student filled with their own voice.
 *
 * Medical students systematically over-talk with older patients — they fill
 * silences, finish sentences, and move on before an answer has landed. A ratio
 * well above half means the person who came to be heard did most of the
 * listening, which is a specific, fixable behaviour rather than a vague note
 * about "rapport".
 *
 * Deliberately reported without a pass/fail threshold. The right balance
 * depends on the encounter — breaking news is legitimately doctor-heavy, a
 * history is not — so this is for a human to read, not a rule to enforce.
 */
export function talkRatio(turns: TurnText[]): TalkRatio {
  let studentWords = 0;
  let patientWords = 0;
  for (const t of turns) {
    studentWords += wordCount(t.transcript);
    patientWords += wordCount(t.speak);
  }
  const total = studentWords + patientWords;
  return {
    studentWords,
    patientWords,
    ratio: total > 0 ? studentWords / total : null,
  };
}

// Terms a patient would not be expected to follow. Kept to words whose plain
// alternative is obvious, so a hit is genuinely a missed chance to say the
// simpler thing — not a penalty for using a word that has no lay equivalent.
//
// Matched on word boundaries and case-insensitively.
const JARGON_TERMS = [
  "hba1c",
  "glycaemic",
  "glycemic",
  "hyperglycaemia",
  "hyperglycemia",
  "hypoglycaemia",
  "hypoglycemia",
  "neuropathy",
  "nephropathy",
  "retinopathy",
  "myocardial",
  "infarction",
  "ischaemia",
  "ischemia",
  "hypertension",
  "hypotension",
  "arrhythmia",
  "tachycardia",
  "bradycardia",
  "dyspnoea",
  "dyspnea",
  "oedema",
  "edema",
  "titrate",
  "titration",
  "contraindicated",
  "prognosis",
  "aetiology",
  "etiology",
  "idiopathic",
  "benign",
  "malignant",
  "metastasis",
  "metastatic",
  "biopsy",
  "differential diagnosis",
  "comorbidity",
  "comorbidities",
  "prophylaxis",
  "sequelae",
  "acute",
  "chronic",
  "lesion",
  "palliative",
];

export type JargonHit = { term: string; count: number };

export type JargonReport = {
  /** Total jargon words spoken by the student across the encounter. */
  total: number;
  /** Distinct terms used, most-used first. */
  hits: JargonHit[];
};

/**
 * Counts clinical terms the student used that the patient would not follow.
 *
 * Only the student's own words are searched: the patient never uses these, and
 * counting the simulated patient's speech would be counting our own prompt.
 */
export function jargonReport(turns: TurnText[]): JargonReport {
  const counts = new Map<string, number>();

  for (const turn of turns) {
    const text = (turn.transcript ?? "").toLowerCase();
    if (!text) continue;
    for (const term of JARGON_TERMS) {
      // Escaped because a couple of terms contain a space; \b keeps "acute"
      // from matching inside a longer word.
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      const found = text.match(re);
      if (found) counts.set(term, (counts.get(term) ?? 0) + found.length);
    }
  }

  const hits = [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: hits.reduce((n, h) => n + h.count, 0),
    hits,
  };
}

export type ClinicalRoundMetrics = {
  talk: TalkRatio;
  jargon: JargonReport;
};

/** Both metrics for one encounter. */
export function clinicalRoundMetrics(turns: TurnText[]): ClinicalRoundMetrics {
  return { talk: talkRatio(turns), jargon: jargonReport(turns) };
}
