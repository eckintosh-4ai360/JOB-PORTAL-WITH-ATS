import axiosInstance from "./axiosInstance";
import { API_PATHS } from "./apiPath";

export const REPORT_FORMATS = [
  { id: "pdf", label: "PDF" },
  { id: "xlsx", label: "Excel" },
  { id: "csv", label: "CSV" },
];

const FILENAME = /filename="?([^";]+)"?/i;

/** An error response downloaded as a Blob still carries the API's message. */
const messageFrom = async (error) => {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || null;
    } catch {
      return null;
    }
  }
  return data?.message || null;
};

/** Drop empty filters so the request reads like the screen. */
export const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== false)
  );

/**
 * Download a report file (services/reportService on the API) and save it
 * under the name the server gives it. Throws an Error with a message fit to
 * show when it cannot.
 */
export const downloadReport = async (type, format, params = {}) => {
  try {
    const res = await axiosInstance.get(API_PATHS.REPORTS.GET(type), {
      params: { ...cleanParams(params), format },
      responseType: "blob",
      // Building a long PDF takes a while.
      timeout: 180000,
    });

    const match = (res.headers["content-disposition"] || "").match(FILENAME);
    const filename = match?.[1] || `${type}-report.${format}`;

    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  } catch (error) {
    const message = await messageFrom(error);
    throw new Error(
      message ||
        (error.response?.status === 429
          ? "You've downloaded a lot of reports this hour. Try again shortly."
          : "Could not download that report."),
      { cause: error }
    );
  }
};
