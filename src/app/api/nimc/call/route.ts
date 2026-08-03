import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { counsellorOrgId } from "@/lib/nimc/access";
import { normalisePhone } from "@/lib/nimc/phone";
import { buildNimcCustoms, NIMC_WEBHOOK_URL } from "@/lib/voice/nimcCustoms";

// Places the outbound call.
//
// This runs on the server and not in the browser, unlike every other voice
// entry point in this app. That is not incidental: the WebRTC flow can expose
// NEXT_PUBLIC_FLOW_API_KEY because the SDP offer has to originate in the
// browser anyway, but a telephony key can place calls that cost money to
// arbitrary numbers. It stays here.

export const runtime = "nodejs";

// The telephony endpoint, from .env. This is a DIFFERENT host from the one the
// interview room talks to: NEXT_PUBLIC_VX_SERVER (voice.voxio.in) terminates
// WebRTC from a browser, this one places PSTN calls. Neither is derivable from
// the other, so both are configured independently.
//
// Accepts either a bare host ("call.voxio.in") or a full URL, and appends the
// path only when one wasn't given — so pointing this at a local vx server
// during debugging is a one-line .env change, same as VX_SERVER in customs.ts.
const DIAL_PATH = "/plivo/outbound";
const RAW_DIAL = process.env.NIMC_DIAL_URL || "call.voxio.in";
const DIAL_BASE = (
  /^https?:\/\//.test(RAW_DIAL) ? RAW_DIAL : `https://${RAW_DIAL}`
).replace(/\/+$/, "");
const DIAL_URL = new URL(DIAL_BASE).pathname === "/"
  ? `${DIAL_BASE}${DIAL_PATH}`
  : DIAL_BASE;

const BodySchema = z.object({
  phone: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const orgId = await counsellorOrgId(user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Not a counsellor" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "That doesn't look like an Indian mobile number." },
      { status: 400 },
    );
  }

  const fromNumber = process.env.NIMC_FROM_NUMBER;
  // NIMC_FLOW_API_KEY, deliberately, and NOT the FLOW_API_KEY the interview
  // room uses. That one is a PER-AGENT key: the backend resolves it to a
  // workflow already registered against it and ignores the `customs` in the
  // request body entirely. Sending it here would place a real call that then
  // ran a different agent — a failure that looks like success right up until
  // someone reads the transcript. This is the generic telephony key, which
  // honours the graph we send.
  //
  // USER_API_KEY is genuinely shared, so it is read from the common variable.
  const userApiKey = process.env.USER_API_KEY;
  const flowApiKey = process.env.NIMC_FLOW_API_KEY;
  if (!fromNumber || !userApiKey || !flowApiKey) {
    console.error(
      "[nimc call] missing NIMC_FROM_NUMBER / USER_API_KEY / NIMC_FLOW_API_KEY — refusing to dial",
    );
    return NextResponse.json(
      { error: "Calling isn't configured on this server." },
      { status: 500 },
    );
  }
  // The webhook URL is baked into the customs we're about to send. If it came
  // out relative, the call would connect and then silently produce no
  // transcript at all — much better to fail here, loudly.
  if (!/^https?:\/\//.test(NIMC_WEBHOOK_URL)) {
    console.error(`[nimc call] unusable webhook URL: ${NIMC_WEBHOOK_URL}`);
    return NextResponse.json(
      { error: "Calling isn't configured on this server." },
      { status: 500 },
    );
  }

  // Silent upsert. The counsellor never sees this — they typed a number and
  // pressed call — but it is what makes repeat calls to the same person group
  // together, with no backfill needed the day we want a callback queue.
  const lead = await prisma.lead.upsert({
    where: { orgId_phone: { orgId, phone } },
    create: { orgId, phone, attemptCount: 1, lastCallAt: new Date() },
    update: { attemptCount: { increment: 1 }, lastCallAt: new Date() },
  });

  // Created BEFORE dialling, because its id is the session_id we hand to
  // voxio. That way the webhook can correlate immediately and we never race
  // the first turn against the dial response.
  const call = await prisma.leadCall.create({
    data: { leadId: lead.id, counsellorId: user.id, phone },
  });

  const payload = {
    "from-number": fromNumber,
    "to-number": phone,
    session_id: call.id,
    customs: buildNimcCustoms({ brand: process.env.NIMC_BRAND }),
  };

  let upstream: Response;
  try {
    upstream = await fetch(DIAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_api_key: userApiKey,
        flow_api_key: flowApiKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[nimc call] dial request failed", err);
    // The row stays, with no turns and no outcome. That is the honest record:
    // we tried this number at this time and nothing came of it.
    return NextResponse.json(
      { error: "Couldn't reach the calling service." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[nimc call] dial rejected ${upstream.status}: ${detail}`);
    return NextResponse.json(
      { error: "The calling service rejected that call." },
      { status: 502 },
    );
  }

  return NextResponse.json({ callId: call.id });
}
