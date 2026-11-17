import { useT } from "../i18n/locale";
import { useState } from "react";
import type { MovieJobState } from "../export/queue";
import type { CortoPlatform } from "../platform/types";
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
  const [open, setOpen] = useState(false);
  const pending = jobs.filter((job) =>
    ["queued", "running"].includes(job.status),
  );
  const active = pending.find((job) => job.status === "running");
  if (!jobs.length) return null;
  return (
    <aside className="export-tray" aria-label={t("Export queue")}>
      <button
        className="export-tray-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {active
          ? `${active.name} · ${Math.round(active.progress.fraction * 100)}%`
          : pending.length
            ? `${pending.length} exports waiting`
            : t("Your exports")}
        {pending.length > 1 ? ` · ${pending.length - 1} queued` : ""}
      </button>
      {active && (
        <progress
          max={1}
          value={active.progress.fraction}
          aria-label={t("Background export progress")}
        />
      )}
      {open && (
        <div className="export-job-list">
          {[...jobs].reverse().map((job) => (
            <div key={job.id}>
              <strong>{job.name}</strong>
              <span>
                {job.status === "running"
                  ? job.progress.message
                  : (job.result?.fileName ?? job.error ?? job.status)}
              </span>
              {["queued", "running"].includes(job.status) && (
                <button
                  className="text-button"
                  aria-label={t(`Cancel queued export ${job.name}`)}
                  onClick={() => onCancel(job.id)}
                >
                  {t("Cancel")}
                </button>
              )}
            </div>
          ))}
          {platform.kind === "native" &&
            jobs.some((job) => job.result?.location === "file") && (
              <button
                className="text-button"
                onClick={() => {
                  void platform.revealExport();
                }}
              >
                {t("Show latest export in folder")}
              </button>
            )}
        </div>
      )}
    </aside>
  );
}
