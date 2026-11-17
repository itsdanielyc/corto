import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import ffmpeg from "ffmpeg-static";

// Cold model downloads and real CPU inference have a separate three-minute budget; ordinary UI timeouts are unchanged.
test("Whisper uses real local speech, then reopens the pinned cached model with remote model requests blocked", async ({
  page,
  context,
}, info) => {
  const source = await fetch(
    "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav",
  );
  expect(source.ok).toBe(true);
  const path = info.outputPath("public-speech.wav");
  await writeFile(path, Buffer.from(await source.arrayBuffer()));
  const bytes = execFileSync(
    ffmpeg!,
    [
      "-loglevel",
      "error",
      "-i",
      path,
      "-t",
      "8",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "f32le",
      "pipe:1",
    ],
    { windowsHide: true },
  );
  const samples = [
    ...new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  ];
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/");
  const recognise = () =>
    page.evaluate(async (samples) => {
      const path = "/src/models/client.ts";
      const { runLocalModel } = await import(path);
      const result = await runLocalModel(
        { kind: "speech", samples: new Float32Array(samples), language: "en" },
        new AbortController().signal,
        (progress: { message: string; fraction: number | null }) =>
          console.log("MODEL_PROGRESS", progress.message, progress.fraction),
      );
      return result.chunks
        .map((chunk: { text: string }) => chunk.text)
        .join(" ");
    }, samples);
  const first = await recognise();
  expect(first.toLowerCase()).toContain("americans");
  await context.route("https://huggingface.co/**", (route) => route.abort());
  const cached = await recognise();
  expect(cached).toBe(first);
  expect(writes).toEqual([]);
});

test("U2Net Small computes a real foreground alpha matte from a local plant illustration", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#eeeae4";
    context.fillRect(0, 0, 512, 512);
    context.fillStyle = "#bfc0b4";
    context.beginPath();
    context.ellipse(256, 430, 128, 22, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#356237";
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(256, 370);
    context.lineTo(256, 130);
    context.stroke();
    for (let index = 0; index < 6; index++) {
      const side = index % 2 ? 1 : -1;
      context.save();
      context.translate(256 + side * 50, 160 + index * 29);
      context.rotate(side * 0.6);
      context.fillStyle = index % 2 ? "#3e7b43" : "#5b964e";
      context.beginPath();
      context.ellipse(0, 0, 67, 25, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.fillStyle = "#ad6549";
    context.beginPath();
    context.moveTo(175, 330);
    context.lineTo(337, 330);
    context.lineTo(315, 430);
    context.lineTo(197, 430);
    context.closePath();
    context.fill();
    context.fillStyle = "#cb8964";
    context.fillRect(168, 320, 176, 25);
    const image = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!), "image/png"),
    );
    const path = "/src/models/client.ts";
    const { runLocalModel } = await import(path);
    const result = await runLocalModel(
      { kind: "background", image },
      new AbortController().signal,
      () => {},
    );
    const bitmap = await createImageBitmap(result.image);
    context.clearRect(0, 0, 512, 512);
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, 512, 512).data;
    return {
      corner: pixels[3],
      pot: pixels[(380 * 512 + 256) * 4 + 3],
      transparent: Array.from(
        { length: 512 * 512 },
        (_, index) => pixels[index * 4 + 3],
      ).filter((alpha) => alpha < 30).length,
    };
  });
  expect(result.corner).toBeLessThan(30);
  expect(result.pot).toBeGreaterThan(200);
  expect(result.transparent).toBeGreaterThan(512 * 512 * 0.3);
});
