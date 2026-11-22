import { useT } from "../i18n/locale";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Blend,
  Clapperboard,
  Crop,
  GalleryHorizontalEnd,
  HardDrive,
  Languages,
  LifeBuoy,
  MonitorPlay,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Timer,
  Type,
  Zap,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import { preferencesSchema } from "../../contracts/creative";
import type { Preferences, Project } from "../../contracts/project";
import type { UpdateInformation } from "../../contracts/services";
import type { CortoPlatform } from "../platform/types";
import { TRANSITION_CHOICES } from "./tools/choice-lists";
import { loadTheme, saveTheme } from "../platform/appearance";

type ThemeChoice = ReturnType<typeof loadTheme>;
type SectionId = "general" | "scenes" | "timeline" | "downloads" | "updates";

/** How long a burst of edits waits before it is written, so typing a number saves once. */
const SAVE_DELAY_MS = 350;

const SECTIONS: readonly {
  id: SectionId;
  title: string;
  lede: string;
  icon: LucideIcon;
}[] = [
  {
    id: "general",
    title: "General",
    lede: "How Corto looks and which language it speaks.",
    icon: SlidersHorizontal,
  },
  {
    id: "scenes",
    title: "New scenes",
    lede: "How photos and joins start out. Scenes you already made keep their edits.",
    icon: Clapperboard,
  },
  {
    id: "timeline",
    title: "Timeline",
    lede: "How the reel lays out your film while you edit.",
    icon: GalleryHorizontalEnd,
  },
  {
    id: "downloads",
    title: "Downloads",
    lede: "Optional models Corto fetched for automatic captions and cut-outs.",
    icon: HardDrive,
  },
  {
    id: "updates",
    title: "Updates and help",
    lede: "New versions of Corto, and where to find them.",
    icon: LifeBuoy,
  },
];

/** One settings row in the family anatomy: icon tile, words, control on the right. */
function Row({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <span className="settings-row-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="settings-row-text">
        <span className="settings-row-title">{title}</span>
        {description && (
          <span className="settings-row-description">{description}</span>
        )}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

/** A small drawing of the window in each theme, as in Onda's General page. */
function ThemePreview({ kind }: { kind: ThemeChoice }) {
  return (
    <span className={`theme-preview theme-preview-${kind}`} aria-hidden="true">
      <i />
      <b />
    </span>
  );
}

/**
 * Settings: a place, not a dialog. The desk lists the sections and the sheet
 * shows one, like every miille app. Every change saves as it happens; there is
 * no Save button to forget.
 */
export function SettingsPage({
  project,
  platform,
  onApply,
  onBack,
}: {
  project: Project;
  platform: CortoPlatform;
  onApply: (preferences: Preferences) => void;
  onBack: () => void;
}) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const [section, setSection] = useState<SectionId>("general");
  const [preferences, setPreferences] = useState(() =>
    preferencesSchema.parse({
      defaults: project.defaults,
      output: project.output,
    }),
  );
  const [error, setError] = useState("");
  const [update, setUpdate] = useState<UpdateInformation | null>(null);
  const [checked, setChecked] = useState(false);
  const [modelsRemoved, setModelsRemoved] = useState(false);
  const [ready, setReady] = useState(!platform.loadPreferences);
  const [theme, setTheme] = useState(loadTheme);
  const pending = useRef<number | null>(null);
  const latest = useRef(preferences);

  useEffect(() => {
    let cancelled = false;
    void platform
      .loadPreferences?.()
      .then((saved) => {
        if (cancelled) return;
        latest.current = saved;
        setPreferences(saved);
        setReady(true);
      })
      .catch((failure) => {
        if (!cancelled) setError(String(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [section]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      // A menu that handled this Escape (the title bar's) marks it as done.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      // Blur first, so a number still being typed is committed and saved.
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      onBack();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onBack]);

  const write = async (next: Preferences) => {
    try {
      const parsed = preferencesSchema.parse(next);
      await platform.savePreferences?.(parsed);
      onApply(parsed);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Couldn't save settings"),
      );
    }
  };

  // Write any edit still waiting when the page closes.
  const writeLatest = useRef(write);
  writeLatest.current = write;
  useEffect(
    () => () => {
      if (pending.current === null) return;
      window.clearTimeout(pending.current);
      void writeLatest.current(latest.current);
    },
    [],
  );

  const change = (next: Preferences, immediately = false) => {
    if (!ready) return;
    latest.current = next;
    setPreferences(next);
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    if (immediately) {
      void write(next);
      return;
    }
    pending.current = window.setTimeout(() => {
      pending.current = null;
      void write(latest.current);
    }, SAVE_DELAY_MS);
  };
  const defaults = (changes: Partial<Preferences["defaults"]>) =>
    change({
      ...latest.current,
      defaults: { ...latest.current.defaults, ...changes },
    });

  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    saveTheme(choice);
    // The page has already changed; say so if the window frame could not follow.
    void platform
      .setNativeTheme?.(choice)
      .catch((failure) => setError(String(failure)));
  };

  const current = SECTIONS.find((entry) => entry.id === section)!;
  const number = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
    unit?: string,
  ) => (
    <NumberField
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
    />
  );

  return (
    <section className="settings-view" aria-labelledby="settings-heading">
      <nav className="home-sidebar" aria-label={t("Settings")}>
        <button
          className="home-back settings-back"
          onClick={onBack}
          aria-label={t("Back")}
        >
          <span className="home-back-icon" aria-hidden="true">
            <ArrowLeft size={16} />
          </span>
          {t("Settings")}
        </button>
        {SECTIONS.map((entry) => (
          <button
            key={entry.id}
            className="settings-nav"
            aria-current={entry.id === section ? "page" : undefined}
            onClick={() => setSection(entry.id)}
          >
            <entry.icon size={18} aria-hidden="true" />
            {t(entry.title)}
          </button>
        ))}
      </nav>
      <div className="home-sheet">
        <div className="home-scroll">
          <div className="home-content settings-content">
            <header className="home-head">
              <div>
                <h1 id="settings-heading" ref={heading} tabIndex={-1}>
                  {t(current.title)}
                </h1>
                <p className="home-lede">{t(current.lede)}</p>
              </div>
            </header>
            {!ready && !error && (
              <p role="status" className="home-note">
                {t("Loading saved settings…")}
              </p>
            )}
            {error && (
              <p role="alert" className="inline-error settings-error">
                {error}
              </p>
            )}
            <fieldset className="settings-fields" disabled={!ready}>
              {section === "general" && (
                <>
                  <h2 className="settings-section-title">{t("Appearance")}</h2>
                  <div
                    className="theme-choices"
                    role="radiogroup"
                    aria-label={t("Appearance")}
                  >
                    {(
                      [
                        ["system", "Match the system", Monitor],
                        ["light", "Light", Sun],
                        ["dark", "Dark", Moon],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        role="radio"
                        aria-checked={theme === id}
                        className="theme-choice"
                        onClick={() => chooseTheme(id)}
                      >
                        <ThemePreview kind={id} />
                        <span className="theme-choice-label">
                          <Icon size={16} aria-hidden="true" />
                          {t(label)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="settings-rows">
                    <Row
                      icon={Languages}
                      title={t("Language")}
                      description={t(
                        "Words in the interface. Your own titles stay as you wrote them.",
                      )}
                    >
                      <select
                        aria-label={t("Language")}
                        value={preferences.locale}
                        onChange={(event) =>
                          change(
                            {
                              ...latest.current,
                              locale: event.target
                                .value as Preferences["locale"],
                            },
                            true,
                          )
                        }
                      >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </Row>
                  </div>
                </>
              )}
              {section === "scenes" && (
                <div className="settings-rows">
                  <Row
                    icon={Timer}
                    title={t("Photo length")}
                    description={t("How long each new photo stays on screen.")}
                  >
                    {number(
                      t("Default photo duration"),
                      preferences.defaults.photoSeconds,
                      0.25,
                      120,
                      0.25,
                      (photoSeconds) => defaults({ photoSeconds }),
                      t("s"),
                    )}
                  </Row>
                  <Row
                    icon={Crop}
                    title={t("Photo framing")}
                    description={t(
                      "Fill the frame, or show the whole photo with bars.",
                    )}
                  >
                    <select
                      aria-label={t("Default photo framing")}
                      value={preferences.defaults.fit}
                      onChange={(event) =>
                        defaults({
                          fit: event.target
                            .value as Preferences["defaults"]["fit"],
                        })
                      }
                    >
                      <option value="cover">{t("Fill frame")}</option>
                      <option value="contain">{t("Fit whole image")}</option>
                    </select>
                  </Row>
                  <Row
                    icon={Blend}
                    title={t("Join")}
                    description={t("How one new scene turns into the next.")}
                  >
                    <select
                      aria-label={t("Default transition")}
                      value={preferences.defaults.transition}
                      onChange={(event) =>
                        defaults({
                          transition: event.target
                            .value as Preferences["defaults"]["transition"],
                        })
                      }
                    >
                      {TRANSITION_CHOICES.map(([id, title]) => (
                        <option key={id} value={id}>
                          {t(title)}
                        </option>
                      ))}
                    </select>
                  </Row>
                  <Row
                    icon={Timer}
                    title={t("Join length")}
                    description={t("Zero makes a straight cut.")}
                  >
                    {number(
                      t("Default transition duration"),
                      preferences.defaults.transitionSeconds,
                      0,
                      5,
                      0.1,
                      (transitionSeconds) => defaults({ transitionSeconds }),
                      t("s"),
                    )}
                  </Row>
                  <Row
                    icon={Type}
                    title={t("Title style")}
                    description={t("The look of words you add to a scene.")}
                  >
                    <select
                      aria-label={t("Default title style")}
                      value={preferences.defaults.titleStyle}
                      onChange={(event) =>
                        defaults({
                          titleStyle: event.target
                            .value as Preferences["defaults"]["titleStyle"],
                        })
                      }
                    >
                      <option value="classic">{t("Classic")}</option>
                      <option value="modern">{t("Modern")}</option>
                      <option value="minimal">{t("Minimal")}</option>
                    </select>
                  </Row>
                  <Row
                    icon={Palette}
                    title={t("Card background")}
                    description={t("The colour behind a new title card.")}
                  >
                    <input
                      aria-label={t("Default background")}
                      type="color"
                      value={preferences.defaults.background}
                      onChange={(event) =>
                        defaults({ background: event.target.value })
                      }
                    />
                  </Row>
                  <Row
                    icon={MonitorPlay}
                    title={t("Export size")}
                    description={t(
                      "What Export offers first. You can change it for each film.",
                    )}
                  >
                    <select
                      aria-label={t("Default export resolution")}
                      value={preferences.output.resolution}
                      onChange={(event) =>
                        change({
                          ...latest.current,
                          output: {
                            ...latest.current.output,
                            resolution: event.target
                              .value as Preferences["output"]["resolution"],
                          },
                        })
                      }
                    >
                      <option value="720p">{t("HD · 720p")}</option>
                      <option value="1080p">{t("Full HD · 1080p")}</option>
                      <option value="2160p">{t("4K · 2160p")}</option>
                    </select>
                  </Row>
                </div>
              )}
              {section === "timeline" && (
                <div className="settings-rows">
                  <Row
                    icon={GalleryHorizontalEnd}
                    title={t("Use proportional timeline")}
                    description={t(
                      "Scenes take room by their length instead of sitting as equal cards.",
                    )}
                  >
                    <label className="switch">
                      <input
                        type="checkbox"
                        aria-label={t("Use proportional timeline")}
                        checked={preferences.timeline}
                        onChange={(event) =>
                          change({
                            ...latest.current,
                            timeline: event.target.checked,
                          })
                        }
                      />
                    </label>
                  </Row>
                  <Row
                    icon={ZoomIn}
                    title={t("Timeline zoom")}
                    description={t("Pixels for each second of film.")}
                  >
                    {number(
                      t("Timeline zoom"),
                      preferences.timelineZoom,
                      4,
                      200,
                      1,
                      (timelineZoom) =>
                        change({ ...latest.current, timelineZoom }),
                    )}
                  </Row>
                  <Row
                    icon={Zap}
                    title={t("Prefer editing proxies when available")}
                    description={t(
                      "Plays smaller copies of large clips while you edit. Export always uses the originals.",
                    )}
                  >
                    <label className="switch">
                      <input
                        type="checkbox"
                        aria-label={t("Prefer editing proxies when available")}
                        checked={preferences.proxyEditing}
                        onChange={(event) =>
                          change({
                            ...latest.current,
                            proxyEditing: event.target.checked,
                          })
                        }
                      />
                    </label>
                  </Row>
                </div>
              )}
              {section === "downloads" && (
                <div className="settings-rows">
                  <Row
                    icon={HardDrive}
                    title={t("Local models")}
                    description={
                      modelsRemoved
                        ? t(
                            "Removed. Corto downloads them again if you use those tools.",
                          )
                        : t(
                            "Removes the models. Corto downloads them again the next time you use those tools.",
                          )
                    }
                  >
                    <button
                      className="button danger"
                      disabled={modelsRemoved}
                      onClick={() => {
                        void import("../models/cache")
                          .then((module) => module.clearModelFiles())
                          .then(() => setModelsRemoved(true))
                          .catch((failure) => setError(String(failure)));
                      }}
                    >
                      {t("Remove downloaded local models")}
                    </button>
                  </Row>
                </div>
              )}
              {section === "updates" && (
                <div className="settings-rows">
                  <Row
                    icon={RefreshCw}
                    title={t("Check for new releases when Corto opens")}
                    description={t(
                      "Checking contacts GitHub for public release information only.",
                    )}
                  >
                    <label className="switch">
                      <input
                        type="checkbox"
                        aria-label={t(
                          "Check for new releases when Corto opens",
                        )}
                        checked={preferences.checkUpdates}
                        onChange={(event) =>
                          change({
                            ...latest.current,
                            checkUpdates: event.target.checked,
                          })
                        }
                      />
                    </label>
                  </Row>
                  <Row
                    icon={LifeBuoy}
                    title={t("Check now")}
                    description={
                      !checked
                        ? t("See whether a newer version is published.")
                        : update
                          ? `${t("Version ")}${update.version}${t(" is available.")}${update.signed ? "" : ` ${t("This is an unsigned preview.")}`}`
                          : t("You are using the latest published version.")
                    }
                  >
                    {checked && update ? (
                      <a
                        className="button secondary"
                        href={update.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("Open release downloads")}
                      </a>
                    ) : (
                      <button
                        className="button secondary"
                        onClick={() => {
                          void platform
                            .checkForUpdate?.()
                            .then((value) => {
                              setUpdate(value);
                              setChecked(true);
                            })
                            .catch((failure) => setError(String(failure)));
                        }}
                      >
                        {t("Check for updates")}
                      </button>
                    )}
                  </Row>
                </div>
              )}
            </fieldset>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A number with its unit, committed on blur or Enter like the inspector's fields. */
function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  return (
    <span className="settings-number">
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (draft && Number.isFinite(next) && next >= min && next <= max) {
            // Leaving a field without changing it writes nothing.
            if (next !== value) onChange(next);
          } else setDraft(String(value));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {unit && <span aria-hidden="true">{unit}</span>}
    </span>
  );
}
