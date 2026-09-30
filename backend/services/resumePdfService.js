/**
 * Renders a resume-builder CV to PDF.
 *
 * Every template is single-column, real text in a standard font, with the
 * section headings an ATS looks for ("Work Experience", "Education",
 * "Skills"). That is the whole point of building the CV here rather than in a
 * design tool: the file a candidate downloads is one the platform's own ATS
 * checks — and an employer's — can read. `checkResumePdf` proves it by reading
 * the rendered file back with the same extractor used for uploaded CVs.
 *
 * Only the standard PDF fonts are used, so no font files ship with the API.
 * They cover Windows-1252; the few Ghanaian letters outside it (Ɛ, Ɔ, Ŋ) are
 * printed as their nearest Latin letter rather than as "?".
 */

const PDFDocument = require("pdfkit");
const { pdfText } = require("../utils/reportWriters");
const {
    sanitizeContent,
    formatRange,
    displayUrl,
    hrefFor,
    TEMPLATES,
    ACCENTS,
} = require("../utils/resumeContent");

const ACCENT_HEX = {
    indigo: "#3730A3",
    teal: "#0F766E",
    slate: "#334155",
    burgundy: "#9F1239",
    forest: "#166534",
    navy: "#1E3A8A",
};

const INK = "#1F2937";
const STRONG = "#111827";
const MUTED = "#4B5563";
const RULE = "#D1D5DB";

const HELVETICA = { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };
const TIMES = { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" };

/**
 * Sizes are in points. The browser preview (ResumePreview.jsx) reads the same
 * numbers, so change them in both places.
 */
const STYLES = {
    modern: {
        fonts: HELVETICA,
        margin: { top: 44, bottom: 44, x: 50 },
        body: 10,
        lineGap: 2.4,
        name: { size: 24, align: "left", accent: true },
        headline: 11.5,
        contact: 9,
        heading: { size: 10.5, accent: true, ruleAccent: true, before: 15, after: 7 },
        entryGap: 9,
        bulletIndent: 12,
    },
    classic: {
        fonts: TIMES,
        margin: { top: 48, bottom: 48, x: 56 },
        body: 11,
        lineGap: 2,
        name: { size: 22, align: "center", accent: false },
        headline: 12,
        contact: 9.5,
        heading: { size: 11.5, accent: false, ruleAccent: true, before: 14, after: 6 },
        entryGap: 8,
        bulletIndent: 13,
    },
    compact: {
        fonts: HELVETICA,
        margin: { top: 36, bottom: 36, x: 42 },
        body: 9.5,
        lineGap: 1.6,
        name: { size: 19, align: "left", accent: false },
        headline: 10.5,
        contact: 8.5,
        heading: { size: 9.5, accent: true, ruleAccent: false, before: 11, after: 5 },
        entryGap: 6,
        bulletIndent: 11,
    },
};

const HEADINGS = {
    summary: "Professional Summary",
    experience: "Work Experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
    projects: "Projects",
    languages: "Languages",
    references: "References",
};

// Letters used in Ghanaian names and places that the standard fonts lack.
const LATIN_FALLBACK = { "Ɛ": "E", "ɛ": "e", "Ɔ": "O", "ɔ": "o", "Ŋ": "N", "ŋ": "n", "₵": "GHS" };

const clean = (value) =>
    pdfText(String(value ?? "").replace(/GH₵/g, "GHS").replace(/[ƐɛƆɔŊŋ₵]/g, (ch) => LATIN_FALLBACK[ch]));

/** Is there anything to print for this section? */
const hasSection = (content, key) => {
    switch (key) {
        case "summary": return Boolean(content.summary);
        case "references": return content.references.mode !== "hide";
        default: return Array.isArray(content[key]) && content[key].length > 0;
    }
};

const safeFileName = (value) =>
    clean(value).replace(/[^a-zA-Z0-9 _-]+/g, "").replace(/\s+/g, " ").trim().replace(/ /g, "-").slice(0, 60);

/** The download name: "Ama-Mensah-CV.pdf", falling back to the CV's title. */
const pdfFileName = (resume) => {
    const content = sanitizeContent(resume?.content);
    const base = safeFileName(content.personal.fullName) || safeFileName(resume?.title) || "CV";
    return `${base}${/cv$/i.test(base) ? "" : "-CV"}.pdf`;
};

/**
 * @param {{title?: string, template?: string, accent?: string, content: object}} resume
 * @returns {Promise<{buffer: Buffer, pageCount: number}>}
 */
const renderResumePdf = (resume) => new Promise((resolve, reject) => {
    const content = sanitizeContent(resume?.content);
    const template = TEMPLATES.includes(resume?.template) ? resume.template : "modern";
    const style = STYLES[template];
    const accent = ACCENT_HEX[ACCENTS.includes(resume?.accent) ? resume.accent : "indigo"];
    const { personal } = content;
    const fonts = style.fonts;

    const doc = new PDFDocument({
        size: "A4",
        margins: { top: style.margin.top, bottom: style.margin.bottom, left: style.margin.x, right: style.margin.x },
        bufferPages: true,
        info: {
            Title: clean(`${personal.fullName || resume?.title || "Curriculum Vitae"} - CV`),
            Author: clean(personal.fullName || ""),
            Creator: "SPG Talent Network CV Builder",
        },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), pageCount }));

    let pageCount = 1;

    try {
        const left = style.margin.x;
        const width = doc.page.width - style.margin.x * 2;
        const right = left + width;
        const bottom = () => doc.page.height - style.margin.bottom;

        const lineHeight = (size, font = fonts.regular) => {
            doc.font(font).fontSize(size);
            return doc.currentLineHeight(true) + style.lineGap;
        };

        /** Start a new page unless `height` more points fit on this one. */
        const ensureSpace = (height) => {
            if (doc.y + height > bottom()) {
                doc.addPage();
                doc.y = style.margin.top;
            }
        };

        const paragraphText = (value, { size = style.body, font = fonts.regular, color = INK, x = left, w = width, align = "left" } = {}) => {
            doc.font(font).fontSize(size).fillColor(color)
                .text(clean(value), x, doc.y, { width: w, align, lineGap: style.lineGap });
        };

        /**
         * A row of short items — contact details, skills, languages — broken
         * between items rather than inside one, so no line ever starts with a
         * separator or splits an email address.
         */
        const inlineItems = (items, { size, font = fonts.regular, color = INK, align = "left", separator = "  |  " }) => {
            const parts = items.filter((item) => item && item.text).map((item) => ({ ...item, text: clean(item.text) }));
            if (!parts.length) return;

            doc.font(font).fontSize(size);
            const sepWidth = doc.widthOfString(separator);
            const lines = [[]];
            let used = 0;

            for (const part of parts) {
                const partWidth = doc.widthOfString(part.text);
                const current = lines[lines.length - 1];
                const needed = current.length ? sepWidth + partWidth : partWidth;
                if (current.length && used + needed > width) {
                    lines.push([part]);
                    used = partWidth;
                } else {
                    current.push(part);
                    used += needed;
                }
            }

            const height = lineHeight(size, font);
            for (const line of lines) {
                ensureSpace(height);
                const lineWidth = line.reduce((sum, part, i) => sum + doc.widthOfString(part.text) + (i ? sepWidth : 0), 0);
                let x = align === "center" ? left + (width - lineWidth) / 2 : left;
                const y = doc.y;

                line.forEach((part, i) => {
                    if (i) {
                        doc.font(font).fontSize(size).fillColor(MUTED).text(separator, x, y, { lineBreak: false });
                        x += sepWidth;
                    }
                    const partWidth = Math.min(doc.widthOfString(part.text), width);
                    doc.font(part.font || font).fontSize(size).fillColor(part.color || color)
                        .text(part.text, x, y, { lineBreak: false, width: partWidth + 1, ...(part.link ? { link: part.link } : {}) });
                    x += partWidth;
                });
                doc.y = y + height;
            }
        };

        const heading = (key) => {
            const spec = style.heading;
            const titleHeight = lineHeight(spec.size, fonts.bold);
            // Keep a heading with at least the first two lines under it.
            ensureSpace(spec.before + titleHeight + spec.after + lineHeight(style.body) * 2);
            doc.y += spec.before;

            doc.font(fonts.bold).fontSize(spec.size).fillColor(spec.accent ? accent : STRONG)
                .text(clean(HEADINGS[key]).toUpperCase(), left, doc.y, { width, lineBreak: false });
            const ruleY = doc.y + 3;
            doc.moveTo(left, ruleY).lineTo(right, ruleY)
                .lineWidth(spec.ruleAccent ? 0.9 : 0.6)
                .strokeColor(spec.ruleAccent ? accent : RULE)
                .stroke();
            doc.y = ruleY + spec.after;
        };

        /**
         * Bold title on the left, dates on the right. The title is given all
         * the room the dates leave, and wraps inside it if it must. The title
         * is drawn first so a parser reads "Accountant  Mar 2021 – Present",
         * not the dates before the job they belong to.
         */
        const entryHeader = (title, dates) => {
            const size = style.body + 0.5;
            const height = lineHeight(size, fonts.bold);
            ensureSpace(height * 2 + lineHeight(style.body));

            const y = doc.y;
            const dateText = clean(dates);
            doc.font(fonts.regular).fontSize(style.body);
            const dateWidth = dateText ? doc.widthOfString(dateText) : 0;

            doc.font(fonts.bold).fontSize(size).fillColor(STRONG)
                .text(clean(title), left, y, { width: width - (dateWidth ? dateWidth + 16 : 0), lineGap: style.lineGap });
            const after = Math.max(doc.y, y + height);

            if (dateText) {
                doc.font(fonts.regular).fontSize(style.body).fillColor(MUTED)
                    .text(dateText, right - dateWidth - 1, y + 0.5, { lineBreak: false, width: dateWidth + 1 });
            }
            doc.y = after;
        };

        const subLine = (value) => {
            if (!value) return;
            paragraphText(value, { font: fonts.italic, color: MUTED });
            doc.y += 1.5;
        };

        const bullets = (lines) => {
            const indent = style.bulletIndent;
            for (const line of lines) {
                const value = clean(line);
                doc.font(fonts.regular).fontSize(style.body);
                // A bullet is kept whole on one page; only one too long to fit
                // anywhere is allowed to run over.
                ensureSpace(Math.min(doc.heightOfString(value, { width: width - indent, lineGap: style.lineGap }), 120));
                const y = doc.y;
                doc.fillColor(INK).text("•", left + 2, y, { lineBreak: false });
                doc.text(value, left + indent, y, { width: width - indent, lineGap: style.lineGap });
                doc.y += 1.5;
            }
        };

        // --- Header -----------------------------------------------------------

        const nameAlign = style.name.align;
        doc.y = style.margin.top;
        doc.font(fonts.bold).fontSize(style.name.size).fillColor(style.name.accent ? accent : STRONG)
            .text(clean(personal.fullName || "Your Name"), left, doc.y, { width, align: nameAlign });

        if (personal.headline) {
            doc.y += 1;
            paragraphText(personal.headline, {
                size: style.headline,
                color: template === "classic" ? MUTED : INK,
                font: template === "classic" ? fonts.italic : fonts.regular,
                align: nameAlign,
            });
        }

        doc.y += 4;
        inlineItems([
            { text: personal.email, link: personal.email ? `mailto:${personal.email}` : null },
            { text: personal.phone },
            { text: personal.location },
            { text: displayUrl(personal.linkedin), link: hrefFor(personal.linkedin) },
            { text: displayUrl(personal.website), link: hrefFor(personal.website) },
        ], { size: style.contact, color: MUTED, align: nameAlign });

        if (template === "classic") {
            doc.y += 5;
            doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1.2).strokeColor(STRONG).stroke();
            doc.y += 2;
        }

        // --- Sections ---------------------------------------------------------

        for (const key of content.sections) {
            if (!hasSection(content, key)) continue;
            heading(key);

            if (key === "summary") {
                paragraphText(content.summary);
            }

            if (key === "experience") {
                content.experience.forEach((role, index) => {
                    if (index) doc.y += style.entryGap;
                    entryHeader(role.title || role.employer, formatRange(role.start, role.end, role.current));
                    subLine([role.title ? role.employer : "", role.location].filter(Boolean).join(", "));
                    bullets(role.bullets);
                });
            }

            if (key === "education") {
                content.education.forEach((entry, index) => {
                    if (index) doc.y += style.entryGap;
                    entryHeader(entry.qualification || entry.institution, formatRange(entry.start, entry.end));
                    subLine([entry.qualification ? entry.institution : "", entry.location].filter(Boolean).join(", "));
                    if (entry.details) paragraphText(entry.details, { size: style.body - 0.5 });
                });
            }

            if (key === "skills") {
                inlineItems(content.skills.map((skill) => ({ text: skill })), { size: style.body, separator: "  ·  " });
            }

            if (key === "certifications") {
                bullets(content.certifications.map((entry) =>
                    [entry.name, entry.issuer].filter(Boolean).join(", ") + (entry.year ? ` (${entry.year})` : "")));
            }

            if (key === "projects") {
                content.projects.forEach((project, index) => {
                    if (index) doc.y += style.entryGap - 2;
                    entryHeader(project.name, displayUrl(project.link));
                    if (project.description) paragraphText(project.description);
                });
            }

            if (key === "languages") {
                inlineItems(
                    content.languages.map((entry) => ({ text: entry.level ? `${entry.name} (${entry.level})` : entry.name })),
                    { size: style.body, separator: "  ·  " }
                );
            }

            if (key === "references") {
                const referees = content.references.items;
                if (content.references.mode === "list" && referees.length) {
                    referees.forEach((referee, index) => {
                        if (index) doc.y += style.entryGap - 2;
                        ensureSpace(lineHeight(style.body) * 3);
                        paragraphText(referee.name, { font: fonts.bold, color: STRONG });
                        paragraphText([referee.position, referee.organisation].filter(Boolean).join(", "), { color: MUTED });
                        inlineItems([
                            { text: referee.email, link: referee.email ? `mailto:${referee.email}` : null },
                            { text: referee.phone },
                        ], { size: style.body, color: INK });
                    });
                } else {
                    paragraphText("Available on request.");
                }
            }
        }

        // --- Page footer, only when there is more than one page ---------------

        const range = doc.bufferedPageRange();
        pageCount = range.count;
        if (pageCount > 1) {
            for (let i = range.start; i < range.start + range.count; i += 1) {
                doc.switchToPage(i);
                // Writing inside the bottom margin would otherwise make pdfkit
                // start yet another page.
                const margin = doc.page.margins.bottom;
                doc.page.margins.bottom = 0;
                doc.font(fonts.regular).fontSize(8).fillColor(MUTED).text(
                    clean(`${personal.fullName || "CV"}  ·  Page ${i + 1} of ${pageCount}`),
                    left,
                    doc.page.height - margin / 2 - 4,
                    { width, align: "right", lineBreak: false }
                );
                doc.page.margins.bottom = margin;
            }
        }

        doc.end();
    } catch (error) {
        reject(error);
    }
});

module.exports = { renderResumePdf, pdfFileName, ACCENT_HEX, STYLES, HEADINGS };
