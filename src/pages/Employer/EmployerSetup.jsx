import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  Building2,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Upload,
  User2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import uploadImage from "../../utils/uploadingImage";
import { useAuth } from "../../context/AuthContext";

const STEPS = [
  {
    label: "Organisation",
    helper: "Legal and public details",
    icon: Building2,
  },
  {
    label: "Company profile",
    helper: "What candidates will see",
    icon: FileText,
  },
  {
    label: "Hiring contact",
    helper: "Who candidates can trust",
    icon: User2,
  },
  {
    label: "Review & agree",
    helper: "Confirm your details",
    icon: Shield,
  },
];

const INDUSTRIES = [
  "Accounting & Finance",
  "Agriculture",
  "Construction & Real Estate",
  "Education & Training",
  "Energy & Utilities",
  "FMCG & Retail",
  "Government & Public Sector",
  "Healthcare & Pharmaceuticals",
  "Hospitality & Tourism",
  "Legal Services",
  "Logistics & Transport",
  "Manufacturing",
  "Media & Creative",
  "Nonprofit & Development",
  "Professional Services",
  "Telecommunications",
  "Technology",
  "Other",
];

const ORGANIZATION_TYPES = [
  "Sole proprietorship",
  "Partnership",
  "Private limited company",
  "Public limited company",
  "Nonprofit / NGO",
  "Government / public institution",
  "International organisation",
  "Other",
];

const EMPLOYEE_BANDS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1,000",
  "1,001-5,000",
  "5,001+",
];

const GHANA_LOCATIONS = [
  "Accra, Greater Accra, Ghana",
  "Kumasi, Ashanti, Ghana",
  "Tamale, Northern Region, Ghana",
  "Takoradi, Western Region, Ghana",
  "Cape Coast, Central Region, Ghana",
  "Koforidua, Eastern Region, Ghana",
  "Ho, Volta Region, Ghana",
  "Sunyani, Bono Region, Ghana",
  "Bolgatanga, Upper East Region, Ghana",
  "Wa, Upper West Region, Ghana",
  "Remote in Ghana",
  "Multiple locations, Ghana",
];

const EMPTY_FORM = {
  name: "",
  legalName: "",
  organizationType: "",
  registrationNumber: "",
  industry: "",
  employees: "",
  hq: "",
  website: "",
  logo: "",
  description: "",
  contactName: "",
  contactTitle: "",
  contactEmail: "",
  contactPhone: "",
  stack: [],
  perks: [],
  authorityConfirmed: false,
  termsAccepted: false,
  fairHiringAcknowledged: false,
};

const STEP_FIELDS = [
  ["name", "legalName", "organizationType", "registrationNumber", "industry", "employees", "hq"],
  ["logo", "description", "website"],
  ["contactName", "contactTitle", "contactEmail", "contactPhone", "stack", "perks"],
  ["authorityConfirmed", "termsAccepted", "fairHiringAcknowledged"],
];

const FieldError = ({ message }) => message ? (
  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-600">
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    {message}
  </p>
) : null;

const FieldLabel = ({ children, required = false }) => (
  <label className="mb-1.5 block text-sm font-bold text-slate-800 dark:text-gray-200">
    {children}
    {required && <span className="ml-1 text-rose-500">*</span>}
  </label>
);

const TagEditor = ({
  label,
  hint,
  placeholder,
  tags,
  value,
  error,
  onChange,
  onAdd,
  onRemove,
}) => (
  <div>
    <FieldLabel required>{label}</FieldLabel>
    <p className="mb-2 text-xs leading-5 text-slate-500 dark:text-gray-400">{hint}</p>
    <div className={`rounded-xl border bg-white p-2 transition-colors dark:bg-gray-900 ${error ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 dark:border-gray-700"}`}>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              {tag}
              <button type="button" onClick={() => onRemove(tag)} aria-label={`Remove ${tag}`} className="rounded text-violet-500 hover:text-violet-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <button type="button" onClick={onAdd} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          Add
        </button>
      </div>
    </div>
    <FieldError message={error} />
  </div>
);

const EmployerSetup = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const logoInputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [tagInputs, setTagInputs] = useState({ stack: "", perks: "" });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const inputClass = (field) => `w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 ${
    errors[field]
      ? "border-rose-300 ring-2 ring-rose-100"
      : "border-slate-200 hover:border-slate-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-700 dark:hover:border-gray-600"
  }`;

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const response = await axiosInstance.get(API_PATHS.COMPANIES.GET_MY_PROFILE);
        if (!mounted) return;

        const profile = response.data || {};
        setForm({
          ...EMPTY_FORM,
          name: profile.name || user?.companyName || "",
          legalName: profile.legalName || "",
          organizationType: profile.organizationType || "",
          registrationNumber: profile.registrationNumber || "",
          industry: profile.industry || "",
          employees: profile.employees || "",
          hq: profile.hq || "",
          website: profile.website || "",
          logo: profile.logo || user?.companyLogo || "",
          description: profile.description || user?.companyDescription || "",
          contactName: profile.contactName || user?.name || "",
          contactTitle: profile.contactTitle || "",
          contactEmail: profile.contactEmail || user?.email || "",
          contactPhone: profile.contactPhone || "",
          stack: Array.isArray(profile.stack) ? profile.stack : [],
          perks: Array.isArray(profile.perks) ? profile.perks : [],
        });
      } catch (error) {
        console.error("Could not load the company setup draft:", error);
        if (mounted) {
          setForm((current) => ({
            ...current,
            name: user?.companyName || current.name,
            logo: user?.companyLogo || current.logo,
            description: user?.companyDescription || current.description,
            contactName: user?.name || current.contactName,
            contactEmail: user?.email || current.contactEmail,
          }));
        }
      } finally {
        if (mounted) setIsLoadingProfile(false);
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [
    user?._id,
    user?.companyDescription,
    user?.companyLogo,
    user?.companyName,
    user?.email,
    user?.name,
  ]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: "" }));
    }
  };

  const getStepErrors = (targetStep) => {
    const nextErrors = {};
    const clean = (value) => typeof value === "string" ? value.trim() : "";

    if (targetStep === 0) {
      if (clean(form.name).length < 2) nextErrors.name = "Enter the company name candidates will see.";
      if (clean(form.legalName).length < 2) nextErrors.legalName = "Enter the company’s registered legal name.";
      if (!form.organizationType) nextErrors.organizationType = "Select the organisation type.";
      if (clean(form.registrationNumber).length < 4) nextErrors.registrationNumber = "Enter the registration number or TIN.";
      if (!form.industry) nextErrors.industry = "Select an industry.";
      if (!form.employees) nextErrors.employees = "Select a company size.";
      if (!form.hq || !form.hq.toLowerCase().includes("ghana")) nextErrors.hq = "Select a Ghana-based location.";
    }

    if (targetStep === 1) {
      if (!clean(form.logo)) nextErrors.logo = "Upload your logo or provide a logo URL.";
      if (clean(form.description).length < 80) nextErrors.description = "Use at least 80 characters so candidates understand your company.";
      if (clean(form.website)) {
        try {
          const url = new URL(clean(form.website));
          if (!["http:", "https:"].includes(url.protocol)) nextErrors.website = "Use a valid website URL.";
        } catch {
          nextErrors.website = "Use a valid website URL beginning with https:// or http://.";
        }
      }
    }

    if (targetStep === 2) {
      if (clean(form.contactName).length < 2) nextErrors.contactName = "Enter the authorised hiring contact’s name.";
      if (clean(form.contactTitle).length < 2) nextErrors.contactTitle = "Enter the contact’s job title.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(form.contactEmail))) nextErrors.contactEmail = "Enter a valid work email address.";
      const phone = clean(form.contactPhone).replace(/[\s()-]/g, "");
      if (!/^(?:\+233\d{9}|0\d{9})$/.test(phone)) nextErrors.contactPhone = "Use a valid Ghana number, for example +233 20 123 4567.";
      if (form.stack.length === 0) nextErrors.stack = "Add at least one hiring speciality or area of work.";
      if (form.perks.length === 0) nextErrors.perks = "Add at least one candidate benefit or workplace highlight.";
    }

    if (targetStep === 3) {
      if (!form.authorityConfirmed) nextErrors.authorityConfirmed = "Confirm that you are authorised to represent this company.";
      if (!form.termsAccepted) nextErrors.termsAccepted = "Accept the employer terms to continue.";
      if (!form.fairHiringAcknowledged) nextErrors.fairHiringAcknowledged = "Acknowledge the fair-hiring and no-fee policy to continue.";
    }

    return nextErrors;
  };

  const moveToStep = (targetStep) => {
    setStep(targetStep);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    const nextErrors = getStepErrors(step);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please complete the required fields before continuing.");
      return;
    }
    moveToStep(Math.min(step + 1, STEPS.length - 1));
  };

  const addTag = (field) => {
    const tag = tagInputs[field].trim().replace(/,+$/, "");
    if (!tag) return;
    if (form[field].some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setTagInputs((current) => ({ ...current, [field]: "" }));
      return;
    }
    if (form[field].length >= 12) {
      toast.error("You can add up to 12 items.");
      return;
    }
    updateField(field, [...form[field], tag]);
    setTagInputs((current) => ({ ...current, [field]: "" }));
  };

  const removeTag = (field, tag) => {
    updateField(field, form[field].filter((item) => item !== tag));
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Choose a PNG, JPG, WebP, or other image file for the logo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("The company logo must be 5 MB or smaller.");
      return;
    }

    setIsUploadingLogo(true);
    const toastId = toast.loading("Uploading company logo…");
    try {
      const result = await uploadImage(file);
      const imageUrl = result?.imageUrl || result?.url;
      if (!imageUrl) throw new Error("No logo URL was returned");
      updateField("logo", imageUrl);
      toast.success("Company logo uploaded.", { id: toastId });
    } catch (error) {
      console.error("Company logo upload failed:", error);
      toast.error("The logo could not be uploaded. Please try again.", { id: toastId });
    } finally {
      setIsUploadingLogo(false);
      event.target.value = "";
    }
  };

  const firstStepWithError = (nextErrors) => {
    const index = STEP_FIELDS.findIndex((fields) => fields.some((field) => nextErrors[field]));
    return index === -1 ? 0 : index;
  };

  const saveCompany = async (completeSetup) => {
    if (completeSetup) {
      const allErrors = STEPS.reduce(
        (combined, _, index) => ({ ...combined, ...getStepErrors(index) }),
        {}
      );
      if (Object.keys(allErrors).length > 0) {
        setErrors(allErrors);
        moveToStep(firstStepWithError(allErrors));
        toast.error("A few required details still need your attention.");
        return;
      }
    }

    setIsSaving(true);
    const toastId = toast.loading(completeSetup ? "Completing company setup…" : "Saving your setup draft…");
    try {
      const response = await axiosInstance.put(API_PATHS.COMPANIES.UPDATE_MY_PROFILE, {
        ...form,
        completeSetup,
      });

      if (completeSetup && response.data?.user) updateUser(response.data.user);

      if (completeSetup) {
        toast.success("Company setup complete. Your hiring workspace is ready.", { id: toastId });
        navigate("/employer-dashboard", { replace: true });
      } else {
        toast.success("Draft saved. Complete all four steps to unlock hiring tools.", { id: toastId });
      }
    } catch (error) {
      const serverErrors = error.response?.data?.errors;
      if (serverErrors && typeof serverErrors === "object") {
        setErrors(serverErrors);
        moveToStep(firstStepWithError(serverErrors));
      }
      console.error("Could not save company setup:", error);
      toast.error(error.response?.data?.message || "Company setup could not be saved.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const renderOrganisationStep = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Step 1 of 4</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-gray-100">Tell us about your organisation</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-gray-400">These details establish a trustworthy company profile for Ghanaian jobseekers. Your registration number is kept private.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <FieldLabel required>Company or trading name</FieldLabel>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" />
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="e.g. Horizon Foods Ghana" className={`${inputClass("name")} pl-10`} />
          </div>
          <FieldError message={errors.name} />
        </div>
        <div>
          <FieldLabel required>Registered legal name</FieldLabel>
          <input value={form.legalName} onChange={(event) => updateField("legalName", event.target.value)} placeholder="As registered with the ORC" className={inputClass("legalName")} />
          <FieldError message={errors.legalName} />
        </div>
        <div>
          <FieldLabel required>Organisation type</FieldLabel>
          <select value={form.organizationType} onChange={(event) => updateField("organizationType", event.target.value)} className={inputClass("organizationType")}>
            <option value="">Select organisation type</option>
            {ORGANIZATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <FieldError message={errors.organizationType} />
        </div>
        <div>
          <FieldLabel required>Business registration number or TIN</FieldLabel>
          <input value={form.registrationNumber} onChange={(event) => updateField("registrationNumber", event.target.value)} placeholder="e.g. CS123456789" className={inputClass("registrationNumber")} />
          <FieldError message={errors.registrationNumber} />
        </div>
        <div>
          <FieldLabel required>Industry</FieldLabel>
          <select value={form.industry} onChange={(event) => updateField("industry", event.target.value)} className={inputClass("industry")}>
            <option value="">Select industry</option>
            {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
          </select>
          <FieldError message={errors.industry} />
        </div>
        <div>
          <FieldLabel required>Company size</FieldLabel>
          <select value={form.employees} onChange={(event) => updateField("employees", event.target.value)} className={inputClass("employees")}>
            <option value="">Select employee range</option>
            {EMPLOYEE_BANDS.map((band) => <option key={band} value={band}>{band} employees</option>)}
          </select>
          <FieldError message={errors.employees} />
        </div>
        <div className="md:col-span-2">
          <FieldLabel required>Primary hiring location</FieldLabel>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" />
            <select value={form.hq} onChange={(event) => updateField("hq", event.target.value)} className={`${inputClass("hq")} pl-10`}>
              <option value="">Select your Ghana office or hiring location</option>
              {GHANA_LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </div>
          <FieldError message={errors.hq} />
        </div>
      </div>
    </div>
  );

  const renderProfileStep = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Step 2 of 4</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-gray-100">Build a candidate-ready company profile</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-gray-400">Candidates use this information to recognise your organisation and decide whether the opportunity is right for them.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-violet-200 bg-white shadow-sm dark:border-violet-400/30 dark:bg-gray-900">
            {form.logo ? <img src={form.logo} alt="Company logo preview" className="h-full w-full object-cover" /> : <Building2 className="h-8 w-8 text-violet-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <FieldLabel required>Company logo</FieldLabel>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-gray-400">Use a square or horizontal PNG, JPG, or WebP under 5 MB. This logo appears with your job posts.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm shadow-violet-200 transition-colors hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70">
                {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploadingLogo ? "Uploading…" : "Upload logo"}
              </button>
              {form.logo && <button type="button" onClick={() => updateField("logo", "")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"><X className="h-4 w-4" />Remove</button>}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
        <div className="mt-5">
          <FieldLabel>Or paste an existing logo URL</FieldLabel>
          <input value={form.logo} onChange={(event) => updateField("logo", event.target.value)} placeholder="https://example.com/logo.png" className={inputClass("logo")} />
          <FieldError message={errors.logo} />
        </div>
      </div>

      <div>
        <FieldLabel required>About your company</FieldLabel>
        <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={7} maxLength={2000} placeholder="Describe your mission, what you do, who you serve, and the work environment candidates can expect." className={`${inputClass("description")} resize-y`} />
        <div className="mt-1.5 flex items-start justify-between gap-4">
          <FieldError message={errors.description} />
          <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">{form.description.length}/2,000</span>
        </div>
      </div>

      <div>
        <FieldLabel>Company website or careers page</FieldLabel>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" />
          <input value={form.website} onChange={(event) => updateField("website", event.target.value)} placeholder="https://yourcompany.com" className={`${inputClass("website")} pl-10`} />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-gray-400">Optional, but it helps candidates verify and learn more about your organisation.</p>
        <FieldError message={errors.website} />
      </div>
    </div>
  );

  const renderContactStep = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Step 3 of 4</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-gray-100">Add your authorised hiring contact</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-gray-400">This contact is used for platform communication and supports a transparent, professional hiring experience.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <FieldLabel required>Contact name</FieldLabel>
          <div className="relative"><User2 className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" /><input value={form.contactName} onChange={(event) => updateField("contactName", event.target.value)} placeholder="Full name" className={`${inputClass("contactName")} pl-10`} /></div>
          <FieldError message={errors.contactName} />
        </div>
        <div>
          <FieldLabel required>Job title</FieldLabel>
          <div className="relative"><Briefcase className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" /><input value={form.contactTitle} onChange={(event) => updateField("contactTitle", event.target.value)} placeholder="e.g. HR Manager" className={`${inputClass("contactTitle")} pl-10`} /></div>
          <FieldError message={errors.contactTitle} />
        </div>
        <div>
          <FieldLabel required>Work email address</FieldLabel>
          <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" /><input type="email" value={form.contactEmail} onChange={(event) => updateField("contactEmail", event.target.value)} placeholder="hiring@company.com" className={`${inputClass("contactEmail")} pl-10`} /></div>
          <FieldError message={errors.contactEmail} />
        </div>
        <div>
          <FieldLabel required>Ghana phone number</FieldLabel>
          <div className="relative"><Phone className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-gray-500" /><input type="tel" value={form.contactPhone} onChange={(event) => updateField("contactPhone", event.target.value)} placeholder="+233 20 123 4567" className={`${inputClass("contactPhone")} pl-10`} /></div>
          <FieldError message={errors.contactPhone} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TagEditor
          label="Hiring specialities or areas of work"
          hint="For example: customer service, nursing, construction, sales, software engineering."
          placeholder="Type an area and press Enter"
          tags={form.stack}
          value={tagInputs.stack}
          error={errors.stack}
          onChange={(value) => setTagInputs((current) => ({ ...current, stack: value }))}
          onAdd={() => addTag("stack")}
          onRemove={(tag) => removeTag("stack", tag)}
        />
        <TagEditor
          label="Candidate benefits or workplace highlights"
          hint="For example: health insurance, transport allowance, training, paid leave."
          placeholder="Type a benefit and press Enter"
          tags={form.perks}
          value={tagInputs.perks}
          error={errors.perks}
          onChange={(value) => setTagInputs((current) => ({ ...current, perks: value }))}
          onAdd={() => addTag("perks")}
          onRemove={(tag) => removeTag("perks", tag)}
        />
      </div>
    </div>
  );

  const renderReviewStep = () => {
    const summary = [
      ["Company", form.name || "Not provided"],
      ["Industry", form.industry || "Not provided"],
      ["Location", form.hq || "Not provided"],
      ["Hiring contact", form.contactName ? `${form.contactName}${form.contactTitle ? ` · ${form.contactTitle}` : ""}` : "Not provided"],
      ["Contact email", form.contactEmail || "Not provided"],
    ];

    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Step 4 of 4</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-gray-100">Review and confirm your company setup</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-gray-400">After you finish, your employer dashboard, job posting tools, and applicant workspace will be unlocked.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><CheckCircle className="h-5 w-5" /></div>
            <div><p className="font-bold text-slate-900 dark:text-gray-100">Setup summary</p><p className="text-xs text-slate-500 dark:text-gray-400">Review your key company and contact details.</p></div>
          </div>
          <dl className="divide-y divide-slate-100 px-5 dark:divide-gray-800">
            {summary.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-gray-500">{label}</dt>
                <dd className="text-sm font-semibold text-slate-800 sm:text-right dark:text-gray-200">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-5 dark:border-violet-400/20 dark:bg-violet-500/10">
          <p className="text-sm font-extrabold text-slate-900 dark:text-gray-100">Required confirmations</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/70 p-3 transition-colors hover:bg-white dark:bg-gray-900/60 dark:hover:bg-gray-900">
            <input type="checkbox" checked={form.authorityConfirmed} onChange={(event) => updateField("authorityConfirmed", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800" />
            <span className="text-sm leading-5 text-slate-700 dark:text-gray-300">I am authorised to create and manage this company’s employer account and job posts.</span>
          </label>
          <FieldError message={errors.authorityConfirmed} />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/70 p-3 transition-colors hover:bg-white dark:bg-gray-900/60 dark:hover:bg-gray-900">
            <input type="checkbox" checked={form.termsAccepted} onChange={(event) => updateField("termsAccepted", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800" />
            <span className="text-sm leading-5 text-slate-700 dark:text-gray-300">I accept the employer terms and confirm that the information supplied is accurate.</span>
          </label>
          <FieldError message={errors.termsAccepted} />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/70 p-3 transition-colors hover:bg-white dark:bg-gray-900/60 dark:hover:bg-gray-900">
            <input type="checkbox" checked={form.fairHiringAcknowledged} onChange={(event) => updateField("fairHiringAcknowledged", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800" />
            <span className="text-sm leading-5 text-slate-700 dark:text-gray-300">I will follow fair hiring practices and will not charge candidates any fee to apply, interview, or receive a job offer.</span>
          </label>
          <FieldError message={errors.fairHiringAcknowledged} />
        </div>
      </div>
    );
  };

  const stepContent = [renderOrganisationStep, renderProfileStep, renderContactStep, renderReviewStep];

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3a1b8a] via-[#6833c4] to-[#b26ee9] text-white shadow-[0_5px_14px_rgba(90,45,180,0.35)]"><Briefcase className="h-5 w-5" /></div>
            <div><p className="text-base font-extrabold tracking-tight text-slate-950 dark:text-gray-100">SPG Talent Network</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-gray-400">Employer setup</p></div>
          </Link>
          <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#24104f] via-[#3f197f] to-[#7040bb] px-6 py-7 text-white shadow-[0_20px_50px_rgba(62,25,122,0.20)] sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-violet-300/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-violet-100"><Shield className="h-3.5 w-3.5" />Company setup required</div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Welcome, {user?.name?.split(" ")[0] || "there"}. Set up your company before you start hiring.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100 sm:text-base">Complete these four steps to build a credible employer profile and unlock your hiring dashboard, job posting tools, and applicant workspace.</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(30,41,59,0.07)] sm:p-7 dark:border-gray-800 dark:bg-gray-900 dark:shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
          <div className="relative mb-9 grid grid-cols-4 gap-2 sm:gap-4">
            <div className="absolute left-[12.5%] right-[12.5%] top-5 hidden h-0.5 bg-slate-200 sm:block dark:bg-gray-700" />
            <div className="absolute left-[12.5%] top-5 hidden h-0.5 bg-violet-600 transition-all duration-500 sm:block" style={{ width: `${Math.max(0, step) * (75 / 3)}%` }} />
            {STEPS.map((item, index) => {
              const Icon = item.icon;
              const complete = index < step;
              const active = index === step;
              return (
                <button key={item.label} type="button" onClick={() => index < step && moveToStep(index)} disabled={index > step} className={`relative z-10 flex min-w-0 flex-col items-center text-center ${index < step ? "cursor-pointer" : index > step ? "cursor-not-allowed" : "cursor-default"}`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm shadow-sm transition-all ${complete ? "border-violet-600 bg-violet-600 text-white" : active ? "border-violet-600 bg-white text-violet-700 ring-4 ring-violet-100" : "border-slate-200 bg-white text-slate-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"}`}>
                    {complete ? <Check className="h-4.5 w-4.5" /> : <Icon className="h-4.5 w-4.5" />}
                  </span>
                  <span className={`mt-2 hidden text-xs font-extrabold sm:block ${active || complete ? "text-slate-900 dark:text-gray-100" : "text-slate-400 dark:text-gray-500"}`}>{item.label}</span>
                  <span className="mt-0.5 hidden max-w-[130px] text-[10px] leading-4 text-slate-400 lg:block dark:text-gray-500">{item.helper}</span>
                </button>
              );
            })}
          </div>

          {isLoadingProfile ? (
            <div className="flex min-h-80 flex-col items-center justify-center text-center"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /><p className="mt-3 text-sm font-medium text-slate-500 dark:text-gray-400">Loading your company setup…</p></div>
          ) : (
            <>
              <div className="mx-auto max-w-3xl">{stepContent[step]()}</div>
              <div className="mx-auto mt-9 flex max-w-3xl flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                <div className="flex gap-3">
                  {step > 0 && <button type="button" onClick={() => moveToStep(step - 1)} disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"><ChevronLeft className="h-4 w-4" />Back</button>}
                  <button type="button" onClick={() => saveCompany(false)} disabled={isSaving || isUploadingLogo} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800"><Save className="h-4 w-4" />Save draft</button>
                </div>
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={handleNext} disabled={isSaving || isUploadingLogo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm shadow-violet-200 transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">Continue<ChevronRight className="h-4 w-4" /></button>
                ) : (
                  <button type="button" onClick={() => saveCompany(true)} disabled={isSaving || isUploadingLogo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm shadow-emerald-200 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}{isSaving ? "Completing setup…" : "Complete company setup"}</button>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default EmployerSetup;
