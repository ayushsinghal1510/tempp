"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(redirectTo);
        router.refresh();
      }}
      disabled={loading}
      className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink hover:border-line-strong disabled:opacity-60"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
