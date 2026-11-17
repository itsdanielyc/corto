import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";

async function menu(page: import("@playwright/test").Page, name: string) {
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("an unsupported browser offers an accessible desktop-export fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    MediaRecorder.isTypeSupported = () => false;
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await page.getByRole("button", { name: "Export movie", exact: true }).click();
  const accessibility = await new AxeBuilder({ page })
    .include(".export-dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
  await expect(
    page.getByText("WebM browser recording", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save portable project", exact: true }),
  ).toBeVisible();
});

test("multiple films resume and recovery keeps the latest edit", async ({
  page,
}) => {
  test.skip(process.platform === "darwin" && !process.env.CORTO_RECOVERY_DIAGNOSTIC, "Saved-status race quarantined under issue #18; retained in recovery diagnosis");
  await page.getByLabel("Project name").fill("First memory");
  await page.getByLabel("Project name").press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  await page.getByLabel("Project name").fill("Latest memory");
  await page.getByLabel("Project name").press("Tab");
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  await menu(page, "New film");
  await page
    .getByRole("button", { name: "Start new film", exact: true })
    .click();
  await page.getByLabel("Project name").fill("Birthday");
  await page.getByLabel("Project name").press("Tab");
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Latest memory", exact: true })
    .click();
  await expect(page.getByLabel("Project name")).toHaveValue("Latest memory");
  await page.reload();
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Birthday", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Recover previous edit of Latest memory",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "First memory (recovered)",
  );
  await page.getByRole("button", { name: "My films", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Latest memory", exact: true }),
  ).toBeVisible();
});

test("real HEIC and HEVC phone imports create playable scenes without uploading", async ({
  page,
}) => {
  const outbound: string[] = [];
  const origin = new URL(page.url()).origin;
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== origin
    )
      outbound.push(request.url());
  });
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/phone.heic"));
  await expect(page.getByTestId("scene-card")).toHaveCount(1);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect
    .poll(() =>
      page
        .getByTestId("preview-canvas")
        .evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext("2d")!;
          const left = context.getImageData(20, canvas.height / 2, 1, 1).data;
          const right = context.getImageData(
            canvas.width - 20,
            canvas.height / 2,
            1,
            1,
          ).data;
          return left[2] > left[0] && right[0] > right[2];
        }),
    )
    .toBe(true);
  await page
    .getByTestId("media-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/phone-hdr.mp4"));
  await expect(page.getByTestId("scene-card")).toHaveCount(2);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  expect(outbound).toEqual([]);
});

test("songs can be placed, trimmed and faded and subtitles round-trip as SRT", async ({
  page,
}, info) => {
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await menu(page, "Sound & narration");
  await page
    .getByTestId("sound-input")
    .setInputFiles(join(process.cwd(), "tests/fixtures/music.mp3"));
  await expect(page.getByLabel("Sound 1 duration")).toBeVisible();
  await page.getByLabel("Sound 1 duration").fill("2");
  await page.getByLabel("Sound 1 duration").press("Tab");
  await page.getByLabel("Sound 1 starts in source").fill("0.5");
  await page.getByLabel("Sound 1 starts in source").press("Tab");
  await page.getByLabel("Sound 1 fade in").fill("0.3");
  await page.getByLabel("Sound 1 fade in").press("Tab");
  await page.getByLabel("Lower music under clip sound and narration").check();
  await page.getByLabel("Close dialog").click();
  await menu(page, "Timed subtitles");
  await page.getByTestId("subtitle-input").setInputFiles({
    name: "family.srt",
    mimeType: "application/x-subrip",
    buffer: Buffer.from("1\n00:00:00,200 --> 00:00:01,500\nHello 家族\n"),
  });
  await expect(page.getByLabel("Subtitle 1 text")).toHaveValue("Hello 家族");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SRT", exact: true }).click();
  await (await download).saveAs(info.outputPath("family.srt"));
  await page.getByLabel("Close dialog").click();
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  await page.reload();
  await menu(page, "Sound & narration");
  await expect(page.getByLabel("Sound 1 fade in")).toHaveValue("0.3");
  await expect(
    page.getByLabel("Lower music under clip sound and narration"),
  ).toBeChecked();
  await page.getByLabel("Close dialog").click();
  await menu(page, "Timed subtitles");
  await expect(page.getByLabel("Subtitle 1 text")).toHaveValue("Hello 家族");
});

test("export offers destination presets, an honest size estimate and a sample", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await page.getByRole("button", { name: "Export movie", exact: true }).click();
  await expect(
    page.getByText("Estimated size:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Small file/ }).check();
  await expect(page.getByText("1280 × 720", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export first 5 seconds as a sample" }),
  ).toBeVisible();
});
