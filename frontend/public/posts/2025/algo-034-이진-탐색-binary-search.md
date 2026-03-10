---
title: "[알고리즘] 이진 탐색 (Binary Search)"
date: "2025-06-20"
category: "Algorithm"
tags: ["Algorithm", "탐색 공간 축소", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 이진 탐색 (Binary Search) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**이진 탐색 (Binary Search)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 탐색 공간 축소

> **Architect's View**
> 루프 불변식과 탐색 전략

이 글에서는 이진 탐색 (Binary Search) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 034: 이진 탐색 (Binary Search)
==========================================================
[문제] 정렬된 배열에서 목표값의 인덱스를 찾아라.
[아키텍트의 시선 - 탐색 공간 축소와 루프 불변식]
매 반복마다 탐색 범위를 절반으로 축소 → O(log n).
불변식: target이 존재한다면 [left, right] 범위 안에 있다.
[시간 복잡도] O(log n) [공간 복잡도] O(1)
"""
from typing import List

def binary_search(nums: List[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

def lower_bound(nums: List[int], target: int) -> int:
    left, right = 0, len(nums)
    while left < right:
        mid = (left + right) // 2
        if nums[mid] < target:
            left = mid + 1
        else:
            right = mid
    return left

if __name__ == "__main__":
    assert binary_search([-1, 0, 3, 5, 9, 12], 9) == 4
    assert binary_search([-1, 0, 3, 5, 9, 12], 2) == -1
    assert lower_bound([1, 2, 2, 2, 3], 2) == 1
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 034: 이진 탐색 (Binary Search)
 *
 * [문제] 정렬된 배열에서 타겟 값의 인덱스를 찾아라. 없으면 -1 반환.
 *
 * [아키텍트의 시선]
 * 이진 탐색은 모든 "정렬된 탐색 공간"에 적용되는 보편적 패턴이다.
 * 데이터베이스 B-Tree 인덱스, DNS 조회, 로그 기반 타임스탬프 검색 등
 * O(log n) 조회를 가능케 하는 근본 원리다.
 *
 * [시간 복잡도] O(log n) [공간 복잡도] O(1)
 */
public class P034BinarySearch {
    public static int binarySearch(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2; // 오버플로우 방지
            if (nums[mid] == target) return mid;
            else if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }

    // 하한 탐색: target 이상인 첫 번째 위치
    public static int lowerBound(int[] nums, int target) {
        int left = 0, right = nums.length;
        while (left < right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] < target) left = mid + 1;
            else right = mid;
        }
        return left;
    }

    public static void main(String[] args) {
        assert binarySearch(new int[]{-1,0,3,5,9,12}, 9) == 4;
        assert binarySearch(new int[]{-1,0,3,5,9,12}, 2) == -1;
        assert binarySearch(new int[]{5}, 5) == 0;
        assert lowerBound(new int[]{1,2,4,4,5}, 4) == 2;
        assert lowerBound(new int[]{1,2,4,4,5}, 3) == 2;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
