// L6: the real shell. Playwright launches the built app (out/, from
// `npm run build`) with Electron itself and drives its first window.
// Everything here crosses the preload bridge and IPC to the main process,
// which no browser-mode test can do.
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { PlatformInfo } from "../../electron/bridge";

let app: ElectronApplication;
let win: Page;
let smokeWorkspace: string;
const consoleErrors: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  smokeWorkspace = await mkdtemp(join(tmpdir(), "corto-shell-smoke-"));
  app = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CORTO_E2E: "1",
      CORTO_WORKSPACE_ROOT: join(smokeWorkspace, "workspace"),
    },
  });
  win = await app.firstWindow();
  win.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await win.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app?.close();
  if (
    smokeWorkspace &&
    dirname(resolve(smokeWorkspace)) === resolve(tmpdir()) &&
    basename(smokeWorkspace).startsWith("corto-shell-smoke-")
  )
    await rm(smokeWorkspace, { recursive: true, force: true });
});

test.describe("corto in the real shell", () => {
  test("renders the main window with the native backend", async () => {
    // The title comes from index.html, so a renamed app is checked against its
    // own page, never a hard-coded string.
    const html = readFileSync("index.html", "utf8");
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1];
    expect(title).toBeTruthy();
    await expect(win).toHaveTitle(title!);
    await expect(win.getByTestId("editor-shell")).toHaveAttribute(
      "data-backend",
      "native",
    );
    await expect(
      win.getByRole("button", { name: "Import media", exact: true }),
    ).toBeVisible();
    // The badge proves the UI is talking to the main process, not the mock.
    await expect(win.getByTestId("save-status")).toHaveText("Saved");
    // contextIsolation and the sandbox: the page sees the bridge, not Node.
    const exposed = await win.evaluate(() => ({
      bridge: typeof window.electronBridge,
      require: typeof (window as unknown as { require?: unknown }).require,
      process: typeof (window as unknown as { process?: unknown }).process,
    }));
    expect(exposed).toEqual({
      bridge: "object",
      require: "undefined",
      process: "undefined",
    });
  });

  test("reports the platform from the main process and saves a screenshot named after it", async () => {
    // Ask the main process directly, then the same question through the bridge.
    const main = await app.evaluate(({ app: electronApp }) => ({
      os: process.platform,
      arch: process.arch,
      packaged: electronApp.isPackaged,
    }));
    expect(["win32", "darwin", "linux"]).toContain(main.os);
    expect(["x64", "arm64"]).toContain(main.arch);
    expect(main.packaged).toBe(false);

    const viaBridge = (await win.evaluate(() =>
      window.electronBridge!.platformInfo(),
    )) as PlatformInfo;
    expect(viaBridge).toMatchObject(main);
    await expect(win.getByTestId("editor-shell")).toHaveAttribute(
      "data-backend",
      "native",
    );

    // The page leaves room for the window controls this system really has:
    // what the preload reports must be the frame the main process built.
    const frame = { win32: "windows", darwin: "mac", linux: "system" }[
      main.os as "win32" | "darwin" | "linux"
    ];
    expect(await win.evaluate(() => window.electronBridge!.windowFrame)).toBe(
      frame,
    );
    await expect(win.getByTestId("editor-shell")).toHaveAttribute(
      "data-frame",
      frame,
    );

    // Renderer readiness alone does not prove the OS has shown the window.
    await expect
      .poll(() =>
        app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]?.isVisible() ?? false,
        ),
      )
      .toBe(true);
    const dir = join(process.cwd(), "artifacts", "e2e");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${main.os}-${main.arch}.png`);
    await win.screenshot({ path: file });
    if (main.os === "darwin") {
      // Page screenshots exclude the native title-bar controls. Capture just
      // Corto's WindowServer window so the traffic lights can be reviewed.
      const source = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].getMediaSourceId(),
      );
      const windowId = /^window:(\d+):/.exec(source)?.[1];
      if (!windowId) throw new Error(`Unrecognised window source: ${source}`);
      execFileSync("/usr/sbin/screencapture", [
        "-x",
        "-o",
        "-l",
        windowId,
        join(dir, `mac-window-${main.arch}.png`),
      ]);
    }
    console.log(`[e2e] screenshot saved: ${file}`);
  });

  test("the appearance channel changes the native theme and refuses anything but the three choices", async () => {
    const nativeSource = () =>
      app.evaluate(({ nativeTheme }) => nativeTheme.themeSource);
    await win.evaluate(() => window.electronBridge!.setNativeTheme!("dark"));
    expect(await nativeSource()).toBe("dark");
    for (const malformed of [null, 7, "Light", ["light"], { theme: "light" }]) {
      const outcome = await win.evaluate(
        (value) =>
          window.electronBridge!.setNativeTheme!(value as never).then(
            () => "accepted",
            (error: Error) => error.message,
          ),
        malformed,
      );
      expect(outcome, JSON.stringify(malformed)).toContain(
        "Unknown appearance",
      );
    }
    // A refused request changed nothing.
    expect(await nativeSource()).toBe("dark");
    await win.evaluate(() => window.electronBridge!.setNativeTheme!("system"));
    expect(await nativeSource()).toBe("system");
  });

  test("logged no console errors (CSP violations, failed loads)", async () => {
    expect(consoleErrors).toEqual([]);
  });
});
