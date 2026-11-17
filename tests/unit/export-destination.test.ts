import { expect, it } from "vitest";
import { ExportDestinations } from "../../electron/export-destinations";
import { createProject } from "../../src/domain/project";
it("binds an opaque, one-use destination to the immutable film and expires abandoned choices", () => {
  let now = 0;
  const destinations = new ExportDestinations(() => now);
  const project = createProject("Family");
  const token = destinations.issue(project, "private-output.mp4");
  expect(token).not.toContain("private-output");
  expect(() =>
    destinations.take(token, { ...project, name: "Other edit" }),
  ).toThrow("exact export");
  expect(destinations.take(token, project)).toBe("private-output.mp4");
  expect(() => destinations.take(token, project)).toThrow();
  const stale = destinations.issue(project, "stale.mp4");
  now = 24 * 60 * 60 * 1000;
  expect(() => destinations.take(stale, project)).toThrow();
});
