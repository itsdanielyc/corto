import type { UpdateInformation } from "../../contracts/services";

const RELEASE_API =
  "https://api.github.com/repos/itsdanielyc/corto/releases/latest";
/** Compare stable public releases; never install unsigned code or accept a foreign download URL. */
export async function checkPublishedUpdate(
  version: string,
): Promise<UpdateInformation | null> {
  const response = await fetch(RELEASE_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok)
    throw new Error("Release information is unavailable. Try again later.");
  const release = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
    draft?: boolean;
    prerelease?: boolean;
  };
  if (
    release.draft ||
    release.prerelease ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag_name ?? "") ||
    release.html_url !==
      `https://github.com/itsdanielyc/corto/releases/tag/${release.tag_name}`
  )
    throw new Error(
      "The release information did not match Corto's public release channel",
    );
  const parts = release.tag_name!.slice(1).split(".").map(Number);
  const current = version.split(".").map(Number);
  const difference = parts.findIndex((part, index) => part !== current[index]);
  if (difference < 0 || parts[difference] <= current[difference]) return null;
  return {
    version: release.tag_name!.slice(1),
    url: release.html_url!,
    signed: false,
  };
}
