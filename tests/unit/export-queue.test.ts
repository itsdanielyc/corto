import { expect, it } from "vitest";
import { ExportQueue } from "../../src/export/queue";
import { createProject } from "../../src/domain/project";
import type { MovieRequest, MovieResult } from "../../contracts/platform";

const result: MovieResult = {
  fileName: "family.mp4",
  format: "MP4",
  location: "file",
};
it("captures an immutable film, serialises exports and cancels a queued job before it reaches the renderer", async () => {
  const received: MovieRequest[] = [];
  const finish: ((result: MovieResult) => void)[] = [];
  let disposed = 0;
  const queue = new ExportQueue(
    async (request) => {
      received.push(request);
      return new Promise((resolve) => finish.push(resolve));
    },
    async () => {
      disposed++;
    },
  );
  const request: MovieRequest = {
    project: createProject("First cut"),
    resolution: "720p",
    overlays: [],
  };
  const first = queue.render(
    request,
    () => undefined,
    new AbortController().signal,
  );
  request.project.name = "Edited while exporting";
  const second = queue.render(
    { ...request, project: createProject("Second cut") },
    () => undefined,
    new AbortController().signal,
  );
  const rejected = expect(second).rejects.toThrow("cancelled");
  expect(received).toHaveLength(1);
  expect(received[0].project.name).toBe("First cut");
  queue.cancel(queue.getSnapshot()[1].id);
  finish[0](result);
  await first;
  await rejected;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(received).toHaveLength(1);
  expect(disposed).toBe(2);
  expect(queue.getSnapshot().map((job) => job.status)).toEqual([
    "done",
    "cancelled",
  ]);
});
it("reports a real renderer failure and advances the next job", async () => {
  let calls = 0;
  const queue = new ExportQueue(async () => {
    if (++calls === 1) throw new Error("Disk full");
    return result;
  });
  const request: MovieRequest = {
    project: createProject(),
    resolution: "720p",
    overlays: [],
  };
  const first = queue.render(
    request,
    () => undefined,
    new AbortController().signal,
  );
  const second = queue.render(
    request,
    () => undefined,
    new AbortController().signal,
  );
  await expect(first).rejects.toThrow("Disk full");
  await expect(second).resolves.toEqual(result);
});
