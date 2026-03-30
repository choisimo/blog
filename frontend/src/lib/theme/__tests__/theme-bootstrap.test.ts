/**
 * theme-bootstrap.test.ts
 *
 * Characterization tests that freeze cold-load theme resolution behavior
 * AFTER Task 5 (theme contract unification).
 *
 * Both the static inline bootstrap (frontend/index.html) and the React
 * ThemeProvider now share the same canonical default via:
 *   <meta name="theme-default" content="light">
 *
 * Contract (post-Task-5):
 *   - Missing or invalid storage → resolved to the meta-default ("light")
 *   - Stored "light" / "dark" / "terminal" → resolved consistently by both
 *   - Stored "system" + prefersDark=true  → "dark" in both
 *   - Stored "system" + prefersDark=false → "light" in both (React); bootstrap adds "light" class
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

interface ResolutionResult {
  classes: string[];
  effectiveTheme: string | null;
  themeValue?: string;
}

interface TestCase {
  name: string;
  storedTheme?: string;
  prefersDark: boolean;
  expected: {
    bootstrap: ResolutionResult;
    react: ResolutionResult;
    relationship: "match" | "mismatch";
  };
}

// ---------------------------------------------------------------------------
// Load and compile the inline bootstrap script from index.html
// ---------------------------------------------------------------------------

const indexHtmlPath = path.resolve(process.cwd(), "index.html");
const indexHtml = readFileSync(indexHtmlPath, "utf8");

// Updated regex matches the new bootstrap that uses `var stored = localStorage.getItem(...)`
const bootstrapScriptMatch = indexHtml.match(
  /<script>\s*(\(function \(\) \{[\s\S]*?localStorage\.getItem\("theme"\)[\s\S]*?\}\)\(\);)\s*<\/script>/,
);

if (!bootstrapScriptMatch) {
  throw new Error(
    "Could not find theme bootstrap script in frontend/index.html",
  );
}

const bootstrapScript = bootstrapScriptMatch[1];
const runBootstrapScript = new Function(
  "window",
  "document",
  "localStorage",
  bootstrapScript,
);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function ThemeProbe() {
  const { theme } = useTheme();
  return React.createElement(
    "output",
    { "data-testid": "theme-value" },
    String(theme),
  );
}

function setStoredTheme(storedTheme?: string) {
  window.localStorage.clear();
  if (storedTheme !== undefined) {
    window.localStorage.setItem("theme", storedTheme);
  }
}

function setPrefersDark(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/** Inject or update the theme-default meta tag in the JSDOM document. */
function setThemeDefaultMeta(value = "light") {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-default"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-default";
    document.head.appendChild(meta);
  }
  meta.content = value;
}

function resetEnvironment() {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = "";
}

function resolveEffectiveTheme(classes: string[], themeValue?: string | null) {
  if (classes.includes("terminal")) {
    return "terminal";
  }
  if (classes.includes("dark")) {
    return "dark";
  }
  if (classes.includes("light")) {
    return "light";
  }
  if (classes[0]) {
    return classes[0];
  }
  return themeValue ?? null;
}

function runStaticBootstrap(
  storedTheme: string | undefined,
  prefersDark: boolean,
): ResolutionResult {
  resetEnvironment();
  setStoredTheme(storedTheme);
  setPrefersDark(prefersDark);
  setThemeDefaultMeta("light"); // inject canonical default into JSDOM
  runBootstrapScript(window, document, window.localStorage);

  const classes = Array.from(document.documentElement.classList);
  return {
    classes,
    effectiveTheme: resolveEffectiveTheme(classes),
  };
}

function runReactInitialization(
  storedTheme: string | undefined,
  prefersDark: boolean,
): ResolutionResult {
  resetEnvironment();
  setStoredTheme(storedTheme);
  setPrefersDark(prefersDark);
  setThemeDefaultMeta("light"); // inject canonical default into JSDOM

  render(
    React.createElement(ThemeProvider, null, React.createElement(ThemeProbe)),
  );

  const themeValue = screen.getByTestId("theme-value").textContent ?? null;
  const classes = Array.from(document.documentElement.classList);

  return {
    themeValue: themeValue ?? undefined,
    classes,
    effectiveTheme: resolveEffectiveTheme(classes, themeValue),
  };
}

// ---------------------------------------------------------------------------
// Test cases — post-Task-5 unified contract
// ---------------------------------------------------------------------------

const cases: TestCase[] = [
  // --- missing storage, system preference: light ---
  {
    name: "resolves missing storage to light (default) — both bootstrap and React unified",
    prefersDark: false,
    expected: {
      bootstrap: {
        classes: ["light"],
        effectiveTheme: "light",
      },
      react: {
        themeValue: "light",
        classes: ["light"],
        effectiveTheme: "light",
      },
      relationship: "match",
    },
  },

  // --- missing storage, system preference: dark ---
  {
    name: "resolves missing storage to light even when system prefers dark",
    prefersDark: true,
    expected: {
      bootstrap: {
        classes: ["light"],
        effectiveTheme: "light",
      },
      react: {
        themeValue: "light",
        classes: ["light"],
        effectiveTheme: "light",
      },
      relationship: "match",
    },
  },

  // --- stored "light" ---
  {
    name: "resolves stored light consistently",
    storedTheme: "light",
    prefersDark: false,
    expected: {
      bootstrap: {
        classes: ["light"],
        effectiveTheme: "light",
      },
      react: {
        themeValue: "light",
        classes: ["light"],
        effectiveTheme: "light",
      },
      relationship: "match",
    },
  },

  // --- stored "dark" ---
  {
    name: "resolves stored dark consistently",
    storedTheme: "dark",
    prefersDark: false,
    expected: {
      bootstrap: {
        classes: ["dark"],
        effectiveTheme: "dark",
      },
      react: {
        themeValue: "dark",
        classes: ["dark"],
        effectiveTheme: "dark",
      },
      relationship: "match",
    },
  },

  // --- stored "terminal" ---
  {
    name: "resolves stored terminal consistently",
    storedTheme: "terminal",
    prefersDark: false,
    expected: {
      bootstrap: {
        classes: ["dark", "terminal"],
        effectiveTheme: "terminal",
      },
      react: {
        themeValue: "terminal",
        classes: ["dark", "terminal"],
        effectiveTheme: "terminal",
      },
      relationship: "match",
    },
  },

  // --- stored "system", system preference: light ---
  {
    name: "resolves stored system to light when system preference is light",
    storedTheme: "system",
    prefersDark: false,
    expected: {
      bootstrap: {
        classes: ["light"],
        effectiveTheme: "light",
      },
      react: {
        themeValue: "system",
        classes: ["light"],
        effectiveTheme: "light",
      },
      // Bootstrap adds 'light'; React theme state stays 'system' but DOM class is 'light'
      relationship: "match",
    },
  },

  // --- stored "system", system preference: dark ---
  {
    name: "resolves stored system to dark when system preference is dark",
    storedTheme: "system",
    prefersDark: true,
    expected: {
      bootstrap: {
        classes: ["dark"],
        effectiveTheme: "dark",
      },
      react: {
        themeValue: "system",
        classes: ["dark"],
        effectiveTheme: "dark",
      },
      relationship: "match",
    },
  },

  // --- invalid stored value ---
  {
    name: "resolves invalid stored theme to light default in both bootstrap and React",
    storedTheme: "bogus",
    prefersDark: false,
    expected: {
      bootstrap: {
        classes: ["light"],
        effectiveTheme: "light",
      },
      react: {
        themeValue: "light",
        classes: ["light"],
        effectiveTheme: "light",
      },
      relationship: "match",
    },
  },
];

afterEach(() => {
  resetEnvironment();
});

describe("theme cold-load characterization (unified contract)", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const bootstrap = runStaticBootstrap(
        testCase.storedTheme,
        testCase.prefersDark,
      );
      const react = runReactInitialization(
        testCase.storedTheme,
        testCase.prefersDark,
      );

      expect(bootstrap).toEqual(testCase.expected.bootstrap);
      expect(react).toEqual(testCase.expected.react);

      if (testCase.expected.relationship === "match") {
        expect(bootstrap.effectiveTheme).toBe(react.effectiveTheme);
      } else {
        expect(bootstrap.effectiveTheme).not.toBe(react.effectiveTheme);
      }
    });
  }
});
