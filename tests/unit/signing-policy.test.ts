import { expect, it } from "vitest";
it("never labels absent credentials as signed and rejects incomplete Mac notarization", async () => {
  const path = "../../scripts/signing-policy.mjs";
  const { signingPolicy } = await import(path);
  expect(signingPolicy("darwin", {})).toBe("unsigned-preview");
  expect(signingPolicy("win32", {})).toBe("unsigned-preview");
  expect(() => signingPolicy("darwin", { CSC_LINK: "configured" })).toThrow(
    "notarization",
  );
  expect(
    signingPolicy("darwin", {
      CSC_LINK: "configured",
      APPLE_ID: "configured",
      APPLE_APP_SPECIFIC_PASSWORD: "configured",
      APPLE_TEAM_ID: "configured",
    }),
  ).toBe("mac-signed-notarized");
  expect(signingPolicy("win32", { WIN_CSC_LINK: "configured" })).toBe(
    "windows-signed",
  );
});
