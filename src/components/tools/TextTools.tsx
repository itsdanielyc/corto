import { applicationLocale, useT } from "../../i18n/locale";
import { useState } from "react";
import { textItemSchema } from "../../../contracts/creative";
import type { Scene, TextItem } from "../../../contracts/project";
import { Choice, Colour, Numeric, Slider, Toggle, ToolSection } from "./Fields";
const TEMPLATES = {
  heading: {
    label: "Heading",
    text: "A little life.",
    font: "serif",
    size: 0.11,
    y: 0.45,
  },
  subtitle: {
    label: "Subtitle",
    text: "A moment worth keeping",
    font: "sans",
    size: 0.045,
    y: 0.64,
  },
  lower: {
    label: "Lower third",
    text: "Place · Date",
    font: "sans",
    size: 0.05,
    y: 0.82,
    boxOpacity: 0.65,
  },
  corner: {
    label: "Corner label",
    text: "SUMMER 2026",
    font: "mono",
    size: 0.035,
    x: 0.2,
    y: 0.12,
    width: 0.3,
  },
  quote: {
    label: "Quote",
    text: "“The best days are the ones we share.”",
    font: "serif",
    size: 0.075,
  },
  credits: {
    label: "Rolling credits",
    text: "Made with love\n\nOur family\nOur friends\n\nThank you for the memories",
    font: "sans",
    size: 0.06,
    animation: "credits",
  },
  birthday: {
    label: "Birthday greeting",
    text: "Happy birthday!",
    font: "rounded",
    size: 0.1,
    animation: "pop",
  },
  dedication: {
    label: "Dedication",
    text: "In loving memory\nForever in our hearts",
    font: "serif",
    size: 0.075,
    animation: "fade",
  },
  date: {
    label: "Date stamp",
    text: "17 NOVEMBER 2026",
    font: "mono",
    size: 0.035,
    y: 0.88,
  },
} as const;
export function TextTools({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (changes: Partial<Scene>) => void;
}) {
  const t = useT();
  const [selectedId, setSelectedId] = useState(scene.textItems[0]?.id ?? "");
  const item =
    scene.textItems.find((candidate) => candidate.id === selectedId) ??
    scene.textItems[0];
  const update = (changes: Partial<TextItem>) => {
    if (item)
      onChange({
        textItems: scene.textItems.map((candidate) =>
          candidate.id === item.id ? { ...item, ...changes } : candidate,
        ),
      });
  };
  const add = (template: keyof typeof TEMPLATES) => {
    const { label: _label, ...settings } = TEMPLATES[template];
    const next = textItemSchema.parse({
      id: crypto.randomUUID(),
      ...settings,
      text:
        template === "date"
          ? new Date().toLocaleDateString(applicationLocale(), {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : t(settings.text),
    });
    onChange({ textItems: [...scene.textItems, next] });
    setSelectedId(next.id);
  };
  return (
    <>
      <ToolSection title={t("Add a text item")}>
        <div className="template-buttons">
          {Object.entries(TEMPLATES).map(([id, template]) => (
            <button
              className="button secondary"
              disabled={scene.textItems.length >= 24}
              key={id}
              onClick={() => add(id as keyof typeof TEMPLATES)}
            >
              {t(template.label)}
            </button>
          ))}
        </div>
      </ToolSection>
      {item && (
        <>
          <ToolSection title={t("Words & timing")}>
            <Choice
              label={t("Text item")}
              translateOptions={false}
              value={item.id}
              options={scene.textItems.map((text, index) => [
                text.id,
                `${index + 1}. ${text.text.slice(0, 32) || "Empty text"}`,
              ])}
              onChange={setSelectedId}
            />
            <label className="field-label">
              {t("Text")}
              <textarea
                aria-label={t("Text item words")}
                rows={5}
                maxLength={8000}
                value={item.text}
                onChange={(event) => update({ text: event.target.value })}
              />
            </label>
            <Numeric
              label={t("Text starts (seconds)")}
              value={item.start}
              max={(item.end ?? scene.duration) - 0.01}
              onChange={(start) => update({ start })}
            />
            <Numeric
              label={t("Text ends (seconds)")}
              value={item.end ?? scene.duration}
              min={item.start + 0.01}
              max={scene.duration}
              onChange={(end) => update({ end })}
            />
          </ToolSection>
          <ToolSection title={t("Typography")}>
            <Choice
              label={t("Font")}
              value={item.font}
              options={[
                ["serif", "DM Serif Display"],
                ["sans", "Manrope"],
                ["mono", "Monospace"],
                ["rounded", "Rounded"],
              ]}
              onChange={(font) => update({ font })}
            />
            <Slider
              label={t("Text size")}
              value={item.size}
              min={0.01}
              max={0.4}
              onChange={(size) => update({ size })}
            />
            <Toggle
              label={t("Bold")}
              checked={item.bold}
              onChange={(bold) => update({ bold })}
            />
            <Toggle
              label={t("Italic")}
              checked={item.italic}
              onChange={(italic) => update({ italic })}
            />
            <Colour
              label={t("Text colour")}
              value={item.colour}
              onChange={(colour) => update({ colour })}
            />
            <Choice
              label={t("Text alignment")}
              value={item.align}
              options={[
                ["left", "Left"],
                ["center", "Centre"],
                ["right", "Right"],
              ]}
              onChange={(align) => update({ align })}
            />
            <Colour
              label={t("Outline colour")}
              value={item.outline}
              onChange={(outline) => update({ outline })}
            />
            <Slider
              label={t("Outline width")}
              value={item.outlineWidth}
              max={0.02}
              step={0.001}
              onChange={(outlineWidth) => update({ outlineWidth })}
            />
            <Toggle
              label={t("Text shadow")}
              checked={item.shadow}
              onChange={(shadow) => update({ shadow })}
            />
            <Colour
              label={t("Text box colour")}
              value={item.boxColour}
              onChange={(boxColour) => update({ boxColour })}
            />
            <Slider
              label={t("Text box opacity")}
              value={item.boxOpacity}
              onChange={(boxOpacity) => update({ boxOpacity })}
            />
          </ToolSection>
          <ToolSection title={t("Placement & animation")}>
            <Slider
              label={t("Text X position")}
              value={item.x}
              onChange={(x) => update({ x })}
            />
            <Slider
              label={t("Text Y position")}
              value={item.y}
              onChange={(y) => update({ y })}
            />
            <Slider
              label={t("Text width")}
              value={item.width}
              min={0.1}
              max={1}
              onChange={(width) => update({ width })}
            />
            <Choice
              label={t("Text animation")}
              value={item.animation}
              options={[
                ["none", "Still"],
                ["fade", "Fade"],
                ["slide", "Slide"],
                ["typewriter", "Typewriter"],
                ["pop", "Pop"],
                ["credits", "Rolling credits"],
              ]}
              onChange={(animation) => update({ animation })}
            />
            {!["none", "credits"].includes(item.animation) && (
              <Numeric
                label={t("Text animation duration")}
                value={item.animationSeconds}
                min={0.1}
                max={10}
                onChange={(animationSeconds) => update({ animationSeconds })}
              />
            )}
            <button
              className="text-button"
              onClick={() =>
                onChange({
                  textItems: scene.textItems.filter(
                    (candidate) => candidate.id !== item.id,
                  ),
                })
              }
            >
              {t("Remove this text item")}
            </button>
          </ToolSection>
        </>
      )}
    </>
  );
}
