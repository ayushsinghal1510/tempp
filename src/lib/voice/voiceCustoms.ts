// Ported from the old app's voiceOptions.js — trimmed to the default providers
// we actually use (Deepgram TTS + Deepgram streaming STT). No voice-settings UI
// here; callers use the defaults.

// Shape verified against the backend, not guessed:
// vx-backend-monorepo/tts/src/tts/clients/streaming_/deepgram_.py
//
//   validate_keys(keys = ['model'], config = self.config)     ← REQUIRED
//   model       = config.get('model', 'aura-2-thalia-en')
//   sample_rate = config.get('sample-rate', 48_000)
//   encoding    = config.get('encoding', 'linear16')
//
// That is the entire surface. `model` is the only required key and the only
// one we send — the client reads nothing else, so a `voice` or `language` key
// here would be accepted and silently ignored. `model` carries the voice:
// Aura ids are "aura-2-{voice}-{lang}", Flux ids "flux-{voice}-{lang}".
//
// sample-rate and encoding are deliberately NOT sent. dcs/voice_/clients_.py
// `apply_audio_profile()` overwrites both from the transport before building
// the client — web -> 48000/linear16, call -> 8000/mulaw — so anything we put
// here is discarded, and hardcoding a rate is how callbot telephony broke
// before (see the monorepo's temp.md sprint notes).
//
// `service` selects the driver: dcs/voice_/clients_.py dispatches
// tts_service == 'deepgram' to DEEPGRAM_Streaming_TTS.
const TTS_DEEPGRAM = {
  defaults: { model: "aura-2-thalia-en" },
  buildId: ({ model }: { model?: string }) => ({
    service: "deepgram",
    // Not conditional: omitting it raises KeyError at client init.
    model: model || "aura-2-thalia-en",
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
  // The voice, selected by model id — see TTS_DEEPGRAM above. There is no
  // separate ttsVoice/ttsLanguage: the Deepgram client reads neither.
  ttsModel: "aura-2-thalia-en",
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
    tts_id: TTS_DEEPGRAM.buildId({ model: s.ttsModel }),
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
