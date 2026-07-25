import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySessionToken,
  type SessionUser,
} from "./jwt";
import type { Role } from "@prisma/client";

// Cookie-backed session helpers for use in Server Components and route handlers
// (node runtime). Middleware uses jwt.ts directly instead.

export type { SessionUser };

/**
 * When the app is served over HTTPS — including inside a cross-site iframe like
 * the litng cloudspaces / Codespaces preview — a `SameSite=Lax` cookie is
 * treated as third-party and never sent back, so the session silently fails.
 * Over HTTPS we therefore use `SameSite=None; Secure`; on plain localhost we
 * keep `Lax` (since `None` requires `Secure`, which http can't satisfy).
 */
async function cookieSecurity(): Promise<{
  sameSite: "none" | "lax";
  secure: boolean;
}> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const isHttps = proto === "https";
  return isHttps
    ? { sameSite: "none", secure: true }
    : { sameSite: "lax", secure: false };
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  const { sameSite, secure } = await cookieSecurity();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const { sameSite, secure } = await cookieSecurity();
  // Overwrite with an expired cookie using matching attributes so it clears
  // reliably in the cross-site iframe case too.
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: 0,
  });
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** For pages: redirect to /login if not authenticated (optionally role-gated). */
export async function requireUser(
  roles?: Role[],
  loginPath: string = "/login",
): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(loginPath);
  if (roles && !roles.includes(user.role)) redirect(homePathForRole(user.role));
  return user;
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "super_admin":
      return "/super";
    case "admin":
      return "/admin";
    case "student":
      return "/student";
    case "practice":
      return "/practice";
    case "practice_admin":
      return "/educator";
  }
}
