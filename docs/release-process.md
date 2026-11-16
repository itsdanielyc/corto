# Release process

Corto uses Keel's evidence gate. A release tag must not precede a green installers workflow for the same commit on main. The version comes from package.json. Desktop previews remain unsigned until a separately authorised signing setup is supplied.

1. Complete the release slices and commit the version/changelog.
2. Run CI, review the per-OS screenshots and run installers on the exact main commit.
3. Record run links in the append-only ledger. A metadata-only ledger commit still needs its own installer gate if it is the tagged commit.
4. Tag `v<version>` only after its gate is green. The release workflow verifies that evidence, rebuilds the bundles, performs their installer checks, and publishes a prerelease for 0.x versions.
5. Publish the web build from the same reviewed source through GitHub Pages.
6. Smoke-install published assets on fresh runners and append the resulting evidence.

The native installer smoke signal comes from the application renderer's real project request. It identifies the actual main-process PID and additionally proves the packaged FFmpeg executable can encode an MP4. Liveness alone is not enough.

The binary checksum manifest pins the actual FFmpeg release assets, independently of npm package integrity. Platform readmes and licenses ship beside the binary. Record actual engine versions rather than assuming the distribution tag is the FFmpeg version on every OS.
