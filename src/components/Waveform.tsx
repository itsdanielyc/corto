import { useT } from "../i18n/locale";
import { useEffect, useState } from "react";
import type { Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import { soundAnalysis } from "../media/sound-analysis";
/** Draw measured peaks; a pending or silent waveform never uses decorative random bars. */
export function Waveform({
  project,
  assetId,
  platform,
}: {
  project: Project;
  assetId: string;
  platform: CortoPlatform;
}) {
  const t = useT();
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const asset = project.assets[assetId];
    if (asset)
      void soundAnalysis(platform, project, asset)
        .then((value) => {
          if (!cancelled) setPeaks(value.peaks);
        })
        .catch(() => {
          if (!cancelled) setUnavailable(true);
        });
    return () => {
      cancelled = true;
    };
  }, [platform, project.assets, assetId]);
  if (!peaks)
    return (
      <span className="waveform-status">
        {unavailable ? t("Waveform unavailable") : t("Reading waveform…")}
      </span>
    );
  const maximum = Math.max(0.01, ...peaks);
  return (
    <svg
      className="waveform"
      viewBox="0 0 256 40"
      preserveAspectRatio="none"
      role="img"
      aria-label={t("Audio waveform")}
    >
      {peaks.map((peak, index) => (
        <path
          key={index}
          d={`M ${index * 2 + 1} ${20 - (peak / maximum) * 18} V ${20 + (peak / maximum) * 18}`}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
