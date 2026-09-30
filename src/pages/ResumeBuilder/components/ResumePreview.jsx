import { useLayoutEffect, useRef, useState } from "react";
import {
  SECTIONS,
  accentHex,
  displayUrl,
  formatRange,
  hasSection,
  printable,
  printedContent,
} from "../../../utils/resumeBuilder";

/**
 * The CV as it will print, on an A4 sheet scaled to fit its column.
 *
 * The PDF is drawn on the API (services/resumePdfService.js); this mirrors its
 * layout with the same point sizes and the same line-height metrics pdfkit
 * uses for its standard fonts, so what the candidate sees here is what the
 * download looks like. Page breaks are estimated, since the PDF also keeps
 * headings and bullets together — the page count on the download is exact.
 *
 * Text is shown as the PDF prints it, so the few letters its fonts lack
 * (Ɔ, Ɛ, the cedi sign) appear here the way they will on paper.
 */

const PX = 96 / 72; // CSS pixels per point
const PAGE = { width: 595.28 * PX, height: 841.89 * PX };

const INK = "#1F2937";
const STRONG = "#111827";
const MUTED = "#4B5563";
const RULE = "#D1D5DB";

const HELVETICA = { family: 'Helvetica, Arial, "Liberation Sans", sans-serif', lineHeight: 1.156 };
const TIMES = { family: '"Times New Roman", Times, "Liberation Serif", serif', lineHeight: 1.116 };

// Keep in step with STYLES in resumePdfService.js.
const STYLES = {
  modern: {
    font: HELVETICA, margin: { top: 44, bottom: 44, x: 50 }, body: 10, lineGap: 2.4,
    name: { size: 24, align: "left", accent: true }, headline: 11.5, contact: 9,
    heading: { size: 10.5, accent: true, ruleAccent: true, before: 15, after: 7 },
    entryGap: 9, bulletIndent: 12,
  },
  classic: {
    font: TIMES, margin: { top: 48, bottom: 48, x: 56 }, body: 11, lineGap: 2,
    name: { size: 22, align: "center", accent: false }, headline: 12, contact: 9.5,
    heading: { size: 11.5, accent: false, ruleAccent: true, before: 14, after: 6 },
    entryGap: 8, bulletIndent: 13,
  },
  compact: {
    font: HELVETICA, margin: { top: 36, bottom: 36, x: 42 }, body: 9.5, lineGap: 1.6,
    name: { size: 19, align: "left", accent: false }, headline: 10.5, contact: 8.5,
    heading: { size: 9.5, accent: true, ruleAccent: false, before: 11, after: 5 },
    entryGap: 6, bulletIndent: 11,
  },
};

const pt = (value) => `${value * PX}px`;

// innerText, not textContent: it keeps the line breaks between laid-out
// elements, so a job title and its dates are not read as one word.
const countWords = (node) => (node.innerText || "").split(/\s+/).filter(Boolean).length;

const ResumePaper = ({ content: source, template = "modern", accent = "indigo" }) => {
  const content = printedContent(source);
  const style = STYLES[template] || STYLES.modern;
  const color = accentHex(accent);
  const lists = printable(content);
  const { personal = {} } = content;

  const text = (size, extra = {}) => ({
    fontSize: pt(size),
    lineHeight: pt(style.font.lineHeight * size + style.lineGap),
    margin: 0,
    ...extra,
  });

  /**
   * A wrapping row of short items. As in the PDF, a left-aligned line never
   * starts with a separator: every item carries one in front, the row is
   * pulled left by one separator width, and the wrapper clips what falls
   * outside — exactly the separator at the start of each line. A centred row
   * (the Classic header) never touches that edge, so it simply leaves out the
   * first separator; it is one short line of contact details in practice.
   */
  const inlineItems = ({ items, size, separator = "|", align = "left", itemColor = INK }) => {
    const parts = items.filter(Boolean);
    if (!parts.length) return null;
    const gap = "1.38em"; // the width of "  |  " in Helvetica and Times
    const centred = align === "center";
    return (
      <div style={{ ...text(size), color: itemColor, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: centred ? "center" : "flex-start",
            ...(centred ? {} : { marginLeft: `-${gap}`, width: `calc(100% + ${gap})` }),
          }}
        >
          {parts.map((part, index) => (
            <span key={`${part}-${index}`} style={{ whiteSpace: "nowrap" }}>
              {(!centred || index > 0) && (
                <span style={{ display: "inline-block", width: gap, textAlign: "center", color: MUTED }}>{separator}</span>
              )}
              {part}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const heading = (sectionKey) => (
    <div style={{ marginTop: pt(style.heading.before), marginBottom: pt(style.heading.after) }}>
      <div
        style={{
          ...text(style.heading.size),
          fontWeight: 700,
          textTransform: "uppercase",
          color: style.heading.accent ? color : STRONG,
          paddingBottom: pt(2),
          borderBottom: `${style.heading.ruleAccent ? 0.9 : 0.6}pt solid ${style.heading.ruleAccent ? color : RULE}`,
        }}
      >
        {SECTIONS[sectionKey].heading}
      </div>
    </div>
  );

  const entryHeader = (title, dates) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: pt(16), alignItems: "baseline" }}>
      <span style={{ ...text(style.body + 0.5), fontWeight: 700, color: STRONG }}>{title}</span>
      {dates && <span style={{ ...text(style.body), color: MUTED, whiteSpace: "nowrap" }}>{dates}</span>}
    </div>
  );

  const subLine = (value) =>
    value ? <p style={{ ...text(style.body), fontStyle: "italic", color: MUTED, marginBottom: pt(1.5) }}>{value}</p> : null;

  const bullets = (items) => (
    <div>
      {items.map((item, index) => (
        <div key={index} style={{ display: "flex", marginBottom: pt(1.5) }}>
          <span style={{ ...text(style.body), width: pt(style.bulletIndent), paddingLeft: pt(2), flexShrink: 0 }}>•</span>
          <span style={{ ...text(style.body), color: INK }}>{item}</span>
        </div>
      ))}
    </div>
  );

  const paragraph = (value, { size = style.body, extra = {} } = {}) => (
    <p style={{ ...text(size), color: INK, whiteSpace: "pre-line", ...extra }}>{value}</p>
  );

  const sections = {
    summary: () => paragraph(content.summary),
    experience: () =>
      lists.experience.map((role, index) => (
        <div key={role.id} style={{ marginTop: index ? pt(style.entryGap) : 0 }}>
          {entryHeader(role.title || role.employer, formatRange(role.start, role.end, role.current))}
          {subLine([role.title ? role.employer : "", role.location].filter(Boolean).join(", "))}
          {bullets(role.bullets)}
        </div>
      )),
    education: () =>
      lists.education.map((entry, index) => (
        <div key={entry.id} style={{ marginTop: index ? pt(style.entryGap) : 0 }}>
          {entryHeader(entry.qualification || entry.institution, formatRange(entry.start, entry.end))}
          {subLine([entry.qualification ? entry.institution : "", entry.location].filter(Boolean).join(", "))}
          {entry.details && paragraph(entry.details, { size: style.body - 0.5 })}
        </div>
      )),
    skills: () => inlineItems({ items: lists.skills, size: style.body, separator: "·" }),
    certifications: () => (
      bullets(lists.certifications.map(
          (entry) => [entry.name, entry.issuer].filter(Boolean).join(", ") + (entry.year ? ` (${entry.year})` : "")
        ))
    ),
    projects: () =>
      lists.projects.map((project, index) => (
        <div key={project.id} style={{ marginTop: index ? pt(style.entryGap - 2) : 0 }}>
          {entryHeader(project.name, displayUrl(project.link))}
          {project.description && paragraph(project.description)}
        </div>
      )),
    languages: () => (
      inlineItems({ items: lists.languages.map((entry) => (entry.level ? `${entry.name} (${entry.level})` : entry.name)), size: style.body, separator: "·" })
    ),
    references: () =>
      lists.references.mode === "list" && lists.references.items.length ? (
        lists.references.items.map((referee, index) => (
          <div key={referee.id} style={{ marginTop: index ? pt(style.entryGap - 2) : 0 }}>
            {paragraph(referee.name, { extra: { fontWeight: 700, color: STRONG } })}
            {paragraph([referee.position, referee.organisation].filter(Boolean).join(", "), { extra: { color: MUTED } })}
            {inlineItems({ items: [referee.email, referee.phone], size: style.body })}
          </div>
        ))
      ) : (
        paragraph("Available on request.")
      ),
  };

  const nameAlign = style.name.align;

  return (
    <div
      style={{
        width: PAGE.width,
        minHeight: PAGE.height,
        padding: `${pt(style.margin.top)} ${pt(style.margin.x)} ${pt(style.margin.bottom)}`,
        boxSizing: "border-box",
        background: "#FFFFFF",
        color: INK,
        fontFamily: style.font.family,
        textAlign: "left",
        overflowWrap: "anywhere",
      }}
    >
      <h1
        style={{
          ...text(style.name.size),
          fontWeight: 700,
          color: style.name.accent ? color : STRONG,
          textAlign: nameAlign,
          letterSpacing: 0,
        }}
      >
        {personal.fullName || "Your Name"}
      </h1>
      {personal.headline && (
        <p
          style={{
            ...text(style.headline),
            marginTop: pt(1),
            textAlign: nameAlign,
            color: template === "classic" ? MUTED : INK,
            fontStyle: template === "classic" ? "italic" : "normal",
          }}
        >
          {personal.headline}
        </p>
      )}
      <div style={{ marginTop: pt(4) }}>
        {inlineItems({ items: [personal.email, personal.phone, personal.location, displayUrl(personal.linkedin), displayUrl(personal.website)], size: style.contact, align: nameAlign, itemColor: MUTED })}
      </div>
      {template === "classic" && <div style={{ marginTop: pt(5), borderTop: `1.2pt solid ${STRONG}` }} />}

      {(content.sections || []).map((key) =>
        hasSection(content, key, lists) && sections[key] ? (
          <section key={key}>
            {heading(key)}
            {sections[key]()}
          </section>
        ) : null
      )}
    </div>
  );
};

/**
 * @param {object} props
 * @param {boolean} [props.showPageBreaks] mark where each new page is expected
 * @param {(stats: {pages: number, words: number}) => void} [props.onStats]
 */
const ResumePreview = ({ content, template, accent, showPageBreaks = true, onStats, className = "" }) => {
  const frameRef = useRef(null);
  const paperRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [paperHeight, setPaperHeight] = useState(PAGE.height);
  const [words, setWords] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const paper = paperRef.current;
    if (!frame || !paper) return undefined;

    const measure = () => {
      // Hidden (the editor's mobile "Edit" tab) measures as zero; keep the
      // last real size rather than collapsing the sheet to nothing.
      if (!frame.clientWidth || !paper.offsetHeight) return;
      setScale(frame.clientWidth / PAGE.width);
      setPaperHeight(paper.offsetHeight);
      setWords(countWords(paper));
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(paper);
    return () => observer.disconnect();
  }, []);

  const style = STYLES[template] || STYLES.modern;
  const usable = PAGE.height - (style.margin.top + style.margin.bottom) * PX;
  const contentHeight = Math.max(0, paperHeight - (style.margin.top + style.margin.bottom) * PX);
  const pages = Math.max(1, Math.ceil((contentHeight - 1) / usable));
  const height = Math.max(paperHeight, pages * PAGE.height);

  // Height and word count follow every edit, not only resizes. Only while
  // visible — hidden, both measure as nothing.
  useLayoutEffect(() => {
    const paper = paperRef.current;
    if (!frameRef.current?.clientWidth || !paper?.offsetHeight) return;
    setPaperHeight(paper.offsetHeight);
    setWords(countWords(paper));
  }, [content, template]);

  const reported = useRef("");
  useLayoutEffect(() => {
    const key = `${pages}:${words}`;
    if (onStats && reported.current !== key) {
      reported.current = key;
      onStats({ pages, words });
    }
  }, [pages, words, onStats]);

  return (
    <div ref={frameRef} className={`relative w-full ${className}`} style={{ height: height * scale }}>
      <div
        aria-label="CV preview"
        className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-sm shadow-[0_18px_40px_rgba(15,23,42,0.18)] ring-1 ring-black/5"
        style={{ transform: `scale(${scale})`, width: PAGE.width, minHeight: pages * PAGE.height, background: "#FFFFFF" }}
      >
        {/* Measured on its own: the sheet around it grows with the page
            count, and measuring that would feed the count back into itself. */}
        <div ref={paperRef}>
          <ResumePaper content={content} template={template} accent={accent} />
        </div>
      </div>

      {showPageBreaks &&
        Array.from({ length: pages - 1 }, (_, index) => {
          const top = ((style.margin.top * PX) + usable * (index + 1)) * scale;
          return (
            <div
              key={index}
              className="pointer-events-none absolute left-0 right-0 flex items-center gap-2"
              style={{ top }}
              aria-hidden="true"
            >
              <div className="h-px flex-1 border-t border-dashed border-rose-400/80" />
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">
                Page {index + 2}
              </span>
              <div className="h-px w-4 border-t border-dashed border-rose-400/80" />
            </div>
          );
        })}
    </div>
  );
};

export default ResumePreview;
