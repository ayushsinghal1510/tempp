import { rhythm } from "@/lib/content";
import Reveal from "./Reveal";
import s from "./Rhythm.module.css";

export default function Rhythm() {
  return (
    <section className="section shell-tight">
      <p className="eyebrow">Rhythm</p>

      <div className={s.grid}>
        <Reveal>
          <div>
            <h2 className={`h2 ${s.title}`}>
              It doesn&rsquo;t correct you <em>after every sentence</em>.
            </h2>
            <p className={`lead ${s.body}`}>
              Corrected eight times in a row, nobody remembers any of it. So: three turns that ask,
              then a checkpoint.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <ol className={s.turns}>
            {rhythm.map((t) => (
              <li key={t.n} className={`${s.turn} ${t.kind === "Checkpoint" ? s.checkpoint : ""}`}>
                <span className={s.n}>{t.n}</span>
                <span>{t.label}</span>
                <span className={s.kind}>{t.kind}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
