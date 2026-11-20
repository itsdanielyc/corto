import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { MAX_VOICE_SECONDS, voiceRecordingFile } from "../media/voice";
/** Seconds counted down between granting the microphone and recording, so the first words are not cut. */
const COUNTDOWN_SECONDS = 3;
interface Recording {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  cancelled: boolean;
  timer: number;
  clockTimer: number;
}
/** The microphone exists only between an explicit recording action and stop/discard/close. */
export function VoiceRecorder({
  onReady,
  report,
}: {
  onReady: (file: File) => Promise<void>;
  report: (error: unknown) => void;
}) {
  const t = useT();
  const [state, setState] = useState<
    "idle" | "requesting" | "countdown" | "recording" | "saving"
  >("idle");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const active = useRef<Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mounted = useRef(true);
  const stop = (discard: boolean) => {
    const recording = active.current;
    if (!recording) return;
    recording.cancelled = discard;
    window.clearTimeout(recording.timer);
    window.clearInterval(recording.clockTimer);
    if (recording.recorder.state !== "inactive") recording.recorder.stop();
    else if (active.current === recording) active.current = null;
    recording.stream.getTracks().forEach((track) => track.stop());
    if (mounted.current) setState(discard ? "idle" : "saving");
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop(true);
    };
  }, []);
  const start = async () => {
    setState("requesting");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Microphone recording is unavailable here. Import a recorded WAV or MP3 instead.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        throw error;
      }
      const recording: Recording = {
        recorder,
        stream,
        chunks: [],
        cancelled: false,
        timer: 0,
        clockTimer: 0,
      };
      active.current = recording;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recording.chunks.push(event.data);
      };
      recorder.onerror = () => {
        stop(true);
        report(
          new Error(
            "The microphone stopped recording. Check its permissions and try again.",
          ),
        );
      };
      recorder.onstop = () => {
        if (active.current === recording) active.current = null;
        if (recording.cancelled || !mounted.current) return;
        void voiceRecordingFile(
          new Blob(recording.chunks, { type: recorder.mimeType }),
        )
          .then(async (file) => {
            if (mounted.current) await onReady(file);
          })
          .catch(report)
          .finally(() => {
            if (mounted.current) setState("idle");
          });
      };
      setState("countdown");
      for (let remaining = COUNTDOWN_SECONDS; remaining > 0; remaining--) {
        setCount(remaining);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        // Discarded or closed during the countdown: the stream is already released.
        if (!mounted.current || active.current !== recording) return;
      }
      recorder.start(250);
      setElapsed(0);
      const started = performance.now();
      recording.clockTimer = window.setInterval(
        () => setElapsed(Math.floor((performance.now() - started) / 1000)),
        250,
      );
      recording.timer = window.setTimeout(
        () => stop(false),
        MAX_VOICE_SECONDS * 1000,
      );
      setState("recording");
    } catch (error) {
      report(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? new Error(
              "Microphone access was declined. Allow it in system/browser settings, or import a recording.",
            )
          : error,
      );
      if (mounted.current) setState("idle");
    }
  };
  return (
    <div className="recorder-status">
      {state === "countdown" ? (
        <>
          <span className="countdown" aria-live="assertive" key={count}>
            {count}
          </span>
          <button className="text-button" onClick={() => stop(true)}>
            {t("Cancel")}
          </button>
        </>
      ) : state === "recording" ? (
        <>
          <span className="recording-dot" aria-hidden="true" />
          <button className="button primary" onClick={() => stop(false)}>
            <Square size={15} />
            {t("Stop and add narration")}
          </button>
          <button className="text-button" onClick={() => stop(true)}>
            {t("Discard recording")}
          </button>
        </>
      ) : (
        <button
          className="button secondary"
          disabled={state !== "idle"}
          onClick={() => {
            void start();
          }}
        >
          <Mic size={16} />
          {state === "idle"
            ? t("Record narration")
            : state === "requesting"
              ? t("Waiting for microphone…")
              : t("Saving narration…")}
        </button>
      )}
      <span role="status" className="dialog-note">
        {state === "recording"
          ? `${t("Recording")} · ${elapsed}s · ${t("up to 5 minutes")}`
          : state === "countdown"
            ? t("Recording starts after the countdown")
            : ""}
      </span>
    </div>
  );
}
