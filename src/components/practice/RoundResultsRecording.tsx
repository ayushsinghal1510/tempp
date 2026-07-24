"use client";

import { useRef, useState } from "react";
import TopicsTimeline, {
  type TopicKink,
  type TopicSeries,
} from "@/components/charts/bklit/TopicsTimeline";

export default function RoundResultsRecording({
  roundId,
  hasRecording,
  series,
  kinks,
  turnSeconds,
  fallbackDurationSec,
  max = 10,
}: {
  roundId: string;
  hasRecording: boolean;
  series: TopicSeries[];
  kinks: TopicKink[];
  turnSeconds: number[];
  fallbackDurationSec: number;
  max?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDurationSec);

  return (
    <div className="space-y-4">
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
    </div>
  );
}
