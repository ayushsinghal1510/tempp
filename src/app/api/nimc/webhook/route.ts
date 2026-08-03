import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NIMC_FIELD_KEYS, type NimcFieldKey } from "@/lib/voice/nimcCustoms";

// Voxio pings this URL whenever the call graph reaches its `ask_for_input`
// stopping node — once per conversational turn. Same runtime and broadly the
// same envelope as /api/practice/webhook, but this route is deliberately
// separate rather than a branch inside that one, for two reasons:
//
//   1. The practice parser only keeps values where `typeof value === "object"`,
//      because its rubric topics are dicts. Every field we extract here is a
//      STRING, so that guard would silently drop all of them.
//   2. The call graph's llm nodes are `llm-streaming`, so the payload also
//      carries partial items shaped { node, streaming: true, chunk: "..." }
//      that the practice parser has never seen. We ignore them — the complete
//      values arrive on the `response` node's non-streaming `out`.
//
// `session_id` IS our LeadCall.id: the row is written before the phone rings,
// so correlation needs no lookup. It has been observed both at the top level
// and repeated on each `responses[i]`, so both are checked.

type ResponseItem = {
  session_id?: string;
  node?: string;
  streaming?: boolean;
  chunk?: string;
  out?: Record<string, unknown>;
};

function getResponses(body: Record<string, unknown>): ResponseItem[] {
  return Array.isArray(body.responses) ? (body.responses as ResponseItem[]) : [];
}

function extractCallId(body: Record<string, unknown>): string | null {
  if (typeof body.session_id === "string" && body.session_id) {
    return body.session_id;
  }
  for (const r of getResponses(body)) {
    if (typeof r.session_id === "string" && r.session_id) return r.session_id;
  }
  return null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type ExtractedTurn = {
  /** What the student said this turn. */
  transcript: string;
  /** What the agent said back. */
  speak: string;
  /** The flat profile fields, empty values already dropped. */
  fields: Partial<Record<NimcFieldKey, string>>;
  hangup: boolean;
};

function extractTurn(body: Record<string, unknown>): ExtractedTurn {
  let transcript = "";
  let speak = "";
  let hangup = false;
  const fields: Partial<Record<NimcFieldKey, string>> = {};

  for (const r of getResponses(body)) {
    // Streaming fragments — the same text arrives whole on the response node.
    if (r.streaming) continue;
    const out = r.out;
    if (!out) continue;

    if (typeof out.user_input === "string") transcript = str(out.user_input);

    // The filler node speaks too ("Theek hai"), but its output is latency
    // cover, not conversation. Only the main node's line is transcript.
    if (r.node !== "prev_llm" && typeof out.speak === "string") {
      speak = str(out.speak);
    }

    if (out.hangup === true) hangup = true;

    for (const key of NIMC_FIELD_KEYS) {
      const value = str(out[key]);
      // Empty is the agent saying "not known yet" — it must not land as a
      // value, or it would blank a field we already learned.
      if (value) fields[key] = value;
    }
  }

  return { transcript, speak, fields, hangup };
}

/**
 * Merge this turn's fields onto the lead.
 *
 * Rule: a non-empty value overwrites, an empty one never does, last non-empty
 * wins. Deliberately dumb — the agent is instructed to keep re-sending what it
 * knows, so the common case is writing the same value back. If a student
 * corrects themselves ("actually it's MBA not M.Tech") the later value should
 * win, and it does.
 */
function leadUpdateFrom(
  fields: Partial<Record<NimcFieldKey, string>>,
  courseLevel: string | null,
): Prisma.LeadUpdateInput {
  const update: Prisma.LeadUpdateInput = {};
  if (fields.name) update.name = fields.name;
  if (fields.course) update.courseInterest = fields.course;
  if (fields.residence) update.residence = fields.residence.toLowerCase();
  if (fields.academic_percent) {
    update.academics = {
      percent: fields.academic_percent,
      // Which exam the percentage refers to is a function of the course, and
      // the agent is not asked to say it — inferring it here keeps the stored
      // number interpretable without another extraction field.
      level: courseLevel,
    };
  }
  return update;
}

/** Which past percentage the prompt would have asked for, given the course. */
function courseLevelFor(course: string | null): string | null {
  if (!course) return null;
  const c = course.toLowerCase();
  if (c.includes("phd") || c.includes("ph.d")) return "masters";
  if (/\bm\.?(tech|ba|sc|com|ca|a)\b/.test(c) || c.startsWith("master")) {
    return "graduation";
  }
  return "12th";
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object") {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON, or empty — still logged below verbatim.
  }

  // Log EVERY call, unconditionally, before anything else. Same discipline as
  // the practice webhook: nothing is lost if this shape shifts.
  await prisma.webhookEvent.create({
    data: {
      source: "voxio_nimc",
      rawBody,
      parsed: (body as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  if (!body) {
    return NextResponse.json({ ok: true, note: "non-JSON body, logged only" });
  }

  const callId = extractCallId(body);
  if (!callId) {
    console.warn("[nimc webhook] no session_id in payload — logged only");
    return NextResponse.json({ ok: true, note: "no session_id, logged only" });
  }

  const call = await prisma.leadCall.findUnique({
    where: { id: callId },
    select: { id: true, leadId: true, lead: { select: { courseInterest: true } } },
  });
  if (!call) {
    console.warn(`[nimc webhook] unknown call ${callId} — logged only`);
    return NextResponse.json({ ok: true, note: "unknown call, logged only" });
  }

  const { transcript, speak, fields, hangup } = extractTurn(body);

  // The checkpoint that fires before anything has actually been said.
  if (!transcript && !speak) {
    return NextResponse.json({ ok: true, note: "empty turn, logged only" });
  }

  // One webhook can carry both sides of an exchange. They are written as two
  // rows, lead first, so the transcript reads in the order it was spoken.
  const existing = await prisma.leadTurn.count({ where: { callId } });
  const rows: Prisma.LeadTurnCreateManyInput[] = [];
  let turnNumber = existing;

  if (transcript) {
    rows.push({
      callId,
      turnNumber: ++turnNumber,
      speaker: "lead",
      transcript,
      // The extraction describes what the student just said, so it is recorded
      // against their turn rather than the agent's reply.
      fields:
        Object.keys(fields).length > 0
          ? (fields as Prisma.InputJsonValue)
          : undefined,
    });
  }
  if (speak) {
    rows.push({
      callId,
      turnNumber: ++turnNumber,
      speaker: "agent",
      transcript: speak,
    });
  }

  await prisma.leadTurn.createMany({ data: rows });

  const courseLevel = courseLevelFor(
    fields.course ?? call.lead.courseInterest ?? null,
  );
  const update = leadUpdateFrom(fields, courseLevel);
  if (Object.keys(update).length > 0) {
    await prisma.lead.update({ where: { id: call.leadId }, data: update });
  }

  // The graph's own hangup flag is the one signal we get that the call is
  // over. It is not authoritative — a student who just hangs up produces no
  // final webhook at all — so endedAt stays null in that case and the call
  // history falls back to "no turns for a while".
  if (hangup) {
    await prisma.leadCall.update({
      where: { id: callId },
      data: { endedAt: new Date(), outcome: "connected" },
    });
  } else if (transcript) {
    // Keyed on the student having actually spoken, not on the greeting having
    // been played — the greeting goes out on voicemail too.
    await prisma.leadCall.updateMany({
      where: { id: callId, outcome: null },
      data: { outcome: "connected" },
    });
  }

  return NextResponse.json({ ok: true, turns: rows.length });
}
