import { NextResponse } from "next/server";

// Temporarily disabled — practice-only mode.
export async function GET() {
  return NextResponse.json({ error: "disabled" }, { status: 404 });
}

// ---- practice-only mode: original implementation commented out below ----
// import { NextResponse } from "next/server";
// import { currentUser } from "@/lib/auth/session";
//
// export async function GET() {
//   const user = await currentUser();
//   return NextResponse.json({ user });
// }
//
