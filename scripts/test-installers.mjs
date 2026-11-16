import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const windows = process.platform === "win32";
const executable = windows ? "pwsh" : "bash";
const script = resolve(
  "scripts",
  windows ? "installer-test.ps1" : "installer-test.sh",
);
const arguments_ = windows ? ["-NoProfile", "-File", script] : [script];
const result = spawnSync(executable, arguments_, {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
