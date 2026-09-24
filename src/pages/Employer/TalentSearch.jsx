import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  UserSearch, Search, Loader2, MapPin, Briefcase, GraduationCap, Check, Send, X,
  ShieldCheck, Inbox, ChevronLeft, ChevronRight, Info,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

const SCOPES = [
  { id: "all", label: "Everyone" },
  { id: "applicants", label: "My applicants" },
  { id: "open", label: "Open to opportunities" },
];

const EXAMPLES = [
  "React developers in Accra open to remote",
  "Accountants with QuickBooks and 5+ years experience",
  "Senior nurses in Kumasi with a bachelor degree",
  // "Electricians in Tema",
];

const EDUCATION_LABEL = {
  none: null,
  secondary: "Secondary / WASSCE",
  certificate: "Certificate",
  diploma: "Diploma / HND",
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  doctorate: "Doctorate",
};

const initials = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const scoreTone = (score) =>
  score >= 80
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
    : score >= 60
      ? "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30"
      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30";

const LOCATION_NOTE = {
  relocate: "willing to relocate",
  remote: "open to remote",
  unknown: "location not given",
};

const CandidateCard = ({ candidate, onInvite }) => {
  const matched = new Set(candidate.matchedSkills.map((s) => s.toLowerCase()));
  const isMatched = (skill) =>
    [...matched].some((m) => skill.toLowerCase().includes(m) || m.includes(skill.toLowerCase()));

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-indigo-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500/30">
      <div className="flex items-start gap-4">
        {candidate.avatar ? (
          <img src={candidate.avatar} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
            {initials(candidate.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{candidate.name}</h3>
            {candidate.score !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${scoreTone(candidate.score)}`}>
                {candidate.score}% match
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                candidate.relation === "applicant"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300"
              }`}
            >
              {candidate.relation === "applicant" ? "Your applicant" : "Open to opportunities"}
            </span>
          </div>
          {candidate.headline && (
            <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-300">{candidate.headline}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {(candidate.location || candidate.locationFit) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {candidate.location || "—"}
                {LOCATION_NOTE[candidate.locationFit] && (
                  <span className="text-gray-400">· {LOCATION_NOTE[candidate.locationFit]}</span>
                )}
              </span>
            )}
            {candidate.yearsOfExperience !== null && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {candidate.yearsOfExperience} yr{candidate.yearsOfExperience === 1 ? "" : "s"} experience
              </span>
            )}
            {EDUCATION_LABEL[candidate.education] && (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5" />
                {EDUCATION_LABEL[candidate.education]}
              </span>
            )}
            {candidate.openToRemote && !candidate.locationFit && <span>Open to remote</span>}
          </div>

          {candidate.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {candidate.skills.map((skill) => (
                <span
                  key={skill}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                    isMatched(skill)
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {isMatched(skill) && <Check className="h-3 w-3" />}
                  {skill}
                </span>
              ))}
            </div>
          )}
          {candidate.missingSkills.length > 0 && (
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Not on their profile: {candidate.missingSkills.join(", ")}
            </p>
          )}

          {candidate.applications.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.applications.map((application) => (
                <Link
                  key={application.id}
                  to={`/applicants?jobId=${application.jobId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300"
                >
                  Applied: <span className="font-semibold">{application.jobTitle}</span>
                  <span className="text-gray-400">· {application.stage}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => onInvite(candidate)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Send className="h-3.5 w-3.5" />
            Invite to apply
          </button>
          {candidate.invitedJobIds.length > 0 && (
            <span className="text-[11px] text-gray-400">
              Invited to {candidate.invitedJobIds.length} job{candidate.invitedJobIds.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

const InviteDialog = ({ candidate, jobs, onClose, onSent }) => {
  const excluded = new Set([
    ...candidate.invitedJobIds,
    ...candidate.applications.map((application) => application.jobId),
  ]);
  const available = jobs.filter((job) => !excluded.has(job._id || job.id));
  const [jobId, setJobId] = useState(available[0]?._id || available[0]?.id || "");
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    if (!jobId) return;
    setIsSending(true);
    try {
      const res = await axiosInstance.post(API_PATHS.TALENT.INVITE, { candidateId: candidate.id, jobId });
      toast.success(res.data.message);
      onSent(candidate.id, jobId);
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? "You've sent a lot of invitations today. Try again tomorrow."
          : err.response?.data?.message || "Could not send the invitation."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="invite-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Invite {candidate.name} to apply
            </h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              We email them a link to the job. Their address stays private — they reply by applying.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {available.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            {jobs.length === 0
              ? "You have no open jobs to invite them to."
              : "They have already applied for, or been invited to, every job you have open."}
          </p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Job</span>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {available.map((job) => (
                <option key={job._id || job.id} value={job._id || job.id}>
                  {job.title}
                  {job.location ? ` — ${job.location}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!jobId || isSending || available.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send invitation
          </button>
        </div>
      </div>
    </div>
  );
};

const TalentSearch = () => {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [inviting, setInviting] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.TALENT.SEARCH, { params: { q: query || undefined, scope, page } });
      setResult(res.data);
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? "Too many searches this hour. Try again shortly."
          : err.response?.data?.message || "Talent Search is unavailable right now."
      );
    } finally {
      setIsLoading(false);
    }
  }, [query, scope, page]);

  useEffect(() => {
    // Deferred a tick so no state is written in the effect's synchronous path.
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.JOBS.GET_JOBS_EMPLOYER)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.jobs || [];
        setJobs(list.filter((job) => !job.isClosed && job.moderationState !== "hidden"));
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (event) => {
    event?.preventDefault();
    setQuery(input.trim());
    setPage(1);
  };

  const runExample = (text) => {
    setInput(text);
    setQuery(text);
    setPage(1);
  };

  const markInvited = (candidateId, jobId) => {
    setResult((current) => ({
      ...current,
      candidates: current.candidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, invitedJobIds: [...candidate.invitedJobIds, jobId] }
          : candidate
      ),
    }));
    setInviting(null);
  };

  const verified = result?.verified;
  const candidates = result?.candidates || [];

  return (
    <DashboardLayout activeMenu="talent-search">
      <div className="mx-auto max-w-5xl space-y-5 pb-12">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            <UserSearch className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Talent Search
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Describe who you need in plain words. We search your applicants and candidates who are open to opportunities.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Registered nurses in Kumasi with 3+ years and a bachelor degree"
              aria-label="Describe the candidate you are looking for"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>

        {!query && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => runExample(example)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {SCOPES.map((option) => {
              const locked = option.id === "open" && verified === false;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked}
                  title={locked ? "Available once your company is verified" : undefined}
                  onClick={() => {
                    setScope(option.id);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    scope === option.id
                      ? "bg-white text-indigo-700 shadow-xs dark:bg-gray-900 dark:text-indigo-300"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {result && (
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
              {result.total} candidate{result.total === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {verified === false && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Once your company is verified you can also search candidates who are open to opportunities. For now you
            can search your own applicants.
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <Inbox className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="font-bold text-gray-800 dark:text-gray-100">
              {query ? "No candidates match that search" : "No candidates to show yet"}
            </p>
            <p className="mt-1 max-w-md text-sm text-gray-400 dark:text-gray-500">
              {query
                ? "Try naming fewer skills, or a wider location. Someone whose profile leaves a detail out is still shown — only people whose profile rules them out are hidden."
                : "Candidates appear here once they apply to your jobs, or choose to be found by verified employers."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} onInvite={setInviting} />
            ))}

            {result.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={result.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-40 dark:border-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-500">
                  Page {result.page} of {result.pages}
                </span>
                <button
                  type="button"
                  disabled={result.page >= result.pages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-40 dark:border-gray-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <p className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Candidates who are not your applicants chose to be found, and can stop at any time. Contact details are never
          shown — invite them, and they decide whether to apply.
        </p>
      </div>

      {inviting && (
        <InviteDialog candidate={inviting} jobs={jobs} onClose={() => setInviting(null)} onSent={markInvited} />
      )}
    </DashboardLayout>
  );
};

export default TalentSearch;
