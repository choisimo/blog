import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "public", "posts");
const YEAR_DIR_RE = /^\d{4}$/;
const KEBAB_CASE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SPECIAL_BASENAMES = new Set(["_index", "latest"]);

function readYearDirectories(rootDir) {
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && YEAR_DIR_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function readMarkdownFiles(yearDir) {
  return fs
    .readdirSync(yearDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

function parseFrontmatter(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data } = matter(raw);
  return data ?? {};
}

function normalizeSuggestion(value, year) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(new RegExp(`(?:^|-)${year}(?:-|$)`, "g"), "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function classifyFile({ year, file, frontmatter }) {
  const basename = file.replace(/\.md$/i, "");

  if (SPECIAL_BASENAMES.has(basename)) {
    return {
      basename,
      issues: [],
      suggestion: `${basename}.md`,
      special: true,
    };
  }

  const issues = [];
  const numericOnly = /^\d+$/.test(basename);

  if (/[A-Z]/.test(basename)) issues.push("uppercase");
  if (/_/.test(basename)) issues.push("underscore");
  if (/\s/.test(basename)) issues.push("space");
  if (numericOnly) issues.push("numeric-only");
  if (/[^\x00-\x7F]/.test(basename)) issues.push("non-ascii");
  if (new RegExp(`(?:^|-)${year}(?:-|$)`).test(basename)) issues.push("repeats-year");
  if (!KEBAB_CASE_RE.test(basename)) issues.push("not-lowercase-kebab-case");

  let suggestionSource = basename;
  if (typeof frontmatter.slug === "string" && KEBAB_CASE_RE.test(frontmatter.slug.trim())) {
    suggestionSource = frontmatter.slug.trim();
  }

  const normalized = normalizeSuggestion(suggestionSource, year);
  const suggestion =
    numericOnly && !frontmatter.slug
      ? "[manual-slug-required].md"
      : normalized
        ? `${normalized}.md`
        : "[manual-slug-required].md";

  return {
    basename,
    issues,
    suggestion,
    special: false,
  };
}

function summarizeIssues(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const issue of row.issues) {
      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function formatIssueSummary(issueSummary) {
  if (issueSummary.length === 0) {
    return "No violations found.";
  }

  return issueSummary.map(([issue, count]) => `- ${issue}: ${count}`).join("\n");
}

function main() {
  const strict = process.argv.includes("--strict");

  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const years = readYearDirectories(POSTS_DIR);
  const rows = [];

  for (const year of years) {
    const yearDir = path.join(POSTS_DIR, year);
    for (const file of readMarkdownFiles(yearDir)) {
      const absPath = path.join(yearDir, file);
      const frontmatter = parseFrontmatter(absPath);
      const result = classifyFile({ year, file, frontmatter });
      rows.push({
        year,
        file,
        path: path.relative(process.cwd(), absPath),
        slug: typeof frontmatter.slug === "string" ? frontmatter.slug : "",
        ...result,
      });
    }
  }

  const violations = rows.filter((row) => row.issues.length > 0);
  const issueSummary = summarizeIssues(violations);

  console.log(`Scanned ${rows.length} markdown posts across ${years.length} year directories.`);
  console.log(`Violations: ${violations.length}`);
  console.log("");
  console.log(formatIssueSummary(issueSummary));

  if (violations.length > 0) {
    console.log("");
    console.log("Examples:");
    for (const row of violations.slice(0, 20)) {
      const slugNote = row.slug ? ` | frontmatter slug: ${row.slug}` : "";
      console.log(
        `- ${row.path} -> ${row.suggestion} | issues: ${row.issues.join(", ")}${slugNote}`,
      );
    }
  }

  if (strict && violations.length > 0) {
    process.exit(1);
  }
}

main();
