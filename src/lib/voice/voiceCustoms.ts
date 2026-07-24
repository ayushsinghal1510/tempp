// Ported from the old app's voiceOptions.js — trimmed to the default providers
// we actually use (Sarvam TTS + Deepgram streaming STT). No voice-settings UI
// here; callers use the defaults.

const TTS_SARVAM = {
  defaults: { voice: "shubh", language: "en-IN" },
  buildId: ({ voice, language }: { voice?: string; language?: string }) => ({
    service: "sarvam",
    voice,
    language,
  }),
};

const STT_DEEPGRAM_STREAMING = {
  defaults: { model: "nova-3", language: "en-IN" },
  buildId: ({ model, language }: { model?: string; language?: string }) => ({
    service: "deepgram-streaming",
    "model-name": model,
    language,
  }),
};

const VOICE_SETTING_DEFAULTS = {
  ttsVoice: "shubh",
  ttsLanguage: "en-IN",
  sttModel: "nova-3",
  sttLanguage: "en-IN",
  grainVoice: false,
  grainLevel: 0.025,
  preFire: true,
  preFireMin: 5,
  preFireMax: 5000,
  preFireCurrent: 10,
  inactivity: true,
  inactivityTimePeriod: 1000,
  inactivityMaxTimes: 3,
  inactivityMessage:
    "Are you still there? No rush — take your time and answer whenever you're ready.",
  inactivityInterruptionType: "full",
};

export type VoiceSettings = Partial<typeof VOICE_SETTING_DEFAULTS> & {
  greeting?: string;
  additionalInstructions?: string;
};

/** The customs keys the voice backend expects for TTS/STT/pre-fire/inactivity. */
export function buildVoiceCustoms(settings?: VoiceSettings | null) {
  const s = { ...VOICE_SETTING_DEFAULTS, ...(settings ?? {}) };
  return {
    tts_id: TTS_SARVAM.buildId({ voice: s.ttsVoice, language: s.ttsLanguage }),
    stt_id: STT_DEEPGRAM_STREAMING.buildId({
      model: s.sttModel,
      language: s.sttLanguage,
    }),
    "grain-voice": s.grainVoice,
    "grain-level": s.grainVoice ? s.grainLevel : 0,
    "pre-fire": s.preFire,
    "pre-fire-config": s.preFire
      ? { min: s.preFireMin, max: s.preFireMax, current: s.preFireCurrent }
      : {},
    inactivity: s.inactivity,
    "inactivity-metadata": s.inactivity
      ? {
          "time-period": s.inactivityTimePeriod,
          "max-times": s.inactivityMaxTimes,
          "inactivity-type": "static",
          message: s.inactivityMessage,
          "interruption-type": s.inactivityInterruptionType,
          "interruption-metadata": {},
        }
      : {},
  };
}
