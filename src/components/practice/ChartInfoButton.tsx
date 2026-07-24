"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, X } from "lucide-react";

export type InfoStep = { title: string; description: string };

/**
 * Small "how to read this chart" button — opens an animated modal that
 * reveals its steps one at a time, rather than dumping a wall of text.
 */
export default function ChartInfoButton({
  chartTitle,
  steps,
}: {
  chartTitle: string;
  steps: InfoStep[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`How to read: ${chartTitle}`}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-faint transition hover:border-brand hover:text-brand"
      >
        <Info className="h-3 w-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="card w-full max-w-sm p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-ink">{chartTitle}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-faint transition hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {steps.map((s, i) => (
                  <motion.div
                    key={s.title}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.1 }}
                  >
                    <div className="text-sm font-medium text-ink">
                      {s.title}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {s.description}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
