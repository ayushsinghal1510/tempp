import s from "./Waveform.module.css";

/** Fixed offsets, so the bars read as speech rather than a sine wave. */
const OFFSETS = [0, 0.34, 0.62, 0.16, 0.48, 0.08, 0.7, 0.26, 0.55];

export default function Waveform() {
  return (
    <span className={s.wave} aria-hidden="true">
      {OFFSETS.map((o, i) => (
        <span key={i} className={s.bar} style={{ animationDelay: `${-o}s` }} />
      ))}
    </span>
  );
}
