import { spawn } from "node:child_process";
import { z } from "zod";
import { identifierSchema, parseProject, type Project } from "../contracts/project";
import type { FileProjectRepository } from "./storage";
import { tempoFilters } from "./movie-filters";

const SAMPLE_RATE = 16000;
const MAX_SECONDS = 32;
const requestSchema = z.strictObject({ assetId: identifierSchema, start: z.number().finite().min(0), duration: z.number().finite().positive().max(MAX_SECONDS), speed: z.number().finite().min(0.25).max(4), preservePitch: z.boolean() });

/** Decode at most 32 seconds of local mono speech; model work never loads a whole long film into RAM. */
export async function nativeAudioSamples(binary: string, repository: FileProjectRepository, input: Project, request: unknown): Promise<Float32Array> {
  const project = parseProject(input); const options = requestSchema.parse(request); const asset = project.assets[options.assetId];
  if (!asset || !["audio", "video"].includes(asset.kind) || options.start >= asset.duration) throw new Error("Choose a valid source audio interval");
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(binary, ["-hide_banner", "-loglevel", "error", "-nostdin", "-ss", String(options.start), "-t", String(options.duration * options.speed), "-protocol_whitelist", "file,pipe", "-i", repository.assetPath(asset.id), "-vn", "-af", ["aresample=48000", ...tempoFilters(options.speed, options.preservePitch), `apad,atrim=duration=${options.duration}`].join(","), "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "pipe:1"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = []; let size = 0; let diagnostic = ""; let exceeded = false;
    const deadline = setTimeout(() => child.kill(), 60000);
    child.stdout.on("data", (chunk: Buffer) => { size += chunk.length; if (size > SAMPLE_RATE * (MAX_SECONDS + 1) * 4) { exceeded = true; child.kill(); } else chunks.push(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { diagnostic = (diagnostic + chunk.toString()).slice(-4000); });
    child.once("error", error => { clearTimeout(deadline); reject(error); });
    child.once("close", code => { clearTimeout(deadline); if (code !== 0 || exceeded || !size) reject(new Error(`The local audio sample could not be decoded: ${diagnostic || "sample budget exceeded"}`)); else resolve(Buffer.concat(chunks)); });
  });
  const samples = new Float32Array(bytes.length / 4); for (let index = 0; index < samples.length; index++) samples[index] = bytes.readFloatLE(index * 4); return samples;
}
