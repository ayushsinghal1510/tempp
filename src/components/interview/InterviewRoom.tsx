"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import fixWebmDuration from "fix-webm-duration";
import {
  buildCustoms,
  waitForIceGathering,
  PARTICIPANTS,
  VX_SERVER,
  FLOW_API_KEY,
} from "@/lib/voice/customs";
import {
  buildPracticeCustoms,
  type PracticeDrive,
} from "@/lib/voice/practiceCustoms";
import { buildClinicalCustoms } from "@/lib/voice/clinicalCustoms";
import {
  buildWorkflowCustoms,
  type CustomWorkflow,
} from "@/lib/voice/workflowCustoms";
import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";
import type { CompanyContext } from "@/lib/voice/companyContext";
import { startRound } from "@/lib/actions/student";
import {
  startPracticeRound,
  completePracticeRound,
} from "@/lib/actions/practice";
import { beginBackgroundUpload } from "@/lib/practice/recordingUpload";

type ConnState = "connecting" | "connected" | "failed";
type AiState = "waiting" | "listening" | "thinking" | "speaking";

/** One exchange as stored by the webhook: what the student said, what came back. */
type LiveTurn = { turnNumber: number; transcript: string; speak: string | null };

/**
 * How often the live transcript polls. The turns it reads are written by the
 * voice server's webhook, which lands a turn or two behind the audio the
 * student just heard — so this is a running record to read back, never a
 * real-time caption track, and polling faster would only add load without
 * making it any more current.
 */
const TRANSCRIPT_POLL_MS = 3000;

export default function InterviewRoom({
  roundId,
  candidateName,
  company,
  drive,
  scenario,
  workflow,
  kindLabel,
  backHref,
  variant = "company",
}: {
  roundId: string;
  candidateName: string;
  /** Required for variant "company"; ignored for "practice". */
  company?: CompanyContext;
  /** Optional for variant "practice" — a self-created drive's company context. */
  drive?: PracticeDrive;
  /**
   * Set on the clinical track: runs the simulated-patient workflow instead of
   * the interviewer one. Everything else about a practice round — the round
   * lifecycle, the recording, the webhook — is genuinely identical between the
   * two, which is why this is a swapped workflow rather than a third variant.
   */
  scenario?: ClinicalScenario;
  /**
   * Set on the `cus` track: runs the customer's own greeting+prompt with no
   * scoring and no vision. Mutually exclusive with `scenario`.
   */
  workflow?: CustomWorkflow;
  kindLabel: string;
  backHref: string;
  /** "practice" runs the generic, deliberately-scored practice workflow instead. */
  variant?: "company" | "practice";
}) {
  const interviewerName =
    variant === "practice"
      ? (scenario?.patientName ?? drive?.companyName ?? "Practice Interviewer")
      : company!.name;
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [aiState, setAiState] = useState<AiState>("waiting");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [hasUserVid, setHasUserVid] = useState(false);
  const [hasAiVid, setHasAiVid] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [turns, setTurns] = useState<LiveTurn[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const aiVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>("");
  const recordingStartedAtRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  // Read inside the poll without making it a dependency — re-creating the
  // interval on every new turn would reset the timer and drift the cadence.
  const lastTurnRef = useRef(0);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  // Live transcript. Only the practice variant has a webhook receiver writing
  // turns (customs.ts posts to a bare origin that never reaches one), so
  // anywhere else this would poll forever for rows that are never created.
  const showTranscript = variant === "practice";

  useEffect(() => {
    if (!started || !showTranscript) return;
    let stopped = false;

    async function poll() {
      try {
        const r = await fetch(
          `/api/practice/rounds/${roundId}/turns?after=${lastTurnRef.current}`,
          { cache: "no-store" },
        );
        if (!r.ok || stopped) return;
        const data = (await r.json()) as { turns: LiveTurn[] };
        if (stopped || !data.turns?.length) return;

        lastTurnRef.current = data.turns[data.turns.length - 1].turnNumber;
        // Append rather than replace: the request only asks for turns after
        // the last one seen, so what comes back is the delta, not the whole
        // conversation.
        setTurns((prev) => [...prev, ...data.turns]);
      } catch {
        // A dropped poll is not worth surfacing — the transcript is a
        // convenience, and the next tick picks up whatever was missed.
      }
    }

    poll();
    const t = setInterval(poll, TRANSCRIPT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [started, showTranscript, roundId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Lightweight VAD to drive the AI "listening/speaking" indicator.
  const startVAD = useCallback(
    (
      analyser: AnalyserNode,
      threshold: number,
      onSpeak: () => void,
      onSilence: () => void,
    ) => {
      const buf = new Uint8Array(analyser.fftSize);
      let speakFrames = 0;
      let silentFrames = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length) * 100;
        if (rms > threshold) {
          speakFrames++;
          silentFrames = 0;
          if (speakFrames > 3) onSpeak();
        } else {
          silentFrames++;
          speakFrames = 0;
          if (silentFrames > 8) onSilence();
        }
        requestAnimationFrame(tick);
      };
      tick();
    },
    [],
  );

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, []);

  // WebRTC bootstrap
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_RECONNECTS = 5;

    // Retries once before giving up — TURN config is required for anyone on a
    // real network (mobile data, cross-region); silently proceeding with an
    // empty ICE server list produces a connection that can never complete for
    // exactly those users; returns null only after both attempts fail.
    async function fetchIceServers(): Promise<RTCIceServer[] | null> {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(`${VX_SERVER}/rtc/ice-servers`, {
            signal: AbortSignal.timeout(5000),
            // VX_SERVER is often an ngrok free-tier tunnel in dev — ngrok
            // intercepts real-browser requests (by User-Agent) with an HTML
            // "you're about to visit..." interstitial that has no CORS
            // headers, which the browser then reports as a CORS failure.
            // This header bypasses that page; harmless against any other host.
            headers: { "ngrok-skip-browser-warning": "true" },
          });
          if (r.ok) {
            const d = await r.json();
            const servers: RTCIceServer[] = d.ice_servers || [];
            console.log(
              `[ICE] fetched ${servers.length} ice server(s) on attempt ${attempt + 1}:`,
              servers.map((s) => s.urls),
            );
            return servers;
          }
          console.warn(
            `[ICE] attempt ${attempt + 1} got HTTP ${r.status} from ${VX_SERVER}/rtc/ice-servers`,
          );
        } catch (e) {
          console.warn(`[ICE] attempt ${attempt + 1} threw:`, e);
        }
        // Give a transient blip (cold tunnel, brief network hiccup) a moment
        // to pass before the second attempt, instead of firing back-to-back.
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
      console.error(
        `[ICE] both attempts to fetch ${VX_SERVER}/rtc/ice-servers failed`,
      );
      return null;
    }

    async function connect(stream: MediaStream) {
      if (cancelled) return;

      const iceServers = await fetchIceServers();
      if (iceServers === null) {
        // Couldn't get TURN config after retrying — treat it as a connection
        // failure (same reconnect-with-backoff path as every other failure
        // below) instead of silently degrading into a doomed peer connection.
        if (!cancelled && reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          setConnState("connecting");
          reconnectTimer = setTimeout(
            () => connect(stream),
            Math.min(1000 * reconnectAttempts, 5000),
          );
        } else if (!cancelled) {
          setConnState("failed");
        }
        return;
      }

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        console.log(
          `[RTC] ontrack: kind=${e.track.kind} id=${e.track.id} readyState=${e.track.readyState} muted=${e.track.muted} streams=${e.streams.length} streamTracks=${e.streams[0]?.getTracks().length ?? 0} (audio=${e.streams[0]?.getAudioTracks().length ?? 0}, video=${e.streams[0]?.getVideoTracks().length ?? 0})`,
        );
        if (e.track.kind === "audio" && aiAudioRef.current) {
          aiAudioRef.current.srcObject = e.streams[0];
          if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext();
          }
          const ctx = audioCtxRef.current;
          const src = ctx.createMediaStreamSource(e.streams[0]);
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          an.smoothingTimeConstant = 0.7;
          src.connect(an);
          startVAD(
            an,
            10,
            () => {
              setAiSpeaking(true);
              setAiState("speaking");
            },
            () => {
              setAiSpeaking(false);
              setAiState("listening");
            },
          );
        }
        if (e.track.kind === "video") {
          if (!aiVideoRef.current) {
            console.warn(
              "[RTC] got a video track but aiVideoRef isn't mounted yet",
            );
          } else {
            aiVideoRef.current.srcObject = e.streams[0];
            setHasAiVid(true);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[RTC] iceConnectionState -> ${pc.iceConnectionState}`);
      };
      pc.onicegatheringstatechange = () => {
        console.log(`[RTC] iceGatheringState -> ${pc.iceGatheringState}`);
      };
      pc.onicecandidateerror = (e) => {
        const ev = e as RTCPeerConnectionIceErrorEvent;
        console.warn(
          `[RTC] ICE candidate error: code=${ev.errorCode} text="${ev.errorText}" url=${ev.url}`,
        );
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        console.log(`[RTC] connectionState -> ${st}`);
        if (st === "connected") {
          reconnectAttempts = 0;
          setConnState("connected");
          setAiState("listening");
          // Flag the round as in-progress (best effort).
          void (variant === "practice"
            ? startPracticeRound(roundId)
            : startRound(roundId));
        }
        if (st === "failed" || st === "disconnected") {
          pc.close();
          if (!cancelled && reconnectAttempts < MAX_RECONNECTS) {
            reconnectAttempts++;
            setConnState("connecting");
            reconnectTimer = setTimeout(
              () => connect(stream),
              Math.min(1000 * reconnectAttempts, 5000),
            );
          } else if (!cancelled) {
            setConnState("failed");
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const customs =
        variant !== "practice"
          ? buildCustoms(company!, candidateName)
          : workflow
            ? buildWorkflowCustoms(candidateName, workflow)
            : scenario
              ? buildClinicalCustoms(candidateName, scenario)
              : buildPracticeCustoms(candidateName, drive);

      let resp: Response;
      try {
        resp = await fetch(`${VX_SERVER}/rtc/offer/audio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            api_key: FLOW_API_KEY,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            sdp: pc.localDescription?.sdp,
            type: pc.localDescription?.type,
            participants: PARTICIPANTS,
            customs,
            session_id: roundId,
          }),
        });
      } catch (e) {
        console.error(`[RTC] POST ${VX_SERVER}/rtc/offer/audio threw:`, e);
        if (!cancelled && reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          setConnState("connecting");
          reconnectTimer = setTimeout(
            () => connect(stream),
            Math.min(1000 * reconnectAttempts, 5000),
          );
        } else {
          setConnState("failed");
        }
        return;
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error(
          `[RTC] POST ${VX_SERVER}/rtc/offer/audio -> HTTP ${resp.status}:`,
          body.slice(0, 500),
        );
        setConnState("failed");
        return;
      }
      const answer = await resp.json();
      const videoLines = (answer.sdp?.match(/^m=video.*$/gm) ?? []).length;
      console.log(
        `[RTC] remote answer SDP has ${videoLines} m=video line(s)${videoLines === 0 ? " — the backend's answer never offers video at all, so no video track will ever arrive regardless of frontend code" : ""}`,
      );
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(
        "[RTC] transceivers after setRemoteDescription:",
        pc.getTransceivers().map((t) => ({
          mid: t.mid,
          kind: t.receiver.track?.kind,
          direction: t.direction,
          currentDirection: t.currentDirection,
        })),
      );
    }

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch {
          setConnState("failed");
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (stream.getVideoTracks().length && userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        setHasUserVid(true);
      }
      connect(stream);
    }

    start();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // ── Self-recorded side-by-side composite (replaces voxio's own server-side
  // recording) — entirely best-effort. Any unsupported API here must never
  // affect the actual call, so everything is wrapped and silently no-ops on
  // failure (this is the normal path on Safari, which has no `video/webm`
  // MediaRecorder support at all).
  useEffect(() => {
    if (variant !== "practice") return;
    if (connState !== "connected") return;
    // Guards against the WebRTC bootstrap's own reconnect logic (up to 5
    // retries) re-firing this effect and spawning a second recorder.
    if (mediaRecorderRef.current) return;

    let cancelled = false;

    function hasRealVideo(video: HTMLVideoElement | null): boolean {
      return !!video?.srcObject && video.readyState >= 2 && video.videoWidth > 0;
    }

    async function waitForAiAudio(maxMs: number): Promise<MediaStream | null> {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (cancelled) return null;
        const s = aiAudioRef.current?.srcObject as MediaStream | null;
        if (s && s.getAudioTracks().length > 0) return s;
        await new Promise((r) => setTimeout(r, 200));
      }
      return null;
    }

    async function setupRecording() {
      try {
        if (typeof MediaRecorder === "undefined") return;

        // Each pane is 4:3 — matches typical webcam capture (and the same
        // ratio the live on-screen video boxes already use) so a plain
        // stretch-to-fit never has to distort the picture.
        const PANE_W = 480;
        const PANE_H = 360;
        const CANVAS_W = PANE_W * 2;
        const CANVAS_H = PANE_H;
        const TARGET_FPS = 12;
        const FRAME_MS = 1000 / TARGET_FPS;

        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Crops the source to the pane's aspect ratio before scaling — same
        // effect as CSS `object-fit: cover`, so a 16:9/4:3/portrait camera
        // feed fills the pane without ever being squeezed.
        function drawCover(
          video: HTMLVideoElement,
          dx: number,
          dy: number,
          dWidth: number,
          dHeight: number,
        ) {
          if (!ctx) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return;
          const targetRatio = dWidth / dHeight;
          const srcRatio = vw / vh;
          let sx: number;
          let sy: number;
          let sWidth: number;
          let sHeight: number;
          if (srcRatio > targetRatio) {
            sHeight = vh;
            sWidth = vh * targetRatio;
            sx = (vw - sWidth) / 2;
            sy = 0;
          } else {
            sWidth = vw;
            sHeight = vw / targetRatio;
            sx = 0;
            sy = (vh - sHeight) / 2;
          }
          ctx.drawImage(video, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        }

        function drawPane(
          video: HTMLVideoElement | null,
          x: number,
          label: string,
        ) {
          if (!ctx) return;
          if (hasRealVideo(video)) {
            drawCover(video as HTMLVideoElement, x, 0, PANE_W, PANE_H);
          } else {
            ctx.fillStyle = "#111318";
            ctx.fillRect(x, 0, PANE_W, PANE_H);
            ctx.fillStyle = "#555b66";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(label, x + PANE_W / 2, PANE_H / 2);
          }
        }

        let lastDraw = 0;
        function draw(ts: number) {
          if (cancelled) return;
          if (ts - lastDraw >= FRAME_MS) {
            lastDraw = ts;
            drawPane(aiVideoRef.current, 0, "AI");
            drawPane(userVideoRef.current, PANE_W, candidateName);
          }
          rafIdRef.current = requestAnimationFrame(draw);
        }
        rafIdRef.current = requestAnimationFrame(draw);

        const canvasStream = canvas.captureStream(TARGET_FPS);

        // Real elapsed time can arrive after "connected" fires — wait a
        // bounded amount rather than a single one-shot check.
        const aiStream = await waitForAiAudio(5000);
        const micStream = streamRef.current;
        if (cancelled) return;
        if (!aiStream || !micStream || micStream.getAudioTracks().length === 0) {
          console.warn(
            "[recording] no AI/mic audio track available — skipping recording for this session",
          );
          if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
          return;
        }

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const audioCtx = audioCtxRef.current;
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }

        const aiSource = audioCtx.createMediaStreamSource(aiStream);
        const userSource = audioCtx.createMediaStreamSource(micStream);
        const merger = audioCtx.createChannelMerger(2);
        aiSource.connect(merger, 0, 0); // AI -> output channel 0 (left)
        userSource.connect(merger, 0, 1); // student mic -> output channel 1 (right)
        const dest = audioCtx.createMediaStreamDestination();
        merger.connect(dest);

        const combined = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);

        const candidates = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ];
        const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c));
        if (!mimeType || cancelled) return;

        recordingMimeTypeRef.current = mimeType;
        const recorder = new MediaRecorder(combined, {
          mimeType,
          videoBitsPerSecond: 1_000_000,
          audioBitsPerSecond: 96_000,
        });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recordingStartedAtRef.current = Date.now();
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn(
          "[recording] setup failed — continuing without recording:",
          err,
        );
      }
    }

    setupRecording();

    return () => {
      cancelled = true;
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      // Best-effort stop on unmount/reconnect teardown. The deliberate leave()
      // path stops + uploads explicitly before this cleanup ever runs.
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState, variant]);

  /**
   * Seals the recording and hands it to the background uploader. Returns
   * whether a recording is actually on its way, which is what tells the server
   * to expect a file.
   *
   * Everything awaited here is local and fast — stopping the recorder and
   * patching the webm header. The network transfer deliberately is not
   * awaited: the student is done and shouldn't be held on the call screen
   * watching a progress bar for a file they've already finished producing.
   */
  const sealAndQueueRecording = useCallback(async (): Promise<boolean> => {
    try {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return false;

      if (recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.addEventListener("stop", () => resolve(), { once: true });
          recorder.stop();
        });
      }
      mediaRecorderRef.current = null;

      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (chunks.length === 0) return false;

      const mimeType = recordingMimeTypeRef.current || "video/webm";
      let blob = new Blob(chunks, { type: mimeType });

      // MediaRecorder writes webm without a real duration in the container
      // (it's left "unknown"), so browsers play it back like a live stream —
      // an always-full, unseekable scrubber. Patch in the actual recorded
      // length before upload.
      if (mimeType.includes("webm")) {
        const durationMs = Date.now() - recordingStartedAtRef.current;
        blob = await fixWebmDuration(blob, durationMs).catch(() => blob);
      }

      beginBackgroundUpload(roundId, blob, mimeType);
      return true;
    } catch (err) {
      console.warn("[recording] could not queue upload:", err);
      return false;
    }
  }, [roundId]);

  const toggleMic = () => {
    if (!streamRef.current) return;
    const next = !micMuted;
    setMicMuted(next);
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const leave = async () => {
    let recordingExpected = false;
    if (variant === "practice") {
      setSaving(true);
      recordingExpected = await sealAndQueueRecording();
    }
    cleanup();
    if (variant === "practice") {
      // For now, leaving simply ends the round — considered complete. Must be
      // awaited (not fire-and-forget): this is what invalidates the cached
      // dashboard/company reads, and navigating before it completes can land
      // on `/practice` mid-invalidation. `recordingExpected` is also what
      // makes the results page wait for the upload instead of reporting that
      // there's no recording.
      await completePracticeRound(roundId, recordingExpected).catch(() => {});
    }
    router.push(backHref);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Preflight ──
  if (!started) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="w-full max-w-md">
          <div className="mb-4 inline-flex rounded-md bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            {kindLabel}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Ready when <span className="text-brand">you are.</span>
          </h1>
          <div className="mt-6 rounded-xl border border-line bg-card p-5">
            <Row
              label={variant === "practice" ? "Interviewer" : "Company"}
              value={interviewerName}
            />
            <div className="my-3 h-px bg-line" />
            <Row label="Candidate" value={candidateName} />
          </div>
          <p className="mt-4 text-sm text-muted">
            The AI interviewer opens the session. This is a practice run — speak
            naturally. Your microphone and camera will be requested.
          </p>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
          >
            Begin interview →
          </button>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="mt-3 w-full text-center text-sm text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const connLabel: Record<ConnState, string> = {
    connecting: "Connecting…",
    connected: "Connected",
    failed: "Connection lost",
  };
  const aiLabel: Record<AiState, string> = {
    waiting: "Waiting",
    listening: "Listening",
    thinking: "Thinking…",
    speaking: "Speaking",
  };

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {kindLabel}
          </span>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-brand">
            {interviewerName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-muted">
            {fmt(elapsed)}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              connState === "connected"
                ? "border-success text-success"
                : connState === "failed"
                  ? "border-danger text-danger"
                  : "border-warning text-warning"
            }`}
          >
            {connLabel[connState]}
          </span>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 items-center justify-center gap-10 overflow-hidden">
        {/* candidate */}
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-56 w-72 place-items-center overflow-hidden rounded-2xl border border-line bg-black">
            <video
              ref={userVideoRef}
              autoPlay
              playsInline
              muted
              className={hasUserVid ? "h-full w-full object-cover" : "hidden"}
            />
            {!hasUserVid && <span className="text-4xl">👤</span>}
          </div>
          <span className="text-sm font-medium text-ink">{candidateName}</span>
          <span className="text-xs uppercase tracking-wide text-muted">
            candidate
          </span>
        </div>

        {/* interviewer */}
        <div className="flex flex-col items-center gap-3">
          <div
            className={`grid h-56 w-72 place-items-center overflow-hidden rounded-2xl border bg-card transition ${
              aiSpeaking ? "border-brand" : "border-line"
            }`}
          >
            <video
              ref={aiVideoRef}
              autoPlay
              playsInline
              muted
              className={hasAiVid ? "h-full w-full object-cover" : "hidden"}
            />
            {!hasAiVid && (
              <span
                className={`text-5xl ${aiSpeaking ? "text-brand" : "text-faint"}`}
              >
                ◈
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-ink">
            {interviewerName}
          </span>
          <span className="text-xs uppercase tracking-wide text-muted">
            AI · {aiLabel[aiState]}
          </span>
        </div>
      </div>

      {showTranscript && (
        <aside className="hidden w-96 shrink-0 flex-col border-l border-line bg-card lg:flex">
          <div className="shrink-0 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Transcript</h2>
            <p className="mt-0.5 text-xs text-muted">
              What you said, as it was heard. Read your own words back — that
              is where most of the fixes are.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <p className="text-xs text-faint">
                Your first answer will appear here a few seconds after you
                speak.
              </p>
            ) : (
              turns.map((t) => (
                <div key={t.turnNumber} className="space-y-2">
                  {t.transcript && (
                    <div className="ml-6 rounded-lg rounded-br-sm bg-brand-soft px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-brand">
                        You
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink">
                        {t.transcript}
                      </p>
                    </div>
                  )}
                  {t.speak && (
                    <div className="mr-6 rounded-lg rounded-bl-sm border border-line px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                        {interviewerName}
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink">
                        {t.speak}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </aside>
      )}
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-4 border-t border-line py-4">
        <button
          type="button"
          onClick={toggleMic}
          className={`grid h-11 w-11 place-items-center rounded-full border transition ${
            micMuted
              ? "border-danger bg-danger text-white"
              : "border-line bg-card text-ink hover:border-brand/40"
          }`}
          title={micMuted ? "Unmute" : "Mute"}
        >
          {micMuted ? "🔇" : "🎤"}
        </button>
        <button
          type="button"
          onClick={leave}
          disabled={saving}
          className="rounded-full border border-danger/40 bg-danger/10 px-5 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {/* Only covers sealing the file, which is a second or two — the
              upload itself now runs after the student has already left. */}
          {saving ? "Wrapping up…" : "Leave"}
        </button>
      </footer>

      <audio ref={aiAudioRef} autoPlay />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
