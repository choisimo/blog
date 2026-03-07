import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import HTMLtoDOCX from "html-to-docx";

const MAX_CUSTOM_CSS_LENGTH = 32_000;
const PDF_MARGIN_MM = {
  top: "18mm",
  right: "14mm",
  bottom: "18mm",
  left: "14mm",
};
const CHROMIUM_PATH_CANDIDATES = [
  process.env.PDF_CHROMIUM_EXECUTABLE_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/snap/bin/chromium",
].filter(Boolean);

let resolvedChromiumPath = undefined;

export function sanitizeExportFilename(title) {
  if (typeof title !== "string" || !title.trim()) return "document";
  return title.replace(/[^a-zA-Z0-9가-힣\-_ ]/g, "_").trim() || "document";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikeHtml(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("<p>") ||
    lower.includes("<h1>") ||
    lower.includes("<h2>") ||
    lower.includes("<ul>") ||
    lower.includes("<ol>") ||
    lower.includes("<div>") ||
    lower.includes("<table>") ||
    lower.includes("<br>") ||
    lower.includes("<br/>")
  );
}

function sanitizeCustomCss(customCss) {
  if (typeof customCss !== "string" || !customCss.trim()) return "";
  const normalized = customCss
    .replace(/<\/style>/gi, "")
    .replace(/<style[^>]*>/gi, "")
    .replace(/@import\s+[^;]+;?/gi, "");
  return normalized.length > MAX_CUSTOM_CSS_LENGTH
    ? normalized.slice(0, MAX_CUSTOM_CSS_LENGTH)
    : normalized;
}

function buildDefaultCss() {
  return `
@page { size: A4; margin: 18mm 14mm 18mm 14mm; }
body {
  font-family: "Noto Sans KR", "NanumGothic", "Malgun Gothic", "Apple SD Gothic Neo", "DejaVu Sans", sans-serif;
  font-size: 11pt;
  line-height: 1.65;
  color: #111827;
}
.document-export { width: 100%; }
.document-export h1 { font-size: 18pt; margin: 0 0 14pt 0; font-weight: 700; line-height: 1.35; }
.document-export h2 { font-size: 15pt; margin: 14pt 0 8pt 0; font-weight: 700; line-height: 1.4; }
.document-export h3 { font-size: 13pt; margin: 10pt 0 6pt 0; font-weight: 700; line-height: 1.4; }
.document-export p { margin: 0 0 8pt 0; line-height: 1.65; }
.document-export ul, .document-export ol { margin: 0 0 8pt 18pt; padding: 0; }
.document-export li { margin: 0 0 4pt 0; }
.document-export blockquote { margin: 10pt 0; padding: 0 0 0 10pt; border-left: 3pt solid #cbd5e1; color: #475569; }
.document-export hr { border: 0; border-top: 1pt solid #cbd5e1; margin: 12pt 0; }
.document-export table { width: 100%; border-collapse: collapse; margin: 10pt 0; table-layout: fixed; page-break-inside: avoid; }
.document-export th, .document-export td { border: 1pt solid #d1d5db; padding: 6pt; vertical-align: top; word-wrap: break-word; }
.document-export th { font-weight: 700; background: #f3f4f6; }
.document-export td:first-child, .document-export th:first-child { width: 22%; white-space: nowrap; }
.document-export td.label, .document-export th.label { width: 22%; white-space: nowrap; }
.document-export a { color: #2563eb; text-decoration: underline; }
`.trim();
}

function toBodyHtml(content) {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) return "<p> </p>";
  if (looksLikeHtml(text)) return text;

  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line ? escapeHtml(line) : " "}</p>`)
    .join("");
}

function buildExportHtml({ title, content, customCss }) {
  const safeTitle = typeof title === "string" ? title.trim() : "";
  const bodyHtml = toBodyHtml(content);
  const sanitizedCustomCss = sanitizeCustomCss(customCss);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <style>${buildDefaultCss()}</style>
  ${sanitizedCustomCss ? `<style>${sanitizedCustomCss}</style>` : ""}
</head>
<body>
  <article class="document-export">
    ${safeTitle ? `<h1>${escapeHtml(safeTitle)}</h1>` : ""}
    ${bodyHtml}
  </article>
</body>
</html>`;
}

function resolveChromiumPath() {
  if (resolvedChromiumPath !== undefined) return resolvedChromiumPath;
  resolvedChromiumPath = CHROMIUM_PATH_CANDIDATES.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  return resolvedChromiumPath;
}

async function launchBrowser() {
  const executablePath = resolveChromiumPath();
  if (!executablePath) {
    const err = new Error(
      "Chromium executable not found. Set PDF_CHROMIUM_EXECUTABLE_PATH or install chromium in runtime.",
    );
    err.code = "PDF_CHROMIUM_NOT_FOUND";
    throw err;
  }

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });
}

export async function generatePdf({ title, content, customCss }) {
  const html = buildExportHtml({ title, content, customCss });
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: PDF_MARGIN_MM,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function generateDocx({ title, content, customCss }) {
  const html = buildExportHtml({ title, content, customCss });
  const buffer = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    pageNumber: false,
    footer: false,
  });
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
