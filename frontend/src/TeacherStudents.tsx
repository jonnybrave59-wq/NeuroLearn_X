import {
  Archive,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileClock,
  Gauge,
  KeyRound,
  MoreHorizontal,
  Power,
  RefreshCcw,
  Route,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, inlineApiError, post } from "./api";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  ProgressBar,
} from "./components";

type StudentRow = {
  id: number;
  participant_code: string;
  display_name: string;
  target: string | null;
  mastery_average: number | null;
  mastery_level: string;
  gaps: number;
  cognitive_load: string;
  progress: { completed: number; total: number };
  created_at: string;
  last_sign_in_at: string | null;
  account_status: string;
  section: string | null;
};

type StudentResult = {
  items: StudentRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type PendingAction = {
  student: StudentRow;
  action: string;
};

function messageOf(error: unknown) {
  return inlineApiError(error);
}

function dateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "Active") return "green" as const;
  if (status === "Deactivated") return "amber" as const;
  return "slate" as const;
}

export default function StudentManagementPage() {
  const navigate = useNavigate();
  const [listView, setListView] = useState<"active" | "archived">("active");
  const [result, setResult] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("participant_code");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filters, setFilters] = useState({
    search: "",
    target: "",
    mastery_level: "",
    load: "",
    account_status: "",
    registered_from: "",
    registered_to: "",
    last_sign_in_from: "",
    last_sign_in_to: "",
  });
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      paginated: "true",
      page: String(page),
      page_size: "10",
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    if (listView === "archived") {
      params.set("account_status", "Archived");
      params.set("include_archived", "true");
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (value && !(listView === "archived" && key === "account_status")) {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [filters, listView, page, sortBy, sortOrder]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await api<StudentResult>(`/api/teacher/students?${query}`));
      setError("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const targets = useMemo(
    () =>
      Array.from(
        new Set(
          (result?.items || [])
            .map((student) => student.target)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [result],
  );

  function updateFilter(name: string, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function sort(column: string) {
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function requestAction(student: StudentRow, action: string) {
    setPending({ student, action });
    setReason("");
    setTemporaryPassword("");
  }

  async function runAction() {
    if (!pending) return;
    setWorking(true);
    setError("");
    try {
      const response = await post<{
        message: string;
        temporary_password?: string;
      }>(`/api/teacher/students/${pending.student.id}/actions`, {
        action: pending.action,
        reason: reason || null,
      });
      setNotice(response.message);
      setTemporaryPassword(response.temporary_password || "");
      setPending(null);
      await loadStudents();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Participant management"
        title="Students"
        description="Search student accounts, inspect learning evidence, and manage account access without deleting educational records."
        action={
          <button onClick={loadStudents} className="btn-secondary">
            <RefreshCcw size={16} /> Refresh
          </button>
        }
      />
      <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Student record sections">
        <button
          className={listView === "active" ? "btn-primary" : "btn-secondary !border-0 !shadow-none"}
          onClick={() => {
            setListView("active");
            setPage(1);
          }}
        >
          Active Students
        </button>
        <button
          className={listView === "archived" ? "btn-primary" : "btn-secondary !border-0 !shadow-none"}
          onClick={() => {
            setListView("archived");
            setPage(1);
          }}
        >
          <Archive size={16} /> Archived Students
        </button>
      </div>
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {notice && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-bold">{notice}</div>
          {temporaryPassword && (
            <div className="mt-3 rounded-lg bg-white p-3 font-mono text-base font-black text-navy-950">
              Temporary password: {temporaryPassword}
              <p className="mt-1 font-sans text-xs font-medium text-slate-500">
                Share this privately. It is shown only in this response.
              </p>
            </div>
          )}
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search by student name or ID</span>
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="input !pl-10"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search by student name or ID"
            />
          </label>
          {listView === "active" && <select
            className="input lg:max-w-44"
            value={filters.account_status}
            onChange={(event) => updateFilter("account_status", event.target.value)}
            aria-label="Filter by account status"
          >
            <option value="">All account statuses</option>
            <option>Active</option>
            <option>Deactivated</option>
          </select>}
          <select
            className="input lg:max-w-44"
            value={filters.mastery_level}
            onChange={(event) => updateFilter("mastery_level", event.target.value)}
            aria-label="Filter by mastery"
          >
            <option value="">All mastery levels</option>
            <option>Mastered</option>
            <option>Developing</option>
            <option>At risk</option>
            <option>No evidence</option>
          </select>
        </div>
        <details className="mt-4 rounded-xl border border-slate-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-navy-950">
            Advanced filters
          </summary>
          <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="field">
              <span>Target topic</span>
              <select
                value={filters.target}
                onChange={(event) => updateFilter("target", event.target.value)}
              >
                <option value="">All target topics</option>
                {targets.map((target) => <option key={target}>{target}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Cognitive load</span>
              <select
                value={filters.load}
                onChange={(event) => updateFilter("load", event.target.value)}
              >
                <option value="">All load levels</option>
                <option>Low</option>
                <option>Moderate</option>
                <option>High</option>
                <option>Not estimated</option>
              </select>
            </label>
            {[
              ["registered_from", "Registered from"],
              ["registered_to", "Registered to"],
              ["last_sign_in_from", "Last sign-in from"],
              ["last_sign_in_to", "Last sign-in to"],
            ].map(([name, label]) => (
              <label className="field" key={name}>
                <span>{label}</span>
                <input
                  type="date"
                  value={filters[name as keyof typeof filters]}
                  onChange={(event) => updateFilter(name, event.target.value)}
                />
              </label>
            ))}
          </div>
        </details>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-soft">
        {loading && !result ? (
          <Loading label="Loading student accounts…" />
        ) : !result?.items.length ? (
          <Empty
            title="No students match these filters"
            description="Adjust the filters or create a student account from the public registration page."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1500px]">
                <thead>
                  <tr>
                    {[
                      ["participant_code", "Student ID"],
                      ["display_name", "Student name"],
                      ["target", "Target topic"],
                      ["mastery_average", "Average mastery"],
                      ["gaps", "Learning gaps"],
                      ["cognitive_load", "Cognitive load"],
                    ].map(([column, label]) => (
                      <th key={column}>
                        <button
                          onClick={() => sort(column)}
                          className="inline-flex items-center gap-1.5 hover:text-navy-950"
                        >
                          {label} <ArrowDownUp size={13} />
                        </button>
                      </th>
                    ))}
                    <th>Progress</th>
                    <th>
                      <button onClick={() => sort("created_at")} className="inline-flex items-center gap-1.5">
                        Date registered <ArrowDownUp size={13} />
                      </button>
                    </th>
                    <th>
                      <button onClick={() => sort("last_sign_in_at")} className="inline-flex items-center gap-1.5">
                        Last sign-in <ArrowDownUp size={13} />
                      </button>
                    </th>
                    <th>Account status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((student) => {
                    const progress = student.progress.total
                      ? student.progress.completed / student.progress.total
                      : 0;
                    return (
                      <tr
                        key={student.id}
                        className="cursor-pointer focus-within:bg-cyan-50/40 hover:bg-cyan-50/40"
                        tabIndex={0}
                        aria-label={`View learner details for ${student.display_name}`}
                        onClick={() => navigate(`/teacher/students/${student.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/teacher/students/${student.id}`);
                          }
                        }}
                      >
                        <td className="font-mono font-bold text-navy-950">
                          {student.participant_code}
                        </td>
                        <td>
                          <div className="font-bold text-navy-950">{student.display_name}</div>
                          <div className="text-xs text-slate-400">{student.section || "No section"}</div>
                        </td>
                        <td>{student.target || "Not selected"}</td>
                        <td>
                          <div className="font-bold text-navy-950">
                            {student.mastery_average == null
                              ? "No evidence"
                              : `${Math.round(student.mastery_average * 100)}%`}
                          </div>
                          <div className="text-xs text-slate-400">{student.mastery_level}</div>
                        </td>
                        <td>{student.gaps}</td>
                        <td><Badge tone="slate">{student.cognitive_load}</Badge></td>
                        <td className="min-w-40">
                          <ProgressBar value={progress} />
                          <div className="mt-1 text-xs">
                            {student.progress.completed}/{student.progress.total} steps
                          </div>
                        </td>
                        <td>{dateTime(student.created_at)}</td>
                        <td>{dateTime(student.last_sign_in_at)}</td>
                        <td><Badge tone={statusTone(student.account_status)}>{student.account_status}</Badge></td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <details className="relative">
                            <summary className="icon-button list-none cursor-pointer" aria-label={`Actions for ${student.display_name}`}>
                              <MoreHorizontal size={18} />
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                              {[
                                [Eye, "View profile", `/teacher/students/${student.id}`],
                                [FileClock, "View assessment history", `/teacher/students/${student.id}#history`],
                                [Gauge, "View learning gaps", `/teacher/students/${student.id}#gaps`],
                                [Route, "View recommended pathway", `/teacher/students/${student.id}#pathway`],
                              ].map(([Icon, label, href]) => {
                                const MenuIcon = Icon as typeof Eye;
                                return (
                                  <Link key={label as string} to={href as string} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                                    <MenuIcon size={16} /> {label as string}
                                  </Link>
                                );
                              })}
                              <div className="my-1 border-t border-slate-100" />
                              {listView === "archived" ? (
                                <ActionButton icon={RefreshCcw} label="Restore student" onClick={() => requestAction(student, "reactivate")} />
                              ) : (
                                <>
                                  <ActionButton icon={KeyRound} label="Reset password" onClick={() => requestAction(student, "reset_password")} />
                                  {student.account_status === "Active" ? (
                                    <ActionButton icon={Power} label="Deactivate account" onClick={() => requestAction(student, "deactivate")} />
                                  ) : (
                                    <ActionButton icon={RefreshCcw} label="Reactivate account" onClick={() => requestAction(student, "reactivate")} />
                                  )}
                                  <ActionButton icon={Archive} label="Archive student" onClick={() => requestAction(student, "archive")} />
                                </>
                              )}
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-slate-500">
                Showing {result.items.length} of {result.total} students
              </span>
              <div className="flex items-center gap-2">
                <button className="btn-secondary !px-3" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="px-2 font-bold text-navy-950">
                  Page {result.page} of {result.total_pages}
                </span>
                <button className="btn-secondary !px-3" disabled={page >= result.total_pages} onClick={() => setPage((value) => value + 1)}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {pending && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-navy-950/65 px-5" role="dialog" aria-modal="true" aria-labelledby="student-action-title">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <ShieldAlert size={22} />
              </span>
              <button onClick={() => setPending(null)} className="icon-button" aria-label="Close confirmation"><X size={18} /></button>
            </div>
            <h2 id="student-action-title" className="mt-5 text-2xl font-black text-navy-950">
              {actionTitle(pending.action)} {pending.student.display_name}?
            </h2>
            <p className="mt-2 font-mono text-sm font-bold text-navy-950">
              Student ID: {pending.student.participant_code}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {actionExplanation(pending.action, pending.student.display_name)}
            </p>
            <label className="field mt-5">
              <span>Reason (optional)</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Add context for the audit log" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPending(null)} className="btn-secondary">Cancel</button>
              <button onClick={runAction} disabled={working} className="btn-primary">
                {working ? "Applying…" : "Confirm action"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof UserRound;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 ${danger ? "text-rose-700" : ""}`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function actionTitle(action: string) {
  return {
    reset_password: "Reset the password for",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    archive: "Archive",
    remove: "Remove",
  }[action] || "Update";
}

function actionExplanation(action: string, name: string) {
  if (action === "reset_password") {
    return `A temporary password will be created for ${name}. They must replace it at their next successful sign-in.`;
  }
  if (action === "deactivate") {
    return `${name} will be unable to sign in until an authorized teacher reactivates the account.`;
  }
  if (action === "reactivate") {
    return `${name} will regain access to their existing dashboard and records.`;
  }
  return `${name} will be archived and unable to sign in. Assessment history, mastery, learning gaps, pathways, and audit records will be preserved.`;
}

function UsersPlaceholder() {
  return <UserRound size={26} />;
}
