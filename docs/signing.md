# Signing and release identities

`npm run package` uses `scripts/signing-policy.mjs`. With no signing credentials
it produces an **unsigned preview**. It does not invent a publisher identity or
claim Gatekeeper/SmartScreen trust.

The installer workflow accepts these optional repository secrets:

| Target | Secrets |
|---|---|
| Windows | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` (the code-signing PFX and its password) |
| macOS | `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` (Developer ID certificate/P12); `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization |

Use electron-builder's supported certificate URL/base64 formats. The workflow
maps the Mac certificate to `CSC_LINK`; passwords and account credentials stay
in the runner environment. No certificate material belongs in Git. The release
workflow inherits these secrets into its reusable installer workflow.

Configured Windows signing enables `forceCodeSigning`. Configured Mac signing
also requires complete notarization credentials, enables `forceCodeSigning`
and uses electron-builder's built-in notarytool integration. Incomplete Mac
configuration fails before packaging. Actual certificate/chain/notarization
proof requires a credentialed build; policy unit checks do not establish trust.

On 2026-11-17, the repository had no signing secrets and this machine had no
current-user code-signing certificate. Trusted signing therefore remains an
external prerequisite. No certificate or paid account was purchased.

Updates use the public stable release channel at
`itsdanielyc/corto/releases`. Checks are opt-in and read only public metadata;
the app links to downloads rather than silently executing an installer.
Releases include SHA-256 checksums. Installer and published-asset smoke checks
remain required on every declared desktop target before distribution claims.
