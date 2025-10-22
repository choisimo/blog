---
title: "알고리즘 아틀리에: 동적 계획법(DP) — 5단계 직관 학습"
date: "2024-11-17"
category: "Algorithm"
tags: ["DP", "동적계획법", "메모이제이션", "점화식", "알고리즘 아틀리에"]
excerpt: "반복되는 하위 문제와 최적 부분 구조를 비유로 깨닫고, 점화식→테이블→코드로 잇습니다."
readTime: "7분"
---

# 알고리즘 아틀리에: 동적 계획법(DP)

## Block 1: 비유법으로 패턴 파악 (Analogy)

- Story: 산행 중 갈림길마다 최적 경로 메모를 남기는 등산가. 같은 지점에 다시 왔을 때는 메모를 읽고 즉시 결정을 내립니다. "같은 하위 문제를 반복하지 말자"가 생존 전략입니다.
- Quiz — 핵심 원칙은?
  - A. 모든 갈림길을 끝까지 탐색한다(완전탐색) (오답)
  - B. 이미 해결한 하위 문제의 답을 저장하고 재사용한다(정답)
  - C. 현재 좋아 보이는 선택만 한다(탐욕, 오답)

## Block 2: 원리 이해 (Principle)

- Core Principle: DP는 "중복되는 하위 문제"와 "최적 부분 구조"가 있을 때, 상태(state)를 정의하고 점화식으로 연결해, 하위 해의 최적성이 상위 해의 최적성을 보장하도록 한다.
- 왜 성립하는가?
  - 같은 문제는 같은 답을 갖는다(참조 투명성). 또한 최적 부분 구조가 성립하면, 부분 최적의 조합이 전체 최적이 된다.

## Block 3: 세부 작동 방식 (Mechanism)

- 예시: 동전(coin set)으로 목표 금액을 만들 때 필요한 최소 동전 수(min coins).
  - 상태: dp[x] = 금액 x를 만드는 최소 동전 수
  - 초기값: dp[0] = 0, 나머지는 ∞
  - 점화식: dp[x] = min(dp[x-c] + 1) for c in coins if x>=c
  - 순회: bottom-up으로 x=1..target을 채운다(또는 top-down + memo)
- 예측 퀴즈: dp[x]를 갱신할 때 어떤 순회가 안전한가? → x를 1부터 증가시키며 각 코인으로 갱신.

## Block 4: 자료구조 연결 (Data Structure)

- 선택지: 1차원 배열(점화식이 앞선 상태만 필요할 때) vs 2차원 테이블(예: 배낭 문제)
- 구현 팁: top-down은 재귀 + dict/배열 메모, bottom-up은 반복문 + 배열. 상태 수와 전이 수에 따라 시간/공간을 평가한다.

## Block 5: 실제 코드 문제 (Application)

- 문제: 주어진 동전 집합으로 정확히 target 금액을 만드는 데 필요한 최소 동전 수를 구하라. 불가능하면 -1.

```python
def min_coins(coins, target):
    INF = 10**9
    dp = [INF]*(target+1)
    dp[0] = 0
    for x in range(1, target+1):
        for c in coins:
            if x >= c:
                dp[x] = min(dp[x], dp[x-c] + 1)
    return dp[target] if dp[target] < INF else -1
```

- Staged Hints
  - Hint 1: "같은 하위 문제를 또 풀지 말자" — 메모부터 떠올리기.
  - Hint 2: 상태 정의가 반이다. 무엇이 상태인가? 무엇이 전이인가?
  - Hint 3: 초기값과 불가능 상태(∞) 처리에 유의.

- Test Case Visualization(개념)
  - 테이블 채워지는 과정을 열지도로 재생해, 특정 금액에서 전이가 어떻게 이뤄졌는지 추적한다.

---

요약: DP는 "반복 금지 + 최적 부분 구조"를 코드화하는 기술입니다. 상태→점화식→순회 순으로 정리하면 문제는 스스로 풀립니다.

---

## Interactive Add‑ons

<div class="mcq" data-answer="B">
  <p><strong>퀴즈:</strong> DP가 필요한 전제 조건 두 가지는?</p>
  <label><input type="checkbox" name="q-dp-1" value="A"> 탐욕 선택 속성</label><br>
  <label><input type="checkbox" name="q-dp-1" value="B"> 중복되는 하위 문제</label><br>
  <label><input type="checkbox" name="q-dp-1" value="C"> 최적 부분 구조</label><br>
  <button class="chk-submit">확인</button>
  <div class="chk-feedback" hidden></div>
</div>

<details style="margin-top: 1rem;"><summary>Hint 1</summary> 같은 질문을 두 번 풀지 않는 전략.</details>
<details><summary>Hint 2</summary> 하위 해의 최적성이 상위 해의 최적성을 보장해야 합니다.</details>

<script>
(function(){
  document.querySelectorAll('.mcq').forEach(function(box){
    var btn = box.querySelector('.chk-submit');
    var fb = box.querySelector('.chk-feedback');
    btn && btn.addEventListener('click', function(){
      var checks = box.querySelectorAll('input[type=checkbox]:checked');
      var vals = Array.from(checks).map(function(x){return x.value});
      fb.hidden = false;
      var correct = vals.includes('B') && vals.includes('C') && !vals.includes('A');
      if(correct){ fb.textContent='정답! ✅ 중복 하위 문제 + 최적 부분 구조'; fb.style.color='#065f46'; }
      else { fb.textContent='오답. 두 조건을 모두 만족해야 합니다.'; fb.style.color='#991b1b'; }
    });
  });
})();
</script>
