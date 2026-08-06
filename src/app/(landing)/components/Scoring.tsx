"use client";

import { useEffect, useRef, useState } from "react";
import { ledger, rules } from "@/lib/content";
import Reveal from "./Reveal";
import s from "./Scoring.module.css";

const CEILING = 9;

export default function Scoring() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="section shell-tight" id="scoring">
      <div className={`${s.panel} on-dark`} data-nav-dark>
        <Reveal>
          <p className="eyebrow">Why believe the score</p>

          <div className="sec-head">
            <h2 className="h2">
              Every point is attached to <em>a sentence you said</em>.
            </h2>
            <p className="lead">
              It moves only when something specific happened — and the row names the sentence.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className={`${s.ledger} ${shown ? s.shown : ""}`} ref={ref}>
            <div className={s.ledgerHead}>
              <span className={s.ledgerTitle}>Structure · turn by turn</span>
              <span className={s.ledgerRule}>Max +3 a turn · max −1 · a drop needs two turns</span>
            </div>

            {ledger.map((t, i) => {
              const down = t.delta?.startsWith("−");
              return (
                <div className={s.row} key={t.turn}>
                  <span className={s.turn}>T{t.turn}</span>

                  {t.quote ? (
                    <span className={s.quote}>&ldquo;{t.quote}&rdquo;</span>
                  ) : (
                    <span className={s.idle}>Nothing named — the score holds</span>
                  )}

                  <span
                    className={`${s.delta} ${down ? s.deltaDown : ""} ${!t.delta ? s.deltaNone : ""}`}
                  >
                    {t.delta ?? "·"}
                  </span>

                  <span className={s.meter}>
                    <span
                      className={`${s.fill} ${down ? s.fillDown : ""}`}
                      style={{
                        width: `${(t.value / CEILING) * 100}%`,
                        transitionDelay: `${i * 90}ms`,
                      }}
                    />
                  </span>
                </div>
              );
            })}

            <p className={s.ledgerFoot}>Open a row and the recording jumps to that moment.</p>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className={s.rules}>
            {rules.map((r) => (
              <div className={s.rule} key={r.title}>
                <h3 className={s.ruleTitle}>{r.title}</h3>
                <p className={s.ruleBody}>{r.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
