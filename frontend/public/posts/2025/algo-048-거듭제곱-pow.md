---
title: "[알고리즘] 거듭제곱 (Pow)"
date: "2025-07-22"
category: "Algorithm"
tags: ["Algorithm", "분할 정복", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 거듭제곱 (Pow) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**거듭제곱 (Pow)**
* 파트: Recursion & Backtracking
* 관련 알고리즘: 분할 정복

> **Architect's View**
> 지수적 축소와 재귀 깊이

이 글에서는 거듭제곱 (Pow) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 048: 거듭제곱 (Pow(x, n))
[문제] x^n을 O(log n)에 계산하라.
[아키텍트의 시선] 분할 정복 거듭제곱 (Fast Exponentiation).
x^n = (x^(n/2))² → 지수를 절반씩 줄임.
실무: 암호학(RSA), 행렬 거듭제곱(피보나치 O(log n)).
[시간 복잡도] O(log n) [공간 복잡도] O(log n) 또는 O(1) 반복
"""

def my_pow(x: float, n: int) -> float:
    if n < 0:
        x = 1 / x
        n = -n
    result = 1
    while n > 0:
        if n % 2 == 1:
            result *= x
        x *= x
        n //= 2
    return result

if __name__ == "__main__":
    assert abs(my_pow(2.0, 10) - 1024.0) < 1e-9
    assert abs(my_pow(2.1, 3) - 9.261) < 1e-3
    assert abs(my_pow(2.0, -2) - 0.25) < 1e-9
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 048: 거듭제곱 (Pow(x, n))
 *
 * [문제] x의 n제곱을 계산하라. 분할 정복으로 O(log n)에 해결.
 *
 * [아키텍트의 시선]
 * 반복 제곱법(Exponentiation by Squaring)은 암호학의 모듈러 거듭제곱,
 * 행렬 거듭제곱을 이용한 피보나치 계산, 그래프의 k-hop 도달성 분석에
 * 직접 활용된다. O(n) → O(log n) 최적화의 전형이다.
 *
 * [시간 복잡도] O(log n) [공간 복잡도] O(1)
 */
public class P048Pow {
    public static double myPow(double x, int n) {
        long N = n; // int 오버플로우 방지
        if (N < 0) {
            x = 1 / x;
            N = -N;
        }
        double result = 1.0;
        double current = x;
        while (N > 0) {
            if ((N & 1) == 1) result *= current; // 홀수면 곱하기
            current *= current; // 제곱
            N >>= 1;
        }
        return result;
    }

    public static void main(String[] args) {
        assert Math.abs(myPow(2.0, 10) - 1024.0) < 1e-9;
        assert Math.abs(myPow(2.1, 3) - 9.261) < 1e-3;
        assert Math.abs(myPow(2.0, -2) - 0.25) < 1e-9;
        assert Math.abs(myPow(1.0, Integer.MIN_VALUE) - 1.0) < 1e-9;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
