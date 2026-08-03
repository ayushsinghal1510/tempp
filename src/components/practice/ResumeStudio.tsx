"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** The tool's structured result, once it has one. */
function toolOutcome(message: UIMessage): { ok: boolean } | null {
  for (const p of message.parts) {
    if (p.type !== "tool-writeResume") continue;
    if (!("state" in p) || p.state !== "output-available") continue;
    const out = (p as { output?: unknown }).output;
    if (out && typeof out === "object" && "ok" in out) {
      return { ok: Boolean((out as { ok: unknown }).ok) };
    }
  }
  return null;
}

/**
 * Did this message actually rewrite the resume?
 *
 * Keyed off the tool RESULT, not merely the tool call. Two separate lies to
 * defend against: the model's prose ("I've tightened your bullets") when it
 * never called the tool at all, and a tool call whose LaTeX failed to compile —
 * which still leaves the previous PDF on screen. Badging either of those as
 * "Resume updated" tells the student the document changed when it did not.
 */
function wroteResume(message: UIMessage): boolean {
  return toolOutcome(message)?.ok === true;
}

/** A rewrite was attempted and the LaTeX would not build. */
function failedToCompile(message: UIMessage): boolean {
  return toolOutcome(message)?.ok === false;
}

/** A tool call still streaming its LaTeX in — the long pause the student sees. */
function isWriting(message: UIMessage): boolean {
  return message.parts.some(
    (p) =>
      p.type === "tool-writeResume" &&
      "state" in p &&
      (p.state === "input-streaming" || p.state === "input-available"),
  );
}

export default function ResumeStudio({
  companyId,
  companyName,
  initialMessages,
  /** False when the stored LaTeX doesn't currently compile. */
  initiallyRenderable,
}: {
  companyId: string | null;
  companyName: string | null;
  initialMessages: UIMessage[];
  initiallyRenderable: boolean;
}) {
  const [input, setInput] = useState("");

  // Cache-buster for the preview <iframe>. The PDF lives at a fixed URL, so
  // without a changing query the browser keeps showing the previous render even
  // though the route sends no-store — an iframe that is never re-navigated is
  // never re-fetched at all.
  const [version, setVersion] = useState(0);
  const [renderable, setRenderable] = useState(initiallyRenderable);

  const query = useMemo(
    () => (companyId ? `?company=${encodeURIComponent(companyId)}` : ""),
    [companyId],
  );

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/practice/resume-studio/chat${query}`,
    }),
    onFinish: ({ message }) => {
      if (failedToCompile(message)) {
        // The stored LaTeX no longer builds, so the PDF route will 409. Swap to
        // the repair message rather than leaving the previous render up, which
        // would show a document that no longer matches what is saved.
        setRenderable(false);
        return;
      }
      if (!wroteResume(message)) return;
      // The tool already compiled and stored the PDF, so by the time this fires
      // the bytes are on the row — reload the pane and assume it renders. If it
      // doesn't, the iframe's onError below corrects that.
      setRenderable(true);
      setVersion((v) => v + 1);
    },
  });

  // ── Open by doing the work, not by waiting to be asked ──────────────
  //
  // An empty transcript means one of exactly two things just happened: the
  // student finished the upload screen, or they forked a tailored variant.
  // In both cases what they want next is the only thing this page does, and
  // making them type "write my first draft" to get it is a step that exists
  // only because the chat box is there.
  //
  // Keyed off initialMessages (the server's state at load) rather than
  // `messages`, which starts filling the instant this fires and would make the
  // condition self-clearing mid-effect.
  const kickedOff = useRef(false);

  useEffect(() => {
    if (kickedOff.current || initialMessages.length > 0) return;
    // A ref, not state: it must survive React's double-invoked effects in
    // development without firing two generations at the same empty studio.
    kickedOff.current = true;

    sendMessage({
      text: companyName
        ? `Tailor my resume for ${companyName} using the job description.`
        : "Write my first draft from what I gave you.",
    });
  }, [initialMessages.length, companyName, sendMessage]);

  const busy = status === "submitted" || status === "streaming";
  const writing = busy && messages.some(isWriting);

  // The #fragment strips the browser PDF viewer's own toolbar and thumbnail
  // rail, which otherwise occupy well over half this pane and put a second,
  // competing "download" button next to ours. `view=FitH` makes the page fill
  // the width it has left. Hints, not guarantees — a viewer that ignores them
  // still renders the document, just with its own chrome.
  const pdfSrc = `/api/practice/resume-studio/pdf${query}${query ? "&" : "?"}v=${version}#toolbar=0&navpanes=0&view=FitH`;
  const downloadHref = `/api/practice/resume-studio/pdf${query}${query ? "&" : "?"}download=1&v=${version}`;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || busy) return;
      sendMessage({ text });
      setInput("");
    },
    [input, busy, sendMessage],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── Conversation ─────────────────────────────────────────────── */}
      <div className="flex h-[75vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-1">
          {/* Only reachable in the sliver before the kickoff effect runs, or if
              it failed. Phrased as a prompt to act rather than as instructions
              to type the first draft — that request now sends itself. */}
          {messages.length === 0 && (
            <div className="card p-6 text-sm text-muted">
              <p className="font-semibold text-ink">
                Getting started{companyName ? ` on your ${companyName} version` : ""}…
              </p>
              <p className="mt-2">
                If nothing happens, ask me for a first draft and I&apos;ll
                write one.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const text = textOf(m);
            const changed = wroteResume(m);
            const failed = failedToCompile(m);

            // A turn that only called the tool and said nothing has no bubble
            // to render — show the badge alone rather than an empty card.
            if (!text && !changed && !failed) return null;

            return (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-brand px-4 py-2.5 text-sm text-primary-foreground"
                      : "card max-w-[85%] px-4 py-3 text-sm text-ink"
                  }
                >
                  {m.role === "user" ? (
                    text
                  ) : (
                    <>
                      {changed && (
                        <span className="mb-2 inline-block rounded-md bg-[var(--chart-1)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--chart-1)]">
                          Resume updated
                        </span>
                      )}
                      {failed && !changed && (
                        <span className="mb-2 inline-block rounded-md bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                          Couldn&apos;t render — ask me to fix it
                        </span>
                      )}
                      {text && (
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:text-ink prose-li:text-ink prose-strong:text-ink">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {text}
                          </ReactMarkdown>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex justify-start">
              <div className="card px-4 py-3 text-sm text-muted">
                {/* Writing a resume is a 10-20s operation and "Thinking…" for
                    that long reads as a hang. Naming the slow step is the
                    difference between waiting and refreshing. */}
                {writing ? "Writing your resume…" : "Thinking…"}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for a change — &ldquo;add my hackathon project&rdquo;"
            className="flex-1 rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>

      {/* ── Rendered PDF ─────────────────────────────────────────────── */}
      <div className="flex h-[75vh] flex-col">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">
            {companyName ? `Tailored for ${companyName}` : "Your resume"}
          </span>
          <a
            href={downloadHref}
            download
            aria-disabled={!renderable}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              renderable
                ? "bg-[var(--chart-1)] text-white shadow-sm hover:brightness-110"
                : "pointer-events-none bg-faint/20 text-faint"
            }`}
          >
            Download PDF
          </a>
        </div>

        <div className="card flex-1 overflow-hidden p-0">
          {renderable ? (
            <iframe
              // Remounting on `version` rather than only changing src: some
              // browsers keep the embedded PDF viewer's own cached document
              // across a same-origin src change, which shows the student their
              // previous draft after a successful edit.
              key={version}
              src={pdfSrc}
              title="Resume preview"
              className="h-full w-full border-0"
              onError={() => setRenderable(false)}
            />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <p className="text-sm font-semibold text-ink">
                  This draft doesn&apos;t compile yet
                </p>
                <p className="mt-1 text-sm text-muted">
                  Ask in the chat to fix it — say &ldquo;the resume
                  won&apos;t render, please fix the LaTeX&rdquo; and it will
                  repair the document.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
