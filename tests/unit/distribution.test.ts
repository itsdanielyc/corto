import { describe, expect, it } from "vitest";
import {
  pagesReleaseSelection,
  validatePagesSource,
  type ReleaseMetadata,
} from "../../contracts/distribution";
const repository = "itsdanielyc/corto";
const sha = "a".repeat(40);
const release: ReleaseMetadata = {
  tag_name: "v0.1.1",
  draft: false,
  prerelease: true,
  published_at: "2026-11-16T11:00:00Z",
  html_url: `https://github.com/${repository}/releases/tag/v0.1.1`,
};
const event = {
  workflow_run: {
    name: "release",
    event: "push",
    conclusion: "success",
    head_branch: "v0.1.1",
    head_sha: sha,
    head_repository: { full_name: repository },
  },
};
describe("released web source policy", () => {
  it("deploys matching published sources and allows an explicit published rollback", () => {
    const selection = pagesReleaseSelection(event, repository, [release]);
    expect(validatePagesSource(selection, release, sha, repository)).toBe(sha);
    expect(
      pagesReleaseSelection({ inputs: { release_tag: "v0.1.1" } }, repository, [
        release,
      ]).tag,
    ).toBe("v0.1.1");
  });
  it("rejects CI/PR/fork sources, unverified commits and drafts", () => {
    expect(() =>
      pagesReleaseSelection(
        { workflow_run: { ...event.workflow_run, name: "ci" } },
        repository,
        [release],
      ),
    ).toThrow();
    expect(() =>
      pagesReleaseSelection(
        { workflow_run: { ...event.workflow_run, event: "pull_request" } },
        repository,
        [release],
      ),
    ).toThrow();
    expect(() =>
      pagesReleaseSelection(
        {
          workflow_run: {
            ...event.workflow_run,
            head_repository: { full_name: "another/repo" },
          },
        },
        repository,
        [release],
      ),
    ).toThrow();
    expect(() =>
      validatePagesSource(
        { tag: release.tag_name, expectedCommit: sha },
        release,
        "b".repeat(40),
        repository,
      ),
    ).toThrow();
    expect(() =>
      validatePagesSource(
        { tag: release.tag_name, expectedCommit: null },
        { ...release, draft: true },
        sha,
        repository,
      ),
    ).toThrow();
  });
  it("does not roll back automatically when an older release workflow is rerun", () => {
    const newer = {
      ...release,
      tag_name: "v0.1.2",
      published_at: "2026-11-17T00:00:00Z",
      html_url: `https://github.com/${repository}/releases/tag/v0.1.2`,
    };
    expect(
      pagesReleaseSelection(event, repository, [release, newer]).deploy,
    ).toBe(false);
  });
});
