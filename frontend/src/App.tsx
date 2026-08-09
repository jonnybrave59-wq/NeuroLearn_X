import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, inlineApiError, post } from "./api";
import { ForgotPasswordPage, StudentRegistrationPage } from "./AuthPages";
import { Brand, ErrorNotice, Loading } from "./components";
import DownloadPage from "./DownloadPage";
import HomePage from "./HomePage";
import { cacheAuthenticatedUser, clearOfflineSession } from "./offline";
import { InstallButton } from "./pwa";
import { subscribeConnection } from "./connection";
import StudentApp from "./StudentApp";
import TeacherApp from "./TeacherApp";

type User = {
  id: number;
  participant_code: string;
  display_name: string;
  role: "student" | "teacher";
  must_change_password: boolean;
  is_demo: boolean;
  account_status?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
};

function messageOf(error: unknown) {
  return inlineApiError(error);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const protectedRouteAtStartup = useRef(
    /^#\/(student|teacher)(?:\/|$)/.test(window.location.hash),
  );

  useEffect(() => {
    return subscribeConnection((connection) => {
      if (connection.kind === "session-expired") {
        void clearOfflineSession();
        setUser(null);
        setChecking(false);
      }
    });
  }, []);

  useEffect(() => {
    const restoreWorkspace = () => {
      setRetryGeneration((value) => value + 1);
      if (
        protectedRouteAtStartup.current ||
        /^#\/(student|teacher)(?:\/|$)/.test(window.location.hash)
      ) {
        void api<User>("/api/auth/me")
          .then(async (authenticatedUser) => {
            setUser(authenticatedUser);
            await cacheAuthenticatedUser(authenticatedUser);
          })
          .catch(() => setUser(null));
      }
    };
    window.addEventListener("neurolearnx-reconnected", restoreWorkspace);
    return () =>
      window.removeEventListener("neurolearnx-reconnected", restoreWorkspace);
  }, []);

  useEffect(() => {
    api<User>("/api/auth/me", {
      suppressSessionExpiry: !protectedRouteAtStartup.current,
    })
      .then((authenticatedUser) => {
        setUser(authenticatedUser);
        return cacheAuthenticatedUser(authenticatedUser);
      })
      .catch((cause) => {
        setUser(null);
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
          clearOfflineSession().catch(() => undefined);
        }
      })
      .finally(() => setChecking(false));
  }, []);
  async function logout() {
    try {
      await post("/api/auth/logout");
    } finally {
      await clearOfflineSession();
      setUser(null);
    }
  }
  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950 text-white">
        <div>
          <Brand />
          <Loading label="Opening secure workspace…" />
        </div>
      </div>
    );
  }
  if (user?.must_change_password && !user.is_demo) {
    return (
      <PasswordChangeGate
        user={user}
        onChanged={() =>
          setUser((current) =>
            current ? { ...current, must_change_password: false } : current,
          )
        }
        onLogout={logout}
      />
    );
  }
  return (
    <Routes>
      <Route path="/download" element={<DownloadPage />} />
      <Route
        path="/register/student"
        element={<StudentRegistrationPage onRegistered={setUser} />}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === "student" ? "/student" : "/teacher"} replace />
          ) : (
            <HomePage />
          )
        }
      />
      <Route
        path="/login/:role"
        element={
          user ? (
            <Navigate to={user.role === "student" ? "/student" : "/teacher"} replace />
          ) : (
            <LoginPage onLogin={setUser} />
          )
        }
      />
      <Route
        path="/student/*"
        element={
          user?.role === "student" ? (
            <StudentApp key={retryGeneration} user={user} onLogout={logout} />
          ) : user ? (
            <Navigate to="/teacher" replace />
          ) : (
            <Navigate to="/login/student" replace />
          )
        }
      />
      <Route
        path="/teacher/*"
        element={
          user?.role === "teacher" ? (
            <TeacherApp key={retryGeneration} user={user} onLogout={logout} />
          ) : user ? (
            <Navigate to="/student" replace />
          ) : (
            <Navigate to="/login/teacher" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PasswordChangeGate({
  user,
  onChanged,
  onLogout,
}: {
  user: User;
  onChanged: () => void;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      onChanged();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f7fa] px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <Brand />
        <div className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
          Account protection
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-950">
          Change your assigned password
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {user.display_name}, research accounts must replace their assigned
          default password before student or teacher records can be opened.
        </p>
        {error && (
          <div className="mt-5">
            <ErrorNotice message={error} onDismiss={() => setError("")} />
          </div>
        )}
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={10}
              required
            />
            <small>Use at least 10 characters and do not reuse the assigned password.</small>
          </label>
          <button disabled={saving} className="btn-primary w-full">
            {saving ? "Securing account…" : "Change password and continue"}
            <ArrowRight size={17} />
          </button>
        </form>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-navy-950"
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

function RoleSelection() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-950 px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -right-36 -top-36 h-[500px] w-[500px] rounded-full bg-cyanx-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-36 h-[500px] w-[500px] rounded-full bg-cyanx-600/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-6">
          <Brand />
          <div className="flex items-center gap-3">
            <Link
              to="/download"
              className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
            >
              Download app
            </Link>
            <div className="hidden items-center gap-2 text-xs font-semibold text-slate-300 md:flex">
              <ShieldCheck size={16} className="text-cyanx-400" />
              Grade 12 STEM research prototype
            </div>
          </div>
        </header>
        <section className="my-auto grid items-center gap-12 py-14 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyanx-500/20 bg-cyanx-500/10 px-3 py-1.5 text-xs font-bold text-cyanx-400">
              <Sparkles size={14} />
              Explainable · Adaptive · Evidence-based
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl xl:text-6xl">
              Learn the prerequisite,{" "}
              <span className="text-cyanx-400">not just the next lesson.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              NeuroLearn-X combines ensemble machine learning, concept mastery,
              and a knowledge graph to recommend a transparent learning pathway
              for General Physics.
            </p>
            <div className="mt-8 grid max-w-xl gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {[
                "Server-validated assessments",
                "Prerequisite gap diagnosis",
                "Multi-objective pathway ranking",
                "Plain-language explanations",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="text-cyanx-400" size={17} />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-7">
              <InstallButton className="btn-primary" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Link
              to="/login/student"
              className="group flex min-h-[360px] flex-col rounded-3xl bg-white p-7 text-navy-950 shadow-2xl shadow-black/20 transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyanx-400"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-100 text-cyan-800">
                <GraduationCap size={27} />
              </span>
              <div className="mt-auto">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
                  I am a learner
                </div>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Student Mode
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Take diagnostics, view mastery, follow your pathway, and see
                  why each activity was selected.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-navy-950">
                  Enter student workspace
                  <ArrowRight
                    className="transition group-hover:translate-x-1"
                    size={18}
                  />
                </div>
              </div>
            </Link>
            <Link
              to="/login/teacher"
              className="group flex min-h-[360px] flex-col rounded-3xl border border-white/15 bg-white/[0.07] p-7 text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.11] focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyanx-400"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-500 text-navy-950">
                <Users size={27} />
              </span>
              <div className="mt-auto">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-400">
                  I am an educator
                </div>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Teacher Mode
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Manage the knowledge graph, activities, model training,
                  pathway evaluation, and anonymized research exports.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-cyanx-400">
                  Enter teacher workspace
                  <ArrowRight
                    className="transition group-hover:translate-x-1"
                    size={18}
                  />
                </div>
              </div>
            </Link>
          </div>
        </section>
        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Hinatuan National Comprehensive High School · Research prototype</span>
          <span>
            Predictions support learning decisions—not medical or psychological
            diagnoses.
          </span>
        </footer>
      </div>
    </main>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const { role } = useParams();
  const navigate = useNavigate();
  const expectedRole = role === "teacher" ? "teacher" : "student";
  const [participantCode, setParticipantCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setParticipantCode("");
    setPassword("");
    setError("");
  }, [expectedRole]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await post<User>("/api/auth/login", {
        participant_code: participantCode,
        password,
        expected_role: expectedRole,
      });
      await cacheAuthenticatedUser(user);
      setParticipantCode("");
      setPassword("");
      setShowPassword(false);
      onLogin(user);
      navigate(user.role === "student" ? "/student" : "/teacher");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="grid min-h-screen bg-[#f3f7fa] lg:grid-cols-[0.88fr_1.12fr]">
      <section className="relative hidden overflow-hidden bg-navy-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cyanx-500/10 blur-3xl" />
        <Brand />
        <div className="relative my-auto max-w-lg">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-500 text-navy-950">
            {expectedRole === "student" ? (
              <GraduationCap size={27} />
            ) : (
              <BrainCircuit size={27} />
            )}
          </span>
          <h1 className="mt-7 text-4xl font-black tracking-tight">
            {expectedRole === "student"
              ? "Your next step should make sense."
              : "Every recommendation should be inspectable."}
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-300">
            {expectedRole === "student"
              ? "Sign in with your assigned participant code to access only your own mastery, gaps, and pathway."
              : "Sign in to manage educational content, review learner evidence, train models, and export anonymized data."}
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-slate-400">
          <LockKeyhole size={15} className="text-cyanx-400" />
          Passwords are securely hashed; sessions use HTTP-only cookies.
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-navy-950"
          >
            <ArrowLeft size={17} /> Back to role selection
          </Link>
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
            {expectedRole} mode
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-950">
            Welcome to NeuroLearn-X
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Enter the credentials assigned for this research prototype.
          </p>
          {error && (
            <div className="mt-5">
              <ErrorNotice message={error} onDismiss={() => setError("")} />
            </div>
          )}
          <form
            onSubmit={submit}
            className="mt-7 space-y-5"
            autoComplete="off"
          >
            <label className="field">
              <span>
                {expectedRole === "student"
                  ? "Student ID, username, or email"
                  : "Teacher code or email"}
              </span>
              <input
                key={`${expectedRole}-participant-code`}
                name={`${expectedRole}_participant_code`}
                autoComplete="one-time-code"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                data-protonpass-ignore="true"
                value={participantCode}
                onChange={(event) => setParticipantCode(event.target.value)}
                placeholder={
                  expectedRole === "student" ? "e.g. STEM001" : "e.g. TEACHER01"
                }
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <div className="relative">
                <input
                  key={`${expectedRole}-password`}
                  name={`${expectedRole}_password`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="!pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <button disabled={submitting} className="btn-primary w-full !py-3.5">
              {submitting ? "Signing in…" : `Enter ${expectedRole} mode`}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
            <Link to="/forgot-password" className="text-cyan-700 hover:text-cyan-900">
              Forgot Password?
            </Link>
            {expectedRole === "student" && (
              <Link to="/register/student" className="text-navy-950 hover:text-cyan-700">
                Create Student Account
              </Link>
            )}
          </div>
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === "true") && (
            <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-xs leading-5 text-cyan-900">
              <strong>Development demo:</strong>{" "}
              {expectedRole === "student"
                ? "STEM001 / LearnX!2026"
                : "TEACHER01 / NeuroTeach!2026"}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
