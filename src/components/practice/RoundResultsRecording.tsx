"use client";

import { useEffect, useRef, useState } from "react";
import TopicsTimeline, {
  type TopicKink,
  type TopicSeries,
} from "@/components/charts/bklit/TopicsTimeline";

export type RecordingState = "ready" | "processing" | "failed" | "none";

/** Slow enough to be free, fast enough that nobody sits staring at it. */
const POLL_MS = 4000;

export default function RoundResultsRecording({
  roundId,
  recordingState,
  series,
  kinks,
  turnSeconds,
  fallbackDurationSec,
  max = 10,
  showTimeline = true,
}: {
  roundId: string;
  recordingState: RecordingState;
  series: TopicSeries[];
  kinks: TopicKink[];
  turnSeconds: number[];
  fallbackDurationSec: number;
  max?: number;
  /**
   * False on a tenant that doesn't score (`cus`), where there is no rubric and
   * so no trajectory to plot. The recording, the processing banner and the
   * failure notice all still apply — this component owns those regardless of
   * whether anything was scored.
   */
  showTimeline?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDurationSec);
  const [state, setState] = useState<RecordingState>(recordingState);

  // The upload runs in whichever tab ran the interview, so this page can't
  // observe it directly — it asks the server instead. Only while genuinely
  // waiting: a ready or absent recording never polls.
  useEffect(() => {
    if (state !== "processing") return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/practice/rounds/${roundId}/recording/status`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { state?: RecordingState };
        if (body.state && body.state !== "processing" && !cancelled) {
          setState(body.state);
        }
      } catch {
        // A transient failure is not an answer — keep waiting.
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state, roundId]);

  const hasRecording = state === "ready";

  return (
    <div className="space-y-4">
      {state === "processing" && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-3.5 text-sm text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand" />
          <span>
            <span className="font-medium text-ink">
              {showTimeline
                ? "Analysing your video for analytics…"
                : "Processing your video…"}
            </span>{" "}
            {showTimeline
              ? "Your scores below are already final — the replay appears here on its own once the video finishes processing."
              : "Your transcript below is already complete — the replay appears here on its own once the video finishes processing."}
          </span>
        </div>
      )}

      {state === "failed" && (
        <p className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-muted">
          The video from this session didn&apos;t finish uploading, so there
          isn&apos;t a replay.{" "}
          {showTimeline
            ? "Your scores and coaching moments below are unaffected."
            : "Your transcript below is unaffected."}
        </p>
      )}

      {hasRecording && (
        <video
          ref={videoRef}
          controls
          className="w-full rounded-lg border border-line bg-black"
          src={`/api/practice/rounds/${roundId}/recording`}
          onLoadedMetadata={() => {
            // A recording made before the webm-duration fix (or any other
            // browser that never wrote real duration metadata) reports
            // Infinity/NaN here — trusting it blindly corrupts every
            // position/label downstream. Keep the server-computed fallback
            // instead when that happens.
            const d = videoRef.current?.duration;
            if (d != null && Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onTimeUpdate={() => {
            const t = videoRef.current?.currentTime;
            if (t != null && Number.isFinite(t)) setCurrentTime(t);
          }}
        />
      )}
      {showTimeline && (
      <TopicsTimeline
        series={series}
        kinks={kinks}
        max={max}
        turnSeconds={turnSeconds}
        durationSec={duration}
        currentTimeSec={hasRecording ? currentTime : undefined}
        onSeekSeconds={
          hasRecording
            ? (sec) => {
                if (videoRef.current) videoRef.current.currentTime = sec;
              }
            : undefined
        }
      />
      )}
    </div>
  );
}
