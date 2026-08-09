import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  ClipboardCheck,
  Database,
  Download,
  FileClock,
  FileQuestion,
  Gauge,
  GitBranch,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route as RouterRoute, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, inlineApiError, post, put, remove } from "./api";
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
import { ShareButton } from "./pwa";
import { Equation } from "./Equation";
import {
  AssessmentManagerPage,
  QuestionBankPage,
  QuestionStudioPage,
} from "./TeacherAuthoring";
import StudentManagementPage from "./TeacherStudents";

type User = {
  id: number;
  participant_code: string;
  display_name: string;
  role: string;
  is_demo: boolean;
};

function messageOf(error: unknown) {
  return inlineApiError(error);
}

const teacherNavigation = [
  ["Overview", "/teacher", LayoutDashboard],
  ["Students", "/teacher/students", Users],
  ["Concepts", "/teacher/concepts", GraduationCap],
  ["Knowledge graph", "/teacher/graph", GitBranch],
  ["Activity bank", "/teacher/activities", BookOpen],
  ["Question Studio", "/teacher/quiz-builder", FileQuestion],
  ["Question bank", "/teacher/question-bank", ClipboardCheck],
  ["Assessments", "/teacher/assessments", FileClock],
  ["Optimization settings", "/teacher/settings", SlidersHorizontal],
  ["Cognitive-load model", "/teacher/models", BrainCircuit],
  ["Pathway comparison", "/teacher/pathways", Route],
  ["Expert evaluation", "/teacher/evaluation", ClipboardCheck],
  ["Research exports", "/teacher/exports", Database],
  ["Audit log", "/teacher/audit", FileClock],
] as const;

export default function TeacherApp({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);
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
        className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col bg-navy-950 px-4 py-6 text-white transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-2">
          <Brand />
        </div>
        <div className="mx-2 mt-6 rounded-xl border border-white/10 bg-white/[0.06] p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-cyanx-400">
            Teacher mode
          </div>
          <div className="mt-1 truncate text-sm font-bold">{user.display_name}</div>
          <div className="text-xs text-slate-400">{user.participant_code}</div>
        </div>
        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Teacher navigation">
          {teacherNavigation.map(([label, href, Icon]) => {
            const active =
              href === "/teacher"
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
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <ShareButton label="Share classroom QR" />
        <button
          onClick={onLogout}
          className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      <main className="min-h-screen px-4 pb-12 pt-20 sm:px-7 lg:ml-[286px] lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-7xl">
          <Routes>
            <RouterRoute index element={<TeacherOverview />} />
            <RouterRoute path="students" element={<StudentManagementPage />} />
            <RouterRoute path="students/:studentId" element={<StudentDetail />} />
            <RouterRoute path="concepts" element={<ConceptManager />} />
            <RouterRoute path="graph" element={<GraphEditor />} />
            <RouterRoute path="activities" element={<ActivityBank />} />
            <RouterRoute path="quiz-builder" element={<QuestionStudioPage />} />
            <RouterRoute path="question-bank" element={<QuestionBankPage />} />
            <RouterRoute path="assessments" element={<AssessmentManagerPage />} />
            <RouterRoute path="settings" element={<TeacherSettings />} />
            <RouterRoute path="models" element={<ModelDashboard />} />
            <RouterRoute path="pathways" element={<PathwayComparison />} />
            <RouterRoute path="evaluation" element={<ExpertEvaluation />} />
            <RouterRoute path="exports" element={<ResearchExports />} />
            <RouterRoute path="audit" element={<AuditLogPage />} />
            <RouterRoute path="*" element={<Navigate to="/teacher" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function TeacherOverview() {
  const [data, setData] = useState<any>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<number | null>(null);
  const [reportedLoad, setReportedLoad] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/teacher/dashboard")
      .then((value: any) => {
        setData(value);
        setSelectedLearnerId((current) => current ?? value.recent_students?.[0]?.id ?? null);
      })
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(() => {
    if (!selectedLearnerId) {
      setReportedLoad(null);
      return;
    }
    setReportedLoad(null);
    api(`/api/teacher/students/${selectedLearnerId}/reported-cognitive-load`)
      .then(setReportedLoad)
      .catch((cause) => setError(messageOf(cause)));
  }, [selectedLearnerId]);
  if (error) return <ErrorNotice message={error} />;
  if (!data) return <Loading label="Loading teacher dashboard…" />;
  return (
    <>
      <PageHeader
        eyebrow="Research administration"
        title="Teacher dashboard"
        description="Monitor mastery evidence, pathway activity, model status, and learner progress without exposing unnecessary personal information."
        action={<Badge tone="cyan">Demo mode</Badge>}
      />
      <DemoNotice />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Students"
          value={data.student_count}
          detail="Active participant codes"
          icon={<Users size={20} />}
        />
        <MetricCard
          label="Assessment attempts"
          value={data.attempt_count}
          detail="Recorded server-side"
          icon={<Activity size={20} />}
          tone="cyan"
        />
        <MetricCard
          label="Mastered concepts"
          value={data.mastered_concepts}
          detail="Latest evidence by learner"
          icon={<Check size={20} />}
          tone="amber"
        />
        <MetricCard
          label="Active pathways"
          value={data.active_pathways}
          detail="Selected recommendations"
          icon={<Route size={20} />}
          tone="rose"
        />
        <MetricCard label="At-risk learners" value={data.at_risk_students || 0} detail="Latest mastery below 50%" icon={<Gauge size={20} />} tone="rose" />
        <MetricCard label="Open interventions" value={data.open_interventions || 0} detail="Teacher actions to follow up" icon={<ShieldCheck size={20} />} tone="cyan" />
      </div>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-navy-950">Common validated misconception patterns</h2>
        <p className="mt-1 text-xs text-slate-500">Only teacher-reviewed distractor mappings are counted; an isolated unsupported wrong answer is not diagnosed.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(data.misconception_patterns || []).map((item: any) => (
            <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-amber-700">{item.code}</div>
              <div className="mt-1 font-black text-navy-950">{item.name}</div>
              <div className="mt-2 text-sm text-amber-900">{item.evidence_count} unresolved observation{item.evidence_count === 1 ? "" : "s"}</div>
            </div>
          ))}
          {!data.misconception_patterns?.length && <p className="text-sm text-slate-500">No unresolved validated pattern evidence is currently stored.</p>}
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <section className="min-w-0 rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-navy-950">
                Recent learner activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Anonymous participant codes only
              </p>
            </div>
            <Link to="/teacher/students" className="text-sm font-bold text-cyanx-600">
              View all
            </Link>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Demo label</th>
                  <th>Attempts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.recent_students.map((student: any) => (
                  <tr
                    key={student.id}
                    className={`cursor-pointer ${selectedLearnerId === student.id ? "bg-cyan-50/70" : "hover:bg-slate-50"}`}
                    tabIndex={0}
                    onClick={() => setSelectedLearnerId(student.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedLearnerId(student.id);
                      }
                    }}
                    aria-label={`Show reported cognitive load for ${student.participant_code}`}
                  >
                    <td className="font-black text-navy-950">
                      {student.participant_code}
                    </td>
                    <td>{student.display_name}</td>
                    <td>{student.attempts}</td>
                    <td>
                      <Link
                        to={`/teacher/students/${student.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center text-cyanx-600"
                        aria-label={`View ${student.participant_code}`}
                      >
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="min-w-0 rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Reported cognitive load
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Selected learner's actual 1–9 mental-effort ratings; not model predictions
          </p>
          {!selectedLearnerId ? (
            <p className="mt-5 text-sm text-slate-500">Select a learner to view reported cognitive load.</p>
          ) : !reportedLoad ? (
            <Loading label="Loading reported ratings…" />
          ) : !reportedLoad.history.length ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No reported cognitive-load data yet.</p>
          ) : (
            <>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-cyan-50 p-4">
                <div>
                  <div className="font-black text-navy-950">{reportedLoad.participant_code}</div>
                  <div className="text-xs text-slate-500">Average of {reportedLoad.history.length} rating(s)</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-navy-950">{reportedLoad.average_rating.toFixed(2)}/9</div>
                  <Badge tone={reportedLoad.average_category === "High" ? "rose" : reportedLoad.average_category === "Moderate" ? "amber" : "green"}>{reportedLoad.average_category}</Badge>
                </div>
              </div>
              <div className="mt-4 max-h-52 overflow-auto">
                <table className="data-table">
                  <thead><tr><th>Activity</th><th>Date</th><th>Rating</th></tr></thead>
                  <tbody>
                    {reportedLoad.history.map((item: any) => (
                      <tr key={item.id}>
                        <td className="font-semibold text-navy-950">{item.activity}</td>
                        <td>{new Date(item.date).toLocaleDateString()}</td>
                        <td><Badge tone={item.category === "High" ? "rose" : item.category === "Moderate" ? "amber" : "green"}>{item.rating}/9 · {item.category}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function StudentList() {
  const [students, setStudents] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [loadFilter, setLoadFilter] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const delay = setTimeout(() => {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (loadFilter) query.set("load", loadFilter);
      api<any[]>(`/api/teacher/students?${query}`)
        .then(setStudents)
        .catch((cause) => setError(messageOf(cause)));
    }, 180);
    return () => clearTimeout(delay);
  }, [search, loadFilter]);
  return (
    <>
      <PageHeader
        eyebrow="Learner monitoring"
        title="Student list"
        description="Search by anonymous participant code or demo display label, then inspect the evidence behind an individual recommendation."
      />
      {error && <ErrorNotice message={error} />}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft sm:flex-row">
        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-3 text-slate-400"
            size={18}
          />
          <input
            className="input pl-10"
            placeholder="Search participant code…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          className="input sm:w-52"
          value={loadFilter}
          onChange={(event) => setLoadFilter(event.target.value)}
          aria-label="Filter by cognitive load"
        >
          <option value="">All load levels</option>
          <option>Low</option>
          <option>Moderate</option>
          <option>High</option>
          <option>Not estimated</option>
        </select>
      </div>
      {!students ? (
        <Loading />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Target</th>
                  <th>Average mastery</th>
                  <th>Gaps</th>
                  <th>Cognitive load</th>
                  <th>Progress</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="font-black text-navy-950">
                        {student.participant_code}
                      </div>
                      <div className="text-xs text-slate-500">
                        {student.display_name}
                      </div>
                    </td>
                    <td>{student.target || "Not selected"}</td>
                    <td>
                      {student.mastery_average == null
                        ? "—"
                        : `${Math.round(student.mastery_average * 100)}%`}
                    </td>
                    <td>
                      <Badge tone={student.gaps ? "rose" : "green"}>
                        {student.gaps}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          student.cognitive_load === "High"
                            ? "rose"
                            : student.cognitive_load === "Moderate"
                              ? "amber"
                              : student.cognitive_load === "Low"
                                ? "green"
                                : "slate"
                        }
                      >
                        {student.cognitive_load}
                      </Badge>
                    </td>
                    <td>
                      {student.progress.completed}/{student.progress.total}
                    </td>
                    <td>
                      <Link
                        to={`/teacher/students/${student.id}`}
                        className="btn-secondary !px-3 !py-2"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!students.length && (
            <div className="p-6">
              <Empty
                title="No students match"
                description="Try clearing the current filters."
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function StudentDetail() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [difficulty, setDifficulty] = useState("Auto");
  const [teacherNote, setTeacherNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [topicLoading, setTopicLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [activityToAdd, setActivityToAdd] = useState("");
  useEffect(() => {
    api(`/api/teacher/students/${studentId}`)
      .then(setStudent)
      .catch((cause) => setError(messageOf(cause)));
  }, [studentId]);
  async function openTopic(conceptId: number) {
    setTopicLoading(true);
    setPreview(null);
    setAssignmentNotice("");
    try {
      setTopic(await api(`/api/teacher/students/${studentId}/topics/${conceptId}`));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setTopicLoading(false);
    }
  }
  async function generatePreview() {
    if (!topic) return;
    setTopicLoading(true);
    try {
      setPreview(
        await post(
          `/api/teacher/students/${studentId}/topics/${topic.concept.id}/pathway-preview`,
          { difficulty },
        ),
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setTopicLoading(false);
    }
  }
  function movePreview(index: number, direction: -1 | 1) {
    setPreview((current: any) => {
      const steps = [...current.steps];
      const destination = index + direction;
      if (destination < 0 || destination >= steps.length) return current;
      [steps[index], steps[destination]] = [steps[destination], steps[index]];
      return {
        ...current,
        steps: steps.map((step, position) => ({ ...step, position: position + 1 })),
      };
    });
  }
  function addPreviewActivity() {
    if (!preview || !activityToAdd) return;
    const activity = preview.available_activities.find(
      (item: any) => item.activity_id === Number(activityToAdd),
    );
    if (!activity) return;
    setPreview({
      ...preview,
      steps: [
        ...preview.steps,
        {
          ...activity,
          position: preview.steps.length + 1,
          selection_reason: "Added by the teacher during pathway review.",
        },
      ],
    });
    setActivityToAdd("");
  }
  async function assignPathway() {
    if (!topic || !preview) return;
    setAssigning(true);
    try {
      await post(`/api/teacher/students/${studentId}/pathways/assign`, {
        target_concept_id: topic.concept.id,
        label: `${preview.difficulty} · ${topic.concept.name}`,
        difficulty: preview.difficulty,
        teacher_note: teacherNote,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        steps: preview.steps.map((step: any, index: number) => ({
          concept_id: step.concept_id,
          activity_id: step.activity_id,
          position: index + 1,
        })),
      });
      setAssignmentNotice(`Pathway assigned and sent to ${student.student.display_name}.`);
      setStudent(await api(`/api/teacher/students/${studentId}`));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setAssigning(false);
    }
  }
  async function recordIntervention(item: any, actionType: string) {
    const note = window.prompt(
      "Add a teacher note for this intervention:",
      actionType === "Assign remediation" ? item.remediation_instruction : "Reviewed with the learner evidence shown here.",
    );
    if (note == null) return;
    try {
      await post("/api/teacher/interventions", {
        student_id: Number(studentId),
        concept_id: item.concept_id,
        misconception_id: item.misconception_id,
        pathway_id: student.pathway?.id || null,
        assigned_activity_id: actionType === "Assign remediation" ? item.suggested_activity_id || null : null,
        action_type: actionType,
        note,
      });
      setAssignmentNotice(`${actionType} was recorded for this learner.`);
      setStudent(await api(`/api/teacher/students/${studentId}`));
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  if (error) return <ErrorNotice message={error} />;
  if (!student) return <Loading label="Loading learner evidence…" />;
  return (
    <>
      <PageHeader
        eyebrow="Individual learner detail"
        title={student.student.participant_code}
        description={`${student.student.display_name} · ${student.target?.name || "No target selected"}`}
        action={
          <Link to="/teacher/students" className="btn-secondary">
            Back to list
          </Link>
        }
      />
      <DemoNotice />
      {assignmentNotice && (
        <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {assignmentNotice}
        </div>
      )}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-navy-950">Learner profile</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Student ID", student.student.participant_code],
            ["Full name", student.student.display_name],
            ["Registration date", new Date(student.student.created_at).toLocaleString()],
            ["Email", student.student.email || "Not provided"],
            ["Username", student.student.username || "Not provided"],
            ["Grade level", student.student.grade_level || "Not provided"],
            ["Section", student.student.section || "Not provided"],
            ["Account status", student.student.account_status],
            ["Last sign-in", student.student.last_sign_in_at ? new Date(student.student.last_sign_in_at).toLocaleString() : "Never"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-1 font-bold text-navy-950">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Average mastery"
          value={
            student.mastery_average == null
              ? "—"
              : `${Math.round(student.mastery_average * 100)}%`
          }
          icon={<Gauge size={20} />}
        />
        <MetricCard
          label="Learning gaps"
          value={student.gaps.length}
          icon={<Activity size={20} />}
          tone="rose"
        />
        <MetricCard
          label="Predicted load"
          value={student.pathway?.cognitive_load_category || "Not estimated"}
          detail={
            student.pathway
              ? `Index ${student.pathway.predicted_cognitive_load.toFixed(2)}`
              : undefined
          }
          icon={<BrainCircuit size={20} />}
          tone="cyan"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Concept mastery</h2>
          <div className="mt-5 space-y-4">
            {student.mastery.map((row: any) => (
              <button
                key={row.concept_id}
                onClick={() => openTopic(row.concept_id)}
                className="block w-full rounded-xl p-3 text-left transition hover:bg-cyan-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-navy-950">
                    {row.concept}
                  </span>
                  <Badge tone={masteryTone(row.classification)}>
                    {row.classification}
                  </Badge>
                </div>
                <ProgressBar value={row.score} />
                <p className="mt-2 text-xs font-bold text-cyanx-600">Open topic evidence and pathway tools →</p>
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Selected pathway
          </h2>
          {student.pathway ? (
            <>
              <div className="mt-4 rounded-xl bg-navy-950 p-5 text-white">
                <div className="text-xs font-bold uppercase tracking-widest text-cyanx-400">
                  {student.pathway.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {student.pathway.explanation}
                </p>
              </div>
              <div className="mt-4 space-y-2">
                {student.pathway.steps.map((step: any) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyanx-100 text-xs font-black text-cyan-800">
                      {step.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-navy-950">
                        {step.activity}
                      </div>
                      <div className="text-xs text-slate-500">
                        {step.concept} · {step.estimated_minutes} min
                      </div>
                    </div>
                    <Badge tone={step.completed_at ? "green" : "slate"}>
                      {step.completed_at ? "Completed" : "Pending evidence"}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty
              title="No active pathway"
              description="The student must select a target competency."
            />
          )}
        </section>
      </div>
      <section id="gaps" className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-navy-950">Learning gaps</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {student.gaps.map((gap: any) => (
            <button
              key={gap.id}
              onClick={() => openTopic(gap.concept_id)}
              className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-left transition hover:border-rose-300"
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-navy-950">{gap.concept}</strong>
                <Badge tone="rose">
                  {gap.mastery_score == null ? "No evidence" : `${Math.round(gap.mastery_score * 100)}%`}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-rose-800">{gap.reason}</p>
              <p className="mt-2 text-xs font-black text-rose-700">Inspect evidence and assign pathway →</p>
            </button>
          ))}
          {!student.gaps.length && (
            <Empty title="No current learning gaps" description="No assessed concept is currently below the mastery threshold." />
          )}
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Misconception history and intervention</h2>
          <p className="mt-1 text-xs text-slate-500">Only validated distractor mappings appear as named patterns.</p>
          <div className="mt-4 space-y-3">
            {(student.misconception_history || []).map((item: any) => (
              <article key={item.id} className={`rounded-xl border p-4 ${item.resolved_at ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-amber-700">{item.code} - {item.confidence_level} confidence</div><h3 className="mt-1 font-black text-navy-950">{item.name}</h3></div><Badge tone={item.resolved_at ? "green" : "amber"}>{item.resolved_at ? "Resolved" : `${item.evidence_count} observations`}</Badge></div>
                <p className="mt-2 text-sm text-slate-700">{item.question}</p>
                <p className="mt-2 text-xs text-slate-600"><strong>Recommended remediation:</strong> {item.remediation_instruction}</p>
                {!item.resolved_at && <div className="mt-3 flex flex-wrap gap-2"><button className="btn-secondary !px-3 !py-2" onClick={() => recordIntervention(item, "Assign remediation")}>Assign remediation</button><button className="btn-secondary !px-3 !py-2" onClick={() => recordIntervention(item, "Add support note")}>Add support note</button><button className="btn-secondary !px-3 !py-2" onClick={() => recordIntervention(item, "Resolve misconception")}>Mark resolved</button></div>}
              </article>
            ))}
            {!student.misconception_history?.length && <p className="text-sm text-slate-500">No validated misconception pattern has been observed.</p>}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Learning summaries and interventions</h2>
          <div className="mt-4 space-y-3">
            {(student.learning_summaries || []).slice(0, 6).map((item: any) => <details key={item.id} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-black text-navy-950">{item.activity} - {Math.round((item.summary.accuracy || 0) * 100)}%</summary><div className="mt-3 text-sm text-slate-600"><p>Errors observed: {item.summary.errors_observed}</p><p>Concepts strengthened: {item.summary.concepts_strengthened?.join(", ") || "More evidence needed"}</p><p>Next action: {item.summary.next_action}</p></div></details>)}
          </div>
          <h3 className="mt-6 font-black text-navy-950">Recorded teacher actions</h3>
          <div className="mt-3 space-y-2">{(student.interventions || []).map((item: any) => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex items-center justify-between gap-2"><strong>{item.action_type}</strong><Badge tone={item.status === "Resolved" ? "green" : "cyan"}>{item.status}</Badge></div><p className="mt-1 text-slate-600">{item.note}</p></div>)}</div>
        </section>
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-black text-navy-950">
            Assessment history
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Response / completion time</th>
                <th>Attempt</th>
                <th>Skipped</th>
                <th>Hints</th>
                <th>Mental effort</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {student.recent_attempts.map((attempt: any) => (
                <tr key={attempt.id}>
                  <td className="font-bold text-navy-950">{attempt.activity}</td>
                  <td>
                    {attempt.score}/{attempt.max_score}
                  </td>
                  <td>{Math.round(attempt.accuracy * 100)}%</td>
                  <td>{attempt.average_response_seconds.toFixed(1)}s avg / {Math.round(attempt.total_seconds)}s total</td>
                  <td>{attempt.attempt_number}</td>
                  <td>{attempt.skipped_items}</td>
                  <td>{attempt.hint_usage_count}</td>
                  <td>
                    {attempt.mental_effort
                      ? `${attempt.mental_effort} · ${attempt.mental_effort_category}`
                      : "Pending"}
                  </td>
                  <td>{new Date(attempt.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {student.recent_activity.map((item: any, index: number) => (
              <div key={`${item.title}-${index}`} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-navy-950">{item.title}</strong>
                  <span className="text-xs text-slate-500">{new Date(item.occurred_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.summary}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Pathway history</h2>
          <div className="mt-4 space-y-3">
            {student.pathway_history.map((pathway: any) => (
              <div key={pathway.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-navy-950">{pathway.label}</strong>
                  <Badge tone={pathway.source_type === "Teacher" ? "cyan" : "slate"}>{pathway.source_type}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {pathway.steps.filter((step: any) => step.completed_at).length}/{pathway.steps.length} steps completed · {new Date(pathway.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      {topic && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-navy-950/70 px-4 py-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTopic(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-topic-title"
            className="mx-auto w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-cyanx-600">
                  Learner topic evidence
                </div>
                <h2 id="learner-topic-title" className="mt-1 text-2xl font-black text-navy-950">
                  {topic.concept.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {student.student.display_name} · {student.student.participant_code}
                </p>
              </div>
              <button className="icon-button" onClick={() => setTopic(null)} aria-label="Close learner topic panel">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Current mastery"
                value={topic.mastery ? `${Math.round(topic.mastery.score * 100)}%` : "No evidence"}
                detail={topic.mastery?.classification}
                icon={<Gauge size={19} />}
              />
              <MetricCard label="Attempts" value={topic.performance.attempts} detail={`${topic.performance.skips} skips · ${topic.performance.hints} hints`} icon={<ClipboardCheck size={19} />} tone="cyan" />
              <MetricCard label="Average response" value={`${topic.performance.average_response_seconds.toFixed(1)}s`} icon={<FileClock size={19} />} />
              <MetricCard label="Predicted load" value={topic.performance.predicted_cognitive_load == null ? "Not estimated" : topic.performance.predicted_cognitive_load.toFixed(2)} icon={<BrainCircuit size={19} />} tone="rose" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-black text-navy-950">Missing prerequisites</h3>
                <div className="mt-3 space-y-2">
                  {topic.missing_prerequisites.map((item: any) => (
                    <div key={item.concept_id} className="rounded-lg bg-amber-50 p-3 text-sm">
                      <strong>{item.concept}</strong>
                      <span className="ml-2 text-amber-800">
                        {item.mastery_score == null ? "Not assessed" : `${Math.round(item.mastery_score * 100)}% mastery`}
                      </span>
                    </div>
                  ))}
                  {!topic.missing_prerequisites.length && <p className="text-sm text-slate-500">No prerequisite is currently below threshold.</p>}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-black text-navy-950">Performance summary</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {topic.attempts.slice(0, 5).map((attempt: any) => (
                    <div key={attempt.id} className="rounded-lg bg-slate-50 p-3">
                      <strong className="text-navy-950">{attempt.activity}</strong>
                      <p className="mt-1">
                        {Math.round(attempt.accuracy * 100)}% · {Math.round(attempt.total_seconds)}s · {attempt.skipped_items} skips · {attempt.hint_usage_count} hints
                      </p>
                    </div>
                  ))}
                  {!topic.attempts.length && <p>No attempt evidence is available.</p>}
                </div>
              </section>
            </div>
            {topic.common_errors.length > 0 && (
              <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-black text-navy-950">Common errors</h3>
                <ul className="mt-3 space-y-2 text-sm text-amber-950">
                  {topic.common_errors.map((item: any) => (
                    <li key={item.error}><strong>{item.count}×</strong> {item.error}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="mt-6 rounded-2xl border border-slate-200 p-5">
              <h3 className="font-black text-navy-950">Incorrect-response evidence</h3>
              <div className="mt-3 space-y-3">
                {topic.incorrect_responses.slice(0, 8).map((item: any, index: number) => (
                  <details key={`${item.attempt_id}-${index}`} className="rounded-xl bg-rose-50 p-4">
                    <summary className="cursor-pointer text-sm font-bold text-navy-950">{item.question}</summary>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <p><strong>Learner answer:</strong> {item.learner_answer || "No answer"}</p>
                      <p><strong>Correct answer:</strong> {item.correct_answer}</p>
                      <p><strong>Why:</strong> {item.explanation}</p>
                      <p><strong>Likely mistake:</strong> {item.likely_mistake}</p>
                    </div>
                  </details>
                ))}
                {!topic.incorrect_responses.length && <p className="text-sm text-slate-500">No incorrect responses are recorded for this topic.</p>}
              </div>
            </section>
            <section className="mt-6 rounded-2xl bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <label className="field flex-1">
                  <span>Pathway support level</span>
                  <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                    <option>Auto</option>
                    <option>Guided pathway</option>
                    <option>Standard pathway</option>
                    <option>Faster review pathway</option>
                  </select>
                </label>
                <button onClick={generatePreview} disabled={topicLoading} className="btn-primary">
                  <RefreshCcw size={16} /> {preview ? "Regenerate best-fit pathway" : "Generate best-fit pathway"}
                </button>
                {preview && <button onClick={() => setPreview(null)} className="btn-secondary">Cancel preview</button>}
              </div>
              {topicLoading && <div className="mt-4"><Loading label="Analyzing learner evidence…" /></div>}
              {preview && (
                <div className="mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-navy-950">{preview.difficulty}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Uses mastery, incorrect answers, response time, attempts, skips, hints, effort, load, and trend.
                      </p>
                    </div>
                    <Badge tone="cyan">{preview.steps.length} connected steps</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {preview.steps.map((step: any, index: number) => (
                      <div key={`${step.activity_id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-950 font-black text-cyanx-400">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-navy-950">{step.activity}</div>
                            <div className="text-xs text-slate-500">{step.concept} · {step.estimated_minutes} min · difficulty/load {step.difficulty || step.predicted_load_index?.toFixed(2)}</div>
                            <p className="mt-1 text-xs text-slate-500">{step.selection_reason}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="icon-button" aria-label="Move step up" disabled={index === 0} onClick={() => movePreview(index, -1)}>↑</button>
                            <button className="icon-button" aria-label="Move step down" disabled={index === preview.steps.length - 1} onClick={() => movePreview(index, 1)}>↓</button>
                            <button
                              className="icon-button text-rose-700"
                              aria-label="Remove step"
                              onClick={() => setPreview({
                                ...preview,
                                steps: preview.steps
                                  .filter((_item: any, position: number) => position !== index)
                                  .map((item: any, position: number) => ({ ...item, position: position + 1 })),
                              })}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <select className="input flex-1" value={activityToAdd} onChange={(event) => setActivityToAdd(event.target.value)}>
                      <option value="">Add another connected activity…</option>
                      {preview.available_activities.map((item: any) => (
                        <option key={`${item.concept_id}-${item.activity_id}`} value={item.activity_id}>
                          {item.concept} · {item.activity} · difficulty {item.difficulty}
                        </option>
                      ))}
                    </select>
                    <button onClick={addPreviewActivity} disabled={!activityToAdd} className="btn-secondary"><Plus size={16} /> Add</button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="field">
                      <span>Teacher note</span>
                      <textarea value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} placeholder="Explain the goal or support the learner should focus on." />
                    </label>
                    <label className="field">
                      <span>Due date (optional)</span>
                      <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button onClick={assignPathway} disabled={assigning || !preview.steps.length} className="btn-primary">
                      {assigning ? "Assigning…" : "Assign and send to learner"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </section>
        </div>
      )}
    </>
  );
}

const blankConcept = {
  code: "",
  name: "",
  subject: "General Mathematics",
  description: "",
  difficulty: 2,
  active: true,
};

function ConceptManager() {
  const [concepts, setConcepts] = useState<any[] | null>(null);
  const [form, setForm] = useState(blankConcept);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    api<any[]>("/api/teacher/concepts")
      .then(setConcepts)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(load, [load]);
  function edit(concept: any) {
    setEditing(concept.id);
    setForm({
      code: concept.code,
      name: concept.name,
      subject: concept.subject,
      description: concept.description,
      difficulty: concept.difficulty,
      active: concept.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) await put(`/api/teacher/concepts/${editing}`, form);
      else await post("/api/teacher/concepts", form);
      setEditing(null);
      setForm(blankConcept);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }
  async function toggle(concept: any) {
    try {
      await post(
        `/api/teacher/concepts/${concept.id}/${concept.active ? "archive" : "restore"}`,
      );
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Academic content"
        title="Concept management"
        description="Create, edit, archive, and restore General Mathematics and General Physics concepts. Archive is a recoverable soft deletion."
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      <form
        onSubmit={submit}
        className="mb-6 rounded-2xl bg-white p-6 shadow-soft"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-navy-950">
            {editing ? "Edit concept" : "Add concept"}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(blankConcept);
              }}
              className="text-sm font-bold text-slate-500"
            >
              Cancel edit
            </button>
          )}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="field">
            <span>Code</span>
            <input
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
              placeholder="GP-XX"
              required
            />
          </label>
          <label className="field xl:col-span-2">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </label>
          <label className="field">
            <span>Subject</span>
            <select
              value={form.subject}
              onChange={(event) =>
                setForm({ ...form, subject: event.target.value })
              }
            >
              <option>General Mathematics</option>
              <option>General Physics</option>
            </select>
          </label>
          <label className="field">
            <span>Difficulty</span>
            <select
              value={form.difficulty}
              onChange={(event) =>
                setForm({ ...form, difficulty: Number(event.target.value) })
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={form.active ? "Active" : "Archived"}
              onChange={(event) => setForm({ ...form, active: event.target.value === "Active" })}
            >
              <option>Active</option>
              <option>Archived</option>
            </select>
          </label>
          <label className="field md:col-span-2 xl:col-span-3">
            <span>Description</span>
            <input
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              required
            />
          </label>
          <button disabled={saving} className="btn-primary self-end">
            <Save size={17} />
            {saving ? "Saving…" : editing ? "Save changes" : "Add concept"}
          </button>
        </div>
      </form>
      {!concepts ? (
        <Loading />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Concept</th>
                  <th>Subject</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {concepts.map((concept) => (
                  <tr key={concept.id}>
                    <td className="font-mono text-xs font-bold">{concept.code}</td>
                    <td>
                      <div className="font-bold text-navy-950">{concept.name}</div>
                      <div className="max-w-md text-xs text-slate-500">
                        {concept.description}
                      </div>
                    </td>
                    <td>{concept.subject}</td>
                    <td>{concept.difficulty}/5</td>
                    <td>
                      <Badge tone={concept.active ? "green" : "slate"}>
                        {concept.active ? "Active" : "Archived"}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => edit(concept)}
                          className="icon-button"
                          aria-label={`Edit ${concept.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(concept)}
                          className="icon-button"
                          aria-label={`${concept.active ? "Archive" : "Restore"} ${concept.name}`}
                        >
                          {concept.active ? (
                            <Archive size={16} />
                          ) : (
                            <RefreshCcw size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function GraphEditor() {
  const [graph, setGraph] = useState<any>(null);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const load = useCallback(() => {
    api("/api/teacher/graph")
      .then(setGraph)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(load, [load]);
  const flow = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[] };
    const layout = new dagre.graphlib.Graph({ multigraph: true });
    layout.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 65, edgesep: 30, marginx: 35, marginy: 35 });
    layout.setDefaultEdgeLabel(() => ({}));
    graph.nodes.forEach((node: any) => layout.setNode(String(node.id), { width: 180, height: 76 }));
    graph.edges.forEach((edge: any) => layout.setEdge(String(edge.source), String(edge.target), {}, String(edge.id)));
    dagre.layout(layout);
    const prerequisiteIds = new Set<string>();
    if (selectedNodeId) {
      const stack = [selectedNodeId];
      while (stack.length) {
        const current = stack.pop()!;
        graph.edges
          .filter((edge: any) => String(edge.target) === current)
          .forEach((edge: any) => {
            const sourceId = String(edge.source);
            if (!prerequisiteIds.has(sourceId)) {
              prerequisiteIds.add(sourceId);
              stack.push(sourceId);
            }
          });
      }
    }
    const nodes: Node[] = graph.nodes.map((node: any) => {
      const subjectIndex = node.subject === "General Mathematics" ? 0 : 1;
      const point = layout.node(String(node.id));
      const selected = selectedNodeId === String(node.id);
      const prerequisite = prerequisiteIds.has(String(node.id));
      return {
        id: String(node.id),
        position: { x: point.x - 90, y: point.y - 38 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: { label: `${node.code} · ${node.name}` },
        style: {
          borderRadius: 12,
          width: 180,
          minHeight: 76,
          border: `${selected ? 3 : prerequisite ? 2 : 1}px solid ${selected ? "#e11d48" : prerequisite ? "#079bb0" : node.active ? "#a5e8ee" : "#cbd5e1"}`,
          background: node.active ? (subjectIndex ? "#071b34" : "#eafcfd") : "#f1f5f9",
          color: node.active && subjectIndex ? "#fff" : "#071b34",
          fontSize: 11,
          fontWeight: 700,
          padding: 10,
        },
      };
    });
    const edges: Edge[] = graph.edges.map((edge: any) => {
      const selected = selectedEdgeId === String(edge.id);
      const connected = selectedNodeId === String(edge.target) || prerequisiteIds.has(String(edge.target));
      return {
        id: String(edge.id),
        source: String(edge.source),
        target: String(edge.target),
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: selected ? "#e11d48" : connected ? "#079bb0" : "#94a3b8" },
        style: { stroke: selected ? "#e11d48" : connected ? "#079bb0" : "#94a3b8", strokeWidth: selected ? 3 : connected ? 2.5 : 1.5 },
        zIndex: selected ? 10 : 1,
      };
    });
    return { nodes, edges };
  }, [graph, selectedEdgeId, selectedNodeId]);
  async function addEdge(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await post("/api/teacher/graph/edges", {
        prerequisite_concept_id: Number(source),
        succeeding_concept_id: Number(target),
      });
      setSource("");
      setTarget("");
      load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }
  async function deleteEdge(edgeId: number) {
    try {
      await remove(`/api/teacher/graph/edges/${edgeId}`);
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  if (!graph) return <Loading label="Loading graph editor…" />;
  return (
    <>
      <PageHeader
        eyebrow="Directed acyclic graph"
        title="Knowledge-graph editor"
        description="Create prerequisite relationships with server-side cycle detection. An edge points from prerequisite to succeeding concept."
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      <form
        onSubmit={addEdge}
        className="mb-6 grid gap-4 rounded-2xl bg-white p-5 shadow-soft md:grid-cols-[1fr_auto_1fr_auto]"
      >
        <label className="field">
          <span>Prerequisite concept</span>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            required
          >
            <option value="">Choose concept…</option>
            {graph.nodes
              .filter((node: any) => node.active)
              .map((node: any) => (
                <option key={node.id} value={node.id}>
                  {node.code} · {node.name}
                </option>
              ))}
          </select>
        </label>
        <div className="hidden self-end pb-3 text-cyanx-600 md:block">→</div>
        <label className="field">
          <span>Succeeding concept</span>
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          >
            <option value="">Choose concept…</option>
            {graph.nodes
              .filter((node: any) => node.active)
              .map((node: any) => (
                <option key={node.id} value={node.id}>
                  {node.code} · {node.name}
                </option>
              ))}
          </select>
        </label>
        <button disabled={saving} className="btn-primary self-end">
          <Plus size={17} /> Add edge
        </button>
      </form>
      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="flex h-[650px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-bold text-slate-600">Prerequisite → Succeeding concept</div>
          <ReactFlow className="min-h-0 flex-1" nodes={flow.nodes} edges={flow.edges} fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.2} maxZoom={2} onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }} onNodeClick={(_event, node) => setSelectedNodeId(node.id)} onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}>
            <Background gap={22} color="#dbe4ea" />
            <Controls />
          </ReactFlow>
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span className="font-black text-navy-950">Legend:</span> Prerequisite → Succeeding concept. Select a node to highlight its prerequisite chain; use the controls to zoom, fit, or reset the view.
          </div>
        </div>
        <section className="h-fit rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-black text-navy-950">
            Relationships ({graph.edges.length})
          </h2>
          <div className="mt-4 max-h-[570px] space-y-2 overflow-y-auto">
            {graph.edges.map((edge: any) => {
              const from = graph.nodes.find((node: any) => node.id === edge.source);
              const to = graph.nodes.find((node: any) => node.id === edge.target);
              return (
                <div
                  key={edge.id}
                  onClick={() => setSelectedEdgeId(String(edge.id))}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl p-3 ${selectedEdgeId === String(edge.id) ? "bg-rose-50 ring-1 ring-rose-300" : "bg-slate-50"}`}
                >
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-bold text-navy-950">
                      {from?.name}
                    </div>
                    <div className="truncate text-slate-500">→ {to?.name}</div>
                  </div>
                  <button
                    onClick={() => deleteEdge(edge.id)}
                    className="icon-button text-rose-600"
                    aria-label={`Remove ${from?.name} to ${to?.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

const blankActivity = {
  title: "",
  description: "",
  activity_type: "guided-practice",
  difficulty: 2,
  estimated_minutes: 15,
  instructions: "",
  resource_url: "",
  concept_ids: [] as number[],
  is_diagnostic: false,
};

function ActivityBank() {
  const [activities, setActivities] = useState<any[] | null>(null);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [form, setForm] = useState(blankActivity);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(() => {
    Promise.all([
      api<any[]>("/api/teacher/activities"),
      api<any[]>("/api/teacher/concepts"),
    ])
      .then(([activityRows, conceptRows]) => {
        setActivities(activityRows);
        setConcepts(conceptRows.filter((row) => row.active));
      })
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(load, [load]);
  function edit(activity: any) {
    setEditing(activity.id);
    setForm({
      title: activity.title,
      description: activity.description,
      activity_type: activity.activity_type,
      difficulty: activity.difficulty,
      estimated_minutes: activity.estimated_minutes,
      instructions: activity.instructions,
      resource_url: activity.resource_url || "",
      concept_ids: activity.concept_ids,
      is_diagnostic: activity.is_diagnostic,
    });
    setShowForm(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editing) await put(`/api/teacher/activities/${editing}`, form);
      else await post("/api/teacher/activities", form);
      setForm(blankActivity);
      setEditing(null);
      setShowForm(false);
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  async function toggle(activity: any) {
    try {
      await post(
        `/api/teacher/activities/${activity.id}/${activity.active ? "archive" : "restore"}`,
      );
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  async function deleteActivity(activity: any) {
    const dependencies = activity.dependencies || {};
    const impact = `${dependencies.assigned_students || 0} assigned learner(s), ${dependencies.attempts || 0} attempt(s), ${dependencies.results || 0} result(s), and ${dependencies.pathway_steps || 0} pathway step(s)`;
    if (!window.confirm(`Permanently delete activity "${activity.title}"?\n\nIt currently has ${impact}. Archive and Delete are separate actions. This cannot be undone.`)) return;
    try {
      const confirm = Object.values(dependencies).some((value) => Number(value) > 0);
      await remove(`/api/teacher/activities/${activity.id}${confirm ? "?confirm_learner_record_deletion=true" : ""}`);
      setSelected((current) => { const next = new Set(current); next.delete(activity.id); return next; });
      setNotice(`Activity permanently deleted: ${activity.title}`);
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  async function bulkArchive() {
    if (!selected.size) return;
    try {
      await post("/api/teacher/activities/bulk", { activity_ids: Array.from(selected), action: "archive" });
      setNotice(`${selected.size} selected activities archived.`);
      setSelected(new Set());
      load();
    } catch (cause) { setError(messageOf(cause)); }
  }
  async function bulkDelete() {
    const chosen = (activities || []).filter((activity) => selected.has(activity.id));
    if (!chosen.length) return;
    const totals = chosen.reduce((summary, activity) => {
      Object.entries(activity.dependencies || {}).forEach(([key, value]) => { summary[key] = (summary[key] || 0) + Number(value); });
      return summary;
    }, {} as Record<string, number>);
    if (!window.confirm(`Permanently delete ${chosen.length} selected activities?\n\n${chosen.map((item) => `• ${item.title}`).join("\n")}\n\nRelated records: ${totals.assigned_students || 0} assignments, ${totals.attempts || 0} attempts, ${totals.results || 0} results, ${totals.pathway_steps || 0} pathway steps. This cannot be undone.`)) return;
    const query = new URLSearchParams();
    chosen.forEach((activity) => query.append("activity_ids", String(activity.id)));
    if ((Object.values(totals) as number[]).some((value) => value > 0)) query.set("confirm_learner_record_deletion", "true");
    try {
      await remove(`/api/teacher/activities/bulk-delete?${query.toString()}`);
      setNotice(`${chosen.length} selected activities permanently deleted.`);
      setSelected(new Set());
      load();
    } catch (cause) { setError(messageOf(cause)); }
  }
  const filteredActivities = (activities || []).filter((activity) =>
    `${activity.title} ${activity.description} ${activity.activity_type}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Learning resources"
        title="Activity bank"
        description="Manage estimated time, difficulty, activity type, instructions, concept alignment, and archival status."
        action={
          <button
            onClick={() => {
              setShowForm((value) => !value);
              setEditing(null);
              setForm(blankActivity);
            }}
            className="btn-primary"
          >
            <Plus size={17} /> New activity
          </button>
        }
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {notice && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-soft">
        <label className="field min-w-[240px] flex-1"><span>Search activities</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, type, or content" /></label>
        <button onClick={() => setSelected(new Set(filteredActivities.map((item) => item.id)))} className="btn-secondary !px-3">Select current page</button>
        <button onClick={() => setSelected(new Set(filteredActivities.map((item) => item.id)))} className="btn-secondary !px-3">Select all filtered</button>
        <button disabled={!selected.size} onClick={() => setSelected(new Set())} className="btn-secondary !px-3">Clear selection</button>
        <button disabled={!selected.size} onClick={bulkArchive} className="btn-secondary !px-3"><Archive size={15} /> Bulk archive</button>
        <button disabled={!selected.size} onClick={bulkDelete} className="btn-secondary !px-3 text-rose-700"><Trash2 size={15} /> Bulk delete</button>
      </div>
      {showForm && (
        <form
          onSubmit={submit}
          className="mb-6 rounded-2xl bg-white p-6 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-navy-950">
              {editing ? "Edit activity" : "Create activity"}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowForm(false)}
              aria-label="Close activity form"
            >
              <X size={17} />
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="field md:col-span-2">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Activity type</span>
              <select
                value={form.activity_type}
                onChange={(event) =>
                  setForm({ ...form, activity_type: event.target.value })
                }
              >
                <option value="lesson">Lesson</option>
                <option value="guided-practice">Guided practice</option>
                <option value="practice">Practice</option>
                <option value="quiz">Quiz</option>
                <option value="diagnostic">Diagnostic</option>
                <option value="simulation">Simulation</option>
              </select>
            </label>
            <label className="field">
              <span>Concept</span>
              <select
                value={form.concept_ids[0] || ""}
                onChange={(event) =>
                  setForm({ ...form, concept_ids: [Number(event.target.value)] })
                }
                required
              >
                <option value="">Choose concept…</option>
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.code} · {concept.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field md:col-span-2">
              <span>Description / learning content</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                required
              />
            </label>
            <label className="field md:col-span-2">
              <span>Instructions</span>
              <textarea
                value={form.instructions}
                onChange={(event) =>
                  setForm({ ...form, instructions: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Difficulty</span>
              <input
                type="number"
                min="1"
                max="5"
                value={form.difficulty}
                onChange={(event) =>
                  setForm({ ...form, difficulty: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Estimated minutes</span>
              <input
                type="number"
                min="1"
                value={form.estimated_minutes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    estimated_minutes: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Optional resource URL</span>
              <input
                type="url"
                value={form.resource_url}
                onChange={(event) =>
                  setForm({ ...form, resource_url: event.target.value })
                }
              />
            </label>
            <label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={form.is_diagnostic}
                onChange={(event) =>
                  setForm({ ...form, is_diagnostic: event.target.checked })
                }
              />
              Diagnostic assessment
            </label>
            <button className="btn-primary self-end">
              <Save size={17} /> {editing ? "Save changes" : "Create activity"}
            </button>
          </div>
        </form>
      )}
      {!activities ? (
        <Loading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredActivities.map((activity) => {
            const concept = concepts.find((item) =>
              activity.concept_ids.includes(item.id),
            );
            return (
              <article
                key={activity.id}
                className={`rounded-2xl bg-white p-5 shadow-soft ${!activity.active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-2">
                    <input type="checkbox" checked={selected.has(activity.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(activity.id); else next.delete(activity.id); return next; })} aria-label={`Select ${activity.title}`} className="accent-cyan-600" />
                    <Badge tone={activity.is_diagnostic ? "navy" : "cyan"}>
                      {activity.activity_type}
                    </Badge>
                    {!activity.active && <Badge>Archived</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => edit(activity)}
                      className="icon-button"
                      aria-label={`Edit ${activity.title}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteActivity(activity)} className="icon-button text-rose-700" aria-label={`Permanently delete ${activity.title}`} title="Permanently delete activity"><Trash2 size={15} /></button>
                    <button
                      onClick={() => toggle(activity)}
                      className="icon-button"
                      aria-label={`${activity.active ? "Archive" : "Restore"} ${activity.title}`}
                    >
                      {activity.active ? (
                        <Archive size={15} />
                      ) : (
                        <RefreshCcw size={15} />
                      )}
                    </button>
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-black text-navy-950">
                  {activity.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                  {activity.description}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
                  <div>
                    <div className="text-slate-500">Concept</div>
                    <div className="mt-1 truncate font-bold text-navy-950">
                      {concept?.code || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Difficulty</div>
                    <div className="mt-1 font-bold text-navy-950">
                      {activity.difficulty}/5
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Time</div>
                    <div className="mt-1 font-bold text-navy-950">
                      {activity.estimated_minutes}m
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {activity.questions.length} questions · {activity.dependencies?.assigned_students || 0} assignments · {activity.dependencies?.attempts || 0} attempts
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function QuizBuilder() {
  const [activities, setActivities] = useState<any[] | null>(null);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [activityId, setActivityId] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [promptText, setPromptText] = useState("");
  const [hint, setHint] = useState("");
  const [feedback, setFeedback] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(() => {
    Promise.all([
      api<any[]>("/api/teacher/activities"),
      api<any[]>("/api/teacher/concepts"),
    ]).then(([activityRows, conceptRows]) => {
      setActivities(activityRows.filter((row) => row.active));
      setConcepts(conceptRows.filter((row) => row.active));
    });
  }, []);
  useEffect(load, [load]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        activity_id: Number(activityId),
        concept_id: Number(conceptId),
        prompt: promptText,
        hint,
        feedback,
        points: 1,
        choices: choices.map((text, index) => ({
          text,
          is_correct: index === correctIndex,
        })),
      };
      if (editingQuestion) {
        await put(`/api/teacher/questions/${editingQuestion}`, payload);
      } else {
        await post("/api/teacher/questions", payload);
      }
      setPromptText("");
      setHint("");
      setFeedback("");
      setChoices(["", "", "", ""]);
      setCorrectIndex(0);
      setEditingQuestion(null);
      setMessage(
        editingQuestion
          ? "Question updated successfully."
          : "Question added successfully.",
      );
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  if (!activities) return <Loading label="Loading question builder…" />;
  const selected = activities.find((item) => item.id === Number(activityId));
  function editQuestion(question: any) {
    setEditingQuestion(question.id);
    setConceptId(String(question.concept_id));
    setPromptText(question.prompt);
    setHint(question.hint || "");
    setFeedback(question.feedback || "");
    setChoices(question.choices.map((choice: any) => choice.text));
    setCorrectIndex(
      Math.max(
        0,
        question.choices.findIndex((choice: any) => choice.is_correct),
      ),
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Assessment authoring"
        title="Quiz and question builder"
        description="Create multiple-choice items with one server-validated correct answer, concept alignment, feedback, and an optional hint."
      />
      {error && <ErrorNotice message={error} />}
      {message && (
        <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <form
          onSubmit={submit}
          className="rounded-2xl bg-white p-6 shadow-soft"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Activity</span>
              <select
                value={activityId}
                onChange={(event) => {
                  setActivityId(event.target.value);
                  const activity = activities.find(
                    (item) => item.id === Number(event.target.value),
                  );
                  if (activity?.concept_ids[0])
                    setConceptId(String(activity.concept_ids[0]));
                }}
                required
              >
                <option value="">Choose activity…</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Question concept</span>
              <select
                value={conceptId}
                onChange={(event) => setConceptId(event.target.value)}
                required
              >
                <option value="">Choose concept…</option>
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.code} · {concept.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field mt-4">
            <span>Question prompt</span>
            <textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              required
            />
          </label>
          <fieldset className="mt-5 space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Answer choices
            </legend>
            {choices.map((choice, index) => (
              <label key={index} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index)}
                  aria-label={`Mark choice ${index + 1} correct`}
                />
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black">
                  {String.fromCharCode(65 + index)}
                </span>
                <input
                  className="input"
                  value={choice}
                  onChange={(event) => {
                    const next = [...choices];
                    next[index] = event.target.value;
                    setChoices(next);
                  }}
                  placeholder={`Choice ${index + 1}`}
                  required
                />
              </label>
            ))}
          </fieldset>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Hint</span>
              <textarea
                value={hint}
                onChange={(event) => setHint(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Feedback / explanation</span>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button className="btn-primary">
              {editingQuestion ? <Save size={17} /> : <Plus size={17} />}
              {editingQuestion ? "Save question" : "Add question"}
            </button>
            {editingQuestion && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingQuestion(null);
                  setPromptText("");
                  setHint("");
                  setFeedback("");
                  setChoices(["", "", "", ""]);
                  setCorrectIndex(0);
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
        <section className="rounded-2xl bg-navy-950 p-6 text-white shadow-soft">
          <div className="text-xs font-bold uppercase tracking-widest text-cyanx-400">
            Activity question bank
          </div>
          <h2 className="mt-2 text-xl font-black">
            {selected?.title || "Choose an activity"}
          </h2>
          <div className="mt-5 space-y-3">
            {selected?.questions.map((question: any, index: number) => (
                <div key={question.id} className="rounded-xl bg-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-bold text-cyanx-400">
                    Question {index + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => editQuestion(question)}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-slate-200 hover:bg-white/20"
                    aria-label={`Edit question ${index + 1}`}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-200">
                  {question.prompt}
                </p>
              </div>
            ))}
            {selected && !selected.questions.length && (
              <p className="rounded-xl bg-white/10 p-4 text-sm text-slate-300">
                No questions yet. Add the first item using the form.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function TeacherSettings() {
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("/api/teacher/settings")
      .then(setForm)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  if (!form) return <Loading label="Loading research settings…" />;
  const total = Number(form.alpha) + Number(form.beta) + Number(form.gamma);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (Math.abs(total - 1) > 1e-6) {
      setError("Optimization weights must total exactly 1.");
      return;
    }
    try {
      const saved = await put("/api/teacher/settings", form);
      setForm(saved);
      setMessage("Settings saved. Active learner pathway scores and rankings were recomputed from current records.");
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Adaptive configuration"
        title="Mastery and optimization settings"
        description="Control mastery evidence, mental-effort categories, the expert Likert scale, and the alpha/beta/gamma trade-off."
      />
      <details className="mb-6 rounded-2xl bg-white p-6 shadow-soft">
        <summary className="cursor-pointer text-lg font-black text-navy-950">What do these settings mean?</summary>
        <div className="mt-5 grid gap-5 text-sm leading-6 text-slate-600 lg:grid-cols-2">
          <div className="space-y-3">
            <div><strong>Mastery</strong><Equation latex={String.raw`M=\frac{S_e}{S_{\max}}`} label="Mastery equals earned score divided by maximum score" /><p>M is mastery, Sₑ is the earned score, and Smax is the maximum score from saved assessment attempts.</p></div>
            <div><strong>Learning-gap rule</strong><Equation latex={String.raw`M < \tau`} label="Mastery is below threshold tau" /><p>A gap exists when mastery is below teacher threshold τ.</p></div>
            <div><strong>Gap Coverage</strong><Equation latex={String.raw`GC=\frac{N_a}{N_d}`} label="Gap coverage equals addressed gaps divided by detected gaps" /><p>Nₐ is addressed gaps and Nḓ is detected gaps from current learner records.</p></div>
            <div><strong>Predicted Cognitive Load</strong><Equation latex={String.raw`PCL=\frac{1}{n}\sum_{a=1}^{n}CL_a`} label="Predicted pathway cognitive load is average activity load" /><p>PCL averages activity predictions CLₐ across n candidate activities.</p></div>
            <div><strong>Learning Time</strong><Equation latex={String.raw`LT=\sum_{a=1}^{n}T_a`} label="Learning time is the sum of activity times" /><p>LT sums saved estimated minutes Tₐ.</p></div>
          </div>
          <div className="space-y-3">
            <div><strong>Normalized Learning Time</strong><Equation latex={String.raw`NLT=\frac{LT-LT_{\min}}{LT_{\max}-LT_{\min}}`} label="Normalized learning time formula" /><p>NLT compares each candidate with the shortest and longest valid candidates.</p></div>
            <div><strong>Adaptive Pathway Score</strong><Equation latex={String.raw`APS=\alpha GC+\beta(1-PCL)+\gamma(1-NLT)`} label="Adaptive Pathway Score formula" /><p>APS balances gap coverage, lower predicted load, and shorter time.</p></div>
            <div><strong>Weight constraints</strong><Equation latex={String.raw`\alpha+\beta+\gamma=1,\quad \alpha,\beta,\gamma\ge 0`} label="Alpha beta and gamma total one and are non-negative" /><p>The non-negative teacher weights total exactly 1.00.</p></div>
            <div><strong>Pathway selection</strong><Equation latex={String.raw`r^*=\operatorname*{arg\,max}_{r}APS_r`} label="Select route with maximum Adaptive Pathway Score" /><p>Ties use higher GC, lower PCL, shorter LT, then stable database ID.</p></div>
          </div>
        </div>
      </details>
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {message && (
        <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      )}
      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Mastery calculation</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Mastery threshold</span>
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="1"
                value={form.mastery_threshold}
                onChange={(event) =>
                  setForm({
                    ...form,
                    mastery_threshold: Number(event.target.value),
                  })
                }
              />
              <small>Default: 0.75 (75%)</small>
            </label>
            <label className="field">
              <span>Evidence method</span>
              <select
                value={form.mastery_mode}
                onChange={(event) =>
                  setForm({ ...form, mastery_mode: event.target.value })
                }
              >
                <option value="weighted">Recency-weighted mastery</option>
                <option value="latest">Latest-attempt mastery</option>
              </select>
            </label>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Performance pathway boundaries</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            These boundaries choose guided, standard, or faster-review support. High load, effort, repeated errors, skips, and hint use can still increase support.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ["guided_mastery_max", "Guided mastery maximum"],
              ["review_mastery_min", "Faster-review mastery minimum"],
              ["high_load_threshold", "High-load threshold"],
            ].map(([key, label]) => (
              <label key={key} className="field">
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-navy-950">
                Adaptive Pathway Score weights
              </h2>
              <Equation latex={String.raw`APS=\alpha GC+\beta(1-PCL)+\gamma(1-NLT)`} label="Adaptive Pathway Score formula" block={false} className="text-xs text-slate-500" />
            </div>
            <Badge tone={Math.abs(total - 1) < 1e-6 ? "green" : "rose"}>
              Total: {total.toFixed(2)}
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ["alpha", "Alpha · Gap coverage"],
              ["beta", "Beta · Load suitability"],
              ["gamma", "Gamma · Time efficiency"],
            ].map(([key, label]) => (
              <label key={key} className="field">
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: Number(event.target.value) })
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">Adaptive practice stopping and remediation rules</h2>
          <p className="mt-1 text-xs text-slate-500">These settings control persisted guided-practice and mastery-check sessions.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["tutoring_min_questions", "Minimum questions", 1, 20],
              ["tutoring_consecutive_correct", "Consecutive correct", 1, 10],
              ["tutoring_max_questions", "Maximum questions", 3, 30],
              ["misconception_remediation_repetitions", "Remediate after", 1, 5],
              ["misconception_pause_repetitions", "Pause after", 2, 8],
            ].map(([key, label, min, max]) => (
              <label key={String(key)} className="field"><span>{label}</span><input type="number" min={Number(min)} max={Number(max)} value={form[String(key)]} onChange={(event) => setForm({ ...form, [String(key)]: Number(event.target.value) })} /></label>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-navy-950">
            Rating boundaries
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="field">
              <span>Low effort maximum</span>
              <input
                type="number"
                min="1"
                max="7"
                value={form.mental_effort_low_max}
                onChange={(event) =>
                  setForm({
                    ...form,
                    mental_effort_low_max: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Moderate effort maximum</span>
              <input
                type="number"
                min="2"
                max="8"
                value={form.mental_effort_moderate_max}
                onChange={(event) =>
                  setForm({
                    ...form,
                    mental_effort_moderate_max: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Expert Likert scale maximum</span>
              <input
                type="number"
                min="3"
                max="10"
                value={form.likert_scale_max}
                onChange={(event) =>
                  setForm({
                    ...form,
                    likert_scale_max: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
        </section>
        <button
          disabled={Math.abs(total - 1) > 1e-6}
          className="btn-primary"
        >
          <Save size={17} /> Save settings
        </button>
      </form>
    </>
  );
}

function ModelDashboard() {
  const [versions, setVersions] = useState<any[] | null>(null);
  const [learners, setLearners] = useState<any[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [prediction, setPrediction] = useState<any>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [mode, setMode] = useState("demo");
  const [error, setError] = useState("");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [batchNotice, setBatchNotice] = useState("");
  const load = useCallback(() => {
    Promise.all([
      api<any[]>("/api/teacher/models"),
      api<any[]>("/api/teacher/students"),
    ])
      .then(([modelRows, studentRows]) => {
        setVersions(modelRows);
        setLearners(studentRows);
        setLearnerId((current) => current || (studentRows[0] ? String(studentRows[0].id) : ""));
      })
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    setPrediction(null);
  }, [learnerId]);
  async function runDiagnosis() {
    if (!learnerId) return;
    setPredictionLoading(true);
    setError("");
    try { setPrediction(await api(`/api/teacher/models/predict?student_id=${learnerId}`)); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setPredictionLoading(false); }
  }
  async function diagnoseAll() {
    setPredictionLoading(true);
    setError("");
    try {
      const result = await post<{ items: any[]; students: number }>("/api/teacher/models/diagnose-all");
      const available = result.items.filter((item) => item.available).length;
      setBatchNotice(`Diagnosed ${available} of ${result.students} active learners; learners without sufficient evidence were not assigned a prediction.`);
      const selected = result.items.find((item) => String(item.student_id) === learnerId);
      if (selected) setPrediction(selected);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setPredictionLoading(false); }
  }
  async function train() {
    setTraining(true);
    setError("");
    try {
      await post(`/api/teacher/models/train?mode=${mode}`);
      load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setTraining(false);
    }
  }
  if (!versions) return <Loading label="Loading model versions…" />;
  const active = versions.find((version) => version.active && version.is_demo === (mode === "demo"));
  const filteredLearners = learners.filter((learner) => `${learner.participant_code} ${learner.display_name}`.toLowerCase().includes(learnerSearch.toLowerCase()));
  const metricData = active
    ? [
        { name: "Accuracy", value: active.metrics.accuracy },
        { name: "Precision", value: active.metrics.precision_macro },
        { name: "Recall", value: active.metrics.recall_macro },
        { name: "F1", value: active.metrics.f1_macro },
        { name: "ROC-AUC", value: active.metrics.roc_auc_ovr_macro },
      ].filter((item) => typeof item.value === "number")
    : [];
  return (
    <>
      <PageHeader
        eyebrow="Ensemble machine learning"
        title="Cognitive-load model training"
        description="Logistic Regression, Random Forest, and Gradient Boosting probabilities are combined by equal-weight soft voting. Evaluation is grouped by student."
        action={
          <div className="flex gap-2">
            <select
              className="input w-36"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="demo">Demo mode</option>
              <option value="research">Research mode</option>
            </select>
            <button onClick={train} disabled={training} className="btn-primary">
              <RefreshCcw
                size={17}
                className={training ? "animate-spin" : ""}
              />
              {training ? "Training…" : "Train model"}
            </button>
          </div>
        }
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {batchNotice && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{batchNotice}</p>}
      {mode === "demo" && <DemoNotice />}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-navy-950">Learner cognitive-load prediction</h2>
            <p className="mt-1 text-xs text-slate-500">Uses the selected active learner's recorded assessment and interaction evidence.</p>
          </div>
          <div className="grid gap-2 sm:w-[560px] sm:grid-cols-2">
            <label className="field"><span>Search active learners</span><input value={learnerSearch} onChange={(event) => setLearnerSearch(event.target.value)} placeholder="Participant code or name" /></label>
            <label className="field"><span>Active learner</span>
            <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)}>
              {!learners.length && <option value="">No active learners</option>}
              {filteredLearners.map((learner) => <option key={learner.id} value={learner.id}>{learner.participant_code} · {learner.display_name}</option>)}
            </select>
            </label>
            <button onClick={runDiagnosis} disabled={!learnerId || predictionLoading} className="btn-primary"><BrainCircuit size={16} /> Run diagnosis</button>
            <button onClick={diagnoseAll} disabled={predictionLoading || !learners.length} className="btn-secondary"><Users size={16} /> Diagnose all active students</button>
          </div>
        </div>
        {predictionLoading ? (
          <Loading label="Calculating learner prediction…" />
        ) : prediction && !prediction.available ? (
          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{prediction.message}</p>
        ) : prediction?.available ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {(["Low", "Moderate", "High"] as const).map((label) => (
                <MetricCard key={label} label={`${label} probability`} value={`${(prediction.probabilities[label] * 100).toFixed(1)}%`} icon={<Gauge size={19} />} tone={label === "High" ? "rose" : label === "Moderate" ? "amber" : "cyan"} />
              ))}
              <MetricCard label="Predicted category" value={prediction.category} detail={`${prediction.confidence} confidence (${(prediction.confidence_probability * 100).toFixed(1)}%)`} icon={<BrainCircuit size={19} />} tone="cyan" />
              <MetricCard label="Expected load index" value={prediction.expected_index.toFixed(3)} detail="0 = Low · 1 = High" icon={<BarChart3 size={19} />} tone="amber" />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-xl bg-slate-50 p-5">
                <h3 className="font-black text-navy-950">Learner evidence used</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Assessment score", `${prediction.evidence.assessment_score}/${prediction.evidence.maximum_score}`],
                    ["Accuracy", `${(prediction.evidence.accuracy * 100).toFixed(1)}%`],
                    ["Average response time", `${prediction.evidence.average_response_seconds.toFixed(1)} s`],
                    ["Completion time", `${(prediction.evidence.completion_seconds / 60).toFixed(1)} min`],
                    ["Attempts", prediction.evidence.attempts],
                    ["Skipped questions", prediction.evidence.skipped_questions],
                    ["Hint usage", prediction.evidence.hint_usage],
                    ["Mental-effort rating", prediction.evidence.mental_effort_rating == null ? "Not reported" : `${prediction.evidence.mental_effort_rating}/9`],
                  ].map(([label, value]) => <div key={String(label)}><dt className="text-xs font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 font-black text-navy-950">{value}</dd></div>)}
                </dl>
              </section>
              <section className="rounded-xl bg-slate-50 p-5">
                <h3 className="font-black text-navy-950">Model and explanation</h3>
                <p className="mt-3 text-sm"><strong>Version:</strong> {prediction.model_version}</p>
                <p className="text-sm"><strong>Prediction date:</strong> {new Date(prediction.prediction_date).toLocaleString()}</p>
                <p className="mt-3 text-xs text-slate-500">{prediction.explanation_method}</p>
                <div className="mt-4 space-y-2">
                  {Object.entries(prediction.feature_contributions).map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"><span>{name.replaceAll("_", " ")}</span><strong>{Number(value).toFixed(4)}</strong></div>
                  ))}
                </div>
              </section>
            </div>
            <details className="rounded-xl border border-slate-200 p-5">
              <summary className="cursor-pointer font-black text-navy-950">Formula with this learner's values</summary>
              <div className="mt-5 space-y-5 text-sm text-slate-700">
                <section><h4 className="font-black text-navy-950">General Formula</h4><p className="mt-1">Normalization places features with different units onto a comparable 0–1 scale. If the maximum equals the minimum, the backend safely uses zero.</p><Equation latex={String.raw`X' = \frac{X-X_{\min}}{X_{\max}-X_{\min}}`} label="X prime equals X minus X minimum divided by X maximum minus X minimum" /></section>
                <section><h4 className="font-black text-navy-950">Ensemble Soft Voting</h4><p className="mt-1">The probability assigned to category c is averaged across all K classifiers.</p><Equation latex={String.raw`p_c = \frac{1}{K}\sum_{k=1}^{K}p_{kc}`} label="Probability for category c equals the average probability across K classifiers" /><Equation latex={String.raw`\hat{c}=\operatorname*{arg\,max}_{c}p_c`} label="The predicted category is the category with maximum probability" /></section>
                <section><h4 className="font-black text-navy-950">Learner Values</h4><div className="mt-3 overflow-x-auto"><table className="data-table"><thead><tr><th>Value</th><th>Actual learner value</th><th>Evidence date</th><th>Data source</th></tr></thead><tbody>{[
                  ["Assessment score", `${prediction.evidence.assessment_score}/${prediction.evidence.maximum_score}`, prediction.evidence.evidence_date, "Assessment attempt"],
                  ["Accuracy", `${(prediction.evidence.accuracy * 100).toFixed(1)}%`, prediction.evidence.evidence_date, "Item responses"],
                  ["Response time", `${prediction.evidence.average_response_seconds.toFixed(1)} seconds`, prediction.evidence.evidence_date, "Interaction log"],
                  ["Completion time", `${(prediction.evidence.completion_seconds / 60).toFixed(1)} minutes`, prediction.evidence.evidence_date, "Assessment attempt"],
                  ["Mental effort", prediction.evidence.mental_effort_rating == null ? "Missing" : `${prediction.evidence.mental_effort_rating}/9`, prediction.evidence.evidence_date, "Learner report"],
                  ["Recent mastery", prediction.evidence.recent_mastery == null ? "Missing" : `${(prediction.evidence.recent_mastery * 100).toFixed(1)}%`, prediction.evidence.evidence_date, "Mastery record"],
                ].map(([name, value, date, source]) => <tr key={name}><td>{name}</td><td className="font-black text-navy-950">{value}</td><td>{date ? new Date(date).toLocaleString() : "Not available"}</td><td>{source}</td></tr>)}</tbody></table></div></section>
                <section><h4 className="font-black text-navy-950">Substitution</h4><Equation latex={`CL = 0(${prediction.probabilities.Low.toFixed(3)}) + 0.5(${prediction.probabilities.Moderate.toFixed(3)}) + 1(${prediction.probabilities.High.toFixed(3)})`} label={`Cognitive load equals zero times ${prediction.probabilities.Low.toFixed(3)} plus zero point five times ${prediction.probabilities.Moderate.toFixed(3)} plus one times ${prediction.probabilities.High.toFixed(3)}`} /></section>
                <section><h4 className="font-black text-navy-950">Calculation</h4><Equation latex={`CL = 0 + ${(0.5 * prediction.probabilities.Moderate).toFixed(3)} + ${prediction.probabilities.High.toFixed(3)}`} label="Cognitive load weighted calculation" /></section>
                <section className="rounded-xl bg-cyan-50 p-4"><h4 className="font-black text-navy-950">Result</h4><Equation latex={`CL = ${prediction.expected_index.toFixed(3)}`} label={`Cognitive load index ${prediction.expected_index.toFixed(3)}`} /><p><strong>Interpretation:</strong> The model predicts {prediction.category} cognitive load because that category has the highest combined probability. The index of {prediction.expected_index.toFixed(3)} supports this teaching action: {prediction.recommended_action}</p></section>
                {prediction.missing_features?.length > 0 && <p className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900"><strong>Missing features:</strong> {prediction.missing_features.join(", ")}</p>}
              </div>
            </details>
            <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{prediction.disclaimer}</p>
          </div>
        ) : null}
      </section>
      {!active ? (
        <div className="mt-6">
          <Empty
            title={
              mode === "research"
                ? "Insufficient validated data for model training"
                : "No trained demo model"
            }
            description="Until a trained model is available, recommendations use a clearly labeled temporary rule-based estimate."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Model version"
              value={active.version.split("-").slice(0, 2).join("-")}
              detail={new Date(active.trained_at).toLocaleString()}
              icon={<BrainCircuit size={20} />}
            />
            <MetricCard
              label="Training samples"
              value={active.sample_size}
              detail={`${active.student_count} student groups`}
              icon={<Database size={20} />}
              tone="cyan"
            />
            <MetricCard
              label="Grouped F1"
              value={typeof active.metrics.f1_macro === "number" ? active.metrics.f1_macro.toFixed(3) : "Unavailable"}
              detail={active.metrics.evaluation}
              icon={<BarChart3 size={20} />}
              tone="amber"
            />
          </div>
          <details className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
            <summary className="cursor-pointer font-black text-cyan-950">Model Version <span className="ml-1 inline-grid h-5 w-5 place-items-center rounded-full bg-cyan-700 text-xs text-white" aria-label="Model version help">?</span></summary>
            <p className="mt-3 text-sm leading-6 text-cyan-950">Model version identifies the exact trained cognitive-load model used to generate a prediction. It helps teachers and researchers know which model configuration, training data, features, and evaluation results produced the prediction.</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Version name", active.version], ["Training date", new Date(active.trained_at).toLocaleString()], ["Algorithm", active.metadata?.algorithm || "Soft-voting ensemble"],
                ["Ensemble members", active.metadata?.ensemble_members?.join(", ") || "Logistic Regression, Random Forest, Gradient Boosting"], ["Feature set", active.feature_names.join(", ")],
                ["Training-data period", active.metadata?.training_data_period ? `${new Date(active.metadata.training_data_period.start).toLocaleDateString()} – ${new Date(active.metadata.training_data_period.end).toLocaleDateString()}` : "Not recorded for this historical version"],
                ["Valid samples", active.sample_size], ["Student groups", active.student_count], ["Class labels", active.metadata?.class_labels?.join(", ") || "Low, Moderate, High"],
                ["Evaluation", active.metadata?.evaluation_method || active.metrics.evaluation], ["Deployment status", active.metadata?.deployment_status || (active.active ? "Active" : "Historical")], ["Current active model", active.active ? "Yes" : "No"],
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-white/80 p-3"><dt className="text-xs font-bold uppercase text-cyan-700">{label}</dt><dd className="mt-1 break-words font-semibold text-navy-950">{value}</dd></div>)}
            </dl>
          </details>
          <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="font-black text-navy-950">Evaluation design</h2>
            <h3 className="mt-4 font-black text-navy-950">Why are these metrics grouped by student?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Grouped evaluation keeps all records from the same student in only one fold. This prevents the model from learning a student's pattern during training and then being tested on that same student. It provides a more honest estimate of how the model may perform for learners it has not seen before.</p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-xs font-bold uppercase text-slate-400">Training samples</dt><dd className="mt-1 font-black text-navy-950">{active.metrics.training_samples ?? active.sample_size}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Student groups</dt><dd className="mt-1 font-black text-navy-950">{active.metrics.student_groups ?? active.student_count}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Folds</dt><dd className="mt-1 font-black text-navy-950">{active.metrics.folds ?? "Not recorded"}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Group leakage</dt><dd className="mt-1 font-black text-emerald-700">{active.metrics.group_leakage === false ? "None" : "Not recorded"}</dd></div>
            </dl>
            <div className="mt-4 text-sm text-slate-600"><strong>Class distribution:</strong> {active.metrics.class_distribution ? Object.entries(active.metrics.class_distribution).map(([label, count]) => `${label}: ${count}`).join(" · ") : "Not recorded for this model version"}</div>
            <div className="mt-4 grid gap-3 text-xs leading-5 text-slate-600 sm:grid-cols-2 xl:grid-cols-5">{[
              ["Accuracy", "Share of all predictions that were correct."], ["Precision", "How often a predicted class was correct."], ["Recall", "How many records of each actual class were found."], ["F1-score", "Balanced mean of precision and recall."], ["One-vs-rest ROC-AUC", "How well each class is separated from the other classes."],
            ].map(([name, description]) => <div key={name} className="rounded-lg bg-slate-50 p-3"><strong className="text-navy-950">{name}</strong><p>{description}</p></div>)}</div>
          </section>
          {active.warning && (
            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              {active.warning}
            </p>
          )}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.7fr]">
            <section className="rounded-2xl bg-white p-6 shadow-soft">
              <h2 className="text-lg font-black text-navy-950">
                Grouped evaluation metrics
              </h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metricData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 1]} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0bb7c9" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-2xl bg-white p-6 shadow-soft">
              <h2 className="text-lg font-black text-navy-950">
                Confusion matrix
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                The confusion matrix compares the learner's actual cognitive-load category with the model's prediction. Correct predictions appear on the diagonal. Values outside the diagonal show which categories the model confused.
              </p>
              <div className="mt-3 flex gap-4 text-xs"><span className="rounded bg-emerald-100 px-2 py-1 font-bold text-emerald-800">Correct prediction</span><span className="rounded bg-rose-100 px-2 py-1 font-bold text-rose-800">Misclassification</span></div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 text-xs text-slate-500">Actual ↓ / Predicted →</th>
                      {active.metrics.labels.map((label: string) => (
                        <th key={label} className="p-2 text-xs text-slate-500">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.metrics.confusion_matrix.map(
                      (row: number[], index: number) => (
                        <tr key={active.metrics.labels[index]}>
                          <th className="p-2 text-left text-xs text-slate-500">
                            {active.metrics.labels[index]}
                          </th>
                          {row.map((value, column) => (
                            <td
                              key={column}
                              className={`m-1 rounded-lg p-3 font-black ${index === column ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
                              title={`${value} record(s): actual ${active.metrics.labels[index]}, predicted ${active.metrics.labels[column]}`}
                            >
                              <span className="block">{value}</span><span className="text-[10px] font-semibold">{row.reduce((sum, item) => sum + item, 0) ? `${((value / row.reduce((sum, item) => sum + item, 0)) * 100).toFixed(1)}%` : "0.0%"}</span>
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-black text-navy-950">Model versions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Mode</th>
                <th>Trained</th>
                <th>Sample</th>
                <th>Student groups</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="font-mono text-xs font-bold">{version.version}</td>
                  <td>{version.is_demo ? "Demo" : "Research"}</td>
                  <td>{new Date(version.trained_at).toLocaleString()}</td>
                  <td>{version.sample_size}</td>
                  <td>{version.student_count}</td>
                  <td>
                    <Badge tone={version.active ? "green" : "slate"}>
                      {version.active ? "Active" : "Superseded"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PathwayComparison() {
  const [pathways, setPathways] = useState<any[] | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api<any[]>("/api/teacher/students").then(setStudents);
  }, []);
  const loadPathways = useCallback(() => {
    const suffix = studentId ? `?student_id=${studentId}` : "";
    api<any[]>(`/api/teacher/pathways${suffix}`)
      .then(setPathways)
      .catch((cause) => setError(messageOf(cause)));
  }, [studentId]);
  useEffect(loadPathways, [loadPathways]);
  async function deletePathway(pathway: any) {
    if (!window.confirm(`Permanently delete the saved pathway comparison "${pathway.label}" for ${pathway.participant_code}?`)) return;
    try {
      await remove(`/api/teacher/pathways/${pathway.id}`);
      setNotice(`${pathway.label} was permanently deleted.`);
      setError("");
      await loadPathways();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Multi-objective optimization"
        title="Pathway comparison"
        description="Compare stored candidate scores and see exactly why the selected pathway outranked the alternatives."
        action={
          <select
            className="input w-56"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          >
            <option value="">All learners</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.participant_code}
              </option>
            ))}
          </select>
        }
      />
      {error && <ErrorNotice message={error} />}
      {notice && <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}
      {!pathways ? (
        <Loading />
      ) : !pathways.length ? (
        <Empty
          title="No candidate pathways"
          description="Candidates appear after a student chooses a target competency."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {pathways.map((pathway) => (
            <article
              key={pathway.id}
              className={`rounded-2xl border bg-white p-6 shadow-soft ${
                pathway.selected ? "border-cyanx-500" : "border-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2"><Badge tone="navy">{pathway.participant_code}</Badge><Badge tone="slate">Rank #{pathway.rank}</Badge></div>
                <div className="flex items-center gap-2">{pathway.selected && <Badge tone="cyan">Selected</Badge>}<button onClick={() => deletePathway(pathway)} className="icon-button text-rose-700" aria-label={`Delete ${pathway.label}`}><Trash2 size={16} /></button></div>
              </div>
              <h2 className="mt-4 text-xl font-black text-navy-950">
                {pathway.label}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Target: {pathway.target_concept}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["GC", pathway.gap_coverage],
                  ["PCL", pathway.predicted_cognitive_load],
                  ["NLT", pathway.normalized_learning_time],
                  ["APS", pathway.adaptive_pathway_score],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="mt-1 font-black text-navy-950">
                      {Number(value).toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-cyan-50 p-3 text-xs text-cyan-900">
                <div className="font-black">Weighted contributions</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <span>αGC {Number(pathway.weighted_contributions.gap_coverage).toFixed(3)}</span>
                  <span>β(1−PCL) {Number(pathway.weighted_contributions.load_suitability).toFixed(3)}</span>
                  <span>γ(1−NLT) {Number(pathway.weighted_contributions.time_efficiency).toFixed(3)}</span>
                </div>
                <Equation latex={`${Number(pathway.weights.alpha).toFixed(2)}(${Number(pathway.gap_coverage).toFixed(3)})+${Number(pathway.weights.beta).toFixed(2)}(1-${Number(pathway.predicted_cognitive_load).toFixed(3)})+${Number(pathway.weights.gamma).toFixed(2)}(1-${Number(pathway.normalized_learning_time).toFixed(3)})=${Number(pathway.adaptive_pathway_score).toFixed(3)}`} label={`Adaptive Pathway Score equals ${Number(pathway.adaptive_pathway_score).toFixed(3)}`} />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="font-bold text-navy-950">Estimated time</dt><dd>{pathway.total_minutes} minutes</dd></div>
                <div><dt className="font-bold text-navy-950">Prerequisite sequence</dt><dd>{pathway.prerequisite_sequence.join(" → ") || "No prerequisite steps"}</dd></div>
                <div><dt className="font-bold text-navy-950">Learning gaps addressed</dt><dd>{pathway.learning_gaps_addressed.join(", ") || "No current gaps"}</dd></div>
              </dl>
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{pathway.selection_reason}</p>
              <p className="mt-3 text-xs text-slate-500">Tie-breaker: {pathway.tie_breaker}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function ExpertEvaluation() {
  const [pathways, setPathways] = useState<any[] | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [pathwayId, setPathwayId] = useState("");
  const [scores, setScores] = useState({
    recommendation_accuracy: 4,
    adaptability: 4,
    personalization: 4,
    optimization_efficiency: 4,
    pathway_relevance: 4,
  });
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([
      api<any[]>("/api/teacher/pathways"),
      api<any>("/api/teacher/settings"),
    ]).then(([pathwayRows, settingValues]) => {
      setPathways(pathwayRows.filter((row) => row.selected));
      setSettings(settingValues);
      if (pathwayRows[0]) setPathwayId(String(pathwayRows[0].id));
    });
  }, []);
  if (!pathways || !settings)
    return <Loading label="Loading evaluation form…" />;
  const dimensions = [
    ["recommendation_accuracy", "Recommendation accuracy"],
    ["adaptability", "Adaptability"],
    ["personalization", "Personalization"],
    ["optimization_efficiency", "Optimization efficiency"],
    ["pathway_relevance", "Learning pathway relevance"],
  ] as const;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await post("/api/teacher/evaluations", {
        pathway_id: Number(pathwayId),
        ...scores,
        comment,
      });
      setMessage("Expert evaluation recorded.");
      setComment("");
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Expert review instrument"
        title="Pathway evaluation"
        description={`Rate each dimension on the configured 1–${settings.likert_scale_max} Likert scale and add an optional qualitative comment.`}
      />
      {error && <ErrorNotice message={error} />}
      {message && (
        <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      )}
      {!pathways.length ? (
        <Empty
          title="No selected pathway available"
          description="A student must first choose a target competency."
        />
      ) : (
        <form
          onSubmit={submit}
          className="rounded-2xl bg-white p-6 shadow-soft sm:p-8"
        >
          <label className="field">
            <span>Pathway to evaluate</span>
            <select
              value={pathwayId}
              onChange={(event) => setPathwayId(event.target.value)}
              required
            >
              {pathways.map((pathway) => (
                <option key={pathway.id} value={pathway.id}>
                  {pathway.participant_code} · {pathway.label} ·{" "}
                  {pathway.target_concept}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-6 space-y-5">
            {dimensions.map(([key, label]) => (
              <fieldset
                key={key}
                className="rounded-xl border border-slate-100 p-4"
              >
                <legend className="px-2 text-sm font-black text-navy-950">
                  {label}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from(
                    { length: settings.likert_scale_max },
                    (_, index) => index + 1,
                  ).map((value) => (
                    <label
                      key={value}
                      className={`grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-sm font-black ${
                        scores[key] === value
                          ? "bg-cyanx-500 text-navy-950"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={key}
                        checked={scores[key] === value}
                        onChange={() => setScores({ ...scores, [key]: value })}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <label className="field mt-5">
            <span>Optional comment</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Describe strengths, concerns, or suggested changes…"
            />
          </label>
          <button className="btn-primary mt-6">
            <ClipboardCheck size={17} /> Submit evaluation
          </button>
        </form>
      )}
    </>
  );
}

const exportTypes = [
  ["interactions", "Learner interaction logs", "Scores, accuracy, timing, attempts, skips, and hint use"],
  ["mastery", "Concept mastery records", "Timestamped mastery scores and classifications"],
  ["gaps", "Learning-gap records", "Threshold evidence and resolution status"],
  ["mental-effort", "Mental-effort ratings", "1–9 reference labels and categories"],
  ["pathways", "Generated pathways", "Candidate GC, PCL, NLT, APS, and time"],
  ["evaluations", "Expert evaluations", "Likert ratings and qualitative comments"],
  ["models", "Model-performance metrics", "Grouped evaluation metadata and warnings"],
] as const;

function ResearchExports() {
  const [mode, setMode] = useState("demo");
  const [confirmation, setConfirmation] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function reset() {
    try {
      await post("/api/teacher/reset-demo", { confirmation });
      setMessage("Demo data reset and reseeded.");
      setShowReset(false);
      setConfirmation("");
    } catch (cause) {
      setError(messageOf(cause));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Research data governance"
        title="Anonymized CSV exports"
        description="Exports replace internal student IDs with participant codes and omit passwords and unnecessary personal information."
        action={
          <select
            className="input w-44"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="demo">Demo records</option>
            <option value="research">Research records</option>
          </select>
        }
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {message && (
        <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      )}
      {mode === "demo" && <DemoNotice />}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportTypes.map(([key, title, description]) => (
          <article key={key} className="rounded-2xl bg-white p-5 shadow-soft">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyanx-100 text-cyan-800">
              <Database size={19} />
            </span>
            <h2 className="mt-4 font-black text-navy-950">{title}</h2>
            <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
              {description}
            </p>
            <a
              href={`/api/teacher/exports/${key}?mode=${mode}`}
              className="btn-secondary mt-4 inline-flex"
              download
            >
              <Download size={16} /> Export CSV
            </a>
          </article>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <h2 className="font-black text-rose-900">Reset demonstration data</h2>
        <p className="mt-1 text-sm leading-6 text-rose-700">
          This removes and recreates synthetic learner records. Research-mode
          records are outside this reset operation.
        </p>
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white"
          >
            <RefreshCcw size={16} /> Reset demo data
          </button>
        ) : (
          <div className="mt-4 max-w-lg">
            <label className="field">
              <span>
                Type <strong>RESET DEMO DATA</strong> to confirm
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={reset}
                disabled={confirmation !== "RESET DEMO DATA"}
                className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Confirm reset
              </button>
              <button
                onClick={() => setShowReset(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function AuditLogPage() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<any[]>("/api/teacher/audit-logs")
      .then(setLogs)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="Accountability"
        title="Teacher audit log"
        description="Review content, graph, settings, model, evaluation, export, and security changes."
      />
      {error && <ErrorNotice message={error} />}
      {!logs ? (
        <Loading />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="font-mono text-xs font-bold">{log.actor}</td>
                    <td>
                      <Badge tone="cyan">{log.action}</Badge>
                    </td>
                    <td>
                      {log.entity_type}
                      {log.entity_id ? ` #${log.entity_id}` : ""}
                    </td>
                    <td className="max-w-sm truncate font-mono text-xs text-slate-500">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
