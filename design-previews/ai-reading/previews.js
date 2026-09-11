/* Self-contained preview documents: no network, libraries, or AI calls. */
"use strict";
const DESIGNS = [
  {
    id: 1,
    name: "조용한 집중",
    en: "THE FOCUS",
    family: "한 번에 하나의 질문",
    tag: "집중형",
    color: "#42604b",
    bg: "#eeeee2",
    description:
      "한 가지 질문과 하나의 다음 행동. 읽기의 호흡을 지키는 가장 간결한 구성.",
    benefits: [
      "명확한 우선순위|질문 → 근거 → 탐색의 순서로 시선을 자연스럽게 안내합니다.",
      "짧아진 행동 경로|질문 바로 아래에서 탐색을 시작하고, 상세 근거는 필요할 때 펼칩니다.",
      "이런 독자에게|복잡한 도구보다 글과 질문에 온전히 집중하고 싶은 독자.",
    ],
  },
  {
    id: 2,
    name: "나란히 읽기",
    en: "SIDE BY SIDE",
    family: "원문과 질문을 함께",
    tag: "본문 병렬형",
    color: "#3c5d80",
    bg: "#e6edf3",
    description:
      "왼쪽의 원문과 오른쪽의 질문을 연결해, 맥락을 잃지 않고 깊이 읽습니다.",
    benefits: [
      "맥락 유지|원문과 탐색을 동시에 보며 기억에 의존하지 않고 근거를 확인합니다.",
      "연결된 근거|강조된 문장을 누르면 해당 질문이 바로 선택됩니다.",
      "이런 독자에게|주장의 타당성을 원문과 대조하며 읽는 분석적인 독자.",
    ],
  },
  {
    id: 3,
    name: "질문의 서재",
    en: "QUESTION INDEX",
    family: "목록에서 빠르게 탐색",
    tag: "목록·상세형",
    color: "#4f5966",
    bg: "#eaedf1",
    description:
      "질문 목록을 훑고 필요한 항목만 깊게. 여러 관점을 오가는 탐색에 적합합니다.",
    benefits: [
      "빠른 스캔|질문의 종류와 내용을 목록에서 한 번에 파악합니다.",
      "선택과 상세 분리|목록 위치를 유지하면서 오른쪽에서 선택한 질문을 탐색합니다.",
      "이런 독자에게|질문을 순서대로 읽기보다 필요한 주제로 바로 이동하는 독자.",
    ],
  },
  {
    id: 4,
    name: "생각의 계단",
    en: "GUIDED JOURNEY",
    family: "이해에서 적용까지",
    tag: "단계형",
    color: "#936334",
    bg: "#f2eade",
    description:
      "이해하기, 의심하기, 적용하기. 생각을 확장하는 과정을 세 단계로 안내합니다.",
    benefits: [
      "예측 가능한 여정|전체 단계와 현재 위치가 보여 다음에 할 일이 명확합니다.",
      "작은 시작|한 단계씩 진행해 처음 탐색하는 독자의 선택 부담을 줄입니다.",
      "이런 독자에게|비판적으로 읽는 연습을 하거나 체계적인 안내가 필요한 독자.",
    ],
  },
  {
    id: 5,
    name: "이어지는 대화",
    en: "READ & REPLY",
    family: "질문에서 대화로",
    tag: "대화형",
    color: "#51695e",
    bg: "#e7eee9",
    description:
      "선택한 문장을 대화의 출발점으로. 후속 질문과 답변을 하나의 흐름에 쌓습니다.",
    benefits: [
      "대화의 연속성|질문과 예시 응답이 시간순으로 남아 사고 과정을 되짚기 쉽습니다.",
      "자유로운 진입|추천 질문을 누르거나 내 표현으로 바로 질문할 수 있습니다.",
      "이런 독자에게|정해진 순서보다 대화를 통해 이해를 넓혀가는 독자.",
    ],
  },
  {
    id: 6,
    name: "관점의 보드",
    en: "PERSPECTIVE BOARD",
    family: "세 관점을 한눈에",
    tag: "보드형",
    color: "#73583f",
    bg: "#eee8df",
    description:
      "근거, 반론, 적용을 나란히 펼쳐 놓고 가장 흥미로운 관점부터 시작합니다.",
    benefits: [
      "관점의 동등한 노출|첫 번째 질문에만 시선이 몰리지 않도록 세 관점을 병렬로 배치합니다.",
      "카드에서 바로 탐색|각 질문의 목적을 확인하고 원하는 관점을 선택합니다.",
      "이런 독자에게|폭넓게 발산하거나 토론할 거리를 빠르게 찾고 싶은 독자.",
    ],
  },
  {
    id: 7,
    name: "생각의 지도",
    en: "THOUGHT MAP",
    family: "질문 사이의 연결",
    tag: "지도형",
    color: "#88af9b",
    bg: "#273b33",
    description:
      "하나의 주장에서 뻗어 나오는 근거와 반론, 적용을 공간적인 관계로 이해합니다.",
    benefits: [
      "관계가 보이는 구조|중심 주장과 주변 질문의 연결을 선과 위치로 보여줍니다.",
      "관심 지점부터 탐색|지도의 질문을 누르면 아래 상세 영역에서 탐색을 이어갑니다.",
      "이런 독자에게|논리의 구조와 주제 사이의 연결을 시각적으로 파악하는 독자.",
    ],
  },
  {
    id: 8,
    name: "나만의 여백",
    en: "MARGIN NOTES",
    family: "읽기와 기록을 함께",
    tag: "노트형",
    color: "#847244",
    bg: "#f2efdf",
    description:
      "질문에 대한 나의 생각을 먼저 적고 AI의 관점과 비교하는 개인 독서 노트.",
    benefits: [
      "능동적인 읽기|답을 보기 전에 내 생각을 정리할 수 있는 기록 공간을 제공합니다.",
      "기록의 연속성|프리뷰 내에서 작성한 메모를 디자인 전환 후에도 유지합니다.",
      "이런 독자에게|읽으며 밑줄을 긋고 자기 언어로 생각을 남기는 독자.",
    ],
  },
  {
    id: 9,
    name: "손안의 읽기",
    en: "POCKET COMPANION",
    family: "본문 위에 가벼운 시트",
    tag: "모바일 시트형",
    color: "#69659b",
    bg: "#eae8f3",
    description:
      "본문을 배경으로 유지하고, 하단 시트에서 엄지손가락에 가까운 탐색을 제공합니다.",
    benefits: [
      "읽기로 쉬운 복귀|시트를 접으면 읽던 문맥이 그대로 드러납니다.",
      "모바일 우선 동선|질문 선택과 입력을 하단에 모아 손의 이동을 줄입니다.",
      "이런 독자에게|휴대폰으로 짧게 읽으며 궁금한 부분만 빠르게 확인하는 독자.",
    ],
  },
  {
    id: 10,
    name: "두 관점 사이",
    en: "THE COUNTERPOINT",
    family: "지지와 반론의 비교",
    tag: "비교형",
    color: "#496378",
    bg: "#e6edf0",
    description:
      "지지하는 근거와 반론을 동등하게 비교하고, 나의 판단을 남기는 균형 잡힌 읽기.",
    benefits: [
      "균형 잡힌 판단|하나의 질문에 대한 서로 다른 두 관점을 같은 높이에서 비교합니다.",
      "판단을 남기는 행동|각 관점을 검토한 후 내 입장을 선택하고 후속 질문을 이어갑니다.",
      "이런 독자에게|한 가지 답에 머무르지 않고 주장의 조건과 한계를 따져보는 독자.",
    ],
  },
];
const ICONS = {
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="m20 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  book: '<path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2V4Z"/>',
  link: '<path d="m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.9)"/>',
  layers:
    '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0l-1 2H9l-1-2Z"/>',
  expand: '<path d="M14 4h6v6m0-6-7 7M10 20H4v-6m0 6 7-7"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  send: '<path d="m4 12 16-8-6 16-3-7-7-1Zm7 1 9-9"/>',
  note: '<path d="M14 3H5v18h14V9M14 3v6h5l-5-6ZM8 13h8m-8 4h5"/>',
  chevron: '<path d="m8 4 8 8-8 8"/>',
  chevronDown: '<path d="m5 9 7 7 7-7"/>',
};
function icon(name) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
}
const QUESTIONS = [
  {
    label: "근거 살펴보기",
    short: "주장의 근거",
    title: "이 주장의 핵심 근거는 무엇인가요?",
    body: "빠른 답변이 깊은 이해로 이어진다는 전제부터 살펴보세요. 주장을 뒷받침하는 근거와 아직 확인이 필요한 부분을 구분하면 글이 더 선명해집니다.",
    hint: "답을 얻는 속도와 이해의 깊이는 같은 것일까요?",
    prompt: "이 주장을 뒷받침하는 근거를 정리해 줘",
    kind: "이해하기",
  },
  {
    label: "다른 관점 보기",
    short: "가능한 반론",
    title: "반대의 입장에서는 어떻게 볼 수 있을까요?",
    body: "답을 빠르게 얻으면 오히려 질문할 시간이 늘어날 수도 있습니다. 이 주장이 성립하지 않는 상황을 떠올리고, 다른 설명의 가능성을 열어두세요.",
    hint: "도구가 생각을 대신할 때와 도울 때는 어떻게 다를까요?",
    prompt: "이 주장에 대한 반론과 한계를 알려 줘",
    kind: "의심하기",
  },
  {
    label: "내 경험에 연결",
    short: "현실에 적용",
    title: "이 생각을 내 일상에 어떻게 적용할까요?",
    body: "최근 AI로 답을 찾았던 순간을 떠올려보세요. 답을 읽기 전에 내 생각을 한 줄 적거나, 답변에 후속 질문을 던지는 작은 실험부터 시작할 수 있습니다.",
    hint: "다음번에 AI를 사용할 때 어떤 질문을 먼저 해볼까요?",
    prompt: "일상에서 해볼 수 있는 작은 실험을 제안해 줘",
    kind: "적용하기",
  },
];
const PREVIEW_CSS = `
:root {
  --ink: #283e33;
  --muted: #677368;
  --accent: #3f634c;
  --soft: #eaf0e5;
  --paper: #fcfbf7;
  --surface: #fff;
  --line: #dedfd5;
  --warm: #f0ede3;
  --serif: "Noto Serif CJK KR", "Batang", Georgia, serif;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family:
    Inter, "Noto Sans CJK KR", "Apple SD Gothic Neo", "Malgun Gothic",
    sans-serif;
  color: var(--ink);
  background: var(--paper);
  font-synthesis: none;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-width: 280px;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-size: 13px;
  line-height: 1.7;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
button,
input,
textarea {
  font: inherit;
}
button {
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
  min-height: 44px;
  touch-action: manipulation;
  transition:
    background 0.15s,
    transform 0.15s var(--ease);
}
button:hover {
  background: var(--soft);
}
button:active {
  transform: translateY(1px);
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: 3px solid #b6894b;
  outline-offset: 3px;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1,
h2,
h3 {
  font-weight: 600;
  letter-spacing: -0.04em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
p {
  overflow-wrap: anywhere;
}
h2 {
  font-size: 27px;
  line-height: 1.6;
}
h3 {
  font-size: 16px;
}
svg {
  flex-shrink: 0;
}
a {
  color: inherit;
}
button svg {
  vertical-align: middle;
}
input,
textarea {
  min-width: 0;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 14px;
  font-size: 12px;
}
input::placeholder,
textarea::placeholder {
  color: var(--muted);
}
textarea {
  resize: vertical;
  width: 100%;
}
.muted {
  color: var(--muted);
}
.small {
  font-size: 11px;
}
.overline {
  font-size: 10px;
  letter-spacing: 1.5px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
}
.serif {
  font-family: var(--serif);
  font-weight: 400;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
}
.brand > svg {
  color: var(--accent);
}
.p-header {
  min-height: 69px;
  padding: 12px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}
.demo {
  font-size: 9px;
  letter-spacing: 0.3px;
  color: var(--muted);
  border: 1px solid var(--line);
  padding: 3px 7px;
  border-radius: 4px;
  white-space: nowrap;
}
.icon-btn {
  display: inline-grid;
  place-items: center;
  min-width: 44px;
  height: 44px;
  border-radius: 7px;
}
.modes {
  display: flex;
  gap: 6px;
  align-items: center;
}
.modes button {
  padding: 0 13px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--muted);
}
.modes button[aria-pressed="true"] {
  color: var(--accent);
  background: var(--soft);
  font-weight: 600;
}
.modes svg {
  width: 16px;
  height: 16px;
}
.mode-row {
  padding: 14px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.mode-row > span {
  font-size: 10px;
  color: var(--muted);
}
.btn {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 18px;
  border: 1px solid var(--line);
  border-radius: 7px;
  font-size: 12px;
  background: var(--surface);
  line-height: 1.5;
}
.btn.primary {
  color: var(--paper);
  background: var(--accent);
  border-color: var(--accent);
}
.btn.primary:hover {
  filter: brightness(0.9);
}
.btn svg {
  width: 16px;
  height: 16px;
}
.text-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 9px;
  font-size: 11px;
  border-radius: 5px;
}
.text-btn svg {
  width: 15px;
  height: 15px;
}
.pill {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--soft);
  color: var(--accent);
  display: inline-block;
}
.divider {
  height: 1px;
  background: var(--line);
  margin: 24px 0;
}
.source {
  border-left: 2px solid #a2ae8b;
  padding: 9px 16px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
  background: var(--warm);
}
.source strong {
  display: block;
  font-weight: 500;
  color: var(--ink);
  margin-top: 5px;
}
.q-body {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.95;
  max-width: 60ch;
}
.q-hint {
  font-size: 12px;
  color: var(--ink);
  line-height: 1.8;
  padding: 15px 17px;
  background: var(--soft);
  border-radius: 7px;
}
.question-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 17px;
}
.question-meta > .overline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.number {
  font-size: 10px;
  color: var(--accent);
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line);
  border-radius: 50%;
  font-family: Arial, sans-serif;
}
.question-block h2 {
  margin-bottom: 14px;
}
.question-block .q-hint {
  margin-top: 20px;
}
.composer {
  margin-top: 22px;
}
.composer label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 8px;
}
.composer-row {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 5px;
  border-radius: 8px;
  gap: 4px;
}
.composer-row:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.composer input {
  flex: 1;
  min-width: 0;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  outline: none;
  background: transparent;
}
.composer input:focus-visible {
  outline: none;
}
.composer .send {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 5px;
  background: var(--accent);
  color: var(--paper);
  display: grid;
  place-items: center;
}
.composer .send svg {
  width: 17px;
  height: 17px;
}
.composer-foot {
  font-size: 9px;
  color: var(--muted);
  margin-top: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.answer {
  margin-top: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
  background: var(--soft);
  font-size: 12px;
}
.answer p {
  margin-top: 8px;
  line-height: 1.9;
}
.answer .answer-question {
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 9px;
}
.answer[hidden],
[hidden] {
  display: none !important;
}
.support {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  font-size: 10px;
  color: var(--muted);
}
.progress-dots {
  display: flex;
  gap: 8px;
}
.progress-dots button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}
.progress-dots button:before {
  content: "";
  width: 6px;
  height: 6px;
  background: var(--line);
  border-radius: 50%;
}
.progress-dots button[aria-pressed="true"]:before {
  background: var(--accent);
  width: 19px;
  border-radius: 5px;
}
.evidence {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  font-size: 11px;
  margin-top: 22px;
}
.evidence summary {
  min-height: 48px;
  padding: 13px 3px;
  cursor: pointer;
  color: var(--muted);
}
.evidence p {
  padding: 0 3px 16px;
  color: var(--muted);
  line-height: 1.9;
}
.evidence button {
  margin-bottom: 10px;
}
.content-pad {
  padding: 25px 30px;
}
.section-label {
  font-size: 10px;
  color: var(--muted);
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
}
.saved[aria-pressed="true"] {
  color: var(--accent);
  background: var(--soft);
}
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 90%;
  width: max-content;
  padding: 11px 17px;
  background: var(--ink);
  color: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 11px;
  z-index: 9;
}
.modal {
  padding: 27px;
  border: 1px solid var(--line);
  border-radius: 12px;
  max-width: 660px;
  width: calc(100% - 32px);
  max-height: 85vh;
  color: var(--ink);
  background: var(--paper);
}
.modal::backdrop {
  background: #1c302bbb;
  backdrop-filter: blur(4px);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}
.modal h2 {
  font-size: 23px;
  margin: 10px 0 18px;
}
.modal p {
  line-height: 2;
  color: var(--muted);
}
.mode-notice {
  margin: 0 30px 14px;
  padding: 12px 16px;
  border-left: 2px solid var(--accent);
  background: var(--soft);
  font-size: 12px;
}
.mode-notice strong {
  display: block;
  margin-bottom: 3px;
}
.focus-main {
  max-width: 640px;
  margin: auto;
  padding: 23px 36px 28px;
}
.focus-main .intro-line {
  text-align: center;
  margin-bottom: 30px;
  font-size: 10px;
  color: var(--muted);
}
.focus-main .question-block h2 {
  font-size: 31px;
  max-width: 18em;
}
.focus-main .q-body {
  max-width: 100%;
}
.focus-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 25px;
  flex-wrap: wrap;
}
.focus-main .source {
  margin-bottom: 29px;
}
.focus-main .composer {
  margin-top: 18px;
}
.focus-main .support {
  border-top: 1px solid var(--line);
  padding-top: 10px;
  margin-top: 13px;
}
.v2 {
  --accent: #3c5f7c;
  --soft: #e8eef4;
  --ink: #2c4150;
  --muted: #657581;
  --line: #dce2e6;
  --paper: #f7f9fa;
  --warm: #edf2f5;
}
.split-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 646px;
}
.reading-column {
  padding: 31px 30px;
  border-right: 1px solid var(--line);
  background: #fff;
}
.reading-column h2 {
  font-size: 27px;
  margin: 19px 0 8px;
}
.reading-column .byline {
  font-size: 10px;
  color: var(--muted);
  margin-bottom: 28px;
}
.article-text {
  font-family: var(--serif);
  font-size: 14px;
  line-height: 2.25;
  color: var(--muted);
}
.article-text p {
  margin-bottom: 21px;
}
.highlight {
  background: #e3ecf3;
  border: 0;
  border-bottom: 1px solid #839fb3;
  text-align: left;
  padding: 4px 5px;
  font: inherit;
  line-height: inherit;
  color: var(--ink);
  border-radius: 2px;
}
.reading-foot {
  margin-top: 29px;
  font-size: 9px;
  color: var(--muted);
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.inspector {
  padding: 25px 25px 30px;
}
.inspector .modes {
  margin: 20px 0 28px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 13px;
  gap: 0;
}
.inspector .modes button {
  padding: 0 8px;
  font-size: 10px;
}
.inspector h2 {
  font-size: 23px;
}
.inspector .q-body {
  font-size: 12px;
}
.inspector .focus-actions {
  gap: 7px;
  margin-top: 20px;
}
.inspector .btn {
  padding: 10px 12px;
  font-size: 11px;
}
.inspector .source {
  margin-top: 23px;
}
.v3 {
  --ink: #303b47;
  --accent: #475969;
  --muted: #697682;
  --soft: #edf1f4;
  --line: #dfe4e8;
  --paper: #fafbfc;
}
.index-top {
  padding: 20px 28px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.index-top h2 {
  font-size: 19px;
  margin-top: 4px;
}
.index-layout {
  display: grid;
  grid-template-columns: 245px 1fr;
  min-height: 550px;
}
.question-index {
  padding: 19px 15px;
  border-right: 1px solid var(--line);
  background: #f1f4f6;
}
.question-index > .small {
  padding: 0 12px;
  margin-bottom: 12px;
}
.index-item {
  width: 100%;
  display: flex;
  align-items: start;
  text-align: left;
  gap: 10px;
  padding: 15px 11px;
  border: 1px solid transparent;
  border-radius: 7px;
  margin-bottom: 7px;
  line-height: 1.7;
}
.index-item[aria-pressed="true"] {
  border-color: #c8d3db;
  background: #fff;
  box-shadow: 0 3px 6px #182c4004;
}
.index-item b {
  font-size: 11px;
  font-weight: 600;
  display: block;
}
.index-item small {
  font-size: 10px;
  display: block;
  color: var(--muted);
  margin-top: 6px;
}
.index-item .number {
  flex-shrink: 0;
  width: 23px;
  height: 23px;
  font-size: 9px;
  margin-top: 1px;
}
.index-detail {
  padding: 30px 32px;
}
.index-detail .breadcrumb {
  font-size: 9px;
  color: var(--muted);
  margin-bottom: 24px;
}
.index-detail h2 {
  font-size: 25px;
}
.index-detail .q-hint {
  border-radius: 0;
  border-left: 2px solid #8597a5;
}
.v4 {
  --accent: #89602e;
  --soft: #f1e8d8;
  --ink: #4b3a29;
  --muted: #7b7164;
  --line: #e5ddce;
  --paper: #fcfaf5;
  --warm: #f5efe4;
}
.journey-main {
  max-width: 740px;
  margin: auto;
  padding: 26px 35px;
}
.journey-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
}
.journey-top h2 {
  font-size: 20px;
  margin-top: 7px;
}
.stepper {
  display: flex;
  margin: 20px 0 34px;
  padding: 14px;
  background: #f4efe6;
  border: 1px solid var(--line);
  border-radius: 9px;
  gap: 10px;
}
.stepper button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 5px;
  font-size: 11px;
  min-height: 46px;
}
.stepper button[aria-pressed="true"] {
  background: #fff;
  box-shadow: 0 2px 6px #4d352210;
  color: var(--accent);
}
.stepper button[aria-pressed="true"] .number {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.journey-card {
  padding: 27px 30px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 9px;
  position: relative;
}
.journey-card .question-block h2 {
  font-size: 27px;
}
.journey-card .q-hint {
  background: none;
  border-left: 2px solid var(--accent);
  border-radius: 0;
  padding: 8px 15px;
}
.journey-navigation {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.journey-caption {
  font-size: 10px;
  color: var(--muted);
  text-align: center;
  margin-top: 18px;
}
.v5 {
  --paper: #f8faf8;
  --soft: #e7f0e9;
  --line: #dae4dc;
}
.conversation-layout {
  max-width: 720px;
  margin: auto;
  padding: 23px 32px;
}
.conversation-source {
  display: flex;
  gap: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 17px;
  background: #fff;
  margin-bottom: 26px;
  font-size: 11px;
  color: var(--muted);
}
.conversation-source > svg {
  margin-top: 4px;
  color: var(--accent);
}
.conversation-source strong {
  display: block;
  font-weight: 500;
  color: var(--ink);
  margin-top: 5px;
}
.chat-turn {
  display: flex;
  gap: 12px;
  margin: 22px 0;
  align-items: start;
}
.avatar {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--soft);
  color: var(--accent);
  flex-shrink: 0;
}
.avatar svg {
  width: 17px;
}
.chat-content {
  flex: 1;
  min-width: 0;
}
.chat-content .overline {
  font-size: 9px;
  margin-bottom: 7px;
}
.chat-content h2 {
  font-size: 23px;
  margin-bottom: 12px;
}
.chat-content .q-body {
  font-size: 12px;
}
.user-turn {
  margin-left: 65px;
  justify-content: end;
}
.user-bubble {
  background: var(--soft);
  padding: 12px 17px;
  border-radius: 10px 10px 0 10px;
  font-size: 12px;
  max-width: 85%;
}
.suggestions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.suggestions button {
  font-size: 10px;
  border: 1px solid var(--line);
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}
.suggestions svg {
  width: 13px;
}
.conversation-layout .composer {
  border-top: 1px solid var(--line);
  padding-top: 17px;
}
.conversation-layout .answer {
  background: #fff;
  margin-left: 42px;
}
.chat-caption {
  text-align: center;
  font-size: 9px;
  color: var(--muted);
  margin: 14px 0;
}
.v6 {
  --paper: #f7f4ee;
  --ink: #4a4034;
  --accent: #765a3e;
  --muted: #7b7266;
  --line: #e2dcd2;
  --soft: #eee6da;
  --warm: #f2ede4;
}
.board-main {
  padding: 25px 27px;
}
.board-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  margin-bottom: 23px;
  gap: 16px;
}
.board-heading h2 {
  font-size: 25px;
  margin-top: 8px;
}
.board-heading p {
  font-size: 11px;
  color: var(--muted);
  margin-top: 7px;
}
.board-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}
.board-card {
  background: #fff;
  border: 1px solid var(--line);
  border-top: 3px solid #9ba989;
  padding: 19px 17px;
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  align-items: start;
  min-height: 281px;
}
.board-card:nth-child(2) {
  border-top-color: #b4a0bf;
}
.board-card:nth-child(3) {
  border-top-color: #c2a178;
}
.board-card[aria-current="true"] {
  box-shadow: 0 0 0 1px var(--accent);
}
.board-card .card-type {
  font-size: 10px;
  color: var(--muted);
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  width: 100%;
}
.board-card h3 {
  font-size: 17px;
  line-height: 1.7;
  margin-bottom: 11px;
}
.board-card p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.9;
  margin-bottom: 19px;
}
.board-card button {
  margin-top: auto;
  width: 100%;
  font-size: 10px;
  justify-content: space-between;
  padding: 10px 12px;
}
.board-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.board-detail h3 {
  font-size: 17px;
  margin: 8px 0;
}
.board-detail .q-body {
  font-size: 11px;
}
.board-detail .composer {
  margin-top: 0;
}
.board-detail .answer {
  grid-column: 1/-1;
}
.board-main > .source {
  margin-bottom: 22px;
}
.v7 {
  --paper: #192b24;
  --surface: #23382f;
  --ink: #e0e9de;
  --muted: #a5b8aa;
  --accent: #b5cfab;
  --soft: #30493a;
  --line: #3e5447;
  --warm: #24372c;
}
.v7 .p-header {
  background: #192b24;
}
.v7 .btn.primary,
.v7 .composer .send {
  color: #192b24;
}
.map-main {
  padding: 22px 28px;
}
.map-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.map-heading h2 {
  font-size: 22px;
  margin-top: 7px;
}
.map-canvas {
  height: 270px;
  position: relative;
  margin: 17px 0 20px;
  background-image: radial-gradient(#516953 1px, transparent 1px);
  background-size: 18px 18px;
  border: 1px solid var(--line);
  border-radius: 9px;
  display: grid;
  grid-template-columns: 1fr 1.1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 14px;
  padding: 33px 22px;
  align-items: center;
}
.map-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  stroke: #799b77;
  stroke-width: 1;
  fill: none;
}
.map-center {
  grid-column: 2;
  grid-row: 1/3;
  z-index: 1;
  text-align: center;
  border: 1px solid #8dab7e;
  border-radius: 50%;
  aspect-ratio: 1;
  max-width: 175px;
  width: 100%;
  justify-self: center;
  background: #2b4232;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px;
  box-shadow: 0 0 0 8px #243a2d;
}
.map-center p {
  font-family: var(--serif);
  font-size: 16px;
  line-height: 1.8;
}
.map-center .overline {
  font-size: 8px;
  margin-bottom: 9px;
}
.map-node {
  z-index: 1;
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 11px 13px;
  border-radius: 8px;
  text-align: left;
  font-size: 11px;
  line-height: 1.8;
  position: relative;
}
.map-node small {
  display: block;
  font-size: 9px;
  color: var(--muted);
}
.map-node[aria-pressed="true"] {
  border-color: var(--accent);
  background: #38503b;
}
.map-node.first {
  grid-column: 1;
  grid-row: 1/3;
}
.map-node.second {
  grid-column: 3;
  grid-row: 1;
}
.map-node.third {
  grid-column: 3;
  grid-row: 2;
}
.map-detail {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 24px;
  padding: 21px 23px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #21362b;
}
.map-detail h2 {
  font-size: 21px;
  margin: 8px 0 11px;
}
.map-detail .q-body {
  font-size: 11px;
}
.map-detail .composer {
  margin-top: 14px;
}
.map-detail .answer {
  grid-column: 1/-1;
}
.map-detail .question-meta {
  margin-bottom: 5px;
}
.v8 {
  --paper: #f5f2e7;
  --surface: #fffdf6;
  --ink: #4b4636;
  --muted: #7d7968;
  --line: #ded9c5;
  --accent: #756439;
  --soft: #eeeadb;
  --warm: #eeeadb;
}
.notebook {
  margin: 26px;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fffdf6;
  box-shadow:
    2px 4px 0 #e7e1cf,
    3px 5px 0 #d9d3c1;
  min-height: 558px;
}
.note-reading {
  padding: 28px;
  border-right: 1px solid var(--line);
}
.note-reading h2 {
  font-size: 25px;
  margin: 22px 0 15px;
}
.note-reading .q-body {
  font-family: var(--serif);
  font-size: 13px;
  line-height: 2.1;
}
.note-reading .source {
  margin-top: 22px;
}
.note-writing {
  padding: 28px 25px;
  background: #faf8ee;
}
.note-writing .note-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}
.note-writing .note-label span {
  font-size: 9px;
  color: var(--muted);
}
.note-writing label {
  display: block;
  font-size: 18px;
  font-family: var(--serif);
  margin-top: 19px;
}
.note-writing textarea {
  margin-top: 16px;
  border: 0;
  border-radius: 0;
  min-height: 222px;
  padding: 0 0 0 4px;
  background: repeating-linear-gradient(
    transparent,
    transparent 31px,
    #e1ddce 31px,
    #e1ddce 32px
  );
  line-height: 32px;
  font-family: var(--serif);
  font-size: 13px;
  resize: vertical;
}
.note-writing .btn {
  margin-top: 17px;
  width: 100%;
}
.notebook .composer label {
  font-family: inherit;
  font-size: 10px;
  margin: 0 0 7px;
}
.notebook .composer .btn {
  margin: 0;
  width: 44px;
}
.note-writing .note-help {
  font-size: 9px;
  color: var(--muted);
  margin-top: 9px;
}
.v9 {
  --paper: #f2f1f6;
  --ink: #39374b;
  --muted: #767286;
  --accent: #69628f;
  --line: #dfdde9;
  --soft: #eeecf5;
  --warm: #eeedf4;
}
.pocket-canvas {
  position: relative;
  max-width: 650px;
  margin: auto;
  min-height: 661px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.pocket-article {
  padding: 25px 36px 33px;
  max-width: 600px;
  margin: auto;
}
.pocket-article h2 {
  font-family: var(--serif);
  font-size: 26px;
  margin: 12px 0 16px;
}
.pocket-article .article-text {
  font-size: 12px;
  line-height: 2;
}
.pocket-article .highlight {
  background: #e7e1f2;
  border-color: #aaa0c2;
}
.pocket-sheet {
  padding: 0 25px 23px;
  background: #fff;
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -10px 38px #3833480a;
  position: relative;
  margin-top: auto;
}
.sheet-handle {
  width: 100%;
  height: 34px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 22px 22px 0 0;
  font-size: 9px;
  color: var(--muted);
}
.sheet-handle:before {
  content: "";
  width: 32px;
  height: 4px;
  border-radius: 4px;
  background: #d6d1e2;
}
.sheet-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
}
.sheet-title strong {
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.sheet-title svg {
  width: 16px;
  color: var(--accent);
}
.sheet-tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 18px;
}
.sheet-tabs button {
  flex: 1;
  min-height: 44px;
  font-size: 10px;
  padding: 4px 7px;
  border-radius: 5px;
  border: 1px solid var(--line);
}
.sheet-tabs button[aria-pressed="true"] {
  background: var(--soft);
  color: var(--accent);
  border-color: #b9afcf;
}
.pocket-sheet h2 {
  font-size: 22px;
  margin-bottom: 12px;
}
.pocket-sheet .q-body {
  font-size: 12px;
}
.pocket-sheet .composer {
  margin-top: 15px;
}
.pocket-sheet .focus-actions {
  margin-top: 17px;
}
.pocket-sheet .btn {
  width: 100%;
}
.v10 {
  --paper: #f7f8fa;
  --ink: #34434c;
  --muted: #6b7980;
  --accent: #486478;
  --soft: #e9eff4;
  --line: #dce2e6;
  --warm: #edf0f2;
}
.compare-main {
  padding: 25px 28px;
}
.compare-intro {
  text-align: center;
  max-width: 650px;
  margin: 0 auto 25px;
}
.compare-intro h2 {
  font-size: 27px;
  font-family: var(--serif);
  font-weight: 400;
  margin: 13px 0 10px;
}
.compare-intro p {
  font-size: 11px;
  color: var(--muted);
}
.perspective-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  position: relative;
}
.perspective {
  border: 1px solid #cfddd3;
  background: #f0f5f0;
  padding: 23px;
  border-radius: 8px;
}
.perspective.against {
  background: #f6f2ec;
  border-color: #e2d6c6;
}
.perspective .overline {
  color: #54705c;
}
.perspective.against .overline {
  color: #8b6a47;
}
.perspective h3 {
  font-size: 18px;
  margin: 15px 0 11px;
}
.perspective p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.9;
}
.perspective ul {
  padding-left: 18px;
  font-size: 11px;
  line-height: 2;
  color: var(--muted);
  margin: 13px 0;
}
.perspective .text-btn {
  font-size: 10px;
  margin-left: -9px;
}
.verdict {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
  margin-top: 6px;
}
.verdict > strong {
  font-size: 12px;
  font-weight: 500;
}
.verdict-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.verdict-options button {
  font-size: 10px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
}
.verdict-options button[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--soft);
}
.compare-main .composer {
  max-width: 650px;
  margin: 21px auto 0;
}
.verdict-status {
  font-size: 11px;
  color: var(--accent);
  margin-top: 12px;
}
.compare-main > .answer {
  max-width: 650px;
  margin: 20px auto;
}
@media (min-width: 1050px) {
  .focus-main {
    padding-top: 24px;
  }
  .split-layout {
    grid-template-columns: 1.1fr 1fr;
  }
  .reading-column {
    padding: 36px 48px;
  }
  .inspector {
    padding: 30px 37px;
  }
  .board-card {
    min-height: 300px;
    padding: 24px;
  }
  .map-canvas {
    height: 300px;
  }
  .notebook {
    max-width: 980px;
    margin: 30px auto;
  }
  .compare-main {
    max-width: 950px;
    margin: auto;
  }
  .pocket-canvas {
    min-height: 700px;
  }
}
@media (max-width: 650px) {
  body {
    font-size: 12px;
  }
  .p-header {
    padding: 10px 17px;
    min-height: 64px;
  }
  .header-actions {
    gap: 2px;
  }
  .demo {
    font-size: 8px;
    padding: 2px 5px;
  }
  .brand {
    font-size: 12px;
    gap: 7px;
  }
  .brand svg {
    width: 18px;
  }
  .mode-row {
    padding: 12px 16px;
  }
  .mode-row > span {
    display: none;
  }
  .modes {
    gap: 3px;
  }
  .modes button {
    padding: 0 10px;
    font-size: 10px;
  }
  .focus-main {
    padding: 17px 23px 23px;
  }
  .focus-main .intro-line {
    margin-bottom: 21px;
  }
  .focus-main .source {
    margin-bottom: 23px;
    font-size: 11px;
  }
  .focus-main .question-block h2 {
    font-size: 27px;
  }
  .focus-main .q-body {
    font-size: 12px;
  }
  .focus-actions {
    gap: 7px;
    margin-top: 21px;
  }
  .btn {
    font-size: 11px;
    padding: 10px 14px;
  }
  .composer input {
    font-size: 11px;
    padding: 10px 8px;
  }
  .composer-foot {
    font-size: 8px;
  }
  .support {
    font-size: 9px;
  }
  .question-meta {
    margin-bottom: 12px;
  }
  .split-layout {
    grid-template-columns: 1fr;
  }
  .reading-column {
    padding: 20px 22px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .reading-column h2 {
    font-size: 24px;
    margin: 13px 0 7px;
  }
  .reading-column .byline {
    margin-bottom: 16px;
  }
  .reading-column .article-text {
    font-size: 12px;
    line-height: 2;
  }
  .reading-column .article-text p:not(:first-child),
  .reading-foot {
    display: none;
  }
  .reading-column .article-text p {
    margin: 0;
  }
  .inspector {
    padding: 20px 22px;
  }
  .inspector .modes {
    margin: 12px 0 18px;
  }
  .inspector h2 {
    font-size: 23px;
  }
  .index-top {
    padding: 18px 20px;
    gap: 8px;
    align-items: start;
  }
  .index-top h2 {
    font-size: 18px;
  }
  .index-top .modes button {
    padding: 0 8px;
  }
  .index-top .modes button span {
    display: none;
  }
  .index-layout {
    grid-template-columns: 1fr;
  }
  .question-index {
    padding: 13px 16px;
    display: flex;
    gap: 8px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    overflow: auto;
  }
  .question-index > .small {
    display: none;
  }
  .index-item {
    flex: 0 0 180px;
    padding: 12px;
    margin: 0;
  }
  .index-item b {
    font-size: 10px;
  }
  .index-item small {
    font-size: 9px;
  }
  .index-detail {
    padding: 23px;
  }
  .index-detail .breadcrumb {
    margin-bottom: 16px;
  }
  .index-detail h2 {
    font-size: 24px;
  }
  .journey-main {
    padding: 23px 18px;
  }
  .journey-top h2 {
    font-size: 18px;
  }
  .stepper {
    padding: 7px;
    gap: 3px;
    margin-bottom: 20px;
  }
  .stepper button {
    font-size: 9px;
    gap: 5px;
  }
  .stepper .number {
    width: 23px;
    height: 23px;
  }
  .journey-card {
    padding: 21px 20px;
  }
  .journey-card .question-block h2 {
    font-size: 23px;
  }
  .journey-card .q-body {
    font-size: 12px;
  }
  .journey-navigation .btn {
    font-size: 10px;
    padding: 10px;
  }
  .conversation-layout {
    padding: 19px;
  }
  .conversation-source {
    padding: 12px;
    font-size: 10px;
  }
  .chat-turn {
    gap: 9px;
  }
  .chat-content h2 {
    font-size: 22px;
  }
  .user-turn {
    margin-left: 30px;
  }
  .user-bubble {
    font-size: 11px;
  }
  .chat-content .q-body {
    font-size: 11px;
  }
  .suggestions {
    gap: 6px;
  }
  .suggestions button {
    font-size: 9px;
    padding: 7px 9px;
  }
  .conversation-layout .answer {
    margin-left: 0;
  }
  .board-main {
    padding: 22px 18px;
  }
  .board-heading h2 {
    font-size: 23px;
  }
  .board-heading .pill {
    display: none;
  }
  .board-grid {
    grid-template-columns: 1fr;
  }
  .board-card {
    min-height: 0;
    padding: 17px 18px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 12px;
  }
  .board-card .card-type {
    grid-column: 1/-1;
    margin-bottom: 8px;
  }
  .board-card h3 {
    font-size: 17px;
    grid-column: 1;
    grid-row: 2;
    margin-bottom: 7px;
  }
  .board-card p {
    grid-column: 1;
    grid-row: 3;
    font-size: 10px;
    margin: 0;
  }
  .board-card button {
    width: 44px;
    min-height: 44px;
    padding: 10px;
    grid-column: 2;
    grid-row: 2/4;
    align-self: center;
    margin: 0;
    font-size: 0;
  }
  .board-card button svg {
    width: 20px;
  }
  .board-detail {
    grid-template-columns: 1fr;
    padding: 18px;
    gap: 17px;
    margin-top: 18px;
  }
  .map-main {
    padding: 19px 16px;
  }
  .map-heading h2 {
    font-size: 20px;
  }
  .map-canvas {
    padding: 18px 10px;
    gap: 8px;
    height: 247px;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .map-center {
    padding: 9px;
    box-shadow: 0 0 0 4px #243a2d;
  }
  .map-center p {
    font-size: 12px;
  }
  .map-center .overline {
    font-size: 7px;
    margin-bottom: 5px;
  }
  .map-node {
    padding: 9px 7px;
    font-size: 9px;
  }
  .map-node small {
    font-size: 8px;
  }
  .map-detail {
    grid-template-columns: 1fr;
    padding: 18px;
    gap: 15px;
  }
  .map-detail h2 {
    font-size: 22px;
  }
  .map-detail .composer {
    margin-top: 12px;
  }
  .map-detail .btn {
    width: 100%;
  }
  .notebook {
    margin: 18px;
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .note-reading {
    padding: 22px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .note-reading h2 {
    font-size: 23px;
    margin: 14px 0 10px;
  }
  .note-reading .q-body {
    font-size: 12px;
  }
  .note-reading .source {
    margin-top: 16px;
    font-size: 11px;
  }
  .note-writing {
    padding: 22px;
  }
  .note-writing textarea {
    min-height: 160px;
  }
  .note-writing label {
    font-size: 17px;
  }
  .pocket-canvas {
    min-height: 696px;
  }
  .pocket-article {
    padding: 21px 24px 23px;
  }
  .pocket-article h2 {
    font-size: 23px;
    margin: 10px 0 12px;
  }
  .pocket-article .article-text {
    font-size: 11px;
    line-height: 1.9;
  }
  .pocket-article .article-text p {
    margin-bottom: 0;
  }
  .pocket-article .article-text p:last-child {
    display: none;
  }
  .pocket-sheet {
    padding: 0 20px 23px;
  }
  .pocket-sheet h2 {
    font-size: 23px;
  }
  .pocket-sheet .q-body {
    font-size: 11px;
  }
  .compare-main {
    padding: 22px 18px;
  }
  .compare-intro h2 {
    font-size: 25px;
  }
  .perspective-grid {
    gap: 10px;
  }
  .perspective {
    padding: 15px 12px;
  }
  .perspective h3 {
    font-size: 16px;
    margin-top: 12px;
  }
  .perspective p {
    font-size: 10px;
    line-height: 1.9;
  }
  .perspective ul {
    font-size: 9px;
    padding-left: 13px;
  }
  .perspective .overline {
    font-size: 9px;
    letter-spacing: 0.4px;
  }
  .perspective .text-btn {
    font-size: 9px;
    margin-left: 0;
    padding: 5px 0;
    gap: 4px;
  }
  .perspective .text-btn svg {
    width: 12px;
  }
  .verdict {
    align-items: start;
    flex-direction: column;
  }
  .verdict-options {
    width: 100%;
    gap: 5px;
  }
  .verdict-options button {
    flex: 1;
    padding: 8px 6px;
    font-size: 9px;
  }
  .mode-notice {
    margin: 0 17px 12px;
  }
  .modal {
    padding: 22px;
  }
  .modal h2 {
    font-size: 22px;
  }
}
@media (max-width: 340px) {
  .header-actions .demo {
    display: none;
  }
  .modes button {
    padding: 0 7px;
  }
  .focus-main {
    padding-left: 18px;
    padding-right: 18px;
  }
  .map-node {
    font-size: 8px;
  }
  .map-center p {
    font-size: 10px;
  }
  .stepper {
    gap: 0;
  }
  .stepper button {
    gap: 3px;
    font-size: 8px;
  }
  .stepper .number {
    width: 20px;
    height: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

`;
function header(extra = "") {
  return `<header class="p-header"><div class="brand">${icon("spark")}<span>AI와 함께 읽기</span></div><div class="header-actions">${extra}<span class="demo">인터랙션 데모</span><button class="icon-btn saved" data-action="bookmark" aria-label="질문 저장" aria-pressed="false">${icon("save")}</button></div></header>`;
}
function modes() {
  return `<nav class="modes" aria-label="읽기 도구">${[
    ["bulb", "핵심 요약"],
    ["layers", "다른 관점"],
    ["link", "더 생각하기"],
  ]
    .map(
      ([i, t], n) =>
        `<button data-action="mode" data-mode="${n}" aria-pressed="${n === 2}">${icon(i)}<span>${t}</span></button>`,
    )
    .join("")}</nav>`;
}
function modeRow() {
  return `<div class="mode-row">${modes()}<span>생각을 확장하는 질문 3개</span></div>`;
}
function source() {
  return `<div class="source"><span class="overline">함께 읽는 문장</span><strong>“AI가 답을 더 빨리 줄수록, 우리는 더 좋은 질문을 해야 한다.”</strong></div>`;
}
function questionBlock(serif = true) {
  return `<div class="question-block"><div class="question-meta"><span class="overline"><span class="number" data-q-number>01</span><span data-q-kind>이해하기</span></span><button class="icon-btn" data-action="expand" aria-label="질문 크게 보기">${icon("expand")}</button></div><h2 class="${serif ? "serif" : ""}" data-q-title>${QUESTIONS[0].title}</h2><p class="q-body" data-q-body>${QUESTIONS[0].body}</p><p class="q-hint" data-q-hint>${QUESTIONS[0].hint}</p></div>`;
}
function explore(text = "이 질문 탐색하기") {
  return `<button class="btn primary" data-action="explore">${text}${icon("arrow")}</button>`;
}
function composer(label = "또는, 나만의 질문을 이어가세요") {
  return `<form class="composer"><label for="custom-question">${label}</label><div class="composer-row"><input id="custom-question" name="question" type="text" placeholder="궁금한 점을 자유롭게 물어보세요" maxlength="500" required autocomplete="off"><button class="send" type="submit" aria-label="질문 보내기">${icon("send")}</button></div><div class="composer-foot"><span>예시 응답으로 흐름을 체험합니다</span><span>Enter ↵</span></div></form>`;
}
function answer() {
  return '<section class="answer" id="answer" role="status" aria-live="polite" hidden></section>';
}
function evidence() {
  return `<details class="evidence"><summary>이 질문이 나온 맥락 살펴보기</summary><p>이 글은 AI 시대의 읽기를 다룹니다. 빠른 정보 탐색만으로 충분한지, 질문하는 과정이 이해에 어떤 역할을 하는지 함께 생각해 봅니다.</p><button class="text-btn" data-action="source">원문 문장 확인 ${icon("arrow")}</button></details>`;
}
function dots() {
  return `<div class="progress-dots" role="group" aria-label="질문 이동">${QUESTIONS.map((q, i) => `<button data-action="question" data-question="${i}" aria-label="${q.label}" aria-pressed="${i === 0}"></button>`).join("")}</div>`;
}
function modal() {
  return `<dialog class="modal" id="detail-modal" aria-labelledby="modal-title"><div class="modal-header"><span class="overline">조금 더 깊이 읽기</span><button class="icon-btn" data-action="close-modal" aria-label="상세 닫기">${icon("close")}</button></div><h2 id="modal-title"></h2><p id="modal-body"></p></dialog><div class="toast" id="preview-toast" role="status" hidden></div>`;
}
function previewMarkup(id) {
  switch (id) {
    case 1:
      return `${header()}${modeRow()}<main class="focus-main"><p class="intro-line">읽는 것에서, 생각하는 것으로.</p>${source()}${questionBlock()}<div class="focus-actions">${explore()}<button class="text-btn" data-action="question" data-question="1">다른 질문 보기 ${icon("arrow")}</button></div>${evidence()}${composer()}${answer()}<div class="support"><span data-progress>01 / 03 · 천천히, 한 가지씩</span>${dots()}</div></main>`;
    case 2:
      return `${header()}<main class="split-layout"><article class="reading-column"><span class="overline">FIELDNOTES / READING</span><h2 class="serif">답이 쉬워진 시대,<br>질문은 더 중요해진다.</h2><p class="byline">생각에 관한 노트 · 4분 읽기</p><div class="article-text"><p>우리는 언제든 답을 얻을 수 있는 시대에 살고 있다. 하지만 정보에 도달하는 속도가 빨라졌다고 해서, 이해가 깊어지는 것은 아니다. <button class="highlight" data-action="question" data-question="0">AI가 답을 더 빨리 줄수록, 우리는 더 좋은 질문을 해야 한다.</button></p><p>좋은 질문은 당연해 보이는 전제를 잠시 멈춰 세운다. 무엇을 알고 있는지보다 무엇을 아직 모르는지 바라보게 한다.</p><p>이제 필요한 것은 답을 수집하는 능력뿐 아니라, 그 답이 의미하는 바를 탐색하는 태도일지도 모른다.</p></div><div class="reading-foot"><span>밑줄 친 문장에 연결된 질문</span><span>01 — 03</span></div></article><aside class="inspector" aria-label="문장 탐색"><div class="section-label"><span>선택한 문장에서 더 깊이</span><span>3개의 질문</span></div>${modes()}${questionBlock(false)}<div class="focus-actions">${explore("근거 함께 살펴보기")}</div>${composer()}${answer()}${evidence()}</aside></main>`;
    case 3:
      return `${header()}<div class="index-top"><div><span class="overline">YOUR QUESTION LIBRARY</span><h2>어디부터 살펴볼까요?</h2></div>${modes()}</div><main class="index-layout"><nav class="question-index" aria-label="탐색할 질문"><p class="small muted">연결된 질문 · 3</p>${QUESTIONS.map((q, i) => `<button class="index-item" data-action="question" data-question="${i}" aria-pressed="${i === 0}"><span class="number">0${i + 1}</span><span><b>${q.title}</b><small>${q.kind} · ${q.short}</small></span></button>`).join("")}</nav><article class="index-detail"><p class="breadcrumb">더 생각하기 &nbsp; / &nbsp; <span data-q-kind>이해하기</span></p>${questionBlock(false)}<div class="focus-actions">${explore()}</div>${evidence()}${composer()}${answer()}</article></main>`;
    case 4:
      return `${header()}<main class="journey-main"><div class="journey-top"><div><span class="overline">A LITTLE DEEPER, ONE STEP AT A TIME</span><h2>세 번의 질문으로 깊어지는 생각</h2></div><span class="pill" data-progress>1 / 3 단계</span></div><nav class="stepper" aria-label="사고 탐색 단계">${QUESTIONS.map((q, i) => `<button data-action="question" data-question="${i}" aria-pressed="${i === 0}"><span class="number">${i + 1}</span>${q.kind}</button>`).join("")}</nav><article class="journey-card">${questionBlock()}${composer("이 단계에서 궁금한 점을 적어보세요")}${answer()}<div class="journey-navigation"><button class="text-btn" data-action="prev-step" disabled>← 이전 단계</button>${explore("이 단계 탐색")}<button class="btn" data-action="next-step">다음 단계 ${icon("arrow")}</button></div></article><p class="journey-caption">정답을 찾기보다, 생각의 폭을 넓혀보세요.</p></main>`;
    case 5:
      return `${header()}<main class="conversation-layout"><div class="conversation-source">${icon("book")}<div><span class="overline">대화의 출발점</span><strong>“AI가 답을 더 빨리 줄수록, 우리는 더 좋은 질문을 해야 한다.”</strong></div></div><div class="chat-turn"><span class="avatar">${icon("spark")}</span><div class="chat-content"><div class="overline">읽기 동료</div><p>이 문장에는 흥미로운 전제가 숨어 있어요.<br>어느 부분부터 함께 살펴볼까요?</p><div class="suggestions">${QUESTIONS.map((q, i) => `<button data-action="question" data-question="${i}" aria-pressed="${i === 0}">${q.label}${icon("arrow")}</button>`).join("")}</div></div></div><div class="chat-turn user-turn"><div class="user-bubble" data-q-title>${QUESTIONS[0].title}</div></div><div class="chat-turn"><span class="avatar">${icon("spark")}</span><div class="chat-content"><div class="overline">함께 생각하기</div><h2 class="serif" data-q-hint>${QUESTIONS[0].hint}</h2><p class="q-body" data-q-body>${QUESTIONS[0].body}</p><div class="focus-actions">${explore("예시 답변 이어보기")}<button class="text-btn" data-action="source">원문 확인 ${icon("book")}</button></div></div></div><div id="chat-history"></div>${composer("이 생각에서 대화를 이어가세요")}<p class="chat-caption">직접 질문하거나 추천 질문을 눌러 대화 흐름을 체험하세요.</p></main>`;
    case 6:
      return `${header()}<main class="board-main"><div class="board-heading"><div><span class="overline">THREE WAYS TO GO DEEPER</span><h2>하나의 문장, 세 개의 출발점.</h2><p>마음이 가는 질문부터 생각을 펼쳐보세요.</p></div><span class="pill">자유롭게 탐색</span></div>${source()}<div class="board-grid">${QUESTIONS.map((q, i) => `<article class="board-card" data-card="${i}" aria-current="${i === 0}"><div class="card-type"><span>0${i + 1} / ${q.kind}</span>${icon(["bulb", "layers", "link"][i])}</div><h3>${q.title}</h3><p>${q.hint}</p><button class="btn" data-action="question" data-question="${i}" aria-label="${q.label}" aria-pressed="${i === 0}">이 관점 선택하기 ${icon("arrow")}</button></article>`).join("")}</div><section class="board-detail"><div><span class="overline" data-q-kind>이해하기</span><h3 data-q-title>${QUESTIONS[0].title}</h3><p class="q-body" data-q-body>${QUESTIONS[0].body}</p></div><div>${composer("선택한 관점에서 질문하기")}<button class="text-btn" data-action="explore">추천 질문으로 시작 ${icon("arrow")}</button></div>${answer()}</section></main>`;
    case 7:
      return `${header()}<main class="map-main"><div class="map-heading"><div><span class="overline">FOLLOW YOUR CURIOSITY</span><h2>생각은 연결될수록 깊어집니다.</h2></div><span class="pill">3개의 연결</span></div><div class="map-canvas" role="group" aria-label="중심 주장과 연결된 세 가지 질문"><svg class="map-lines" viewBox="0 0 800 270" preserveAspectRatio="none" aria-hidden="true"><path d="M180 135H400M400 135C510 135 530 70 640 70M400 135C510 135 530 203 640 203"/><circle cx="290" cy="135" r="3" fill="#b5cfab"/><circle cx="530" cy="104" r="3" fill="#b5cfab"/><circle cx="530" cy="168" r="3" fill="#b5cfab"/></svg><div class="map-center"><span class="overline">중심 주장</span><p>빠른 답보다<br>좋은 질문</p></div>${QUESTIONS.map((q, i) => `<button class="map-node ${["first", "second", "third"][i]}" data-action="question" data-question="${i}" aria-pressed="${i === 0}"><small>0${i + 1} · ${q.kind}</small>${q.short} ${icon("chevron")}</button>`).join("")}</div><section class="map-detail"><div><div class="question-meta"><span class="overline" data-q-kind>이해하기</span><button class="icon-btn" data-action="expand" aria-label="질문 크게 보기">${icon("expand")}</button></div><h2 class="serif" data-q-title>${QUESTIONS[0].title}</h2><p class="q-body" data-q-body>${QUESTIONS[0].body}</p></div><div>${explore("이 연결 따라가기")}${composer("새로운 연결을 만들어보세요")}</div>${answer()}</section><div class="support"><span>질문을 누르면 연결된 생각이 펼쳐집니다.</span><span>THOUGHT MAP / 01</span></div></main>`;
    case 8:
      return `${header()}<main class="notebook"><article class="note-reading"><span class="overline">READING NOTE / 001</span><h2 class="serif" data-q-title>${QUESTIONS[0].title}</h2><p class="q-body" data-q-body>${QUESTIONS[0].body}</p>${source()}${evidence()}${dots()}</article><section class="note-writing"><div class="note-label"><strong>${icon("note")} 나의 생각</strong><span id="note-status" role="status">프리뷰에 기록</span></div><label for="reading-note">나는 이렇게 생각해요.</label><textarea id="reading-note" placeholder="정답이 아니어도 괜찮아요.\n떠오르는 생각을 한 줄 남겨보세요." maxlength="5000"></textarea><p class="note-help">기록은 이 브라우저에 저장됩니다.</p>${explore("다른 관점과 비교해 보기")}${composer("메모에서 질문 이어가기")}${answer()}</section></main>`;
    case 9:
      return `${header()}<main class="pocket-canvas"><article class="pocket-article"><span class="overline">FIELDNOTES / ESSAY</span><h2>답이 쉬워진 시대,<br>질문은 더 중요해진다.</h2><div class="article-text"><p>정보에 도달하는 속도가 빨라졌다고 해서 이해가 깊어지는 것은 아니다. <button class="highlight" data-action="open-sheet">AI가 답을 더 빨리 줄수록, 우리는 더 좋은 질문을 해야 한다.</button></p><p>좋은 질문은 당연해 보이는 전제를 잠시 멈춰 세운다. 우리가 아직 모르는 것을 바라보게 한다.</p></div></article><section class="pocket-sheet"><button class="sheet-handle" data-action="toggle-sheet" aria-expanded="true" aria-controls="sheet-body">접어서 본문 읽기</button><div class="sheet-title"><strong>${icon("spark")} 이 문장에서 더 깊이</strong><span class="small muted" data-progress>1 / 3</span></div><div id="sheet-body"><nav class="sheet-tabs" aria-label="질문 종류">${QUESTIONS.map((q, i) => `<button data-action="question" data-question="${i}" aria-pressed="${i === 0}">${q.short}</button>`).join("")}</nav><h2 class="serif" data-q-title>${QUESTIONS[0].title}</h2><p class="q-body" data-q-body>${QUESTIONS[0].body}</p><div class="focus-actions">${explore("함께 생각해 보기")}</div>${composer("궁금한 방향으로 이어가세요")}${answer()}</div></section></main>`;
    case 10:
      return `${header()}<main class="compare-main"><div class="compare-intro"><span class="overline">ONE QUESTION, TWO PERSPECTIVES</span><h2>빠른 답변은 우리의 생각을<br>더 깊게 만들어줄까요?</h2><p>두 관점을 함께 살펴보고, 나의 판단을 정리해 보세요.</p></div><div class="perspective-grid"><article class="perspective"><span class="overline">01 / 지지하는 관점</span><h3>사고의 여유를<br>만들어준다</h3><p>정보를 찾는 시간이 줄어들면, 더 복잡한 문제와 새로운 질문에 집중할 여유가 생길 수 있습니다.</p><ul><li>반복적인 탐색 부담 감소</li><li>다양한 관점에 빠르게 접근</li><li>생각을 검증하는 도구로 활용</li></ul><button class="text-btn" data-action="perspective" data-perspective="support">이 근거 더 살펴보기 ${icon("arrow")}</button></article><article class="perspective against"><span class="overline">02 / 반대하는 관점</span><h3>사고의 과정을<br>건너뛸 수 있다</h3><p>완성된 답에 익숙해지면, 스스로 가설을 세우고 시행착오를 통해 이해하는 기회가 줄어들 수 있습니다.</p><ul><li>답을 비판 없이 수용할 가능성</li><li>깊이 이해했다는 착각</li><li>스스로 질문할 동기 감소</li></ul><button class="text-btn" data-action="perspective" data-perspective="against">이 반론 더 살펴보기 ${icon("arrow")}</button></article></div><section class="verdict"><strong>지금, 나의 생각은?</strong><div class="verdict-options" role="group" aria-label="나의 입장"><button data-action="verdict" aria-pressed="false">지지에 가까워요</button><button data-action="verdict" aria-pressed="false">상황에 따라 달라요</button><button data-action="verdict" aria-pressed="false">반론에 가까워요</button></div></section><p class="verdict-status" id="verdict-status" role="status" hidden></p>${composer("두 관점 사이에서 더 궁금한 점은 무엇인가요?")}${answer()}</main>`;
    default:
      return "";
  }
}
function previewRuntime(id, initialState, questions) {
  "use strict";
  const inputState =
    initialState && typeof initialState === "object" ? initialState : {};
  const state = {
    question:
      Number.isInteger(inputState.question) &&
      inputState.question >= 0 &&
      inputState.question < 3
        ? inputState.question
        : 0,
    note:
      typeof inputState.note === "string" ? inputState.note.slice(0, 5000) : "",
    bookmarked: inputState.bookmarked === true,
    verdict:
      typeof inputState.verdict === "string"
        ? inputState.verdict.slice(0, 100)
        : "",
    draft:
      typeof inputState.draft === "string"
        ? inputState.draft.slice(0, 500)
        : "",
  };
  let toastTimer;
  let busy = false;
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  function sendState() {
    parent.postMessage(
      { type: "reading-preview-state", id, state: { ...state } },
      "*",
    );
  }
  function announce(message) {
    const el = $("#preview-toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2600);
  }
  function selectQuestion(index) {
    if (!Number.isInteger(index) || index < 0 || index >= questions.length)
      return;
    state.question = index;
    const q = questions[index];
    $$("[data-q-title]").forEach((el) => (el.textContent = q.title));
    $$("[data-q-body]").forEach((el) => (el.textContent = q.body));
    $$("[data-q-hint]").forEach((el) => (el.textContent = q.hint));
    $$("[data-q-kind]").forEach((el) => (el.textContent = q.kind));
    $$("[data-q-number]").forEach(
      (el) => (el.textContent = String(index + 1).padStart(2, "0")),
    );
    $$('[data-action="question"]').forEach((el) => {
      if (el.hasAttribute("aria-pressed"))
        el.setAttribute(
          "aria-pressed",
          String(Number(el.dataset.question) === index),
        );
    });
    $$("[data-card]").forEach((el) =>
      el.setAttribute(
        "aria-current",
        String(Number(el.dataset.card) === index),
      ),
    );
    $$("[data-progress]").forEach(
      (el) =>
        (el.textContent =
          id === 4
            ? `${index + 1} / 3 단계`
            : `0${index + 1} / 03 · ${q.kind}`),
    );
    const prev = $('[data-action="prev-step"]');
    if (prev) prev.disabled = index === 0;
    const next = $('[data-action="next-step"]');
    if (next) next.textContent = index === 2 ? "탐색 마무리 ✓" : "다음 단계 →";
    const answer = $("#answer");
    if (answer) answer.hidden = true;
    sendState();
  }
  function openModal(title, body) {
    $("#modal-title").textContent = title;
    $("#modal-body").textContent = body;
    $("#detail-modal").showModal();
  }
  function setSheet(open) {
    const el = $("#sheet-body");
    if (!el) return;
    el.hidden = !open;
    const toggle = $('[data-action="toggle-sheet"]');
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "접어서 본문 읽기" : "펼쳐서 질문 탐색";
  }
  function renderAnswer(question) {
    if (busy) return;
    busy = true;
    const selectedQuestion = state.question;
    const form = $(".composer");
    const submit = form?.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    $$('[data-action="explore"]').forEach((el) => (el.disabled = true));
    let el = $("#answer");
    if (id === 5) {
      el = document.createElement("section");
      el.className = "answer";
      el.setAttribute("role", "status");
      $("#chat-history").append(el);
    }
    if (!el) {
      busy = false;
      return;
    }
    el.hidden = false;
    el.replaceChildren();
    const tag = document.createElement("span");
    tag.className = "overline";
    tag.textContent = "DEMO / 예시 응답";
    const title = document.createElement("p");
    title.className = "answer-question";
    title.textContent = question;
    const body = document.createElement("p");
    body.textContent = "예시 답변을 준비하고 있어요…";
    el.append(tag, title, body);
    el.setAttribute("aria-busy", "true");
    setTimeout(() => {
      if (id !== 5 && selectedQuestion !== state.question) {
        busy = false;
        if (submit) submit.disabled = false;
        $$('[data-action="explore"]').forEach((b) => (b.disabled = false));
        return;
      }
      const responses = [
        "이 문장에서는 “답을 빠르게 얻는 것”과 “내용을 깊이 이해하는 것”을 구분해 볼 수 있어요. 글의 주장은 질문하는 과정이 이해를 돕는다는 전제에 기대고 있지만, 이 문장만으로 인과관계가 확인되지는 않습니다. 구체적인 사례나 비교 근거가 있는지 원문에서 확인해 보세요.",
        "반대 관점에서는 AI가 정보 탐색 시간을 줄여 더 깊이 생각할 여유를 준다고 볼 수 있어요. 답을 그대로 받아들이는지, 비교하고 검증하는지에 따라 결과가 달라질 수 있습니다. 도구 자체보다 사용하는 방식에 주목해 보세요.",
        "다음에 AI에 질문할 때, 먼저 예상 답을 한 줄 적어보세요. 답변을 받은 뒤에는 “내 생각과 무엇이 다르지?”와 “이 답이 틀릴 수 있는 조건은?”을 적어보는 작은 실험을 해볼 수 있어요.",
      ];
      body.textContent = responses[selectedQuestion];
      const note = document.createElement("p");
      note.className = "small muted";
      note.textContent =
        "디자인 체험을 위한 고정 예시입니다. 입력에 대한 실제 AI 분석은 수행하지 않습니다.";
      el.append(note);
      el.setAttribute("aria-busy", "false");
      busy = false;
      if (submit) submit.disabled = false;
      $$('[data-action="explore"]').forEach((b) => (b.disabled = false));
      el.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
      });
    }, 450);
  }
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button[data-action]");
    if (!b) return;
    const action = b.dataset.action;
    if (action === "question") {
      selectQuestion(Number(b.dataset.question));
      if (!b.hasAttribute("aria-pressed"))
        b.dataset.question = String((state.question + 1) % questions.length);
    }
    if (action === "prev-step") selectQuestion(state.question - 1);
    if (action === "next-step") {
      if (state.question < 2) selectQuestion(state.question + 1);
      else
        openModal(
          "세 가지 관점을 모두 살펴봤어요.",
          "근거를 확인하고, 반대의 관점을 생각하고, 내 경험에 연결했습니다. 이제 나만의 질문을 적거나 앞선 단계로 돌아가 생각을 더 이어가 보세요.",
        );
    }
    if (action === "explore") renderAnswer(questions[state.question].prompt);
    if (action === "expand")
      openModal(
        questions[state.question].title,
        questions[state.question].body + " " + questions[state.question].hint,
      );
    if (action === "source")
      openModal(
        "답이 쉬워진 시대, 질문은 더 중요해진다.",
        "“AI가 답을 더 빨리 줄수록, 우리는 더 좋은 질문을 해야 한다.” 좋은 질문은 당연해 보이는 전제를 잠시 멈춰 세운다. 무엇을 알고 있는지보다 무엇을 아직 모르는지 바라보게 한다. — 디자인 프리뷰용 예시 원문",
      );
    if (action === "close-modal") $("#detail-modal").close();
    if (action === "bookmark") {
      state.bookmarked = !state.bookmarked;
      b.setAttribute("aria-pressed", String(state.bookmarked));
      b.setAttribute(
        "aria-label",
        state.bookmarked ? "질문 저장 해제" : "질문 저장",
      );
      sendState();
      announce(
        state.bookmarked
          ? "이 디자인의 질문을 저장했습니다."
          : "질문 저장을 해제했습니다.",
      );
    }
    if (action === "mode") {
      $$('[data-action="mode"]').forEach((el) =>
        el.setAttribute("aria-pressed", String(el === b)),
      );
      let notice = $(".mode-notice");
      if (!notice) {
        notice = document.createElement("section");
        notice.className = "mode-notice";
        notice.setAttribute("role", "status");
        const anchor =
          $(".mode-row") || $(".index-top") || $(".inspector .modes");
        anchor.after(notice);
      }
      const mode = Number(b.dataset.mode);
      notice.hidden = mode === 2;
      notice.replaceChildren();
      const title = document.createElement("strong");
      const body = document.createElement("p");
      title.textContent = mode === 0 ? "핵심 요약" : "다른 관점";
      body.textContent =
        mode === 0
          ? "답의 속도와 이해의 깊이는 다를 수 있습니다. 질문을 통해 전제와 근거를 확인하자는 글입니다."
          : "빠른 답변이 사고 시간을 확보해 줄 수도 있습니다. 도구를 어떻게 사용하는지에 따라 결과가 달라질 수 있습니다.";
      notice.append(title, body);
    }
    if (action === "toggle-sheet") setSheet($("#sheet-body").hidden);
    if (action === "open-sheet") setSheet(true);
    if (action === "perspective")
      openModal(
        b.dataset.perspective === "support"
          ? "지지하는 근거 살펴보기"
          : "반론 살펴보기",
        b.dataset.perspective === "support"
          ? "정보를 찾는 시간이 줄면, 그 시간을 비교·검증·새로운 문제 정의에 쓸 수 있다는 관점입니다. 확보한 시간을 실제로 깊이 생각하는 데 사용하는지가 중요한 조건입니다."
          : "완성된 답을 받으면 문제를 풀기 위해 가설을 세우는 과정을 생략할 수 있다는 관점입니다. 다만 모든 사용 방식에 해당하는 것은 아니며, 답을 비판적으로 검토하는 경우와 구분해야 합니다.",
      );
    if (action === "verdict") {
      state.verdict = b.textContent;
      $$('[data-action="verdict"]').forEach((el) =>
        el.setAttribute("aria-pressed", String(el === b)),
      );
      const status = $("#verdict-status");
      status.textContent = `“${state.verdict}” — 판단을 남겼어요. 어떤 조건에서 생각이 달라질지도 질문해 보세요.`;
      status.hidden = false;
      sendState();
    }
  });
  document.addEventListener("submit", (event) => {
    if (!event.target.matches(".composer")) return;
    event.preventDefault();
    const input = event.target.elements.question;
    const value = input.value.trim();
    if (!value) {
      input.setCustomValidity("질문을 입력해 주세요.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    renderAnswer(value);
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "custom-question") {
      event.target.setCustomValidity("");
      state.draft = event.target.value;
      sendState();
    }
    if (event.target.id === "reading-note") {
      state.note = event.target.value;
      sendState();
      $("#note-status").textContent = "저장 중…";
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source !== parent) return;
    if (event.data?.type === "reading-save-result") {
      const status = $("#note-status");
      if (status)
        status.textContent = event.data.persisted
          ? "브라우저에 저장됨"
          : "이 탭에서 유지됨";
    }
  });
  const note = $("#reading-note");
  if (note) note.value = state.note;
  const draft = $("#custom-question");
  if (draft) draft.value = state.draft;
  const bookmark = $('[data-action="bookmark"]');
  if (bookmark) {
    bookmark.setAttribute("aria-pressed", String(state.bookmarked));
    bookmark.setAttribute(
      "aria-label",
      state.bookmarked ? "질문 저장 해제" : "질문 저장",
    );
  }
  if (state.verdict) {
    $$('[data-action="verdict"]').forEach((b) =>
      b.setAttribute("aria-pressed", String(b.textContent === state.verdict)),
    );
    const status = $("#verdict-status");
    if (status) {
      status.textContent = `나의 판단: ${state.verdict}`;
      status.hidden = false;
    }
  }
  selectQuestion(state.question);
}
function safeScriptJSON(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
function makePreview(id, state = {}, standalone = false) {
  const design = DESIGNS.find((d) => d.id === id) || DESIGNS[0];
  const runtime = previewRuntime.toString();
  const standaloneBridge = standalone
    ? `const storageKey='fieldnotes-reading-export-${id}';let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{}window.addEventListener('message',e=>{if(e.source!==window||e.data?.type!=='reading-preview-state')return;let persisted=false;try{localStorage.setItem(storageKey,JSON.stringify(e.data.state));persisted=true;}catch{}window.postMessage({type:'reading-save-result',persisted},'*');});(${runtime})(${id},saved,${safeScriptJSON(QUESTIONS)});`
    : `(${runtime})(${id},${safeScriptJSON(state)},${safeScriptJSON(QUESTIONS)});`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${id === 7 ? "dark" : "light"}"><title>${String(id).padStart(2, "0")} ${design.name} — AI와 함께 읽기</title><style>${PREVIEW_CSS}</style></head><body class="v${id}">${previewMarkup(id)}${modal()}<script>${standaloneBridge}<\/script></body></html>`;
}
