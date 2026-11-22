import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./primitives";
import { waitForMedia } from "../media/import";
import { finalizeWebm } from "../export/finalize-webm";
const MAX_CAPTURE_BYTES = 60 * 1024 ** 2;
const MAX_CAPTURE_SECONDS = 10 * 60;
/** Camera/screen capture owns and releases every track, including when a dialog closes mid-recording. */
export function CaptureDialog({
  onImport,
  onClose,
}: {
  onImport: (files: File[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mounted = useRef(true);
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const release = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(
      () =>
        setSeconds((value) => {
          if (value + 1 >= MAX_CAPTURE_SECONDS) recorder.current?.stop();
          return value + 1;
        }),
      1000,
    );
    return () => clearInterval(interval);
  }, [active]);
  const start = async (screen: boolean) => {
    setError("");
    chunks.current = [];
    setSeconds(0);
    let bytes = 0;
    try {
      const captured = screen
        ? await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: true,
          })
        : await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: 30,
            },
            audio: true,
          });
      if (!mounted.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      if (video.current) {
        video.current.srcObject = captured;
        await waitForMedia(video.current);
        await video.current.play();
      }
      const mime = [
        "video/webm;codecs=vp8,opus",
        "video/mp4;codecs=avc1.42E028,mp4a.40.2",
      ].find((value) => MediaRecorder.isTypeSupported(value));
      if (!mime)
        throw new Error("This browser cannot record camera or screen video");
      const recording = new MediaRecorder(captured, {
        mimeType: mime,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });
      recorder.current = recording;
      recording.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.current.push(event.data);
          bytes += event.data.size;
          if (bytes >= MAX_CAPTURE_BYTES && recording.state === "recording")
            recording.stop();
        }
      };
      recording.onstop = () => {
        release();
        setActive(false);
        if (!mounted.current || !chunks.current.length) return;
        void (async () => {
          const blob = new Blob(chunks.current, { type: mime });
          const webm = mime.includes("webm");
          const complete = webm
            ? await finalizeWebm(blob, new AbortController().signal)
            : blob;
          onImport([
            new File(
              [complete],
              `${screen ? "Screen" : "Camera"} recording.${webm ? "webm" : "mp4"}`,
              { type: webm ? "video/webm" : "video/mp4" },
            ),
          ]);
          onClose();
        })().catch((error) => setError(String(error)));
      };
      captured.getVideoTracks()[0]?.addEventListener(
        "ended",
        () => {
          if (recording.state === "recording") recording.stop();
        },
        { once: true },
      );
      recording.start(500);
      setActive(true);
    } catch (failure) {
      release();
      setError(
        failure instanceof Error
          ? failure.message
          : "Capture was declined or unavailable",
      );
    }
  };
  return (
    <Modal title={t("Record camera or screen")} onClose={onClose}>
      <video
        className="capture-preview"
        ref={video}
        muted
        playsInline
        aria-label={t("Recording preview")}
      />
      <p className="dialog-note">
        {t(
          "Record up to 10 minutes or 60 MB at a time. You choose the camera, microphone or screen.",
        )}
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        {active ? (
          <>
            <span role="status">
              {t("Recording \u00B7 ")}
              {seconds}
              {t("s")}
            </span>
            <button
              className="button primary"
              onClick={() => recorder.current?.stop()}
            >
              {t("Stop and add recording")}
            </button>
          </>
        ) : (
          <>
            <button
              className="button secondary"
              onClick={() => {
                void start(false);
              }}
            >
              {t("Record camera")}
            </button>
            <button
              className="button primary"
              onClick={() => {
                void start(true);
              }}
            >
              {t("Record screen")}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
