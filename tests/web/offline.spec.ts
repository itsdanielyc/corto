import { test, expect } from "@playwright/test";

test("the production web app caches its shell and can build an example film entirely offline", async ({
  page,
  context,
}) => {
  page.on("requestfailed", (request) =>
    console.log("Offline request failed:", request.url(), request.failure()),
  );
  page.on("pageerror", (error) =>
    console.log("Offline page error:", error.message),
  );
  await page.goto("/");
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "web",
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("editor-shell")).toHaveAttribute(
    "data-backend",
    "web",
  );
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(page.getByTestId("scene-card")).toHaveCount(4);
  await expect(page.getByTestId("preview-status")).toHaveText("Ready");
  await expect(page.getByTestId("save-status")).toHaveText(
    "Saved on this device",
  );
  expect(await page.getByRole("alert").count()).toBe(0);
});
