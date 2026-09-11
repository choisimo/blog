"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const STORAGE_KEY = "fieldnotes-reading-designs-v1";
  const frame = $("#preview-frame");
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    /* Storage can be blocked in private browsing. */
  }
  const states =
    saved.states &&
    typeof saved.states === "object" &&
    !Array.isArray(saved.states)
      ? saved.states
      : {};
  let chosen =
    Number.isInteger(saved.chosen) && saved.chosen >= 1 && saved.chosen <= 10
      ? saved.chosen
      : null;
  let current = 1;
  let device = "desktop";
  let toastTimer;
  let saveTimer;
  let overviewBuilt = false;
  const thumbnailSizer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const child = entry.target.querySelector("iframe");
      if (child)
        child.style.transform = `scale(${entry.contentRect.width / 1000})`;
    }
  });
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chosen, states }));
      return true;
    } catch {
      return false;
    }
  }
  function notify(message) {
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3000);
  }
  function mini(d) {
    return `<span class="mini mini-${d.id}" style="--mini-bg:${d.bg};--mini-ink:${d.color}" aria-hidden="true"><i></i><i></i><i></i></span>`;
  }
  function renderCatalog() {
    $("#design-list").innerHTML = DESIGNS.map(
      (d) =>
        `<button class="design-option" data-design="${d.id}" aria-current="${d.id === current}" aria-label="${d.id}. ${d.name}, ${d.tag}${d.id === chosen ? ", 선택됨" : ""}">${mini(d)}<span><span class="option-title"><span class="option-num">${String(d.id).padStart(2, "0")}</span>${d.name}</span><span class="option-subtitle">${d.family}</span></span>${d.id === chosen ? '<span class="option-saved" aria-hidden="true">✓</span>' : ""}</button>`,
    ).join("");
  }
  function updateSelection() {
    const selected = chosen === current;
    $("#choose-button").textContent = selected
      ? "✓ 선택한 디자인"
      : "이 디자인 선택";
    $("#choose-button").setAttribute("aria-pressed", String(selected));
    $("#selection-status").textContent = chosen
      ? `선택한 디자인: ${String(chosen).padStart(2, "0")} ${DESIGNS[chosen - 1].name} · 다른 안을 선택하면 변경됩니다.`
      : "마음에 드는 디자인을 선택해 두세요.";
    $$(".overview-card").forEach((el) => {
      const selected = Number(el.dataset.design) === chosen;
      el.dataset.selected = String(selected);
      el.querySelector("button").setAttribute("aria-pressed", String(selected));
    });
  }
  function parseHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const id = Number(params.get("design"));
    return {
      id: Number.isInteger(id) && id >= 1 && id <= 10 ? id : 1,
      device: params.get("device") === "mobile" ? "mobile" : "desktop",
    };
  }
  function applyDevice(value) {
    device = value;
    $("#preview-stage").classList.toggle("mobile", device === "mobile");
    $$("[data-device]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.device === device)),
    );
  }
  function setHash() {
    const hash = `design=${current}${device === "mobile" ? "&device=mobile" : ""}`;
    if (location.hash !== "#" + hash) location.hash = hash;
  }
  function showDesign(id, setUrl = true) {
    const next = DESIGNS.find((d) => d.id === id) || DESIGNS[0];
    current = next.id;
    $("#design-kicker").textContent =
      `${String(current).padStart(2, "0")} / ${next.en} · ${next.tag}`;
    $("#design-title").textContent = next.name;
    $("#design-description").textContent = next.description;
    $("#page-number").textContent = `${String(current).padStart(2, "0")} / 10`;
    $("#design-rationale").innerHTML = next.benefits
      .map((item, i) => {
        const [title, body] = item.split("|");
        return `<div class="rationale-item"><b><span>0${i + 1}</span>${title}</b>${body}</div>`;
      })
      .join("");
    frame.title = `${String(current).padStart(2, "0")} ${next.name} — 인터랙티브 프리뷰`;
    frame.srcdoc = makePreview(current, states[current] || {});
    renderCatalog();
    updateSelection();
    if (setUrl) setHash();
    if (matchMedia("(max-width:760px)").matches) {
      const active = $(`.design-option[data-design="${current}"]`);
      const list = $("#design-list");
      list.scrollLeft = active.offsetLeft - list.offsetLeft;
    }
  }
  function buildOverview() {
    if (overviewBuilt) return;
    overviewBuilt = true;
    const grid = $("#overview-grid");
    DESIGNS.forEach((d) => {
      const card = document.createElement("article");
      card.className = "overview-card";
      card.dataset.design = d.id;
      card.dataset.selected = String(d.id === chosen);
      card.innerHTML = `<div class="overview-picture" aria-hidden="true"></div><button class="overview-caption" aria-label="${d.id}. ${d.name} 프리뷰 열기" aria-pressed="${d.id === chosen}"><span>${d.tag}</span><strong>${String(d.id).padStart(2, "0")} ${d.name}</strong><p>${d.family}</p></button>`;
      const thumbnail = document.createElement("iframe");
      thumbnail.title = `${d.name} 축소 미리보기`;
      thumbnail.tabIndex = -1;
      thumbnail.setAttribute("sandbox", "");
      thumbnail.setAttribute("scrolling", "no");
      thumbnail.srcdoc = makePreview(d.id).replace(
        /<script>[\s\S]*?<\/script>/,
        "",
      );
      card.querySelector(".overview-picture").append(thumbnail);
      grid.append(card);
      thumbnailSizer.observe(card.querySelector(".overview-picture"));
    });
  }
  $("#design-list").addEventListener("click", (e) => {
    const button = e.target.closest("[data-design]");
    if (button) {
      showDesign(Number(button.dataset.design));
      $(`.design-option[data-design="${current}"]`).focus({
        preventScroll: true,
      });
    }
  });
  $("#choose-button").addEventListener("click", () => {
    chosen = current;
    const persisted = persist();
    renderCatalog();
    updateSelection();
    notify(
      `${String(current).padStart(2, "0")} ${DESIGNS[current - 1].name}${persisted ? " 디자인을 저장했습니다." : " 디자인을 선택했습니다. 이 탭에서 유지됩니다."}`,
    );
  });
  $("#previous").addEventListener("click", () =>
    showDesign(current === 1 ? 10 : current - 1),
  );
  $("#next").addEventListener("click", () =>
    showDesign(current === 10 ? 1 : current + 1),
  );
  $$("[data-device]").forEach((button) =>
    button.addEventListener("click", () => {
      applyDevice(button.dataset.device);
      setHash();
    }),
  );
  $("#overview-button").addEventListener("click", () => {
    buildOverview();
    $("#overview").showModal();
  });
  $("#close-overview").addEventListener("click", () => $("#overview").close());
  $("#overview-grid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-design]");
    if (card) {
      showDesign(Number(card.dataset.design));
      $("#overview").close();
      $("#workspace").focus({ preventScroll: true });
    }
  });
  $("#export-button").addEventListener("click", () => {
    const blob = new Blob([makePreview(current, {}, true)], {
      type: "text/html;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reading-design-${String(current).padStart(2, "0")}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("선택한 프리뷰를 독립 HTML 파일로 내려받습니다.");
  });
  window.addEventListener("hashchange", () => {
    const next = parseHash();
    applyDevice(next.device);
    if (next.id !== current) showDesign(next.id, false);
  });
  window.addEventListener("message", (event) => {
    if (
      event.source !== frame.contentWindow ||
      event.data?.type !== "reading-preview-state" ||
      event.data.id !== current
    )
      return;
    const incoming = event.data.state;
    if (!incoming || typeof incoming !== "object") return;
    states[current] = {
      question:
        Number.isInteger(incoming.question) &&
        incoming.question >= 0 &&
        incoming.question < 3
          ? incoming.question
          : 0,
      note:
        typeof incoming.note === "string" ? incoming.note.slice(0, 5000) : "",
      bookmarked: incoming.bookmarked === true,
      verdict:
        typeof incoming.verdict === "string"
          ? incoming.verdict.slice(0, 100)
          : "",
      draft:
        typeof incoming.draft === "string" ? incoming.draft.slice(0, 500) : "",
    };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const persisted = persist();
      frame.contentWindow.postMessage(
        { type: "reading-save-result", persisted },
        "*",
      );
    }, 160);
  });
  window.addEventListener("pagehide", persist);
  const initial = parseHash();
  applyDevice(initial.device);
  showDesign(initial.id, false);
})();
