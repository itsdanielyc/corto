import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LIMITS, parseProject, type Project } from "../contracts/project";
import { hasFileErrorCode, writeAtomic } from "./atomic-file";
import { parseJsonBytes } from "./json-file";
import { UNREADABLE_WORKING_COPY_MESSAGE } from "../src/domain/catalogue";

type WorkingCopy =
  | { kind: "missing" }
  | { kind: "protected"; reason: string }
  | { kind: "readable"; bytes: Uint8Array; project: Project };

/** A damaged or newer working copy stays in place while other films can be saved in Films. */
export async function readWorkingCopy(path: string): Promise<WorkingCopy> {
  let bytes: Uint8Array;
  try {
    if ((await stat(path)).size > LIMITS.manifestBytes)
      return {
        kind: "protected",
        reason:
          "The saved project is too large to read safely. Open another film from Films.",
      };
    bytes = await readFile(path);
  } catch (error) {
    if (hasFileErrorCode(error, "ENOENT")) return { kind: "missing" };
    throw error;
  }
  try {
    return {
      kind: "readable",
      bytes,
      project: parseProject(parseJsonBytes(bytes)),
    };
  } catch {
    return { kind: "protected", reason: UNREADABLE_WORKING_COPY_MESSAGE };
  }
}

/** Only rotate a validated working copy into the recovery file. Both replacements are atomic. */
export async function activateWorkingCopy(
  directory: string,
  path: string,
  project: Project,
): Promise<void> {
  const current = await readWorkingCopy(path);
  if (current.kind === "protected") return;
  if (current.kind === "readable") {
    await writeAtomic(join(directory, "previous.json"), (temporary) =>
      writeFile(temporary, current.bytes, { flag: "wx", mode: 0o600 }),
    );
  }
  await writeAtomic(path, (temporary) =>
    writeFile(temporary, JSON.stringify(project), { flag: "wx", mode: 0o600 }),
  );
}
