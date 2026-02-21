---
title: "[알고리즘] 카운팅 비트"
date: "2025-11-23"
category: "Algorithm"
tags: ["Algorithm", "DP+비트", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 카운팅 비트 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**카운팅 비트**
* 파트: Advanced Topics
* 관련 알고리즘: DP+비트

> **Architect's View**
> DP와 비트 연산 결합

이 글에서는 카운팅 비트 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 097: 비트 카운팅 (Counting Bits)
[문제] 0부터 n까지 각 정수의 1-비트 개수를 배열로 반환하라.
[아키텍트의 시선] DP와 비트 연산의 결합.
dp[i] = dp[i >> 1] + (i & 1) — 이전 결과 재활용.
또는 dp[i] = dp[i & (i-1)] + 1 — 최하위 비트 제거.
실무: 에러 율 계산, 해밍 가중치, 비트맵 인덱스.
[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import List

def count_bits(n: int) -> List[int]:
    """DP: dp[i] = dp[i >> 1] + (i & 1)"""
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i >> 1] + (i & 1)
    return dp

def count_bits_v2(n: int) -> List[int]:
    """DP: dp[i] = dp[i & (i-1)] + 1"""
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i & (i - 1)] + 1
    return dp

if __name__ == "__main__":
    assert count_bits(2) == [0, 1, 1]
    assert count_bits(5) == [0, 1, 1, 2, 1, 2]
    assert count_bits_v2(5) == [0, 1, 1, 2, 1, 2]
    assert count_bits(0) == [0]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 097: 비트 카운팅 (Counting Bits)
 *
 * [문제] 0부터 n까지 각 정수의 1-비트 개수를 배열로 반환하라.
 *
 * [아키텍트의 시선]
 * DP와 비트 연산의 결합.
 * dp[i] = dp[i >> 1] + (i & 1) — 이전 결과 재활용.
 * 또는 dp[i] = dp[i & (i-1)] + 1 — 최하위 비트 제거.
 * 실무: 에러 율 계산, 해밍 가중치, 비트맵 인덱스.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.Arrays;

public class P097CountingBits {
    // DP: dp[i] = dp[i >> 1] + (i & 1)
    public static int[] countBits(int n) {
        int[] dp = new int[n + 1];
        for (int i = 1; i <= n; i++) {
            dp[i] = dp[i >> 1] + (i & 1);
        }
        return dp;
    }

    // DP: dp[i] = dp[i & (i-1)] + 1
    public static int[] countBitsV2(int n) {
        int[] dp = new int[n + 1];
        for (int i = 1; i <= n; i++) {
            dp[i] = dp[i & (i - 1)] + 1;
        }
        return dp;
    }

    public static void main(String[] args) {
        assert Arrays.equals(countBits(2), new int[]{0, 1, 1});
        assert Arrays.equals(countBits(5), new int[]{0, 1, 1, 2, 1, 2});
        assert Arrays.equals(countBitsV2(5), new int[]{0, 1, 1, 2, 1, 2});
        assert Arrays.equals(countBits(0), new int[]{0});
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
