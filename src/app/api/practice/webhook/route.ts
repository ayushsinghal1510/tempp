import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { userTag, companyTag, roundTag } from "@/lib/practice/cacheTags";
import { topicsFor } from "@/lib/tenants/config";
import { parseRunningScore } from "@/lib/practice/runningScore";

// Voxio pings this URL whenever the workflow reaches the "ask_for_input"
// stopping node — i.e. once per conversational turn. Confirmed real shape
// (2026-07-22, first live call):
//
// {
//   status: "start" | "running",
//   responses: [
//     { session_id, waiting_for_input: false, out: { user_input, ... } },      // transcription node
//     { session_id, prompt_tokens, completion_tokens, ... },                    // llm token usage, no `out`
//     { session_id, waiting_for_input: false, out: { speak, posture, ... } },  // response node
//     { session_id, waiting_for_input: true, required_variable: "user_input" } // the stopping checkpoint itself
//   ],
//   "session-data": { ... } // present at least on "start"
// }
//
// There is no top-level `variables` object — every node's output lives in its
// own `responses[i].out`. `session_id` is repeated on every item, not once at
// the top level. The transcription node's `out.user_input` also has the
// vision report concatenated straight into the string inside a
// <turn-visual-context>...</turn-visual-context> tag — stripped below.
//
// Every raw body is still logged to WebhookEvent unconditionally, before any
// of this parsing, so nothing is lost if this shape shifts again.

// The topic keys are NOT a constant here: they depend on which product the
// student belongs to (interview vs clinical — see lib/tenants/config.ts). They
// are resolved per round, from the round's own owner, so a clinical session can
// never be parsed against the interview rubric and silently drop every score.

const VISUAL_CONTEXT_RE = /<turn-visual-context>[\s\S]*?<\/turn-visual-context>/i;

type ResponseItem = {
  session_id?: string;
  out?: Record<string, unknown>;
};

function getResponses(body: Record<string, unknown>): ResponseItem[] {
  return Array.isArray(body.responses) ? (body.responses as ResponseItem[]) : [];
}

function extractRoundId(body: Record<string, unknown>): string | null {
  for (const r of getResponses(body)) {
    if (typeof r.session_id === "string") return r.session_id;
  }
  return null;
}

// The only kink types the UI knows how to colour and label. Must stay in step
// with TYPE_BADGE/TYPE_COLOR/TYPE_LABEL in lib/practice/topics.ts — anything
// missing here is stripped below and the event is lost, so a type added to the
// prompt without being added here silently never arrives.
const KINK_TYPES = new Set([
  "suggestion",
  "acknowledged",
  "adopted",
  "demonstrated",
  "repeated",
]);

/**
 * Drop a kink type the model invented.
 *
 * Observed in live data: `improved` (twice), which is in none of TYPE_BADGE /
 * TYPE_COLOR / TYPE_LABEL and so renders as an uncoloured chip labelled with
 * the raw string. The prompt now forbids anything outside the four, but the
 * model is the one filling this in, so the storage layer must not depend on it
 * complying. Score and description are kept either way — only the unusable
 * type is cleared, which downgrades the turn to "no kink" rather than losing
 * the score history along with it.
 */
function normaliseTopic(value: object): object {
  const v = value as { type_?: unknown };
  if (typeof v.type_ === "string" && v.type_ !== "" && !KINK_TYPES.has(v.type_)) {
    console.warn(`[webhook] discarding unknown kink type_: ${v.type_}`);
    return { ...value, type_: "" };
  }
  return value;
}

/**
 * The `mm` debrief, if this payload is the one carrying it.
 *
 * Fires once per round, at the very end: the roleplay graph's conditional sends
 * the meeting to an assessor model whose out-node emits score/feedback/summary.
 * That payload has no `speak` and no `user_input`, so without this it would be
 * discarded a few lines below as an empty turn and the entire assessment would
 * be lost with it.
 *
 * `score` arrives as a string (see the llm_return_type comment in
 * muthuCustoms.ts) and is parsed here rather than trusted. A model that ignores
 * the "bare number only" instruction and returns "7/10" or "8 out of 10" gives
 * NaN, which is stored as null — the prose is the substance and is kept either
 * way, so a mangled number downgrades the debrief rather than dropping it.
 */
function extractDebrief(body: Record<string, unknown>): {
  score: number | null;
  total: number | null;
  feedback: string;
  summary: string;
} | null {
  let feedback = "";
  let summary = "";
  let score: number | null = null;
  let total: number | null = null;
  let found = false;

  for (const r of getResponses(body)) {
    const out = r.out;
    if (!out) continue;

    const hasFeedback = typeof out.feedback === "string" && out.feedback.trim();
    const hasSummary = typeof out.summary === "string" && out.summary.trim();
    const hasTotal = typeof out.total === "string" && out.total.trim();

    // The gate is prose, never `score`. On `pr` a `score` key rides EVERY turn
    // (it is the running STATUS_VALUE), so treating its presence as "this is
    // the debrief" would complete the round on the first exchange. Only an out
    // that carries feedback, summary or a total is an assessment node's.
    if (!hasFeedback && !hasSummary && !hasTotal) continue;
    found = true;

    if (hasFeedback) feedback = (out.feedback as string).trim();
    if (hasSummary) summary = (out.summary as string).trim();

    if (hasTotal) {
      const parsed = Number.parseInt((out.total as string).trim(), 10);
      total = Number.isFinite(parsed) ? parsed : null;
      if (total === null) {
        console.warn(`[practice webhook] unparseable debrief total: ${out.total}`);
      }
    }

    // `mm` returns its 0-10 number as `score` inside this same out. Read only
    // here, alongside the prose, so it can never collide with `pr`'s per-turn
    // running score.
    if (typeof out.score === "string" && out.score.trim()) {
      const parsed = Number.parseFloat((out.score as string).trim());
      score = Number.isFinite(parsed) ? parsed : null;
      if (score === null) {
        console.warn(`[practice webhook] unparseable debrief score: ${out.score}`);
      }
    }
  }

  return found ? { score, total, feedback, summary } : null;
}

function extractTurn(
  body: Record<string, unknown>,
  topicKeys: string[],
): {
  transcript: string;
  speak: string | null;
  frame: string | null;
  actions: string[] | null;
  runningScore: string | null;
  topics: Record<string, unknown>;
} {
  let transcript = "";
  let speak: string | null = null;
  let frame: string | null = null;
  let actions: string[] | null = null;
  let runningScore: string | null = null;
  const topics: Record<string, unknown> = {};

  for (const r of getResponses(body)) {
    const out = r.out;
    if (!out) continue;
    if (typeof out.user_input === "string") {
      transcript = out.user_input.replace(VISUAL_CONTEXT_RE, "").trim();
    }
    if (typeof out.speak === "string") {
      speak = out.speak;
    }
    // `mm` only — every other tenant's graph never emits it. Read from the
    // same `out` as `speak` because they are emitted together by the response
    // node, so the face stored here is the one worn for this exact line.
    if (typeof out.frame === "string" && out.frame.trim()) {
      frame = out.frame.trim();
    }
    // `pr` only. Filtered to strings rather than stored raw: this is a model's
    // free-form list, and one malformed entry must not make the column
    // unreadable for the room that renders it.
    if (Array.isArray(out.actions)) {
      const tags = out.actions.filter(
        (a): a is string => typeof a === "string" && a.trim().length > 0,
      );
      if (tags.length) actions = tags.map((a) => a.trim());
    }
    // The turn's own key is `score`; stored under a distinct name because
    // `overallScore` on the round is a different scale and confusing the two
    // would be silent and wrong. Validated for shape, not corrected — an
    // unparseable status renders as no score rather than a guessed one.
    if (typeof out.score === "string" && out.score.trim()) {
      runningScore = out.score.trim();
    }
    for (const key of topicKeys) {
      const value = out[key];
      if (value && typeof value === "object") topics[key] = normaliseTopic(value);
    }
  }

  return { transcript, speak, frame, actions, runningScore, topics };
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // Not JSON, or empty — still logged below verbatim.
  }

  // Log EVERY call, unconditionally, before anything else.
  await prisma.webhookEvent.create({
    data: {
      source: "voxio_practice",
      rawBody,
      parsed: (body as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  if (!body) {
    return NextResponse.json({ ok: true, note: "non-JSON body, logged only" });
  }

  const roundId = extractRoundId(body);
  if (!roundId) {
    console.warn("[practice webhook] no roundId found in payload — logged only");
    return NextResponse.json({ ok: true, note: "no roundId, logged only" });
  }

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
    include: { user: { select: { tenant: true } } },
  });
  if (!round) {
    console.warn(`[practice webhook] unknown round ${roundId} — logged only`);
    return NextResponse.json({ ok: true, note: "unknown round, logged only" });
  }

  // The debrief and the final turn arrive in the SAME payload, confirmed in
  // live data (2026-07-31): the response node's speak/frame/end_session and the
  // assessor's score/feedback/summary are both present under `responses[]`.
  //
  // So this must NOT return early. An earlier version did, and it silently ate
  // the last turn of every roleplay — which happens to be the only turn where
  // Mr Muthu's frame is "normal", so the stored transcript showed him angry
  // from start to finish and the live room never saw a face change to announce.
  // Both are extracted, both are written, neither branch owns the response.
  const topicKeys = topicsFor(round.user.tenant).map((t) => t.key);
  const { transcript, speak, frame, actions, runningScore, topics } =
    extractTurn(body, topicKeys);

  const debrief = extractDebrief(body);
  if (debrief) {
    // `pr` closes on the running score's status prefix, which arrives on the
    // final turn in this same payload. Falling back to the last stored one
    // covers the case where the assessment lands in a payload of its own.
    const finalScore =
      parseRunningScore(runningScore) ??
      parseRunningScore(
        (
          await prisma.practiceTurn.findFirst({
            where: { practiceRoundId: roundId, runningScore: { not: null } },
            orderBy: { turnNumber: "desc" },
            select: { runningScore: true },
          })
        )?.runningScore,
      );

    await prisma.practiceRound.update({
      where: { id: roundId },
      data: {
        debriefFeedback: debrief.feedback || null,
        debriefSummary: debrief.summary || null,
        ...(debrief.total !== null ? { debriefTotal: debrief.total } : {}),
        ...(finalScore ? { outcome: finalScore.status } : {}),
        // `pr` has no debrief `score` of its own — its 0-10 number is the
        // running one, so that is what lands in the shared column. `mm`
        // supplies its own and takes precedence.
        ...(debrief.score !== null
          ? { overallScore: debrief.score }
          : finalScore?.value !== null && finalScore !== null
            ? { overallScore: finalScore.value }
            : {}),
        // The debrief only ever runs after Mr Muthu ended the meeting, so its
        // arrival IS the completion signal. `completePracticeRound` still runs
        // when the student leaves the page; this write is idempotent with it.
        ...(round.status !== "completed"
          ? { status: "completed" as const, completedAt: new Date() }
          : {}),
      },
    });
  }

  // Skip the checkpoint right after greeting, before any real exchange happened.
  // A debrief-only payload lands here too, and must still revalidate — the
  // results page is otherwise served the pre-debrief copy of the round.
  if (!transcript && !speak) {
    if (debrief) {
      const profile = { expire: 60 };
      revalidateTag(roundTag(roundId), profile);
      revalidateTag(userTag(round.userId), profile);
      if (round.companyId) revalidateTag(companyTag(round.companyId), profile);
      return NextResponse.json({ ok: true, debrief: true });
    }
    return NextResponse.json({ ok: true, note: "empty turn, logged only" });
  }

  const turnNumber = (await prisma.practiceTurn.count({ where: { practiceRoundId: roundId } })) + 1;

  const turn = await prisma.practiceTurn.create({
    data: {
      practiceRoundId: roundId,
      turnNumber,
      speaker: "student",
      transcript,
      speak,
      frame,
      actions: actions ?? undefined,
      runningScore,
      topics:
        Object.keys(topics).length > 0
          ? (topics as Prisma.InputJsonValue)
          : undefined,
    },
  });

  // Matches the `revalidate: 60` used by the cached reads in cachedQueries.ts.
  const profile = { expire: 60 };
  revalidateTag(roundTag(roundId), profile);
  revalidateTag(userTag(round.userId), profile);
  if (round.companyId) revalidateTag(companyTag(round.companyId), profile);

  return NextResponse.json({ ok: true, turnId: turn.id });
}
