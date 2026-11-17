import type { NativeBridge } from "../contracts/platform";

declare global {
  interface Window {
    electronBridge?: NativeBridge;
  }
}
