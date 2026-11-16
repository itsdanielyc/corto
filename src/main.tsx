import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource/dm-serif-display/latin-400.css";
import { App } from "./App";
import "./editor.css";

const root = document.getElementById("root");
if (!root) throw new Error("Corto could not find its application root");
createRoot(root).render(<App />);

if (
  import.meta.env.PROD &&
  !window.electronBridge &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) =>
        console.info("Offline app caching is unavailable", error),
      );
  });
}
