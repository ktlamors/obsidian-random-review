import { marked, Token } from "marked";
import type { MarkedToken } from "marked";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
  LineRuleType,
} from "docx";

// ──────────────────────────────────────────────
// 类型
// ──────────────────────────────────────────────

export interface ExportNote {
  title: string;
  content: string; // 原始 markdown
}

export interface PluginInfo {
  name: string;
  version: string;
  author: string;
  authorUrl: string;
  githubUrl: string;
}

export type ExportFormat = "html" | "md" | "txt" | "docx";

export interface ExportOptions {
  notes: ExportNote[];
  format: ExportFormat;
  pluginInfo: PluginInfo;
  /** 是否导出答案（折叠 callout） */
  includeAnswers: boolean;
  includeRules: boolean;
  /** HTML 专用：答案（折叠 callout）初始是否折叠 */
  answerCollapsed: boolean;
  /** 抽取规则摘要文本（可为空） */
  rulesSummary?: string;
  /** 是否输出笔记标题 */
  includeNoteTitle?: boolean;
  /** 是否输出笔记属性（frontmatter） */
  includeProperties?: boolean;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string | ArrayBuffer;
  isBinary: boolean;
}

// ──────────────────────────────────────────────
// frontmatter 解析
// ──────────────────────────────────────────────

/** 从笔记内容中解析 YAML frontmatter，返回 { 属性对象, 正文 } */
function parseFrontmatter(content: string): { properties: Record<string, unknown> | null; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { properties: null, body: content };
  const yaml = m[1];
  const props: Record<string, unknown> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const kv = line.match(/^([^:#]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1].trim();
      let val: unknown = kv[2].trim();
      // 简化处理：去掉引号，数组/嵌套忽略
      if (/^["'].*["']$/.test(String(val))) val = String(val).slice(1, -1);
      if (String(val).startsWith("[") || String(val).startsWith("{")) val = String(val);
      props[key] = val;
    }
  }
  return { properties: props, body: content.slice(m[0].length) };
}

/** 把 frontmatter 属性格式化为一行摘要 */
function formatPropertiesLine(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

// ──────────────────────────────────────────────
// Markdown 渲染（支持 Obsidian 折叠 callout）
// ──────────────────────────────────────────────

interface Segment {
  type: "md" | "callout";
  text: string;
  calloutType?: string;
  folded?: boolean;
  title?: string;
}

/** 把 markdown 按 callout 边界切成段落 */
function extractSegments(md: string): Segment[] {
  const lines = md.split(/\r?\n/);
  const segments: Segment[] = [];
  let buffer: string[] = [];
  let i = 0;

  const flush = (): void => {
    if (buffer.length > 0) {
      segments.push({ type: "md", text: buffer.join("\n") });
      buffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    // 匹配 callout: 行首（可有缩进）> [!TYPE] 后面接 - 或 +，如 > [!NOTE]- 标题
    const m = line.match(/^(\s*)>\s*\[!([A-Za-z]+)\]([-+]?)\s*(.*)$/);
    if (m) {
      flush();
      const calloutType = m[2].toLowerCase();
      const folded = m[3] === "-";
      const title = m[4].trim();
      const body: string[] = [];
      i++;
      // 收集后续所有 > 开头的行（含单独的空 > 行），直到非 quote 行
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*> ?/, ""));
        i++;
      }
      segments.push({
        type: "callout",
        text: body.join("\n"),
        calloutType,
        folded,
        title,
      });
    } else {
      buffer.push(line);
      i++;
    }
  }
  flush();
  return segments;
}

/** 转义 HTML 特殊字符 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 把 markdown 渲染成 HTML，支持 callout（用于 HTML 导出）。includeAnswers=false 时移除答案（折叠 callout） */
export function renderMarkdown(md: string, includeAnswers = true): string {
  const segments = filterAnswers(extractSegments(md), includeAnswers);
  return segments
    .map((seg) => {
      if (seg.type === "md") {
        return marked.parse(seg.text) as string;
      }
      const type = seg.calloutType ?? "note";
      const icon = CALL_ICONS[type] ?? "📌";
      const title = seg.title || type.charAt(0).toUpperCase() + type.slice(1);
      const collapsed = seg.folded ? " is-collapsed" : "";
      const body = marked.parse(seg.text) as string;
      return (
        `<div class="callout${collapsed}" data-callout="${escapeHtml(type)}">` +
        `<div class="callout-title"><span class="callout-icon">${icon}</span>${escapeHtml(title)}</div>` +
        `<div class="callout-content">${body}</div>` +
        `</div>`
      );
    })
    .join("");
}

/** 根据 includeAnswers 过滤掉答案段落（所有 callout 均视为答案，与折叠状态无关） */
function filterAnswers(segments: Segment[], includeAnswers: boolean): Segment[] {
  if (includeAnswers) return segments;
  return segments.filter((s) => s.type !== "callout");
}

/** 从原始 markdown 中移除答案（所有 callout），用于 Markdown 导出 */
function stripAnswersFromMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)>\s*\[!([A-Za-z]+)\]([-+]?)\s*(.*)$/);
    if (m) {
      i++;
      while (i < lines.length && /^\s*>/.test(lines[i])) i++;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

const CALL_ICONS: Record<string, string> = {
  note: "📝",
  abstract: "📝",
  summary: "📝",
  tldr: "📝",
  info: "ℹ️",
  todo: "✅",
  tip: "💡",
  hint: "💡",
  important: "💡",
  success: "✅",
  check: "✅",
  done: "✅",
  question: "❓",
  help: "❓",
  faq: "❓",
  warning: "⚠️",
  caution: "⚠️",
  attention: "⚠️",
  failure: "❌",
  fail: "❌",
  missing: "❌",
  danger: "⚡",
  error: "⚡",
  bug: "🐞",
  example: "📐",
  quote: "💬",
  cite: "💬",
};

// ──────────────────────────────────────────────
// 插件信息块
// ──────────────────────────────────────────────

function pluginInfoText(info: PluginInfo): string {
  return [
    `${info.name} v${info.version}`,
    `作者：${info.author}`,
    `GitHub：${info.githubUrl}`,
  ].join("\n");
}

function pluginInfoMarkdown(info: PluginInfo): string {
  return [
    `**${info.name}** v${info.version}`,
    `- 作者：${info.author}`,
    `- GitHub：${info.githubUrl}`,
  ].join("\n");
}

// ──────────────────────────────────────────────
// 各格式构建
// ──────────────────────────────────────────────

function noteHeading(note: ExportNote, index: number): string {
  return `# ${note.title}`;
}

function buildHtml(opts: ExportOptions): string {
  const { notes, pluginInfo, answerCollapsed, includeAnswers, includeNoteTitle = true, includeProperties = false } = opts;

  const cards = notes
    .map((note, i) => {
      const { properties, body } = parseFrontmatter(note.content);
      const rendered = renderMarkdown(body, includeAnswers);
      const titleHtml = includeNoteTitle
        ? `<h1 class="note-title">${escapeHtml(note.title)}</h1>`
        : "";
      const propHtml = includeProperties && properties
        ? `<p class="note-props">${escapeHtml(formatPropertiesLine(properties))}</p>`
        : "";
      return (
        `<div class="note-wrap" data-index="${i}">` +
        `<div class="note-card">` +
        titleHtml + propHtml +
        `<div class="note-body">${rendered}</div>` +
        `</div></div>`
      );
    })
    .join("\n");

  const initialCollapsed = answerCollapsed ? "" : " show-answers";
  const toggleStyle = includeAnswers ? "" : ' style="display:none"';
  const hint = includeAnswers ? "，A 显示/隐藏答案" : "";

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pluginInfo.name)} - 导出</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #1a1b26;
  color: #c0caf5;
  line-height: 1.7;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
/* ── 顶部导航栏 ── */
.topbar {
  flex-shrink: 0;
  background: #16161e;
  border-bottom: 1px solid #292e42;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 20px;
  z-index: 10;
}
.topbar button {
  background: #7aa2f7;
  color: #1a1b26;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: filter .15s;
}
.topbar button:hover { filter: brightness(1.15); }
.topbar button:disabled { opacity: .35; cursor: default; }
.topbar button.ghost {
  background: transparent;
  color: #9aa5ce;
  border: 1px solid #3b4261;
}
.counter {
  min-width: 64px;
  text-align: center;
  color: #9aa5ce;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-family: "SF Mono", Consolas, monospace;
}
/* ── 笔记卡片区 ── */
main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
  scrollbar-width: thin;
  scrollbar-color: #3b4261 transparent;
}
main::-webkit-scrollbar { width: 6px; }
main::-webkit-scrollbar-track { background: transparent; }
main::-webkit-scrollbar-thumb { background: #3b4261; border-radius: 3px; }
.note-wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 20px;
  display: none;
}
.note-wrap.active { display: block; animation: fade .2s ease; }
@keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.note-card {
  background: #1f2335;
  border: 1px solid #292e42;
  border-radius: 12px;
  padding: 28px 32px;
}
.note-title {
  margin: 0 0 10px;
  font-size: 1.35em;
  font-weight: 700;
  color: #7aa2f7;
  border-bottom: 1px solid #292e42;
  padding-bottom: 10px;
}
.note-props {
  margin: 0 0 14px;
  font-size: .8em;
  color: #565f89;
}
.note-props span { margin-right: 10px; }
.note-body h1,.note-body h2,.note-body h3 { color: #c0caf5; }
.note-body h1 { font-size: 1.25em; margin: 1em 0 .5em; }
.note-body h2 { font-size: 1.1em; margin: .9em 0 .4em; }
.note-body img { max-width: 100%; border-radius: 6px; }
.note-body code {
  background: #1a1b26;
  color: #bb9af7;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: .88em;
}
.note-body pre {
  background: #1a1b26;
  border: 1px solid #292e42;
  padding: 14px;
  border-radius: 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.note-body pre code { background: none; padding: 0; color: #9aa5ce; }
.note-body blockquote {
  margin: 12px 0;
  padding: 4px 16px;
  border-left: 3px solid #7aa2f7;
  color: #9aa5ce;
}
.note-body ul, .note-body ol { padding-left: 22px; }
.note-body li { margin: 4px 0; }
/* ── Callout ── */
.callout {
  margin: 14px 0;
  border-radius: 8px;
  border: 1px solid #3b4261;
  overflow: hidden;
}
.callout-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  font-weight: 600;
  font-size: .95em;
  background: #292e42;
  color: #c0caf5;
}
.callout-icon { font-size: 1.05em; }
.callout-content { padding: 10px 16px; color: #9aa5ce; }
.callout.is-collapsed .callout-content { display: none; }
.show-answers .callout.is-collapsed .callout-content { display: block; }
/* ── 底部 ── */
footer {
  flex-shrink: 0;
  text-align: center;
  color: #565f89;
  font-size: .78em;
  padding: 14px 20px 18px;
  border-top: 1px solid #292e42;
  background: #16161e;
}
footer a { color: #7aa2f7; text-decoration: none; }
</style>
</head>
<body class="${initialCollapsed.trim()}">
<div class="topbar">
  <button id="prev">← 上一题</button>
  <span class="counter" id="counter">1 / ${notes.length}</span>
  <button id="next">下一题 →</button>
  <button id="toggle" class="ghost"${toggleStyle}>显示答案</button>
</div>
<main>
${cards}
</main>
<footer>
  由 <a href="${escapeHtml(pluginInfo.githubUrl)}" target="_blank" rel="noopener">${escapeHtml(pluginInfo.name)}</a> v${escapeHtml(pluginInfo.version)} 生成 · ← → 切换笔记${hint}
</footer>
<script>
(function () {
  var wraps = Array.from(document.querySelectorAll(".note-wrap"));
  var idx = 0;
  var showing = document.body.classList.contains("show-answers");
  var counter = document.getElementById("counter");
  var toggle = document.getElementById("toggle");
  var prev = document.getElementById("prev");
  var next = document.getElementById("next");
  var main = document.querySelector("main");

  function render() {
    wraps.forEach(function (n, i) { n.classList.toggle("active", i === idx); });
    counter.textContent = (idx + 1) + " / " + wraps.length;
    prev.disabled = idx <= 0;
    next.disabled = idx >= wraps.length - 1;
    main.scrollTop = 0;
  }
  function setAnswers(show) {
    showing = show;
    document.body.classList.toggle("show-answers", showing);
    if (toggle) toggle.textContent = showing ? "隐藏答案" : "显示答案";
  }
  prev.addEventListener("click", function () { if (idx > 0) { idx--; render(); } });
  next.addEventListener("click", function () { if (idx < wraps.length - 1) { idx++; render(); } });
  if (toggle) toggle.addEventListener("click", function () { setAnswers(!showing); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); if (idx < wraps.length - 1) { idx++; render(); } }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (idx > 0) { idx--; render(); } }
    else if (e.key === "a" || e.key === "A") { if (toggle) { e.preventDefault(); setAnswers(!showing); } }
  });
  setAnswers(showing);
  render();
})();
</script>
</body>
</html>`;
}

function buildMarkdown(opts: ExportOptions): string {
  const parts: string[] = [];
  const { includeNoteTitle = true, includeProperties = false } = opts;
  // 插件信息始终包含
  parts.push(`<!-- ${pluginInfoText(opts.pluginInfo).replace(/\n/g, " | ")} -->`);
  if (opts.includeRules && opts.rulesSummary) {
    parts.push(`> ${opts.rulesSummary}`);
  }
  opts.notes.forEach((note, i) => {
    if (includeNoteTitle) parts.push(noteHeading(note, i));
    const { properties, body } = parseFrontmatter(note.content);
    const content = opts.includeAnswers ? body : stripAnswersFromMarkdown(body);
    if (includeProperties && properties) {
      parts.push(formatPropertiesLine(properties));
    }
    parts.push(content);
    parts.push("");
  });
  parts.push("---");
  parts.push(pluginInfoMarkdown(opts.pluginInfo));
  return parts.join("\n").trim() + "\n";
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildText(opts: ExportOptions): string {
  const parts: string[] = [];
  const { includeNoteTitle = true, includeProperties = false } = opts;
  // 插件信息始终包含
  parts.push(pluginInfoText(opts.pluginInfo));
  parts.push("=".repeat(40));
  if (opts.includeRules && opts.rulesSummary) {
    parts.push(opts.rulesSummary);
    parts.push("-".repeat(40));
  }
  opts.notes.forEach((note) => {
    const { properties, body } = parseFrontmatter(note.content);
    const text = htmlToText(renderMarkdown(body, opts.includeAnswers));
    if (includeNoteTitle) {
      parts.push(note.title);
      parts.push("-".repeat(40));
    }
    if (includeProperties && properties) {
      parts.push(formatPropertiesLine(properties));
    }
    parts.push(text);
    parts.push("");
  });
  return parts.join("\n").trim() + "\n";
}

// ──────────────────────────────────────────────
// DOCX 构建
// ──────────────────────────────────────────────

/** 正文统一样式：宋体五号（10.5pt = 21 half-points）、1.5 倍行距 */
const DOCX_FONT = { name: "宋体", eastAsia: "宋体" };
const DOCX_SIZE = 21;
const DOCX_SPACING = { line: 360, lineRule: LineRuleType.AUTO };

function inlineToRuns(tokens: Token[]): TextRun[] {
  const runs: TextRun[] = [];
  const walk = (toks: Token[], bold: boolean, italics: boolean): void => {
    for (const raw of toks) {
      const t = raw as MarkedToken;
      switch (t.type) {
        case "text":
        case "escape":
          runs.push(
            new TextRun({ text: t.text, bold, italics, font: DOCX_FONT, size: DOCX_SIZE })
          );
          break;
        case "strong":
          walk(t.tokens, true, italics);
          break;
        case "em":
          walk(t.tokens, bold, true);
          break;
        case "del":
          runs.push(...inlineToRuns(t.tokens));
          break;
        case "codespan":
          runs.push(
            new TextRun({ text: t.text, font: DOCX_FONT, size: DOCX_SIZE })
          );
          break;
        case "link":
          walk(t.tokens, bold, italics);
          break;
        case "br":
          runs.push(new TextRun({ text: "\n", font: DOCX_FONT, size: DOCX_SIZE }));
          break;
        default:
          break;
      }
    }
  };
  walk(tokens, false, false);
  return runs;
}

function docxParagraphsForMarkdown(md: string, includeAnswers = true, questionNumber?: number): Paragraph[] {
  const segments = filterAnswers(extractSegments(md), includeAnswers);
  const out: Paragraph[] = [];
  let headingSeen = false;
  for (const seg of segments) {
    if (seg.type === "callout") {
      const title = seg.title || (seg.calloutType ?? "note");
      out.push(
        new Paragraph({
          children: [new TextRun({ text: title, font: DOCX_FONT, size: DOCX_SIZE })],
          spacing: DOCX_SPACING,
        })
      );
      out.push(...docxParagraphsForMarkdown(seg.text, includeAnswers));
      continue;
    }
    const tokens = marked.lexer(seg.text) as MarkedToken[];
    for (const token of tokens) {
      switch (token.type) {
        case "heading": {
          // 题目标题统一宋体五号黑色，第一个标题加题目编号
          const prefix = questionNumber != null && !headingSeen ? `${questionNumber}. ` : "";
          headingSeen = true;
          const runs = inlineToRuns(token.tokens);
          if (prefix) {
            runs.unshift(new TextRun({ text: prefix, font: DOCX_FONT, size: DOCX_SIZE }));
          }
          out.push(
            new Paragraph({
              children: runs,
              spacing: DOCX_SPACING,
            })
          );
          break;
        }
        case "paragraph":
          out.push(
            new Paragraph({
              children: inlineToRuns(token.tokens),
              spacing: DOCX_SPACING,
            })
          );
          break;
        case "list": {
          const items = token.items;
          for (const item of items) {
            const itemTokens: MarkedToken[] = item.tokens as MarkedToken[];
            const firstPara = itemTokens.find(
              (x) => x.type === "paragraph" || x.type === "text"
            );
            const runs = firstPara && firstPara.type === "paragraph"
              ? inlineToRuns(firstPara.tokens)
              : firstPara && firstPara.type === "text"
                ? [new TextRun({ text: firstPara.text, font: DOCX_FONT, size: DOCX_SIZE })]
                : [new TextRun({ text: item.text, font: DOCX_FONT, size: DOCX_SIZE })];
            // 选项正常排列，不加无序列表符号
            out.push(
              new Paragraph({
                children: runs,
                spacing: DOCX_SPACING,
              })
            );
          }
          break;
        }
        case "code":
          out.push(
            new Paragraph({
              children: [new TextRun({ text: token.text, font: DOCX_FONT, size: DOCX_SIZE })],
              spacing: DOCX_SPACING,
            })
          );
          break;
        case "blockquote":
          out.push(
            new Paragraph({
              children: inlineToRuns(token.tokens),
              spacing: DOCX_SPACING,
            })
          );
          break;
        case "hr":
          out.push(new Paragraph({ text: "", spacing: DOCX_SPACING }));
          break;
        case "space":
        default:
          break;
      }
    }
  }
  return out;
}

async function buildDocx(opts: ExportOptions): Promise<ArrayBuffer> {
  const { notes, pluginInfo, includeNoteTitle = true, includeProperties = false } = opts;
  const children: Paragraph[] = [];

  if (opts.includeRules && opts.rulesSummary) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: opts.rulesSummary, font: DOCX_FONT, size: DOCX_SIZE })],
        spacing: DOCX_SPACING,
      })
    );
  }

  notes.forEach((note, noteIndex) => {
    const { properties, body } = parseFrontmatter(note.content);
    if (includeNoteTitle) {
      // 文件名不编号，宋体五号黑色
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: note.title,
              font: DOCX_FONT,
              size: DOCX_SIZE,
            }),
          ],
          spacing: DOCX_SPACING,
        })
      );
    }
    if (includeProperties && properties) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: formatPropertiesLine(properties), font: DOCX_FONT, size: DOCX_SIZE }),
          ],
          spacing: DOCX_SPACING,
        })
      );
    }
    children.push(...docxParagraphsForMarkdown(body, opts.includeAnswers, noteIndex + 1));
  });

  // 插件信息始终包含（正文末尾 + 页眉页脚）
  const infoChildren = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: `${pluginInfo.name} v${pluginInfo.version}`, size: 16, color: "6B7280" }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${pluginInfo.name} v${pluginInfo.version}`, size: 16, color: "9CA3AF" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: pluginInfo.githubUrl, size: 16, color: "9CA3AF" }),
                  new TextRun({ text: " · 第 ", size: 16, color: "9CA3AF" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "9CA3AF" }),
                  new TextRun({ text: " 页", size: 16, color: "9CA3AF" }),
                ],
              }),
            ],
          }),
        },
        children: [...infoChildren, ...children],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob.arrayBuffer();
}

// ──────────────────────────────────────────────
// 统一入口
// ──────────────────────────────────────────────

const EXTENSIONS: Record<ExportFormat, string> = {
  html: "html",
  md: "md",
  txt: "txt",
  docx: "docx",
};

const MIME_TYPES: Record<ExportFormat, string> = {
  html: "text/html",
  md: "text/markdown",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function buildExport(
  opts: ExportOptions,
  baseName: string
): Promise<ExportResult> {
  const ext = EXTENSIONS[opts.format];
  const filename = `${baseName}.${ext}`;
  const mimeType = MIME_TYPES[opts.format];

  if (opts.format === "html") {
    return { filename, mimeType, content: buildHtml(opts), isBinary: false };
  }
  if (opts.format === "md") {
    return { filename, mimeType, content: buildMarkdown(opts), isBinary: false };
  }
  if (opts.format === "txt") {
    return { filename, mimeType, content: buildText(opts), isBinary: false };
  }
  const content = await buildDocx(opts);
  return { filename, mimeType, content, isBinary: true };
}
