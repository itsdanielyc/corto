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

async function openRecorder(page: import("@playwright/test").Page) {
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
  await openRecorder(page);
  await page
    .getByRole("button", { name: "Record narration", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /Recording · 1s/ }),
  ).toBeVisible({ timeout: 10000 });
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
