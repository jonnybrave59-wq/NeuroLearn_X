import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { inlineApiError, post } from "./api";
import { Brand, ErrorNotice } from "./components";
import { cacheAuthenticatedUser } from "./offline";

function messageOf(error: unknown) {
  return inlineApiError(error);
}

export function StudentRegistrationPage({
  onRegistered,
}: {
  onRegistered?: (user: any) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    confirm_password: "",
    grade_level: "Grade 12",
    section: "",
    accept_terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const result = await post<{ message: string }>(
        "/api/auth/register/student",
        {
          ...form,
          email: form.email || null,
          username: form.username || null,
          section: form.section || null,
        },
      );
      setSuccess(`${result.message} Opening your welcome…`);
      const user = await post<any>("/api/auth/login", {
        participant_code: form.student_id,
        password: form.password,
        expected_role: "student",
      });
      await cacheAuthenticatedUser(user);
      onRegistered?.(user);
      navigate("/student/onboarding", { replace: true });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7fa] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-navy-950"
          >
            <ArrowLeft size={17} /> Back to home
          </Link>
        </header>
        <div className="mt-9 grid overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="bg-navy-950 p-8 text-white sm:p-10">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-500 text-navy-950">
              <GraduationCap size={28} />
            </span>
            <h1 className="mt-7 text-3xl font-black tracking-tight">
              Create your student account
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Your account keeps diagnostic results, mastery records, learning
              gaps, and pathway progress connected to you.
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-300">
              {[
                "Securely hashed password",
                "Private student-only dashboard",
                "Teacher-supervised account recovery",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 size={17} className="text-cyanx-400" />
                  {item}
                </div>
              ))}
            </div>
          </aside>
          <section className="p-6 sm:p-9">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
              Student registration
            </div>
            <h2 className="mt-2 text-2xl font-black text-navy-950">
              Account information
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Complete all required fields. Use an email address or a username
              for account identification.
            </p>
            {error && (
              <div className="mt-5">
                <ErrorNotice message={error} onDismiss={() => setError("")} />
              </div>
            )}
            {success && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
              >
                {success} Redirecting to sign in…
              </div>
            )}
            <form onSubmit={submit} className="mt-7 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field">
                  <span>Student ID *</span>
                  <input
                    value={form.student_id}
                    onChange={(event) =>
                      update("student_id", event.target.value.toUpperCase())
                    }
                    placeholder="e.g. STEM012"
                    pattern="[A-Za-z0-9_-]{3,40}"
                    required
                  />
                </label>
                <label className="field">
                  <span>Grade level *</span>
                  <select
                    value={form.grade_level}
                    onChange={(event) => update("grade_level", event.target.value)}
                    required
                  >
                    <option>Grade 11</option>
                    <option>Grade 12</option>
                  </select>
                </label>
                <label className="field">
                  <span>First name *</span>
                  <input
                    value={form.first_name}
                    onChange={(event) => update("first_name", event.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </label>
                <label className="field">
                  <span>Last name *</span>
                  <input
                    value={form.last_name}
                    onChange={(event) => update("last_name", event.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </label>
                <label className="field">
                  <span>Email address</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    autoComplete="email"
                    placeholder="student@example.edu"
                  />
                </label>
                <label className="field">
                  <span>Username</span>
                  <input
                    value={form.username}
                    onChange={(event) => update("username", event.target.value)}
                    autoComplete="username"
                    placeholder="student.username"
                  />
                  <small>Provide an email address or username.</small>
                </label>
                <label className="field">
                  <span>Section</span>
                  <input
                    value={form.section}
                    onChange={(event) => update("section", event.target.value)}
                    placeholder="e.g. STEM A"
                  />
                </label>
                <div />
                <label className="field">
                  <span>Password *</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => update("password", event.target.value)}
                      autoComplete="new-password"
                      minLength={10}
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
                  <small>10+ characters with uppercase, lowercase, number, and symbol.</small>
                </label>
                <label className="field">
                  <span>Confirm password *</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.confirm_password}
                    onChange={(event) =>
                      update("confirm_password", event.target.value)
                    }
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-cyan-600"
                  checked={form.accept_terms}
                  onChange={(event) =>
                    update("accept_terms", event.target.checked)
                  }
                  required
                />
                <span>
                  I accept the terms and privacy notice and understand that this
                  is an educational research prototype, not a diagnostic tool.
                </span>
              </label>
              <button disabled={saving || Boolean(success)} className="btn-primary w-full sm:w-auto">
                {saving ? "Creating account…" : "Create Student Account"}
                <ArrowRight size={17} />
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await post<{ message: string }>("/api/auth/forgot-password", {
        identifier,
      });
      setMessage(result.message);
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
        <span className="mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-cyanx-100 text-cyan-800">
          <KeyRound size={23} />
        </span>
        <h1 className="mt-5 text-3xl font-black text-navy-950">
          Forgot your password?
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Enter your student ID, username, or email. For privacy, the response
          is the same whether or not an account is found.
        </p>
        {error && <div className="mt-5"><ErrorNotice message={error} /></div>}
        {message ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            <div className="flex gap-2 font-bold">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              Request recorded
            </div>
            <p className="mt-2">{message}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="field">
              <span>Student ID, username, or email</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <button disabled={saving} className="btn-primary w-full">
              {saving ? "Recording request…" : "Request password help"}
            </button>
          </form>
        )}
        <Link
          to="/login/student"
          className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-navy-950"
        >
          <ArrowLeft size={17} /> Back to student login
        </Link>
      </section>
    </main>
  );
}
