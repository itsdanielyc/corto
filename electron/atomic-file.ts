import { open, rename, rm } from "node:fs/promises";

/** Replace a destination only after the complete sibling temporary file has reached disk. */
export async function writeAtomic(
  destination: string,
  write: (temporary: string) => Promise<void>,
): Promise<void> {
  const temporary = `${destination}.corto-${crypto.randomUUID()}.tmp`;
  try {
    await write(temporary);
    const handle = await open(temporary, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Classify Node I/O errors without assuming every thrown value is an Error. */
export function hasFileErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
