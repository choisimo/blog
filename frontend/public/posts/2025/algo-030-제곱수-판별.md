---
title: "[알고리즘] 제곱수 판별"
date: "2025-06-08"
category: "Algorithm"
tags: ["Algorithm", "이진 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 제곱수 판별 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**제곱수 판별**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 이진 탐색

> **Architect's View**
> 수학적 이진 탐색과 탐색 공간

이 글에서는 제곱수 판별 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 030: 제곱수 판별 (Valid Perfect Square)
==========================================================

[문제 설명]
양의 정수 num이 완전 제곱수인지 판별하라. 내장 함수 사용 불가.

[아키텍트의 시선 - 수학적 이진 탐색과 탐색 공간 정의]
탐색 공간: [1, num] → mid² == num이면 완전 제곱수.
이진 탐색은 "정렬된 배열"뿐 아니라 "단조 함수"에도 적용 가능.
실무: 최적값 탐색, 파라메트릭 서치의 기초.

[시간 복잡도] O(log n) [공간 복잡도] O(1)
"""


def is_perfect_square(num: int) -> bool:
    left, right = 1, num
    while left <= right:
        mid = (left + right) // 2
        sq = mid * mid
        if sq == num:
            return True
        elif sq < num:
            left = mid + 1
        else:
            right = mid - 1
    return False


if __name__ == "__main__":
    assert is_perfect_square(16) is True
    assert is_perfect_square(14) is False
    assert is_perfect_square(1) is True
    assert is_perfect_square(100) is True
    assert is_perfect_square(808201) is True  # 899²
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 030: 유효한 완전 제곱수 (Valid Perfect Square)
 *
 * [문제] 주어진 양의 정수가 완전 제곱수인지 판별하라.
 * 내장 sqrt 함수를 사용하지 말 것.
 *
 * [아키텍트의 시선]
 * 이진 탐색으로 탐색 공간을 절반씩 줄이는 것은
 * 시스템의 이분 탐색 기반 디버깅(git bisect), 성능 임계값 탐색,
 * A/B 테스트의 최적 파라미터 찾기와 동일한 원리다.
 *
 * [시간 복잡도] O(log n) [공간 복잡도] O(1)
 */
public class P030ValidPerfectSquare {
    public static boolean isPerfectSquare(int num) {
        if (num < 1) return false;
        long left = 1, right = num;
        while (left <= right) {
            long mid = left + (right - left) / 2;
            long square = mid * mid;
            if (square == num) return true;
            else if (square < num) left = mid + 1;
            else right = mid - 1;
        }
        return false;
    }

    // 뉴턴 방법 (Newton's Method)
    public static boolean isPerfectSquareNewton(int num) {
        if (num < 1) return false;
        long x = num;
        while (x * x > num) {
            x = (x + num / x) / 2;
        }
        return x * x == num;
    }

    public static void main(String[] args) {
        assert isPerfectSquare(16);
        assert !isPerfectSquare(14);
        assert isPerfectSquare(1);
        assert isPerfectSquare(100);
        assert !isPerfectSquare(2);
        assert isPerfectSquareNewton(25);
        assert !isPerfectSquareNewton(3);
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
