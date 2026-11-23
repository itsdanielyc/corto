import { readFile } from "node:fs/promises";

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

/** Reject invalid text before it can become replacement characters in a later save. */
export function parseJsonBytes(bytes: Uint8Array): unknown {
  return JSON.parse(strictUtf8.decode(bytes));
}

/** Read local JSON metadata without altering its encoding or contents. */
export async function readJsonFile(path: string): Promise<unknown> {
  return parseJsonBytes(await readFile(path));
}
