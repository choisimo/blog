---
title: "[알고리즘] 일일 온도 (Daily Temperatures)"
date: "2025-05-11"
category: "Algorithm"
tags: ["Algorithm", "모노토닉 스택", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 일일 온도 (Daily Temperatures) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

일일 온도 문제는 "다음 더 큰 값"을 찾는 것이 아니라, 아직 해답이 확정되지 않은 이벤트들을 어떤 순서로 보류해야 미래 입력이 도착하는 순간 즉시 정산할 수 있는가를 묻는 문제입니다. 모노토닉 스택이 왜 미해결 요청 큐처럼 동작하는지 설명해 보세요.

1. 온도 배열을 왼쪽에서 오른쪽으로 읽을 때, 스택에 들어 있는 인덱스들이 어떤 정렬 관계를 유지하는지 추적하고 그 의미를 설명하세요.
2. 각 인덱스가 스택에 한 번 들어가고 한 번만 나오는 이유를 통해 왜 전체 복잡도가 O(n)인지 증명하세요.
3. 동일한 문제를 힙이나 브루트포스 스캔으로 풀 때와 비교해, 지연 시간과 메모리 패턴이 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- push/pop이 일어나는 시점을 배열 값과 함께 적을 것
- 스택 단조성이 의미하는 바를 정의할 것
- amortized 분석을 빠뜨리지 말 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 018: 일일 온도 (Daily Temperatures)
==========================================================

[문제 설명]
일일 온도 배열이 주어질 때, 각 날짜에 대해
더 따뜻한 날이 오기까지 며칠을 기다려야 하는지 구하라.

[아키텍트의 시선 - 모노토닉 스택과 이벤트 기반 처리]
모노토닉(단조) 스택: 스택에 "아직 답을 찾지 못한 인덱스"를 유지.
새 값이 들어올 때 이전 미해결 문제들을 한꺼번에 해결.
실무: 주가 분석(다음 큰 값), 이벤트 큐 처리, 모니터링 알림.

[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import List


def daily_temperatures(temperatures: List[int]) -> List[int]:
    n = len(temperatures)
    result = [0] * n
    stack = []  # 모노토닉 스택: 인덱스 저장 (온도 내림차순 유지)

    for i, temp in enumerate(temperatures):
        while stack and temperatures[stack[-1]] < temp:
            prev_idx = stack.pop()
            result[prev_idx] = i - prev_idx
        stack.append(i)

    return result


if __name__ == "__main__":
    assert daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]) == [1, 1, 4, 2, 1, 1, 0, 0]
    assert daily_temperatures([30, 40, 50, 60]) == [1, 1, 1, 0]
    assert daily_temperatures([30, 60, 90]) == [1, 1, 0]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 018: 일일 온도 (Daily Temperatures)
 *
 * [문제] 일일 온도 배열이 주어질 때, 각 날에 대해
 * 더 따뜻한 날이 며칠 후에 오는지 계산하라.
 *
 * [아키텍트의 시선]
 * 단조 스택(Monotonic Stack)은 시계열 데이터에서
 * "다음으로 큰 값까지의 거리"를 O(n)에 구하는 핵심 패턴이다.
 * 주가 분석, SLA 위반 예측, 리소스 스파이크 감지에 직접 활용된다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.Stack;
import java.util.Arrays;

public class P018DailyTemperatures {
    public static int[] dailyTemperatures(int[] temperatures) {
        int n = temperatures.length;
        int[] result = new int[n];
        Stack<Integer> stack = new Stack<>(); // 인덱스 저장

        for (int i = 0; i < n; i++) {
            // 현재 온도가 스택 top의 온도보다 높으면 → 답을 찾은 것
            while (!stack.isEmpty() && temperatures[i] > temperatures[stack.peek()]) {
                int idx = stack.pop();
                result[idx] = i - idx;
            }
            stack.push(i);
        }
        // 스택에 남은 인덱스는 더 따뜻한 날이 없음 → 0 (이미 초기화됨)
        return result;
    }

    public static void main(String[] args) {
        assert Arrays.equals(
            dailyTemperatures(new int[]{73,74,75,71,69,72,76,73}),
            new int[]{1,1,4,2,1,1,0,0});
        assert Arrays.equals(
            dailyTemperatures(new int[]{30,40,50,60}),
            new int[]{1,1,1,0});
        assert Arrays.equals(
            dailyTemperatures(new int[]{30,20,10}),
            new int[]{0,0,0});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
