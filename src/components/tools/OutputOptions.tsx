import { useT } from "../../i18n/locale";
import type { OutputSettings } from "../../../contracts/project";
import { Choice, Numeric, Slider, ToolSection } from "./Fields";
export function OutputOptions({
  settings,
  onChange,
  native,
  rangeMode,
  onRangeMode,
  rangeStart,
  rangeEnd,
  total,
  onRange,
  selectedCount,
}: {
  settings: OutputSettings;
  onChange: (settings: OutputSettings) => void;
  native: boolean;
  rangeMode: "all" | "selection" | "range";
  onRangeMode: (mode: "all" | "selection" | "range") => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onRange: (start: number, end: number) => void;
  selectedCount: number;
}) {
  const t = useT();
  const update = (changes: Partial<OutputSettings>) =>
    onChange({ ...settings, ...changes });
  return (
    <details className="advanced-export">
      <summary>{t("Format, quality & export range")}</summary>
      <div className="tool-fields">
        <Choice
          label={t("Export format")}
          value={settings.format}
          options={[
            ["mp4", "MP4 movie"],
            ["gif", "Animated GIF"],
            ["m4a", "Audio only · M4A"],
            ["wav", "Audio only · WAV"],
          ]}
          onChange={(format) =>
            update({
              format,
              ...(format === "gif"
                ? { resolution: "720p", preset: "custom", fps: 30 }
                : {}),
            })
          }
        />
        {settings.format === "mp4" && (
          <>
            <Choice
              label={t("Export resolution")}
              value={settings.resolution}
              options={[
                ["720p", "HD · 720p"],
                ["1080p", "Full HD · 1080p"],
                ["2160p", "4K · 2160p"],
              ]}
              onChange={(resolution) =>
                update({ resolution, preset: "custom" })
              }
            />
            <Choice
              label={t("Export frame rate")}
              value={String(settings.fps)}
              options={[
                ["24", "24 fps"],
                ["25", "25 fps"],
                ["30", "30 fps"],
                ["60", "60 fps"],
                ["source", "Match first clip"],
              ]}
              onChange={(fps) =>
                update({
                  fps:
                    fps === "source"
                      ? "source"
                      : (Number(fps) as OutputSettings["fps"]),
                })
              }
            />
          </>
        )}
        {["mp4", "gif"].includes(settings.format) && (
          <Slider
            label={t("Export quality")}
            value={settings.quality}
            max={100}
            step={1}
            onChange={(quality) => update({ quality, preset: "custom" })}
          />
        )}
        {settings.format === "mp4" && (
          <Choice
            label={t("Sharing destination")}
            value={settings.preset}
            options={[
              ["tv", "TV"],
              ["phone", "Phone"],
              ["small", "Small file"],
              ["youtube", "YouTube"],
              ["instagram", "Instagram"],
              ["whatsapp", "WhatsApp"],
              ["email", "Email"],
              ["custom", "Custom"],
            ]}
            onChange={(preset) =>
              update({
                preset,
                ...(preset === "youtube"
                  ? { resolution: "1080p", quality: 80 }
                  : preset === "instagram"
                    ? { resolution: "1080p", quality: 65 }
                    : preset === "whatsapp"
                      ? { resolution: "720p", quality: 45 }
                      : preset === "email"
                        ? { resolution: "720p", quality: 20 }
                        : {}),
              })
            }
          />
        )}
        <Choice
          label={t("Export portion")}
          value={rangeMode}
          options={[
            ["all", "Whole film"],
            ["selection", `Selected scenes (${selectedCount})`],
            ["range", "Custom time range"],
          ]}
          onChange={onRangeMode}
        />
        {rangeMode === "range" && (
          <>
            <Numeric
              label={t("Export range starts")}
              value={rangeStart}
              min={0}
              max={Math.max(0, rangeEnd - 0.001)}
              onChange={(start) => onRange(start, rangeEnd)}
            />
            <Numeric
              label={t("Export range ends")}
              value={rangeEnd}
              min={rangeStart + 0.001}
              max={total}
              onChange={(end) => onRange(rangeStart, end)}
            />
          </>
        )}
        {native && settings.format === "mp4" && (
          <ToolSection title={t("Encoding")}>
            <Choice
              label={t("Encoder preference")}
              value={settings.encoder}
              options={[
                ["auto", "Automatic"],
                ["software", "Software"],
                ["hardware", "Prefer hardware with software fallback"],
              ]}
              onChange={(encoder) => update({ encoder })}
            />
            <Numeric
              label={t("Encoder threads (0 = automatic)")}
              value={settings.threads}
              min={0}
              max={16}
              step={1}
              onChange={(threads) => update({ threads })}
            />
          </ToolSection>
        )}
      </div>
    </details>
  );
}
