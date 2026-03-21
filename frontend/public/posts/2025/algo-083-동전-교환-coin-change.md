---
title: "[알고리즘] 동전 교환 (Coin Change)"
date: "2025-10-18"
category: "Algorithm"
tags: ["Algorithm", "완전 배낭", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 동전 교환 (Coin Change) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

동전 교환은 모든 조합을 나열하는 문제가 아니라, 금액별 최소 비용을 누적해 가며 도달 가능 상태를 확장하는 문제입니다. 왜 금액 축(amount axis)을 따라 DP를 세우면 중복 탐색이 사라지는지 설명해 보세요.

1. `dp[x]`가 어떤 의미를 가지는지 정의하고, 각 동전이 금액 상태를 어떻게 갱신하는지 추적하세요.
2. BFS on amount graph, bottom-up DP, memoization을 비교해 어떤 방식이 unreachable amount를 더 자연스럽게 표현하는지 설명하세요.
3. 동전 개수 제한이 생기거나 동전 종류가 매우 많아지면 왜 완전 배낭이 0/1 배낭과 달라지는지 설명하세요.

## 답변할 때 포함할 것

- `dp[x]`의 의미를 명시할 것
- 불가능 상태 표현을 적을 것
- coin reuse 허용 여부를 분리해서 설명할 것

## 🐍 Python 구현

```python
"""
문제 083: 동전 교환 (Coin Change)
[문제] coins[] 동전으로 amount를 만드는 최소 동전 수를 구하라. 불가능하면 -1.
[아키텍트의 시선] 완전 탐색→DP 사고 전환 (완전 배낭).
dp[i] = min(dp[i], dp[i - coin] + 1) for each coin.
탐욕(가장 큰 동전부터)은 실패 가능 → DP가 필수인 이유.
실무: 리소스 최적 할당, API 호출 최소화, 패킷 분할.
[시간 복잡도] O(amount * len(coins)) [공간 복잡도] O(amount)
"""
from typing import List

def coin_change(coins: List[int], amount: int) -> int:
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for i in range(1, amount + 1):
        for coin in coins:
            if coin <= i and dp[i - coin] + 1 < dp[i]:
                dp[i] = dp[i - coin] + 1
    return dp[amount] if dp[amount] != float('inf') else -1

def coin_change_count(coins: List[int], amount: int) -> int:
    """조합 수 (방법의 수)"""
    dp = [0] * (amount + 1)
    dp[0] = 1
    for coin in coins:
        for i in range(coin, amount + 1):
            dp[i] += dp[i - coin]
    return dp[amount]

if __name__ == "__main__":
    assert coin_change([1,5,10,25], 30) == 2  # 25+5
    assert coin_change([1,2,5], 11) == 3  # 5+5+1
    assert coin_change([2], 3) == -1
    assert coin_change([1], 0) == 0
    # 조합 수
    assert coin_change_count([1,2,5], 5) == 4  # {5, 2+2+1, 2+1+1+1, 1*5}
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 083: 동전 교환 (Coin Change)
 *
 * [문제] coins[] 동전으로 amount를 만드는 최소 동전 수를 구하라. 불가능하면 -1.
 *
 * [아키텍트의 시선]
 * 완전 탐색→DP 사고 전환 (완전 배낭).
 * dp[i] = min(dp[i], dp[i - coin] + 1) for each coin.
 * 탐욕(가장 큰 동전부터)은 실패 가능 → DP가 필수인 이유.
 * 실무: 리소스 최적 할당, API 호출 최소화, 패킷 분할.
 *
 * [시간 복잡도] O(amount * coins.length) [공간 복잡도] O(amount)
 */
import java.util.*;

public class P083CoinChange {
    // 최소 동전 수
    public static int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int i = 1; i <= amount; i++) {
            for (int coin : coins) {
                if (coin <= i && dp[i - coin] + 1 < dp[i]) {
                    dp[i] = dp[i - coin] + 1;
                }
            }
        }
        return dp[amount] > amount ? -1 : dp[amount];
    }

    // 조합 수 (방법의 수)
    public static int coinChangeCount(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        dp[0] = 1;
        for (int coin : coins) {
            for (int i = coin; i <= amount; i++) {
                dp[i] += dp[i - coin];
            }
        }
        return dp[amount];
    }

    public static void main(String[] args) {
        assert coinChange(new int[]{1,5,10,25}, 30) == 2;  // 25+5
        assert coinChange(new int[]{1,2,5}, 11) == 3;       // 5+5+1
        assert coinChange(new int[]{2}, 3) == -1;
        assert coinChange(new int[]{1}, 0) == 0;
        // 조합 수
        assert coinChangeCount(new int[]{1,2,5}, 5) == 4;   // {5, 2+2+1, 2+1+1+1, 1*5}
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
