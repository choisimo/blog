---
title: "[알고리즘] K번째 큰 수 (Quick Select)"
date: "2025-06-17"
category: "Algorithm"
tags: ["Algorithm", "부분 정렬", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - K번째 큰 수 (Quick Select) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**K번째 큰 수 (Quick Select)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 부분 정렬

> **Architect's View**
> 기대 시간 복잡도 분석

이 글에서는 K번째 큰 수 (Quick Select) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 033: K번째 큰 수 (Kth Largest Element - Quick Select)
==========================================================
[문제] 배열에서 K번째로 큰 원소를 O(n) 평균에 찾아라.
[아키텍트의 시선 - 부분 정렬과 기대 시간 복잡도]
전체 정렬 O(n log n) vs Quick Select 평균 O(n).
"전체를 알 필요 없이 원하는 것만 빠르게" → 선택적 계산.
[시간 복잡도] 평균 O(n) [공간 복잡도] O(1)
"""
from typing import List
import random

def find_kth_largest(nums: List[int], k: int) -> int:
    target = len(nums) - k
    def quick_select(left, right):
        pi = random.randint(left, right)
        nums[pi], nums[right] = nums[right], nums[pi]
        pivot = nums[right]
        store = left
        for i in range(left, right):
            if nums[i] <= pivot:
                nums[store], nums[i] = nums[i], nums[store]
                store += 1
        nums[store], nums[right] = nums[right], nums[store]
        if store == target:
            return nums[store]
        elif store < target:
            return quick_select(store + 1, right)
        else:
            return quick_select(left, store - 1)
    return quick_select(0, len(nums) - 1)

if __name__ == "__main__":
    assert find_kth_largest([3, 2, 1, 5, 6, 4], 2) == 5
    assert find_kth_largest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4) == 4
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 033: K번째로 큰 원소 (Kth Largest Element)
 *
 * [문제] 배열에서 K번째로 큰 원소를 찾아라.
 * QuickSelect 알고리즘으로 평균 O(n)에 해결하라.
 *
 * [아키텍트의 시선]
 * QuickSelect는 전체 정렬 없이 원하는 순위를 찾는 최적화된 방법이다.
 * Top-K 질의는 검색 엔진 순위, 추천 시스템, 모니터링 대시보드의 핵심이다.
 * 불필요한 작업을 건너뛰는 "필요한 만큼만 계산" 원칙의 전형이다.
 *
 * [시간 복잡도] 평균 O(n), 최악 O(n^2) [공간 복잡도] O(1)
 */
import java.util.Random;

public class P033KthLargest {
    private static Random rand = new Random();

    public static int findKthLargest(int[] nums, int k) {
        int target = nums.length - k; // k번째로 큰 = (n-k)번째로 작은
        return quickSelect(nums, 0, nums.length - 1, target);
    }

    private static int quickSelect(int[] nums, int left, int right, int target) {
        if (left == right) return nums[left];
        int pivotIdx = left + rand.nextInt(right - left + 1);
        pivotIdx = partition(nums, left, right, pivotIdx);
        if (pivotIdx == target) return nums[pivotIdx];
        else if (pivotIdx < target) return quickSelect(nums, pivotIdx + 1, right, target);
        else return quickSelect(nums, left, pivotIdx - 1, target);
    }

    private static int partition(int[] nums, int left, int right, int pivotIdx) {
        int pivot = nums[pivotIdx];
        swap(nums, pivotIdx, right);
        int storeIdx = left;
        for (int i = left; i < right; i++) {
            if (nums[i] < pivot) {
                swap(nums, storeIdx, i);
                storeIdx++;
            }
        }
        swap(nums, storeIdx, right);
        return storeIdx;
    }

    private static void swap(int[] a, int i, int j) {
        int t = a[i]; a[i] = a[j]; a[j] = t;
    }

    public static void main(String[] args) {
        assert findKthLargest(new int[]{3,2,1,5,6,4}, 2) == 5;
        assert findKthLargest(new int[]{3,2,3,1,2,4,5,5,6}, 4) == 4;
        assert findKthLargest(new int[]{1}, 1) == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
