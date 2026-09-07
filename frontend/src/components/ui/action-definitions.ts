/** Names describe the action, not its icon. No API capabilities are advertised here. */
export const UI_ACTIONS = {
  heading: { label: '제목 삽입', kind: 'command' },
  bold: { label: '굵게 적용', kind: 'command' },
  italic: { label: '기울임 적용', kind: 'command' },
  quote: { label: '인용문 삽입', kind: 'command' },
  list: { label: '목록 삽입', kind: 'command' },
  code: { label: '코드 블록 삽입', kind: 'command' },
  link: { label: '링크 삽입', kind: 'command' },
  attachImage: { label: '이미지 첨부', kind: 'command' },
  close: { label: '닫기', kind: 'command' },
  viewList: { label: '전체 목록', kind: 'toggle' },
  viewFocus: { label: '연결 보기', kind: 'toggle' },
  viewMap: { label: '전체 지도', kind: 'toggle' },
  zoomOut: { label: '지도 축소', kind: 'command' },
  resetView: { label: '배율과 위치 초기화 · 검색 조건 유지', kind: 'command' },
  zoomIn: { label: '지도 확대', kind: 'command' },
  stackGrid: { label: '작업 목록 카드 보기', kind: 'toggle' },
  expandStack: { label: '작업 목록 펼치기', kind: 'disclosure' },
  pinStack: { label: '선택 항목 고정', kind: 'command' },
  clearStack: { label: '작업 목록 비우기', kind: 'command' },
} as const satisfies Record<string, { label: string; kind: 'command' | 'toggle' | 'disclosure' }>;

export type ActionId = keyof typeof UI_ACTIONS;
export type ActionKind = (typeof UI_ACTIONS)[ActionId]['kind'];
export type ActionIdOfKind<K extends ActionKind> = {
  [A in ActionId]: (typeof UI_ACTIONS)[A]['kind'] extends K ? A : never
}[ActionId];
