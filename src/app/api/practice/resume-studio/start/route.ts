import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getResumeStudio } from "@/lib/practice/resumeStudio";
import { starterBody } from "@/lib/resume/template";

export const runtime = "nodejs";

// Enough to start from; anything longer is a portfolio, not a resume, and
// would push the system prompt into territory where the model starts losing
// the instructions at the top of it.
const MAX_SOURCE_CHARS = 20_000;

/**
 * Create the student's BASE resume — the one with a null companyId.
 *
 * Two ways in, because the two students who need this are different people:
 * one has a resume already and wants it rebuilt properly (upload the PDF), the
 * other has never written one (type what they've done, or nothing at all and
 * answer questions in the chat).
 *
 * currentUser() rather than requireUser(), same as the resume-chat start route:
 * requireUser()'s redirect would be followed by fetch's default
 * redirect:"follow" and surface an auth failure as a 200.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotent, exactly like the resume-chat start route: a resubmitted form
  // must never wipe a resume the student has already spent twenty turns on.
  // The partial unique index would reject the second insert anyway; this turns
  // a 500 into the no-op the caller expects.
  const existing = await getResumeStudio(user.id, null);
  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const file = form.get("resume");
  const typed = String(form.get("about") ?? "").trim();

  let sourceText = "";

  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF resumes are supported" },
        { status: 400 },
      );
    }

    const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    try {
      const result = await parser.getText();
      sourceText = result.text.trim();
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that PDF — try a different file" },
        { status: 400 },
      );
    } finally {
      await parser.destroy();
    }

    if (!sourceText) {
      return NextResponse.json(
        { error: "No readable text found in that PDF" },
        { status: 400 },
      );
    }
  }

  if (typed) {
    sourceText = sourceText ? `${sourceText}\n\n---\n\n${typed}` : typed;
  }

  if (!sourceText) {
    // Starting from nothing is allowed — the agent interviews them for the
    // facts instead. Recorded explicitly so the prompt doesn't read an empty
    // source block as "the student has no experience" and write that down.
    sourceText =
      "(The student started from scratch and uploaded nothing. Ask them for " +
      "their education, experience, projects and skills, one question at a time.)";
  }

  const studio = await prisma.practiceResumeStudio.create({
    data: {
      userId: user.id,
      companyId: null,
      sourceText: sourceText.slice(0, MAX_SOURCE_CHARS),
      // A compilable placeholder rather than "": the studio renders a PDF
      // preview on first paint, and an empty pane reads as a broken page even
      // when it is only an empty one.
      resumeTex: starterBody(user.name, user.email),
      messages: [],
    },
  });

  return NextResponse.json({ ok: true, id: studio.id });
}
