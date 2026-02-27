---
title: "[알고리즘] 부분 배열의 합 (Subarray Sum)"
date: "2025-05-25"
category: "Algorithm"
tags: ["Algorithm", "누적합+해시맵", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 부분 배열의 합 (Subarray Sum) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**부분 배열의 합 (Subarray Sum)**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 누적합+해시맵

> **Architect's View**
> Prefix Sum과 역 매핑

이 글에서는 부분 배열의 합 (Subarray Sum) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 024: 부분 배열의 합 (Subarray Sum Equals K)
==========================================================

[문제 설명]
정수 배열에서 합이 k인 연속 부분 배열의 개수를 구하라.

[아키텍트의 시선 - 누적합(Prefix Sum)과 역 매핑 최적화]
prefix_sum[j] - prefix_sum[i] = k → prefix_sum[i] = prefix_sum[j] - k
해시맵으로 "과거의 누적합"을 기록하여 O(1)에 검색.
실무: 시계열 데이터의 구간 합 쿼리, 금융 거래 집계.

[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import List
from collections import defaultdict


def subarray_sum(nums: List[int], k: int) -> int:
    count = 0
    prefix_sum = 0
    prefix_map = defaultdict(int)
    prefix_map[0] = 1

    for num in nums:
        prefix_sum += num
        count += prefix_map[prefix_sum - k]
        prefix_map[prefix_sum] += 1

    return count


if __name__ == "__main__":
    assert subarray_sum([1, 1, 1], 2) == 2
    assert subarray_sum([1, 2, 3], 3) == 2
    assert subarray_sum([1, -1, 0], 0) == 3
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 024: 부분 배열의 합 (Subarray Sum Equals K)
 *
 * [문제] 연속 부분 배열의 합이 k가 되는 경우의 수를 구하라.
 *
 * [아키텍트의 시선]
 * 누적합(Prefix Sum) + 해시맵은 O(n)에 구간 합 질의를 처리하는 핵심 기법이다.
 * 이는 시계열 데이터베이스의 범위 집계, 재무 시스템의 누적 거래 분석,
 * 네트워크 트래픽의 구간별 대역폭 계산과 동일한 원리다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P024SubarraySum {
    public static int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> prefixCount = new HashMap<>();
        prefixCount.put(0, 1); // 빈 부분 배열(합 0)이 1개 존재
        int count = 0, prefixSum = 0;

        for (int num : nums) {
            prefixSum += num;
            // prefixSum - k가 이전에 등장했다면, 그 지점부터 현재까지의 합이 k
            count += prefixCount.getOrDefault(prefixSum - k, 0);
            prefixCount.merge(prefixSum, 1, Integer::sum);
        }
        return count;
    }

    public static void main(String[] args) {
        assert subarraySum(new int[]{1, 1, 1}, 2) == 2;
        assert subarraySum(new int[]{1, 2, 3}, 3) == 2;
        assert subarraySum(new int[]{1, -1, 0}, 0) == 3;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
