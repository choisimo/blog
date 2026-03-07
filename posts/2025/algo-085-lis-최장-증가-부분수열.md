---
title: "[알고리즘] LIS (최장 증가 부분수열)"
date: "2025-10-22"
category: "Algorithm"
tags: ["Algorithm", "DP+이진탐색", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - LIS (최장 증가 부분수열) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**LIS (최장 증가 부분수열)**
* 파트: Dynamic Programming
* 관련 알고리즘: DP+이진탐색

> **Architect's View**
> Patience Sorting

이 글에서는 LIS (최장 증가 부분수열) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
