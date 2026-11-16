import { execFileSync } from "node:child_process";
import { appendFile, readFile, writeFile } from "node:fs/promises";

const repository = process.env.GITHUB_REPOSITORY;
const tag = process.env.GITHUB_REF_NAME;
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const manifest = JSON.parse(await readFile("package.json", "utf8"));
if (!repository || tag !== `v${manifest.version}`)
  throw new Error("The release tag must exactly match package.json");
const response = JSON.parse(
  execFileSync(
    "gh",
    [
      "api",
      `repos/${repository}/actions/workflows/installers.yml/runs?head_sha=${commit}&status=success&per_page=100`,
    ],
    { encoding: "utf8" },
  ),
);
const proven = response.workflow_runs.find(
  (run) =>
    run.head_sha === commit &&
    run.head_branch === "main" &&
    run.conclusion === "success",
);
if (!proven)
  throw new Error(
    `Release blocked: no successful installers workflow on main for ${commit}`,
  );
await writeFile(
  "release-gate.json",
  JSON.stringify(
    { repository, tag, commit, installerRun: proven.html_url },
    null,
    2,
  ) + "\n",
);
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `installer_url=${proven.html_url}\n`,
  );
console.log(`Installer gate proven: ${proven.html_url}`);
