#!/usr/bin/env node

/**
 * Korean font fragment checker/fixer
 *
 * Detects decomposed Hangul (Jamo) and zero-width characters that can render as
 * fragmented Korean text, then optionally fixes by normalizing to NFC and
 * removing zero-widths.
 *
 * Usage:
 *   node scripts/korean-normalize.js [--fix] [--remove-zero-width] [--ci]
 *                                    [--ext md,mdx,txt] [paths...]
 *
 * Defaults:
 *   - Paths: public/posts
 *   - Extensions: md, mdx, txt
 *
 * Exit codes:
 *   - 0: no issues or issues fixed
 *   - 1: issues found (when not running with --fix) and --ci provided
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JamoRegex = /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/; // Hangul Jamo + Extended A/B
const ZeroWidthRegexGlobal = /[\u200B\u200C\u200D\uFEFF\u00AD]/g; // ZWSP, ZWNJ, ZWJ, BOM, soft hyphen
const ZeroWidthRegex = /[\u200B\u200C\u200D\uFEFF\u00AD]/; // non-global for testing

const DEFAULT_PATHS = ["public/posts"];
const DEFAULT_EXTS = [".md", ".mdx", ".txt"];
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".vercel",
]);

function printHelp() {
  console.log(
    `Korean font fragment checker/fixer\n\n` +
      `Usage:\n` +
      `  node scripts/korean-normalize.js [options] [paths...]\n\n` +
      `Options:\n` +
      `  --fix                 Write fixes back to files (NFC normalize)\n` +
      `  --remove-zero-width   Also strip zero-width chars (ZWSP/ZWNJ/ZWJ/BOM/SHY)\n` +
      `  --ext <list>          Comma-separated extensions to include (default: md,mdx,txt)\n` +
      `  --ci                  Exit with code 1 if issues found (when not fixing)\n` +
      `  --silent              Reduce log output\n` +
      `  --help                Show this help\n` +
      `\nExamples:\n` +
      `  node scripts/korean-normalize.js\n` +
      `  node scripts/korean-normalize.js --fix\n` +
      `  node scripts/korean-normalize.js --ext md,txt docs public/posts\n`,
  );
}

function parseArgs(argv) {
  const options = {
    fix: false,
    removeZeroWidth: false,
    exts: [...DEFAULT_EXTS],
    ci: false,
    silent: false,
    paths: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--fix":
        options.fix = true;
        break;
      case "--remove-zero-width":
        options.removeZeroWidth = true;
        break;
      case "--ext":
      case "-e": {
        const val = argv[++i];
        if (!val) throw new Error("--ext requires a value");
        options.exts = val
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .map((s) => (s.startsWith(".") ? s : `.${s}`));
        break;
      }
      case "--ci":
        options.ci = true;
        break;
      case "--silent":
        options.silent = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        // treat as path
        options.paths.push(arg);
        break;
    }
  }

  if (options.paths.length === 0) {
    options.paths = [...DEFAULT_PATHS];
  }

  return options;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function matchesExt(file, exts) {
  const ext = path.extname(file).toLowerCase();
  return exts.includes(ext);
}

function summarizeZeroWidth(text) {
  const matches = text.match(ZeroWidthRegexGlobal);
  if (!matches) return { count: 0, byChar: {} };
  return matches.reduce(
    (acc, ch) => {
      acc.count++;
      acc.byChar[ch] = (acc.byChar[ch] || 0) + 1;
      return acc;
    },
    { count: 0, byChar: {} },
  );
}

function hasDecomposedHangul(text) {
  if (!JamoRegex.test(text)) return false;
  return text !== text.normalize("NFC");
}

function findProblemLines(text) {
  const lines = text.split(/\r?\n/);
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const needsNorm = JamoRegex.test(line) && line !== line.normalize("NFC");
    const zws = line.match(ZeroWidthRegexGlobal)?.length || 0;
    if (needsNorm || zws) {
      issues.push({
        line: i + 1,
        norm: needsNorm,
        zws,
        preview: line.length > 160 ? line.slice(0, 160) + "…" : line,
      });
    }
  }
  return issues;
}

async function processFile(file, options) {
  const content = await fs.readFile(file, "utf8");
  const needsNorm = hasDecomposedHangul(content);
  const { count: zwsCount } = summarizeZeroWidth(content);

  const hasIssues = needsNorm || zwsCount > 0;
  let fixed = content;
  if (options.fix && hasIssues) {
    fixed = fixed.normalize("NFC");
    if (options.removeZeroWidth)
      fixed = fixed.replace(ZeroWidthRegexGlobal, "");
    if (fixed !== content) await fs.writeFile(file, fixed, "utf8");
  }

  if (hasIssues) {
    const lines = findProblemLines(content);
    return {
      file,
      needsNorm,
      zwsCount,
      lines,
      changed: options.fix && fixed !== content,
    };
  }
  return null;
}

async function gatherTargets(pathsList, exts) {
  const targets = [];
  for (const p of pathsList) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (!(await pathExists(abs))) continue;
    const stat = await fs.lstat(abs);
    if (stat.isDirectory()) {
      for await (const f of walk(abs)) {
        if (matchesExt(f, exts)) targets.push(f);
      }
    } else if (stat.isFile()) {
      if (matchesExt(abs, exts)) targets.push(abs);
    }
  }
  return targets;
}

function formatIssue(issue, rootDir) {
  const rel = path.relative(rootDir, issue.file) || issue.file;
  const head = `- ${rel} ${issue.changed ? "[fixed]" : ""}`.trim();
  const details = issue.lines.slice(0, 5).map((l) => {
    const markers = [l.norm ? "NFC" : null, l.zws ? `ZW:${l.zws}` : null]
      .filter(Boolean)
      .join(",");
    return `    L${l.line} (${markers}): ${l.preview}`;
  });
  const more =
    issue.lines.length > 5
      ? `    …and ${issue.lines.length - 5} more lines`
      : "";
  return [head, ...details, more].filter(Boolean).join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();

  const targets = await gatherTargets(options.paths, options.exts);
  if (!options.silent) {
    console.log(
      `Scanning ${targets.length} file(s) in: ${options.paths.join(", ")} [exts: ${options.exts.join(", ")}]`,
    );
    if (targets.length === 0) console.log("No matching files found.");
  }

  const results = [];
  for (const file of targets) {
    try {
      const r = await processFile(file, options);
      if (r) results.push(r);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message || err);
    }
  }

  const issues = results.filter(Boolean);
  const filesWithIssues = issues.length;
  const filesChanged = issues.filter((i) => i.changed).length;
  const totalZws = issues.reduce((sum, i) => sum + i.zwsCount, 0);
  const filesNeedingNorm = issues.filter((i) => i.needsNorm).length;

  if (!options.silent) {
    if (filesWithIssues > 0) {
      console.log("\nIssues found:");
      for (const issue of issues) {
        console.log(formatIssue(issue, rootDir));
      }
    }

    console.log("\nSummary:");
    console.log(`  Files scanned        : ${targets.length}`);
    console.log(`  Files with issues    : ${filesWithIssues}`);
    console.log(`  Files needing NFC    : ${filesNeedingNorm}`);
    console.log(`  Zero-width chars     : ${totalZws}`);
    if (options.fix) console.log(`  Files changed        : ${filesChanged}`);
  }

  if (!options.fix && options.ci && filesWithIssues > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
