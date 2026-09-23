import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, Plus, Save, Send, Info, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../../components/layout/dashboardLayout";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { QUESTION_TYPES, draftId, isChoice, newQuestion } from "../../../utils/assessments";
import QuestionEditor from "./components/QuestionEditor";

/**
 * Build or edit an assessment.
 *
 * Questions can be written by hand or drafted by AI from a job. Either way the
 * employer owns the answer key — generated keys are flagged for checking. An
 * assessment already sent keeps working: each candidate sits the version they
 * were sent, so edits here only reach people it is sent to next.
 */

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

const labelClass = "text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";

/** Give generated questions fresh ids so they never collide with ones already in the list. */
const rekey = (questions) =>
  questions.map((question) => {
    const optionIds = new Map(question.options.map((option) => [option.id, draftId("o")]));
    return {
      ...question,
      id: draftId(),
      guidance: question.guidance || "",
      options: question.options.map((option) => ({ ...option, id: optionIds.get(option.id) })),
      correct: question.correct.map((id) => optionIds.get(id)).filter(Boolean),
    };
  });

/** Problems worth catching before the server does. */
const problemsIn = (form) => {
  if (form.title.trim().length < 3) return "Give the assessment a title.";
  if (form.questions.length === 0) return "Add at least one question.";
  for (const [index, question] of form.questions.entries()) {
    const label = `Question ${index + 1}`;
    if (!question.prompt.trim()) return `${label} is empty.`;
    if (!Number(question.points) || question.points < 1) return `${label} needs at least 1 point.`;
    if (isChoice(question)) {
      if (question.options.filter((option) => option.text.trim()).length < 2) return `${label} needs at least two options.`;
      if (question.correct.length === 0) return `${label} has no correct answer ticked.`;
      const blankCorrect = question.options.some((option) => question.correct.includes(option.id) && !option.text.trim());
      if (blankCorrect) return `${label} has a blank option marked correct.`;
    }
  }
  return null;
};

const AssessmentBuilder = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    title: "",
    jobId: searchParams.get("jobId") || "",
    instructions: "",
    timed: true,
    timeLimitMinutes: 30,
    passMark: 60,
    defaultDueDays: 7,
    questions: [],
    status: "draft",
  });
  const [sentCount, setSentCount] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  const [generator, setGenerator] = useState({ count: 10, mix: "mixed", focus: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.JOBS.GET_JOBS_EMPLOYER)
      .then((res) => {
        if (!cancelled) setJobs(Array.isArray(res.data) ? res.data : res.data?.jobs || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return undefined;
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.GET(id))
      .then((res) => {
        if (cancelled) return;
        const assessment = res.data.assessment;
        setForm({
          title: assessment.title,
          jobId: assessment.jobId || "",
          instructions: assessment.instructions || "",
          timed: Boolean(assessment.timeLimitMinutes),
          timeLimitMinutes: assessment.timeLimitMinutes || 30,
          passMark: assessment.passMark,
          defaultDueDays: assessment.defaultDueDays,
          questions: assessment.questions.map((question) => ({ ...question, guidance: question.guidance || "" })),
          status: assessment.status,
        });
        setSentCount(assessment.stats?.sent || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.message || "Could not load this assessment.");
        navigate("/assessments");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEditing, navigate]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const setQuestion = (index, question) =>
    setForm((current) => ({ ...current, questions: current.questions.map((q, i) => (i === index ? question : q)) }));

  const moveQuestion = (index, delta) =>
    setForm((current) => {
      const questions = [...current.questions];
      const [item] = questions.splice(index, 1);
      questions.splice(index + delta, 0, item);
      return { ...current, questions };
    });

  const addQuestion = (type) => set({ questions: [...form.questions, newQuestion(type)] });

  const generate = async () => {
    const job = jobs.find((entry) => (entry._id || entry.id) === form.jobId);
    if (!job && form.title.trim().length < 3) {
      toast.error("Pick a job, or give the assessment a title, so the questions fit the role.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await axiosInstance.post(API_PATHS.ASSESSMENTS.GENERATE, {
        jobId: form.jobId || undefined,
        title: form.title,
        count: generator.count,
        mix: generator.mix,
        focus: generator.focus,
      });
      const generated = rekey(res.data.questions || []);
      set({ questions: [...form.questions, ...generated] });
      setGeneratedCount((count) => count + generated.length);
      toast.success(`${generated.length} questions added — check each answer key before sending.`);
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? "You've generated a lot of questions this hour. Try again shortly."
          : err.response?.data?.message || "Could not generate questions."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const save = async (publish) => {
    const problem = problemsIn(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: form.title,
        jobId: form.jobId || null,
        instructions: form.instructions,
        timeLimitMinutes: form.timed ? Number(form.timeLimitMinutes) : null,
        passMark: Number(form.passMark),
        defaultDueDays: Number(form.defaultDueDays),
        status: publish ? "active" : form.status === "archived" ? "archived" : form.status,
        questions: form.questions.map((question) => ({
          ...question,
          points: Number(question.points),
          options: question.options.filter((option) => option.text.trim()),
        })),
      };
      const res = isEditing
        ? await axiosInstance.put(API_PATHS.ASSESSMENTS.UPDATE(id), payload)
        : await axiosInstance.post(API_PATHS.ASSESSMENTS.CREATE, payload);
      toast.success(publish ? "Assessment saved and ready to send" : "Assessment saved");
      navigate(`/assessments/${res.data.assessment.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the assessment.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalPoints = form.questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);
  const autoMarked = form.questions.filter(isChoice).length;

  if (isLoading) {
    return (
      <DashboardLayout activeMenu="assessments">
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeMenu="assessments">
      <div className="mx-auto max-w-4xl space-y-5 pb-6">
        <Link
          to={isEditing ? `/assessments/${id}` : "/assessments"}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {isEditing ? "Back to assessment" : "All assessments"}
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {isEditing ? "Edit assessment" : "New assessment"}
        </h1>

        {sentCount > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {sentCount} candidate{sentCount === 1 ? " has" : "s have"} already been sent this assessment. They keep the version
            they were sent; your changes apply to anyone you send it to from now on.
          </p>
        )}

        {/* Settings */}
        <section className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelClass}>Title</span>
            <input
              type="text"
              value={form.title}
              maxLength={120}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Ward nursing skills test"
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelClass}>Job</span>
            <select value={form.jobId} onChange={(e) => set({ jobId: e.target.value })} className={fieldClass}>
              <option value="">Not linked to a job — send to any of your applicants</option>
              {jobs.map((job) => (
                <option key={job._id || job.id} value={job._id || job.id}>
                  {job.title}
                  {job.isClosed ? " (closed)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelClass}>Instructions for candidates</span>
            <textarea
              rows={3}
              value={form.instructions}
              maxLength={3000}
              onChange={(e) => set({ instructions: e.target.value })}
              placeholder="What the assessment covers, what they may use (calculator, notes), and anything else they should know before starting."
              className={`${fieldClass} resize-y`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Time limit</span>
            <div className="flex items-center gap-2">
              <select
                value={form.timed ? "timed" : "untimed"}
                onChange={(e) => set({ timed: e.target.value === "timed" })}
                className={fieldClass}
              >
                <option value="timed">Timed</option>
                <option value="untimed">No time limit</option>
              </select>
              {form.timed && (
                <>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={form.timeLimitMinutes}
                    onChange={(e) => set({ timeLimitMinutes: e.target.value })}
                    aria-label="Time limit in minutes"
                    className={`${fieldClass} w-24`}
                  />
                  <span className="text-sm text-gray-500">min</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Pass mark</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.passMark}
                  onChange={(e) => set({ passMark: e.target.value })}
                  className={fieldClass}
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Days to finish</span>
              <input
                type="number"
                min={1}
                max={30}
                value={form.defaultDueDays}
                onChange={(e) => set({ defaultDueDays: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        {/* AI drafting */}
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Draft questions with AI</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Written from the job you picked (or the title). They are added to the list below for you to edit.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500">How many</span>
              <select
                value={generator.count}
                onChange={(e) => setGenerator((g) => ({ ...g, count: Number(e.target.value) }))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {[5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} questions
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500">Kind</span>
              <select
                value={generator.mix}
                onChange={(e) => setGenerator((g) => ({ ...g, mix: e.target.value }))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="mixed">Mixed</option>
                <option value="choice">Multiple choice only</option>
                <option value="written">Written only</option>
              </select>
            </label>
            <label className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500">Focus (optional)</span>
              <input
                type="text"
                value={generator.focus}
                maxLength={500}
                onChange={(e) => setGenerator((g) => ({ ...g, focus: e.target.value }))}
                placeholder="e.g. medication safety and triage"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? "Writing…" : "Generate"}
            </button>
          </div>
          {generatedCount > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              AI can get an answer key wrong. Check every ticked answer before you send this to candidates.
            </p>
          )}
        </section>

        {/* Questions */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Questions</h2>
            <p className="text-xs text-gray-400">
              {form.questions.length} question{form.questions.length === 1 ? "" : "s"} · {totalPoints} points ·{" "}
              {autoMarked} marked automatically
            </p>
          </div>

          {form.questions.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
              No questions yet. Generate some above, or add your own below.
            </p>
          )}

          {form.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              total={form.questions.length}
              onChange={(next) => setQuestion(index, next)}
              onMove={(delta) => moveQuestion(index, delta)}
              onDuplicate={() => {
                const copy = rekey([question])[0];
                setForm((current) => {
                  const questions = [...current.questions];
                  questions.splice(index + 1, 0, copy);
                  return { ...current, questions };
                });
              }}
              onRemove={() => set({ questions: form.questions.filter((_, i) => i !== index) })}
            />
          ))}

          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => addQuestion(type.value)}
                disabled={form.questions.length >= 50}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                <Plus className="h-3.5 w-3.5" />
                {type.label}
              </button>
            ))}
          </div>
        </section>

        {/* Save bar */}
        <div className="sticky bottom-0 z-20 rounded-2xl border border-gray-100 bg-white/95 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="hidden text-xs text-gray-400 sm:block">
              {form.questions.length} questions · {totalPoints} points · pass at {form.passMark}%
            </p>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <Save className="h-4 w-4" />
                {form.status === "active" ? "Save" : "Save draft"}
              </button>
              {form.status !== "active" && (
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Save &amp; make ready to send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AssessmentBuilder;
