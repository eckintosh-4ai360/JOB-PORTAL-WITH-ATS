const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

/**
 * Writers for the reports built by services/reportService: CSV, Excel and PDF.
 * Each takes the same report object — title, subtitle, columns, rows, summary.
 *
 * Dates are written in UTC, which is Ghana's time all year.
 */

// A PDF lists at most this many rows; the spreadsheet formats hold them all.
const PDF_MAX_ROWS = 1000;

const BRAND = "SPG Talent Network";

const toDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value, withTime = false) => {
    const date = toDate(value);
    if (!date) return "";
    const iso = date.toISOString();
    return withTime ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
};

const isBlank = (value) => value === null || value === undefined || value === "";

/** A cell as text, the way CSV and PDF show it. */
const displayValue = (column, value) => {
    if (isBlank(value)) return "";
    if (column.type === "date") return formatDate(value);
    if (column.type === "datetime") return formatDate(value, true);
    if (column.type === "percent" || column.type === "number") {
        const n = Number(value);
        return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "";
    }
    return String(value);
};

const generatedLabel = (report) => `${formatDate(report.generatedAt, true)} UTC`;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * One CSV cell. Text that begins like a formula (=, +, -, @, or a tab or
 * carriage return) is prefixed with an apostrophe: applicant names and notes
 * are typed by other people, and a spreadsheet would otherwise run them.
 */
const csvCell = (column, value) => {
    let text = displayValue(column, value);
    if (column.type === "text" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
};

const toCsv = (report) => {
    const header = report.columns.map((column) => csvCell({ type: "text" }, column.label)).join(",");
    const lines = report.rows.map((row) => report.columns.map((column) => csvCell(column, row[column.key])).join(","));
    // The byte-order mark makes Excel read the file as UTF-8, so "GH₵" and
    // accented names survive a double-click.
    return `﻿${[header, ...lines].join("\r\n")}\r\n`;
};

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const NUMBER_FORMATS = {
    date: "yyyy-mm-dd",
    datetime: "yyyy-mm-dd hh:mm",
    percent: "0",
    number: "0",
};

const sheetName = (title) => title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Report";

const excelValue = (column, value) => {
    if (isBlank(value)) return null;
    if (column.type === "date" || column.type === "datetime") return toDate(value);
    if (column.type === "percent" || column.type === "number") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    // Written as a plain string cell: exceljs only writes a formula when given
    // one explicitly, so text beginning with "=" stays text.
    return String(value);
};

const toXlsx = async (report) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = BRAND;
    workbook.created = report.generatedAt;

    // The data sheet is a clean table — header in row 1, frozen and
    // filterable — so it can be sorted or pivoted without tidying first.
    const sheet = workbook.addWorksheet(sheetName(report.title), {
        views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = report.columns.map((column) => ({
        header: column.label,
        key: column.key,
        width: column.width || 14,
        style: NUMBER_FORMATS[column.type] ? { numFmt: NUMBER_FORMATS[column.type] } : {},
    }));

    for (const row of report.rows) {
        const values = {};
        for (const column of report.columns) values[column.key] = excelValue(column, row[column.key]);
        sheet.addRow(values);
    }

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FF312E81" } };
    header.alignment = { vertical: "middle", wrapText: true };
    header.height = 22;
    header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFC7D2FE" } } };
    });
    if (report.columns.length) {
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: report.columns.length } };
    }

    // What the report is and how it was filtered, kept off the data sheet.
    const about = workbook.addWorksheet("About");
    about.columns = [{ width: 26 }, { width: 70 }];
    const aboutRows = [
        ["Report", report.title],
        ["Company", report.company || ""],
        ["Filters", report.subtitle || ""],
        ["Generated", generatedLabel(report)],
        [
            "Rows",
            report.truncated
                ? `${report.rows.length} of ${report.total} (the first ${report.rows.length} are included)`
                : String(report.rows.length),
        ],
        [],
        ...report.summary.map((item) => [item.label, String(item.value)]),
    ];
    aboutRows.forEach((values, index) => {
        const row = about.addRow(values);
        if (values.length) row.getCell(1).font = { bold: true };
        if (index === 0) row.getCell(2).font = { bold: true, size: 13 };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
};

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// The built-in PDF fonts cover Windows-1252 only. Characters outside it are
// swapped for a close equivalent — Ghanaian letters like ɛ and ɔ included —
// rather than printed as boxes. CSV and Excel keep the original text.
const PDF_REPLACEMENTS = {
    "₵": "GHS",
    "ɛ": "e",
    "Ɛ": "E",
    "ɔ": "o",
    "Ɔ": "O",
    "ŋ": "n",
    "Ŋ": "N",
    "‐": "-",
    "‑": "-",
    "−": "-",
    " ": " ",
    "\t": " ",
    "→": "->",
    "≤": "<=",
    "≥": ">=",
    "✓": "Yes",
};
const WIN_1252_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

const inWin1252 = (ch) => {
    const code = ch.codePointAt(0);
    return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_1252_EXTRAS.includes(ch);
};

const pdfText = (value) => {
    let out = "";
    // The app writes the cedi as "GH₵"; the lone sign is handled below.
    for (const ch of String(value ?? "").replace(/GH₵/g, "GHS")) {
        if (PDF_REPLACEMENTS[ch] !== undefined) {
            out += PDF_REPLACEMENTS[ch];
        } else if (ch === "\n" || inWin1252(ch)) {
            out += ch;
        } else if (ch.codePointAt(0) < 0x20) {
            // Other control characters are dropped.
        } else {
            // An accented letter outside the range keeps its base letter.
            const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
            out += base && [...base].every(inWin1252) ? base : "?";
        }
    }
    return out;
};

const COLORS = {
    text: "#111827",
    muted: "#6B7280",
    headerFill: "#EEF2FF",
    headerText: "#312E81",
    stripe: "#F9FAFB",
    rule: "#E5E7EB",
    boxFill: "#F8FAFC",
};

const FONT_SIZE = 8;
const CELL_PADDING = 4;
const MAX_CELL_LINES = 3;
const FOOTER_SPACE = 22;

const toPdf = (report) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: "A4",
        layout: report.orientation === "portrait" ? "portrait" : "landscape",
        margins: { top: 40, bottom: 40, left: 36, right: 36 },
        bufferPages: true,
        info: { Title: pdfText(`${report.title} report`), Author: BRAND, Creator: BRAND },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
        const left = doc.page.margins.left;
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const bottom = () => doc.page.height - doc.page.margins.bottom - FOOTER_SPACE;

        // Title block
        doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.text)
            .text(pdfText(`${report.title} report`), left, doc.page.margins.top, { width });
        const meta = [report.company, report.subtitle, `Generated ${generatedLabel(report)}`].filter(Boolean).join("  ·  ");
        doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(pdfText(meta), { width });

        // Summary figures, as a row of boxes
        const items = report.summary.slice(0, 6);
        if (items.length) {
            const gap = 8;
            const boxWidth = (width - gap * (items.length - 1)) / items.length;
            const top = doc.y + 10;
            items.forEach((item, index) => {
                const x = left + index * (boxWidth + gap);
                doc.roundedRect(x, top, boxWidth, 40, 6).fillAndStroke(COLORS.boxFill, COLORS.rule);
                doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted)
                    .text(pdfText(item.label).toUpperCase(), x + 8, top + 7, { width: boxWidth - 16, lineBreak: false, ellipsis: true });
                doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.text)
                    .text(pdfText(String(item.value)), x + 8, top + 19, { width: boxWidth - 16, lineBreak: false, ellipsis: true });
            });
            doc.y = top + 40 + 14;
        } else {
            doc.moveDown(1);
        }

        // Table
        const columns = report.columns.filter((column) => column.pdf > 0);
        const totalWeight = columns.reduce((sum, column) => sum + column.pdf, 0) || 1;
        const widths = columns.map((column) => (column.pdf / totalWeight) * width);
        const alignOf = (column) => (column.type === "number" || column.type === "percent" ? "right" : "left");

        doc.fontSize(FONT_SIZE);
        const lineHeight = doc.currentLineHeight(true);
        const cellHeight = (text, cellWidth, font) => {
            doc.font(font).fontSize(FONT_SIZE);
            const height = text ? doc.heightOfString(text, { width: cellWidth - CELL_PADDING * 2 }) : lineHeight;
            return Math.min(Math.max(height, lineHeight), lineHeight * MAX_CELL_LINES);
        };

        const drawRow = (texts, y, { font, color, fill }) => {
            const height = Math.max(...texts.map((text, i) => cellHeight(text, widths[i], font))) + CELL_PADDING * 2;
            if (fill) doc.rect(left, y, width, height).fill(fill);
            let x = left;
            texts.forEach((text, i) => {
                doc.font(font).fontSize(FONT_SIZE).fillColor(color).text(text, x + CELL_PADDING, y + CELL_PADDING, {
                    width: widths[i] - CELL_PADDING * 2,
                    height: height - CELL_PADDING * 2,
                    align: alignOf(columns[i]),
                    ellipsis: true,
                });
                x += widths[i];
            });
            doc.moveTo(left, y + height).lineTo(left + width, y + height).lineWidth(0.5).strokeColor(COLORS.rule).stroke();
            return height;
        };

        const headerTexts = columns.map((column) => pdfText(column.label));
        const drawHeader = (y) => drawRow(headerTexts, y, { font: "Helvetica-Bold", color: COLORS.headerText, fill: COLORS.headerFill });

        let y = doc.y;
        const rows = report.rows.slice(0, PDF_MAX_ROWS);

        if (!columns.length || rows.length === 0) {
            doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted)
                .text("No rows match these filters.", left, y, { width });
        } else {
            y += drawHeader(y);
            rows.forEach((row, index) => {
                const texts = columns.map((column) => pdfText(displayValue(column, row[column.key])));
                const height = Math.max(...texts.map((text, i) => cellHeight(text, widths[i], "Helvetica"))) + CELL_PADDING * 2;
                if (y + height > bottom()) {
                    doc.addPage();
                    y = doc.page.margins.top;
                    y += drawHeader(y);
                }
                y += drawRow(texts, y, {
                    font: "Helvetica",
                    color: COLORS.text,
                    fill: index % 2 === 1 ? COLORS.stripe : null,
                });
            });

            const hidden = report.columns.length - columns.length;
            const notes = [];
            if (report.rows.length > rows.length || report.truncated) {
                notes.push(`Showing the first ${rows.length} of ${report.total} rows. Download Excel or CSV for all of them.`);
            }
            if (hidden > 0) notes.push(`${hidden} more column${hidden === 1 ? "" : "s"} in the Excel and CSV versions.`);
            if (notes.length) {
                if (y + 30 > bottom()) {
                    doc.addPage();
                    y = doc.page.margins.top;
                }
                doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(notes.join(" "), left, y + 8, { width });
            }
        }

        // Footer on every page. The bottom margin is lifted while writing it,
        // or PDFKit would treat text there as overflow and start a new page.
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i += 1) {
            doc.switchToPage(i);
            const margin = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;
            const footerY = doc.page.height - margin + 12;
            doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted);
            doc.text(pdfText(`${BRAND} · ${report.title} report`), left, footerY, { width: width / 2, lineBreak: false });
            doc.text(`Page ${i - range.start + 1} of ${range.count}`, left + width / 2, footerY, {
                width: width / 2,
                align: "right",
                lineBreak: false,
            });
            doc.page.margins.bottom = margin;
        }

        doc.end();
    } catch (error) {
        reject(error);
    }
});

const FORMATS = {
    csv: { extension: "csv", contentType: "text/csv; charset=utf-8", write: async (report) => Buffer.from(toCsv(report), "utf8") },
    xlsx: {
        extension: "xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        write: toXlsx,
    },
    pdf: { extension: "pdf", contentType: "application/pdf", write: toPdf },
};

module.exports = {
    PDF_MAX_ROWS,
    FORMATS,
    toCsv,
    toXlsx,
    toPdf,
    pdfText,
    csvCell,
    displayValue,
};
