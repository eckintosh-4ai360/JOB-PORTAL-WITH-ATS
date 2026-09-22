import { useEffect, useMemo, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";
import { useAuth } from "../context/AuthContext";

/**
 * The files an applicant has already uploaded, so an application can reuse one
 * instead of asking for the same document a second time.
 *
 * Guests and anyone with nothing saved get empty lists, which collapses the
 * picker back to a plain file input — the flow they had before.
 *
 * @param {boolean} enabled  only fetch while the apply form is actually open
 */
export const useSavedAttachments = (enabled) => {
  const { isAuthenticated, user } = useAuth();
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    if (!enabled || !isAuthenticated) return undefined;

    let cancelled = false;

    axiosInstance
      .get(API_PATHS.DOCUMENTS.GET_DOCUMENTS)
      .then((res) => {
        if (!cancelled) setDocuments(res.data?.documents || []);
      })
      .catch(() => {
        // A failed lookup just means no shortcuts — never block the application.
        if (!cancelled) setDocuments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, isAuthenticated]);

  const inCategory = (category) =>
    documents
      .filter((doc) => doc.category === category)
      .map((doc) => ({ id: doc._id || doc.id, name: doc.name, url: doc.url }));

  const resumeOptions = useMemo(() => {
    const profileResume = user?.resume
      ? [{ id: "profile-resume", name: "Primary resume", hint: "From your profile", url: user.resume }]
      : [];

    // The profile resume is often also filed as a document; show it once.
    return [...profileResume, ...inCategory("Resume").filter((doc) => doc.url !== user?.resume)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, user?.resume]);

  const coverLetterOptions = useMemo(
    () => inCategory("Cover Letter"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents]
  );

  return { resumeOptions, coverLetterOptions };
};

/** The empty value an AttachmentPicker starts from. */
export const emptyAttachment = { source: "upload", file: null, url: "", name: "" };

/** Pre-select the first saved file, so the common case needs no clicks. */
export const defaultAttachment = (options) =>
  options.length > 0
    ? { source: "saved", file: null, url: options[0].url, name: options[0].name }
    : emptyAttachment;
