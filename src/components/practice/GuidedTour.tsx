"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const STORAGE_KEY = "practice_tour_seen";
const OPEN_EVENT = "practice:open-tour";

const STEPS = [
  {
    title: "Companies, once",
    description:
      "Register a company once — its research and prep material get reused across every session you run against it.",
  },
  {
    title: "Sessions",
    description:
      "Each practice attempt is a session. Run as many as you like under the same company to track your progress over time.",
  },
  {
    title: "Your scores",
    description:
      "Every session scores you 0–10 across 6 areas: Posture, Framing, Approach, Numbers, Confidence, Example. Look for the Strong / Good / Improving / Needs work labels for the quick read.",
  },
  {
    title: "Chart help, anytime",
    description:
      "Every chart has a small (i) button — click it whenever you want a quick explainer on how to read it.",
  },
];

/** Dispatch this to manually reopen the tour (see TourTrigger). */
export function openGuidedTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }
}

export default function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
    function onOpen() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function close() {
    setOpen(false);
    window.localStorage.setItem(STORAGE_KEY, "1");
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-sm p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-ink">{STEPS[step].title}</h3>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-faint transition hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">{STEPS[step].description}</p>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <span
                    key={s.title}
                    className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-brand" : "bg-line"}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {!isLast && (
                  <button
                    type="button"
                    onClick={close}
                    className="text-sm text-muted hover:text-ink"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (isLast ? close() : setStep((s) => s + 1))}
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
                >
                  {isLast ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
