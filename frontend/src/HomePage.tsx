import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  Info,
  Route,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "./components";
import { InstallButton } from "./pwa";

const studentFeatures = [
  "Create an account",
  "Take diagnostic assessments",
  "View learning gaps",
  "Follow recommended learning pathways",
  "Monitor mastery and progress",
];

const teacherFeatures = [
  "Manage student accounts",
  "Create and publish assessments",
  "Generate questions from uploaded learning materials",
  "Review student mastery, gaps, and progress",
];

const steps = [
  "The student takes a diagnostic assessment.",
  "The system identifies prerequisite learning gaps.",
  "NeuroLearn-X recommends an appropriate learning pathway.",
  "The student completes activities and reassessments.",
  "Teachers monitor mastery and learning progress.",
];

export default function HomePage() {
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!aboutOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAboutOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [aboutOpen]);

  return (
    <main className="min-h-screen bg-[#f3f7fa] text-slate-800">
      <section className="relative overflow-hidden bg-navy-950 px-5 pb-20 pt-7 text-white sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-cyanx-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <header className="flex items-center justify-between gap-6">
            <Brand />
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-xs font-semibold text-slate-300 sm:flex">
                <ShieldCheck size={16} className="text-cyanx-400" />
                Grade 12 STEM research prototype
              </div>
              <InstallButton
                compact
                className="hidden items-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 sm:flex"
              />
              <InstallButton
                compact
                iconOnly
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 text-cyanx-400 transition hover:bg-white/10 sm:hidden"
              />
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 text-cyanx-400 transition hover:bg-white/10"
                aria-label="About NeuroLearn-X"
                aria-haspopup="dialog"
                onClick={() => setAboutOpen(true)}
              >
                <Info size={19} />
              </button>
            </div>
          </header>
          <div className="grid items-center gap-10 pb-6 pt-16 lg:grid-cols-[1.12fr_0.88fr] lg:pt-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyanx-500/20 bg-cyanx-500/10 px-3 py-1.5 text-xs font-bold text-cyanx-400">
                <BookOpen size={14} /> General Physics learning support
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl xl:text-6xl">
                Master the concepts you need before moving to the next lesson.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                NeuroLearn-X identifies prerequisite learning gaps, measures
                concept mastery, and recommends a personalized learning pathway
                for General Physics.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login/student" className="btn-primary">
                  Student Login <ArrowRight size={17} />
                </Link>
                <Link
                  to="/register/student"
                  className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Create Student Account
                </Link>
                <Link
                  to="/login/teacher"
                  className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Teacher Login
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-cyanx-400 transition hover:bg-white/10"
                >
                  Explore the System
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: Target,
                  title: "Find gaps",
                  text: "See prerequisite concepts that need attention.",
                },
                {
                  icon: Gauge,
                  title: "Measure mastery",
                  text: "Use assessment evidence to track understanding.",
                },
                {
                  icon: Route,
                  title: "Plan next steps",
                  text: "Follow an ordered, personalized learning pathway.",
                },
                {
                  icon: ClipboardCheck,
                  title: "Monitor progress",
                  text: "Give students and teachers a clear view of growth.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur"
                >
                  <Icon size={22} className="text-cyanx-400" />
                  <h2 className="mt-4 font-black">{title}</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-8 grid max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-2">
        {[
          {
            title: "Student Portal",
            eyebrow: "For learners",
            icon: GraduationCap,
            features: studentFeatures,
            href: "/login/student",
            action: "Open Student Portal",
          },
          {
            title: "Teacher Portal",
            eyebrow: "For educators",
            icon: Users,
            features: teacherFeatures,
            href: "/login/teacher",
            action: "Open Teacher Portal",
          },
        ].map(({ icon: Icon, ...portal }) => (
          <article key={portal.title} className="rounded-3xl bg-white p-7 shadow-xl sm:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
                  {portal.eyebrow}
                </div>
                <h2 className="mt-2 text-3xl font-black text-navy-950">
                  {portal.title}
                </h2>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyanx-100 text-cyan-800">
                <Icon size={25} />
              </span>
            </div>
            <ul className="mt-6 space-y-3">
              {portal.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm text-slate-600">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-cyanx-600" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link to={portal.href} className="btn-secondary mt-7">
              {portal.action} <ArrowRight size={17} />
            </Link>
          </article>
        ))}
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
            Simple and guided
          </div>
          <h2 className="mt-2 text-3xl font-black text-navy-950 sm:text-4xl">
            How NeuroLearn-X Works
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Each step turns assessment evidence into an understandable learning action.
          </p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-5">
          {steps.map((step, index) => (
            <article key={step} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyanx-500 text-sm font-black text-navy-950">
                {index + 1}
              </span>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{step}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="bg-navy-950 px-5 py-7 text-xs text-slate-400 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:justify-between">
          <span>Hinatuan National Comprehensive High School · Research prototype</span>
          <span>Learning support only—not a medical or psychological diagnosis.</span>
        </div>
      </footer>
      {aboutOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-navy-950/70 px-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAboutOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-neurolearnx-title"
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">
                  About the system
                </div>
                <h2 id="about-neurolearnx-title" className="mt-2 text-3xl font-black text-navy-950">
                  Transparent by design
                </h2>
              </div>
              <button
                autoFocus
                onClick={() => setAboutOpen(false)}
                className="icon-button"
                aria-label="Close About NeuroLearn-X"
              >
                <X size={19} />
              </button>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                ["Mastery evidence", "Assessment responses are combined into concept-level mastery estimates."],
                ["Prerequisite graph", "Concept relationships trace the earlier ideas behind a learning gap."],
                ["Adaptive ranking", "Candidate pathways balance gap coverage, expected effort, learning time, and recent learner evidence."],
                ["Explainable recommendations", "Students and teachers can inspect why each concept and activity was recommended."],
              ].map(([title, text]) => (
                <article key={title} className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="font-black text-navy-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-7 flex justify-end">
              <button onClick={() => setAboutOpen(false)} className="btn-primary">
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
