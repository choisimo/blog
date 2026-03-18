---
title: "[알고리즘] 첫/마지막 위치"
date: "2025-06-24"
category: "Algorithm"
tags: ["Algorithm", "lower/upper bound", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 첫/마지막 위치 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

이 문제는 값을 찾는 것이 아니라, 같은 값이 연속으로 놓인 런(run)의 경계를 찾는 범위 질의 문제입니다. lower bound와 upper bound가 왜 "값 존재 여부"보다 더 강한 정보를 준다고 할 수 있는지 설명해 보세요.

1. 첫 위치를 찾는 탐색과 마지막 위치를 찾는 탐색의 비교 연산이 어떻게 다르고, 경계가 왜 서로 다른 불변식을 쓰는지 설명하세요.
2. 값을 하나 찾은 뒤 좌우로 확장하는 방식과 이중 이진 탐색 방식을 비교해, 데이터가 한쪽에 몰릴 때 비용이 어떻게 달라지는지 설명하세요.
3. 이 개념이 데이터베이스 range scan, postings list 검색, time-series 구간 질의로 어떻게 이어지는지 설명하세요.

## 답변할 때 포함할 것

- lower/upper bound의 의미를 각각 정의할 것
- 중복 구간의 시작과 끝을 분리해서 설명할 것
- 확장 스캔 방식의 한계를 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 036: 첫/마지막 위치 (Find First and Last Position)
==========================================================
[문제] 정렬된 배열에서 target의 시작/끝 인덱스를 O(log n)에 구하라.
[아키텍트의 시선 - 경계 탐색(Boundary Search)과 범위 쿼리]
lower_bound (첫 번째 위치)와 upper_bound (마지막+1 위치) 패턴.
실무: DB 인덱스 범위 스캔, B-Tree 범위 쿼리.
[시간 복잡도] O(log n) [공간 복잡도] O(1)
"""
from typing import List

def search_range(nums: List[int], target: int) -> List[int]:
    def find_left():
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] < target:
                lo = mid + 1
            else:
                hi = mid - 1
        return lo

    def find_right():
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] <= target:
                lo = mid + 1
            else:
                hi = mid - 1
        return hi

    left, right = find_left(), find_right()
    if left <= right:
        return [left, right]
    return [-1, -1]

if __name__ == "__main__":
    assert search_range([5, 7, 7, 8, 8, 10], 8) == [3, 4]
    assert search_range([5, 7, 7, 8, 8, 10], 6) == [-1, -1]
    assert search_range([], 0) == [-1, -1]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 036: 정렬 배열에서 첫/마지막 위치 (Find First and Last Position)
 *
 * [문제] 정렬된 배열에서 타겟의 시작과 끝 인덱스를 찾아라. O(log n).
 *
 * [아키텍트의 시선]
 * 이진 탐색의 변형(좌측/우측 경계 탐색)은
 * 시계열 DB에서 시간 범위 질의, 로그 검색의 시작/끝 타임스탬프 탐색,
 * 페이지네이션의 범위 결정과 동일한 패턴이다.
 *
 * [시간 복잡도] O(log n) [공간 복잡도] O(1)
 */
public class P036FindFirstAndLast {
    public static int[] searchRange(int[] nums, int target) {
        return new int[]{findFirst(nums, target), findLast(nums, target)};
    }

    private static int findFirst(int[] nums, int target) {
        int left = 0, right = nums.length - 1, result = -1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) {
                result = mid;
                right = mid - 1; // 더 왼쪽을 탐색
            } else if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return result;
    }

    private static int findLast(int[] nums, int target) {
        int left = 0, right = nums.length - 1, result = -1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) {
                result = mid;
                left = mid + 1; // 더 오른쪽을 탐색
            } else if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return result;
    }

    public static void main(String[] args) {
        assert java.util.Arrays.equals(searchRange(new int[]{5,7,7,8,8,10}, 8), new int[]{3,4});
        assert java.util.Arrays.equals(searchRange(new int[]{5,7,7,8,8,10}, 6), new int[]{-1,-1});
        assert java.util.Arrays.equals(searchRange(new int[]{}, 0), new int[]{-1,-1});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
