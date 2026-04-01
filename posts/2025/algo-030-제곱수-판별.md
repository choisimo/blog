---
title: "[알고리즘] 제곱수 판별"
date: "2025-06-08"
category: "Algorithm"
tags: ["Algorithm", "이진 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 제곱수 판별 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

제곱수 판별은 숫자 계산 문제가 아니라, 단조(monotonic)한 탐색 공간에서 답의 존재 여부를 경계 탐색으로 줄여 가는 문제입니다. `num=16` 같은 입력에서 왜 `mid*mid` 비교만으로 답을 좁혀 갈 수 있는지 설명해 보세요.

1. `low`, `high`, `mid`가 어떻게 변하는지 적고, 현재 구간 바깥에는 답이 없다고 말할 수 있는 근거를 불변식으로 설명하세요.
2. 선형 증가 탐색, Newton 방법, 이진 탐색을 반복 횟수, 정수 오버플로우 위험, 구현 복잡도 관점에서 비교하세요.
3. 64비트 범위나 임의 정밀도 정수에서는 `mid*mid` 자체가 위험할 수 있는데, 비교식을 어떻게 바꿔야 하는지 설명하세요.

## 답변할 때 포함할 것

- 탐색 구간 축소 과정을 단계별로 적을 것
- 단조성 가정을 명시할 것
- 오버플로우 회피 전략을 적을 것

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
