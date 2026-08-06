import Image from "next/image";
import { vision } from "@/lib/content";
import Viewfinder from "./Viewfinder";
import Reveal from "./Reveal";
import s from "./Vision.module.css";

export default function Vision() {
  return (
    <section className="section shell-tight" id="vision">
      <Reveal>
        <p className="eyebrow">Vision</p>

        <h2 className={`h2 ${s.title}`}>
          It watches, <em>not just listens</em>.
        </h2>
      </Reveal>

      <Reveal delay={120}>
      <div className={s.grid}>
        <div className={s.frame}>
          <Image
            src="/assets/scenarios/interview.webp"
            alt="A learner mid-answer, seen through the session camera"
            fill
            sizes="(max-width: 900px) 100vw, 55vw"
            className={s.photo}
          />
          <div className={s.guides}>
            <Viewfinder />
          </div>

          <span className={`${s.bracket} ${s.tl}`} />
          <span className={`${s.bracket} ${s.tr}`} />
          <span className={`${s.bracket} ${s.bl}`} />
          <span className={`${s.bracket} ${s.br}`} />

          {vision.map((v) => (
            <span
              key={v.pin}
              className={s.pin}
              style={{ left: `${v.x}%`, top: `${v.y}%` }}
              aria-hidden="true"
            >
              {v.pin}
            </span>
          ))}

          <p className={s.status}>
            <span className={s.live}>
              <span className={s.liveDot} />
              Frame report
            </span>
            <span className={s.turn}>turn 6 · 4 read</span>
          </p>
        </div>

        <div className={s.side}>
          <p className="lead">
            Posture, framing, light, hands — read off the webcam and reported as observations.
            Never mood, never nerves.
          </p>

          <div className={s.readings}>
          {vision.map((v) => (
            <p className={s.reading} key={v.pin}>
              <span className={s.badge}>{v.pin}</span>
              {v.text}
              <span className={s.readingTag}>{v.tag}</span>
            </p>
          ))}
            <p className={s.refusal}>
              <span>Two people in frame</span>
              <span className="tag tag-ochre">Visual judgement withheld</span>
            </p>
          </div>
        </div>
      </div>
      </Reveal>
    </section>
  );
}
