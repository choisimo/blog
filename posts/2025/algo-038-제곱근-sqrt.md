---
title: "[알고리즘] 제곱근 (Sqrt)"
date: "2025-06-28"
category: "Algorithm"
tags: ["Algorithm", "이진 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 제곱근 (Sqrt) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**제곱근 (Sqrt)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 이진 탐색

> **Architect's View**
> 연속 공간의 이산화

이 글에서는 제곱근 (Sqrt) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
