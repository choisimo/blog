---
title: "[알고리즘] 제곱근 (Sqrt)"
date: "2025-06-28"
category: "Algorithm"
tags: ["Algorithm", "이진 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 제곱근 (Sqrt) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

정수 제곱근은 연속적인 수학 문제를 정수 격자 위의 경계 탐색으로 바꾸는 문제입니다. "가장 큰 `x` such that `x^2 <= n`"이라는 정의가 왜 탐색 공간을 단조 predicate로 바꿔 주는지 설명해 보세요.

1. `mid^2 <= n` 여부가 참/거짓 경계를 어떻게 만들고, 정답이 항상 왼쪽/오른쪽 어디에 남는지 추적하세요.
2. Newton 방법, 부동소수점 sqrt, 정수 이진 탐색을 오차 처리, 오버플로우 위험, 정수 정확성 관점에서 비교하세요.
3. 매우 큰 정수에서 곱셈 자체가 비싸다면, 비교 전략과 자료형 선택을 어떻게 바꿔야 하는지 설명하세요.

## 답변할 때 포함할 것

- predicate 경계를 명시할 것
- floor sqrt 정의를 정확히 적을 것
- 정수 정확성과 연속 근사의 차이를 설명할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 038: 제곱근 구하기 (Sqrt(x))
==========================================================
[문제] 음이 아닌 정수 x의 정수 제곱근을 구하라.
[아키텍트의 시선 - 연속 공간의 이산화와 근사 탐색]
f(m) = m² ≤ x인 최대 m 탐색 → 이진 탐색의 "조건 만족 최대값" 패턴.
실무: 파라메트릭 서치 (최적화 문제를 결정 문제로 변환).
[시간 복잡도] O(log x) [공간 복잡도] O(1)
"""

def my_sqrt(x: int) -> int:
    if x < 2:
        return x
    left, right = 1, x // 2
    while left <= right:
        mid = (left + right) // 2
        if mid * mid == x:
            return mid
        elif mid * mid < x:
            left = mid + 1
        else:
            right = mid - 1
    return right

if __name__ == "__main__":
    assert my_sqrt(4) == 2
    assert my_sqrt(8) == 2
    assert my_sqrt(0) == 0
    assert my_sqrt(1) == 1
    assert my_sqrt(100) == 10
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 038: 제곱근 구현 (Sqrt(x))
 *
 * [문제] 음이 아닌 정수 x의 제곱근의 정수 부분을 반환하라.
 * 내장 함수 없이 이진 탐색으로 구현.
 *
 * [아키텍트의 시선]
 * "답이 단조 증가하는 탐색 공간"에서의 이진 탐색은
 * 시스템 용량 계획, 최적 샤드 수 결정, 타임아웃 값 튜닝 등
 * 수치 최적화 문제의 일반적 해법이다.
 *
 * [시간 복잡도] O(log x) [공간 복잡도] O(1)
 */
public class P038Sqrt {
    public static int mySqrt(int x) {
        if (x < 2) return x;
        long left = 1, right = x / 2;
        while (left <= right) {
            long mid = left + (right - left) / 2;
            long sq = mid * mid;
            if (sq == x) return (int) mid;
            else if (sq < x) left = mid + 1;
            else right = mid - 1;
        }
        return (int) right; // right는 sqrt(x) 이하의 최대 정수
    }

    public static void main(String[] args) {
        assert mySqrt(4) == 2;
        assert mySqrt(8) == 2;
        assert mySqrt(0) == 0;
        assert mySqrt(1) == 1;
        assert mySqrt(16) == 4;
        assert mySqrt(2147395599) == 46339;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
