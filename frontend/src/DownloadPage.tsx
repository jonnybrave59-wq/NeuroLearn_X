import {
  Apple,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "./components";
import { copyText, InstallButton, publicShareUrl } from "./pwa";

const VERSION = "1.3.0";
const RELEASE_DATE = "August 5, 2026";

export default function DownloadPage() {
  const url = useMemo(publicShareUrl, []);
  const [copied, setCopied] = useState(false);
  const sourceAvailable = import.meta.env.VITE_SOURCE_AVAILABLE === "true";
  const apkAvailable = import.meta.env.VITE_APK_AVAILABLE === "true";
  const windowsPackageAvailable =
    import.meta.env.VITE_WINDOWS_PACKAGE_AVAILABLE === "true";

  async function copy() {
    await copyText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-[#f3f7fa] text-slate-800">
      <header className="bg-navy-950 px-5 py-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Brand />
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
            <ArrowLeft size={17} /> Back to app
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid items-center gap-9 lg:grid-cols-[1fr_0.72fr]">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
              Version {VERSION} · Released {RELEASE_DATE}
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-navy-950 sm:text-5xl">
              Download NeuroLearn-X
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Install the secure web app on Android, Windows, or iPhone, or open
              it directly in a modern browser. The same public link is safe to
              share with classrooms, researchers, and panel members.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <InstallButton className="btn-primary" />
              <Link to="/" className="btn-secondary">
                <ExternalLink size={17} /> Open Web App
              </Link>
              <button type="button" onClick={copy} className="btn-secondary">
                <Copy size={17} /> {copied ? "Link copied" : "Copy Share Link"}
              </button>
              {sourceAvailable ? (
                <a
                  href="/release/NeuroLearn-X-Source-Code.zip"
                  className="btn-secondary"
                  download
                >
                  <Download size={17} /> Download Source Code
                </a>
              ) : (
                <button
                  type="button"
                  className="btn-secondary cursor-not-allowed opacity-55"
                  disabled
                  title="The verified source archive is not published in this deployment."
                >
                  <Download size={17} /> Source ZIP not published
                </button>
              )}
              {windowsPackageAvailable ? (
                <a
                  href="/release/NeuroLearn-X-Shareable.zip"
                  className="btn-secondary"
                  download
                >
                  <Download size={17} /> Download Windows ZIP
                </a>
              ) : (
                <button
                  type="button"
                  className="btn-secondary cursor-not-allowed opacity-55"
                  disabled
                  title="The Windows ZIP requires the final HTTPS deployment URL."
                >
                  <Download size={17} /> Windows ZIP awaiting deployment
                </button>
              )}
              {apkAvailable ? (
                <a href="/release/NeuroLearn-X.apk" className="btn-secondary" download>
                  <Download size={17} /> Download Android APK
                </a>
              ) : (
                <button
                  type="button"
                  className="btn-secondary cursor-not-allowed opacity-55"
                  disabled
                  title="No locally verified APK is included in this release."
                >
                  <Download size={17} /> APK not included
                </button>
              )}
            </div>
            {(!sourceAvailable || !apkAvailable || !windowsPackageAvailable) && (
              <p className="mt-3 text-xs text-slate-500">
                Disabled packages are never placeholders. Their buttons activate
                only after genuine, validated artifacts are built and published.
              </p>
            )}
          </div>
          <div className="mx-auto rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl">
            <QRCodeSVG
              value={url}
              size={230}
              level="M"
              marginSize={1}
              title="QR code for NeuroLearn-X"
            />
            <div className="mt-3 text-xs font-bold text-slate-500">Scan to open the public app</div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <InstallCard
            icon={<Smartphone size={23} />}
            title="Android"
            steps={[
              "Open this page in Chrome.",
              "Tap Install NeuroLearn-X, or Chrome menu → Install app.",
              "Open it from your home screen.",
            ]}
          />
          <InstallCard
            icon={<Laptop size={23} />}
            title="Windows"
            steps={[
              "Open this page in Chrome or Edge.",
              "Select the install icon in the address bar.",
              "Choose Install and optionally pin the app.",
            ]}
          />
          <InstallCard
            icon={<Apple size={23} />}
            title="iPhone / iPad"
            steps={[
              "Open this page in Safari.",
              "Tap Share, then Add to Home Screen.",
              "Confirm Add and open the new icon.",
            ]}
          />
        </div>

        <section className="mt-8 rounded-3xl bg-navy-950 p-6 text-white sm:p-8">
          <div className="flex gap-4">
            <ShieldCheck className="mt-0.5 shrink-0 text-cyanx-400" size={25} />
            <div>
              <h2 className="text-xl font-black">Short privacy notice</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Shared links and QR codes contain only the public application
                address. They do not contain passwords, authentication tokens,
                participant codes, student IDs, mastery records, or other private
                learner information. On shared devices, sign out after use and
                remove locally cached site data when the study session ends.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function InstallCard({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyanx-100 text-cyan-900">
        {icon}
      </span>
      <h2 className="mt-5 text-xl font-black text-navy-950">{title}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-1 shrink-0 text-cyanx-600" size={16} />
            <span>
              <strong>{index + 1}.</strong> {step}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
