export const VERSION_TAG = /^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
export interface ReleaseMetadata {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Release metadata is incomplete");
  return value as Record<string, unknown>;
}

/** This zero-dependency boundary can run before installing a released application's dependencies. */
export function parseReleaseMetadata(input: unknown): ReleaseMetadata {
  const value = object(input);
  if (
    typeof value.tag_name !== "string" ||
    !VERSION_TAG.test(value.tag_name) ||
    typeof value.draft !== "boolean" ||
    typeof value.prerelease !== "boolean" ||
    (value.published_at !== null &&
      (typeof value.published_at !== "string" ||
        !Number.isFinite(Date.parse(value.published_at)))) ||
    typeof value.html_url !== "string"
  )
    throw new Error("The release feed contains invalid metadata");
  return {
    tag_name: value.tag_name,
    draft: value.draft,
    prerelease: value.prerelease,
    published_at: value.published_at,
    html_url: value.html_url,
  };
}
export function parseReleaseList(input: unknown): ReleaseMetadata[] {
  if (!Array.isArray(input) || input.length > 100)
    throw new Error("The release feed is invalid");
  return input.map(parseReleaseMetadata);
}

/** Only a published, matching release may automatically replace the public editor. */
export function pagesReleaseSelection(
  event: unknown,
  repository: string,
  releases: readonly ReleaseMetadata[],
): { tag: string; expectedCommit: string | null; deploy: boolean } {
  if (!event || typeof event !== "object")
    throw new Error("The deployment event is incomplete");
  const published = releases
    .filter((release) => !release.draft && release.published_at)
    .sort((a, b) => b.published_at!.localeCompare(a.published_at!));
  const latest = published[0];
  if (!latest) throw new Error("There is no published release to deploy");
  if ("workflow_run" in event) {
    const run = object(event.workflow_run);
    if (
      run.name !== "release" ||
      run.event !== "push" ||
      run.conclusion !== "success" ||
      object(run.head_repository).full_name !== repository ||
      typeof run.head_branch !== "string" ||
      !VERSION_TAG.test(run.head_branch) ||
      typeof run.head_sha !== "string" ||
      !COMMIT_SHA.test(run.head_sha)
    )
      throw new Error(
        "Only this repository's successful tagged release can deploy automatically",
      );
    return {
      tag: run.head_branch,
      expectedCommit: run.head_sha,
      deploy: run.head_branch === latest.tag_name,
    };
  }
  const inputs = "inputs" in event && event.inputs ? object(event.inputs) : {};
  const tag = inputs.release_tag || latest.tag_name;
  if (typeof tag !== "string" || !VERSION_TAG.test(tag))
    throw new Error("Choose a published version tag");
  return { tag, expectedCommit: null, deploy: true };
}

/** A successful workflow alone is insufficient: the tag and release must agree on source. */
export function validatePagesSource(
  selection: { tag: string; expectedCommit: string | null },
  release: ReleaseMetadata,
  commit: unknown,
  repository: string,
): string {
  if (typeof commit !== "string" || !COMMIT_SHA.test(commit))
    throw new Error("The release commit is invalid");
  const sha = commit;
  if (
    release.draft ||
    !release.published_at ||
    release.tag_name !== selection.tag ||
    release.html_url !==
      `https://github.com/${repository}/releases/tag/${selection.tag}`
  )
    throw new Error(
      "The requested source is not a published release from this repository",
    );
  if (selection.expectedCommit && selection.expectedCommit !== sha)
    throw new Error(
      "The released tag does not match the verified workflow source",
    );
  return sha;
}
