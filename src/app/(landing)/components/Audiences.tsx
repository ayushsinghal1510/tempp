import Reveal from "./Reveal";
import s from "./Audiences.module.css";

const upNext = [
  { label: "Round 3 · Systems design", tag: "Ready", tone: "tag-moss" },
  { label: "Acme Corp · behavioural", tag: "Resume first", tone: "tag-ochre" },
  { label: "Mock panel · closed Fri", tag: "Locked", tone: "tag-mute", muted: true },
];

const classStats = [
  { label: "Weakest dimension", value: "Structure", mono: false },
  { label: "Assigned → scored", value: "41/58", mono: true },
  { label: "First → latest", value: "+2.4", mono: true },
  { label: "Bail-outs", value: "3", mono: true },
];

export default function Audiences() {
  return (
    <section className="section shell-tight" id="educators">
      <Reveal>
        <p className="eyebrow">Two audiences</p>

        <div className="sec-head">
          <h2 className="h2">
            One session, <em>read twice</em>.
          </h2>
          <p className="lead">The learner sees what to do next. The educator sees who is stuck.</p>
        </div>
      </Reveal>

      <div className={s.grid}>
        <Reveal delay={80}>
          <div className={s.column}>
            <p className="eyebrow">For learners</p>
            <h3 className={`h3 ${s.title}`}>Practise until it stops being scary.</h3>
            <p className={s.body}>
              Opens on <strong>Up Next</strong> — things you can start right now.
            </p>

            <p className={s.listLabel}>Up next</p>
            <div className={s.rows}>
              {upNext.map((r) => (
                <div key={r.label} className={`${s.row} ${r.muted ? s.rowMuted : ""}`}>
                  <span>{r.label}</span>
                  <span className={`tag ${r.tone}`}>{r.tag}</span>
                </div>
              ))}
            </div>

            <div className={s.ctaRow}>
              <a href="#start" className="btn btn-solid">
                Try a session
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className={s.column}>
            <p className="eyebrow">For educators</p>
            <h3 className={`h3 ${s.title}`}>See who&rsquo;s stuck, without running forty of them.</h3>
            <p className={s.body}>Write it in a line. Assign it. Read what came back.</p>

            <p className={s.listLabel}>Class so far</p>
            <div className={s.stats}>
              {classStats.map((st) => (
                <div key={st.label} className={s.stat}>
                  <p className={s.statLabel}>{st.label}</p>
                  <p className={`${s.statValue} ${st.mono ? "mono" : ""}`}>{st.value}</p>
                </div>
              ))}
            </div>

            <div className={s.ctaRow}>
              <a href="/educator/login" className="btn btn-ghost">
                See the educator dashboard
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
