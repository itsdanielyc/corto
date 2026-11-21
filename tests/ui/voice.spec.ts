import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});

/** The recorder counts 3-2-1 before it records, so the first words are not cut off. */
const COUNTDOWN_MS = 3000;

type Page = import("@playwright/test").Page;

/** Remembers every microphone stream the page is given, to check it is released. */
async function watchMicrophone(page: Page) {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    (
      window as unknown as { microphoneStreams: MediaStream[] }
    ).microphoneStreams = streams;
    const request = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await request(constraints);
      streams.push(stream);
      return stream;
    };
  });
}
const microphoneTracks = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { microphoneStreams: MediaStream[] }
    ).microphoneStreams.flatMap((stream) =>
      stream.getTracks().map((track) => track.readyState),
    ),
  );

async function openRecorder(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add title card", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Sound & narration", exact: true })
    .click();
}

test("a real microphone stream records portable narration and is released when stopped", async ({
  page,
}) => {
  await watchMicrophone(page);
  await openRecorder(page);
  await page
    .getByRole("button", { name: "Record narration", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Recording starts after the countdown" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop and add narration", exact: true }),
  ).toHaveCount(0);
  // One recorded second arrives a second after the countdown, beyond the default wait.
  await expect(
    page.getByRole("status").filter({ hasText: /Recording · 1s/ }),
  ).toBeVisible({ timeout: COUNTDOWN_MS + 5000 });
  await page
    .getByRole("button", { name: "Stop and add narration", exact: true })
    .click();
  await expect(page.getByLabel("Sound 1 role")).toHaveValue("voiceover");
  expect(
    Number(await page.getByLabel("Sound 1 duration").inputValue()),
  ).toBeGreaterThan(0.8);
  await expect(
    page.getByRole("button", { name: "Record narration", exact: true }),
  ).toBeEnabled();
  expect(await microphoneTracks(page)).toEqual(["ended"]);
});

test("cancelling during the countdown releases the microphone and never starts recording", async ({
  page,
}) => {
  await watchMicrophone(page);
  await openRecorder(page);
  await page
    .getByRole("button", { name: "Record narration", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Recording starts after the countdown" }),
  ).toBeVisible();
  await page
    .locator(".recorder-status")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Record narration", exact: true }),
  ).toBeEnabled();
  expect(await microphoneTracks(page)).toEqual(["ended"]);
  // Outlast the countdown: a cancelled one must not start recording afterwards.
  await page.waitForTimeout(COUNTDOWN_MS + 500);
  await expect(
    page.getByRole("button", { name: "Stop and add narration", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Sound 1 role")).toHaveCount(0);
});

test("declined microphone access reports the recovery path without adding a sound", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("No permission", "NotAllowedError"));
  });
  await openRecorder(page);
  await page
    .getByRole("button", { name: "Record narration", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Microphone access was declined",
  );
  await expect(page.getByLabel("Sound 1 role")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record narration", exact: true }),
  ).toBeEnabled();
});

test("a recorder that cannot start after the countdown releases the microphone", async ({
  page,
}) => {
  await watchMicrophone(page);
  await openRecorder(page);
  await page.evaluate(() => {
    MediaRecorder.prototype.start = () => {
      throw new DOMException("Recorder unavailable", "NotSupportedError");
    };
  });
  await page.getByRole("button", { name: "Record narration" }).click();
  await expect(page.getByRole("alert")).toContainText("Recorder unavailable", {
    timeout: COUNTDOWN_MS + 5000,
  });
  expect(await microphoneTracks(page)).toEqual(["ended"]);
  await expect(
    page.getByRole("button", { name: "Record narration" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Sound 1 role")).toHaveCount(0);
});
