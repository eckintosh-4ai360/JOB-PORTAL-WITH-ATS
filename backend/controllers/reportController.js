const { REPORTS, buildReport } = require("../services/reportService");
const { FORMATS } = require("../utils/reportWriters");

/**
 * Employer reports. `format=json` (the default) answers with a preview of the
 * first rows for the reports screen; csv, xlsx and pdf download the whole
 * report as a file.
 */

const PREVIEW_ROWS = 50;

const requireEmployer = (req, res) => {
    if (req.user.role !== "employer") {
        res.status(403).json({ message: "Reports are for employer accounts." });
        return false;
    }
    return true;
};

// @desc    The reports an employer can run
// @route   GET /api/reports
// @access  Private (Employer)
const listReports = (req, res) => {
    if (!requireEmployer(req, res)) return;
    res.status(200).json({
        reports: Object.entries(REPORTS).map(([type, report]) => ({
            type,
            title: report.title,
            description: report.description,
            filters: report.filters,
        })),
        formats: Object.keys(FORMATS),
    });
};

// @desc    Preview or download one report
// @route   GET /api/reports/:type?format=json|csv|xlsx|pdf&jobId=&from=&to=&status=&shortlisted=
// @access  Private (Employer)
const getReport = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const format = String(req.query.format || "json").toLowerCase();
        if (format !== "json" && !FORMATS[format]) {
            return res.status(400).json({ message: "Reports download as CSV, Excel (xlsx) or PDF." });
        }

        const report = await buildReport(req.params.type, { employerId: req.user._id, query: req.query });
        if (report.error) return res.status(report.status || 400).json({ message: report.error });

        if (format === "json") {
            return res.status(200).json({
                ...report,
                rows: report.rows.slice(0, PREVIEW_ROWS),
                previewRows: Math.min(PREVIEW_ROWS, report.rows.length),
            });
        }

        const { extension, contentType, write } = FORMATS[format];
        const file = await write(report);
        const day = report.generatedAt.toISOString().slice(0, 10);

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${report.type}-report-${day}.${extension}"`);
        res.setHeader("Cache-Control", "no-store");
        res.status(200).send(file);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not build that report.", error: error.message });
    }
};

module.exports = {
    listReports,
    getReport,
};
