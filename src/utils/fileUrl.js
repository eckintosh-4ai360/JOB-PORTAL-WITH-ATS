import { BASE_URL } from "./apiPath";

// Files this API serves itself all live under this path. Anything else in a
// stored URL (a Cloudinary link, say) belongs to another host and is left alone.
const OWN_UPLOAD_PREFIX = "/uploads/";

const parse = (raw) => {
  try {
    return new URL(raw, BASE_URL);
  } catch {
    return null;
  }
};

/**
 * Uploaded files (resumes, cover letters, documents) are stored with an
 * absolute URL built from the request host at upload time, so a file uploaded
 * from localhost carries a localhost link that is dead on every other device.
 * Rebuild our own uploads against the API this page is actually talking to;
 * relative paths resolve the same way.
 */
export const resolveFileUrl = (raw) => {
  if (!raw) return "";

  const url = parse(raw);
  if (!url) return raw;
  if (!url.pathname.startsWith(OWN_UPLOAD_PREFIX)) return url.toString();

  // Rebuilt from the path rather than by assigning `host`, which would keep a
  // stale port when the API has none of its own.
  return new URL(url.pathname + url.search, BASE_URL).toString();
};

/**
 * A link's `download` attribute is honoured only for same-origin URLs, and the
 * API sits on a different port to the app — so the attribute is silently
 * dropped and "Download" behaves exactly like "View". Asking the server for
 * the attachment is the only thing that works across origins.
 */
export const downloadFileUrl = (raw) => {
  const resolved = resolveFileUrl(raw);
  if (!resolved) return "";

  const url = parse(resolved);
  if (!url || !url.pathname.startsWith(OWN_UPLOAD_PREFIX)) return resolved;

  url.searchParams.set("download", "1");
  return url.toString();
};
