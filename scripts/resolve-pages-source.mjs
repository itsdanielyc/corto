import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import {
  pagesReleaseSelection,
  parseReleaseList,
  parseReleaseMetadata,
  validatePagesSource,
} from "../contracts/distribution.ts";

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !process.env.GITHUB_EVENT_PATH || !process.env.GITHUB_OUTPUT)
  throw new Error(
    "Pages source resolution requires its GitHub workflow context",
  );
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const api = (path) =>
  JSON.parse(
    execFileSync("gh", ["api", `repos/${repository}/${path}`], {
      encoding: "utf8",
    }),
  );
const releases = parseReleaseList(api("releases?per_page=30"));
const selection = pagesReleaseSelection(event, repository, releases);
if (!selection.deploy) {
  await appendFile(process.env.GITHUB_OUTPUT, "deploy=false\n");
  console.log("A newer release is already published; public editor retained.");
} else {
  const release = parseReleaseMetadata(api(`releases/tags/${selection.tag}`));
  const commit = api(`commits/${selection.tag}`).sha;
  const source = validatePagesSource(selection, release, commit, repository);
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `deploy=true\nref=${source}\ntag=${selection.tag}\n`,
  );
  console.log(`Public editor source: ${selection.tag} (${source})`);
}
