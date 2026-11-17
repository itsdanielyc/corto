# Portable Corto containers, version 1

`.corto` is an uncompressed, self-contained binary container. Original media is already compressed, so an outer ZIP would waste compute and complicate safe, bounded-memory extraction.

The file starts with eight ASCII bytes `CORTO001`. A four-byte unsigned little-endian integer follows: the UTF-8 JSON manifest length. The manifest carries an independent project-schema version: v0.1.2 writes schema 3 and explicitly migrates the strict known schema 1/2 shapes. Its assets are sorted lexicographically by opaque asset ID; each media file follows in that order with exactly the byte length declared in its asset metadata. No paths, external URLs, executable commands or compression instructions are stored.

Readers validate the signature, bounded manifest length, complete runtime schema, asset IDs, scene references and exact expected container length before importing media. Duplicate IDs, truncated data, trailing data, unsupported schema versions and impossible trim bounds are errors. A failed import leaves the previously open project intact. Unused assets are allowed so the media library remains available after scenes are removed.

Desktop reads/writes stream media through temporary sibling files and replace the destination only after success. Browser readers use `File.slice` and store Blobs in IndexedDB. A project can move between operating systems without relinking source paths. Media is never modified by an edit.

Autosave is separate: the current manifest and immutable originals are stored locally. A portable copy is the user's transferable backup, not a requirement for editing. Browser storage can be cleared by the browser or operating system; the editor recommends keeping a portable copy.

Schema 2 adds placed audio, non-overlapping subtitle cues and music ducking. Compatible phone PNG/H.264 assets reference archived originals via `originalAssetId`; both sets of bytes are included. Portable imports receive new film and media identities so they cannot overwrite an existing local film. Opening a newer schema in an older Corto is unsupported and must fail rather than dropping edits.

Schema 3 normalises legacy music into canonical placed sounds and adds explicit scene transforms, timed text/layers, colour/LUT references, transitions, markers, output settings and project defaults. Original/proxy/LUT references are validated and carried in the same container. Media remains immutable; derived cut-outs/compatibility/proxy assets receive their own identities. The manifest limit is 16 MB; projects allow 1,000 scenes, 2,500 assets, three hours, 8 GB per asset and 64 GB total media.
