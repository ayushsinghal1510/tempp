import Reveal from "./Reveal";
import s from "./Cta.module.css";

export default function Cta() {
  return (
    <section className="section shell" id="start">
      <div className={`${s.panel} on-dark`} data-nav-dark>
        <div className={s.glow} />
        <div className={s.inner}>
          <Reveal>
            <h2 className={`display ${s.title}`}>
              Whatever your people need to get good at — <em>that conversation</em>, scored.
            </h2>
          </Reveal>

          <Reveal delay={100}>
            <div className={s.ctas}>
              <a href="/practice/signup" className="btn btn-invert">
                Try a session
              </a>
              <a href="/practice/login" className="btn btn-outline-light">
                Book a walkthrough
              </a>
            </div>

            <p className={s.note}>
              Some conversations shouldn&rsquo;t be scored. Those configurations switch it off.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
