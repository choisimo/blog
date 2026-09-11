import { build } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const source = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(source, "..");
const outDir = path.resolve(frontend, "../design-previews/reading-page");
process.chdir(frontend);
const publicRoot = path.join(frontend, "public");
const configSource =
  process.env.READER_PUBLIC_CONFIG_FILE ||
  path.join(source, "public-config.json");
const configPayload = JSON.parse(await fs.readFile(configSource, "utf8"));
const publicConfig = configPayload.data ?? configPayload;
if (!publicConfig.apiBaseUrl || !publicConfig.siteBaseUrl)
  throw new Error("Verified public runtime config is required");
const textPaths = [
  "/posts-manifest.json",
  "/posts/2026/current-crowd.md",
  "/posts/2026/manifest.json",
];
const textAssets = Object.fromEntries(
  await Promise.all(
    textPaths.map(async (name) => [
      name,
      await fs.readFile(path.join(publicRoot, name), "utf8"),
    ]),
  ),
);
const imageAssets = {};
for (const name of [
  "/images/2026/무속-사이비.png",
  "/images/2026/무속-사이비.thumb.webp",
]) {
  imageAssets[name] =
    `data:image/${name.endsWith(".webp") ? "webp" : "png"};base64,${(await fs.readFile(path.join(publicRoot, name))).toString("base64")}`;
}
const archive = { publicConfig, textAssets, imageAssets };
let memoSource = await fs.readFile(
  path.join(publicRoot, "ai-memo/ai-memo.js"),
  "utf8",
);
for (const [name, mime] of [
  ["anonymous-session.js", "text/javascript"],
  ["ai-memo.css", "text/css"],
  ["memo-workspace.css", "text/css"],
]) {
  const asset = await fs.readFile(path.join(publicRoot, "ai-memo", name));
  const literal = "/ai-memo/" + name + "?v=${AI_MEMO_ASSET_VERSION}";
  memoSource = memoSource.replaceAll(
    literal,
    `data:${mime};base64,${asset.toString("base64")}`,
  );
}

let adaptedApp = false,
  adaptedPanel = false;
await build({
  configFile: false,
  root: frontend,
  base: "./",
  envDir: false,
  publicDir: false,
  define: {
    "import.meta.env.VITE_SITE_BASE_URL": JSON.stringify(
      publicConfig.siteBaseUrl,
    ),
  },
  resolve: {
    alias: {
      "@": path.join(frontend, "src"),
      "@reader-preview": source,
      zod: path.join(frontend, "node_modules/zod/index.js"),
    },
  },
  css: { postcss: path.join(frontend, "config/postcss.config.js") },
  plugins: [
    {
      name: "actual-reader-preview-adapter",
      enforce: "pre",
      resolveId(id) {
        if (id === "virtual:reader-archive") return "\0reader-archive";
        if (id === "virtual:reader-memo") return "\0reader-memo";
      },
      load(id) {
        if (id === "\0reader-memo") return memoSource;
        if (id === "\0reader-archive")
          return `export default ${JSON.stringify(archive)};`;
      },
      transform(code, id) {
        if (id === path.join(frontend, "src/App.tsx")) {
          if (!code.includes("BrowserRouter as Router"))
            throw new Error("App router contract changed");
          adaptedApp = true;
          return code.replace(
            "BrowserRouter as Router",
            "HashRouter as Router",
          );
        }
        if (
          id ===
          path.join(frontend, "src/components/features/sentio/SparkInline.tsx")
        ) {
          const marker = "        <div\n          id={`${panelId}-result`}";
          if (!code.includes(marker))
            throw new Error("SparkInline panel contract changed");
          adaptedPanel = true;
          return (
            "import { ReaderPanelTools } from '@reader-preview/ReaderPanelTools';\n" +
            code.replace(
              marker,
              "        <ReaderPanelTools panelId={panelId} paragraph={text} open={open} mode={activeMode} />\n" +
                marker,
            )
          );
        }
      },
      buildEnd(error) {
        if (!error && (!adaptedApp || !adaptedPanel))
          throw new Error("Expected reader adapters were not applied");
      },
    },
    react(),
  ],
  build: {
    outDir,
    emptyOutDir: false,
    copyPublicDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 18000,
    rollupOptions: {
      input: path.join(source, "index.html"),
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/reader.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
const builtHtml = await fs.readFile(
  path.join(outDir, "reader-preview-src/index.html"),
  "utf8",
);
const layoutCSS = await fs.readFile(
  path.join(source, "reader-layouts.css"),
  "utf8",
);
await fs.writeFile(path.join(outDir, "reader-layouts.css"), layoutCSS);
const html = builtHtml
  .replaceAll("../assets/", "./assets/")
  .replace(
    "</head>",
    '<link rel="stylesheet" href="./reader-layouts.css"></head>',
  );
const names = [
  "original",
  "focus",
  "inspector",
  "index",
  "steps",
  "conversation",
  "board",
  "path",
  "notebook",
  "sheet",
  "evidence",
];
for (let i = 0; i <= 10; i++) {
  const page = html.replace(
    /data-reader-design="\d+"/,
    `data-reader-design="${i}"`,
  );
  await fs.writeFile(
    path.join(
      outDir,
      i === 0
        ? "original.html"
        : `${String(i).padStart(2, "0")}-${names[i]}.html`,
    ),
    page,
  );
}
await fs.writeFile(path.join(outDir, "index.html"), html);
await fs.writeFile(
  path.join(outDir, "public-config.json"),
  JSON.stringify(publicConfig, null, 2),
);
const js = await fs.readFile(path.join(outDir, "assets/reader.js"), "utf8");
const css = await fs.readFile(path.join(outDir, "assets/style.css"), "utf8");
const scriptData = Buffer.from(js).toString("base64");
const standalone = html
  .replace(
    /<script\b[^>]*src="\.\/assets\/reader.js"[^>]*><\/script>/,
    `<script type="module" src="data:text/javascript;base64,${scriptData}"></script>`,
  )
  .replace(
    /<link\b[^>]*href="\.\/assets\/style.css"[^>]*>/,
    () => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
  );
const portable = standalone.replace(
  '<link rel="stylesheet" href="./reader-layouts.css">',
  () => `<style>${layoutCSS}</style>`,
);
await fs.writeFile(path.join(outDir, "reader-all-designs.html"), portable);
await fs.writeFile(
  path.join(outDir, "reader-original.html"),
  portable.replace(/data-reader-design="\d+"/, 'data-reader-design="0"'),
);
await fs.copyFile(
  path.join(source, "serve.mjs"),
  path.join(outDir, "serve.mjs"),
);
await fs.cp(path.join(publicRoot, "ai-memo"), path.join(outDir, "ai-memo"), {
  recursive: true,
});
await fs.rm(path.join(outDir, "reader-preview-src"), {
  recursive: true,
  force: true,
});
console.log(
  `Actual reader built: ${outDir} (original + 10 variants + two standalone HTML exports)`,
);
