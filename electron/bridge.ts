import type { NativeBridge, PlatformDetails } from "../contracts/platform";

/** The preload exposes the canonical platform contract, without Node or raw IPC. */
export type ElectronBridge = NativeBridge;
export type PlatformInfo = PlatformDetails;
export const channels = { platformInfo: "app:platform-info" } as const;
