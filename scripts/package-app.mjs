import { build } from "electron-builder";
import { signingPolicy } from "./signing-policy.mjs";
const policy = signingPolicy(process.platform, process.env);
/** @type {import("electron-builder").Configuration} */
const config = {
  extends: "./electron-builder.yml",
  forceCodeSigning: policy !== "unsigned-preview",
};
if (process.platform === "darwin") {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY =
    policy === "unsigned-preview" ? "false" : "true";
  config.mac =
    policy === "unsigned-preview" ? { identity: null } : { notarize: true };
}
console.log(`Corto packaging policy: ${policy}`);
await build({ config, publish: "never" });
