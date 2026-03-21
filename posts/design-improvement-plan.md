# Algorithm Simulator — 디자인 개선 방안

> 작성일: 2026-03-05  
> 대상: `/public/posts/2025/algo-001 ~ algo-100` (100개) + `/public/posts/2026/` (3개)  
> 목적: iframe 임베딩 환경에서 최대한 일관된 중앙 집중형 공용 인터페이스 구현

---

## 1. 현황 스캔 요약

전체 103개 HTML 파일(algo × 100 + vim/teleport/opnsense × 3)을 전수 분석한 결과 아래와 같은 불일치가 확인됐다.

### 1.1 버튼 순서 불일치 (4가지 패턴)

| 패턴         | 버튼 순서                                    | 파일 수 |
| ------------ | -------------------------------------------- | ------- |
| **B** (권장) | `Prev \| Play \| Pause \| Next \| Reset`     | 41개    |
| **A**        | `Reset \| Prev \| Play \| Pause \| Next`     | 33개    |
| **C**        | `Prev \| Play \| Pause \| Next` (Reset 없음) | 11개    |
| **D**        | `Reset \| Play` (단순형)                     | 7개     |
| **E** (2026) | 제각각 (vim/opnsense)                        | 3개     |

### 1.2 Step 카운터 ID 불일치

| ID / 패턴                                | 파일 수 |
| ---------------------------------------- | ------- |
| `id="step-info"` + `Step N / M` 형식     | 51개    |
| `id="step-counter"` + `Step: N / M` 형식 | 32개    |
| step 카운터 없음                         | 17개    |

### 1.3 Speed Slider 범위 불일치 (12가지 조합)

| 범위 설정                    | 파일 수 |
| ---------------------------- | ------- |
| `min=100 max=2000 value=800` | 32개    |
| `min=300 max=1500 value=700` | 16개    |
| `min=400 max=1800 value=900` | 9개     |
| `min=300 max=1500 value=800` | 7개     |
| `min=400 max=2000 value=900` | 6개     |
| 기타 7가지                   | 23개    |
| Speed slider 없음            | 7개     |

### 1.4 Speed 레이블 표시 불일치

| 상태                          | 파일 수 |
| ----------------------------- | ------- |
| `Speed:` 레이블 있음          | 48개    |
| 레이블 없음 (슬라이더만 있음) | 52개    |

### 1.5 버튼 아이콘 불일치

**Prev 버튼:**

| 아이콘            | 파일 수 |
| ----------------- | ------- |
| `⏮ Prev`         | 40개    |
| `◀ Prev`          | 33개    |
| `‹` (텍스트 없음) | 9개     |
| `‹ Prev`          | 7개     |
| `◀` (텍스트 없음) | 2개     |

**Next 버튼:**

| 아이콘            | 파일 수 |
| ----------------- | ------- |
| `Next ⏭`         | 40개    |
| `Next ▶`          | 27개    |
| `›` (텍스트 없음) | 9개     |
| `Next ›`          | 7개     |
| `▶` + `\|`        | 2개     |

**Reset 버튼:**

| 아이콘             | 파일 수 |
| ------------------ | ------- |
| `Reset` (텍스트만) | 40개    |
| `↺ Reset`          | 29개    |
| `↺` (아이콘만)     | 11개    |
| `🔄 처음으로`      | 7개     |

### 1.6 이벤트 바인딩 방식 불일치

| 방식                                       | 파일 수 |
| ------------------------------------------ | ------- |
| `addEventListener` 전용                    | 64개    |
| `onclick` 인라인 + `addEventListener` 혼재 | 36개    |
| `onclick` 인라인 전용                      | 0개     |

### 1.7 CSS 변수 세트 불일치

| 변수 세트                                                            | 파일 수 |
| -------------------------------------------------------------------- | ------- |
| 기본 9개 (`accent,bg,border,danger,hl,panel,primary,primary-h,text`) | 89개    |
| 확장형 (sorting 시각화용 22개)                                       | 6개     |
| 기타 변형                                                            | 5개     |
| 2026 파일 3개 (완전히 다른 네이밍)                                   | —       |

### 1.8 `type="button"` 속성 누락

| 상태                    | 파일 수 |
| ----------------------- | ------- |
| `type="button"` 있음    | 96개    |
| 누락 (form submit 위험) | 4개     |

### 1.9 모달 팝업 (`btn-info`) 적용 현황

| 상태                                                        | 파일 수 |
| ----------------------------------------------------------- | ------- |
| algo-001 ~ algo-100: `btn-info` / `modal-overlay` 적용 완료 | 100개   |
| 2026 파일 3개 (vim/teleport/opnsense): 미적용               | 3개     |

### 1.10 2026 파일 특이사항

| 파일                                  | 테마                   | CSS 변수 네이밍                               | 모달 |
| ------------------------------------- | ---------------------- | --------------------------------------------- | ---- |
| `vim-simulator.html`                  | 다크                   | `--bg-color`, `--panel-bg`, `--primary-hover` | 없음 |
| `teleport-paging-simulation.html`     | 다크+라이트 혼재       | `--bg`, `--panel-bg`, `rgba` 패널             | 없음 |
| `opnsense-policy-step-simulator.html` | **라이트** (`#f4f7fb`) | `--bg: #f4f7fb`, `--panel: #ffffff`           | 없음 |

---

## 2. 공용 디자인 시스템 표준안 (iframe 임베딩 최적화)

> iframe으로 블로그 포스트에 임베딩되므로 다음 원칙을 우선한다:
>
> - **자기 완결형**: 외부 CDN 의존 없이 inline CSS/JS로 완결
> - **고정 높이 대응**: iframe 높이에 맞게 내부 레이아웃이 자연스럽게 수축
> - **다크 테마 고정**: 블로그 포스트 배경(다크)과 일치

### 2.1 CSS 변수 표준안

```css
:root {
  /* 배경 */
  --bg: #1e1e1e; /* 페이지 배경 */
  --panel: #252526; /* 카드/패널 배경 */

  /* 텍스트 */
  --text: #d4d4d4; /* 기본 텍스트 */

  /* 경계 */
  --border: #3e3e42; /* 테두리 */

  /* 브랜드 */
  --primary: #007acc; /* 주요 액션 */
  --primary-h: #005999; /* 호버 상태 */

  /* 의미 색상 */
  --accent: #4caf50; /* 성공/완료 */
  --danger: #f44336; /* 위험/삭제 */
  --hl: #264f78; /* 하이라이트 행 */
}
```

**정의 원칙:**

- 변수명은 반드시 위 9개를 기본으로 사용
- 시각화 전용 색상(swap/read/write 등)은 `:root` 뒤에 별도 블록으로 추가
- `#1e1e1e` / `#252526`는 VS Code Dark 팔레트 — 변경 금지

### 2.2 버튼 순서 표준안

```html
<div class="controls">
  <button type="button" id="btn-prev">⏮ Prev</button>
  <button type="button" id="btn-play">▶ Play</button>
  <button type="button" id="btn-pause">⏸ Pause</button>
  <button type="button" id="btn-next">Next ⏭</button>
  <button type="button" id="btn-reset">↺ Reset</button>
</div>
```

**결정 근거:** 패턴 B(`prev | play | pause | next | reset`)가 41개로 최다. 미디어 플레이어 UX 관례와도 일치.

### 2.3 버튼 아이콘 표준안

| 버튼  | 표준 표기 | 채택 이유                                        |
| ----- | --------- | ------------------------------------------------ |
| Prev  | `⏮ Prev` | 텍스트 병기로 접근성 확보, 40개 파일에서 사용 중 |
| Play  | `▶ Play`  | 유니코드 삼각형 — 모든 폰트에서 안정적           |
| Pause | `⏸ Pause` | HTML 엔티티 대신 유니코드 직접 사용              |
| Next  | `Next ⏭` | 아이콘이 텍스트 뒤 — 방향성 직관 일치            |
| Reset | `↺ Reset` | 순환 화살표 아이콘 + 텍스트                      |

### 2.4 Step 카운터 표준안

```html
<!-- HTML -->
<span id="step-info">Step 0 / 0</span>

<!-- JS 업데이트 -->
document.getElementById('step-info').textContent = `Step ${current} / ${total}`;
```

**결정 근거:** `id="step-info"` + 콜론 없는 `Step N / M` 형식이 51개로 최다.

### 2.5 Speed Slider 표준안

```html
<label
  >Speed:
  <input type="range" id="speed" min="200" max="2000" value="800" step="100" />
</label>
```

**결정 근거:**

- `min=200` — 200ms 이하는 시각적으로 분간 불가
- `max=2000` — 2초 대기가 실용적 상한
- `value=800` — 기본값 800ms (32개 파일에서 사용 중)
- `step=100` — 100ms 단위가 UX상 적절
- `Speed:` 레이블은 **항상 표시** (접근성 + 일관성)

### 2.6 헤더 레이아웃 표준안

```html
<div class="header">
  <div>
    <h2>알고리즘명 <span class="sub">— 부제목</span></h2>
  </div>
  <button class="btn-info" id="btn-info" type="button" title="설명 보기">
    ?
  </button>
</div>
```

**규칙:**

- `h2` 한 줄 + `.sub` span으로 부제목
- 오른쪽 끝에 `?` 버튼 (모달 트리거) 고정
- 헤더 배경 = `var(--panel)` — 별도 배경 지정 금지

### 2.7 모달 팝업 표준안

```html
<!-- body 최상단 (header 위) 삽입 -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <button class="modal-close" id="modal-close" type="button">✕</button>
    <h3>알고리즘명</h3>
    <section>
      <h4>📌 문제</h4>
      <p>...</p>
    </section>
    <section>
      <h4>💡 핵심 아이디어</h4>
      <ul>
        <li>...</li>
      </ul>
    </section>
    <section>
      <h4>⏱ 복잡도</h4>
      <span class="tag">시간: O(?)</span>
      <span class="tag">공간: O(?)</span>
    </section>
    <section>
      <h4>🏗 아키텍트의 시선</h4>
      <p>...</p>
    </section>
  </div>
</div>
```

```js
// JS (스크립트 맨 끝에 추가)
const modal = document.getElementById("modal");
document
  .getElementById("btn-info")
  .addEventListener("click", () => modal.classList.add("open"));
document
  .getElementById("modal-close")
  .addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("open");
});
```

### 2.8 이벤트 바인딩 표준안

- **`addEventListener` 전용** 사용 — `onclick=""` 인라인 금지
- 단, 레거시 파일 리팩토링 시 로직 버그 방지를 위해 `onclick` → `addEventListener` 전환은 별도 작업으로 진행

### 2.9 폰트 표준안

```css
body {
  font-family: "JetBrains Mono", monospace;
}
```

**현황:** 100개 전체가 이미 JetBrains Mono 사용 중. 유지.

### 2.10 `type="button"` 의무화

모든 `<button>` 요소에 `type="button"` 명시. (폼 안에 있을 경우 submit 방지)

---

## 3. 공통 CSS 스니펫 (표준 블록)

아래를 각 파일의 `<style>` 최상단에 공통으로 사용한다.

```css
/* ===== DESIGN SYSTEM: algo-simulator-v2 ===== */
:root {
  --bg: #1e1e1e;
  --panel: #252526;
  --text: #d4d4d4;
  --border: #3e3e42;
  --primary: #007acc;
  --primary-h: #005999;
  --accent: #4caf50;
  --danger: #f44336;
  --hl: #264f78;
}
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  background: var(--bg);
  color: var(--text);
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.header h2 {
  font-size: 15px;
  font-weight: 700;
}
.header .sub {
  font-size: 12px;
  color: #888;
  font-weight: 400;
}

/* Info Button */
.btn-info {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.btn-info:hover {
  background: var(--primary);
  border-color: var(--primary);
}

/* Controls */
.controls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.controls button {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  transition: background 0.15s;
}
.controls button:hover {
  background: var(--primary);
  border-color: var(--primary);
}
.controls #btn-play {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.controls #btn-play:hover {
  filter: brightness(1.1);
}
.controls #btn-reset {
  color: var(--danger);
  border-color: var(--danger);
}
.controls #btn-reset:hover {
  background: var(--danger);
  color: #fff;
}

/* Step info + speed */
#step-info {
  font-size: 11px;
  color: #888;
  margin-left: auto;
  white-space: nowrap;
}
.speed-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.speed-wrap input[type="range"] {
  width: 80px;
  accent-color: var(--primary);
}

/* Modal */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  align-items: center;
  justify-content: center;
}
.modal-overlay.open {
  display: flex;
}
.modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  max-width: 560px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}
.modal h3 {
  font-size: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
.modal section {
  margin-bottom: 14px;
}
.modal h4 {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--primary);
}
.modal p,
.modal li {
  font-size: 12px;
  line-height: 1.6;
}
.modal ul {
  padding-left: 16px;
}
.tag {
  display: inline-block;
  background: var(--hl);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
  margin: 2px 4px 2px 0;
}
/* ===== END DESIGN SYSTEM ===== */
```

---

## 4. iframe 임베딩 가이드라인

블로그 포스트에서 `<iframe>` 으로 시뮬레이터를 임베딩할 경우:

```html
<iframe
  src="/posts/2025/algo-001-two-sum-simulator.html"
  width="100%"
  height="520"
  style="border:none; border-radius:8px; background:#1e1e1e;"
  loading="lazy"
></iframe>
```

**결정 원칙:**

| 항목        | 권장 값         | 이유                                       |
| ----------- | --------------- | ------------------------------------------ |
| `height`    | `480px ~ 560px` | controls 1행 + 시각화 영역 + 코드패널 기준 |
| `width`     | `100%`          | 블로그 본문 너비에 맞춤                    |
| `border`    | `none`          | 다크 배경으로 경계 자연스러움              |
| `loading`   | `lazy`          | 포스트 내 다수 임베딩 시 성능 최적화       |
| `scrolling` | (기본)          | 내부 콘텐츠가 넘칠 경우 내부 스크롤 허용   |

**주의:**

- `overflow-y: auto` 를 `body` 또는 main wrapper에 설정하여 내부 스크롤 처리
- `position: fixed` 모달은 iframe 내부 기준으로 동작 — 외부 페이지에 오버레이 불가. 이는 의도된 동작.
- 2026 파일(`opnsense`)의 라이트 테마는 iframe 내에서 배경색 불일치 발생 — 다크 테마로 통일 필요

---

## 5. 파일별 불일치 현황 요약 (100개)

| 불일치 항목           | 현재                                | 목표                                             | 영향 파일 수 |
| --------------------- | ----------------------------------- | ------------------------------------------------ | ------------ |
| 버튼 순서             | 4가지 패턴 혼재                     | `Prev\|Play\|Pause\|Next\|Reset` 통일            | 59개         |
| Step 카운터 ID        | `step-info` / `step-counter` / 없음 | `step-info` 통일                                 | 49개         |
| Speed slider 범위     | 12가지 조합                         | `min=200 max=2000 value=800 step=100`            | 68개         |
| Speed 레이블          | 있음/없음 혼재                      | `Speed:` 레이블 항상 표시                        | 52개         |
| 버튼 아이콘           | 각각 2~5가지 혼재                   | `⏮ Prev / ▶ Play / ⏸ Pause / Next ⏭ / ↺ Reset` | ~60개        |
| `type="button"` 누락  | 4개                                 | 전체 명시                                        | 4개          |
| `onclick` 인라인 혼재 | 36개                                | `addEventListener` 전용                          | 36개         |
| CSS 변수 세트         | 5가지 변형                          | 기본 9개 세트 + 선택적 확장                      | 11개         |
| 모달 미적용 (2026)    | 3개                                 | btn-info + modal-overlay 추가                    | 3개          |
| 2026 다크 테마 불일치 | 3개 중 1개(opnsense 라이트)         | 다크 `#1e1e1e` 통일                              | 1개          |

---

## 6. 리팩토링 우선순위

### Phase 1 — 즉시 적용 가능 (단순 치환)

1. `id="step-counter"` → `id="step-info"` (32개)
2. `type="button"` 누락 4개 보완
3. Speed slider: `min/max/value/step` 값 표준화

### Phase 2 — 아이콘/레이블 통일

4. 버튼 아이콘 텍스트 통일 (`⏮ Prev`, `Next ⏭` 등)
5. `Speed:` 레이블 일괄 추가 (52개)
6. Reset 버튼 아이콘 `↺ Reset` 통일

### Phase 3 — 구조 변경

7. 버튼 순서 통일 (패턴 A/C/D → 패턴 B)
8. `onclick` 인라인 → `addEventListener` 전환 (36개, 로직 검증 필수)

### Phase 4 — 2026 파일 통합

9. `vim-simulator.html`: CSS 변수명 → 표준안으로 정리, `btn-info` 모달 추가
10. `teleport-paging-simulation.html`: 다크 테마 통일, 모달 추가
11. `opnsense-policy-step-simulator.html`: 라이트 → 다크 테마 전환, 모달 추가

---

## 7. 공용 시뮬레이터 쉘 템플릿

아래 템플릿을 신규 파일 생성 시 기준으로 사용한다.

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>ALGO-NNN 알고리즘명</title>
    <style>
      /* [공통 CSS 스니펫 — 섹션 3 참조] */
      /* 파일별 추가 스타일 */
      .viz {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <!-- Modal -->
    <div class="modal-overlay" id="modal">
      <div class="modal">
        <button class="modal-close" id="modal-close" type="button">✕</button>
        <h3>알고리즘명</h3>
        <section>
          <h4>📌 문제</h4>
          <p></p>
        </section>
        <section>
          <h4>💡 핵심 아이디어</h4>
          <ul>
            <li></li>
          </ul>
        </section>
        <section>
          <h4>⏱ 복잡도</h4>
          <span class="tag">시간: O(?)</span><span class="tag">공간: O(?)</span>
        </section>
        <section>
          <h4>🏗 아키텍트의 시선</h4>
          <p></p>
        </section>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <div>
        <h2>알고리즘명 <span class="sub">— 부제목</span></h2>
      </div>
      <button class="btn-info" id="btn-info" type="button" title="설명 보기">
        ?
      </button>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button type="button" id="btn-prev">⏮ Prev</button>
      <button type="button" id="btn-play">▶ Play</button>
      <button type="button" id="btn-pause">⏸ Pause</button>
      <button type="button" id="btn-next">Next ⏭</button>
      <button type="button" id="btn-reset">↺ Reset</button>
      <span id="step-info">Step 0 / 0</span>
      <div class="speed-wrap">
        <label>Speed:</label>
        <input
          type="range"
          id="speed"
          min="200"
          max="2000"
          value="800"
          step="100"
        />
      </div>
    </div>

    <!-- Visualization -->
    <div class="viz" id="viz"></div>

    <script>
      // ===== 알고리즘 로직 =====
      const steps = [];
      let currentStep = -1;
      let playTimer = null;

      function buildSteps() {
        /* TODO */
      }
      function renderStep(i) {
        /* TODO */
      }
      function updateUI() {
        document.getElementById("step-info").textContent =
          `Step ${currentStep + 1} / ${steps.length}`;
      }

      // Controls
      document.getElementById("btn-play").addEventListener("click", play);
      document.getElementById("btn-pause").addEventListener("click", pause);
      document.getElementById("btn-prev").addEventListener("click", () => {
        pause();
        if (currentStep > 0) {
          currentStep--;
          renderStep(currentStep);
          updateUI();
        }
      });
      document.getElementById("btn-next").addEventListener("click", () => {
        pause();
        if (currentStep < steps.length - 1) {
          currentStep++;
          renderStep(currentStep);
          updateUI();
        }
      });
      document.getElementById("btn-reset").addEventListener("click", reset);

      function play() {
        if (currentStep >= steps.length - 1) reset();
        clearInterval(playTimer);
        const delay = () =>
          2200 - Number(document.getElementById("speed").value);
        playTimer = setInterval(() => {
          if (currentStep < steps.length - 1) {
            currentStep++;
            renderStep(currentStep);
            updateUI();
          } else pause();
        }, delay());
      }
      function pause() {
        clearInterval(playTimer);
        playTimer = null;
      }
      function reset() {
        pause();
        currentStep = -1;
        renderStep(-1);
        updateUI();
      }

      // Modal
      const modal = document.getElementById("modal");
      document
        .getElementById("btn-info")
        .addEventListener("click", () => modal.classList.add("open"));
      document
        .getElementById("modal-close")
        .addEventListener("click", () => modal.classList.remove("open"));
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });

      // Init
      buildSteps();
      reset();
    </script>
  </body>
</html>
```

---

## 8. 스크린샷 촬영 결과

대표 카테고리별 스크린샷을 촬영해 시각적 불일치를 확인했다.

| 파일                   | 스크린샷                                           | 주요 불일치 관찰                               |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------- | ------ |
| algo-001 (two-sum)     | `ss-algo001-initial.png`, `ss-algo001-playing.png` | **기준 파일** — 패턴 B, `⏮ Prev`, `step-info` |
| algo-015 (stack)       | `ss-algo015-stack-initial.png`                     | 패턴 A (reset first), `◀ Prev`                 |
| algo-021 (3sum)        | `ss-algo021-twopointer-initial.png`                | 패턴 B, `↺ Reset`                              |
| algo-031 (merge sort)  | `ss-algo031-mergesort-initial.png`                 | 패턴 C (reset 없음), `step-counter` id         |
| algo-045 (backtrack)   | `ss-algo045-backtrack-initial.png`                 | 패턴 B                                         |
| algo-051 (tree)        | `ss-algo051-tree-initial.png`                      | 패턴 B                                         |
| algo-061 (heap)        | `ss-algo061-heap-initial.png`                      | 패턴 D (단순형 `reset                          | play`) |
| algo-071 (dijkstra)    | `ss-algo071-dijkstra-initial.png`                  | 패턴 A, step 카운터 없음                       |
| algo-083 (dp)          | `ss-algo083-dp-initial.png`                        | 패턴 B, `step-counter` id                      |
| algo-091 (trie)        | `ss-algo091-trie-initial.png`                      | 패턴 B                                         |
| vim-simulator (2026)   | `ss-vim-initial.png`                               | 완전히 다른 UI 패턴                            |
| teleport-paging (2026) | `ss-teleport-initial.png`                          | 다크+라이트 혼재                               |
| opnsense (2026)        | `ss-opnsense-initial.png`                          | 라이트 테마 — 블로그 포스트와 불일치           |

---

_이 문서는 향후 리팩토링 작업의 기준 문서로 사용한다._
