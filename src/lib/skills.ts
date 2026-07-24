import {
  SKILLS,
  SKILL_LABELS,
  type SkillBar,
  type SkillKey,
  type SkillRetention,
} from "@/lib/fixtures";

export type SkillMap = Record<SkillKey, number>;

/** Build Bklit SkillBars data: weakest skill first, flagged as the accent bar. */
export function toSkillBars(m: SkillMap): SkillBar[] {
  const bars: SkillBar[] = SKILLS.map((s) => ({
    key: s.key,
    label: SKILL_LABELS[s.key],
    value: m[s.key],
    weakest: false,
  }));
  bars.sort((a, b) => a.value - b.value);
  if (bars.length) bars[0].weakest = true;
  return bars;
}

/** Build Bklit SkillRetention rows: where coaching left each skill vs test. */
export function toRetention(coached: SkillMap, test: SkillMap): SkillRetention[] {
  return SKILLS.map((s) => ({
    key: s.key,
    label: SKILL_LABELS[s.key],
    coachedTo: coached[s.key],
    heldInTest: test[s.key],
    kept: test[s.key] >= coached[s.key] - 0.5,
  }));
}
