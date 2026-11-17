export interface ColourLut {
  size: number;
  data: Float32Array;
  minimum: [number, number, number];
  maximum: [number, number, number];
}

// Time O(cube entries), space O(cube entries); at most 65³ RGB entries and 4 MB of text.
/** Parse the common .cube 3D format with finite, bounded metadata and exact entry counts. */
export function parseColourLut(text: string): ColourLut {
  if (text.length > 4 * 1024 ** 2)
    throw new Error("Choose a .cube look smaller than 4 MB");
  let size = 0;
  let minimum: [number, number, number] = [0, 0, 0];
  let maximum: [number, number, number] = [1, 1, 1];
  const entries: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line || line.startsWith("TITLE ")) continue;
    const [kind, ...values] = line.split(/\s+/);
    if (kind === "LUT_3D_SIZE") {
      size = Number(values[0]);
      if (
        !Number.isInteger(size) ||
        size < 2 ||
        size > 65 ||
        values.length !== 1
      )
        throw new Error("Choose a 3D cube between 2 and 65 samples per side");
      continue;
    }
    if (kind === "DOMAIN_MIN" || kind === "DOMAIN_MAX") {
      const numbers = values.map(Number);
      if (
        numbers.length !== 3 ||
        numbers.some((value) => !Number.isFinite(value))
      )
        throw new Error("The look's colour domain is invalid");
      if (kind === "DOMAIN_MIN") minimum = numbers as typeof minimum;
      else maximum = numbers as typeof maximum;
      continue;
    }
    const numbers = [kind, ...values].map(Number);
    if (
      !size ||
      numbers.length !== 3 ||
      numbers.some(
        (value) => !Number.isFinite(value) || value < -4 || value > 4,
      )
    )
      throw new Error("This is not a supported 3D .cube look");
    entries.push(...numbers);
  }
  if (
    !size ||
    entries.length !== size ** 3 * 3 ||
    minimum.some((value, index) => value >= maximum[index])
  )
    throw new Error("The look's sample count or domain is incomplete");
  return { size, data: new Float32Array(entries), minimum, maximum };
}
