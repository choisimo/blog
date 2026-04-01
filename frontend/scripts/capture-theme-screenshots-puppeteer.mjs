import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer";

const BASE_URL = process.env.SCREENSHOT_BASE_URL || "http://127.0.0.1:4173";
const THEMES = (process.env.SCREENSHOT_THEMES || "light,dark,terminal")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const OUTPUT_ROOT = process.env.SCREENSHOT_OUTDIR
  ? path.resolve(process.cwd(), process.env.SCREENSHOT_OUTDIR)
  : path.resolve(process.cwd(), "verification-screenshots", "themes");

const VIEWPORT = {
  width: Number.parseInt(process.env.SCREENSHOT_WIDTH || "1440", 10),
  height: Number.parseInt(process.env.SCREENSHOT_HEIGHT || "900", 10),
};

const WAIT_AFTER_NAV_MS = Number.parseInt(
  process.env.SCREENSHOT_WAIT_MS || "1200",
  10,
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRoute(route) {
  if (!route) return "/";
  if (!route.startsWith("/")) return `/${route}`;
  return route;
}

function routeToFilename(route) {
  if (route === "/") return "home.png";

  const cleaned = route
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const suffix = crypto
    .createHash("sha1")
    .update(route)
    .digest("hex")
    .slice(0, 10);

  return `${cleaned || "index"}__${suffix}.png`;
}

async function readPostsManifestRoutes() {
  const manifestPath = path.resolve(
    process.cwd(),
    "public",
    "posts-manifest.json",
  );
  const raw = await fs.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.posts)
      ? parsed.posts
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

  const routes = [];
  for (const item of items) {
    if (typeof item?.url === "string" && item.url.startsWith("/")) {
      routes.push(item.url);
      continue;
    }

    const year = String(item?.year || "").trim();
    const slug = String(item?.slug || "").trim();
    if (year && slug) {
      routes.push(
        `/blog/${encodeURIComponent(year)}/${encodeURIComponent(slug)}`,
      );
    }
  }

  return routes;
}

async function collectRoutes() {
  const staticRoutes = [
    "/",
    "/blog",
    "/projects",
    "/about",
    "/contact",
    "/insight",
    "/admin/new-post",
    "/admin/config",
    "/admin/auth/callback",
    "/404-not-found",
  ];

  const postRoutes = await readPostsManifestRoutes();

  // Add alias route (/post/:year/:slug) for one representative post.
  const aliasSample = postRoutes[0]?.replace(/^\/blog\//, "/post/");
  const all = [
    ...staticRoutes,
    ...postRoutes,
    ...(aliasSample ? [aliasSample] : []),
  ].map(normalizeRoute);

  return [...new Set(all)];
}

async function setThemeOnEveryNavigation(page, theme) {
  await page.evaluateOnNewDocument((themeValue) => {
    try {
      localStorage.setItem("theme", themeValue);
    } catch {
      // ignore
    }
  }, theme);

  // Reduce screenshot noise from animations.
  await page.evaluateOnNewDocument(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html {
        scroll-behavior: auto !important;
      }
    `;
    document.documentElement.appendChild(style);
  });
}

async function preparePageForTheme(page, theme) {
  await page.setViewport(VIEWPORT);

  if (theme === "dark" || theme === "terminal") {
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
  } else {
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "light" },
    ]);
  }

  await setThemeOnEveryNavigation(page, theme);
}

async function captureTheme(browser, theme, routes, failures) {
  const themeDir = path.join(OUTPUT_ROOT, theme);
  await fs.mkdir(themeDir, { recursive: true });

  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i];
    const targetUrl = new URL(route, BASE_URL).toString();
    const fileName = routeToFilename(route);
    const filePath = path.join(themeDir, fileName);
    let page = null;

    try {
      page = await browser.newPage();
      await preparePageForTheme(page, theme);

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await wait(WAIT_AFTER_NAV_MS);
      await page.evaluate(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
      await wait(100);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(
        `[${theme}] ${i + 1}/${routes.length} ${route} -> ${fileName}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown capture error";
      failures.push({ theme, route, error: message });
      console.error(`[${theme}] FAIL ${route}: ${message}`);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
    }
  }
}

async function main() {
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });

  const routes = await collectRoutes();
  const failures = [];

  const metaPath = path.join(OUTPUT_ROOT, "capture-meta.json");
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        viewport: VIEWPORT,
        themes: THEMES,
        routeCount: routes.length,
        routes,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Themes: ${THEMES.join(", ")}`);
  console.log(`Routes: ${routes.length}`);
  console.log(`Output: ${OUTPUT_ROOT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const theme of THEMES) {
      await captureTheme(browser, theme, routes, failures);
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(OUTPUT_ROOT, "capture-report.json");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        themes: THEMES,
        totalRoutes: routes.length,
        totalExpectedScreenshots: routes.length * THEMES.length,
        failures,
        failedCount: failures.length,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (failures.length > 0) {
    console.error(`Capture finished with ${failures.length} failures.`);
    process.exitCode = 1;
  } else {
    console.log("Capture finished successfully with no failures.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
