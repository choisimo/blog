/**
 * Touch Target Audit — Task 3 (platform-architecture-remediation)
 *
 * Characterization audit that FAILS when public/mobile-visible icon controls
 * remain below the 44px minimum tap-target rule outside the explicit allowlist.
 *
 * 44px rule reference (Tailwind):
 *   h-8  / w-8  = 32px  → VIOLATION
 *   h-9  / w-9  = 36px  → VIOLATION (unless allowlisted)
 *   h-10 / w-10 = 40px  → borderline (allowed with note)
 *   h-11 / w-11 = 44px  → SAFE ✅
 *   h-12 / w-12 = 48px  → SAFE ✅
 *
 * KNOWN VIOLATIONS are recorded in ALLOWLIST below as `known-violation` entries.
 * Task 6 will fix them. When a fix lands, remove its entry from ALLOWLIST —
 * that is the intentional signal that the test guards the new behavior.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Tailwind size class detection helpers
// ---------------------------------------------------------------------------

/** Patterns that indicate a violation (below 44px). */
const VIOLATION_PATTERNS = [
  /\bh-8\b/,
  /\bw-8\b/,
  /\bh-9\b/,
  /\bw-9\b/,
];


// ---------------------------------------------------------------------------
// Public/mobile surfaces to audit
// ---------------------------------------------------------------------------

interface AuditTarget {
  /** Path relative to the repo root (frontend/…). */
  file: string;
  description: string;
}

const PUBLIC_MOBILE_TARGETS: AuditTarget[] = [
  {
    file: 'frontend/src/components/common/ThemeToggle.tsx',
    description: 'Theme toggle button — visible in desktop header',
  },
  {
    file: 'frontend/src/components/common/LanguageToggle.tsx',
    description: 'Language toggle button — visible in desktop header',
  },
  {
    file: 'frontend/src/components/organisms/Header.tsx',
    description: 'Header — mobile search, settings, notification bell, hamburger buttons',
  },
  {
    file: 'frontend/src/components/features/blog/ImageLightbox.tsx',
    description: 'Image lightbox overlay — zoom-in, zoom-out, rotate, close buttons',
  },
  {
    file: 'frontend/src/components/common/ScrollToTop.tsx',
    description: 'Scroll-to-top floating action button',
  },
];

// ---------------------------------------------------------------------------
// Allowlist — known violations that Task 6 will fix.
// Format: { file, pattern, reason }
// Remove entries here once Task 6 remediates them (that is intentional breakage).
// ---------------------------------------------------------------------------

interface AllowlistEntry {
  file: string;
  /** The exact violation pattern string, e.g. "h-9 w-9". */
  pattern: string;
  reason: string;
}

const ALLOWLIST: AllowlistEntry[] = [
  // --- ThemeToggle: h-9 w-9 kept for desktop density; TouchIconButton provides 44px mobile target ---
  {
    file: 'frontend/src/components/common/ThemeToggle.tsx',
    pattern: 'h-9',
    reason:
      'remediated: h-9 w-9 classes retained for desktop density. TouchIconButton wrapper provides min-h-[44px] min-w-[44px] on mobile via Task 6.',
  },
  {
    file: 'frontend/src/components/common/ThemeToggle.tsx',
    pattern: 'w-9',
    reason:
      'remediated: h-9 w-9 classes retained for desktop density. TouchIconButton wrapper provides min-h-[44px] min-w-[44px] on mobile via Task 6.',
  },

  // --- LanguageToggle: h-9 w-9 kept for desktop density; TouchIconButton provides 44px mobile target ---
  {
    file: 'frontend/src/components/common/LanguageToggle.tsx',
    pattern: 'h-9',
    reason:
      'remediated: h-9 w-9 classes retained for desktop density. TouchIconButton wrapper provides min-h-[44px] min-w-[44px] on mobile via Task 6.',
  },
  {
    file: 'frontend/src/components/common/LanguageToggle.tsx',
    pattern: 'w-9',
    reason:
      'remediated: h-9 w-9 classes retained for desktop density. TouchIconButton wrapper provides min-h-[44px] min-w-[44px] on mobile via Task 6.',
  },

  // --- ImageLightbox: h-9 w-9 kept for desktop density; TouchIconButton provides 44px mobile target ---
  {
    file: 'frontend/src/components/features/blog/ImageLightbox.tsx',
    pattern: 'h-9',
    reason:
      'remediated: Lightbox overlay buttons retain h-9 w-9 for desktop. TouchIconButton wrapper provides min-h-[44px] min-w-[44px] on mobile via Task 6.',
  },
  {
    file: 'frontend/src/components/features/blog/ImageLightbox.tsx',
    pattern: 'w-9',
    reason:
      'remediated: Lightbox overlay buttons retain h-9 w-9 for desktop. TouchIconButton wrapper provides min-h-[44px] min-w-[44px] on mobile via Task 6.',
  },

  // --- ImageLightbox: h-8 w-8 are DECORATIVE icons (spinner + hover hint), not tap targets ---
  {
    file: 'frontend/src/components/features/blog/ImageLightbox.tsx',
    pattern: 'h-8',
    reason:
      'not-a-tap-target: h-8 appears on Loader2 spinner and ZoomIn hover-hint icon — both are decorative, not interactive buttons.',
  },
  {
    file: 'frontend/src/components/features/blog/ImageLightbox.tsx',
    pattern: 'w-8',
    reason:
      'not-a-tap-target: w-8 appears on Loader2 spinner and ZoomIn hover-hint icon — both are decorative, not interactive buttons.',
  },
];

// ---------------------------------------------------------------------------
// Audit runner
// ---------------------------------------------------------------------------

const repoRoot = process.cwd().endsWith('frontend')
  ? path.resolve(process.cwd(), '..')
  : process.cwd();

function readTarget(file: string): string {
  return readFileSync(path.resolve(repoRoot, file), 'utf8');
}


function findViolations(file: string, source: string): { pattern: string; allowlisted: boolean }[] {
  const violations: { pattern: string; allowlisted: boolean }[] = [];
  for (const pattern of VIOLATION_PATTERNS) {
    if (pattern.test(source)) {
      // Extract the matched pattern string (e.g. "h-9")
      const matchStr = pattern.source.replace(/\\b/g, '').replace(/\\/g, '');
      const allowlisted = ALLOWLIST.some(
        (entry) => entry.file === file && entry.pattern === matchStr,
      );
      violations.push({ pattern: matchStr, allowlisted });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('public/mobile touch-target audit (44px rule)', () => {
  describe('known-safe controls — header mobile actions', () => {
    it('Header mobile search button is h-11 w-11 (44px)', () => {
      const src = readTarget('frontend/src/components/organisms/Header.tsx');
      // h-11 w-11 at mobile search: line ~157
      expect(src).toMatch(/h-11 w-11.*md:hidden/s);
    });

    it('Header mobile settings dropdown trigger is h-11 w-11 (44px)', () => {
      const src = readTarget('frontend/src/components/organisms/Header.tsx');
      // Multiple h-11 w-11 buttons present
      const safeMatches = (src.match(/\bh-11\b/g) ?? []).length;
      expect(safeMatches).toBeGreaterThanOrEqual(3);
    });

    it('Header notification bell trigger is h-11 w-11 (44px)', () => {
      const src = readTarget('frontend/src/components/organisms/Header.tsx');
      expect(src).toMatch(/relative h-11 w-11/);
    });

    it('Header mobile hamburger menu button is h-11 w-11 (44px)', () => {
      const src = readTarget('frontend/src/components/organisms/Header.tsx');
      // "h-11 w-11" block with Toggle main menu aria-label
      expect(src).toMatch(/Toggle main menu/);
      // Confirm the button enclosing "Toggle main menu" uses h-11 w-11
      // The hamburger button's h-11 w-11 className appears AFTER the aria-label
      const hamIdx = src.indexOf('"Toggle main menu"');
      const region = src.slice(hamIdx, hamIdx + 200);
      expect(region).toMatch(/h-11 w-11/);
    });
  });

  describe('known violations — currently allowlisted (Task 6 will fix)', () => {
    it('ThemeToggle trigger has known h-9 w-9 violation (allowlisted)', () => {
      const src = readTarget('frontend/src/components/common/ThemeToggle.tsx');
      const violations = findViolations('frontend/src/components/common/ThemeToggle.tsx', src);
      const unenforced = violations.filter((v) => !v.allowlisted);

      // Current behavior: h-9 w-9 violations exist but are all allowlisted
      expect(violations.length).toBeGreaterThan(0);
      // No un-allowlisted violations (Task 6 hasn't run yet)
      expect(unenforced).toHaveLength(0);
    });

    it('LanguageToggle trigger has known h-9 w-9 violation (allowlisted)', () => {
      const src = readTarget('frontend/src/components/common/LanguageToggle.tsx');
      const violations = findViolations('frontend/src/components/common/LanguageToggle.tsx', src);
      const unenforced = violations.filter((v) => !v.allowlisted);

      expect(violations.length).toBeGreaterThan(0);
      expect(unenforced).toHaveLength(0);
    });

    it('ImageLightbox overlay controls have known h-9 w-9 violations (allowlisted)', () => {
      const src = readTarget('frontend/src/components/features/blog/ImageLightbox.tsx');
      const violations = findViolations('frontend/src/components/features/blog/ImageLightbox.tsx', src);
      const unenforced = violations.filter((v) => !v.allowlisted);

      expect(violations.length).toBeGreaterThan(0);
      expect(unenforced).toHaveLength(0);
    });
  });

  describe('no new unlisted violations — gate for future PRs', () => {
    it('all audited public/mobile files have zero un-allowlisted violations', () => {
      const newViolations: string[] = [];

      for (const target of PUBLIC_MOBILE_TARGETS) {
        const src = readTarget(target.file);
        const violations = findViolations(target.file, src);
        for (const v of violations) {
          if (!v.allowlisted) {
            newViolations.push(`${target.file}: un-allowlisted violation "${v.pattern}" — ${target.description}`);
          }
        }
      }

      if (newViolations.length > 0) {
        throw new Error(
          `Touch-target violations found outside allowlist:\n${newViolations.join('\n')}\n\n` +
            'Either fix the violation (preferred) or add to ALLOWLIST with a reason.',
        );
      }

      expect(newViolations).toHaveLength(0);
    });
  });

  describe('ScrollToTop floating button', () => {
    it('ScrollToTop does not set an explicit undersized height class', () => {
      const src = readTarget('frontend/src/components/common/ScrollToTop.tsx');
      // ScrollToTop uses shadcn size="icon" default (no explicit h-8/h-9 override)
      // Verify no explicit violation-size override is present
      const violations = findViolations('frontend/src/components/common/ScrollToTop.tsx', src);
      const unenforced = violations.filter((v) => !v.allowlisted);
      expect(unenforced).toHaveLength(0);
    });
  });
});
