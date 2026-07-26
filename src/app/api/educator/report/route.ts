import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { tenantConfig } from "@/lib/tenants/config";
import { buildReport, reportToCsv } from "@/lib/practice/reportData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV export of the cohort report.
 *
 * currentUser() rather than requireUser() — a browser following requireUser's
 * redirect would download the login page as a .csv, which looks like a corrupt
 * export rather than an expired session.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "practice_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await requireEducatorOrgId(user.id);
  const { topics } = tenantConfig(user.tenant);

  const params = new URL(req.url).searchParams;
  // Both filters are narrowing-only: buildReport scopes every query by orgId
  // first, so an id belonging to another org matches nothing rather than
  // leaking it.
  const { rows } = await buildReport(orgId, topics, {
    companyId: params.get("companyId") ?? undefined,
    groupId: params.get("groupId") ?? undefined,
  });

  const csv = reportToCsv(rows, topics);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      // charset matters: names on both tracks contain non-ASCII, and Excel
      // mangles them without it.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="practice-report-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
