import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { LocationPicker } from "../../components/input/LocationPicker";
import ScreeningQuestionsEditor from "../../components/employer/ScreeningQuestionsEditor";
import { toEditorQuestions, toPayloadQuestions } from "../../utils/screeningQuestions";

const DEPARTMENT_OPTIONS = [
  "Business & Professional Services",
  "Technology & Engineering",
  "Healthcare & Social Care",
  "Education & Training",
  "Sales, Marketing & Customer Service",
  "Finance, Legal & Administration",
  "Construction, Manufacturing & Trades",
  "Hospitality, Retail & Tourism",
  "Transport, Logistics & Supply Chain",
  "Government, Nonprofit & Community",
  "Creative & Media",
  "Other",
];

const JobPostingForm = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();

  // The same form posts a new vacancy and edits an existing one, so employers
  // get every field in both cases instead of a reduced edit dialog.
  const isEditing = Boolean(jobId);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(isEditing);

  // Form State
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [department, setDepartment] = useState("Business & Professional Services");
  const [workModel, setWorkModel] = useState("Hybrid");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [jobType, setJobType] = useState("Full-Time");
  const [experienceLevel, setExperienceLevel] = useState("Mid-level");
  const [deadline, setDeadline] = useState("");

  // Custom category/type entries have no direct editor in this version of the
  // form, so preserve their stored values when an employer edits a posting.
  const [passthrough, setPassthrough] = useState({});

  // Step 2
  const [tagsInput, setTagsInput] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [screeningQuestions, setScreeningQuestions] = useState([]);

  // Step 3
  const [currency, setCurrency] = useState("GH₵");
  const [salaryMin, setSalaryMin] = useState("50000");
  const [salaryMax, setSalaryMax] = useState("80000");
  const [selectedPerks, setSelectedPerks] = useState([
    "Private Health Cover",
    "Hardware Stipend",
    "Flexible Hybrid Model",
  ]);

  // Step 4
  const [selectedTier, setSelectedTier] = useState("featured");

  useEffect(() => {
    if (!isEditing) return;

    let cancelled = false;
    const loadJob = async () => {
      try {
        const res = await axiosInstance.get(API_PATHS.JOBS.GET_JOB_BY_ID(jobId));
        const job = res.data?.job || res.data;
        if (cancelled || !job) return;

        setTitle(job.title || "");
        setLocation(job.location || "");
        setLatitude(job.latitude ?? null);
        setLongitude(job.longitude ?? null);
        setDepartment(job.category || "Business & Professional Services");
        setJobType(job.type || job.jobType || "Full-Time");
        setWorkModel(job.workModel || "Hybrid");
        setCompanyName(job.companyName || job.company?.companyName || user?.companyName || "");
        setDescription(job.description || "");
        setRequirements(job.requirements || "");
        setTagsInput(Array.isArray(job.tags) ? job.tags.join(", ") : "");
        setSalaryMin(job.salaryMin != null ? String(job.salaryMin) : "");
        setSalaryMax(job.salaryMax != null ? String(job.salaryMax) : "");
        setDeadline(job.deadline ? new Date(job.deadline).toISOString().split("T")[0] : "");
        setScreeningQuestions(toEditorQuestions(job.screeningQuestions));
        setPassthrough({
          customCategory: job.customCategory ?? undefined,
          customJobType: job.customJobType ?? undefined,
        });
      } catch (err) {
        console.error("Failed to load job for editing:", err);
        toast.error("Could not load this job posting.");
        navigate("/manage-jobs");
      } finally {
        if (!cancelled) setIsLoadingJob(false);
      }
    };

    loadJob();
    return () => {
      cancelled = true;
    };
  }, [isEditing, jobId, navigate, user?.companyName]);

  const tagsList = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

  // A multiple-choice question with fewer than two answers cannot be answered,
  // so it is caught here rather than after the whole form has been filled in.
  const screeningProblem = () => {
    const incomplete = toPayloadQuestions(screeningQuestions).find(
      (question) => question.type === "choice" && question.options.length < 2
    );
    return incomplete ? `"${incomplete.prompt}" needs at least two answers to choose from.` : null;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (step === 2) {
      const problem = screeningProblem();
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in or create an employer account to post a job.");
      navigate("/login", { state: { from: { pathname: isEditing ? `/edit-job/${jobId}` : "/post-job" } } });
      return;
    }

    if (user.role !== "employer" && user.role !== "admin") {
      toast.error("You need an employer account to publish job listings. Please register or sign in as an employer.");
      return;
    }

    const problem = screeningProblem();
    if (problem) {
      toast.error(problem);
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        location,
        latitude,
        longitude,
        category: department || "Other",
        type: jobType,
        jobType,
        description,
        requirements,
        salaryMin: Number(salaryMin) || 0,
        salaryMax: Number(salaryMax) || 0,
        tags: tagsList,
        workModel,
        deadline: deadline || null,
        screeningQuestions: toPayloadQuestions(screeningQuestions),
      };

      if (isEditing) {
        // companyName is not a column on the job, and the update endpoint
        // spreads the body straight into the write.
        await axiosInstance.put(API_PATHS.JOBS.UPDATE_JOB(jobId), {
          ...passthrough,
          ...payload,
        });
        toast.success("Job posting updated.");
        navigate("/manage-jobs");
        return;
      }

      const res = await axiosInstance.post(API_PATHS.JOBS.POST_JOB, {
        ...payload,
        companyName,
      });
      toast.success("Job successfully published to SPG Talent Network!");
      const newJobId = res.data?.job?.id || res.data?.job?._id;
      if (newJobId) {
        navigate(`/job/${newJobId}`);
      } else {
        navigate("/find-jobs");
      }
    } catch (err) {
      console.error(isEditing ? "Failed to update job:" : "Failed to post job:", err);
      toast.error(
        err.response?.data?.message ||
          (isEditing ? "Failed to update job. Please try again." : "Failed to post job. Please try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingJob) {
    return (
      <DashboardLayout activeMenu="manage-jobs">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-surface text-on-surface">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-body-md text-text-muted">Loading this job posting…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeMenu={isEditing ? "manage-jobs" : "post-job"}>
      <div className="min-h-full bg-surface text-on-surface">
        <main className="w-full pb-space-xl">
        {/* ================= HERO HEADER & TRUST ENGINE ================= */}
        <section className="w-full bg-gradient-to-b from-brand-indigo-light/50 via-surface to-surface pb-space-lg border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin pt-space-lg">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
              <div className="max-w-3xl flex flex-col gap-space-xs">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit font-label-md font-semibold">
                  <span className="material-symbols-outlined text-[18px]">
                    {isEditing ? "edit_note" : "verified"}
                  </span>
                  {isEditing
                    ? "Editing a live posting"
                    : "A trusted hiring platform for every industry"}
                </div>

                {isEditing ? (
                  <h1 className="font-headline-xl text-headline-xl text-text-primary tracking-tight font-extrabold leading-tight">
                    Edit{" "}
                    <span className="bg-primary bg-clip-text text-transparent">
                      {title || "this role"}
                    </span>
                  </h1>
                ) : (
                  <h1 className="font-headline-xl text-headline-xl text-text-primary tracking-tight font-extrabold leading-tight">
                    Post a Job &amp; Reach{" "}
                    <span className="bg-primary bg-clip-text text-transparent">
                      45,000+ Verified
                    </span>{" "}
                    Qualified Candidates
                  </h1>
                )}

                <p className="font-body-lg text-body-lg text-text-secondary">
                  {isEditing
                    ? "Every field from the original posting is here. Changes go live as soon as you save."
                    : "Connect with people across business, healthcare, education, construction, hospitality, technology, public service, and more."}
                </p>
              </div>

              {/* Trust Metric Badges */}
              <div className="grid grid-cols-3 gap-3 bg-surface-card p-3 rounded-2xl border border-border-default shadow-xs shrink-0">
                <div className="flex flex-col p-2.5 rounded-xl bg-surface-container-low">
                  <span className="font-headline-sm text-primary font-bold">14 Leads</span>
                  <span className="font-body-sm text-text-muted">Avg. in 48h</span>
                </div>
                <div className="flex flex-col p-2.5 rounded-xl bg-surface-container-low">
                  <span className="font-headline-sm text-salary-emerald font-bold">100%</span>
                  <span className="font-body-sm text-text-muted">Double-Blind</span>
                </div>
                <div className="flex flex-col p-2.5 rounded-xl bg-surface-container-low">
                  <span className="font-headline-sm text-secondary font-bold">SPG AI</span>
                  <span className="font-body-sm text-text-muted">ATS Match</span>
                </div>
              </div>
            </div>

            {/* Multi-Step Stepper Bar */}
            <div className="mt-space-xl bg-surface-card rounded-2xl p-space-sm md:p-space-md border border-border-default shadow-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {[
                  { num: 1, label: "Job Details & Role" },
                  { num: 2, label: "Requirements & Skills" },
                  { num: 3, label: "Compensation & Perks" },
                  { num: 4, label: isEditing ? "Review & Save" : "Review & Publish" },
                ].map((s) => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => setStep(s.num)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      step === s.num
                        ? "bg-brand-indigo-light text-primary font-bold shadow-xs"
                        : step > s.num
                        ? "bg-surface-container text-text-primary"
                        : "bg-surface-container-low text-text-muted hover:bg-surface-container"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        step === s.num
                          ? "bg-primary text-on-primary"
                          : step > s.num
                          ? "bg-salary-emerald text-white"
                          : "bg-surface-container text-text-secondary"
                      }`}
                    >
                      {step > s.num ? (
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      ) : (
                        s.num
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-caps uppercase text-text-muted">
                        Step {s.num}
                      </span>
                      <span className="font-label-md truncate">{s.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= PRIMARY WORKSPACE: FORM & LIVE PREVIEW ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin mt-space-lg w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* LEFT COLUMN: Main Stepper Form (col-span-8) */}
            <div className="lg:col-span-8 bg-surface-card rounded-2xl p-space-md md:p-space-lg border border-border-default shadow-sm flex flex-col gap-space-md">
              <form onSubmit={step === 4 ? handleSubmit : handleNext}>
                {/* STEP 1: Job Details & Role */}
                {step === 1 && (
                  <div className="flex flex-col gap-space-md animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-border-default">
                      <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                          corporate_fare
                        </span>
                        1. Organization &amp; Workplace Entity
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-text-muted">
                        Required
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Hiring Organization
                        </label>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Acme Services Ltd"
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Functional Department
                        </label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none cursor-pointer"
                        >
                          {/* Show a stored value that predates this list rather
                              than silently displaying the wrong department. */}
                          {department && !DEPARTMENT_OPTIONS.includes(department) && (
                            <option value={department}>{department} (current)</option>
                          )}
                          {DEPARTMENT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Workplace Model Radios */}
                    <div className="flex flex-col gap-1.5 pt-2">
                      <label className="font-label-lg font-semibold text-text-primary">
                        Workplace Model
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {["Hybrid", "On-site", "Remote"].map((m) => (
                          <label
                            key={m}
                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                              workModel === m
                                ? "bg-brand-indigo-light border-primary text-primary font-bold"
                                : "bg-surface-container-low border-border-default text-text-secondary hover:bg-surface-container"
                            }`}
                          >
                            <input
                              type="radio"
                              name="workModel"
                              value={m}
                              checked={workModel === m}
                              onChange={() => setWorkModel(m)}
                              className="hidden"
                            />
                            <span>{m}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-2">
                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Job Role Title
                        </label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Registered Nurse, Sales Manager, or Electrician"
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                        />
                      </div>

                      <div>
                        <LocationPicker
                          label="Job location"
                          required
                          value={location}
                          latitude={latitude}
                          longitude={longitude}
                          placeholder="Search an address or pin the exact workplace"
                          onChange={({ location: nextLocation, latitude: nextLatitude, longitude: nextLongitude }) => {
                            setLocation(nextLocation);
                            setLatitude(nextLatitude);
                            setLongitude(nextLongitude);
                          }}
                        />
                        <p className="mt-1.5 font-body-sm text-text-muted">
                          Pin the workplace on the map so candidates can view the exact location.
                        </p>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Application Deadline
                        </label>
                        <input
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                        />
                        <span className="font-body-sm text-text-muted">
                          Optional. Leave empty to keep the role open indefinitely.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Requirements & Skills */}
                {step === 2 && (
                  <div className="flex flex-col gap-space-md animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-border-default">
                      <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">checklist</span>
                        2. Requirements &amp; Key Skills
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-text-muted">
                        Step 2 of 4
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-label-lg font-semibold text-text-primary">
                        Key Skills, Licences, or Certifications (comma separated)
                      </label>
                      <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Customer service, Excel, First Aid, Driving licence"
                        className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tagsList.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-0.5 rounded-lg bg-surface-container font-label-md text-on-surface text-xs"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-label-lg font-semibold text-text-primary">
                        Core Responsibilities Overview
                      </label>
                      <textarea
                        rows="4"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="p-3 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-label-lg font-semibold text-text-primary">
                        Key Qualifications &amp; Experience
                      </label>
                      <textarea
                        rows="3"
                        value={requirements}
                        onChange={(e) => setRequirements(e.target.value)}
                        className="p-3 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 border-t border-border-default">
                      <ScreeningQuestionsEditor
                        questions={screeningQuestions}
                        onChange={setScreeningQuestions}
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: Compensation & Perks */}
                {step === 3 && (
                  <div className="flex flex-col gap-space-md animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-border-default">
                      <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-salary-emerald">
                          payments
                        </span>
                        3. Compensation Range &amp; Perks
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-text-muted">
                        Step 3 of 4
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Currency
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none cursor-pointer"
                        >
                          <option value="GH₵">Ghana Cedi (GH₵)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Min Monthly Comp
                        </label>
                        <input
                          type="number"
                          value={salaryMin}
                          onChange={(e) => setSalaryMin(e.target.value)}
                          placeholder="50000"
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="font-label-lg font-semibold text-text-primary">
                          Max Monthly Comp
                        </label>
                        <input
                          type="number"
                          value={salaryMax}
                          onChange={(e) => setSalaryMax(e.target.value)}
                          placeholder="80000"
                          className="h-12 px-4 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <label className="font-label-lg font-semibold text-text-primary">
                        Employee Benefits Included
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Private Health Cover",
                          "Hardware Stipend",
                          "Flexible Hybrid Model",
                          "Pension 3 Contribution",
                          "Annual Learning Budget",
                          "Stock Option Grants",
                        ].map((p) => {
                          const isChecked = selectedPerks.includes(p);
                          return (
                            <label
                              key={p}
                              className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-salary-surface border-salary-emerald text-salary-emerald font-semibold"
                                  : "bg-surface-container-low border-border-default text-text-secondary"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedPerks((prev) =>
                                    isChecked ? prev.filter((item) => item !== p) : [...prev, p]
                                  );
                                }}
                                className="w-4 h-4 rounded accent-primary"
                              />
                              <span className="font-body-sm">{p}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Review & Publish */}
                {step === 4 && (
                  <div className="flex flex-col gap-space-md animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-border-default">
                      <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">
                          verified
                        </span>
                        4. Select Distribution Tier &amp; Publish
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-text-muted">
                        Final Step
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
                      {[
                        {
                          id: "standard",
                          title: "Standard Post",
                          price: "Free",
                          desc: "30-day listing on SPG public search board with standard indexing.",
                        },
                        {
                          id: "featured",
                          title: "Featured Match",
                          price: "GH₵ 1,200",
                          desc: "Top placement, highlighted badge & direct SPG AI applicant matching.",
                        },
                        {
                          id: "spotlight",
                          title: "Executive Spotlight",
                          price: "GH₵ 3,500",
                          desc: "Dedicated newsletter placement and increased visibility for qualified candidates.",
                        },
                      ].map((tier) => (
                        <div
                          key={tier.id}
                          onClick={() => setSelectedTier(tier.id)}
                          className={`p-space-md rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                            selectedTier === tier.id
                              ? "bg-brand-indigo-light border-primary shadow-sm"
                              : "bg-surface-container-low border-border-default hover:bg-surface-container"
                          }`}
                        >
                          <div>
                            <h4 className="font-label-lg font-bold text-on-surface">
                              {tier.title}
                            </h4>
                            <span className="font-headline-sm text-primary font-extrabold block my-1">
                              {tier.price}
                            </span>
                            <p className="font-body-sm text-text-secondary leading-relaxed">
                              {tier.desc}
                            </p>
                          </div>
                          <div className="pt-2 mt-2 border-t border-border-default flex items-center justify-between">
                            <span className="font-label-caps uppercase text-text-muted">
                              {selectedTier === tier.id ? "Selected" : "Select Tier"}
                            </span>
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                selectedTier === tier.id
                                  ? "border-primary bg-primary"
                                  : "border-border-default"
                              }`}
                            >
                              {selectedTier === tier.id && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form Stepper Action Buttons */}
                <div className="pt-space-md border-t border-border-default mt-space-md flex items-center justify-between">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-space-md py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        chevron_left
                      </span>
                      <span>Back</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 4 ? (
                    <button
                      type="submit"
                      className="px-space-lg py-2.5 rounded-xl bg-primary-container hover:bg-brand-indigo-dark text-on-primary font-label-md font-bold shadow-sm transition-all flex items-center gap-1"
                    >
                      <span>Continue to Step {step + 1}</span>
                      <span className="material-symbols-outlined text-[18px]">
                        chevron_right
                      </span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-space-xl py-3 rounded-xl bg-primary hover:bg-brand-indigo-dark text-on-primary font-label-lg font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <span>
                        {isSubmitting
                          ? isEditing
                            ? "Saving Changes..."
                            : "Publishing Role..."
                          : isEditing
                            ? "Save Changes"
                            : "Publish Vacancy Now"}
                      </span>
                      <span className="material-symbols-outlined text-[18px]">
                        {isEditing ? "save" : "rocket_launch"}
                      </span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* RIGHT COLUMN: Real-Time Live Preview Card (col-span-4) */}
            <div className="lg:col-span-4 sticky top-24 flex flex-col gap-space-sm">
              <div className="flex items-center justify-between px-1">
                <span className="font-label-caps uppercase text-text-muted tracking-wider">
                  Live Card Preview
                </span>
                <span className="inline-flex items-center gap-1 font-label-caps text-salary-emerald font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-salary-emerald animate-pulse" />
                  Synchronized
                </span>
              </div>

              {/* Dynamic Job Card Preview */}
              <div className="bg-surface-card rounded-2xl p-space-md border border-border-default shadow-md flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-indigo-light text-primary font-bold flex items-center justify-center shrink-0 border border-border-default">
                    {companyName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-label-md font-bold text-text-primary truncate">
                        {companyName}
                      </span>
                      <span className="material-symbols-outlined text-verified-badge text-[16px]">
                        verified
                      </span>
                    </div>
                    <h4 className="font-headline-sm font-bold text-text-primary truncate mt-0.5">
                      {title}
                    </h4>
                    <p className="font-body-sm text-text-muted truncate">
                      {location} • {jobType}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 my-1">
                  {tagsList.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-surface-container font-label-md text-text-secondary text-[11px]"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-border-default flex items-center justify-between">
                  <div>
                    <span className="font-label-caps uppercase text-text-muted block text-[10px]">
                      Salary Range
                    </span>
                    <span className="font-label-lg font-bold text-salary-emerald">
                      {currency} {Number(salaryMin || 0) / 1000}k - {Number(salaryMax || 0) / 1000}k / mo
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-primary-container text-on-primary font-label-md font-bold text-xs">
                    Apply
                  </span>
                </div>
              </div>

              {/* Tips Callout */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-border-default text-body-sm text-text-secondary">
                <p className="flex items-center gap-1 font-semibold text-text-primary mb-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    lightbulb
                  </span>
                  Recruiter Tip
                </p>
                <span>
                  Adding realistic compensation ranges helps attract more qualified applicants.
                </span>
              </div>
            </div>
          </div>
        </section>
        </main>
      </div>
    </DashboardLayout>
  );
};

export default JobPostingForm;
