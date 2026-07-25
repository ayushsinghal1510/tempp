import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getAccessibleCompany, getResumeChatFor } from "@/lib/practice/access";

export const runtime = "nodejs";

// currentUser() rather than requireUser() — requireUser()'s redirect() would
// get silently followed by fetch's default redirect:"follow", masking an
// auth failure as a 200. Same reasoning as the recording upload route.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: companyId } = await params;

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await getAccessibleCompany(user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resumable-only: if this user already has a chat for this company, this is
  // a harmless no-op rather than an error — never overwrite an existing resume
  // or wipe message history just because the upload form got submitted again.
  const existing = await getResumeChatFor(user.id, companyId);
  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No resume file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF resumes are supported" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  let resumeText: string;
  try {
    const result = await parser.getText();
    resumeText = result.text.trim();
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that PDF — try a different file" },
      { status: 400 },
    );
  } finally {
    await parser.destroy();
  }

  if (!resumeText) {
    return NextResponse.json(
      { error: "No readable text found in that PDF" },
      { status: 400 },
    );
  }

  await prisma.practiceResumeChat.create({
    data: {
      userId: user.id,
      companyId,
      resumeText,
      messages: [],
    },
  });

  return NextResponse.json({ ok: true });
}
