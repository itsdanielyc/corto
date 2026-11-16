# Third-party notices

Corto application code is MIT-licensed; the original Corto/miille identity remains subject to its owners' trademark rights. Open-source dependencies retain their licenses. Electron includes Chromium and Node.js with their respective license notices in the application bundle.

## FFmpeg
The desktop application executes a separate, unmodified FFmpeg binary. This product uses FFmpeg; FFmpeg is not affiliated with or endorsing Corto.

Binary distribution: `ffmpeg-static` 5.3.0, immutable binary release [b6.1.1](https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1), accessed 2026-11-16. The npm package is GPL-3.0-or-later. Individual platform binary license and build configuration files are shipped beside the executable under `resources/ffmpeg`.

- [Distribution source and download/build scripts](https://github.com/eugeneware/ffmpeg-static/tree/24504b7d549c0400e099720b3d5854577693a63a)
- [FFmpeg source releases](https://ffmpeg.org/releases/)
- [FFmpeg license information](https://ffmpeg.org/legal.html)

The distribution tag is not a uniform FFmpeg version across operating systems. The upstream platform README identifies each source/build and optional libraries: Windows builds by Gyan, Linux builds by John Van Sickle, macOS Intel builds by evermeet and Apple Silicon builds by OSXExperts. The upstream README and LICENSE files are included unchanged. Source/build information for those distributors is linked from the immutable ffmpeg-static source above. The exact binary checksums are committed in `scripts/ffmpeg-binaries.json`, checked before execution during installation, and shipped as `resources/ffmpeg/SHA256-provenance.json`. The install logs print the actual binary version. Release source information names the matching upstream versions and source locations.

## Interface dependencies
- React / React DOM: MIT, Meta and contributors.
- Zod: MIT, Colin McDonnell and contributors.
- Lucide icons: ISC, Lucide contributors.
- Manrope: SIL Open Font License 1.1, Mikhail Sharanda and contributors.
- DM Serif Display: SIL Open Font License 1.1, Colophon Foundry.
- Fontsource packages retain the upstream font licenses.

## Example media
See `public/demo/CREDITS.md` and the acknowledgements in About Corto. The example photographs use the Unsplash License. The original synthesized example music and synthetic test media are CC0. No third-party audio recording or musical sample is included.
