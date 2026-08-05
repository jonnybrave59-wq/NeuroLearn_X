import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

let initialized = false;

export function initializeNativeShell() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  CapacitorApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  }).catch(() => undefined);

  document.addEventListener("click", (event) => {
    const anchor = (event.target as Element | null)?.closest("a");
    if (!anchor?.href) return;
    const target = new URL(anchor.href, window.location.href);
    if (
      ["http:", "https:"].includes(target.protocol) &&
      target.origin !== window.location.origin
    ) {
      event.preventDefault();
      Browser.open({ url: target.toString(), presentationStyle: "popover" }).catch(
        () => window.open(target.toString(), "_blank", "noopener,noreferrer"),
      );
    }
  });
}
