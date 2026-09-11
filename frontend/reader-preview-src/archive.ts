type Archive = {
  publicConfig: Record<string, unknown>;
  textAssets: Record<string, string>;
  imageAssets: Record<string, string>;
};
export function installArchive(archive: Archive) {
  // HTML entrypoints use hash routing; native in-page anchors must keep that route.
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
        : null;
    const href = link?.getAttribute("href");
    if (
      !href ||
      href.startsWith("#/") ||
      link?.target === "_blank" ||
      link?.hasAttribute("download")
    )
      return;
    let id: string;
    try {
      id = decodeURIComponent(href.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    target.focus({ preventScroll: true });
  });
  const online =
    location.protocol === "http:" || location.protocol === "https:";
  const runtime = {
    ...archive.publicConfig,
    ...(online
      ? { apiBaseUrl: location.origin, chatBaseUrl: location.origin }
      : {}),
  };
  Object.assign(window, { APP_CONFIG: runtime });
  const originalFetch = window.fetch.bind(window);
  // Resolve actual packaged static files. API traffic always uses the original fetch.
  window.fetch = async (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    let url: URL;
    try {
      url = new URL(raw, location.href);
    } catch {
      return originalFetch(input, init);
    }
    const local = url.origin === location.origin || url.protocol === "file:";
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    let pathname = decodeURI(url.pathname);
    const known = Object.keys(archive.textAssets).find((key) =>
      pathname.endsWith(key),
    );
    if (local && method === "GET" && known)
      return new Response(archive.textAssets[known], {
        status: 200,
        headers: {
          "Content-Type": known.endsWith(".json")
            ? "application/json"
            : "text/markdown;charset=utf-8",
        },
      });
    if (local && method === "GET" && pathname.endsWith("/runtime-config.json"))
      return Response.json(runtime);
    return originalFetch(input, init);
  };
  // Native image and lightbox components keep their events; only asset URLs resolve locally.
  const resolveImages = () => {
    document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      let pathname: string;
      try {
        pathname = decodeURI(new URL(src, location.href).pathname);
      } catch {
        return;
      }
      const key = Object.keys(archive.imageAssets).find((key) =>
        pathname.endsWith(key),
      );
      if (key) {
        image.src = archive.imageAssets[key];
        image.removeAttribute("srcset");
      }
    });
  };
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      resolveImages();
    });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset"],
  });
}
