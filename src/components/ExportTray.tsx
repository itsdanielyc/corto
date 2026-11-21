import { useT } from "../i18n/locale";
import { useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  Clock,
  FolderOpen,
  LoaderCircle,
  X,
} from "lucide-react";
import type { MovieJobState } from "../export/queue";
import type { CortoPlatform } from "../platform/types";
import { IconButton } from "./primitives";

/** How long a finished background export stays announced before stepping aside. */
const FINISHED_VISIBLE_MS = 10000;

const isPending = (job: MovieJobState) =>
  job.status === "queued" || job.status === "running";

/**
 * Background exports: progress and cancel while a job runs, then a short
 * announcement of the finished film. It never stays pinned over the editor.
 */
export function ExportTray({
  jobs,
  platform,
  onCancel,
}: {
  jobs: readonly MovieJobState[];
  platform: CortoPlatform;
  onCancel: (id: string) => void;
}) {
  const t = useT();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const pending = jobs.filter(isPending);
  const finished = jobs.filter(
    (job) =>
      !isPending(job) && job.status !== "cancelled" && !dismissed.has(job.id),
  );
  // The job arrays are new on every render, so the effect depends on the ids
  // of the finished exports still showing (generated UUIDs, never a comma).
  const doneIds = finished
    .filter((job) => job.status === "done")
    .map((job) => job.id)
    .join(",");
  // Successful exports step aside on their own; failures wait to be read.
  useEffect(() => {
    if (!doneIds) return;
    const timer = window.setTimeout(
      () =>
        setDismissed(
          (previous) => new Set([...previous, ...doneIds.split(",")]),
        ),
      FINISHED_VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [doneIds]);
  if (!pending.length && !finished.length) return null;
  const latestFile = jobs
    .filter((job) => job.status === "done" && job.result?.location === "file")
    .at(-1);
  return (
    <aside className="export-tray" aria-label={t("Export queue")}>
      {pending.map((job) => (
        <div className={`export-job ${job.status}`} key={job.id}>
          {job.status === "running" ? (
            <LoaderCircle size={15} className="spin" aria-hidden="true" />
          ) : (
            <Clock size={15} aria-hidden="true" />
          )}
          <div>
            <strong>{job.name}</strong>
            <span>{t(job.progress.message)}</span>
            {job.status === "running" && (
              <progress
                max={1}
                value={job.progress.fraction}
                aria-label={t("Background export progress")}
              />
            )}
          </div>
          {job.status === "running" && (
            <span className="export-percent">
              {Math.round(job.progress.fraction * 100)}
              {t("%")}
            </span>
          )}
          <IconButton
            icon={X}
            label={t(`Cancel queued export ${job.name}`)}
            onClick={() => onCancel(job.id)}
          />
        </div>
      ))}
      {finished.map((job) => (
        <div className={`export-job ${job.status}`} key={job.id}>
          {job.status === "done" ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <CircleAlert size={15} aria-hidden="true" />
          )}
          <div role="status">
            <strong>{job.name}</strong>
            <span>
              {job.status === "done"
                ? (job.result?.fileName ?? t("Ready"))
                : (job.error ?? t("The export could not finish"))}
            </span>
          </div>
          {platform.kind === "native" && job.id === latestFile?.id && (
            <IconButton
              icon={FolderOpen}
              label={t("Show latest export in folder")}
              onClick={() => {
                void platform.revealExport();
              }}
            />
          )}
          <IconButton
            icon={X}
            label={t("Dismiss")}
            onClick={() =>
              setDismissed((previous) => new Set([...previous, job.id]))
            }
          />
        </div>
      ))}
    </aside>
  );
}
