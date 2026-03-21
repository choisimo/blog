---
title: "[알고리즘] LIS (최장 증가 부분수열)"
date: "2025-10-22"
category: "Algorithm"
tags: ["Algorithm", "DP+이진탐색", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - LIS (최장 증가 부분수열) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

LIS는 증가 부분수열을 모두 찾는 문제가 아니라, 길이별로 "가장 작은 꼬리값"만 보존해 미래 확장 가능성을 최대화하는 문제입니다. patience sorting 해석이 왜 작동하는지 설명해 보세요.

1. `tails[len]`가 무엇을 의미하는지 정의하고, 새 값이 들어올 때 이진 탐색으로 어떤 위치를 교체하는지 추적하세요.
2. O(n^2) DP와 O(n log n) tails 방식을 비교해, 어떤 정보는 유지하고 어떤 정보는 버리는지 설명하세요.
3. 실제 LIS 경로를 복원하려면 왜 predecessor 정보가 추가로 필요해지는지 설명하세요.

## 답변할 때 포함할 것

- `tails`의 의미를 길이별로 설명할 것
- 교체가 정답 손실을 만들지 않는 이유를 적을 것
- 길이 계산과 경로 복원을 구분할 것

## 🐍 Python 구현

```python
"""
문제 085: 최장 증가 부분수열 (Longest Increasing Subsequence)
[문제] 정수 배열에서 가장 긴 순증가 부분수열의 길이를 구하라.
[아키텍트의 시선] Patience Sorting과 이진 탐색 최적화.
O(n^2) DP: dp[i] = max(dp[j]+1) for j < i, nums[j] < nums[i].
O(n log n): tails 배열 + 이진 탐색 → Patience Sorting과 동치.
실무: 버전 관리의 체인 길이, 의존성 최장 경로, 데이터 트렌드 분석.
[시간 복잡도] O(n log n) [공간 복잡도] O(n)
"""
from typing import List
import bisect

def lis_dp(nums: List[int]) -> int:
    """O(n^2) DP"""
    if not nums:
        return 0
    n = len(nums)
    dp = [1] * n
    for i in range(1, n):
        for j in range(i):
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

def lis_binary_search(nums: List[int]) -> int:
    """O(n log n) 이진 탐색"""
    tails = []
    for num in nums:
        pos = bisect.bisect_left(tails, num)
        if pos == len(tails):
            tails.append(num)
        else:
            tails[pos] = num
    return len(tails)

if __name__ == "__main__":
    assert lis_dp([10,9,2,5,3,7,101,18]) == 4  # [2,3,7,101]
    assert lis_binary_search([10,9,2,5,3,7,101,18]) == 4
    assert lis_dp([0,1,0,3,2,3]) == 4
    assert lis_binary_search([0,1,0,3,2,3]) == 4
    assert lis_dp([7,7,7,7]) == 1
    assert lis_binary_search([7,7,7,7]) == 1
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 085: 최장 증가 부분수열 (Longest Increasing Subsequence)
 *
 * [문제] 정수 배열에서 가장 긴 순증가 부분수열의 길이를 구하라.
 *
 * [아키텍트의 시선]
 * Patience Sorting과 이진 탐색 최적화.
 * O(n^2) DP: dp[i] = max(dp[j]+1) for j < i, nums[j] < nums[i].
 * O(n log n): tails 배열 + 이진 탐색 → Patience Sorting과 동치.
 * 실무: 버전 관리의 체인 길이, 의존성 최장 경로, 데이터 트렌드 분석.
 *
 * [시간 복잡도] O(n log n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P085LIS {
    // O(n^2) DP
    public static int lisDp(int[] nums) {
        if (nums.length == 0) return 0;
        int n = nums.length;
        int[] dp = new int[n];
        Arrays.fill(dp, 1);
        int maxLen = 1;
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++) {
                if (nums[j] < nums[i]) {
                    dp[i] = Math.max(dp[i], dp[j] + 1);
                }
            }
            maxLen = Math.max(maxLen, dp[i]);
        }
        return maxLen;
    }

    // O(n log n) 이진 탐색
    public static int lisBinarySearch(int[] nums) {
        List<Integer> tails = new ArrayList<>();
        for (int num : nums) {
            int pos = Collections.binarySearch(tails, num);
            if (pos < 0) pos = -(pos + 1);
            if (pos == tails.size()) {
                tails.add(num);
            } else {
                tails.set(pos, num);
            }
        }
        return tails.size();
    }

    public static void main(String[] args) {
        assert lisDp(new int[]{10,9,2,5,3,7,101,18}) == 4;  // [2,3,7,101]
        assert lisBinarySearch(new int[]{10,9,2,5,3,7,101,18}) == 4;
        assert lisDp(new int[]{0,1,0,3,2,3}) == 4;
        assert lisBinarySearch(new int[]{0,1,0,3,2,3}) == 4;
        assert lisDp(new int[]{7,7,7,7}) == 1;
        assert lisBinarySearch(new int[]{7,7,7,7}) == 1;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
