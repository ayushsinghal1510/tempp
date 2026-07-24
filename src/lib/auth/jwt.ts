import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

// Edge-safe session primitives (no next/headers, no node crypto) so this module
// can be imported from both middleware (edge runtime) and route handlers.

export const SESSION_COOKIE = "prepai_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  role: Role;
  universityId: string | null;
  name: string;
  email: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    role: user.role,
    universityId: user.universityId,
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      role: payload.role as Role,
      universityId: (payload.universityId as string | null) ?? null,
      name: payload.name as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
