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

/**
 * Soniox STT, English only — the tracks a human actually talks to in a room
 * (jer, mm, pr, cus) rather than over the phone.
 *
 * KEY NAMES ARE NOT COSMETIC HERE. This block used to send `language: ["en"]`,
 * and students were getting Devanagari back in their transcripts. The reason is
 * that the driver never reads a key called `language` at all — read
 * stt/src/stt/clients/streaming_/soniox_.py: the constructor pulls
 * `language-hints` and falls back to `['hi', 'en']` when it is absent. So the
 * English-only setting was inert and every one of these sessions ran on the
 * Hindi+English default. `language-hints` is the key the driver actually reads.
 *
 * `language-hints-strict` (→ soniox's `language_hints_strict`) is what makes it
 * a restriction rather than a lean: plain hints only bias the decode, so an
 * Indian-accented English word soniox half-hears as Hindi still comes back in
 * Devanagari, which then reaches the LLM as a token the script has no idea what
 * to do with. Strict is documented as giving its best results with exactly one
 * language in the list, which is what we send. These four are English-only
 * exercises — an interview drill, two roleplays and a custom workflow — so a
 * student speaking Hindi should read back as (imperfect) English rather than as
 * a second script; the prompt handles replying in English.
 *
 * There is deliberately NO speaker lock here. `speaker-lock: "first"` and
 * `max-speakers: 1` used to sit below, carried over from the call track's block
 * to keep a trainee's open room from feeding other people's voices into
 * `user_input`. Both are gone: they were INERT for the same reason `language`
 * was — the soniox driver reads neither, so nothing was ever actually locked to
 * the first speaker — and keeping them only made the block look like it did
 * something it did not. If far-end voice isolation is wanted on these tracks it
 * is a backend change, not a key here. The call track (nimcCustoms.ts) still
 * carries its own copy; this change does not touch it.
 *
 * Deliberately NOT shared with nimcCustoms.ts. That block is a dial-time
 * override mirroring server.js line for line, and coupling it to a WebRTC
 * default means a change here silently changes what goes out on PSTN.
 */
export const STT_SONIOX_EN = {
  service: "soniox",
  "language-hints": ["en"],
  "language-hints-strict": true,
  // Left on by itself now that the lock keys are gone. Also inert (the driver
  // does not read it), so this is intent-only — removing it would be a
  // behaviour-neutral cleanup, not a fix.
  "enable-speaker-diarization": true,
} as const;

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
