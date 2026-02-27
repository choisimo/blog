---
title: "[알고리즘] Top K 빈출 요소"
date: "2025-08-26"
category: "Algorithm"
tags: ["Algorithm", "힙+해시맵", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - Top K 빈출 요소 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**Top K 빈출 요소**
* 파트: Heap & Graph Basics
* 관련 알고리즘: 힙+해시맵

> **Architect's View**
> 부분 정렬과 우선순위 필터링

이 글에서는 Top K 빈출 요소 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 062: Top K 빈출 요소 (Top K Frequent Elements)
[문제] 정수 배열에서 가장 빈번한 K개 원소를 반환하라.
[아키텍트의 시선] 부분 정렬과 우선순위 필터링.
전체 정렬(O(n log n)) 대신 힙으로 상위 K개만 유지(O(n log k)).
더 나은 방법: 버킷 정렬 O(n) - 빈도를 인덱스로 사용.
실무: 인기 검색어, 트래픽 상위 URL, 캐시 핫 키 분석.
[시간 복잡도] O(n) 버킷 / O(n log k) 힙 [공간 복잡도] O(n)
"""
from typing import List
from collections import Counter
import heapq

def top_k_frequent_bucket(nums: List[int], k: int) -> List[int]:
    """버킷 정렬 방식 O(n)"""
    count = Counter(nums)
    # 빈도를 인덱스로 사용하는 버킷
    buckets: List[List[int]] = [[] for _ in range(len(nums) + 1)]
    for num, freq in count.items():
        buckets[freq].append(num)
    result = []
    for freq in range(len(buckets) - 1, 0, -1):
        for num in buckets[freq]:
            result.append(num)
            if len(result) == k:
                return result
    return result

def top_k_frequent_heap(nums: List[int], k: int) -> List[int]:
    """힙 방식 O(n log k)"""
    count = Counter(nums)
    return [item for item, _ in heapq.nlargest(k, count.items(), key=lambda x: x[1])]

if __name__ == "__main__":
    assert set(top_k_frequent_bucket([1,1,1,2,2,3], 2)) == {1, 2}
    assert set(top_k_frequent_heap([1,1,1,2,2,3], 2)) == {1, 2}
    assert top_k_frequent_bucket([1], 1) == [1]
    assert set(top_k_frequent_bucket([4,4,4,1,1,2,2,2,3], 2)) == {4, 2}
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 062: 가장 빈번한 K개 원소 (Top K Frequent Elements)
 *
 * [문제] 정수 배열에서 가장 자주 등장하는 k개의 원소를 반환하라.
 *
 * [아키텍트의 시선]
 * Top-K 빈도 분석은 검색 엔진의 인기 검색어,
 * 로그 분석의 상위 오류 유형, 트래픽 분석의 핫스팟 감지에 핵심이다.
 * 힙 vs 버킷 정렬 — 시간/공간 트레이드오프를 이해해야 한다.
 *
 * [시간 복잡도] O(n) 버킷 정렬 [공간 복잡도] O(n)
 */
import java.util.*;

public class P062TopKFrequent {
    // 버킷 정렬 방법: O(n)
    @SuppressWarnings("unchecked")
    public static int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int n : nums) count.merge(n, 1, Integer::sum);

        // 빈도를 인덱스로 하는 버킷
        List<Integer>[] buckets = new List[nums.length + 1];
        for (Map.Entry<Integer, Integer> e : count.entrySet()) {
            int freq = e.getValue();
            if (buckets[freq] == null) buckets[freq] = new ArrayList<>();
            buckets[freq].add(e.getKey());
        }

        int[] result = new int[k];
        int idx = 0;
        for (int i = buckets.length - 1; i >= 0 && idx < k; i--) {
            if (buckets[i] != null) {
                for (int num : buckets[i]) {
                    if (idx >= k) break;
                    result[idx++] = num;
                }
            }
        }
        return result;
    }

    public static void main(String[] args) {
        int[] r1 = topKFrequent(new int[]{1,1,1,2,2,3}, 2);
        Arrays.sort(r1);
        assert Arrays.equals(r1, new int[]{1,2});

        int[] r2 = topKFrequent(new int[]{1}, 1);
        assert Arrays.equals(r2, new int[]{1});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
