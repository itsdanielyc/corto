import type { UpdateInformation } from "../../contracts/services";
import { z } from "zod";

const RELEASE_API = "https://api.github.com/repos/itsdanielyc/corto/releases";
const CHANNEL_ERROR =
  "The release information did not match Corto's public release channel";
const releaseSchema = z.object({
  tag_name: z.string().regex(/^v\d+\.\d+\.\d+$/),
  html_url: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});
function compareVersion(
  first: readonly number[],
  second: readonly number[],
): number {
  for (let index = 0; index < 3; index++)
    if (first[index] !== second[index]) return first[index] - second[index];
  return 0;
}
// Time O(releases), space O(releases) for the bounded public response; only the best candidate is retained.
/** Preview builds follow published previews; established builds follow stable releases. Downloads remain explicit. */
export async function checkPublishedUpdate(
  version: string,
): Promise<UpdateInformation | null> {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("The current Corto version is invalid");
  const current = version.split(".").map(Number);
  const preview = current[0] === 0;
  const response = await fetch(
    `${RELEASE_API}${preview ? "?per_page=20" : "/latest"}`,
    {
      headers: { Accept: "application/vnd.github+json" },
    },
  );
  if (!response.ok)
    throw new Error("Release information is unavailable. Try again later.");
  const data: unknown = await response.json();
  const parsed = z
    .array(releaseSchema)
    .max(100)
    .safeParse(preview ? data : [data]);
  if (!parsed.success) throw new Error(CHANNEL_ERROR);
  let best = current;
  let update: UpdateInformation | null = null;
  for (const release of parsed.data) {
    if (release.draft) continue;
    if (
      (!preview && release.prerelease) ||
      release.html_url !==
        `https://github.com/itsdanielyc/corto/releases/tag/${release.tag_name}`
    )
      throw new Error(CHANNEL_ERROR);
    const parts = release.tag_name.slice(1).split(".").map(Number);
    if (compareVersion(parts, best) <= 0) continue;
    best = parts;
    update = {
      version: release.tag_name.slice(1),
      url: release.html_url,
      signed: false,
    };
  }
  return update;
}
