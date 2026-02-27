---
title: "알고리즘 아틀리에: 이분 탐색 — 5단계 직관 학습"
date: "2024-11-18"
category: "Algorithm"
tags:
  [
    "이분탐색",
    "Binary Search",
    "단조성",
    "파라메트릭 서치",
    "알고리즘 아틀리에",
  ]
excerpt: "단조성 위에 세운 불변식과 범위 수축 — 답을 직접 찾지 말고 조건을 이분합니다."
readTime: "6분"
---

# 알고리즘 아틀리에: 이분 탐색

## Block 1: 비유법으로 패턴 파악 (Analogy)

- Story: 책을 반으로 갈라 번호를 맞추는 사서. 찾는 페이지가 중간보다 크면 왼쪽을 버리고, 작으면 오른쪽을 버린다. 매번 범위를 절반으로 줄인다.
- Quiz — 핵심 원칙은?
  - A. 가운데가 정답이다 (오답)
  - B. "참/거짓"이 단조롭게 변하는 조건을 두고, 그 경계 지점을 찾는다 (정답)
  - C. 무조건 정답 후보를 직접 비교한다 (오답)

## Block 2: 원리 이해 (Principle)

- Core Principle: 단조성(monotonicity)과 불변식(invariant). 구간 [lo, hi)에서 P(x)가 거짓→참으로 한 번만 변한다고 가정하면, 탐색 중 항상 정답이 구간 안에 남도록 분기한다.
- 왜 성립하는가?
  - 매 단계 절반 제거(로그 시간) + 불변식 유지(정답 제거 금지) 덕분. 정답은 언젠가 길이가 1인 구간에 고립된다.

## Block 3: 세부 작동 방식 (Mechanism)

- 패턴 코드(최소 참 찾기):

```python
def lower_bound_ok(min_x, max_x, ok):
    lo, hi = min_x, max_x  # [lo, hi)
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo  # 최소 참의 위치
```

- 예측 퀴즈: 경계 갱신 시 어느 쪽을 버려야 하나? → ok(mid)=True면 [mid, hi)를 버리고 [lo, mid]로 수축.

## Block 4: 자료구조 연결 (Data Structure)

- 필수 전제: 정렬 또는 단조 predicate. 정렬된 배열에서 값 찾기, 혹은 파라메트릭 서치(정답 값을 매개변수로 두고 검사 함수 ok(x)로 판단) 모두 동일 원리.

## Block 5: 실제 코드 문제 (Application)

- 문제(파라메트릭 서치): 작업량 배열 jobs와 기간 D가 주어질 때, 하루 처리 용량 cap를 최소화하여 D일 내 모두 처리 가능하게 하라. 하루에 cap만큼 처리 가능하며 다음 날로 이월 가능.

```python
def min_capacity(jobs, D):
    def ok(cap):
        days, cur = 1, 0
        for w in jobs:
            if w > cap:
                return False
            if cur + w <= cap:
                cur += w
            else:
                days += 1
                cur = w
        return days <= D

    lo, hi = 1, sum(jobs)  # [lo, hi]
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

- Staged Hints
  - Hint 1: "정답 자체를 맞추지 말고, 가능/불가능을 빨리 가려라".
  - Hint 2: 불변식 — 정답은 항상 [lo, hi] 안에 남아야 한다.
  - Hint 3: 경계 조건(무한 루프 방지)과 overflow(언어별) 주의.

- Test Case Visualization(개념)
  - 각 mid에서 ok(mid) 결과를 타임라인으로 표시해, 경계가 어떻게 이동하는지 시각화한다.

---

요약: 이분 탐색은 "단조 predicate의 경계"를 로그 시간에 찾는 기술입니다. 문제를 ok(x)로 바꿔 생각하는 순간, 길이 보입니다.

---

## Interactive Add‑ons

<div class="mcq" data-answer="B">
  <p><strong>퀴즈:</strong> 이분 탐색의 본질은 무엇인가?</p>
  <label><input type="radio" name="q-bs-1" value="A"> 정답을 직접 맞춘다</label><br>
  <label><input type="radio" name="q-bs-1" value="B"> 단조 predicate의 경계를 찾는다</label><br>
  <label><input type="radio" name="q-bs-1" value="C"> 정답 후보를 모두 비교한다</label><br>
  <button class="mcq-submit">확인</button>
  <div class="mcq-feedback" hidden></div>
</div>

<details style="margin-top: 1rem;"><summary>Hint 1</summary> ok(x)로 바꿔 생각하세요: 가능/불가능.</details>
<details><summary>Hint 2</summary> 불변식: 정답은 항상 [lo, hi]에 남는다.</details>

<script>
(function(){
  document.querySelectorAll('.mcq').forEach(function(mcq){
    var answer = mcq.dataset.answer;
    var btn = mcq.querySelector('.mcq-submit');
    var fb = mcq.querySelector('.mcq-feedback');
    btn && btn.addEventListener('click', function(){
      var checked = mcq.querySelector('input[type=radio]:checked');
      fb.hidden = false;
      if(!checked){ fb.textContent='선택해주세요.'; fb.style.color='#b45309'; return; }
      if(checked.value === answer){ fb.textContent='정답! ✅'; fb.style.color='#065f46'; }
      else { fb.textContent='오답입니다. 다시 생각해보세요.'; fb.style.color='#991b1b'; }
    });
  });
})();
</script>
