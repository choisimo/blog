import { useEffect, useId, useRef, useState } from "react";
import { useReaderDesign } from "./state";

type CardItem = { id: string; title: string };
function noteKey(text: string) {
  let hash = 2166136261;
  for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `reader-design-note:${(hash >>> 0).toString(16)}`;
}
export function ReaderPanelTools({
  panelId,
  paragraph,
  open,
  mode,
}: {
  panelId: string;
  paragraph: string;
  open: boolean;
  mode: string;
}) {
  const design = useReaderDesign();
  const host = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [note, setNote] = useState("");
  const [noteStatus, setNoteStatus] = useState("이 브라우저에 저장");
  const inputId = useId();
  useEffect(() => {
    try {
      setNote(localStorage.getItem(noteKey(paragraph)) || "");
    } catch {
      setNoteStatus("현재 탭에서만 유지");
    }
  }, [paragraph]);
  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (!panel || !open) return;
    let task = 0;
    const update = () => {
      const nodes = [...panel.querySelectorAll<HTMLElement>(".sentio-thought")];
      const next = nodes.map((node, index) => ({
        id: node.dataset.cardId || String(index),
        title:
          node.querySelector(":scope > h3")?.textContent ||
          node.querySelector(".sentio-exploration-question")?.textContent ||
          `질문 ${index + 1}`,
      }));
      setCards((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
      nodes.forEach((node) => {
        const title = node.querySelector(":scope > h3")?.textContent?.trim();
        const body = node
          .querySelector(":scope > .sentio-thought-body")
          ?.textContent?.trim();
        node.querySelectorAll<HTMLElement>(":scope > ul > li").forEach((li) => {
          li.dataset.readerRepeat = String(
            li.textContent?.trim() === title || li.textContent?.trim() === body,
          );
        });
        const subtitle = node.querySelector<HTMLElement>(
          ":scope > .sentio-thought-subtitle",
        );
        if (subtitle)
          subtitle.dataset.readerInternal = String(
            /fallback/i.test(subtitle.textContent || ""),
          );
        const topic = node.querySelector<HTMLElement>(".sentio-thought-topic");
        if (topic)
          topic.dataset.readerInternal = String(
            /fallback|thought \d/i.test(topic.textContent || ""),
          );
        const tags = node.querySelector<HTMLElement>(
          ":scope > .sentio-thought-tags",
        );
        if (tags)
          tags.dataset.readerInternal = String(
            /fallback/.test(tags.textContent || ""),
          );
      });
    };
    update();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(task);
      task = requestAnimationFrame(update);
    });
    observer.observe(panel, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      cancelAnimationFrame(task);
      observer.disconnect();
    };
  }, [panelId, open, mode]);
  const active = Math.min(selected, Math.max(0, cards.length - 1));
  useEffect(() => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.dataset.readerReady = "true";
    panel.dataset.readerCount = String(cards.length);
    panel
      .querySelectorAll<HTMLElement>(".sentio-thought")
      .forEach((node, index) => {
        node.dataset.readerSelected = String(index === active);
      });
  }, [panelId, cards, active, design]);
  function select(index: number) {
    setSelected(index);
    if ([5, 6, 7].includes(design)) {
      const target = document
        .getElementById(panelId)
        ?.querySelectorAll(".sentio-thought")[index];
      target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }
  if (design === 0) return null;
  return (
    <div ref={host} className="rp-panel-tools" data-mode={mode}>
      <details className="rp-source" open={[2, 8, 10].includes(design)}>
        <summary>함께 읽는 원문 문단</summary>
        <blockquote>{paragraph}</blockquote>
      </details>
      {mode === "chain" && cards.length > 0 && (
        <>
          <nav className="rp-question-nav" aria-label="이 문단의 질문 선택">
            <div className="rp-nav-heading">
              <strong>
                {design === 4
                  ? "생각을 이어가는 단계"
                  : "이 문단에서 이어지는 질문"}
              </strong>
              <span>
                {active + 1} / {cards.length}
              </span>
            </div>
            <div className="rp-question-options">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={index === active}
                  aria-label={`질문 ${index + 1}: ${card.title}`}
                  onClick={() => select(index)}
                >
                  <span className="rp-question-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rp-question-label">{card.title}</span>
                </button>
              ))}
            </div>
            <div className="rp-step-controls">
              <button
                type="button"
                disabled={active === 0}
                onClick={() => select(active - 1)}
              >
                ← 이전 질문
              </button>
              <span role="status">
                {active + 1} / {cards.length}
              </span>
              <button
                type="button"
                disabled={active === cards.length - 1}
                onClick={() => select(active + 1)}
              >
                다음 질문 →
              </button>
            </div>
          </nav>
          {design === 8 && (
            <section className="rp-note">
              <div>
                <strong>나의 읽기 노트</strong>
                <span role="status">{noteStatus}</span>
              </div>
              <label htmlFor={inputId}>이 문단을 읽고 떠오른 생각</label>
              <textarea
                id={inputId}
                value={note}
                maxLength={5000}
                placeholder="내 생각과 원문의 주장은 어떻게 다른가요?"
                onChange={(event) => {
                  const value = event.target.value;
                  setNote(value);
                  try {
                    localStorage.setItem(noteKey(paragraph), value);
                    setNoteStatus("저장됨");
                  } catch {
                    setNoteStatus("현재 탭에서만 유지");
                  }
                }}
              />
              <p>원문 문단별로 기록이 남습니다.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
