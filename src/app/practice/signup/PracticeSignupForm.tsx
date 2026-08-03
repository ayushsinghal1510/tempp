"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEGREES, DEGREE_LABEL } from "@/lib/research/expectationMatrix";
import Select from "@/components/ui/Select";
import PasswordField from "@/components/ui/PasswordField";
import {
  TENANTS,
  tenantForEmail,
  acceptedDomains,
} from "@/lib/tenants/config";

export default function PracticeSignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [course, setCourse] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The account is created even when the class code fails, so this is a
  // warning on a SUCCEEDED signup, not an error — kept separate from `error`
  // so it can't read as "your account wasn't created".
  const [joinWarning, setJoinWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Which product this address belongs to, resolved as they type. Course/CGPA
  // key the (engineering-shaped) expectation matrix, so they only make sense
  // on a tenant that uses it — no point collecting a B.Tech from a medical
  // student. Null until the domain is recognised, which is also the signal
  // that the server is going to reject this address.
  const tenant = tenantForEmail(email);
  const showCourse = tenant ? TENANTS[tenant].features.courseField : false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/practice/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          course: showCourse && course ? course : undefined,
          cgpa: showCourse && cgpa ? Number(cgpa) : undefined,
          joinCode: joinCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      // A bad class code must not silently swallow itself: the signup already
      // succeeded, so surface it and let them go on rather than dumping them
      // on an empty dashboard wondering where their work is.
      if (data.joinError) {
        setJoinWarning(
          `Your account is ready, but that class code didn't work: ${data.joinError} You can enter it again from your dashboard.`,
        );
        return;
      }
      router.push(data.redirect ?? "/practice");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="Your name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder={`you${acceptedDomains()[0] ?? "@example.com"}`}
        />
        {email.includes("@") && !tenant && (
          <p className="mt-1 text-xs text-warning">
            Sign-ups are limited to {acceptedDomains().join(" and ")} addresses.
          </p>
        )}
      </div>
      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        placeholder="At least 8 characters"
      />
      {showCourse && (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="course">
            Course
          </label>
          <Select
            id="course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="mt-1 w-full"
          >
            <option value="">Select…</option>
            {DEGREES.map((d) => (
              <option key={d} value={d}>
                {DEGREE_LABEL[d]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="cgpa">
            CGPA
          </label>
          <input
            id="cgpa"
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={cgpa}
            onChange={(e) => setCgpa(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="e.g. 8.2"
          />
        </div>
      </div>
      )}
      {showCourse && (
        <p className="-mt-2 text-xs text-muted">
          Optional — used to personalize what your drive briefing focuses on.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium" htmlFor="joinCode">
          Class code
        </label>
        <input
          id="joinCode"
          type="text"
          autoCapitalize="characters"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm uppercase tracking-wider text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="From your educator"
        />
        <p className="mt-1 text-xs text-muted">
          {tenant && !TENANTS[tenant].features.company
            ? "Required to see anything — your educator sets your sessions."
            : "Optional — joins you to your educator's class."}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {joinWarning && (
        <div className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {joinWarning}
          <button
            type="button"
            onClick={() => {
              router.push("/practice");
              router.refresh();
            }}
            className="mt-1 block font-semibold underline"
          >
            Continue to your dashboard →
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-strong disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have one?{" "}
        <Link
          href="/practice/login"
          className="font-medium text-brand hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
