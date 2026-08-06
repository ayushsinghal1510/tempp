import Image from "next/image";
import s from "./Hero.module.css";

const domains = [
  "Interview coaching",
  "Clinical communication",
  "Service recovery",
  "Admissions calling",
];

export default function Hero() {
  return (
    <section className={s.hero} id="top">
      <Image
        src="/assets/hero-valley.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className={s.photo}
      />
      <div className={s.washTop} />
      <div className={s.washBottom} />

      <div className={s.top}>
        <p className={`${s.live} rise`}>
          <span className={s.dot} />
          Live session · voice, video, scored
        </p>

        <h1 className={`display ${s.title} rise`} style={{ animationDelay: "80ms" }}>
          Practise the conversation out loud. Get scored on <em>what you actually said</em>.
        </h1>

        <p className={`lead ${s.sub} rise`} style={{ animationDelay: "160ms" }}>
          An AI that asks, watches, and coaches — scoring every turn. Your educator reads the same
          session.
        </p>

        <div className={`${s.ctas} rise`} style={{ animationDelay: "240ms" }}>
          <a href="#start" className="btn btn-solid">
            Start a session
          </a>
          <a href="#educators" className="btn btn-ghost">
            Book a walkthrough
          </a>
        </div>
      </div>

      <div className={s.domains}>
        {domains.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <a href="#session" className={s.scroll} aria-label="Scroll to the session">
        Scroll
        <span className={s.track} aria-hidden="true" />
      </a>
    </section>
  );
}
