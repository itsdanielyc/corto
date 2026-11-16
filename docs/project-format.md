# Portable Corto projects, version 1

`.corto` is an uncompressed, self-contained binary container. Original media is already compressed, so an outer ZIP would waste compute and complicate safe, bounded-memory extraction.

The file starts with eight ASCII bytes `CORTO001`. A four-byte unsigned little-endian integer follows: the UTF-8 JSON manifest length. The manifest is a schema-version-1 Project. Its assets are sorted lexicographically by opaque asset ID; each original file follows in that order with exactly the byte length declared in its asset metadata. No paths, external URLs, executable commands or compression instructions are stored.

Readers validate the signature, bounded manifest length, complete runtime schema, asset IDs, scene references and exact expected container length before importing media. Duplicate IDs, truncated data, trailing data, unsupported schema versions and impossible trim bounds are errors. A failed import leaves the previously open project intact. Unused assets are allowed so the media library remains available after scenes are removed.

Desktop reads/writes stream media through temporary sibling files and replace the destination only after success. Browser readers use `File.slice` and store Blobs in IndexedDB. A project can move between operating systems without relinking source paths. Media is never modified by an edit.

Autosave is separate: the current manifest and immutable originals are stored locally. A portable copy is the user's transferable backup, not a requirement for editing. Browser storage can be cleared by the browser or operating system; the editor recommends keeping a portable copy.
