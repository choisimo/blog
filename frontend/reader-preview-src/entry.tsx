import "virtual:reader-memo";
import archive from "virtual:reader-archive";
import { installArchive } from "./archive";
import { initializeDesign } from "./state";

installArchive(archive);
initializeDesign();
if (!location.hash.startsWith("#/")) {
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#/blog/2026/current-crowd`,
  );
}
// Only supply a language when there is no existing preference.
try {
  if (!localStorage.getItem("site.language"))
    localStorage.setItem("site.language", "ko");
} catch {
  /* storage may be unavailable */
}
void import("@/main").then(({ mountApp }) => mountApp());
void import("./PreviewControls").then(({ mountPreviewControls }) =>
  mountPreviewControls(),
);
