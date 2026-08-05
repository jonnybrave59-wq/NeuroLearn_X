import {
  Download,
  LoaderCircle,
  QrCode,
  RefreshCw,
  ServerOff,
  Share2,
  ShieldAlert,
  WifiOff,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { diagnoseConnection } from "./api";
import {
  getConnectionState,
  subscribeConnection,
  type ConnectionKind,
} from "./connection";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

let pendingInstallPrompt: InstallPromptEvent | null = null;
const installSubscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pendingInstallPrompt = event as InstallPromptEvent;
    installSubscribers.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    pendingInstallPrompt = null;
    installSubscribers.forEach((listener) => listener());
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function supportsManualInstall() {
  const userAgent = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg\//i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isInstallableAndroidBrowser =
    isAndroid && /Chrome|CriOS|EdgA|SamsungBrowser/i.test(userAgent);
  const isDesktopChromium =
    !isAndroid && !isIOS && /Chrome|Chromium|Edg\//i.test(userAgent);
  const isDesktopSafari = /Macintosh/i.test(userAgent) && isSafari;
  return (isIOS && isSafari) || isInstallableAndroidBrowser || isDesktopChromium || isDesktopSafari;
}

export function useInstallApp() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const listener = () => refresh((value) => value + 1);
    const media = window.matchMedia("(display-mode: standalone)");
    installSubscribers.add(listener);
    media.addEventListener?.("change", listener);
    return () => {
      installSubscribers.delete(listener);
      media.removeEventListener?.("change", listener);
    };
  }, []);
  const installed = isStandalone();
  const canPrompt = Boolean(pendingInstallPrompt) && !installed;
  const supported = !installed && (canPrompt || supportsManualInstall());
  async function install() {
    if (!pendingInstallPrompt) return false;
    const prompt = pendingInstallPrompt;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") pendingInstallPrompt = null;
    installSubscribers.forEach((listener) => listener());
    return choice.outcome === "accepted";
  }
  return { canPrompt, installed, supported, install };
}

export function InstallButton({
  className = "btn-primary",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { canPrompt, installed, supported, install } = useInstallApp();
  const [showGuide, setShowGuide] = useState(false);
  if (installed || !supported) return null;

  async function beginInstall() {
    if (canPrompt) {
      await install();
      return;
    }
    setShowGuide(true);
  }

  return (
    <>
      <button type="button" onClick={beginInstall} className={className}>
        <Download size={17} />
        {compact ? "Install app" : "Install NeuroLearn-X"}
      </button>
      {showGuide && <InstallGuideDialog onClose={() => setShowGuide(false)} />}
    </>
  );
}

function InstallGuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 text-slate-800 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-cyanx-600">
              Install on this device
            </div>
            <h2 id="install-guide-title" className="mt-1 text-2xl font-black text-navy-950">
              Install NeuroLearn-X
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Close installation guide"
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
          <p>
            <strong className="text-navy-950">iPhone or iPad:</strong> open this
            page in Safari, tap Share, then choose Add to Home Screen.
          </p>
          <p>
            <strong className="text-navy-950">Android:</strong> open this page
            in Chrome, open the browser menu, then choose Install app or Add to
            Home screen.
          </p>
          <p>
            <strong className="text-navy-950">Windows:</strong> open this page
            in Chrome or Edge and select the install icon in the address bar or
            Install app from the browser menu.
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-primary mt-6 w-full">
          Got it
        </button>
      </section>
    </div>
  );
}

export function publicShareUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  const base = configured || `${window.location.origin}${window.location.pathname}`;
  try {
    const url = new URL(base, window.location.origin);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "/";
    return url.toString();
  } catch {
    return `${window.location.origin}/#/`;
  }
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function ShareButton({
  className = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white",
  label = "Share app",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Share2 size={18} />
        {label}
      </button>
      {open && <ShareDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareDialog({ onClose }: { onClose: () => void }) {
  const url = useMemo(publicShareUrl, []);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  const supportsNativeShare =
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  async function share() {
    setShareError("");
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: "NeuroLearn-X",
        text: "Open NeuroLearn-X: explainable adaptive learning.",
        url,
      });
    } catch (cause) {
      if ((cause as DOMException)?.name !== "AbortError") {
        setShareError("Sharing was unavailable. You can copy the public link instead.");
      }
    }
  }

  async function copy() {
    try {
      await copyText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError("Could not copy automatically. Select the link below.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-navy-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-800 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-cyanx-600">
              Public classroom link
            </div>
            <h2 id="share-title" className="mt-1 text-2xl font-black text-navy-950">
              Share NeuroLearn-X
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Close share dialog"
          >
            <X size={19} />
          </button>
        </div>
        <div className="mx-auto mt-6 w-fit rounded-2xl border border-slate-200 bg-white p-4">
          <QRCodeSVG
            value={url}
            size={210}
            level="M"
            marginSize={1}
            title="QR code for the public NeuroLearn-X application"
          />
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          This QR code contains only the public app URL. It never includes a
          password, session token, student ID, or private record.
        </p>
        <input
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600"
          readOnly
          value={url}
          aria-label="Public share link"
          onFocus={(event) => event.currentTarget.select()}
        />
        {shareError && <p className="mt-3 text-xs font-semibold text-red-700">{shareError}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={share} className="btn-primary">
            <Share2 size={17} />
            {supportsNativeShare ? "Share with device" : "Copy link"}
          </button>
          <button type="button" onClick={copy} className="btn-secondary">
            <QrCode size={17} />
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </section>
    </div>
  );
}

function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [connection, setConnection] = useState(getConnectionState);
  const [updateServiceWorker, setUpdater] = useState<((reload?: boolean) => Promise<void>) | null>(
    null,
  );
  useEffect(() => {
    const unsubscribe = subscribeConnection(setConnection);
    const updater = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    setUpdater(() => updater);
    return unsubscribe;
  }, []);
  if (connection.kind !== "online" || (!needRefresh && !offlineReady)) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-2xl border border-cyan-200 bg-white p-4 text-sm shadow-2xl">
      <div className="font-black text-navy-950">
        {needRefresh
          ? "A NeuroLearn-X update is ready."
          : "The NeuroLearn-X app shell is ready offline. Sign-in and research records still require internet."}
      </div>
      <div className="mt-3 flex gap-2">
        {needRefresh && (
          <button
            type="button"
            onClick={() => updateServiceWorker?.(true)}
            className="rounded-lg bg-navy-950 px-3 py-2 text-xs font-bold text-white"
          >
            Update now
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
          className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function ConnectionStatus() {
  const [connection, setConnection] = useState(getConnectionState);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeConnection(setConnection);
    const recheck = () => void diagnoseConnection({ force: true });
    window.addEventListener("online", recheck);
    window.addEventListener("offline", recheck);
    void diagnoseConnection();
    return () => {
      unsubscribe();
      window.removeEventListener("online", recheck);
      window.removeEventListener("offline", recheck);
    };
  }, []);

  if (connection.kind === "online") return null;

  const icons: Record<Exclude<ConnectionKind, "online">, React.ReactNode> = {
    loading: <LoaderCircle className="animate-spin" size={17} />,
    offline: <WifiOff size={17} />,
    "server-unavailable": <ServerOff size={17} />,
    "session-expired": <ShieldAlert size={17} />,
    "configuration-error": <ShieldAlert size={17} />,
  };

  async function retry() {
    setRetrying(true);
    try {
      const state = await diagnoseConnection({ showLoading: true, force: true });
      if (state.kind === "online") {
        window.dispatchEvent(new CustomEvent("neurolearnx-reconnected"));
      }
    } finally {
      setRetrying(false);
    }
  }

  const canRetry = connection.kind !== "loading" && connection.kind !== "session-expired";
  return (
    <aside
      className="fixed bottom-4 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-navy-950 shadow-2xl"
      role={connection.kind === "loading" ? "status" : "alert"}
      data-testid="connection-status"
    >
      <span className="shrink-0 text-cyan-700">
        {icons[connection.kind as Exclude<ConnectionKind, "online">]}
      </span>
      <span className="flex-1">{connection.message}</span>
      {canRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-navy-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          <RefreshCw className={retrying ? "animate-spin" : ""} size={14} />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
      {connection.kind === "session-expired" && (
        <button
          type="button"
          onClick={() => {
            window.location.hash = "#/";
          }}
          className="shrink-0 rounded-xl bg-navy-950 px-3 py-2 text-xs font-bold text-white"
        >
          Sign in again
        </button>
      )}
    </aside>
  );
}

export function PwaChrome() {
  return (
    <>
      <ConnectionStatus />
      <UpdatePrompt />
    </>
  );
}

export { copyText };
