import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * The assessments employers have asked this candidate to complete. Scores are
 * not shown here — the employer shares the outcome — only what is still to do
 * and what has been handed in.
 */

const STATUS = {
  invited: { label: "To do", badge: "bg-brand-indigo-light text-primary", action: "Open" },
  in_progress: { label: "In progress", badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", action: "Continue" },
  submitted: { label: "Submitted", badge: "bg-salary-surface text-salary-emerald", action: "View" },
  scored: { label: "Submitted", badge: "bg-salary-surface text-salary-emerald", action: "View" },
  expired: { label: "Deadline passed", badge: "bg-surface-container text-text-muted", action: null },
};

const Card = ({ item }) => {
  const status = STATUS[item.status] || STATUS.invited;
  return (
    <article className="flex flex-col gap-space-sm rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_10px_24px_rgba(40,34,86,0.06)] sm:flex-row sm:items-center md:p-space-lg">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-indigo-light text-primary">
        {item.companyLogo ? (
          <img src={item.companyLogo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-[26px]">quiz</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-headline-sm font-bold text-text-primary">{item.title}</h3>
          <span className={`rounded-full px-2.5 py-0.5 font-label-md font-bold ${status.badge}`}>{status.label}</span>
        </div>
        <p className="font-body-sm text-text-secondary">
          {item.companyName} · {item.jobTitle}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-body-sm text-text-muted">
          <span>{item.questionCount} questions</span>
          <span>{item.timeLimitMinutes ? `${item.timeLimitMinutes} minutes once started` : "No time limit"}</span>
          {item.status === "invited" && <span>Complete by {moment(item.dueAt).format("ddd D MMM")} ({moment(item.dueAt).fromNow()})</span>}
          {item.submittedAt && <span>Submitted {moment(item.submittedAt).format("D MMM YYYY")}</span>}
        </p>
      </div>
      {status.action && (
        <Link
          to={`/assessment/${item.id}`}
          className={`shrink-0 rounded-xl px-space-md py-2.5 text-center font-label-md font-bold transition-colors ${
            item.status === "invited" || item.status === "in_progress"
              ? "bg-primary text-on-primary hover:bg-brand-indigo-dark"
              : "bg-surface-container text-on-surface hover:bg-surface-container-high"
          }`}
        >
          {status.action}
        </Link>
      )}
    </article>
  );
};

const MyAssessments = () => {
  const [assessments, setAssessments] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.MINE)
      .then((res) => {
        if (!cancelled) setAssessments(res.data.assessments || []);
      })
      .catch(() => {
        if (!cancelled) setAssessments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (assessments || []).filter((a) => a.status === "invited" || a.status === "in_progress");
  const done = (assessments || []).filter((a) => a.status !== "invited" && a.status !== "in_progress");

  return (
    <div className="flex min-h-screen flex-col bg-surface pt-20 text-on-surface">
      <Navbar />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-margin-mobile pb-space-xl pt-space-lg md:px-margin">
        <h1 className="font-headline-lg font-bold text-text-primary">Assessments</h1>
        <p className="mt-1 font-body-md text-text-secondary">
          Tests employers have asked you to complete as part of your applications.
        </p>

        {assessments === null ? (
          <div className="flex justify-center py-20">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="mt-space-lg flex flex-col items-center rounded-3xl border border-dashed border-border-default bg-surface-card px-6 py-16 text-center">
            <span className="material-symbols-outlined mb-2 text-[40px] text-text-muted">quiz</span>
            <p className="font-headline-sm font-bold text-text-primary">No assessments yet</p>
            <p className="mt-1 max-w-md font-body-md text-text-secondary">
              When an employer asks you to complete one, it will appear here and we&apos;ll email you a link.
            </p>
          </div>
        ) : (
          <div className="mt-space-lg space-y-space-lg">
            {open.length > 0 && (
              <section className="space-y-space-sm">
                <h2 className="font-label-caps uppercase text-text-muted">To complete</h2>
                {open.map((item) => (
                  <Card key={item.id} item={item} />
                ))}
              </section>
            )}
            {done.length > 0 && (
              <section className="space-y-space-sm">
                <h2 className="font-label-caps uppercase text-text-muted">Finished</h2>
                {done.map((item) => (
                  <Card key={item.id} item={item} />
                ))}
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MyAssessments;
