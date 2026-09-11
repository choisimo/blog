import { useSyncExternalStore } from "react";
export const designs = [
  ["원본 그대로", "실제 게시글 · 기존 레이아웃"],
  ["문단 속 집중", "질문 한 개에 집중하는 인라인 카드"],
  ["나란히 탐구", "본문 옆에 머무는 읽기 인스펙터"],
  ["질문 색인", "질문 목록과 상세를 나란히 탐색"],
  ["생각의 단계", "이전·다음으로 이어가는 순차 탐색"],
  ["이어지는 대화", "질문과 응답을 따라가는 대화 흐름"],
  ["관점 보드", "모든 질문을 병렬로 비교하는 보드"],
  ["사고의 경로", "질문을 따라 내려가는 세로 타임라인"],
  ["읽고 기록하기", "질문 옆에 내 생각을 기록하는 노트"],
  ["본문 위 시트", "본문을 유지하는 하단 탐색 시트"],
  ["원문과 근거", "원문·질문·근거를 구획으로 나눈 대조형"],
] as const;
let design = 1;
const listeners = new Set<() => void>();
export function initializeDesign() {
  const candidate = new URLSearchParams(location.search).get("design");
  const value = Number(
    candidate ?? document.documentElement.dataset.readerDesign ?? 1,
  );
  design = Number.isInteger(value) && value >= 0 && value <= 10 ? value : 1;
  document.documentElement.dataset.readerDesign = String(design);
}
export function setDesign(next: number) {
  if (!Number.isInteger(next) || next < 0 || next > 10) return;
  design = next;
  document.documentElement.dataset.readerDesign = String(next);
  const params = new URLSearchParams(location.search);
  params.set("design", String(next));
  history.replaceState(
    null,
    "",
    `${location.pathname}?${params}${location.hash}`,
  );
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useReaderDesign() {
  return useSyncExternalStore(subscribe, () => design);
}
