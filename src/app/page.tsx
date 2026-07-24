import { redirect } from "next/navigation";
import { currentUser, homePathForRole } from "@/lib/auth/session";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? homePathForRole(user.role) : "/login");
}
