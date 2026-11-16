# Installing Corto previews

Download from [the official releases](https://github.com/itsdanielyc/corto/releases) and compare the file's SHA-256 with the release's `SHA256SUMS.txt`.

These preview builds are unsigned and are not notarized. Signing is not configured and no signing credentials are embedded. The build and installer evidence is in [VERIFICATION.md](../VERIFICATION.md).

## Windows x64

Run the NSIS setup executable. It installs for your user account and appears in the Start menu; remove it through Windows Settings → Apps.

SmartScreen can display “Windows protected your PC” because the publisher is unrecognized. Managed devices or Smart App Control may block unsigned applications completely. Use the web version if your device policy does not permit the preview. [Microsoft explains these warnings and signing options](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation).

## macOS

Choose the Apple Silicon (`arm64`) or Intel (`x64`) DMG for your Mac, mount it and drag Corto to Applications.

Gatekeeper can report that Apple cannot check the app for malicious software or that the developer cannot be verified. If you trust the official release and its checksum, Apple's documented exception process is System Settings → Privacy & Security → Open Anyway after the first attempted launch. Do not disable system-wide protections. [Apple's instructions](https://support.apple.com/en-us/102445).

## Linux x64

Use the DEB on Ubuntu/Debian, or the portable AppImage:

```sh
sudo apt install ./Corto-*.deb
chmod +x Corto-*.AppImage
./Corto-*.AppImage
```

On systems without FUSE, the AppImage runtime supports `--appimage-extract-and-run`. Use a normal desktop user session with a display and the operating system's sandbox support. Other distributions and architectures are not claimed as verified by this preview.

## Web

Open [Corto in the browser](https://itsdanielyc.github.io/corto/). No account is required. After the first successful load and offline-cache installation, the application and bundled example are available offline in compatible browsers. Personal media stays in local browser storage.

Browser export runs in real time; keep the tab visible. The export window reports the actual available MP4 or WebM format. Desktop MP4 export uses the bundled native encoder and can run independently of the preview.

## Keeping your projects

The application autosaves one working copy on the current device. Use **Project actions → Save portable copy** to preserve a transferable `.corto` file containing the edit and original media. Browser storage can be cleared by the browser or operating system; a portable copy is the backup to keep.

Source media is immutable. Locally cached copies can remain for recovery after a working copy is replaced; application caches can consume additional disk space. Your original imported files and portable projects remain under your control.

## Signing later

Apple Developer ID signing/notarization requires an Apple Developer membership with an annual fee and credentials in GitHub secrets. Windows distribution needs an appropriate signing service or certificate; eligible open-source projects may qualify for a signing programme. These are future operator decisions. See [Microsoft's signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) and the release workflow documentation before configuring them.
