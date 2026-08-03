"use client";

import { useEffect, useRef, useState } from "react";

export type Turn = {
  turnNumber: number;
  speaker: "agent" | "lead";
  transcript: string;
};

export type LeadProfile = {
  name: string | null;
  courseInterest: string | null;
  academics: { percent?: string; level?: string | null } | null;
  residence: string | null;
};

// Polls rather than streaming. The reference deployment uses SSE, and that is
// the better mechanism, but it needs a connection registry that survives
// wherever this happens to be deployed — whereas a 2s poll over an indexed
// range is a few rows and works everywhere. Worth revisiting if a desk ever
// runs many concurrent calls.
const POLL_MS = 2000;

const RESIDENCE_LABEL: Record<string, string> = {
  jaipur: "In Jaipur",
  outside: "Outside Jaipur",
};

export default function LiveCall({
  callId,
  initialTurns,
  initialLead,
  initiallyEnded,
}: {
  callId: string;
  initialTurns: Turn[];
  initialLead: LeadProfile;
  initiallyEnded: boolean;
}) {
  const [turns, setTurns] = useState(initialTurns);
  const [lead, setLead] = useState(initialLead);
  const [ended, setEnded] = useState(initiallyEnded);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A finished call never changes again, so it costs nothing to look at.
    if (ended) return;
    let cancelled = false;

    async function poll() {
      const after = turns.length ? turns[turns.length - 1].turnNumber : 0;
      try {
        const res = await fetch(
          `/api/nimc/calls/${callId}/turns?after=${after}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.turns?.length) {
          setTurns((prev) => [...prev, ...data.turns]);
        }
        // The profile is resent whole each poll — it is four short strings,
        // and merging it client-side would just duplicate the webhook's rule.
        if (data.lead) setLead(data.lead);
        if (data.ended) setEnded(true);
      } catch {
        // A dropped poll is not worth surfacing; the next one covers it.
      }
    }

    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [callId, turns, ended]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  const facts: Array<[string, string | null]> = [
    ["Name", lead.name],
    ["Course", lead.courseInterest],
    [
      "Percentage",
      lead.academics?.percent
        ? `${lead.academics.percent}%${lead.academics.level ? ` (${lead.academics.level})` : ""}`
        : null,
    ],
    [
      "Based",
      lead.residence ? (RESIDENCE_LABEL[lead.residence] ?? lead.residence) : null,
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <section className="card flex max-h-[70vh] flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span
            className={`h-2 w-2 rounded-full ${ended ? "bg-muted" : "animate-pulse bg-success"}`}
          />
          <h2 className="text-sm font-semibold text-ink">
            {ended ? "Transcript" : "Live transcript"}
          </h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <p className="text-sm text-muted">
              {ended
                ? "Nothing was said on this call."
                : "Waiting for the call to connect…"}
            </p>
          )}
          {turns.map((t) => (
            <div
              key={t.turnNumber}
              className={t.speaker === "agent" ? "" : "text-right"}
            >
              <p className="mb-0.5 text-xs text-muted">
                {t.speaker === "agent" ? "Sneha" : "Student"}
              </p>
              <p
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  t.speaker === "agent"
                    ? "bg-muted/10 text-ink"
                    : "bg-brand/10 text-ink"
                }`}
              >
                {t.transcript}
              </p>
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </section>

      <section className="card h-fit p-4">
        <h2 className="text-sm font-semibold text-ink">What we learned</h2>
        <dl className="mt-3 space-y-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              {/* An em dash rather than a blank, so the four things we're
                  trying to find out are visible before they're answered. */}
              <dd className={`text-sm ${value ? "text-ink" : "text-muted"}`}>
                {value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
