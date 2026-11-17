import { z } from "zod";
const entrySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["music", "effect"]),
  file: z.string().regex(/^(music|effect)-\d{2}\.mp3$/),
});
/** Read an original packaged sound using a catalogue-owned filename, never a user URL. */
export async function bundledSoundFile(id: string): Promise<File> {
  const base = `${import.meta.env.BASE_URL}sounds/`;
  const catalogue = await fetch(`${base}index.json`);
  if (!catalogue.ok) throw new Error("The bundled sound library is missing");
  const entries = z
    .array(entrySchema)
    .max(100)
    .parse(await catalogue.json());
  const entry = entries.find((entry) => entry.id === id);
  if (!entry) throw new Error("This bundled sound could not be found");
  const response = await fetch(`${base}${entry.file}`);
  if (!response.ok) throw new Error("This bundled sound could not be read");
  return new File([await response.blob()], `${entry.title} · Corto CC0.mp3`, {
    type: "audio/mpeg",
  });
}
