"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  buildWebActionDemoCustoms,
  VX_SERVER,
  FLOW_API_KEY,
  PARTICIPANTS,
  waitForIceGathering,
} from "@/lib/voice/webActionDemoCustoms";

type ActionLog = {
  id: string;
  action: Record<string, unknown>;
  status: "pending" | "ok" | "error" | "timeout";
  timestamp: number;
};

export default function WebActionsDemo() {
  const [started, setStarted] = useState(false);
  const [connState, setConnState] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle");
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aiSpeakingRef = useRef(false);
  const pendingActionsRef = useRef<{ id: string; action: Record<string, unknown> }[]>([]);
  // Tracks whether we've heard speech SINCE the latest action was queued.
  // Must go through a full speak→silence cycle before we execute.
  const heardSpeechSinceQueueRef = useRef(false);

  // Handle acks from the iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const { type, id, status } = event.data || {};
      if (type !== "action_ack") return;

      // Update the action log
      setActionLog((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a)),
      );

      // Send ack back to the server via datachannel
      const dc = dcRef.current;
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "web_action_ack", id, status }));
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const startSession = useCallback(async () => {
    setStarted(true);
    setConnState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicAllowed(true);
      connect(stream);
    } catch {
      setConnState("failed");
    }
  }, []);

  async function connect(stream: MediaStream) {
    // Fetch ICE servers
    let iceServers: RTCIceServer[] = [];
    try {
      const r = await fetch(`${VX_SERVER}/rtc/ice-servers`, {
        signal: AbortSignal.timeout(5000),
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (r.ok) {
        const d = await r.json();
        iceServers = d.ice_servers || [];
      }
    } catch (e) {
      console.warn("[ICE] failed to fetch:", e);
    }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Create the datachannel BEFORE the offer so it's included in the SDP
    const dc = pc.createDataChannel("web_actions", { ordered: true });
    dcRef.current = dc;

    dc.onopen = () => {
      console.log("[DC] datachannel opened");
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "web_action") {
          console.log("[DC] received web_action:", msg);

          // Log it as pending
          setActionLog((prev) => [
            ...prev,
            {
              id: msg.id,
              action: msg.action,
              status: "pending",
              timestamp: Date.now(),
            },
          ]);

          // Queue the action — it will execute once the AI finishes speaking
          // the preceding segment (must hear speech THEN silence before firing).
          pendingActionsRef.current.push({ id: msg.id, action: msg.action });
          heardSpeechSinceQueueRef.current = false;
        }
      } catch (e) {
        console.error("[DC] failed to parse message:", e);
      }
    };

    dc.onclose = () => console.log("[DC] datachannel closed");

    // Executes the first pending action ONLY after a full speak→silence
    // transition. This ensures the user hears the speech segment before
    // the corresponding action fires. The server sends:
    //   [speech audio] → [web_action on datachannel]
    // But audio has latency, so the datachannel message arrives while
    // audio is still buffering. We must wait for:
    //   audio actually plays (heardSpeech=true) → silence (fire action)
    function drainAfterSpeech() {
      if (pendingActionsRef.current.length === 0) return;
      if (!heardSpeechSinceQueueRef.current) return;

      const { id, action } = pendingActionsRef.current.shift()!;
      // Reset for the next action in the queue
      heardSpeechSinceQueueRef.current = false;

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ action, id }, "*");
      } else {
        dc.send(JSON.stringify({ type: "web_action_ack", id, status: "error" }));
      }
    }

    // Handle remote audio
    pc.ontrack = (e) => {
      if (e.track.kind === "audio" && aiAudioRef.current) {
        aiAudioRef.current.srcObject = e.streams[0];
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(e.streams[0]);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        an.smoothingTimeConstant = 0.7;
        src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        let speaking = false;
        let silenceStart = 0;
        const SILENCE_THRESHOLD_MS = 300; // wait 300ms of silence before firing action
        const check = () => {
          an.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
          const nowSpeaking = avg > 10;

          if (nowSpeaking) {
            silenceStart = 0;
            if (!speaking) {
              speaking = true;
              aiSpeakingRef.current = true;
              setAiSpeaking(true);
              // Mark that we've heard speech — prerequisite for firing pending actions
              if (pendingActionsRef.current.length > 0) {
                heardSpeechSinceQueueRef.current = true;
              }
            }
          } else {
            if (speaking) {
              if (silenceStart === 0) {
                silenceStart = performance.now();
              } else if (performance.now() - silenceStart > SILENCE_THRESHOLD_MS) {
                speaking = false;
                aiSpeakingRef.current = false;
                setAiSpeaking(false);
                // AI finished speaking — fire the pending action if we heard speech first
                drainAfterSpeech();
              }
            }
          }
          requestAnimationFrame(check);
        };
        check();
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") setConnState("connected");
      if (st === "failed" || st === "disconnected") setConnState("failed");
    };

    // Create offer and send to server
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const customs = buildWebActionDemoCustoms("Demo User");

    try {
      const resp = await fetch(`${VX_SERVER}/rtc/offer/audio`, {
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
          session_id: `demo-${Date.now()}`,
        }),
      });

      if (!resp.ok) {
        console.error("[RTC] offer failed:", resp.status);
        setConnState("failed");
        return;
      }

      const answer = await resp.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error("[RTC] connection error:", e);
      setConnState("failed");
    }
  }

  const stopSession = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStarted(false);
    setConnState("idle");
    setAiSpeaking(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Web Actions Demo</h1>
          <p className="text-sm text-gray-400">
            Voice-controlled browser actions via RTCDataChannel
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                connState === "connected"
                  ? "bg-green-500"
                  : connState === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : connState === "failed"
                      ? "bg-red-500"
                      : "bg-gray-600"
              }`}
            />
            <span className="text-xs text-gray-400 capitalize">
              {connState}
            </span>
          </div>
          {!started ? (
            <button
              onClick={startSession}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Start Demo
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </header>

      {/* Mic indicator bar */}
      {started && (
        <div className="px-6 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
            connState === "connected" ? "bg-red-500 animate-pulse" : "bg-gray-600"
          }`}>
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span className="text-sm text-gray-300">
            {connState === "connected"
              ? "Mic live — speak to the AI agent"
              : connState === "connecting"
                ? "Connecting..."
                : "Mic not connected"}
          </span>
          {aiSpeaking && (
            <span className="ml-auto text-sm text-indigo-400 animate-pulse">
              AI is speaking...
            </span>
          )}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex">
        {/* Left: iframe with the login page */}
        <div className="flex-1 p-6 flex flex-col">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
            <span className="font-mono">/demo-login.html</span>
            {aiSpeaking && (
              <span className="text-indigo-400 animate-pulse">
                AI speaking...
              </span>
            )}
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-gray-800 bg-white">
            <iframe
              ref={iframeRef}
              src="/demo-login.html"
              className="w-full h-full"
              title="Demo Login Page"
            />
          </div>
        </div>

        {/* Right: action log */}
        <aside className="w-80 border-l border-gray-800 p-4 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Action Log
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {actionLog.length === 0 && (
              <p className="text-xs text-gray-600">
                Actions from the AI will appear here as they fire...
              </p>
            )}
            {actionLog.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border text-xs font-mono ${
                  entry.status === "ok"
                    ? "border-green-800 bg-green-950/50"
                    : entry.status === "error"
                      ? "border-red-800 bg-red-950/50"
                      : entry.status === "pending"
                        ? "border-yellow-800 bg-yellow-950/50"
                        : "border-gray-700 bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400">
                    {(entry.action as { action?: string }).action}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      entry.status === "ok"
                        ? "text-green-400"
                        : entry.status === "error"
                          ? "text-red-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {entry.status}
                  </span>
                </div>
                <div className="text-gray-500 break-all">
                  {JSON.stringify(entry.action)}
                </div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 rounded-lg bg-gray-900 border border-gray-800">
            <h3 className="text-xs font-semibold text-gray-300 mb-2">
              How to use
            </h3>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Click &quot;Start Demo&quot; and allow microphone</li>
              <li>Say &quot;Log me in with demo credentials&quot;</li>
              <li>Watch the AI fill in the form for you</li>
              <li>
                Try: &quot;Fill in my email as john@test.com&quot;
              </li>
            </ul>
          </div>
        </aside>
      </main>

      {/* Hidden audio element for AI voice */}
      <audio ref={aiAudioRef} autoPlay />
    </div>
  );
}
