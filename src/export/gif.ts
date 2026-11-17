/** Two passes avoid buffering a whole film while palette generation waits for its final frame. */
export function gifPaletteArguments(
  input: string,
  palette: string,
  quality: number,
): string[] {
  const colours = quality < 35 ? 64 : quality < 70 ? 128 : 256;
  return [
    "-i",
    input,
    "-vf",
    `${GIF_SOURCE},palettegen=max_colors=${colours}`,
    "-frames:v",
    "1",
    "-threads",
    "1",
    palette,
  ];
}
export function gifMovieArguments(
  input: string,
  palette: string,
  output: string,
): string[] {
  return [
    "-i",
    input,
    "-i",
    palette,
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    `[0:v]${GIF_SOURCE}[picture];[picture][1:v]paletteuse=dither=sierra2_4a`,
    "-an",
    "-loop",
    "0",
    output,
  ];
}
const GIF_SOURCE =
  "fps=15,scale=w='if(gte(iw,ih),min(960,iw),-2)':h='if(gte(ih,iw),min(960,ih),-2)':flags=lanczos";
