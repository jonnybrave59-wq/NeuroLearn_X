import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Gauge,
  HelpCircle,
  History,
  KeyRound,
  Lightbulb,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Menu,
  Route,
  Sparkles,
  Target,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route as RouterRoute, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, inlineApiError, post } from "./api";
import {
  Badge,
  Brand,
  DemoNotice,
  Empty,
  ErrorNotice,
  Loading,
  masteryTone,
  MetricCard,
  PageHeader,
  ProgressBar,
} from "./components";
import { InstallButton, ShareButton } from "./pwa";
import { Equation } from "./Equation";
import {
  countdownTone,
  formatCountdown,
  remainingSeconds,
  shouldPlayFinalTick,
} from "./timer";

type User = {
  id: number;
  participant_code: string;
  display_name: string;
  role: string;
  is_demo: boolean;
  account_status?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
};

function messageOf(error: unknown) {
  return inlineApiError(error);
}

const navigation = [
  ["Overview", "/student", BarChart3],
  ["Assessments", "/student/assessments", ClipboardCheck],
  ["Choose target", "/student/targets", Target],
  ["Mastery & gaps", "/student/mastery", Gauge],
  ["Learning pathway", "/student/pathway", Route],
  ["Prerequisite map", "/student/map", MapIcon],
  ["Explanation", "/student/explanation", Sparkles],
  ["Progress history", "/student/history", History],
  ["Profile & password", "/student/profile", UserRound],
] as const;

export default function StudentApp({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const reload = useCallback(async () => {
    try {
      setSnapshot(await api("/api/student/dashboard"));
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => setMobileOpen(false), [location.pathname]);

  if (!snapshot && location.pathname === "/student/onboarding") {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950 text-white">
        <div><Brand /><Loading label="Preparing your welcome…" /></div>
      </div>
    );
  }
  if (snapshot?.onboarding?.completed === false) {
    return (
      <StudentOnboarding
        user={user}
        onCompleted={reload}
        onLogout={onLogout}
      />
    );
  }
  if (snapshot?.onboarding?.completed && location.pathname === "/student/onboarding") {
    return <Navigate to="/student" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f3f7fa] text-slate-800">
      <button
        className="fixed left-4 top-4 z-50 grid h-11 w-11 place-items-center rounded-xl bg-navy-950 text-white shadow-lg lg:hidden"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label="Open navigation"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[278px] flex-col bg-navy-950 px-4 py-6 text-white transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-2">
          <Brand />
        </div>
        <div className="mx-2 mt-7 rounded-xl border border-white/10 bg-white/[0.06] p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-cyanx-400">
            Student mode
          </div>
          <div className="mt-1 truncate text-sm font-bold">{user.display_name}</div>
          <div className="text-xs text-slate-400">{user.participant_code}</div>
        </div>
        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto" aria-label="Student navigation">
          {navigation.map(([label, href, Icon]) => {
            const active =
              href === "/student"
                ? location.pathname === href
                : location.pathname.startsWith(href);
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-cyanx-500 text-navy-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <InstallButton
          compact
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
        />
        <ShareButton />
        <button
          onClick={onLogout}
          className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <main className="min-h-screen px-4 pb-12 pt-20 sm:px-7 lg:ml-[278px] lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex justify-end">
            <InstallButton
              compact
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-navy-950 shadow-sm hover:bg-slate-50 lg:flex"
            />
            <InstallButton
              compact
              iconOnly
              className="fixed right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-xl bg-white text-navy-950 shadow-lg lg:hidden"
            />
          </div>
          {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
          <Routes>
            <RouterRoute
              index
              element={<StudentOverview snapshot={snapshot} />}
            />
            <RouterRoute
              path="targets"
              element={<TargetSelection onChanged={reload} />}
            />
            <RouterRoute
              path="activity/:activityId"
              element={<ActivityPlayer userId={user.id} onCompleted={reload} />}
            />
            <RouterRoute
              path="diagnostic-analysis"
              element={
                <DiagnosticAnalysisCompletion
                  diagnostic={snapshot?.diagnostic}
                  onCompleted={reload}
                />
              }
            />
            <RouterRoute path="assessments" element={<PublishedAssessments />} />
            <RouterRoute
              path="mastery"
              element={<MasteryReport snapshot={snapshot} />}
            />
            <RouterRoute
              path="pathway"
              element={<PathwayPage onChanged={reload} isDemo={user.is_demo} />}
            />
            <RouterRoute path="map" element={<PrerequisiteMap />} />
            <RouterRoute
              path="explanation"
              element={<ExplanationPage snapshot={snapshot} />}
            />
            <RouterRoute
              path="history"
              element={<HistoryPage snapshot={snapshot} />}
            />
            <RouterRoute
              path="profile"
              element={<ProfilePage user={user} />}
            />
            <RouterRoute path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function StudentOnboarding({
  user,
  onCompleted,
  onLogout,
}: {
  user: User;
  onCompleted: () => Promise<void>;
  onLogout: () => void;
}) {
  const [step, setStep] = useState<"welcome" | "introduction">("welcome");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function finish() {
    setSaving(true);
    setError("");
    try {
      await post("/api/student/onboarding/complete");
      await onCompleted();
      navigate("/student", { replace: true });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  const stages = [
    [ClipboardCheck, "Diagnostic evidence", "A 30-item multiple-choice assessment establishes your current baseline."],
    [Brain, "Adaptive analysis", "NeuroLearn-X combines response evidence and your mental-effort rating to estimate mastery, gaps, and learning load."],
    [Route, "Guided learning", "Your pathway prioritizes prerequisites and recommends the next suitable activity."],
    [BookOpenCheck, "Mastery checks", "New evidence updates your dashboard and adapts the pathway as you progress."],
  ] as const;

  return (
    <main className="min-h-screen bg-[#f3f7fa] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <button onClick={onLogout} className="btn-secondary">
            <LogOut size={17} /> Sign out
          </button>
        </header>
        <section className="mt-9 overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <aside className="bg-navy-950 p-8 text-white sm:p-10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-500 text-navy-950">
                {step === "welcome" ? <Sparkles size={28} /> : <Brain size={28} />}
              </span>
              <div className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-cyanx-400">
                {step === "welcome" ? "Welcome to NeuroLearn-X" : "Brief system introduction"}
              </div>
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
                {step === "welcome"
                  ? `Hello, ${user.display_name.split(" ")[0]}.`
                  : "Learn from evidence, one pathway at a time."}
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {step === "welcome"
                  ? "Your account is ready. This short introduction appears only once and prepares you for your learning workspace."
                  : "The system recommends learning support from assessment evidence. Its mastery and cognitive-load indicators support learning decisions; they are not medical diagnoses."}
              </p>
              <div className="mt-8 flex items-center gap-2" aria-label="Onboarding progress">
                <span className="h-2 flex-1 rounded-full bg-cyanx-500" />
                <span className={`h-2 flex-1 rounded-full ${step === "introduction" ? "bg-cyanx-500" : "bg-white/15"}`} />
              </div>
            </aside>
            <div className="p-7 sm:p-10">
              {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
              {step === "welcome" ? (
                <div className="flex min-h-[430px] flex-col justify-center">
                  <Badge tone="cyan">Account registration complete</Badge>
                  <h2 className="mt-5 text-3xl font-black tracking-tight text-navy-950">
                    Your personalized learning journey starts here
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
                    You will first open the real Main Dashboard, then begin a 30-item diagnostic. NeuroLearn-X will use your responses to identify strengths and gaps before guiding you through targeted learning and mastery checks.
                  </p>
                  <button className="btn-primary mt-8 w-fit" onClick={() => setStep("introduction")}>
                    Continue to system introduction <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-cyanx-600">How NeuroLearn-X works</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-navy-950">From baseline evidence to adaptive support</h2>
                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    {stages.map(([Icon, title, description], index) => (
                      <article key={title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-950 text-cyanx-400"><Icon size={20} /></span>
                          <div className="text-xs font-black uppercase tracking-widest text-cyanx-600">Step {index + 1}</div>
                        </div>
                        <h3 className="mt-4 font-black text-navy-950">{title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                      </article>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button className="btn-secondary" onClick={() => setStep("welcome")} disabled={saving}>
                      <ArrowLeft size={17} /> Back
                    </button>
                    <button className="btn-primary" onClick={finish} disabled={saving}>
                      {saving ? "Opening dashboard…" : "Open my Main Dashboard"} <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DiagnosticAnalysisCompletion({
  diagnostic,
  onCompleted,
}: {
  diagnostic: any;
  onCompleted: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const attemptId = diagnostic?.pending_mental_effort_attempt_id;
  if (!attemptId) return <Navigate to="/student" replace />;
  return (
    <MentalEffort
      attemptId={attemptId}
      boundaries={diagnostic.mental_effort_boundaries}
      onSaved={async () => {
        await onCompleted();
        navigate("/student", { replace: true });
      }}
    />
  );
}

function evidenceDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "No valid evidence recorded yet";
}

function ExplainableMetricCard({
  explanationId,
  label,
  value,
  explanation,
  icon,
  tone = "navy",
  expandedClassName = "sm:col-span-2 xl:col-span-4",
  isOpen,
  onOpen,
  onClose,
  children,
}: {
  explanationId: string;
  label: string;
  value: ReactNode;
  explanation: any;
  icon: ReactNode;
  tone?: "navy" | "cyan" | "amber" | "rose" | "white";
  expandedClassName?: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const tones = {
    navy: "bg-navy-950 text-white",
    cyan: "bg-cyanx-100 text-navy-950",
    amber: "bg-amber-50 text-navy-950",
    rose: "bg-rose-50 text-navy-950",
    white: "bg-white text-navy-950",
  };
  const muted = tone === "navy" ? "text-slate-300" : "text-slate-600";
  const panelId = `${explanationId}-explanation`;
  return (
    <article className={`${isOpen ? expandedClassName : ""} overflow-hidden rounded-2xl shadow-soft ${tones[tone]}`}>
      <div className="flex min-h-44 flex-col p-5">
        <div className="flex flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${muted}`}>{label}</p>
            <div className="mt-3 break-words text-2xl font-black tracking-tight">{value}</div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`How was ${label} determined?`}
            aria-controls={panelId}
            aria-expanded={isOpen}
            className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx-400 ${tone === "navy" ? "bg-white/10 text-cyanx-400" : "bg-white text-cyanx-600"}`}
          >
            {icon}
            <HelpCircle size={13} className="absolute -right-1 -top-1 rounded-full bg-white text-cyanx-700" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={isOpen ? onClose : onOpen}
          aria-controls={panelId}
          aria-expanded={isOpen}
          className={`mt-4 flex w-full items-center gap-2 border-t pt-3 text-left text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx-400 ${tone === "navy" ? "border-white/10 text-cyanx-400" : "border-slate-200 text-cyanx-700"}`}
        >
          <HelpCircle size={15} /> How was this determined?
          <ChevronRight size={15} className={`ml-auto transition ${isOpen ? "rotate-90" : ""}`} />
        </button>
      </div>
      {isOpen && <div id={panelId} className="border-t border-slate-200 bg-white p-5 text-slate-700 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyanx-600">Explanation</p>
            <h2 className="mt-1 text-xl font-black text-navy-950">How {label} was determined</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-navy-950 hover:bg-slate-50">
            Close <X size={16} />
          </button>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-black text-navy-950">What this means</h3>
            <p className="mt-2 text-sm leading-6">{explanation.meaning}</p>
          </section>
          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-black text-navy-950">Why does this matter?</h3>
            <p className="mt-2 text-sm leading-6">{explanation.why_matters}</p>
          </section>
          <section className="rounded-xl bg-cyan-50 p-4">
            <h3 className="font-black text-navy-950">Simple interpretation</h3>
            <p className="mt-2 text-sm leading-6 text-cyan-950">{explanation.interpretation}</p>
          </section>
        </div>
        <section className="mt-5 rounded-xl border border-slate-200 p-4 sm:p-5">
          <h3 className="font-black text-navy-950">Actual learner evidence, formula, variables, and calculation</h3>
          <div className="mt-4">{children}</div>
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-black text-navy-950">How does this affect my pathway?</h3>
            <p className="mt-2 text-sm leading-6">{explanation.pathway_effect}</p>
          </section>
          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-black text-navy-950">Evidence and data quality</h3>
            <p className="mt-2 text-sm"><strong>Latest evidence date:</strong> {evidenceDate(explanation.latest_evidence_at)}</p>
            <p className="mt-2 text-sm leading-6">{explanation.data_quality}</p>
          </section>
        </div>
        {explanation.related_path && (
          <Link to={explanation.related_path} className="mt-5 inline-flex items-center gap-1 text-sm font-black text-cyanx-700 hover:text-cyan-900">
            Open related detailed page <ChevronRight size={16} />
          </Link>
        )}
        <button type="button" onClick={onClose} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-3 text-sm font-black text-white hover:bg-navy-900">
          Hide explanation <X size={16} />
        </button>
      </div>}
    </article>
  );
}

export function StudentOverview({ snapshot }: { snapshot: any }) {
  const [openExplanation, setOpenExplanation] = useState<string | null>(null);
  if (!snapshot) return <Loading label="Preparing your learning dashboard…" />;
  const pathway = snapshot.pathway;
  const nextStep = pathway?.steps.find((step: any) => step.required && !step.completed_at);
  const explainability = snapshot.explainability;
  const masteryExplanation = explainability.average_mastery;
  const loadExplanation = explainability.model_predicted_cognitive_load;
  const targetExplanation = explainability.current_target;
  const progressExplanation = explainability.pathway_progress;
  const nextExplanation = explainability.next_recommended_step;
  return (
    <>
      <PageHeader
        eyebrow="Personal learning workspace"
        title={`Good day, ${snapshot.student.display_name.split(" ")[0]}`}
        description="Your recommendations update when new assessment evidence is recorded."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">Grade 12 STEM</Badge>
            <ShareButton
              label="Share"
              className="btn-secondary !px-3 !py-2 text-xs"
            />
          </div>
        }
      />
      {snapshot.student.is_demo && <DemoNotice />}
      <section className="mt-6 overflow-hidden rounded-2xl bg-navy-950 text-white shadow-soft">
        <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl flex-1">
            <div className="text-xs font-black uppercase tracking-widest text-cyanx-400">
              {snapshot.diagnostic?.completed ? "Personalized diagnostic results" : "Your first learning step"}
            </div>
            <h2 className="mt-2 text-2xl font-black">
              {snapshot.diagnostic?.completed
                ? `${Math.round((snapshot.diagnostic.latest_result?.accuracy || 0) * 100)}% baseline accuracy`
                : "Baseline accuracy: Not assessed"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              <strong>Priority learning gaps:</strong>{" "}
              {snapshot.diagnostic?.priority_gaps?.length
                ? snapshot.diagnostic.priority_gaps.slice(0, 4).map((gap: any) => gap.concept).join(", ")
                : "None recorded"}
            </p>
            <div className="mt-3 text-xs font-bold text-cyanx-400">
              Reported cognitive load: {snapshot.diagnostic?.latest_result?.cognitive_load_category || "Not reported"}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setOpenExplanation("diagnostic-results")}
              aria-label="How were the personalized diagnostic results determined?"
              aria-controls="diagnostic-results-explanation"
              aria-expanded={openExplanation === "diagnostic-results"}
              className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-cyanx-400 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx-400"
            >
              <ClipboardCheck size={20} />
              <HelpCircle size={13} className="absolute -right-1 -top-1 rounded-full bg-white text-cyanx-700" aria-hidden="true" />
            </button>
            {snapshot.diagnostic?.pending_mental_effort_attempt_id && (
              <Link to="/student/diagnostic-analysis" className="btn-secondary border-white/20 bg-white text-navy-950">
                Complete AI analysis <Brain size={17} />
              </Link>
            )}
            {snapshot.diagnostic?.available ? (
              <Link to={`/student/activity/${snapshot.diagnostic.activity_id}`} className="btn-primary">
                Start Diagnostic Assessment <ArrowRight size={17} />
              </Link>
            ) : (
              <span className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
                Diagnostic setup unavailable
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpenExplanation(openExplanation === "diagnostic-results" ? null : "diagnostic-results")}
          aria-controls="diagnostic-results-explanation"
          aria-expanded={openExplanation === "diagnostic-results"}
          className="flex w-full items-center gap-2 border-t border-white/10 px-6 py-4 text-left text-xs font-black text-cyanx-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyanx-400 sm:px-7"
        >
          <HelpCircle size={15} /> How was this determined?
          <ChevronRight size={15} className={`ml-auto transition ${openExplanation === "diagnostic-results" ? "rotate-90" : ""}`} />
        </button>
        {openExplanation === "diagnostic-results" && (
          <div id="diagnostic-results-explanation" className="border-t border-slate-200 bg-white p-5 text-slate-700 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-widest text-cyanx-600">Explanation</p><h2 className="mt-1 text-xl font-black text-navy-950">How the diagnostic results were determined</h2></div>
              <button type="button" onClick={() => setOpenExplanation(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-navy-950 hover:bg-slate-50">Close <X size={16} /></button>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <section className="rounded-xl bg-slate-50 p-4"><h3 className="font-black text-navy-950">What this means</h3><p className="mt-2 text-sm leading-6">Baseline accuracy summarizes performance on the saved 30-item diagnostic assessment. Priority gaps are concepts with current mastery evidence below the configured threshold.</p></section>
              <section className="rounded-xl bg-slate-50 p-4"><h3 className="font-black text-navy-950">Why it is important</h3><p className="mt-2 text-sm leading-6">The results give NeuroLearn-X its starting evidence for selecting targets, prerequisite support, and guided activities.</p></section>
              <section className="rounded-xl bg-cyan-50 p-4"><h3 className="font-black text-navy-950">Simple interpretation</h3><p className="mt-2 text-sm leading-6 text-cyan-950">{snapshot.diagnostic?.completed ? `${Math.round(snapshot.diagnostic.latest_result.accuracy * 100)}% of the available diagnostic score was earned. ${snapshot.diagnostic.priority_gaps?.length || 0} priority gaps are currently listed.` : "No diagnostic attempt has been saved yet, so baseline accuracy and diagnostic gaps cannot be interpreted."}</p></section>
            </div>
            <section className="mt-5 rounded-xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-navy-950">Actual learner evidence, formula, variables, and step-by-step calculation</h3>
              {snapshot.diagnostic?.completed ? <div className="mt-4 space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Earned score</div><div className="mt-1 font-black text-navy-950">{snapshot.diagnostic.latest_result.score}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Maximum score</div><div className="mt-1 font-black text-navy-950">{snapshot.diagnostic.latest_result.max_score}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Item count</div><div className="mt-1 font-black text-navy-950">{snapshot.diagnostic.item_count}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Reported cognitive load</div><div className="mt-1 font-black text-navy-950">{snapshot.diagnostic.latest_result.cognitive_load_category || "Not reported"}</div></div>
                </div>
                <Equation latex={String.raw`A=\frac{S_e}{S_{\max}}\times100`} label="Baseline accuracy equals earned score divided by maximum score times one hundred" />
                <p><strong>A</strong> is baseline accuracy, <strong>Sₑ</strong> is the learner's earned diagnostic score, and <strong>Smax</strong> is the maximum available score.</p>
                <Equation latex={`A=\\frac{${snapshot.diagnostic.latest_result.score}}{${snapshot.diagnostic.latest_result.max_score}}\\times100=${(snapshot.diagnostic.latest_result.accuracy * 100).toFixed(1)}\\%`} label={`Baseline accuracy is ${(snapshot.diagnostic.latest_result.accuracy * 100).toFixed(1)} percent`} />
                <ol className="list-decimal space-y-2 pl-5"><li>Read the saved earned and maximum scores from the latest diagnostic attempt.</li><li>Divide {snapshot.diagnostic.latest_result.score} by {snapshot.diagnostic.latest_result.max_score}.</li><li>Multiply by 100 to obtain {(snapshot.diagnostic.latest_result.accuracy * 100).toFixed(1)}% baseline accuracy.</li><li>List the current unresolved learning gaps ordered by their saved mastery evidence.</li></ol>
                <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Priority learning gap</th><th>Current mastery evidence</th></tr></thead><tbody>{snapshot.diagnostic.priority_gaps?.map((gap: any) => <tr key={gap.concept_id}><td className="font-black text-navy-950">{gap.concept}</td><td>{(gap.mastery_score * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
                <p className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950"><strong>Reported cognitive load is separate from model prediction:</strong> this panel shows the learner's reported category, not the Model-Predicted Cognitive Load card result.</p>
              </div> : <p className="mt-4 rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">There is not enough saved diagnostic evidence to calculate baseline accuracy. Complete the 30-item assessment first.</p>}
            </section>
            <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-xl bg-slate-50 p-4"><h3 className="font-black text-navy-950">How this affects the adaptive pathway</h3><p className="mt-2 text-sm leading-6">Concept-level diagnostic evidence updates mastery and gaps, which the existing pathway logic uses when prioritizing guided learning activities.</p></section><section className="rounded-xl bg-slate-50 p-4"><h3 className="font-black text-navy-950">Latest evidence date</h3><p className="mt-2 text-sm">{evidenceDate(snapshot.diagnostic?.latest_result?.submitted_at)}</p></section></div>
            <button type="button" onClick={() => setOpenExplanation(null)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-3 text-sm font-black text-white hover:bg-navy-900">Hide explanation <X size={16} /></button>
          </div>
        )}
      </section>
      {snapshot.notifications?.map((notice: any) => (
        <section
          key={`${notice.title}-${notice.assigned_at}`}
          className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-cyan-950"
          aria-label="New pathway assignment"
        >
          <div className="text-xs font-black uppercase tracking-widest text-cyanx-600">
            {notice.type}
          </div>
          <h2 className="mt-1 text-lg font-black">{notice.title}</h2>
          <p className="mt-2 text-sm leading-6">{notice.message}</p>
          {notice.due_at && (
            <p className="mt-2 text-xs font-bold">
              Due {new Date(notice.due_at).toLocaleString()}
            </p>
          )}
        </section>
      ))}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExplainableMetricCard
          explanationId="current-target"
          label="Current target"
          value={targetExplanation.available ? targetExplanation.concept.name : "Not selected"}
          explanation={targetExplanation}
          icon={<Target size={20} />}
          isOpen={openExplanation === "current-target"}
          onOpen={() => setOpenExplanation("current-target")}
          onClose={() => setOpenExplanation(null)}
        >
          {targetExplanation.available ? (
            <div className="space-y-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-xs font-bold uppercase text-slate-400">Target concept</div><div className="mt-1 font-black text-navy-950">{targetExplanation.concept.name}</div></div>
                <div><div className="text-xs font-bold uppercase text-slate-400">Current mastery</div><div className="mt-1 font-black text-navy-950">{targetExplanation.mastery == null ? "Not yet assessed" : `${(targetExplanation.mastery * 100).toFixed(1)}%`}</div></div>
                <div><div className="text-xs font-bold uppercase text-slate-400">Mastery threshold</div><div className="mt-1 font-black text-navy-950">{(targetExplanation.threshold * 100).toFixed(1)}%</div></div>
                <div><div className="text-xs font-bold uppercase text-slate-400">Detected learning gap</div><div className="mt-1 font-black text-navy-950">{targetExplanation.detected_gap ? "Yes" : "No current gap"}</div></div>
              </div>
              <Equation latex={String.raw`M_i < \tau`} label="Concept mastery is below the configured threshold" />
              <p><strong>Mᵢ</strong> is the learner's current mastery for the target concept, and <strong>τ</strong> is the configured mastery threshold.</p>
              {targetExplanation.mastery != null && <Equation latex={`${targetExplanation.mastery.toFixed(3)} ${targetExplanation.detected_gap ? "<" : "\\ge"} ${targetExplanation.threshold.toFixed(3)}`} label={`Current mastery ${targetExplanation.mastery.toFixed(3)} compared with threshold ${targetExplanation.threshold.toFixed(3)}`} />}
              <ol className="list-decimal space-y-2 pl-5"><li>Read the learner's saved target concept and latest valid mastery evidence.</li><li>Compare current mastery Mᵢ with threshold τ.</li><li>Check unresolved gaps and direct prerequisite evidence.</li><li>Keep or update the active target using the existing pathway rules.</li></ol>
              <div>
                <h4 className="font-black text-navy-950">Required prerequisites from the knowledge graph</h4>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {targetExplanation.prerequisites.map((item: any) => <li key={item.concept_id} className="rounded-lg bg-slate-50 p-3"><strong>{item.concept}</strong> · {item.mastery == null ? "not yet assessed" : `${(item.mastery * 100).toFixed(1)}% mastery`} · {item.below_threshold ? "needs pathway evidence" : "threshold met"}</li>)}
                  {!targetExplanation.prerequisites.length && <li className="rounded-lg bg-slate-50 p-3">No direct prerequisite is recorded for this target.</li>}
                </ul>
              </div>
              <p className="rounded-xl bg-cyan-50 p-4 leading-6 text-cyan-950"><strong>Why this target:</strong> {targetExplanation.reason}</p>
            </div>
          ) : <p className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{targetExplanation.data_quality}</p>}
        </ExplainableMetricCard>
        <ExplainableMetricCard
          explanationId="average-mastery"
          label="Average mastery"
          value={
            masteryExplanation.available
              ? `${(masteryExplanation.value * 100).toFixed(1)}%`
              : "Not available yet"
          }
          explanation={masteryExplanation}
          icon={<Gauge size={20} />}
          tone="cyan"
          isOpen={openExplanation === "average-mastery"}
          onOpen={() => setOpenExplanation("average-mastery")}
          onClose={() => setOpenExplanation(null)}
        >
          {masteryExplanation.available ? (
            <div className="space-y-5 text-sm">
              <p><strong>Actual data used:</strong> the latest valid mastery record for each of {masteryExplanation.concept_count} assessed concepts. Each concept record comes from saved item scores; the dashboard then averages those current concept results.</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div><h4 className="font-black text-navy-950">Concept mastery</h4><Equation latex={String.raw`M_i=\frac{S_{e,i}}{S_{\max,i}}`} label="Mastery for concept i equals earned score divided by maximum score" /><dl className="space-y-1 text-xs"><div><dt className="inline font-black">Sₑ,ᵢ:</dt> <dd className="inline">earned score for concept i</dd></div><div><dt className="inline font-black">Smax,ᵢ:</dt> <dd className="inline">highest possible score for concept i</dd></div><div><dt className="inline font-black">Mᵢ:</dt> <dd className="inline">mastery for concept i</dd></div></dl></div>
                <div><h4 className="font-black text-navy-950">Dashboard average</h4><Equation latex={String.raw`\overline{M}=\frac{1}{n}\sum_{i=1}^{n}M_i`} label="Average mastery equals the sum of concept mastery divided by the number of concepts" /><Equation latex={`\\overline{M}=\\frac{${masteryExplanation.sum_mastery.toFixed(3)}}{${masteryExplanation.concept_count}}=${masteryExplanation.value.toFixed(3)}`} label={`Average mastery equals ${masteryExplanation.value.toFixed(3)}`} /><p className="text-xs"><strong>n:</strong> {masteryExplanation.concept_count} concepts with valid evidence. <strong>Average:</strong> {(masteryExplanation.value * 100).toFixed(1)}%.</p></div>
              </div>
              <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Concept</th><th>Actual score evidence</th><th>Current mastery</th><th>Threshold result</th><th>Latest evidence</th></tr></thead><tbody>{masteryExplanation.concepts.map((item: any) => <tr key={item.concept_id}><td className="font-black text-navy-950">{item.concept}</td><td>{item.attempts.length ? item.attempts.map((attempt: any) => `${attempt.earned}/${attempt.maximum}`).join(", ") : "No score rows"}{item.calculation_mode === "weighted" && item.attempts.length > 1 ? " · later attempts weighted more" : ""}</td><td>{(item.score * 100).toFixed(1)}%</td><td>{item.below_threshold ? `Below ${(masteryExplanation.threshold * 100).toFixed(0)}% — possible learning gap` : "Threshold met"}</td><td>{evidenceDate(item.latest_evidence_at)}</td></tr>)}</tbody></table></div>
              <Equation latex={String.raw`M_i < \tau`} label="A possible learning gap is identified when concept mastery is below threshold tau" />
              <ol className="list-decimal space-y-2 pl-5"><li>Calculate each concept mastery from its valid saved score evidence.</li><li>Use the latest current mastery record for each assessed concept.</li><li>Sum the {masteryExplanation.concept_count} concept mastery values.</li><li>Divide {masteryExplanation.sum_mastery.toFixed(3)} by {masteryExplanation.concept_count} to obtain {(masteryExplanation.value * 100).toFixed(1)}%.</li></ol>
            </div>
          ) : <p className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{masteryExplanation.data_quality}</p>}
        </ExplainableMetricCard>
        <ExplainableMetricCard
          explanationId="model-predicted-load"
          label="Model-Predicted Cognitive Load"
          value={loadExplanation.available ? loadExplanation.category : "Not available yet"}
          explanation={loadExplanation}
          icon={<Brain size={20} />}
          tone="amber"
          isOpen={openExplanation === "model-predicted-load"}
          onOpen={() => setOpenExplanation("model-predicted-load")}
          onClose={() => setOpenExplanation(null)}
        >
          {loadExplanation.available ? (
            <div className="space-y-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {(["Low", "Moderate", "High"] as const).map((label) => <div key={label} className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">{label} probability</div><div className="mt-1 text-lg font-black text-navy-950">{(loadExplanation.probabilities[label] * 100).toFixed(1)}%</div></div>)}
                <div className="rounded-xl bg-cyan-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Confidence</div><div className="mt-1 text-lg font-black text-navy-950">{(loadExplanation.confidence * 100).toFixed(1)}%</div></div>
                <div className="rounded-xl bg-cyan-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Load index</div><div className="mt-1 text-lg font-black text-navy-950">{loadExplanation.index.toFixed(3)}</div></div>
              </div>
              <section><h4 className="font-black text-navy-950">Actual learner evidence used</h4><dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
                ["Accuracy", `${(loadExplanation.evidence.accuracy * 100).toFixed(1)}%`],
                ["Average response time", `${loadExplanation.evidence.average_response_seconds.toFixed(1)} seconds`],
                ["Completion time", `${(loadExplanation.evidence.completion_seconds / 60).toFixed(1)} minutes`],
                ["Number of attempts", loadExplanation.evidence.attempts],
                ["Skipped questions", loadExplanation.evidence.skipped_questions],
                ["Hint usage", loadExplanation.evidence.hint_usage],
                ["Reported mental effort", loadExplanation.evidence.mental_effort_rating == null ? "Not reported" : `${loadExplanation.evidence.mental_effort_rating}/9`],
                ["Model version", loadExplanation.model_version],
              ].map(([name, value]) => <div key={String(name)} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-400">{name}</dt><dd className="mt-1 font-black text-navy-950">{value}</dd></div>)}</dl></section>
              <div className="grid gap-5 lg:grid-cols-2">
                <div><h4 className="font-black text-navy-950">Ensemble prediction</h4><Equation latex={String.raw`p_c=\frac{1}{K}\sum_{k=1}^{K}p_{kc}`} label="Probability for a category equals the average probability from K classifiers" /><Equation latex={String.raw`\hat{c}=\operatorname*{arg\,max}_{c}p_c`} label="The predicted category is the category with maximum probability" /><p className="text-xs">K = {loadExplanation.model_count} trained ensemble members. The largest final probability selects {loadExplanation.category}.</p></div>
                <div><h4 className="font-black text-navy-950">Cognitive-Load Index</h4><Equation latex={String.raw`CL=0P_L+0.5P_M+1P_H`} label="Cognitive load index weights low moderate and high probabilities" /><Equation latex={`CL=0(${loadExplanation.probabilities.Low.toFixed(3)})+0.5(${loadExplanation.probabilities.Moderate.toFixed(3)})+1(${loadExplanation.probabilities.High.toFixed(3)})=${loadExplanation.index.toFixed(3)}`} label={`Cognitive load index equals ${loadExplanation.index.toFixed(3)}`} /></div>
              </div>
              <ol className="list-decimal space-y-2 pl-5"><li>Read the saved learner evidence shown above.</li><li>Obtain each ensemble member's Low, Moderate, and High probabilities.</li><li>Average the probabilities across K = {loadExplanation.model_count} members.</li><li>Select the largest probability and calculate the weighted load index.</li></ol>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><h4 className="font-black text-cyan-950">Learner-reported mental effort — separate measure</h4><p className="mt-2 text-cyan-900">{loadExplanation.reported_mental_effort ? `You reported ${loadExplanation.reported_mental_effort.rating}/9 (${loadExplanation.reported_mental_effort.category}) on ${evidenceDate(loadExplanation.reported_mental_effort.reported_at)}. This is an input to the model, not the model prediction itself.` : "No mental-effort rating has been reported yet."}</p></div>
              <p className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{loadExplanation.disclaimer}</p>
            </div>
          ) : (
            <div className="space-y-3"><p className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{loadExplanation.data_quality}</p><p className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950"><strong>Reported mental effort remains separate:</strong> {loadExplanation.reported_mental_effort ? `${loadExplanation.reported_mental_effort.rating}/9 (${loadExplanation.reported_mental_effort.category}), reported ${evidenceDate(loadExplanation.reported_mental_effort.reported_at)}.` : "No learner rating is available."}</p></div>
          )}
        </ExplainableMetricCard>
        <ExplainableMetricCard
          explanationId="pathway-progress"
          label="Pathway progress"
          value={progressExplanation.available ? `${(progressExplanation.percentage * 100).toFixed(1)}%` : "No active pathway"}
          explanation={progressExplanation}
          icon={<ListChecks size={20} />}
          tone="rose"
          isOpen={openExplanation === "pathway-progress"}
          onOpen={() => setOpenExplanation("pathway-progress")}
          onClose={() => setOpenExplanation(null)}
        >
          {progressExplanation.available ? (
            <div className="space-y-5 text-sm">
              <Equation latex={String.raw`PP=\frac{N_c}{N_t}\times100`} label="Pathway progress equals completed required activities divided by total required activities times one hundred" />
              <Equation latex={`PP=\\frac{${progressExplanation.completed}}{${progressExplanation.total}}\\times100=${(progressExplanation.percentage * 100).toFixed(1)}\\%`} label={`Pathway progress is ${(progressExplanation.percentage * 100).toFixed(1)} percent`} />
              <p><strong>Nc:</strong> {progressExplanation.completed} successfully completed required activities. <strong>Nt:</strong> {progressExplanation.total} total required activities. <strong>Remaining:</strong> {progressExplanation.remaining}.</p>
              <ol className="list-decimal space-y-2 pl-5"><li>Count required activities with valid completion records: {progressExplanation.completed}.</li><li>Count all required activities in the active pathway: {progressExplanation.total}.</li><li>Divide the completed count by the total count.</li><li>Multiply by 100 to obtain {(progressExplanation.percentage * 100).toFixed(1)}%.</li></ol>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{progressExplanation.steps.map((step: any) => <div key={`${step.activity}-${step.concept}`} className="rounded-xl bg-slate-50 p-3"><Badge tone={step.status === "Completed" ? "green" : step.status === "Current" ? "cyan" : "slate"}>{step.status}</Badge><div className="mt-2 font-black text-navy-950">{step.activity}</div><div className="mt-1 text-xs text-slate-500">{step.concept}</div></div>)}</div>
            </div>
          ) : <p className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{progressExplanation.data_quality}</p>}
        </ExplainableMetricCard>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <ExplainableMetricCard
          explanationId="next-recommended-step"
          label="Next recommended step"
          value={nextStep?.activity || "Select a target competency"}
          explanation={nextExplanation}
          icon={<BookOpenCheck size={23} />}
          tone="white"
          expandedClassName=""
          isOpen={openExplanation === "next-recommended-step"}
          onOpen={() => setOpenExplanation("next-recommended-step")}
          onClose={() => setOpenExplanation(null)}
        >
          {nextStep ? <div className="space-y-5 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Recommended activity", nextExplanation.activity],
                ["Concept addressed", nextExplanation.concept],
                ["Learning gap addressed", nextExplanation.learning_gap ? `${nextExplanation.learning_gap.concept}: ${(nextExplanation.learning_gap.mastery * 100).toFixed(1)}% vs ${(nextExplanation.learning_gap.threshold * 100).toFixed(1)}% threshold` : "No unresolved gap for this concept"],
                ["Required prerequisite", nextExplanation.prerequisites.join(", ") || "No direct prerequisite"],
                ["Estimated time", `${nextExplanation.estimated_minutes} minutes`],
                ["Expected difficulty", nextExplanation.difficulty],
                ["Predicted activity-load index", nextExplanation.predicted_load_index.toFixed(3)],
                ["Latest selection evidence", evidenceDate(nextExplanation.latest_evidence_at)],
              ].map(([name, value]) => <div key={String(name)} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-400">{name}</dt><dd className="mt-1 font-black text-navy-950">{value}</dd></div>)}
            </dl>
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="font-black text-navy-950">Step-by-step activity selection</h4>
              <Equation latex={String.raw`APS=\alpha GC+\beta(1-PCL)+\gamma(1-NLT)`} label="Adaptive Pathway Score balances gap coverage predicted cognitive load and normalized learning time" />
              <p className="leading-6"><strong>GC</strong> is gap coverage; <strong>PCL</strong> is predicted cognitive load; <strong>NLT</strong> is normalized learning time; and <strong>α, β, γ</strong> are the configured weights.</p>
              {nextExplanation.aps.available ? <div className="mt-4 space-y-3">
                <Equation latex={`${nextExplanation.aps.weights.alpha.toFixed(2)}(${nextExplanation.aps.gap_coverage.toFixed(3)})+${nextExplanation.aps.weights.beta.toFixed(2)}(1-${nextExplanation.aps.predicted_cognitive_load.toFixed(3)})+${nextExplanation.aps.weights.gamma.toFixed(2)}(1-${nextExplanation.aps.normalized_learning_time.toFixed(3)})=${nextExplanation.aps.score.toFixed(3)}`} label={`Adaptive Pathway Score equals ${nextExplanation.aps.score.toFixed(3)}`} />
                <ol className="list-decimal space-y-2 pl-5"><li>Measure how well each valid pathway covers the saved learning gaps.</li><li>Adjust for predicted load and normalized learning time.</li><li>Apply the configured APS weights and compare valid alternatives.</li><li>Select the highest valid score: {nextExplanation.aps.score.toFixed(3)}.</li></ol>
                <p className="rounded-lg bg-cyan-50 p-3 text-cyan-950">{nextExplanation.aps.selection_reason}</p>
                {!!nextExplanation.aps.alternatives.length && <div><h4 className="font-black text-navy-950">Why other valid choices ranked lower</h4><ul className="mt-2 space-y-2">{nextExplanation.aps.alternatives.map((item: any) => <li key={item.label} className="rounded-lg bg-slate-50 p-3"><strong>{item.label}</strong> · APS {item.adaptive_pathway_score.toFixed(3)} · {item.why_not_selected}</li>)}</ul></div>}
              </div> : <p className="mt-4 rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">{nextExplanation.aps.reason}</p>}
            </section>
            <div className="flex flex-wrap items-center gap-3"><Link to={`/student/activity/${nextStep.activity_id}`} className="btn-primary inline-flex">Begin next activity <ArrowRight size={17} /></Link><Link to={nextExplanation.related_path} className="inline-flex items-center gap-1 font-black text-cyanx-700">Open pathway details <ChevronRight size={16} /></Link></div>
          </div> : <div className="space-y-4"><p className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{nextExplanation.data_quality}</p><Link to="/student/targets" className="btn-primary inline-flex">Choose target <ChevronRight size={17} /></Link></div>}
        </ExplainableMetricCard>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-navy-950">Learning gaps</h2>
            <Badge tone={snapshot.gaps.length ? "rose" : "green"}>
              {snapshot.gaps.length}
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.gaps.slice(0, 4).map((gap: any) => (
              <div key={gap.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-navy-950">
                    {gap.concept}
                  </span>
                  <span className="text-xs font-black text-rose-700">
                    {Math.round(gap.mastery_score * 100)}%
                  </span>
                </div>
                <ProgressBar value={gap.mastery_score} />
              </div>
            ))}
            {!snapshot.gaps.length && (
              <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                No assessed concept is currently below the configured threshold.
              </p>
            )}
          </div>
          <Link
            to="/student/mastery"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cyanx-600 hover:text-cyan-800"
          >
            View full report <ChevronRight size={16} />
          </Link>
        </section>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-navy-950">Recent activity</h2>
            <Link to="/student/history" className="text-sm font-bold text-cyanx-600">
              Assessment history
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {(snapshot.recent_activity || []).map((item: any, index: number) => (
              <div key={`${item.occurred_at}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                <div>
                  <div className="text-sm font-bold text-navy-950">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.summary}</div>
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {new Date(item.occurred_at).toLocaleDateString()}
                </time>
              </div>
            ))}
            {!snapshot.recent_activity?.length && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                Completed assessments and activities will appear here.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-2xl bg-navy-950 p-6 text-white shadow-soft">
          <div className="text-xs font-bold uppercase tracking-widest text-cyanx-400">
            Account information
          </div>
          <div className="mt-4 text-xl font-black">{snapshot.student.display_name}</div>
          <div className="mt-1 font-mono text-sm text-slate-300">{snapshot.student.participant_code}</div>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Account created</dt>
              <dd className="mt-1 font-bold">
                {snapshot.student.created_at
                  ? new Date(snapshot.student.created_at).toLocaleDateString()
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Latest successful sign-in</dt>
              <dd className="mt-1 font-bold">
                {snapshot.student.last_sign_in_at
                  ? new Date(snapshot.student.last_sign_in_at).toLocaleString()
                  : "No sign-in recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Account status</dt>
              <dd className="mt-1"><Badge tone="green">{snapshot.student.account_status || "Active"}</Badge></dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}

function TargetSelection({ onChanged }: { onChanged: () => void }) {
  const [targets, setTargets] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    api<any[]>("/api/student/targets")
      .then(setTargets)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  async function choose(conceptId: number) {
    setSaving(conceptId);
    setError("");
    try {
      const result = await post<any>("/api/student/target", {
        concept_id: conceptId,
      });
      onChanged();
      if (result.diagnostic_activity_id) {
        navigate(`/student/activity/${result.diagnostic_activity_id}`);
      } else {
        navigate("/student/pathway");
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(null);
    }
  }
  if (!targets) return <Loading label="Loading physics competencies…" />;
  return (
    <>
      <PageHeader
        eyebrow="Target competency selection"
        title="What would you like to master?"
        description="Choosing a competency generates its prerequisite subgraph. A diagnostic will establish current mastery evidence."
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {targets.map((concept) => (
          <article
            key={concept.id}
            className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-cyan-200"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanx-100 font-black text-cyan-800">
                {concept.code.split("-")[1]}
              </span>
              <Badge tone="slate">Level {concept.difficulty}</Badge>
            </div>
            <h2 className="mt-5 text-xl font-black text-navy-950">
              {concept.name}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
              {concept.description}
            </p>
            <button
              onClick={() => choose(concept.id)}
              disabled={saving !== null}
              className="btn-primary mt-5 w-full"
            >
              {saving === concept.id ? "Preparing diagnostic…" : "Select & diagnose"}
              <ArrowRight size={17} />
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function PublishedAssessments() {
  const [assessments, setAssessments] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<any[]>("/api/student/assessments")
      .then(setAssessments)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="Teacher-published work"
        title="Assessments"
        description="Open available assessments, check due dates, and monitor the number of attempts remaining."
      />
      {error && <ErrorNotice message={error} />}
      {!assessments ? (
        <Loading label="Loading assigned assessments…" />
      ) : !assessments.length ? (
        <div className="rounded-2xl bg-white shadow-soft">
          <Empty
            title="No assigned assessments"
            description="Published or scheduled teacher assessments will appear here."
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {assessments.map((assessment) => (
            <article key={assessment.id} className="rounded-2xl bg-white p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-cyanx-600">
                    {assessment.subject} · {assessment.topic}
                  </div>
                  <h2 className="mt-2 text-xl font-black text-navy-950">
                    {assessment.title}
                  </h2>
                </div>
                <Badge tone={assessment.status === "Published" ? "green" : assessment.status === "Scheduled" ? "cyan" : "slate"}>
                  {assessment.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {assessment.description || "No additional instructions provided."}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
                <div><dt className="text-xs text-slate-400">Time limit</dt><dd className="mt-1 font-bold text-navy-950">{assessment.time_limit ? `${assessment.time_limit} min` : "None"}</dd></div>
                <div><dt className="text-xs text-slate-400">Mastery target</dt><dd className="mt-1 font-bold text-navy-950">{Math.round(assessment.mastery_threshold * 100)}%</dd></div>
                <div><dt className="text-xs text-slate-400">Attempts</dt><dd className="mt-1 font-bold text-navy-950">{assessment.attempt_count}/{assessment.maximum_attempts}</dd></div>
                <div><dt className="text-xs text-slate-400">Due</dt><dd className="mt-1 font-bold text-navy-950">{assessment.due_at ? new Date(assessment.due_at).toLocaleString() : "No due date"}</dd></div>
              </dl>
              {assessment.can_attempt && assessment.activity_id ? (
                <Link to={`/student/activity/${assessment.activity_id}`} className="btn-primary mt-5">
                  Begin assessment <ArrowRight size={17} />
                </Link>
              ) : (
                <button className="btn-secondary mt-5" disabled>
                  {assessment.status === "Scheduled" ? "Not open yet" : "Assessment unavailable"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

type PlayerAnswer = {
  selected_choice_id: number | null;
  response_text: string;
  response_seconds: number;
  hint_opened: boolean;
  skipped: boolean;
  answer_changes: number;
};

function StructuredSolution({ solution }: { solution: any }) {
  if (!solution) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-black text-navy-950">
        Reveal the scaffolded solution
      </summary>
      <dl className="mt-4 grid gap-3 text-sm leading-6">
        <div><dt className="font-bold text-slate-500">Given information</dt><dd>{solution.given_information}</dd></div>
        <div><dt className="font-bold text-slate-500">Objective</dt><dd>{solution.objective}</dd></div>
        <div><dt className="font-bold text-slate-500">Rule or formula</dt><dd>{solution.rule_or_formula}</dd></div>
        {!!solution.steps?.length && (
          <div><dt className="font-bold text-slate-500">Reasoning steps</dt><dd><ol className="list-decimal space-y-1 pl-5">{solution.steps.map((step: string, index: number) => <li key={`${index}-${step}`}>{step}</li>)}</ol></dd></div>
        )}
        <div><dt className="font-bold text-slate-500">Final answer</dt><dd className="font-black text-navy-950">{solution.final_answer}</dd></div>
        <div><dt className="font-bold text-slate-500">Checks</dt><dd>{solution.unit_check} {solution.reasonableness_check}</dd></div>
      </dl>
    </details>
  );
}

function AdaptiveTutor({ activity, onCompleted }: { activity: any; onCompleted: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [choiceId, setChoiceId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const [answerChanges, setAnswerChanges] = useState(0);
  const [feedback, setFeedback] = useState<any>(null);
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [effortSaved, setEffortSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const questionStarted = useRef(performance.now());

  useEffect(() => {
    post("/api/student/tutoring-sessions", {
      activity_id: activity.id,
      mode: activity.default_tutoring_mode || "guided",
    })
      .then((data) => {
        setSession(data);
        questionStarted.current = performance.now();
      })
      .catch((cause) => setError(messageOf(cause)));
  }, [activity.id, activity.default_tutoring_mode]);

  async function submitResponse() {
    if (!session?.question || submitting || feedback) return;
    setSubmitting(true);
    setError("");
    try {
      const data: any = await post(`/api/student/tutoring-sessions/${session.id}/responses`, {
        question_id: session.question.id,
        selected_choice_id: choiceId,
        response_text: responseText || null,
        response_seconds: Math.max(0, (performance.now() - questionStarted.current) / 1000),
        hint_opened: hintOpen,
        answer_changes: answerChanges,
      });
      setFeedback(data.feedback);
      if (data.completed) {
        setResult(data.result);
        onCompleted();
      } else {
        setPendingSession(data.session);
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSubmitting(false);
    }
  }

  function continuePractice() {
    if (!pendingSession) return;
    setSession(pendingSession);
    setPendingSession(null);
    setChoiceId(null);
    setResponseText("");
    setHintOpen(false);
    setAnswerChanges(0);
    setFeedback(null);
    questionStarted.current = performance.now();
  }

  if (error && !session) return <ErrorNotice message={error} onDismiss={() => setError("")} />;
  if (!session) return <Loading label="Preparing adaptive practice..." />;
  if (result && !effortSaved) {
    return <MentalEffort attemptId={result.attempt_id} boundaries={result.mental_effort_boundaries} onSaved={() => { setEffortSaved(true); onCompleted(); }} />;
  }
  if (result && effortSaved) {
    const summary = result.summary || {};
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Learning summary" title="Your adaptive practice evidence is saved" description="Mastery, misconception evidence, cognitive-load inputs, and the pathway were recalculated from your actual responses." />
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Accuracy" value={`${Math.round((summary.accuracy || 0) * 100)}%`} icon={<CheckCircle2 size={20} />} />
          <MetricCard label="Questions completed" value={summary.questions_completed || 0} icon={<ListChecks size={20} />} />
          <MetricCard label="Final mastery" value={summary.final_mastery == null ? "Not available" : `${Math.round(summary.final_mastery * 100)}%`} icon={<Gauge size={20} />} />
        </div>
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">What changed</h2>
          <dl className="mt-4 grid gap-4 text-sm leading-6 sm:grid-cols-2">
            <div><dt className="font-bold text-slate-500">Concepts strengthened</dt><dd>{summary.concepts_strengthened?.join(", ") || "More evidence is needed"}</dd></div>
            <div><dt className="font-bold text-slate-500">Errors observed</dt><dd>{summary.errors_observed}</dd></div>
            <div><dt className="font-bold text-slate-500">Pathway update</dt><dd>{summary.pathway_changed ? `${summary.pathway_before || "Previous route"} to ${summary.pathway_after}` : `Route retained: ${summary.pathway_after || "No active route"}`}</dd></div>
            <div><dt className="font-bold text-slate-500">Next action</dt><dd>{summary.next_action}</dd></div>
          </dl>
          {!!summary.misconceptions?.length && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-black text-amber-950">Validated misconception evidence</div>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">{summary.misconceptions.map((item: any) => <li key={item.code}>{item.code}: {item.name} ({item.evidence_count} observations)</li>)}</ul>
            </div>
          )}
        </section>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn-primary" to="/student/pathway">View updated pathway <Route size={17} /></Link>
          <Link className="btn-secondary" to="/student/mastery">View mastery report</Link>
        </div>
      </div>
    );
  }

  const question = session.question;
  const hasAnswer = choiceId != null || responseText.trim().length > 0;
  return (
    <>
      <PageHeader
        eyebrow={session.mode === "mastery_check" ? "Adaptive mastery check" : "Adaptive guided practice"}
        title={activity.title}
        description={`Difficulty and scaffolding respond after each answer. Stopping rule: at least ${session.rules.minimum_questions} questions, ${session.rules.consecutive_correct} consecutive correct, or a maximum of ${session.rules.maximum_questions}.`}
        action={<Badge tone="cyan">{session.current_difficulty} - support {session.scaffolding_level}</Badge>}
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="rounded-2xl bg-white p-5 shadow-soft sm:p-7">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500"><span>Adaptive item {session.responses_count + 1}</span><span>{session.concept}</span></div>
          <ProgressBar value={session.responses_count / session.rules.maximum_questions} />
          <h2 className="mt-7 text-xl font-black leading-8 text-navy-950">{question.prompt}</h2>
          {question.choices.length ? (
            <fieldset className="mt-6 space-y-3" disabled={Boolean(feedback)}>
              <legend className="sr-only">Select one answer</legend>
              {question.choices.map((choice: any, index: number) => (
                <label key={choice.id} className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 ${choiceId === choice.id ? "border-cyanx-500 bg-cyan-50" : "border-slate-100"}`}>
                  <input className="sr-only" type="radio" checked={choiceId === choice.id} onChange={() => { if (choiceId && choiceId !== choice.id) setAnswerChanges((value) => value + 1); setChoiceId(choice.id); }} />
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-black ${choiceId === choice.id ? "bg-cyanx-500 text-navy-950" : "bg-slate-100 text-slate-600"}`}>{String.fromCharCode(65 + index)}</span>
                  <span className="text-sm font-semibold text-slate-700">{choice.text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <textarea className="mt-6 min-h-32 w-full rounded-xl border border-slate-200 p-4" disabled={Boolean(feedback)} value={responseText} onChange={(event) => setResponseText(event.target.value)} />
          )}
          {!feedback && (
            <div className="mt-5"><button className="inline-flex items-center gap-2 text-sm font-bold text-amber-700" onClick={() => setHintOpen(true)}><Lightbulb size={17} /> Use a hint</button>{hintOpen && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{question.hint}</p>}</div>
          )}
          {feedback && (
            <div className={`mt-6 rounded-2xl border p-5 ${feedback.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <Badge tone={feedback.correct ? "green" : "rose"}>{feedback.correct ? "Correct" : "Review"}</Badge>
              <p className="mt-3 text-sm leading-6"><strong>Why:</strong> {feedback.why}</p>
              {!feedback.correct && <p className="mt-2 text-sm"><strong>Correct answer:</strong> {feedback.correct_answer}</p>}
              {feedback.misconception ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <div className="font-black">{feedback.misconception.code}: {feedback.misconception.name}</div>
                  <p className="mt-1">{feedback.misconception.explanation}</p>
                  <p className="mt-2"><strong>Remediation:</strong> {feedback.misconception.remediation_instruction}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide">Pattern confidence: {feedback.misconception.pattern_confidence} ({feedback.misconception.evidence_count} observations)</p>
                </div>
              ) : feedback.diagnostic_note ? <p className="mt-3 text-sm italic text-slate-600">{feedback.diagnostic_note}</p> : null}
              <div className="mt-4"><StructuredSolution solution={feedback.solution} /></div>
            </div>
          )}
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            {!feedback ? <button className="btn-primary" onClick={submitResponse} disabled={!hasAnswer || submitting}>{submitting ? "Checking..." : "Check answer"} <Check size={17} /></button> : pendingSession ? <button className="btn-primary" onClick={continuePractice}>Continue with adapted question <ArrowRight size={17} /></button> : null}
          </div>
        </section>
        <aside className="h-fit rounded-2xl bg-navy-950 p-5 text-white shadow-soft">
          <div className="text-xs font-bold uppercase tracking-widest text-cyanx-400">Live evidence</div>
          <div className="mt-4 text-3xl font-black">{session.responses_count}<span className="text-base text-slate-400">/{session.rules.maximum_questions}</span></div>
          <dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-400">Consecutive correct</dt><dd className="font-black">{session.consecutive_correct}/{session.rules.consecutive_correct}</dd></div><div><dt className="text-slate-400">Mastery threshold</dt><dd className="font-black">{Math.round(session.rules.mastery_threshold * 100)}%</dd></div><div><dt className="text-slate-400">Current support</dt><dd className="font-black">Level {session.scaffolding_level}</dd></div></dl>
          <p className="mt-5 text-xs leading-5 text-slate-400">Solutions and misconception feedback become visible only after each response is submitted.</p>
        </aside>
      </div>
    </>
  );
}

function ActivityPlayer({
  userId,
  onCompleted,
}: {
  userId: number;
  onCompleted: () => void;
}) {
  const { activityId } = useParams();
  const [activityData, setActivityData] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, PlayerAnswer>>({});
  const [hintOpen, setHintOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [effortSaved, setEffortSaved] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [muted, setMuted] = useState(false);
  const [timerReady, setTimerReady] = useState(false);
  const startedAt = useRef(new Date().toISOString());
  const expiresAt = useRef(0);
  const previousRemaining = useRef(0);
  const submissionLock = useRef(false);
  const questionStarted = useRef(performance.now());
  const storageKey = `neurolearnx-attempt:${userId}:${activityId}`;

  useEffect(() => {
    setActivityData(null);
    api(`/api/student/activities/${activityId}`)
      .then((data: any) => {
        setActivityData(data);
        const duration = Number(data.time_limit_seconds || 300);
        let restored = false;
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (saved?.startedAt && saved?.expiresAt) {
            startedAt.current = saved.startedAt;
            expiresAt.current = saved.expiresAt;
            setAnswers(saved.answers || {});
            setIndex(
              Math.min(
                Math.max(0, Number(saved.index || 0)),
                Math.max(0, data.questions.length - 1),
              ),
            );
            setMuted(Boolean(saved.muted));
            restored = true;
          }
        } catch {
          localStorage.removeItem(storageKey);
        }
        if (!restored) {
          const now = Date.now();
          startedAt.current = new Date(now).toISOString();
          expiresAt.current = now + duration * 1000;
          setAnswers({});
          setIndex(0);
        }
        const initial = remainingSeconds(expiresAt.current);
        previousRemaining.current = initial;
        setRemaining(initial);
        setTimerReady(true);
        questionStarted.current = performance.now();
      })
      .catch((cause) => setError(messageOf(cause)));
  }, [activityId, storageKey]);

  useEffect(() => {
    if (!timerReady || result) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          startedAt: startedAt.current,
          expiresAt: expiresAt.current,
          answers,
          index,
          muted,
        }),
      );
    } catch {
      // Storage can be unavailable in privacy modes; the countdown still works.
    }
  }, [answers, index, muted, result, storageKey, timerReady]);

  function playFinalTick() {
    if (muted) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
    } catch {
      // Audio is optional and may be blocked until user interaction.
    }
  }

  useEffect(() => {
    if (!timerReady || result) return;
    const update = () => {
      const next = remainingSeconds(expiresAt.current);
      if (shouldPlayFinalTick(previousRemaining.current, next)) playFinalTick();
      previousRemaining.current = next;
      setRemaining(next);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [muted, result, timerReady]);

  useEffect(() => {
    if (timerReady && remaining === 0 && !result) void submit();
  }, [remaining, result, timerReady]);

  const current = activityData?.questions[index];
  function commitTime(questionId: number) {
    const elapsed = Math.max(0, (performance.now() - questionStarted.current) / 1000);
    setAnswers((previous) => ({
      ...previous,
      [questionId]: {
        selected_choice_id: previous[questionId]?.selected_choice_id ?? null,
        response_text: previous[questionId]?.response_text ?? "",
        hint_opened: previous[questionId]?.hint_opened ?? false,
        skipped: previous[questionId]?.skipped ?? false,
        answer_changes: previous[questionId]?.answer_changes ?? 0,
        response_seconds:
          (previous[questionId]?.response_seconds || 0) + elapsed,
      },
    }));
    return elapsed;
  }
  function move(next: number) {
    if (current) commitTime(current.id);
    setIndex(next);
    setHintOpen(Boolean(answers[activityData.questions[next]?.id]?.hint_opened));
    questionStarted.current = performance.now();
  }
  function selectChoice(choiceId: number) {
    const previous = answers[current.id];
    setAnswers((all) => ({
      ...all,
      [current.id]: {
        selected_choice_id: choiceId,
        response_text: previous?.response_text || "",
        response_seconds: previous?.response_seconds || 0,
        hint_opened: previous?.hint_opened || hintOpen,
        skipped: false,
        answer_changes:
          (previous?.answer_changes || 0) +
          (previous?.selected_choice_id &&
          previous.selected_choice_id !== choiceId
            ? 1
            : 0),
      },
    }));
  }
  function enterText(value: string) {
    const previous = answers[current.id];
    setAnswers((all) => ({
      ...all,
      [current.id]: {
        selected_choice_id: null,
        response_text: value,
        response_seconds: previous?.response_seconds || 0,
        hint_opened: previous?.hint_opened || hintOpen,
        skipped: false,
        answer_changes:
          (previous?.answer_changes || 0) +
          (previous?.response_text && previous.response_text !== value ? 1 : 0),
      },
    }));
  }
  function openHint() {
    setHintOpen(true);
    setAnswers((all) => ({
      ...all,
      [current.id]: {
        selected_choice_id: all[current.id]?.selected_choice_id || null,
        response_text: all[current.id]?.response_text || "",
        response_seconds: all[current.id]?.response_seconds || 0,
        hint_opened: true,
        skipped: all[current.id]?.skipped || false,
        answer_changes: all[current.id]?.answer_changes || 0,
      },
    }));
  }
  async function submit() {
    if (submissionLock.current || submitting || result || !activityData) return;
    submissionLock.current = true;
    setSubmitting(true);
    setError("");
    const elapsed = current
      ? Math.max(0, (performance.now() - questionStarted.current) / 1000)
      : 0;
    const finalAnswers = { ...answers };
    if (current) {
      const saved = finalAnswers[current.id];
      finalAnswers[current.id] = {
        selected_choice_id: saved?.selected_choice_id ?? null,
        response_text: saved?.response_text ?? "",
        response_seconds: (saved?.response_seconds || 0) + elapsed,
        hint_opened: saved?.hint_opened ?? false,
        skipped: saved?.skipped ?? false,
        answer_changes: saved?.answer_changes ?? 0,
      };
    }
    try {
      const response = await post("/api/student/attempts", {
        activity_id: activityData.id,
        started_at: startedAt.current,
        responses: activityData.questions.map((question: any) => ({
          question_id: question.id,
          selected_choice_id:
            finalAnswers[question.id]?.selected_choice_id || null,
          response_text:
            finalAnswers[question.id]?.response_text || null,
          response_seconds:
            finalAnswers[question.id]?.response_seconds || 0,
          hint_opened: finalAnswers[question.id]?.hint_opened || false,
          skipped:
            finalAnswers[question.id]?.skipped ||
            (!finalAnswers[question.id]?.selected_choice_id &&
              !finalAnswers[question.id]?.response_text?.trim()),
          answer_changes: finalAnswers[question.id]?.answer_changes || 0,
        })),
      });
      setResult(response);
      localStorage.removeItem(storageKey);
      onCompleted();
    } catch (cause) {
      setError(messageOf(cause));
      submissionLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }
  if (error && !activityData)
    return <ErrorNotice message={error} onDismiss={() => setError("")} />;
  if (!activityData) return <Loading label="Opening activity…" />;
  if (activityData.adaptive_tutoring) {
    return <AdaptiveTutor activity={activityData} onCompleted={onCompleted} />;
  }
  if (result && !effortSaved) {
    return (
      <MentalEffort
        attemptId={result.attempt_id}
        boundaries={result.mental_effort_boundaries}
        onSaved={() => {
          setEffortSaved(true);
          onCompleted();
        }}
      />
    );
  }
  if (result && effortSaved) {
    return <AssessmentResult result={result} title={activityData.title} />;
  }
  const selectedId = answers[current.id]?.selected_choice_id;
  const answered = Object.values(answers).filter(
    (answer) => answer.selected_choice_id || answer.response_text.trim(),
  ).length;
  return (
    <>
      <PageHeader
        eyebrow={activityData.is_diagnostic ? "Diagnostic assessment" : "Learning activity"}
        title={activityData.title}
        description={activityData.instructions}
        action={
          <div className="flex items-center gap-2">
            <div
              role="timer"
              aria-live={remaining <= 10 ? "assertive" : "off"}
              className={`rounded-xl px-3 py-2 font-mono text-lg font-black ${
                countdownTone(remaining) === "critical"
                  ? "bg-rose-100 text-rose-700"
                  : countdownTone(remaining) === "warning"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-navy-950 text-white"
              }`}
            >
              <Clock3 className="mr-1.5 inline" size={16} />
              {formatCountdown(remaining)}
            </div>
            <button
              className="icon-button"
              aria-label={muted ? "Unmute final countdown ticks" : "Mute final countdown ticks"}
              onClick={() => setMuted((value) => !value)}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>
        }
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="rounded-2xl bg-white p-5 shadow-soft sm:p-7">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>
              Question {index + 1} of {activityData.questions.length}
            </span>
            <span>{current.points} point</span>
          </div>
          <ProgressBar
            value={(index + 1) / activityData.questions.length}
          />
          <h2 className="mt-7 text-xl font-black leading-8 text-navy-950">
            {current.prompt}
          </h2>
          {current.choices.length > 0 ? (
            <fieldset className="mt-6 space-y-3">
              <legend className="sr-only">Select one answer</legend>
              {current.choices.map((choice: any, choiceIndex: number) => (
              <label
                key={choice.id}
                className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition ${
                  selectedId === choice.id
                    ? "border-cyanx-500 bg-cyan-50"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name={`question-${current.id}`}
                  checked={selectedId === choice.id}
                  onChange={() => selectChoice(choice.id)}
                  className="sr-only"
                />
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${
                    selectedId === choice.id
                      ? "bg-cyanx-500 text-navy-950"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {String.fromCharCode(65 + choiceIndex)}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {choice.text}
                </span>
              </label>
              ))}
            </fieldset>
          ) : (
            <label className="field mt-6">
              <span>
                {current.question_type === "Identification"
                  ? "Your answer"
                  : "Your response"}
              </span>
              <textarea
                value={answers[current.id]?.response_text || ""}
                onChange={(event) => enterText(event.target.value)}
                placeholder={
                  current.question_type === "Identification"
                    ? "Enter the concept or term"
                    : "Write a concise 1–3 sentence response"
                }
                maxLength={5000}
              />
            </label>
          )}
          <div className="mt-5">
            <button
              onClick={openHint}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold text-amber-700 hover:bg-amber-50"
            >
              <Lightbulb size={17} />
              {hintOpen ? "Hint opened" : "Use a hint"}
            </button>
            {hintOpen && (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {current.hint}
              </p>
            )}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              onClick={() => move(index - 1)}
              disabled={index === 0}
              className="btn-secondary"
            >
              <ArrowLeft size={17} /> Previous
            </button>
            <button
              onClick={() => {
                setAnswers((all) => ({
                  ...all,
                  [current.id]: {
                    selected_choice_id: null,
                    response_text: "",
                    response_seconds:
                      all[current.id]?.response_seconds || 0,
                    hint_opened:
                      all[current.id]?.hint_opened || hintOpen,
                    skipped: true,
                    answer_changes:
                      all[current.id]?.answer_changes || 0,
                  },
                }));
                if (index < activityData.questions.length - 1) move(index + 1);
              }}
              className="text-sm font-bold text-slate-500 hover:text-navy-950"
            >
              Skip item
            </button>
            {index < activityData.questions.length - 1 ? (
              <button
                onClick={() => move(index + 1)}
                className="btn-primary"
              >
                Next <ArrowRight size={17} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "Submitting…" : "Submit assessment"}{" "}
                <Check size={17} />
              </button>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-2xl bg-navy-950 p-5 text-white shadow-soft">
          <div className="text-xs font-bold uppercase tracking-widest text-cyanx-400">
            Assessment progress
          </div>
          <div
            className={`mt-4 rounded-xl border p-3 text-center font-mono text-3xl font-black ${
              countdownTone(remaining) === "critical"
                ? "border-rose-400 bg-rose-500/20 text-rose-200"
                : countdownTone(remaining) === "warning"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-white/10 bg-white/5 text-white"
            }`}
          >
            {formatCountdown(remaining)}
          </div>
          <div className="mt-2 text-3xl font-black">
            {answered}
            <span className="text-base font-semibold text-slate-400">
              /{activityData.questions.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {activityData.questions.map((question: any, position: number) => (
              <button
                key={question.id}
                onClick={() => move(position)}
                aria-label={`Go to question ${position + 1}`}
                className={`grid aspect-square place-items-center rounded-lg text-xs font-black ${
                  position === index
                    ? "bg-cyanx-500 text-navy-950"
                    : answers[question.id]?.selected_choice_id ||
                        answers[question.id]?.response_text?.trim()
                      ? "bg-emerald-500/20 text-emerald-300"
                      : answers[question.id]?.skipped
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-white/10 text-slate-300"
                }`}
              >
                {position + 1}
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-400">
            Response time, hint use, skipped items, and answer changes are
            recorded for adaptive analysis.
          </p>
        </aside>
      </div>
    </>
  );
}

function MentalEffort({
  attemptId,
  boundaries,
  onSaved,
}: {
  attemptId: number;
  boundaries: { low_max: number; moderate_max: number };
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setSaving(true);
    try {
      await post(`/api/student/attempts/${attemptId}/mental-effort`, { rating });
      onSaved();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }
  const lowMax = boundaries?.low_max ?? 3;
  const moderateMax = boundaries?.moderate_max ?? 6;
  const category =
    rating <= lowMax ? "Low" : rating <= moderateMax ? "Moderate" : "High";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="One final reflection"
        title="How much mental effort did this activity require?"
        description="Choose the number that best represents your experience. There is no right or wrong answer."
      />
      {error && <ErrorNotice message={error} />}
      <div className="rounded-2xl bg-white p-6 shadow-soft sm:p-9">
        <div className="grid grid-cols-9 gap-2">
          {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              onClick={() => setRating(value)}
              className={`aspect-square rounded-xl text-base font-black transition ${
                rating === value
                  ? "scale-105 bg-cyanx-500 text-navy-950 shadow-lg"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 text-center text-xs font-bold text-slate-500">
          <span>1–{lowMax} Low</span>
          <span>
            {lowMax + 1}–{moderateMax} Moderate
          </span>
          <span>{moderateMax + 1}–9 High</span>
        </div>
        <div className="mt-8 rounded-xl bg-slate-50 p-5 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Your selection
          </div>
          <div className="mt-1 text-2xl font-black text-navy-950">
            {rating} · {category}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={saving}
          className="btn-primary mt-6 w-full"
        >
          {saving ? "Saving reflection…" : "Save and view results"}
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function AssessmentResult({ result, title }: { result: any; title: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Assessment results"
        title="Your evidence has been recorded"
        description="Mastery, learning gaps, and your recommended pathway were recalculated on the server."
      />
      <div className="rounded-2xl bg-navy-950 p-7 text-white shadow-soft">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-cyanx-400">
              {title}
            </div>
            {result.score_visible === false ? (
              <>
                <div className="mt-2 text-2xl font-black">Response submitted</div>
                <div className="mt-1 text-sm text-slate-300">
                  Your teacher has chosen to release scores later.
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-4xl font-black">
                  {result.score}/{result.max_score}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {Math.round(result.accuracy * 100)}% response accuracy
                </div>
              </>
            )}
          </div>
          <CheckCircle2 className="text-cyanx-400" size={64} />
        </div>
      </div>
      {result.explanations_visible === false && (
        <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm font-semibold text-cyan-900">
          Answer explanations are hidden for this assessment. Your response was
          still recorded for teacher review and pathway recalculation.
        </div>
      )}
      <div className="mt-6 space-y-3">
        {result.items.map((item: any, index: number) => (
          <article
            key={item.question_id}
            className="rounded-2xl bg-white p-5 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <Badge tone={item.correct ? "green" : "rose"}>
                {item.correct ? "Correct" : "Review"}
              </Badge>
              <span className="text-sm font-bold text-navy-950">
                Question {index + 1}
              </span>
            </div>
            {!item.correct && (
              <div className="mt-4 grid gap-3 rounded-xl bg-rose-50 p-4 text-sm">
                <p>
                  <span className="font-bold text-slate-500">Your answer:</span>{" "}
                  <strong className="text-navy-950">{item.learner_answer || "No answer"}</strong>
                </p>
                <p>
                  <span className="font-bold text-slate-500">Correct answer:</span>{" "}
                  <strong className="text-navy-950">{item.correct_choice}</strong>
                </p>
                <p><span className="font-bold text-slate-500">Why:</span> {item.why}</p>
                <p><span className="font-bold text-slate-500">Evidence note:</span> {item.likely_mistake}</p>
                <p><span className="font-bold text-slate-500">Review concept:</span> {item.review_concept}</p>
                {item.misconception && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                    <div className="font-black">{item.misconception.code}: {item.misconception.name}</div>
                    <p className="mt-1">{item.misconception.explanation}</p>
                    <p className="mt-2"><strong>Remediation:</strong> {item.misconception.remediation_instruction}</p>
                    <p className="mt-2 text-xs font-bold uppercase">Pattern confidence: {item.misconception.pattern_confidence} ({item.misconception.evidence_count} observations)</p>
                  </div>
                )}
                {item.diagnostic_note && <p className="italic text-slate-600">{item.diagnostic_note}</p>}
                <StructuredSolution solution={item.solution} />
                {Object.keys(item.choice_explanations || {}).length > 0 && (
                  <details>
                    <summary className="cursor-pointer font-bold text-rose-800">
                      Explain each choice
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {Object.entries(item.choice_explanations).map(([choice, explanation]) => (
                        <li key={choice}><strong>{choice}:</strong> {String(explanation)}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.feedback}
            </p>
          </article>
        ))}
      </div>
      {result.summary && (
        <section className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50 p-5 text-sm text-cyan-950">
          <h2 className="font-black">Post-activity learning summary</h2>
          <p className="mt-2">Concepts strengthened: {result.summary.concepts_strengthened?.join(", ") || "More evidence is needed"}</p>
          <p className="mt-1">Errors observed: {result.summary.errors_observed}. {result.summary.next_action}</p>
          <p className="mt-1">Pathway: {result.summary.pathway_changed ? `${result.summary.pathway_before || "Previous route"} to ${result.summary.pathway_after}` : `retained ${result.summary.pathway_after || "the current route"}`}.</p>
        </section>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="btn-primary"
          onClick={() => navigate("/student/pathway")}
        >
          View updated pathway <Route size={17} />
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate("/student/mastery")}
        >
          View mastery report
        </button>
      </div>
    </div>
  );
}

function MasteryReport({ snapshot }: { snapshot: any }) {
  if (!snapshot) return <Loading label="Calculating mastery report…" />;
  return (
    <>
      <PageHeader
        eyebrow="Concept evidence"
        title="Mastery and learning-gap report"
        description="Unassessed concepts are kept separate from failed concepts. Mastery uses the configured latest-attempt or recency-weighted method."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Assessed concepts
          </h2>
          <div className="mt-5 space-y-4">
            {snapshot.mastery.map((row: any) => (
              <div
                key={row.concept_id}
                className="rounded-xl border border-slate-100 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-navy-950">{row.concept}</div>
                    <div className="text-xs text-slate-500">{row.subject}</div>
                  </div>
                  <Badge tone={masteryTone(row.classification)}>
                    {row.classification}
                  </Badge>
                </div>
                <div className="mt-3">
                  <ProgressBar value={row.score} label="Current mastery" />
                </div>
              </div>
            ))}
            {!snapshot.mastery.length && (
              <Empty
                title="No mastery evidence yet"
                description="Complete a diagnostic to calculate concept mastery."
              />
            )}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Identified learning gaps
          </h2>
          <div className="mt-5 space-y-3">
            {snapshot.gaps.map((gap: any) => (
              <div
                key={gap.id}
                className="rounded-xl border border-rose-100 bg-rose-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-navy-950">{gap.concept}</span>
                  <span className="text-sm font-black text-rose-700">
                    {Math.round(gap.mastery_score * 100)}%
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-rose-800">
                  {gap.reason}
                </p>
              </div>
            ))}
            {!snapshot.gaps.length && (
              <Empty
                title="No current assessed gaps"
                description="Concepts without evidence are marked Not Yet Assessed and are not treated as failures."
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function PathwayPage({
  isDemo,
}: {
  onChanged: () => void;
  isDemo: boolean;
}) {
  const [pathways, setPathways] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api<any[]>("/api/student/pathways")
      .then(setPathways)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(load, [load]);
  if (!pathways) return <Loading label="Ranking learning pathways…" />;
  if (!pathways.length)
    return (
      <Empty
        title="No pathway yet"
        description="Choose a target competency to generate prerequisite-aware candidates."
        action={
          <Link to="/student/targets" className="btn-primary inline-flex">
            Choose a target
          </Link>
        }
      />
    );
  const selected = pathways.find((pathway) => pathway.selected) || pathways[0];
  const decision = selected.decision_explanation || {};
  return (
    <>
      <PageHeader
        eyebrow="Personalized recommendation"
        title={selected.label}
        description={`Recommended for ${selected.target_concept}. Candidate pathways are ranked using gap coverage, expected cognitive load, and normalized learning time.`}
        action={
          <div className="rounded-xl bg-navy-950 px-4 py-3 text-white">
            <div className="text-[10px] font-bold uppercase tracking-widest text-cyanx-400">
              Adaptive score
            </div>
            <div className="text-xl font-black">
              {selected.adaptive_pathway_score.toFixed(3)}
            </div>
          </div>
        }
      />
      {error && <ErrorNotice message={error} />}
      {isDemo && <DemoNotice />}
      {selected.source_type === "Teacher" && (
        <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <Badge tone="cyan">Teacher assigned</Badge>
          <p className="mt-3 text-sm leading-6 text-cyan-950">
            {selected.teacher_note || "Your teacher reviewed and assigned this pathway."}
          </p>
          {selected.due_at && (
            <p className="mt-2 text-xs font-black text-cyan-900">
              Due {new Date(selected.due_at).toLocaleString()}
            </p>
          )}
        </section>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Gap coverage"
          value={`${Math.round(selected.gap_coverage * 100)}%`}
          icon={<Target size={20} />}
        />
        <MetricCard
          label="Expected load index"
          value={selected.predicted_cognitive_load.toFixed(2)}
          detail={selected.cognitive_load_category}
          icon={<Brain size={20} />}
          tone="cyan"
        />
        <MetricCard
          label="Normalized time"
          value={selected.normalized_learning_time.toFixed(2)}
          icon={<Gauge size={20} />}
          tone="amber"
        />
        <MetricCard
          label="Estimated time"
          value={`${selected.total_minutes} min`}
          icon={<Clock3 size={20} />}
          tone="rose"
        />
      </div>
      <details className="mt-6 rounded-2xl border border-cyan-200 bg-white shadow-soft" open>
        <summary className="cursor-pointer px-6 py-4 text-lg font-black text-navy-950">
          Why this activity and pathway were selected
        </summary>
        <div className="grid gap-5 border-t border-slate-100 p-6 text-sm leading-6 lg:grid-cols-2">
          <section>
            <h3 className="font-black text-navy-950">Mastery gap and target</h3>
            <dl className="mt-3 grid gap-2">
              <div><dt className="inline font-bold text-slate-500">Current target mastery: </dt><dd className="inline">{decision.current_mastery == null ? "Not yet assessed" : `${Math.round(decision.current_mastery * 100)}%`}</dd></div>
              <div><dt className="inline font-bold text-slate-500">Configured threshold: </dt><dd className="inline">{decision.mastery_threshold == null ? "Not available" : `${Math.round(decision.mastery_threshold * 100)}%`}</dd></div>
              <div><dt className="inline font-bold text-slate-500">Target competency: </dt><dd className="inline">{decision.target_competency?.code} {decision.target_competency?.name}</dd></div>
              <div><dt className="inline font-bold text-slate-500">Prerequisite chain: </dt><dd className="inline">{decision.prerequisite_chain?.join(" to ") || "No prerequisite gap"}</dd></div>
              {decision.selected_gap && <div><dt className="inline font-bold text-slate-500">Selected gap: </dt><dd className="inline">{decision.selected_gap.concept}. {decision.selected_gap.reason}</dd></div>}
            </dl>
          </section>
          <section>
            <h3 className="font-black text-navy-950">Decision evidence</h3>
            <p className="mt-3">{decision.activity_benefit}</p>
            <p className="mt-2"><strong>Selection rule:</strong> {decision.selection_reason}</p>
            <p className="mt-2"><strong>Confidence:</strong> {decision.confidence?.level || selected.evidence_confidence}</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{(decision.confidence?.criteria || []).map((item: string) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-black text-navy-950">Score and cognitive load</h3>
            <p className="mt-2 font-mono text-xs">{decision.formula}</p>
            <p className="mt-2">APS {Number(decision.adaptive_pathway_score ?? selected.adaptive_pathway_score).toFixed(3)}; expected load {Number(decision.cognitive_load?.index ?? selected.predicted_cognitive_load).toFixed(2)} ({decision.cognitive_load?.category || selected.cognitive_load_category}); estimated time {decision.estimated_time_minutes ?? selected.total_minutes} minutes.</p>
          </section>
          <section className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-black text-navy-950">Estimated improvement</h3>
            <p className="mt-2">{decision.expected_improvement?.message || "Comparable evidence is not yet available."}</p>
          </section>
          {!!decision.alternatives_not_selected?.length && (
            <section className="lg:col-span-2">
              <h3 className="font-black text-navy-950">Why alternatives were not selected</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{decision.alternatives_not_selected.map((item: any) => <div key={item.label} className="rounded-xl border border-slate-200 p-4"><div className="font-black text-navy-950">{item.label} - APS {Number(item.adaptive_pathway_score).toFixed(3)}</div><p className="mt-1 text-slate-600">{item.why_not_selected}</p></div>)}</div>
            </section>
          )}
          {!!selected.versions?.length && (
            <section className="lg:col-span-2 rounded-xl border border-cyan-100 bg-cyan-50 p-4">
              <h3 className="font-black text-cyan-950">Recommendation history</h3>
              {selected.versions.map((version: any) => <p key={version.id} className="mt-2 text-xs text-cyan-900">Version {version.version_number} - {version.trigger_type}: {version.change_reason}</p>)}
            </section>
          )}
        </div>
      </details>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-navy-950">Recommended sequence</h2>
        <div className="mt-5 space-y-3">
          {selected.steps.map((step: any, index: number) => (
            <article
              key={step.id}
              className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:flex-wrap sm:items-center ${
                step.completed_at
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-100"
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black ${
                  step.completed_at
                    ? "bg-emerald-500 text-white"
                    : "bg-navy-950 text-cyanx-400"
                }`}
              >
                {step.completed_at ? <Check size={19} /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-cyanx-600">
                  {step.concept}
                </div>
                <div className="mt-0.5 font-bold text-navy-950">
                  {step.activity}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {step.estimated_minutes} min · Expected load{" "}
                  {step.predicted_load_index.toFixed(2)}
                </div>
              </div>
              {!step.completed_at && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/student/activity/${step.activity_id}`}
                    className="btn-primary"
                  >
                    Open mastery check <ArrowRight size={16} />
                  </Link>
                </div>
              )}
              <p className="w-full rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <strong>Why this step:</strong> {step.selection_reason}
              </p>
              {step.content && (
                <details className="w-full rounded-xl border border-slate-200 bg-white" open={index === 0 && !step.completed_at}>
                  <summary className="cursor-pointer px-4 py-3 text-sm font-black text-navy-950">
                    Study lesson: explanation, example, and practice
                  </summary>
                  <div className="space-y-5 border-t border-slate-100 p-4 text-sm leading-6 text-slate-700">
                    {step.content.adaptation && (
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950">
                        <Badge tone="cyan">{step.content.adaptation.depth} lesson depth</Badge>
                        <p className="mt-2 text-xs">{step.content.adaptation.reason}</p>
                      </div>
                    )}
                    <section>
                      <h3 className="font-black text-navy-950">Concept explanation</h3>
                      <p className="mt-1">{step.content.explanation}</p>
                      <p className="mt-2"><strong>Why it matters:</strong> {step.content.importance}</p>
                    </section>
                    <section className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <h3 className="font-black text-navy-950">Key terms</h3>
                        <ul className="mt-2 list-disc pl-5">
                          {(step.content.key_terms || []).map((term: string) => <li key={term}>{term}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <h3 className="font-black text-navy-950">Formulas</h3>
                        <ul className="mt-2 space-y-1 font-mono">
                          {(step.content.formulas || []).map((formula: string) => <li key={formula}>{formula}</li>)}
                        </ul>
                      </div>
                    </section>
                    <section className="grid gap-4 sm:grid-cols-2">
                      {(step.content.sections || []).filter((section: any) => ["misconceptions", "extension"].includes(section.type)).map((section: any) => (
                        <div key={section.type} className="rounded-xl border border-slate-200 p-4">
                          <h3 className="font-black text-navy-950">{section.title}</h3>
                          <p className="mt-1">{section.content}</p>
                        </div>
                      ))}
                    </section>
                    <section>
                      <h3 className="font-black text-navy-950">Worked example</h3>
                      <p className="mt-1 font-semibold">{step.content.worked_example?.problem}</p>
                      <ol className="mt-2 list-decimal pl-5">
                        {(step.content.worked_example?.steps || []).map((item: string) => <li key={item}>{item}</li>)}
                      </ol>
                      <p className="mt-2 rounded-lg bg-emerald-50 p-3 font-bold text-emerald-900">
                        Answer: {step.content.worked_example?.answer}
                      </p>
                    </section>
                    <section className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <h3 className="font-black text-navy-950">Guided practice</h3>
                        <p className="mt-1">{step.content.guided_practice?.prompt}</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer font-bold text-amber-800">Reveal hint</summary>
                          <p className="mt-1">{step.content.guided_practice?.hint}</p>
                        </details>
                      </div>
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                        <h3 className="font-black text-navy-950">Independent practice</h3>
                        <p className="mt-1">{step.content.independent_practice}</p>
                      </div>
                    </section>
                    <section className="flex flex-col gap-3 rounded-xl bg-navy-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-black">Mastery check</h3>
                        <p className="mt-1 text-xs text-slate-300">
                          {step.content.mastery_check?.evidence_required}
                        </p>
                      </div>
                      <Link to={`/student/activity/${step.activity_id}`} className="btn-primary">
                        Begin mastery check <ArrowRight size={16} />
                      </Link>
                    </section>
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-navy-950">
          Candidate comparison
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {pathways.map((pathway) => (
            <article
              key={pathway.id}
              className={`rounded-2xl border bg-white p-5 shadow-soft ${
                pathway.selected ? "border-cyanx-500" : "border-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-navy-950">{pathway.label}</h3>
                {pathway.selected && <Badge tone="cyan">Recommended</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-slate-500">APS</div>
                  <div className="mt-1 font-black text-navy-950">
                    {pathway.adaptive_pathway_score.toFixed(3)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-slate-500">Time</div>
                  <div className="mt-1 font-black text-navy-950">
                    {pathway.total_minutes} min
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function PrerequisiteMap() {
  const [graph, setGraph] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/student/graph")
      .then(setGraph)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  const flow = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[] };
    const byId = new globalThis.Map<number, any>(
      graph.nodes.map((node: any) => [node.id, node]),
    );
    const depth = new Map<number, number>();
    graph.nodes.forEach((node: any) => {
      const incoming = graph.edges.filter((edge: any) => edge.target === node.id);
      depth.set(
        node.id,
        incoming.length
          ? Math.max(...incoming.map((edge: any) => depth.get(edge.source) || 0)) + 1
          : 0,
      );
    });
    const counts: Record<number, number> = {};
    const nodes: Node[] = graph.nodes.map((node: any) => {
      const level = depth.get(node.id) || 0;
      const column = counts[level] || 0;
      counts[level] = column + 1;
      return {
        id: String(node.id),
        position: { x: level * 265, y: column * 130 },
        data: {
          label: (
            <div className="min-w-40 text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                {node.code}
              </div>
              <div className="mt-1 text-sm font-black">{node.name}</div>
              <div className="mt-1 text-[11px] opacity-70">
                {node.mastery_score == null
                  ? "Not Yet Assessed"
                  : `${Math.round(node.mastery_score * 100)}% · ${node.classification}`}
              </div>
            </div>
          ),
        },
        style: {
          borderRadius: 14,
          border: node.is_target
            ? "2px solid #0bb7c9"
            : node.is_gap
              ? "2px solid #fb7185"
              : "1px solid #dbe4ea",
          background: node.is_target
            ? "#071b34"
            : node.is_gap
              ? "#fff1f2"
              : "#ffffff",
          color: node.is_target ? "white" : "#071b34",
          padding: 14,
          boxShadow: "0 8px 24px rgba(7,27,52,.08)",
        },
      };
    });
    const edges: Edge[] = graph.edges.map((edge: any) => ({
      id: String(edge.id),
      source: String(edge.source),
      target: String(edge.target),
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#079bb0", strokeWidth: 2 },
      ariaLabel: `${byId.get(edge.source)?.name} is a prerequisite of ${byId.get(edge.target)?.name}`,
    }));
    return { nodes, edges };
  }, [graph]);
  if (error) return <ErrorNotice message={error} />;
  if (!graph) return <Loading label="Tracing prerequisite ancestors…" />;
  return (
    <>
      <PageHeader
        eyebrow="Educational knowledge graph"
        title="Interactive prerequisite map"
        description="Arrows point from foundational concepts to the concepts that depend on them. Pink nodes are assessed gaps; dark navy is your target."
      />
      {!graph.nodes.length ? (
        <Empty
          title="Choose a target first"
          description="The relevant prerequisite subgraph will appear after target selection."
        />
      ) : (
        <div className="h-[650px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            fitView
            minZoom={0.4}
            maxZoom={1.6}
          >
            <Background gap={24} color="#dbe4ea" />
            <Controls />
          </ReactFlow>
        </div>
      )}
    </>
  );
}

function ExplanationPage({ snapshot }: { snapshot: any }) {
  if (!snapshot) return <Loading label="Preparing recommendation explanation…" />;
  const pathway = snapshot.pathway;
  if (!pathway)
    return (
      <Empty
        title="No recommendation to explain"
        description="Choose a target competency to generate a pathway."
      />
    );
  const decision = pathway.decision_explanation || {};
  return (
    <>
      <PageHeader
        eyebrow="Explainable recommendation"
        title="Why this pathway was selected"
        description="The explanation separates model probabilities, mastery evidence, graph constraints, and optimization scores."
      />
      {snapshot.student.is_demo && <DemoNotice />}
      <article className="mt-6 rounded-2xl bg-navy-950 p-7 text-white shadow-soft">
        <Sparkles className="text-cyanx-400" size={28} />
        <p className="mt-4 text-lg font-semibold leading-8">
          {pathway.explanation}
        </p>
      </article>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-navy-950">Actual recommendation decision chain</h2>
          <Badge tone={pathway.evidence_confidence === "High" ? "green" : pathway.evidence_confidence === "Moderate" ? "amber" : "rose"}>{pathway.evidence_confidence} evidence confidence</Badge>
        </div>
        <ol className="mt-5 grid gap-3 text-sm leading-6 sm:grid-cols-2">
          <li className="rounded-xl bg-slate-50 p-4"><strong>1. Target and gap:</strong> {decision.target_competency?.name}; mastery {decision.current_mastery == null ? "not yet assessed" : `${Math.round(decision.current_mastery * 100)}%`} against {decision.mastery_threshold == null ? "the configured" : `${Math.round(decision.mastery_threshold * 100)}%`} threshold.</li>
          <li className="rounded-xl bg-slate-50 p-4"><strong>2. Graph constraint:</strong> {(decision.prerequisite_chain || []).join(" to ") || "No missing prerequisite"}.</li>
          <li className="rounded-xl bg-slate-50 p-4"><strong>3. Evidence:</strong> {decision.evidence_used?.valid_response_count || 0} valid responses, {decision.evidence_used?.history_items || 0} interaction records, and {decision.evidence_used?.effort_category || "unrated"} mental effort.</li>
          <li className="rounded-xl bg-slate-50 p-4"><strong>4. Optimization:</strong> {decision.formula}; selected APS {Number(pathway.adaptive_pathway_score).toFixed(3)}.</li>
          <li className="rounded-xl bg-slate-50 p-4 sm:col-span-2"><strong>5. Selection:</strong> {decision.selection_reason}</li>
        </ol>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Cognitive-load probabilities
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Expected load is a summary of model probabilities, not a direct
            psychological measurement.
          </p>
          <div className="mt-5 space-y-4">
            {Object.entries(pathway.cognitive_load_probabilities).map(
              ([label, value]) => (
                <ProgressBar
                  key={label}
                  value={value as number}
                  label={`${label} probability`}
                />
              ),
            )}
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Expected index formula</div>
            <div className="mt-1 font-mono text-sm font-bold text-navy-950">
              0·P(Low) + 0.5·P(Moderate) + 1·P(High) ={" "}
              {pathway.predicted_cognitive_load.toFixed(3)}
            </div>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Influential features
          </h2>
          <div className="mt-2 text-xs text-slate-500">
            Method: {pathway.feature_explanation.method}
          </div>
          <div className="mt-5 space-y-3">
            {Object.entries(pathway.feature_explanation.features || {}).map(
              ([feature, importance]) => (
                <div
                  key={feature}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <span className="text-sm font-semibold capitalize text-slate-700">
                    {feature.replaceAll("_", " ")}
                  </span>
                  <span className="font-mono text-xs font-black text-cyan-800">
                    {Number(importance).toFixed(3)}
                  </span>
                </div>
              ),
            )}
          </div>
          {pathway.feature_explanation.warning && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              {pathway.feature_explanation.warning}
            </p>
          )}
        </section>
      </div>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-navy-950">
          Multi-objective score
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["GC", pathway.gap_coverage],
            ["PCL", pathway.predicted_cognitive_load],
            ["NLT", pathway.normalized_learning_time],
            ["APS", pathway.adaptive_pathway_score],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-black text-navy-950">
                {Number(value).toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function HistoryPage({ snapshot }: { snapshot: any }) {
  if (!snapshot) return <Loading label="Loading progress history…" />;
  return (
    <>
      <PageHeader
        eyebrow="Progress history"
        title="Assessment and activity evidence"
        description="Your scores and reported mental effort are shown chronologically. Only you and authorized teachers can view this information."
      />
      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Mental effort</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recent_attempts.map((attempt: any) => (
                <tr key={attempt.id}>
                  <td className="font-bold text-navy-950">
                    {attempt.activity}
                  </td>
                  <td>
                    {attempt.score}/{attempt.max_score}
                  </td>
                  <td>{Math.round(attempt.accuracy * 100)}%</td>
                  <td>
                    {attempt.mental_effort ? (
                      <Badge
                        tone={
                          attempt.mental_effort_category === "High"
                            ? "rose"
                            : attempt.mental_effort_category === "Moderate"
                              ? "amber"
                              : "green"
                        }
                      >
                        {attempt.mental_effort} ·{" "}
                        {attempt.mental_effort_category}
                      </Badge>
                    ) : (
                      "Pending"
                    )}
                  </td>
                  <td>{new Date(attempt.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!snapshot.recent_attempts.length && (
          <div className="p-6">
            <Empty
              title="No activity history"
              description="Completed assessments will appear here."
            />
          </div>
        )}
      </div>
    </>
  );
}

function ProfilePage({ user }: { user: User }) {
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await post("/api/auth/change-password", form);
      setMessage("Password updated successfully.");
      setForm({ current_password: "", new_password: "" });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Account settings"
        title="Profile and password"
        description="Demo credentials must be changed before any real deployment."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-navy-950 p-7 text-white shadow-soft">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-500 text-navy-950">
            <UserRound size={27} />
          </span>
          <div className="mt-5 text-2xl font-black">{user.display_name}</div>
          <div className="mt-1 text-sm text-slate-300">
            Student ID: {user.participant_code}
          </div>
          <div className="mt-5 flex gap-2">
            <Badge tone="cyan">Grade 12</Badge>
            <Badge tone="cyan">STEM</Badge>
            <Badge tone="green">{user.account_status || "Active"}</Badge>
            {user.is_demo && <Badge tone="amber">Demo</Badge>}
          </div>
          <dl className="mt-7 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Account created</dt>
              <dd className="mt-1 font-bold">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Last successful sign-in</dt>
              <dd className="mt-1 font-bold">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Not recorded"}
              </dd>
            </div>
          </dl>
        </section>
        <form
          onSubmit={submit}
          className="rounded-2xl bg-white p-7 shadow-soft"
        >
          <div className="flex items-center gap-3">
            <KeyRound className="text-cyanx-600" size={22} />
            <h2 className="text-lg font-black text-navy-950">
              Change password
            </h2>
          </div>
          {error && <div className="mt-4"><ErrorNotice message={error} /></div>}
          {message && (
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              {message}
            </div>
          )}
          <label className="field mt-5">
            <span>Current password</span>
            <input
              type="password"
              value={form.current_password}
              onChange={(event) =>
                setForm({ ...form, current_password: event.target.value })
              }
              required
            />
          </label>
          <label className="field mt-4">
            <span>New password</span>
            <input
              type="password"
              value={form.new_password}
              onChange={(event) =>
                setForm({ ...form, new_password: event.target.value })
              }
              minLength={10}
              required
            />
            <small>Use at least 10 characters.</small>
          </label>
          <button disabled={saving} className="btn-primary mt-6 w-full">
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </>
  );
}
