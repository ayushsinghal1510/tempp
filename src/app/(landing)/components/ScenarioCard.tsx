import Image from "next/image";
import type { Scenario } from "@/lib/content";
import Waveform from "./Waveform";
import s from "./ScenarioCard.module.css";

export default function ScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={s.card}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={s.media}>
        <Image
          src={scenario.image}
          alt=""
          fill
          sizes="(max-width: 720px) 80vw, 360px"
          className={s.img}
        />
        <span className={s.scrim} />
      </span>

      <span className={s.overlay}>
        <span className={s.tags}>
          {scenario.tags.map((t) => (
            <span key={t} className={s.tag}>
              {t}
            </span>
          ))}
        </span>
        <span className={s.duration}>
          <Waveform />
          {scenario.duration}
        </span>
      </span>

      <span className={s.body}>
        <span className={s.titleRow}>
          <span className={s.title}>{scenario.title}</span>
          <span className={s.word}>&ldquo;{scenario.word}&rdquo;</span>
        </span>

        <span className={s.blurb}>{scenario.blurb}</span>
        <span className={s.agent}>
          {scenario.agent} · {scenario.state}
        </span>

        <span className={s.cta}>
          <span className={s.ctaInner}>Start this session</span>
        </span>
      </span>
    </button>
  );
}
