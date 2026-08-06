"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { scenarios } from "@/lib/content";
import ScenarioCard from "./ScenarioCard";
import s from "./ScenarioCarousel.module.css";

/** Pixels per second of the resting drift. */
const DRIFT = 26;
const GAP = 16;

const useIsomorphicLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function ScenarioCarousel({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (index: number) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(1);
  const paused = useRef(false);
  const dragging = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  // The list is rendered twice and the scroll position is kept in the
  // middle band. Both edges stay far away, so the browser never clamps
  // scrollLeft to 0 and the loop runs in either direction from the
  // very first frame.
  const loop = [...scenarios, ...scenarios];

  const half = () => (track.current ? track.current.scrollWidth / 2 : 0);

  /** Fold any position back into the middle band. */
  const normalise = useCallback((value: number) => {
    const h = half();
    if (h <= 0) return value;
    let v = value;
    while (v < h * 0.5) v += h;
    while (v >= h * 1.5) v -= h;
    return v;
  }, []);

  const recentre = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const next = normalise(el.scrollLeft);
    if (next !== el.scrollLeft) el.scrollLeft = next;
  }, [normalise]);

  // Start in the middle rather than at the left edge.
  useIsomorphicLayout(() => {
    const el = viewport.current;
    if (!el) return;
    el.scrollLeft = half();
    const onResize = () => recentre();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recentre]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      if (!paused.current && !dragging.current) {
        el.scrollLeft = normalise(el.scrollLeft + DRIFT * direction * dt);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [direction, normalise]);

  // Pointer drag, normalised the same way so it also wraps both ways.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;

    let startX = 0;
    let startLeft = 0;
    let down = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      down = true;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) <= 6) return;
      if (!dragging.current) {
        dragging.current = true;
        setGrabbing(true);
      }
      const next = normalise(startLeft - dx);
      // Re-anchor so the pointer keeps tracking after a fold.
      startLeft = next + dx;
      el.scrollLeft = next;
    };
    const onUp = () => {
      down = false;
      // Let the click land before the card's onClick reads the flag.
      requestAnimationFrame(() => {
        dragging.current = false;
        setGrabbing(false);
      });
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [normalise]);

  /** Move by whole cards, which works the same inside the loop. */
  const shift = (cards: number) => {
    const el = viewport.current;
    const inner = track.current;
    if (!el || !inner || cards === 0) return;
    const card = inner.firstElementChild as HTMLElement | null;
    const by = (card ? card.offsetWidth : 320) + GAP;
    el.scrollBy({ left: by * cards, behavior: "smooth" });
  };

  const goTo = (index: number) => {
    shift(index - active);
    onSelect(index);
  };

  const step = (dir: -1 | 1) => {
    const el = viewport.current;
    const inner = track.current;
    if (!el || !inner) return;
    const card = inner.firstElementChild as HTMLElement | null;
    const by = (card ? card.offsetWidth : 320) + GAP;
    setDirection(dir);
    el.scrollBy({ left: by * dir, behavior: "smooth" });
  };

  return (
    <div
      className={s.wrap}
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <div className={s.stage}>
        <div className={`${s.fade} ${s.fadeLeft}`} />
        <div className={`${s.fade} ${s.fadeRight}`} />

        <div
          className={`${s.viewport} ${grabbing ? s.dragging : ""}`}
          ref={viewport}
          onScroll={recentre}
        >
          <div className={s.track} ref={track}>
            {loop.map((sc, i) => (
              <div className={s.slide} key={`${sc.id}-${i}`}>
                <ScenarioCard
                  scenario={sc}
                  selected={active === i % scenarios.length}
                  onSelect={() => {
                    if (!dragging.current) onSelect(i % scenarios.length);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={s.controls}>
        <button
          type="button"
          className={s.arrow}
          onClick={() => step(-1)}
          aria-label="Previous scenario"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5 L8 12 L15 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={s.arrow}
          onClick={() => step(1)}
          aria-label="Next scenario"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 5 L16 12 L9 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className={s.dots}>
          {scenarios.map((sc, i) => (
            <button
              key={sc.id}
              type="button"
              className={s.dot}
              data-on={active === i}
              onClick={() => goTo(i)}
              aria-label={sc.title}
            />
          ))}
        </div>

        <p className={s.hint}>Drag either way</p>
      </div>
    </div>
  );
}
