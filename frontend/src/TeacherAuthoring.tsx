import {
  Archive,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Eye,
  File,
  FilePlus2,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  api,
  apiUrl,
  inlineApiError,
  post,
  patch,
  put,
  remove,
  reportNetworkFailure,
  reportReachableResponse,
} from "./api";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
} from "./components";

type Concept = {
  id: number;
  code: string;
  name: string;
  subject: string;
};

type Choice = {
  id?: number;
  text: string;
  is_correct: boolean;
  misconception_id?: number | null;
  misconception_confidence?: number | null;
  mapping_status?: string;
};

type MisconceptionOption = {
  id: number;
  code: string;
  name: string;
  concept_id: number;
  explanation: string;
  remediation_instruction: string;
  validation_status: string;
};

export type BankQuestion = {
  id: number;
  concept_id: number;
  concept: string;
  prompt: string;
  question_type: string;
  correct_answer: string;
  explanation: string;
  hint: string;
  difficulty: string;
  cognitive_level: string;
  subject: string;
  topic: string;
  learning_competency: string;
  source_type: string;
  source_document_id: number | null;
  source_document: string | null;
  source_locator: string;
  solution_steps: string;
  solution_structure: Record<string, unknown>;
  estimated_cognitive_demand: number;
  prerequisite_concept_id: number | null;
  validation_status: string;
  validation_flags: string[];
  distractor_rationales: Record<string, string>;
  is_calculation: boolean;
  points: number;
  status: string;
  choices: Choice[];
  created_at: string;
  updated_at: string;
};

type UploadedDocument = {
  id: number;
  original_filename: string;
  file_type: string;
  file_size: number;
  processing_status: string;
  text_length: number;
  text_preview: string;
  analysis: {
    title: string;
    module_title?: string;
    detected_subject?: string;
    detected_language?: string;
    headings: string[];
    main_topic: string;
    key_concepts: string[];
    definitions: string[];
    facts: string[];
    formulas: string[];
    worked_examples: string[];
    competencies: string[];
    relationships: string[];
    misconceptions: string[];
    subtopics?: string[];
    learning_objectives?: string[];
    prerequisites?: string[];
    estimated_learner_level?: string;
    estimated_difficulty?: string;
    pages_used_as_evidence?: number[];
    unreadable_pages?: number[];
    ocr_status?: string;
    method: string;
    limitations: string;
  };
};

type StudentOption = {
  id: number;
  participant_code: string;
  display_name: string;
  section: string | null;
};

type AssessmentDraft = {
  title: string;
  description: string;
  subject: string;
  topic: string;
  status: string;
  mastery_threshold: number;
  time_limit: string;
  maximum_attempts: number;
  available_from: string;
  due_at: string;
  student_ids: number[];
  sections: string;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  show_score_immediately: boolean;
  show_explanations: boolean;
  allow_retake: boolean;
};

const questionTypes = [
  "Multiple choice",
  "True or false",
  "Identification",
  "Short answer",
  "Problem solving",
];
const difficulties = ["Easy", "Moderate", "Challenging"];
const cognitiveLevels = ["Remember", "Understand", "Apply", "Analyze"];

function messageOf(error: unknown) {
  return inlineApiError(error);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadWithProgress(
  selectedFile: globalThis.File,
  onProgress: (value: number) => void,
): Promise<UploadedDocument> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", apiUrl("/api/teacher/documents"));
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 70));
      }
    };
    request.onload = () => {
      const connection = reportReachableResponse(
        "/api/teacher/documents",
        request.status,
      );
      let body: any = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = {};
      }
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(body as UploadedDocument);
      } else {
        reject(
          new ApiError(
            connection.kind === "session-expired"
              ? connection.message
              : typeof body.detail === "string"
              ? body.detail
              : `Upload failed (${request.status})`,
            request.status,
            connection.kind === "session-expired" ? "session-expired" : null,
            connection.kind === "session-expired",
          ),
        );
      }
    };
    request.onerror = () => {
      void reportNetworkFailure().then((connection) =>
        reject(new ApiError(connection.message, 0, connection.kind, true)),
      );
    };
    const data = new FormData();
    data.append("file", selectedFile);
    request.send(data);
  });
}

export function QuestionStudioPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [aiConfiguration, setAiConfiguration] = useState<{ configured: boolean; provider: string | null; model: string | null; message: string } | null>(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "General Physics",
    grade_level: "Grade 12",
    topic: "",
    concept_id: "",
    learning_competency: "",
    number_of_questions: 5,
    question_type: "Multiple choice",
    difficulty: "Moderate",
    cognitive_level: "Understand",
    include_explanations: true,
    include_hints: true,
    include_prerequisites: true,
    include_calculations: false,
    include_solutions: true,
    concept_focus: [] as string[],
    target_misconception: "",
    language: "English",
    source_grounding: true,
  });

  useEffect(() => {
    Promise.all([
      api<Concept[]>("/api/teacher/concepts?include_archived=false"),
      api<StudentOption[]>("/api/teacher/students"),
      api<MisconceptionOption[]>("/api/teacher/misconceptions"),
      api<{ configured: boolean; provider: string | null; model: string | null; message: string }>("/api/teacher/ai/configuration"),
    ])
      .then(([conceptRows, studentRows, misconceptionRows, aiConfig]) => {
        setConcepts(conceptRows);
        setStudents(studentRows);
        setMisconceptions(misconceptionRows);
        setAiConfiguration(aiConfig);
      })
      .catch((cause) => setError(messageOf(cause)));
  }, []);

  function setFile(file: globalThis.File | null) {
    if (
      file &&
      !["pdf", "docx", "pptx", "txt"].includes(
        file.name.split(".").pop()?.toLowerCase() || "",
      )
    ) {
      setError("Upload a PDF, DOCX, PPTX, or TXT learning material.");
      return;
    }
    setSelectedFile(file);
    setDocument(null);
    setUploadProgress(0);
    setError("");
  }

  async function upload() {
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    setUploadProgress(4);
    try {
      const uploaded = await uploadWithProgress(selectedFile, setUploadProgress);
      setDocument(uploaded);
      setNotice("Learning material uploaded and processed successfully.");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setUploading(false);
    }
  }

  async function clearDocument() {
    if (document) {
      try {
        await remove(`/api/teacher/documents/${document.id}`);
      } catch (cause) {
        setError(messageOf(cause));
        return;
      }
    }
    setSelectedFile(null);
    setDocument(null);
    setUploadProgress(0);
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!document) {
      setError("Upload and process a learning material first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const generated = await post<BankQuestion[]>(
        `/api/teacher/documents/${document.id}/generate`,
        { ...form, concept_id: Number(form.concept_id) },
      );
      setQuestions(generated);
      setSelected(new Set(generated.map((question) => question.id)));
      setNotice(
        `${generated.length} draft questions generated. Review them before publishing.`,
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setGenerating(false);
    }
  }

  function updateQuestion(id: number, patch: Partial<BankQuestion>) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...patch } : question,
      ),
    );
  }

  async function saveQuestion(question: BankQuestion, status = question.status) {
    const updated = await put<BankQuestion>(
      `/api/teacher/question-bank/${question.id}`,
      questionPayload({ ...question, status }),
    );
    setQuestions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    return updated;
  }

  async function questionAction(question: BankQuestion, action: string) {
    setError("");
    try {
      const updated = await post<BankQuestion>(
        `/api/teacher/question-bank/${question.id}/${action}`,
      );
      if (action === "archive") {
        setQuestions((current) =>
          current.filter((item) => item.id !== question.id),
        );
        setSelected((current) => {
          const next = new Set(current);
          next.delete(question.id);
          return next;
        });
      } else if (action === "duplicate") {
        setQuestions((current) => [...current, updated]);
      } else {
        updateQuestion(question.id, updated);
      }
      setNotice(`Question ${action} completed.`);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function batch(action: "regenerate" | "archive" | "save") {
    if (!selected.size) {
      setError("Select at least one question.");
      return;
    }
    setError("");
    try {
      const response = await post<{ items: BankQuestion[] }>(
        "/api/teacher/question-bank/batch",
        { question_ids: Array.from(selected), action },
      );
      if (action === "archive") {
        setQuestions((current) =>
          current.filter((question) => !selected.has(question.id)),
        );
        setSelected(new Set());
      } else {
        const replacements = new Map(
          response.items.map((question) => [question.id, question]),
        );
        setQuestions((current) =>
          current.map((question) => replacements.get(question.id) || question),
        );
      }
      setNotice(`Batch ${action} completed.`);
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function saveSelectedDrafts() {
    try {
      await Promise.all(
        questions
          .filter((question) => selected.has(question.id))
          .map((question) => saveQuestion(question, "Draft")),
      );
      setNotice("Selected questions saved as drafts.");
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  const selectedQuestions = questions.filter((question) =>
    selected.has(question.id),
  );

  return (
    <>
      <PageHeader
        eyebrow="Material-grounded assessment authoring"
        title="Question Studio"
        description="A configured server-side AI analyzes the actual module, generates source-grounded drafts, and performs a quality-review pass before teacher approval."
      />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {notice && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}
      {aiConfiguration && !aiConfiguration.configured && <ErrorNotice message={aiConfiguration.message} />}

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyanx-100 text-cyan-800">
              <UploadCloud size={22} />
            </span>
            <div>
              <h2 className="text-xl font-black text-navy-950">
                Upload Learning Material
              </h2>
              <p className="text-xs text-slate-500">PDF, DOCX, PPTX, or TXT · maximum 10 MB</p>
            </div>
          </div>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event: DragEvent) => {
              event.preventDefault();
              setFile(event.dataTransfer.files[0] || null);
            }}
            className="mt-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-7 text-center transition hover:border-cyanx-400"
          >
            <FilePlus2 className="mx-auto text-cyanx-600" size={30} />
            <p className="mt-3 text-sm font-bold text-navy-950">
              Drag and drop a learning material
            </p>
            <p className="mt-1 text-xs text-slate-500">or browse from this device</p>
            <label className="btn-secondary mt-4 cursor-pointer">
              Browse files
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.pptx,.txt"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFile(event.target.files?.[0] || null)
                }
              />
            </label>
          </div>
          {selectedFile && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <File size={20} className="mt-0.5 shrink-0 text-cyanx-600" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-navy-950">
                      {selectedFile.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedFile.name.split(".").pop()?.toUpperCase()} · {formatBytes(selectedFile.size)}
                    </div>
                  </div>
                </div>
                <button onClick={clearDocument} className="icon-button" aria-label="Remove uploaded file">
                  <X size={17} />
                </button>
              </div>
              {(uploading || uploadProgress > 0) && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>{uploadProgress < 75 ? "Uploading" : uploadProgress < 100 ? "Processing text" : "Ready"}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-cyanx-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              {document ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                    <strong>{document.processing_status}:</strong> {document.text_length.toLocaleString()} readable characters extracted securely.
                  </div>
                  <details className="rounded-xl border border-cyan-200 bg-cyan-50 p-4" open>
                    <summary className="cursor-pointer text-sm font-black text-cyan-950">
                      Material analysis: {document.analysis.main_topic}
                    </summary>
                    <div className="mt-3 space-y-3 text-xs leading-5 text-cyan-950">
                      <p><strong>Detected title:</strong> {document.analysis.title}</p>
                      <p><strong>Detected subject and language:</strong> {document.analysis.detected_subject || "Teacher confirmation needed"} · {document.analysis.detected_language || "Unknown"}</p>
                      <p><strong>Learner level and difficulty:</strong> {document.analysis.estimated_learner_level || "Not estimated"} · {document.analysis.estimated_difficulty || "Not estimated"}</p>
                      <p><strong>Key concepts:</strong> {document.analysis.key_concepts.join(", ") || "Teacher confirmation needed"}</p>
                      <p><strong>Headings:</strong> {document.analysis.headings.join(" · ") || "No explicit headings detected"}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["Definitions", document.analysis.definitions],
                          ["Facts", document.analysis.facts],
                          ["Formulas", document.analysis.formulas],
                          ["Worked examples", document.analysis.worked_examples],
                          ["Competencies", document.analysis.competencies],
                          ["Relationships", document.analysis.relationships],
                          ["Misconceptions", document.analysis.misconceptions],
                          ["Subtopics", document.analysis.subtopics || []],
                          ["Learning objectives", document.analysis.learning_objectives || []],
                          ["Prerequisites", document.analysis.prerequisites || []],
                        ].map(([label, values]) => (
                          <div key={label as string} className="rounded-lg bg-white/70 p-3">
                            <strong>{label as string}</strong>
                            <ul className="mt-1 list-disc pl-4">
                              {(values as string[]).slice(0, 3).map((value) => <li key={value}>{value}</li>)}
                              {!(values as string[]).length && <li>None explicitly detected</li>}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <p><strong>Method:</strong> {document.analysis.method}</p>
                      <p><strong>Pages used as evidence:</strong> {document.analysis.pages_used_as_evidence?.join(", ") || "Section-based source"}</p>
                      <p><strong>OCR/readability:</strong> {document.analysis.ocr_status || "Not reported"}{document.analysis.unreadable_pages?.length ? ` Unreadable pages: ${document.analysis.unreadable_pages.join(", ")}.` : ""}</p>
                      <p><strong>Limitations:</strong> {document.analysis.limitations}</p>
                    </div>
                  </details>
                </div>
              ) : (
                <button disabled={uploading} onClick={upload} className="btn-primary mt-4 w-full">
                  {uploading ? <LoaderCircle className="animate-spin" size={17} /> : <UploadCloud size={17} />}
                  {uploading ? "Uploading and processing…" : "Upload and process"}
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={generate} className="rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-navy-950">Generation settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Questions are stored as drafts and are never published automatically.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Subject">
              <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required />
            </FormField>
            <FormField label="Grade level">
              <select value={form.grade_level} onChange={(event) => setForm({ ...form, grade_level: event.target.value })}>
                <option>Grade 11</option><option>Grade 12</option>
              </select>
            </FormField>
            <FormField label="Topic">
              <input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} placeholder="e.g. Newton's Laws" required />
            </FormField>
            <FormField label="Concept">
              <select value={form.concept_id} onChange={(event) => setForm({ ...form, concept_id: event.target.value })} required>
                <option value="">Select concept</option>
                {concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
              </select>
            </FormField>
            <FormField label="Learning competency" wide>
              <textarea value={form.learning_competency} onChange={(event) => setForm({ ...form, learning_competency: event.target.value })} placeholder="Describe the expected learning competency" required />
            </FormField>
            <FormField label="Number of questions">
              <input type="number" min={1} max={30} value={form.number_of_questions} onChange={(event) => setForm({ ...form, number_of_questions: Number(event.target.value) })} required />
            </FormField>
            <FormField label="Question type">
              <select value={form.question_type} onChange={(event) => setForm({ ...form, question_type: event.target.value })}>
                {[...questionTypes, "Mixed"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </FormField>
          </div>
          <details className="mt-4 rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-navy-950">
              Advanced question settings
            </summary>
            <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
              <FormField label="Difficulty">
                <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
                  {difficulties.map((item) => <option key={item}>{item}</option>)}
                </select>
              </FormField>
              <FormField label="Cognitive level">
                <select value={form.cognitive_level} onChange={(event) => setForm({ ...form, cognitive_level: event.target.value })}>
                  {cognitiveLevels.map((item) => <option key={item}>{item}</option>)}
                </select>
              </FormField>
              <FormField label="Concept focus">
                <input value={form.concept_focus.join(", ")} onChange={(event) => setForm({ ...form, concept_focus: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="e.g. slope, intercept" />
              </FormField>
              <FormField label="Target misconception">
                <input value={form.target_misconception} onChange={(event) => setForm({ ...form, target_misconception: event.target.value })} placeholder="e.g. reversing the slope ratio" />
              </FormField>
              <FormField label="Language">
                <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}><option>English</option><option>Filipino</option></select>
              </FormField>
              {[
                ["include_explanations", "Include explanations"],
                ["include_hints", "Include hints"],
                ["include_prerequisites", "Include prerequisite-concept questions"],
                ["include_calculations", "Include supported calculation questions"],
                ["include_solutions", "Include complete scaffolded solutions"],
                ["source_grounding", "Require page or section grounding"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form[name as keyof typeof form] as boolean} onChange={(event) => setForm({ ...form, [name]: event.target.checked })} className="accent-cyan-600" />
                  {label}
                </label>
              ))}
            </div>
          </details>
          <details className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
            <summary className="cursor-pointer text-sm font-black text-cyan-950">What do these generation settings do?</summary>
            <dl className="mt-4 grid gap-3 text-xs leading-5 text-cyan-950 sm:grid-cols-2">
              {[
                ["Number of questions", "Controls how many questions the AI will prepare.", "Example: 10 creates ten review drafts."],
                ["Question type", "Chooses multiple-choice, true-or-false, short-answer, problem-solving, or mixed items.", "Example: Mixed varies the response format."],
                ["Difficulty", "Controls the reasoning and number of steps required.", "Example: Challenging may require a multi-step calculation."],
                ["Learning objective", "Defines what the learner should demonstrate.", "Example: Solve a linear equation and verify the solution."],
                ["Concept focus", "Limits questions to selected concepts or subtopics.", "Example: slope, intercept."],
                ["Cognitive demand", "Controls recall, understanding, application, or analysis.", "Example: Apply uses the rule in a new situation."],
                ["Include solutions", "Generates complete teaching solutions and explanations.", "Example: show formula, substitution, and result."],
                ["Target misconception", "Builds distractors or follow-up questions around a misunderstanding.", "Example: reversing numerator and denominator."],
                ["Language", "Controls the language used in questions and explanations.", "Example: Filipino produces Filipino-language drafts."],
                ["Source grounding", "Requires every generated question to cite supporting material.", "Example: Page 4 · Worked Example 2."],
              ].map(([name, description, example]) => <div key={name} className="rounded-lg bg-white/80 p-3"><dt className="font-black">{name}</dt><dd>{description}<span className="mt-1 block text-cyan-700">{example}</span></dd></div>)}
            </dl>
          </details>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <strong>Generation summary:</strong> Generate {form.number_of_questions} {form.difficulty.toLowerCase()}-difficulty {form.subject || "subject"} questions about {form.topic || "the selected topic"} using the uploaded module{form.include_solutions ? ", including scaffolded solutions" : ""}{form.target_misconception ? ` and distractors addressing ${form.target_misconception}` : ""}.
          </div>
          <button disabled={!document || generating || !aiConfiguration?.configured} className="btn-primary mt-5 w-full">
            {generating ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}
            {generating ? "Generating draft questions…" : "Generate Draft Questions"}
          </button>
        </form>
      </section>

      <section className="mt-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyanx-600">Teacher review required</div>
            <h2 className="mt-1 text-2xl font-black text-navy-950">Generated question review</h2>
            <p className="mt-1 text-sm text-slate-500">{selected.size} of {questions.length} selected for final actions</p>
          </div>
          {questions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelected(new Set(questions.map((question) => question.id)))} className="btn-secondary !px-3">Select all</button>
              <button onClick={() => setSelected(new Set())} className="btn-secondary !px-3">Deselect all</button>
              <button onClick={() => batch("regenerate")} className="btn-secondary !px-3"><RefreshCcw size={15} /> Regenerate selected</button>
              <button onClick={() => batch("archive")} className="btn-secondary !px-3 text-rose-700"><Trash2 size={15} /> Delete selected</button>
              <button onClick={() => batch("save")} className="btn-secondary !px-3"><Save size={15} /> Save to bank</button>
            </div>
          )}
        </div>
        {!questions.length ? (
          <div className="mt-5 rounded-2xl bg-white shadow-soft">
            <Empty title="No generated questions yet" description="Upload a learning material and choose generation settings. Draft questions will appear here for review." />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {questions.map((question, index) => (
              <QuestionReviewCard
                key={question.id}
                question={question}
                index={index}
                concepts={concepts}
                misconceptions={misconceptions}
                selected={selected.has(question.id)}
                onSelection={(checked) => setSelected((current) => {
                  const next = new Set(current);
                  if (checked) next.add(question.id); else next.delete(question.id);
                  return next;
                })}
                onChange={(patch) => updateQuestion(question.id, patch)}
                onSave={() => saveQuestion(question).then(() => setNotice("Question changes saved.")).catch((cause) => setError(messageOf(cause)))}
                onAction={(action) => questionAction(question, action)}
              />
            ))}
          </div>
        )}
      </section>

      {questions.length > 0 && (
        <section className="sticky bottom-4 z-20 mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black text-navy-950">Final actions</div>
            <div className="text-xs text-slate-500">{selectedQuestions.length} reviewed questions selected</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveSelectedDrafts} className="btn-secondary"><Save size={16} /> Save as Draft</button>
            <button onClick={() => batch("save")} className="btn-secondary"><CheckCircle2 size={16} /> Save to Question Bank</button>
            <button disabled={!selectedQuestions.length} onClick={() => setPreviewOpen(true)} className="btn-secondary"><Eye size={16} /> Preview Assessment</button>
            <button disabled={!selectedQuestions.length} onClick={() => setPublicationOpen(true)} className="btn-primary"><Send size={16} /> Publish to Student Assessment</button>
          </div>
        </section>
      )}

      {previewOpen && (
        <PreviewModal questions={selectedQuestions} onClose={() => setPreviewOpen(false)} />
      )}
      {publicationOpen && (
        <PublicationModal
          questions={selectedQuestions}
          students={students}
          defaultSubject={form.subject}
          defaultTopic={form.topic}
          onClose={() => setPublicationOpen(false)}
          onPublished={(message) => {
            setPublicationOpen(false);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}

function QuestionReviewCard({
  question,
  index,
  concepts,
  selected,
  onSelection,
  onChange,
  onSave,
  onAction,
  misconceptions = [],
}: {
  question: BankQuestion;
  index: number;
  concepts: Concept[];
  selected: boolean;
  onSelection: (checked: boolean) => void;
  onChange: (patch: Partial<BankQuestion>) => void;
  onSave: () => void;
  onAction: (action: string) => void;
  misconceptions?: MisconceptionOption[];
}) {
  function updateSolutionField(key: string, value: string) {
    onChange({
      solution_structure: {
        ...(question.solution_structure || {}),
        [key]: value,
      },
    });
  }
  function updateChoice(choiceIndex: number, patch: Partial<Choice>) {
    const choices = question.choices.map((choice, indexValue) =>
      indexValue === choiceIndex ? { ...choice, ...patch } : choice,
    );
    const correct = choices.find((choice) => choice.is_correct);
    onChange({ choices, correct_answer: correct?.text || question.correct_answer });
  }
  function selectCorrect(choiceIndex: number) {
    const choices = question.choices.map((choice, indexValue) => ({
      ...choice,
      is_correct: choiceIndex === indexValue,
      misconception_id: choiceIndex === indexValue ? null : choice.misconception_id,
      misconception_confidence: choiceIndex === indexValue ? null : choice.misconception_confidence,
      mapping_status: choiceIndex === indexValue ? "Validated" : choice.mapping_status,
    }));
    onChange({ choices, correct_answer: choices[choiceIndex].text });
  }
  return (
    <article className={`rounded-2xl border-2 bg-white p-5 shadow-soft sm:p-6 ${selected ? "border-cyanx-400" : "border-transparent"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm font-black text-navy-950">
          <input type="checkbox" checked={selected} onChange={(event) => onSelection(event.target.checked)} className="h-4 w-4 accent-cyan-600" />
          Question {index + 1}
        </label>
        <div className="flex flex-wrap gap-2">
          <Badge tone={question.status === "Draft" ? "amber" : "cyan"}>{question.status}</Badge>
          <Badge tone={question.validation_status === "Ready for review" ? "green" : "rose"}>
            {question.validation_status}
          </Badge>
          {question.is_calculation && <Badge tone="cyan">Calculation</Badge>}
          <Badge>{question.question_type}</Badge>
          <button onClick={() => onAction("regenerate")} className="icon-button" aria-label="Regenerate this question"><RefreshCcw size={16} /></button>
          <button onClick={() => onAction("duplicate")} className="icon-button" aria-label="Duplicate this question"><Copy size={16} /></button>
          <button onClick={() => onAction("archive")} className="icon-button text-rose-700" aria-label="Delete this question"><Trash2 size={16} /></button>
        </div>
      </div>
      {question.validation_flags?.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <strong>Automatic quality checks</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {question.validation_flags.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <FormField label="Question prompt" wide>
          <textarea value={question.prompt} onChange={(event) => onChange({ prompt: event.target.value })} />
        </FormField>
        <FormField label="Question type">
          <select
            value={question.question_type}
            onChange={(event) => {
              const nextType = event.target.value;
              if (nextType === "True or false") {
                onChange({
                  question_type: nextType,
                  correct_answer: "True",
                  choices: [
                    { text: "True", is_correct: true },
                    { text: "False", is_correct: false },
                  ],
                });
              } else if (nextType === "Multiple choice") {
                const answer = question.correct_answer || "Correct answer";
                onChange({
                  question_type: nextType,
                  correct_answer: answer,
                  choices:
                    question.choices.length >= 2
                      ? question.choices
                      : [
                          { text: answer, is_correct: true },
                          { text: "Alternative answer 1", is_correct: false },
                          { text: "Alternative answer 2", is_correct: false },
                          { text: "Alternative answer 3", is_correct: false },
                        ],
                });
              } else {
                onChange({
                  question_type: nextType,
                  choices: [],
                });
              }
            }}
          >
            {questionTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </FormField>
        <FormField label="Concept alignment">
          <select value={question.concept_id} onChange={(event) => onChange({ concept_id: Number(event.target.value) })}>
            {concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}
          </select>
        </FormField>
        <FormField label="Difficulty">
          <select value={question.difficulty} onChange={(event) => onChange({ difficulty: event.target.value })}>
            {difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}
          </select>
        </FormField>
        <FormField label="Cognitive level">
          <select value={question.cognitive_level} onChange={(event) => onChange({ cognitive_level: event.target.value })}>
            {cognitiveLevels.map((level) => <option key={level}>{level}</option>)}
          </select>
        </FormField>
      </div>
      {question.choices.length > 0 ? (
        <fieldset className="mt-5">
          <legend className="text-xs font-black uppercase tracking-wide text-slate-600">Answer choices and correct answer</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {question.choices.map((choice, choiceIndex) => (
              <div key={choiceIndex} className={`rounded-xl border p-3 ${choice.is_correct ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                <label className="flex items-center gap-3">
                  <input type="radio" name={`correct-${question.id}`} checked={choice.is_correct} onChange={() => selectCorrect(choiceIndex)} className="accent-emerald-600" />
                  <input className="input !border-0 !bg-transparent !p-0 !shadow-none focus:!ring-0" value={choice.text} onChange={(event) => updateChoice(choiceIndex, { text: event.target.value })} />
                </label>
                {!choice.is_correct && (
                  <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                    <label className="text-xs font-bold text-slate-600">Validated misconception mapping
                      <select className="input mt-1" value={choice.misconception_id || ""} onChange={(event) => updateChoice(choiceIndex, {
                        misconception_id: event.target.value ? Number(event.target.value) : null,
                        misconception_confidence: event.target.value ? (choice.misconception_confidence ?? 0.8) : null,
                        mapping_status: event.target.value ? "Teacher reviewed" : "Unreviewed",
                      })}>
                        <option value="">No supported diagnosis</option>
                        {misconceptions.filter((item) => item.concept_id === question.concept_id).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                      </select>
                    </label>
                    {choice.misconception_id && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs font-bold text-slate-600">Mapping confidence
                          <input className="input mt-1" type="number" min={0} max={1} step={0.05} value={choice.misconception_confidence ?? 0.8} onChange={(event) => updateChoice(choiceIndex, { misconception_confidence: Number(event.target.value) })} />
                        </label>
                        <label className="text-xs font-bold text-slate-600">Review status
                          <select className="input mt-1" value={choice.mapping_status || "Unreviewed"} onChange={(event) => updateChoice(choiceIndex, { mapping_status: event.target.value })}><option>Unreviewed</option><option>Teacher reviewed</option><option>Validated</option><option>Rejected</option></select>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="mt-5"><FormField label="Correct or reference answer"><textarea value={question.correct_answer} onChange={(event) => onChange({ correct_answer: event.target.value })} /></FormField></div>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <FormField label="Explanation">
          <textarea value={question.explanation} onChange={(event) => onChange({ explanation: event.target.value })} />
        </FormField>
        <FormField label="Hint">
          <textarea value={question.hint} onChange={(event) => onChange({ hint: event.target.value })} />
        </FormField>
        <FormField label="Source locator">
          <input value={question.source_locator || ""} onChange={(event) => onChange({ source_locator: event.target.value })} />
        </FormField>
        <FormField label="Points">
          <input type="number" min={0.25} max={100} step={0.25} value={question.points || 1} onChange={(event) => onChange({ points: Number(event.target.value) })} />
        </FormField>
        <FormField label="Estimated cognitive demand (0-1)">
          <input type="number" min={0} max={1} step={0.05} value={question.estimated_cognitive_demand ?? 0.5} onChange={(event) => onChange({ estimated_cognitive_demand: Number(event.target.value) })} />
        </FormField>
        <FormField label="Required prerequisite">
          <select value={question.prerequisite_concept_id || ""} onChange={(event) => onChange({ prerequisite_concept_id: event.target.value ? Number(event.target.value) : null })}><option value="">No question-specific prerequisite</option>{concepts.filter((concept) => concept.id !== question.concept_id).map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}</select>
        </FormField>
        <FormField label="Solution steps" wide>
          <textarea value={question.solution_steps || ""} onChange={(event) => onChange({ solution_steps: event.target.value })} />
        </FormField>
        <FormField label="Structured solution: given information">
          <textarea value={String(question.solution_structure?.given_information || "")} onChange={(event) => updateSolutionField("given_information", event.target.value)} />
        </FormField>
        <FormField label="Structured solution: objective">
          <textarea value={String(question.solution_structure?.objective || "")} onChange={(event) => updateSolutionField("objective", event.target.value)} />
        </FormField>
        <FormField label="Structured solution: rule or formula">
          <textarea value={String(question.solution_structure?.rule_or_formula || "")} onChange={(event) => updateSolutionField("rule_or_formula", event.target.value)} />
        </FormField>
        <FormField label="Structured solution: final answer">
          <textarea value={String(question.solution_structure?.final_answer || "")} onChange={(event) => updateSolutionField("final_answer", event.target.value)} />
        </FormField>
      </div>
      {Object.keys(question.distractor_rationales || {}).length > 0 && (
        <details className="mt-5 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-black text-navy-950">Distractor rationales</summary>
          <dl className="mt-3 space-y-2 text-xs">
            {Object.entries(question.distractor_rationales).map(([choice, rationale]) => (
              <div key={choice}><dt className="font-bold text-navy-950">{choice}</dt><dd className="text-slate-600">{rationale}</dd></div>
            ))}
          </dl>
        </details>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-500">Source: {question.source_document || question.source_type}</div>
        <button onClick={onSave} className="btn-secondary"><Save size={15} /> Save changes</button>
      </div>
    </article>
  );
}

function questionPayload(question: BankQuestion) {
  return {
    concept_id: question.concept_id,
    prompt: question.prompt,
    question_type: question.question_type,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    hint: question.hint,
    difficulty: question.difficulty,
    cognitive_level: question.cognitive_level,
    subject: question.subject,
    topic: question.topic,
    learning_competency: question.learning_competency,
    choices: question.choices.map((choice) => ({
      text: choice.text,
      is_correct: choice.is_correct,
      misconception_id: choice.misconception_id || null,
      misconception_confidence: choice.misconception_confidence ?? null,
      mapping_status: choice.is_correct ? "Validated" : choice.mapping_status || "Unreviewed",
    })),
    points: question.points || 1,
    source_locator: question.source_locator || "Uploaded learning material",
    solution_steps: question.solution_steps || "",
    solution_structure: question.solution_structure || {},
    estimated_cognitive_demand: question.estimated_cognitive_demand ?? 0.5,
    prerequisite_concept_id: question.prerequisite_concept_id || null,
    validation_status: question.validation_status || "Needs review",
    validation_flags: question.validation_flags || [],
    distractor_rationales: question.distractor_rationales || {},
    is_calculation: Boolean(question.is_calculation),
    status: question.status,
  };
}

function FormField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PreviewModal({
  questions,
  onClose,
}: {
  questions: BankQuestion[];
  onClose: () => void;
}) {
  return (
    <Modal title="Assessment preview" onClose={onClose}>
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-2">
        {questions.map((question, index) => (
          <article key={question.id} className="rounded-xl border border-slate-200 p-5">
            <div className="text-xs font-black uppercase tracking-wide text-cyanx-600">Question {index + 1} · {question.concept}</div>
            <h3 className="mt-2 font-bold leading-6 text-navy-950">{question.prompt}</h3>
            {question.choices.length > 0 && (
              <ol className="mt-4 space-y-2">
                {question.choices.map((choice, choiceIndex) => (
                  <li key={choiceIndex} className="rounded-lg bg-slate-50 p-3 text-sm">
                    {String.fromCharCode(65 + choiceIndex)}. {choice.text}
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </div>
    </Modal>
  );
}

function PublicationModal({
  questions,
  students,
  defaultSubject,
  defaultTopic,
  onClose,
  onPublished,
}: {
  questions: BankQuestion[];
  students: StudentOption[];
  defaultSubject: string;
  defaultTopic: string;
  onClose: () => void;
  onPublished: (message: string) => void;
}) {
  const [form, setForm] = useState<AssessmentDraft>({
    title: `${defaultTopic || "General Physics"} Assessment`,
    description: "",
    subject: defaultSubject,
    topic: defaultTopic,
    status: "Published",
    mastery_threshold: 0.75,
    time_limit: "30",
    maximum_attempts: 1,
    available_from: "",
    due_at: "",
    student_ids: [],
    sections: "",
    shuffle_questions: false,
    shuffle_choices: false,
    show_score_immediately: true,
    show_explanations: true,
    allow_retake: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function publish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await post<{ title: string; status: string }>(
        "/api/teacher/assessments",
        {
          ...form,
          question_ids: questions.map((question) => question.id),
          time_limit: form.time_limit ? Number(form.time_limit) : null,
          available_from: form.available_from
            ? new Date(form.available_from).toISOString()
            : null,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          sections: form.sections
            .split(",")
            .map((section) => section.trim())
            .filter(Boolean),
        },
      );
      onPublished(`${response.title} saved with ${response.status} status.`);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Publication settings" onClose={onClose} wide>
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      <form onSubmit={publish}>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-2 sm:grid-cols-2">
          <FormField label="Assessment title" wide><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></FormField>
          <FormField label="Description" wide><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
          <FormField label="Subject"><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required /></FormField>
          <FormField label="Topic"><input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} required /></FormField>
          <FormField label="Publication status">
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option>Draft</option><option>Scheduled</option><option>Published</option><option>Closed</option><option>Archived</option>
            </select>
          </FormField>
          <FormField label="Selected questions"><input value={`${questions.length} questions`} disabled /></FormField>
          <FormField label="Time limit (minutes)"><input type="number" min={1} max={600} value={form.time_limit} onChange={(event) => setForm({ ...form, time_limit: event.target.value })} /></FormField>
          <FormField label="Maximum attempts"><input type="number" min={1} max={20} value={form.maximum_attempts} onChange={(event) => setForm({ ...form, maximum_attempts: Number(event.target.value) })} disabled={!form.allow_retake} required /></FormField>
          <FormField label="Passing/mastery threshold"><input type="number" min={10} max={100} value={Math.round(form.mastery_threshold * 100)} onChange={(event) => setForm({ ...form, mastery_threshold: Number(event.target.value) / 100 })} /></FormField>
          <FormField label="Start date and time"><input type="datetime-local" value={form.available_from} onChange={(event) => setForm({ ...form, available_from: event.target.value })} /></FormField>
          <FormField label="Due date and time"><input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} /></FormField>
          <FormField label="Assigned sections"><input value={form.sections} onChange={(event) => setForm({ ...form, sections: event.target.value })} placeholder="STEM A, STEM B" /><small>Comma-separated; leave students and sections empty to assign everyone.</small></FormField>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-600">Assigned students</legend>
            <div className="mt-2 grid max-h-32 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              {students.map((student) => (
                <label key={student.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.student_ids.includes(student.id)} onChange={(event) => setForm({ ...form, student_ids: event.target.checked ? [...form.student_ids, student.id] : form.student_ids.filter((id) => id !== student.id) })} className="accent-cyan-600" />
                  {student.display_name} ({student.participant_code})
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-600">Assessment behavior</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ["shuffle_questions", "Shuffle questions"],
                ["shuffle_choices", "Shuffle answer choices"],
                ["show_score_immediately", "Show score immediately"],
                ["show_explanations", "Show explanations after submission"],
                ["allow_retake", "Allow retake"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form[key as keyof AssessmentDraft] as boolean}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        [key]: event.target.checked,
                        ...(key === "allow_retake" && !event.target.checked
                          ? { maximum_attempts: 1 }
                          : {}),
                      })
                    }
                    className="accent-cyan-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button disabled={saving} className="btn-primary">
            {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}
            {form.status === "Published" ? "Approve and Publish" : `Save as ${form.status}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-navy-950/65 px-4 py-6" role="dialog" aria-modal="true" aria-label={title}>
      <section className={`w-full rounded-2xl bg-white p-6 shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-navy-950">{title}</h2>
          <button onClick={onClose} className="icon-button" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function QuestionBankPage() {
  const [data, setData] = useState<{ items: BankQuestion[]; total: number; total_pages: number } | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    subject: "",
    topic: "",
    concept_id: "",
    question_type: "",
    difficulty: "",
    source_document_id: "",
    status_filter: "",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkForm, setBulkForm] = useState({ concept_id: "", difficulty: "", status: "", learning_competency: "", question_type: "", cognitive_level: "", misconception_id: "" });

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "12" });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    try {
      const [bank, documentRows, conceptRows, studentRows, misconceptionRows] = await Promise.all([
        api<{ items: BankQuestion[]; total: number; total_pages: number }>(`/api/teacher/question-bank?${params}`),
        api<UploadedDocument[]>("/api/teacher/documents"),
        api<Concept[]>("/api/teacher/concepts?include_archived=false"),
        api<StudentOption[]>("/api/teacher/students"),
        api<MisconceptionOption[]>("/api/teacher/misconceptions"),
      ]);
      setData(bank); setDocuments(documentRows); setConcepts(conceptRows); setStudents(studentRows); setMisconceptions(misconceptionRows); setError("");
    } catch (cause) { setError(messageOf(cause)); }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  async function action(question: BankQuestion, value: string) {
    try {
      await post(`/api/teacher/question-bank/${question.id}/${value}`);
      setNotice(`Question ${value} completed.`);
      await load();
    } catch (cause) { setError(messageOf(cause)); }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await put(`/api/teacher/question-bank/${editing.id}`, questionPayload(editing));
      setEditing(null); setNotice("Question updated."); await load();
    } catch (cause) { setError(messageOf(cause)); }
  }

  async function deleteQuestion(question: BankQuestion) {
    if (!window.confirm(`Permanently delete this question?\n\n"${question.prompt}"\n\nArchive and Delete are separate actions. This cannot be undone.`)) return;
    setError("");
    try {
      await remove(`/api/teacher/question-bank/${question.id}`);
      setNotice(`Question permanently deleted: ${question.prompt}`);
      setSelected((current) => { const next = new Set(current); next.delete(question.id); return next; });
      await load();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.message.includes("belongs to")) {
        if (!window.confirm(`${cause.message}\n\nRemove it from the linked assessment(s) and permanently delete it?`)) return;
        try {
          await remove(`/api/teacher/question-bank/${question.id}?detach_from_assessments=true`);
          setNotice(`Question removed from linked assessments and permanently deleted: ${question.prompt}`);
          setSelected((current) => { const next = new Set(current); next.delete(question.id); return next; });
          await load();
          return;
        } catch (retryCause) {
          setError(messageOf(retryCause));
          return;
        }
      }
      setError(messageOf(cause));
    }
  }

  async function bulkDeleteQuestions() {
    const questions = Array.from(selected).map((id) => ({ id, prompt: `Question #${id}` }) as BankQuestion);
    if (!questions.length) return;
    const titles = questions.map((question) => `• ${question.prompt}`).join("\n");
    if (!window.confirm(`Permanently delete ${questions.length} selected question(s)?\n\n${titles}\n\nThis cannot be undone.`)) return;
    const query = questions.map((question) => `question_ids=${question.id}`).join("&");
    try {
      await remove(`/api/teacher/question-bank/bulk-delete?${query}`);
      setNotice(`${questions.length} questions permanently deleted.`);
      setSelected(new Set());
      await load();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409 && cause.message.includes("assessments")) {
        if (!window.confirm(`${cause.message}\n\nRemove the selected questions from linked assessments and continue?`)) return;
        try {
          await remove(`/api/teacher/question-bank/bulk-delete?${query}&detach_from_assessments=true`);
          setNotice(`${questions.length} questions removed from linked assessments and permanently deleted.`);
          setSelected(new Set());
          await load();
          return;
        } catch (retryCause) {
          setError(messageOf(retryCause));
          return;
        }
      }
      setError(messageOf(cause));
    }
  }

  async function selectAllFiltered() {
    const params = new URLSearchParams({ ids_only: "true" });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    try {
      const result = await api<{ ids: number[] }>(`/api/teacher/question-bank?${params}`);
      setSelected(new Set(result.ids));
      setNotice(`${result.ids.length} filtered questions selected.`);
    } catch (cause) { setError(messageOf(cause)); }
  }

  async function bulkArchiveQuestions() {
    if (!selected.size) return;
    try {
      await post("/api/teacher/question-bank/batch", { question_ids: Array.from(selected), action: "archive" });
      setNotice(`${selected.size} selected questions archived.`);
      setSelected(new Set());
      await load();
    } catch (cause) { setError(messageOf(cause)); }
  }

  async function saveBulkEdit() {
    const changes: Record<string, string | number> = Object.fromEntries(Object.entries(bulkForm).filter(([, value]) => value !== ""));
    if (!Object.keys(changes).length) { setError("Choose at least one shared field to update."); return; }
    ["concept_id", "misconception_id"].forEach((key) => {
      if (changes[key]) changes[key] = Number(changes[key]);
    });
    try {
      await patch("/api/teacher/question-bank/bulk-edit", { question_ids: Array.from(selected), ...changes });
      setNotice(`${selected.size} selected questions updated without changing their text, answers, or solutions.`);
      setBulkEditing(false);
      setBulkForm({ concept_id: "", difficulty: "", status: "", learning_competency: "", question_type: "", cognitive_level: "", misconception_id: "" });
      await load();
    } catch (cause) { setError(messageOf(cause)); }
  }

  const selectedQuestions = data?.items.filter((question) => selected.has(question.id)) || [];
  return (
    <>
      <PageHeader eyebrow="Reusable content" title="Question Bank" description="Search, filter, edit, duplicate, archive, and add reviewed questions to an assessment." />
      {error && <ErrorNotice message={error} onDismiss={() => setError("")} />}
      {notice && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2"><span className="sr-only">Search questions</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-10" placeholder="Search question text" value={filters.search} onChange={(event) => { setPage(1); setFilters({ ...filters, search: event.target.value }); }} /></label>
          <input aria-label="Filter by subject" className="input" placeholder="All subjects" value={filters.subject} onChange={(event) => { setPage(1); setFilters({ ...filters, subject: event.target.value }); }} />
          <input aria-label="Filter by topic" className="input" placeholder="All topics" value={filters.topic} onChange={(event) => { setPage(1); setFilters({ ...filters, topic: event.target.value }); }} />
          <select aria-label="Filter by concept" className="input" value={filters.concept_id} onChange={(event) => { setPage(1); setFilters({ ...filters, concept_id: event.target.value }); }}><option value="">All concepts</option>{concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}</select>
          <select className="input" value={filters.question_type} onChange={(event) => setFilters({ ...filters, question_type: event.target.value })}><option value="">All question types</option>{questionTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <select className="input" value={filters.difficulty} onChange={(event) => setFilters({ ...filters, difficulty: event.target.value })}><option value="">All difficulties</option>{difficulties.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="input" value={filters.source_document_id} onChange={(event) => setFilters({ ...filters, source_document_id: event.target.value })}><option value="">All source documents</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.original_filename}</option>)}</select>
          <select className="input" value={filters.status_filter} onChange={(event) => setFilters({ ...filters, status_filter: event.target.value })}><option value="">Active statuses</option><option>Draft</option><option>Ready</option><option>Published</option><option>Archived</option></select>
        </div>
      </section>
      {!data ? <Loading label="Loading question bank…" /> : !data.items.length ? (
        <div className="mt-5 rounded-2xl bg-white shadow-soft"><Empty title="No questions found" description="Adjust the filters or generate questions in Question Studio." /></div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {data.items.map((question) => (
              <article key={question.id} className={`rounded-2xl border-2 bg-white p-5 shadow-soft ${selected.has(question.id) ? "border-cyanx-400" : "border-transparent"}`}>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-cyanx-600"><input type="checkbox" checked={selected.has(question.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} className="accent-cyan-600" /> {question.concept}</label>
                  <div className="flex gap-2"><Badge>{question.question_type}</Badge><Badge tone={question.status === "Draft" ? "amber" : "cyan"}>{question.status}</Badge></div>
                </div>
                <h2 className="mt-4 font-bold leading-6 text-navy-950">{question.prompt}</h2>
                <div className="mt-4 text-xs text-slate-500">Source: {question.source_document || question.source_type}</div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => setEditing(question)} className="btn-secondary !px-3"><Pencil size={15} /> Edit</button>
                  <button onClick={() => action(question, "duplicate")} className="btn-secondary !px-3"><Copy size={15} /> Duplicate</button>
                  <button onClick={() => action(question, "archive")} className="btn-secondary !px-3 text-rose-700"><Archive size={15} /> Archive</button>
                  <button onClick={() => deleteQuestion(question)} className="icon-button text-rose-700" aria-label={`Permanently delete ${question.prompt}`} title="Permanently delete question"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">{selected.size} selected · {data.total} total questions</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setSelected(new Set(data.items.map((item) => item.id)))} className="btn-secondary !px-3">Select current page</button>
              <button onClick={selectAllFiltered} className="btn-secondary !px-3">Select all filtered</button>
              <button disabled={!selected.size} onClick={() => setSelected(new Set())} className="btn-secondary !px-3">Clear</button>
              <button disabled={!selected.size} onClick={() => setBulkEditing(true)} className="btn-secondary !px-3"><Pencil size={15} /> Bulk edit</button>
              <button disabled={!selected.size} onClick={bulkArchiveQuestions} className="btn-secondary !px-3"><Archive size={15} /> Bulk archive</button>
              <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-secondary !px-3"><ChevronLeft size={16} /></button>
              <span className="text-sm font-bold">Page {page} of {data.total_pages}</span>
              <button disabled={page >= data.total_pages} onClick={() => setPage((value) => value + 1)} className="btn-secondary !px-3"><ChevronRight size={16} /></button>
              <button disabled={!selected.size} onClick={bulkDeleteQuestions} className="btn-secondary !px-3 text-rose-700"><Trash2 size={16} /> Delete selected</button>
              <button disabled={!selected.size} onClick={() => setPublicationOpen(true)} className="btn-primary"><Plus size={16} /> Add to Assessment</button>
            </div>
          </div>
        </>
      )}
      {bulkEditing && (
        <Modal title={`Bulk edit ${selected.size} questions`} onClose={() => setBulkEditing(false)} wide>
          <p className="mb-4 text-sm text-slate-500">Only shared metadata is changed. Question text, answers, and solutions remain untouched.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Concept"><select value={bulkForm.concept_id} onChange={(event) => setBulkForm({ ...bulkForm, concept_id: event.target.value })}><option value="">Keep current concepts</option>{concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}</select></FormField>
            <FormField label="Difficulty"><select value={bulkForm.difficulty} onChange={(event) => setBulkForm({ ...bulkForm, difficulty: event.target.value })}><option value="">Keep current difficulty</option>{difficulties.map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label="Status"><select value={bulkForm.status} onChange={(event) => setBulkForm({ ...bulkForm, status: event.target.value })}><option value="">Keep current status</option><option>Draft</option><option>Ready</option><option>Published</option><option>Archived</option></select></FormField>
            <FormField label="Question type"><select value={bulkForm.question_type} onChange={(event) => setBulkForm({ ...bulkForm, question_type: event.target.value })}><option value="">Keep current type</option>{questionTypes.map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label="Cognitive demand"><select value={bulkForm.cognitive_level} onChange={(event) => setBulkForm({ ...bulkForm, cognitive_level: event.target.value })}><option value="">Keep current demand</option>{cognitiveLevels.map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label="Misconception tag"><select value={bulkForm.misconception_id} onChange={(event) => setBulkForm({ ...bulkForm, misconception_id: event.target.value })}><option value="">Keep current tags</option>{misconceptions.map((value) => <option key={value.id} value={value.id}>{value.code} · {value.name}</option>)}</select></FormField>
            <FormField label="Competency"><textarea value={bulkForm.learning_competency} onChange={(event) => setBulkForm({ ...bulkForm, learning_competency: event.target.value })} placeholder="Leave blank to preserve each question's competency" /></FormField>
          </div>
          <div className="mt-5 flex justify-end gap-3"><button onClick={() => setBulkEditing(false)} className="btn-secondary">Cancel</button><button onClick={saveBulkEdit} className="btn-primary"><Save size={16} /> Apply shared changes</button></div>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit question" onClose={() => setEditing(null)} wide>
          <QuestionReviewCard question={editing} index={0} concepts={concepts} misconceptions={misconceptions} selected onSelection={() => undefined} onChange={(patch) => setEditing({ ...editing, ...patch })} onSave={saveEdit} onAction={() => undefined} />
        </Modal>
      )}
      {publicationOpen && (
        <PublicationModal questions={selectedQuestions} students={students} defaultSubject={selectedQuestions[0]?.subject || "General Physics"} defaultTopic={selectedQuestions[0]?.topic || ""} onClose={() => setPublicationOpen(false)} onPublished={(message) => { setPublicationOpen(false); setNotice(message); setSelected(new Set()); load(); }} />
      )}
    </>
  );
}

export function AssessmentManagerPage() {
  const [assessments, setAssessments] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadAssessments = useCallback(() => {
    api<any[]>("/api/teacher/assessments")
      .then(setAssessments)
      .catch((cause) => setError(messageOf(cause)));
  }, []);
  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  async function setAssessmentStatus(assessment: any, status: string) {
    if (!window.confirm(`Change "${assessment.title}" from ${assessment.status} to ${status}?`)) return;
    try {
      await post(`/api/teacher/assessments/${assessment.id}/status`, { status });
      setNotice(`${assessment.title} is now ${status}.`);
      setError("");
      loadAssessments();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  async function deleteAssessment(assessment: any) {
    const learnerWarning = assessment.learner_record_count
      ? `\n\nWARNING: ${assessment.learner_record_count} learner attempt record(s), including linked responses, mental-effort ratings, mastery evidence, and interaction logs, will also be permanently removed.`
      : "";
    if (!window.confirm(`Permanently delete assessment "${assessment.title}"?${learnerWarning}\n\nLinked source questions remain in the Question Bank. This cannot be undone.`)) return;
    try {
      await remove(`/api/teacher/assessments/${assessment.id}?confirm_learner_record_deletion=${assessment.learner_record_count ? "true" : "false"}`);
      setNotice(`${assessment.title} was permanently deleted.`);
      setError("");
      await loadAssessments();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        if (!window.confirm(`${cause.message}\n\nContinue with permanent deletion?`)) return;
        try {
          await remove(`/api/teacher/assessments/${assessment.id}?confirm_learner_record_deletion=true`);
          setNotice(`${assessment.title} and linked learner records were permanently deleted.`);
          await loadAssessments();
          return;
        } catch (retryCause) {
          setError(messageOf(retryCause));
          return;
        }
      }
      setError(messageOf(cause));
    }
  }

  return (
    <>
      <PageHeader eyebrow="Publication control" title="Assessments" description="Review draft, scheduled, published, closed, and archived assessments." />
      {error && <ErrorNotice message={error} />}
      {notice && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      {!assessments ? <Loading label="Loading assessments…" /> : !assessments.length ? (
        <div className="rounded-2xl bg-white shadow-soft"><Empty title="No assessments yet" description="Create one from reviewed questions in Question Studio or the Question Bank." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assessments.map((assessment) => (
            <article key={assessment.id} className="rounded-2xl bg-white p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-wide text-cyanx-600">{assessment.subject} · {assessment.topic}</div><h2 className="mt-2 text-xl font-black text-navy-950">{assessment.title}</h2></div><Badge tone={assessment.status === "Published" ? "green" : assessment.status === "Scheduled" ? "cyan" : "slate"}>{assessment.status}</Badge></div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{assessment.description || "No description provided."}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs font-bold uppercase text-slate-400">Questions</dt><dd className="mt-1 font-black text-navy-950">{assessment.question_count}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Mastery target</dt><dd className="mt-1 font-black text-navy-950">{Math.round(assessment.mastery_threshold * 100)}%</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Time limit</dt><dd className="mt-1 font-black text-navy-950">{assessment.time_limit ? `${assessment.time_limit} min` : "None"}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Attempts</dt><dd className="mt-1 font-black text-navy-950">{assessment.maximum_attempts}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {assessment.status === "Draft" && <button onClick={() => setAssessmentStatus(assessment, "Published")} className="btn-primary !px-3"><Send size={15} /> Publish</button>}
                {assessment.status === "Scheduled" && <button onClick={() => setAssessmentStatus(assessment, "Published")} className="btn-secondary !px-3">Publish now</button>}
                {assessment.status === "Published" && <button onClick={() => setAssessmentStatus(assessment, "Closed")} className="btn-secondary !px-3">Close</button>}
                {assessment.status === "Closed" && <button onClick={() => setAssessmentStatus(assessment, "Published")} className="btn-secondary !px-3">Reopen</button>}
                {assessment.status !== "Archived" && <button onClick={() => setAssessmentStatus(assessment, "Archived")} className="btn-secondary !px-3 text-rose-700"><Archive size={15} /> Archive</button>}
                <button onClick={() => deleteAssessment(assessment)} className="icon-button text-rose-700" aria-label={`Permanently delete ${assessment.title}`} title="Permanently delete assessment"><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
