/** Decide whether a release can claim signing; absent credentials produce an explicitly unsigned preview. */
export function signingPolicy(platform, environment) {
  if (platform === "darwin") {
    const certificate = Boolean(environment.CSC_LINK);
    const notary = [
      environment.APPLE_ID,
      environment.APPLE_APP_SPECIFIC_PASSWORD,
      environment.APPLE_TEAM_ID,
    ];
    if (certificate && !notary.every(Boolean))
      throw new Error(
        "Mac signing requires APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID for notarization",
      );
    if (!certificate && notary.some(Boolean))
      throw new Error(
        "Notarization credentials require a Developer ID certificate in MAC_CSC_LINK",
      );
    return certificate ? "mac-signed-notarized" : "unsigned-preview";
  }
  return platform === "win32" &&
    (environment.WIN_CSC_LINK || environment.CSC_LINK)
    ? "windows-signed"
    : "unsigned-preview";
}
