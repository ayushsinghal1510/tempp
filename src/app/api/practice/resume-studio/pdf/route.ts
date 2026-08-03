import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ensurePdf, getResumeStudio } from "@/lib/practice/resumeStudio";

export const runtime = "nodejs";

/**
 * The compiled PDF — the same bytes serve the preview pane and the download
 * button, because they must be the same document. A preview rendered from one
 * pipeline and a download built from another is how a student ends up sending
 * an employer a file that doesn't match what they approved on screen.
 *
 *   ?company=<id>   a tailored variant (omit for the base resume)
 *   ?download=1     attachment rather than inline
 *
 * Scoped by userId with no exceptions: a resume is the most personal document
 * in this product, and an id-only lookup here would let any signed-in student
 * read any other's by guessing.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company");
  const download = url.searchParams.get("download") === "1";

  const studio = await getResumeStudio(user.id, companyId);
  if (!studio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await ensurePdf(studio);
  if (!pdf) {
    // 409 rather than 500: nothing is broken server-side, the stored LaTeX just
    // doesn't build. The studio catches this and tells the student to ask for a
    // fix in the chat, which is a thing they can actually act on.
    return NextResponse.json(
      { error: "This resume doesn't compile yet — ask in the chat to fix it." },
      { status: 409 },
    );
  }

  const label = companyId
    ? await prisma.practiceCompany
        .findUnique({ where: { id: companyId }, select: { companyName: true } })
        .then((c) => c?.companyName ?? "Tailored")
    : "Resume";

  const filename = `${slug(user.name)}-${slug(label)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      // The document changes every time the agent rewrites it, and a cached
      // preview showing the previous draft is indistinguishable from the agent
      // having ignored the request.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}

/** ASCII-safe filename part — Content-Disposition is not a unicode-safe header. */
function slug(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "resume"
  );
}
