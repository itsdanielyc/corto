import { spawn } from "node:child_process";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this installer with npm run setup");
// Only the browser ONNX backend is used. Its transitive Node/CUDA payload is unnecessary.
const child = spawn(process.execPath, [npm, "ci"], {
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, ONNXRUNTIME_NODE_INSTALL: "skip" },
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
