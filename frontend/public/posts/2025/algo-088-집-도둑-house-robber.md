---
title: "[알고리즘] 집 도둑 (House Robber)"
date: "2025-10-30"
category: "Algorithm"
tags: ["Algorithm", "선택/비선택 DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 집 도둑 (House Robber) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

House Robber는 인접 제약이 걸린 선형 자원 선택 최적화 문제입니다. 각 집에서의 결정이 바로 다음 집의 선택 가능성을 바꾸므로, 왜 "직전까지의 최적 상태 두 개"만 알면 충분한지 설명해 보세요.

1. `take`와 `skip` 또는 `dp[i-1], dp[i-2]`가 무엇을 의미하는지 추적하고, 현재 집을 털 때와 안 털 때 전이가 어떻게 달라지는지 설명하세요.
2. 완전 탐색, 메모이제이션, 상수 메모리 DP를 비교하세요.
3. 원형 배치, 트리형 배치로 확장될 때 왜 상태 공간이 달라지는지 설명하세요.

## 답변할 때 포함할 것

- 인접 제약을 명시할 것
- 두 상태만 남기는 이유를 설명할 것
- 선형/원형/트리 변형을 구분할 것

## 🐍 Python 구현

```python
"""
문제 088: 집 도둑 (House Robber)
[문제] 일렬 집들의 금액 nums[]에서 인접한 집을 털 수 없을 때 최대 금액을 구하라.
[아키텍트의 시선] 상태 정의의 핵심 — 선택/비선택 DP.
dp[i] = max(dp[i-1], dp[i-2] + nums[i])
'현재를 선택하면 이전 불가, 선택 안 하면 이전까지의 최적 유지'
실무: 자원 할당에서 충돌 제약, 스케줄링 제약, 독립 집합 최적화.
[시간 복잡도] O(n) [공간 복잡도] O(1)
"""
from typing import List

def rob(nums: List[int]) -> int:
    """선형 배열"""
    if not nums:
        return 0
    if len(nums) <= 2:
        return max(nums)
    prev2, prev1 = nums[0], max(nums[0], nums[1])
    for i in range(2, len(nums)):
        curr = max(prev1, prev2 + nums[i])
        prev2, prev1 = prev1, curr
    return prev1

def rob_circular(nums: List[int]) -> int:
    """원형 배열 (House Robber II)"""
    if len(nums) == 1:
        return nums[0]
    def rob_range(start, end):
        prev2 = prev1 = 0
        for i in range(start, end):
            curr = max(prev1, prev2 + nums[i])
            prev2, prev1 = prev1, curr
        return prev1
    return max(rob_range(0, len(nums)-1), rob_range(1, len(nums)))

if __name__ == "__main__":
    assert rob([1,2,3,1]) == 4  # 1+3
    assert rob([2,7,9,3,1]) == 12  # 2+9+1
    assert rob([2,1,1,2]) == 4  # 2+2
    # 원형
    assert rob_circular([2,3,2]) == 3
    assert rob_circular([1,2,3,1]) == 4
    assert rob_circular([1,2,3]) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 088: 집 도둑 (House Robber)
 *
 * [문제] 일렬 집들의 금액 nums[]에서 인접한 집을 털 수 없을 때 최대 금액을 구하라.
 *
 * [아키텍트의 시선]
 * 상태 정의의 핵심 — 선택/비선택 DP.
 * dp[i] = max(dp[i-1], dp[i-2] + nums[i])
 * '현재를 선택하면 이전 불가, 선택 안 하면 이전까지의 최적 유지'
 * 실무: 자원 할당에서 충돌 제약, 스케줄링 제약, 독립 집합 최적화.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */

public class P088HouseRobber {
    // 선형 배열
    public static int rob(int[] nums) {
        if (nums.length == 0) return 0;
        if (nums.length == 1) return nums[0];
        if (nums.length == 2) return Math.max(nums[0], nums[1]);
        int prev2 = nums[0], prev1 = Math.max(nums[0], nums[1]);
        for (int i = 2; i < nums.length; i++) {
            int curr = Math.max(prev1, prev2 + nums[i]);
            prev2 = prev1;
            prev1 = curr;
        }
        return prev1;
    }

    // 원형 배열 (House Robber II)
    public static int robCircular(int[] nums) {
        if (nums.length == 1) return nums[0];
        return Math.max(robRange(nums, 0, nums.length - 2),
                        robRange(nums, 1, nums.length - 1));
    }
    private static int robRange(int[] nums, int start, int end) {
        int prev2 = 0, prev1 = 0;
        for (int i = start; i <= end; i++) {
            int curr = Math.max(prev1, prev2 + nums[i]);
            prev2 = prev1;
            prev1 = curr;
        }
        return prev1;
    }

    public static void main(String[] args) {
        assert rob(new int[]{1,2,3,1}) == 4;     // 1+3
        assert rob(new int[]{2,7,9,3,1}) == 12;  // 2+9+1
        assert rob(new int[]{2,1,1,2}) == 4;     // 2+2
        // 원형
        assert robCircular(new int[]{2,3,2}) == 3;
        assert robCircular(new int[]{1,2,3,1}) == 4;
        assert robCircular(new int[]{1,2,3}) == 3;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
