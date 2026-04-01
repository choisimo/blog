---
title: "[알고리즘] 카운팅 비트"
date: "2025-11-23"
category: "Algorithm"
tags: ["Algorithm", "DP+비트", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 카운팅 비트 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

카운팅 비트는 각 수를 독립적으로 세는 문제가 아니라, 인접한 정수들의 비트 패턴 관계를 재사용하는 DP 문제입니다. 왜 `bits[i] = bits[i >> 1] + (i & 1)` 같은 식이 성립하는지 설명해 보세요.

1. 몇 개의 작은 수에 대해 이 식이 실제로 어떤 재사용을 하는지 추적하세요.
2. 매 수마다 popcount를 처음부터 계산하는 방식과 DP 재사용 방식을 비교하세요.
3. 하드웨어 popcount 명령이 있는 경우와 없는 경우, 소프트웨어 전략이 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- 우시프트와 LSB 의미를 적을 것
- 재사용되는 하위 문제를 설명할 것
- 하드웨어 지원 유무 차이를 적을 것

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
