"use client";

import { useEffect, useRef, useState } from "react";
import { navLinks } from "@/lib/content";
import s from "./Nav.module.css";

/**
 * Sections that render on a dark ground tag themselves with
 * data-nav-dark; when one of them is under the bar, the bar flips
 * to light type so the nav is legible either way.
 */
export default function Nav() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const bar = barRef.current;
      if (!bar) return;

      // Probe just below the bar's own baseline.
      const probe = bar.getBoundingClientRect().bottom - 6;

      const onDark = Array.from(
        document.querySelectorAll<HTMLElement>("[data-nav-dark]"),
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= probe && r.bottom >= probe;
      });
      setDark(onDark);

      // Whichever linked section owns the top of the screen.
      const active = navLinks
        .map((l) => document.querySelector<HTMLElement>(l.href))
        .filter((el): el is HTMLElement => Boolean(el))
        .filter((el) => el.getBoundingClientRect().top <= window.innerHeight * 0.4)
        .pop();
      setCurrent(active ? `#${active.id}` : null);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={`${s.wrap} ${dark ? s.dark : ""}`}>
      <nav className={s.bar} aria-label="Main" ref={barRef}>
        <a href="#top" className={`${s.mark} ${s.glass}`}>
          <span className={s.brandText}>Voxio<span className={s.brandDot}>.</span>Prep</span>
        </a>

        <div className={`${s.group} ${s.glass} ${s.links}`}>
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={s.pill}
              aria-current={current === l.href ? "true" : undefined}
            >
              {l.label}
            </a>
          ))}
        </div>

        <a href="/practice/login" className={`${s.login} ${s.glass} ${s.actions}`}>
          Login
        </a>

        <button
          type="button"
          className={`${s.toggle} ${s.glass} ${open ? s.toggleOpen : ""}`}
          aria-expanded={open}
          aria-controls="nav-panel"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {open && (
        <div className={s.panel} id="nav-panel">
          <div className={s.panelLinks}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </div>
          <div className={s.panelActions}>
            <a
              href="/practice/login"
              className={`btn btn-solid ${s.btnFull}`}
              onClick={() => setOpen(false)}
            >
              Login
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
