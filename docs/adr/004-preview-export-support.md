<!-- keel:start -->
# ADR 004: Shipping export support for 0.1.0
Status: accepted. Date: 2026-11-16.

Native MP4 is the release path on Windows, macOS and Linux. The full native editing/save/reopen/export journey and packaged encoder checks have passed on the four declared desktop variants.

Browser MP4 is offered where its H.264/AAC recorder is available. Browsers without that format can edit, autosave and exchange self-contained portable projects; the export dialog directs them to the desktop app and offers a portable copy.

Experimental WebM remains disabled in production. Linux Chromium has produced complete audio but a truncated video tail, despite valid duration metadata, keyframe-only seek cues, explicit frame requests and a visible capture surface. A closing-caption pixel assertion catches the defect. It is tracked in [issue 8](https://github.com/itsdanielyc/corto/issues/8).

Ruling: defer this additional browser codec rather than ship partial movies. The required three-system desktop product remains fully functional. Keep the WebM tests and source; run them in the advisory workflow with `VITE_CORTO_EXPERIMENTAL_WEBM=1`. Re-enable only after real video, captions, duration and mixed audio repeatedly pass on intended platforms. No assertions are widened and no retries are added below L6.
<!-- keel:end -->
