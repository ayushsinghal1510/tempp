import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getAccessibleCompany } from "@/lib/practice/access";
import { copyResumePdf, getResumeStudio } from "@/lib/practice/resumeStudio";

export const runtime = "nodejs";

/**
 * Fork the base resume into a variant tailored for one company.
 *
 * A copy, not a reference. The student keeps editing both afterwards and the
 * whole point of a tailored resume is that it diverges — a variant that tracked
 * the base would undo its own tailoring the next time they edited the original.
 *
 * The fork deliberately carries `resumeTex` and `sourceText` but NOT `messages`:
 * the new conversation should open on "here's your Acme version, what should I
 * emphasise?", not on twenty turns of history about a different document.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId : null;
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const [company, base, existing] = await Promise.all([
    getAccessibleCompany(user.id, companyId),
    getResumeStudio(user.id, null),
    getResumeStudio(user.id, companyId),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing) {
    // Already forked — send them to it rather than replacing it. Re-tailoring
    // over the top would silently discard whatever they'd already refined.
    return NextResponse.json({ ok: true, id: existing.id, existed: true });
  }
  if (!base) {
    return NextResponse.json(
      { error: "Build your base resume first." },
      { status: 409 },
    );
  }

  const variant = await prisma.practiceResumeStudio.create({
    data: {
      userId: user.id,
      companyId,
      resumeTex: base.resumeTex,
      sourceText: base.sourceText,
      messages: [],
    },
  });

  // The cached PDF is copied so the variant renders immediately instead of
  // paying a compile on first paint — it is a byte-identical document until the
  // agent rewrites it, so the cache is valid. Server-side CopyObject: the bytes
  // never travel here and back. Needs the variant's id, so it can only happen
  // after the create above.
  //
  // Best-effort by design. A failed copy costs one 3.7s compile the first time
  // the student opens the variant; failing the fork over it would cost them the
  // variant itself.
  if (base.pdfKey) {
    await copyResumePdf(base.pdfKey, variant.id).catch((err) => {
      console.error("[resume-studio] variant PDF copy failed:", err);
    });
  }

  return NextResponse.json({ ok: true, id: variant.id, existed: false });
}
