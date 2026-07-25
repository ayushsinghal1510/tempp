import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";
import type { Role } from "@prisma/client";

const ROLE_HOME: Record<Role, string> = {
  super_admin: "/super",
  admin: "/admin",
  student: "/student",
  // Not covered by this middleware's matcher (see below) — practice pages
  // guard themselves via requireUser. Listed only so this stays exhaustive.
  practice: "/practice",
  practice_admin: "/educator",
};

// Each role may only enter its own section.
const SECTION_PREFIXES: Record<Role, string> = ROLE_HOME;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  // The educator section has its own sign-in page (the shared /login is
  // disabled in practice-only mode), so it must stay reachable logged-out.
  const isEducatorLogin = pathname === "/educator/login";

  const isProtected =
    !isEducatorLogin &&
    (pathname.startsWith("/super") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/student") ||
      pathname.startsWith("/educator"));

  if (isProtected) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.startsWith("/educator")
        ? "/educator/login"
        : "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Wrong-role access → bounce to their own home.
    if (!pathname.startsWith(SECTION_PREFIXES[user.role])) {
      const url = req.nextUrl.clone();
      url.pathname = ROLE_HOME[user.role];
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Already logged in → skip the login page.
  if ((pathname === "/login" || isEducatorLogin) && user) {
    const url = req.nextUrl.clone();
    url.pathname = ROLE_HOME[user.role];
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/super/:path*",
    "/admin/:path*",
    "/student/:path*",
    "/educator/:path*",
    "/login",
  ],
};
