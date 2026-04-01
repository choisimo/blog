---
title: "[알고리즘] K번째 큰 수 (Quick Select)"
date: "2025-06-17"
category: "Algorithm"
tags: ["Algorithm", "부분 정렬", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - K번째 큰 수 (Quick Select) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

Quick Select는 전체 순서를 완성하지 않고도 필요한 rank 하나만 찾는 선택(selection) 문제입니다. "정렬을 덜 한다"가 아니라, 피벗이 타깃 rank를 포함하는 한쪽 구간만 남기며 탐색 공간을 잘라낸다는 점을 설명해 보세요.

1. 파티션 후 피벗 위치와 목표 인덱스의 관계에 따라 어느 구간을 버릴 수 있는지 추적하고, 왜 버린 구간이 다시 필요 없다고 말할 수 있는지 설명하세요.
2. 전체 정렬 후 선택, 힙 기반 top-k 유지, Quick Select를 메모리 사용과 평균/최악 시간 관점에서 비교하세요.
3. 실시간 스트림이나 외부 메모리 환경에서는 왜 Quick Select가 직접 쓰기 어려운지 설명하세요.

## 답변할 때 포함할 것

- 목표 인덱스와 피벗 인덱스 관계를 적을 것
- 버리는 구간의 정당성을 설명할 것
- 평균 O(n)과 최악 O(n^2)를 함께 다룰 것

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
