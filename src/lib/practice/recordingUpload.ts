// Background upload of a session recording.
//
// The point of this module is that it is NOT a React hook and holds no
// component state. A webcam recording of a ten-minute interview is tens of
// megabytes, and making the student sit on the call screen watching a
// percentage tick up is the wrong trade — they're done, they should be able to
// walk away. So `leave()` hands the blob here and navigates immediately.
//
// Because the XHR is owned by a module-level map rather than by the component
// that started it, unmounting InterviewRoom (which a client-side navigation
// does instantly) doesn't abort it. The round is marked `processing` before
// the student leaves and the POST route flips it to `ready` on arrival, so the
// results page can tell "still uploading" apart from "no recording exists"
// without needing to talk to whichever tab started the upload.
//
// A hard reload during the window does kill the upload — nothing in the
// browser survives that. The results page treats a `processing` round that has
// gone quiet for too long as failed rather than spinning forever.

const inFlight = new Map<string, XMLHttpRequest>();

/** True while this tab is still pushing bytes for that round. */
export function isUploading(roundId: string): boolean {
  return inFlight.has(roundId);
}

/**
 * Fire-and-forget. Resolves immediately; the transfer continues in the
 * background and reports its own outcome to the server.
 */
export function beginBackgroundUpload(
  roundId: string,
  blob: Blob,
  contentType: string,
): void {
  // A second call for the same round (double-click on "End", a remount) must
  // not start a competing upload writing to the same file.
  if (inFlight.has(roundId)) return;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/practice/rounds/${roundId}/recording`);
  xhr.setRequestHeader("Content-Type", contentType);
  // No xhr.timeout: a blind cutoff is what kills a healthy upload on a slow
  // connection. The server-side staleness rule bounds the wait instead.

  const finish = (ok: boolean) => {
    inFlight.delete(roundId);
    if (!ok) markFailed(roundId);
  };

  xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300);
  xhr.onerror = () => finish(false);
  xhr.onabort = () => finish(false);

  inFlight.set(roundId, xhr);
  xhr.send(blob);
}

/** Best-effort — if this never lands, the staleness rule catches it anyway. */
function markFailed(roundId: string): void {
  void fetch(`/api/practice/rounds/${roundId}/recording/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "failed" }),
    keepalive: true,
  }).catch(() => {});
}
