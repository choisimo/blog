---
title: "[알고리즘] 회전 배열 탐색"
date: "2025-06-22"
category: "Algorithm"
tags: ["Algorithm", "변형 이진탐색", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 회전 배열 탐색 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

회전 배열 탐색은 정렬성이 완전히 사라진 배열을 다루는 것이 아니라, 매 시점 최소한 한쪽 절반은 여전히 정렬되어 있다는 조건부 질서를 이용하는 문제입니다. pivot을 직접 찾지 않고도 왜 탐색이 가능한지 설명해 보세요.

1. `low`, `mid`, `high`를 볼 때 어느 절반이 정렬 구간인지 판정하고, target이 그 안에 있는지 없는지로 탐색 공간을 줄이는 과정을 추적하세요.
2. pivot을 먼저 찾고 다시 탐색하는 2단계 방식과 단일 패스 변형 이진 탐색을 비교하세요.
3. 중복 원소가 많아지면 어느 순간 정렬 구간 판정이 모호해지는데, 왜 최악에는 선형 시간으로 붕괴할 수 있는지 설명하세요.

## 답변할 때 포함할 것

- 정렬된 절반 판정 규칙을 적을 것
- target 포함 여부 판단을 단계별로 적을 것
- duplicate가 만드는 모호성을 설명할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 035: 회전 정렬 배열 탐색 (Search in Rotated Sorted Array)
==========================================================
[문제] 한 지점에서 회전된 정렬 배열에서 목표값을 O(log n)에 찾아라.
[아키텍트의 시선 - 조건부 탐색 공간 분할]
배열을 반으로 나누면 한쪽은 반드시 정렬. 정렬된 쪽에서 target 포함 여부 판단.
[시간 복잡도] O(log n) [공간 복잡도] O(1)
"""
from typing import List

def search(nums: List[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        if nums[left] <= nums[mid]:
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        else:
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
    return -1

if __name__ == "__main__":
    assert search([4, 5, 6, 7, 0, 1, 2], 0) == 4
    assert search([4, 5, 6, 7, 0, 1, 2], 3) == -1
    assert search([1], 0) == -1
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 035: 회전 정렬 배열 탐색 (Search in Rotated Sorted Array)
 *
 * [문제] 회전된 정렬 배열에서 타겟 값을 O(log n)에 찾아라.
 *
 * [아키텍트의 시선]
 * 부분적으로 정렬된 데이터에서의 이진 탐색은
 * 장애 복구 후 부분 일관성 상태의 데이터베이스 검색,
 * 링 버퍼에서의 탐색과 동일한 패턴이다.
 * "어느 쪽이 정렬되어 있는지"를 판별하는 것이 핵심이다.
 *
 * [시간 복잡도] O(log n) [공간 복잡도] O(1)
 */
public class P035SearchRotatedArray {
    public static int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;

            // 왼쪽 절반이 정렬된 상태인지 확인
            if (nums[left] <= nums[mid]) {
                if (nums[left] <= target && target < nums[mid]) {
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            } else {
                // 오른쪽 절반이 정렬된 상태
                if (nums[mid] < target && target <= nums[right]) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }
        }
        return -1;
    }

    public static void main(String[] args) {
        assert search(new int[]{4,5,6,7,0,1,2}, 0) == 4;
        assert search(new int[]{4,5,6,7,0,1,2}, 3) == -1;
        assert search(new int[]{1}, 0) == -1;
        assert search(new int[]{1}, 1) == 0;
        assert search(new int[]{3,1}, 1) == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
