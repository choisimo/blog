---
title: "[알고리즘] 일일 온도 (Daily Temperatures)"
date: "2025-05-11"
category: "Algorithm"
tags: ["Algorithm", "모노토닉 스택", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 일일 온도 (Daily Temperatures) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**일일 온도 (Daily Temperatures)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 모노토닉 스택

> **Architect's View**
> 이벤트 기반 처리

이 글에서는 일일 온도 (Daily Temperatures) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
