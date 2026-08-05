import type { ReactNode } from "react";
import { AlertCircle, BrainCircuit, LoaderCircle, X } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyanx-500 text-navy-950 shadow-lg shadow-cyan-900/20">
        <BrainCircuit size={23} aria-hidden="true" />
      </span>
      {!compact && (
        <div>
          <div className="text-lg font-extrabold tracking-tight text-current">
            NeuroLearn<span className="text-cyanx-500">-X</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
            Explainable adaptive learning
          </div>
        </div>
      )}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center text-slate-500" role="status">
      <div className="flex items-center gap-3">
        <LoaderCircle className="animate-spin text-cyanx-600" size={20} />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

export function ErrorNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
      role="alert"
    >
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          className="rounded p-0.5 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <BrainCircuit size={21} />
      </div>
      <h3 className="font-bold text-navy-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyanx-600">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-black tracking-tight text-navy-950 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "navy",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  tone?: "navy" | "cyan" | "amber" | "rose";
}) {
  const tones = {
    navy: "bg-navy-950 text-white",
    cyan: "bg-cyanx-100 text-navy-950",
    amber: "bg-amber-50 text-navy-950",
    rose: "bg-rose-50 text-navy-950",
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-soft ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${tone === "navy" ? "text-slate-300" : "text-slate-500"}`}>
            {label}
          </p>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
          {detail && (
            <p className={`mt-1 text-xs ${tone === "navy" ? "text-slate-300" : "text-slate-500"}`}>
              {detail}
            </p>
          )}
        </div>
        {icon && (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone === "navy" ? "bg-white/10 text-cyanx-400" : "bg-white text-cyanx-600"}`}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "cyan" | "navy";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    cyan: "bg-cyanx-100 text-cyan-800",
    navy: "bg-navy-950 text-white",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function masteryTone(classification: string) {
  if (classification === "Mastered") return "green" as const;
  if (classification === "Developing") return "amber" as const;
  if (classification === "Needs Review") return "rose" as const;
  return "slate" as const;
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const safe = Math.max(0, Math.min(1, value || 0));
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
          <span>{label}</span>
          <span>{Math.round(safe * 100)}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyanx-600 to-cyanx-400 transition-all"
          style={{ width: `${safe * 100}%` }}
        />
      </div>
    </div>
  );
}

export function DemoNotice() {
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-900">
      Demonstration Data – Not a Research Result. Cognitive-load estimates
      support learning decisions and are not medical or psychological diagnoses.
    </div>
  );
}
