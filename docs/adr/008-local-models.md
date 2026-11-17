# ADR 008: optional bounded local models

Status: accepted, cross-platform verification in progress.

Automatic captions use quantised Whisper Tiny, pinned to
`ff4177021cc41f7db950912b73ea4fdf7d01d8e7`. Speech comes from small local windows,
with narration prioritised over clip sound; music-only tracks are excluded.
One worker retains its inference session across a long film's windows.

Photo matting uses U²-Net Small (Apache 2.0), a 320px model with a 4,574,861-byte
weight file. Its SHA-256 is
`309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`, matching the
upstream rembg-distributed weights. The CORS mirror is revision-pinned at
`nfa04/u2netp-onnx@8e72726f035efc3d1918c96b020d536f2b69ba0c` and verified before
inference. The larger BiRefNet Lite trial exceeded WASM memory at 1024px; it is
not an end-user download or dependency.

The UI explains the download before the user invokes either feature. Model
requests allow only GET/HEAD against the pinned public model data; source media
is passed directly to the worker. Runtime code/WASM is bundled locally, and
model data uses a separate Blob-backed IndexedDB cache that also works in the
isolated desktop renderer. Clearing models leaves projects and original media
alone. Cancellation terminates the worker and outstanding downloads.

Local evidence includes real speech recognition, a second load with remote
model requests blocked, and a real foreground alpha matte on a local plant
illustration. Native/hosted evidence is required before platform claims.

Sources: [Whisper weights](https://huggingface.co/onnx-community/whisper-tiny),
[U²-Net upstream](https://github.com/xuebinqin/U-2-Net),
[rembg session](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py),
[pinned mirror](https://huggingface.co/nfa04/u2netp-onnx/tree/8e72726f035efc3d1918c96b020d536f2b69ba0c).
