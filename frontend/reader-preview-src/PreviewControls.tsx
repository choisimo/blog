import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { useFeatureFlagsStore } from "@/stores/runtime/useFeatureFlagsStore";
import { designs, setDesign, useReaderDesign } from "./state";
function PreviewControls() {
  const design = useReaderDesign();
  const flags = useFeatureFlagsStore((s) => s.flags);
  const [collapsed, setCollapsed] = useState(false);
  const [saved, setSaved] = useState<number | null>(() => {
    try {
      const n = Number(localStorage.getItem("reader-page:selected-design"));
      return n >= 1 && n <= 10 ? n : null;
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState("");
  const [opening, setOpening] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const openingTimer = useRef<ReturnType<typeof setTimeout>>();
  const pollTimer = useRef<ReturnType<typeof setInterval>>();
  useEffect(
    () => () => {
      clearTimeout(openingTimer.current);
      clearInterval(pollTimer.current);
    },
    [],
  );
  function choose(value: number) {
    // Fixed regions have one active owner. Closing uses the original React event.
    if ([2, 9].includes(value)) {
      const panels = [
        ...document.querySelectorAll<HTMLElement>(
          ".sentio-panel:not([hidden])",
        ),
      ];
      panels
        .slice(0, -1)
        .forEach((panel) =>
          panel
            .querySelector<HTMLButtonElement>(
              '.sentio-panel-header button[aria-label="닫기"]',
            )
            ?.click(),
        );
    }
    setDesign(value);
    dialog.current?.close();
  }
  function openAI() {
    const existing = document.querySelector<HTMLElement>(
      ".sentio-panel:not([hidden])",
    );
    if (existing) {
      existing.scrollIntoView({ block: "center", behavior: "instant" });
      existing
        .querySelector<HTMLButtonElement>('[data-mode="chain"]')
        ?.focus({ preventScroll: true });
      return;
    }
    const trigger = document.querySelector<HTMLButtonElement>(
      "[data-reading-content] .sentio-trigger",
    );
    if (!trigger) {
      setStatus("본문을 불러온 뒤 다시 눌러주세요.");
      return;
    }
    trigger.click();
    setOpening(true);
    let attempts = 0;
    pollTimer.current = setInterval(() => {
      const panel = document.getElementById(
        trigger.getAttribute("aria-controls") || "",
      );
      const button = panel?.querySelector<HTMLButtonElement>(
        '.sentio-mode-card[data-mode="chain"]',
      );
      if (button) {
        clearInterval(pollTimer.current);
        button.click();
        setOpening(false);
        setTimeout(
          () => panel?.scrollIntoView({ block: "start", behavior: "instant" }),
          100,
        );
      } else if (++attempts > 30) {
        clearInterval(pollTimer.current);
        setOpening(false);
        setStatus("문단의 반짝이 버튼을 눌러주세요.");
      }
    }, 50);
  }
  return (
    <>
      <div
        className={`rp-switcher ${collapsed ? "rp-collapsed" : ""}`}
        aria-label="게시글 디자인 선택"
      >
        <button
          className="rp-switcher-mark"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "디자인 선택 펼치기" : "디자인 선택 접기"}
        >
          N<span>읽기 디자인</span>
        </button>
        {!collapsed && (
          <>
            <div className="rp-select-group">
              <label htmlFor="reader-design-select">
                실제 게시글 · 원본 + 10개 레이아웃
              </label>
              <select
                id="reader-design-select"
                value={design}
                onChange={(e) => choose(Number(e.target.value))}
              >
                {designs.map(([title], index) => (
                  <option value={index} key={title}>
                    {String(index).padStart(2, "0")} {title}
                  </option>
                ))}
              </select>
            </div>
            <div className="rp-switcher-nav">
              <button
                onClick={() => choose(design === 0 ? 10 : design - 1)}
                aria-label="이전 디자인"
              >
                ←
              </button>
              <button
                onClick={() => choose(design === 10 ? 0 : design + 1)}
                aria-label="다음 디자인"
              >
                →
              </button>
            </div>
            <button
              className="rp-original"
              onClick={() => choose(design === 0 ? saved || 1 : 0)}
              aria-pressed={design === 0}
            >
              {design === 0 ? "변경안 보기" : "원본 비교"}
            </button>
            <button
              className="rp-browse"
              onClick={() => dialog.current?.showModal()}
            >
              10개 보기
            </button>
            <button className="rp-go-ai" onClick={openAI} disabled={opening}>
              {opening ? "패널 여는 중…" : "문단 AI 살펴보기 ↗"}
            </button>
            <button
              className="rp-save"
              disabled={design === 0}
              aria-pressed={saved === design}
              onClick={() => {
                setSaved(design);
                try {
                  localStorage.setItem(
                    "reader-page:selected-design",
                    String(design),
                  );
                  setStatus(
                    `${String(design).padStart(2, "0")} ${designs[design][0]} 선택을 저장했습니다.`,
                  );
                } catch {
                  setStatus("선택한 디자인은 현재 탭에서 유지됩니다.");
                }
              }}
            >
              {saved === design ? "✓ 선택됨" : "이 디자인 선택"}
            </button>
          </>
        )}
      </div>
      <div className="rp-live-info" hidden={collapsed}>
        <span className={flags.aiEnabled ? "rp-online" : "rp-offline"}></span>
        {location.protocol === "file:"
          ? "AI 연결은 로컬 서버에서 이용할 수 있습니다."
          : flags.aiEnabled
            ? "기존 AI 서비스 연결 · 실제 본문으로 질문합니다."
            : "현재 서비스 설정에서 AI가 비활성화되어 있습니다."}
      </div>
      {status && (
        <div className="rp-selection-status" role="status">
          <span>{status}</span>
          <button onClick={() => setStatus("")} aria-label="선택 안내 닫기">
            ×
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="rp-design-dialog"
        aria-labelledby="rp-dialog-title"
      >
        <header>
          <div>
            <span>같은 게시글, 다른 읽기 방식</span>
            <h2 id="rp-dialog-title">실제 읽기 페이지에서 비교하세요.</h2>
            <p>
              본문, 목차, 이미지와 AI 연결은 유지됩니다. 디자인을 바꿔도 작성
              중인 질문은 남습니다.
            </p>
          </div>
          <button
            onClick={() => dialog.current?.close()}
            aria-label="디자인 목록 닫기"
          >
            ×
          </button>
        </header>
        <div className="rp-design-grid">
          {designs.slice(1).map(([title, description], index) => (
            <button
              key={title}
              aria-pressed={design === index + 1}
              onClick={() => choose(index + 1)}
            >
              <span
                className={`rp-diagram rp-diagram-${index + 1}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
              </span>
              <b>
                <small>{String(index + 1).padStart(2, "0")}</small>
                {title}
                {saved === index + 1 ? " ✓" : ""}
              </b>
              <p>{description}</p>
            </button>
          ))}
        </div>
        <footer>
          <button onClick={() => choose(0)}>00 기존 게시글 원본 보기 →</button>
          <span>원문: 무속, 사이비 : 자유의 환상과 개인화의 비극</span>
        </footer>
      </dialog>
    </>
  );
}
export function mountPreviewControls() {
  const root = document.getElementById("reader-design-controls");
  if (root) createRoot(root).render(<PreviewControls />);
}
