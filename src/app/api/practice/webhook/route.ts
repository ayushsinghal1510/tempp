import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { userTag, companyTag, roundTag } from "@/lib/practice/cacheTags";

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

const TOPIC_KEYS = ["posture", "framing", "approach", "numbers", "confidence", "example"] as const;

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

function extractTurn(body: Record<string, unknown>): {
  transcript: string;
  speak: string | null;
  topics: Record<string, unknown>;
} {
  let transcript = "";
  let speak: string | null = null;
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
    for (const key of TOPIC_KEYS) {
      const value = out[key];
      if (value && typeof value === "object") topics[key] = value;
    }
  }

  return { transcript, speak, topics };
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

  const round = await prisma.practiceRound.findUnique({ where: { id: roundId } });
  if (!round) {
    console.warn(`[practice webhook] unknown round ${roundId} — logged only`);
    return NextResponse.json({ ok: true, note: "unknown round, logged only" });
  }

  const { transcript, speak, topics } = extractTurn(body);

  // Skip the checkpoint right after greeting, before any real exchange happened.
  if (!transcript && !speak) {
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
