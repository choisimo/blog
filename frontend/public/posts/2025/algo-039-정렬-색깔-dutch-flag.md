---
title: "[알고리즘] 정렬 색깔 (Dutch Flag)"
date: "2025-06-30"
category: "Algorithm"
tags: ["Algorithm", "3-way partition", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 정렬 색깔 (Dutch Flag) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**정렬 색깔 (Dutch Flag)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 3-way partition

> **Architect's View**
> 다중 분류와 단일 패스

이 글에서는 정렬 색깔 (Dutch Flag) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 039: 정렬 색깔 (Dutch National Flag Problem)
==========================================================
[문제] 0, 1, 2로 구성된 배열을 한 번의 순회로 in-place 정렬.
[아키텍트의 시선 - 3-way Partitioning과 단일 패스]
세 포인터: low(0 경계), mid(탐색), high(2 경계).
실무: 다중 분류 문제, 네트워크 패킷 우선순위 분류.
[시간 복잡도] O(n) [공간 복잡도] O(1)
"""
from typing import List

def sort_colors(nums: List[int]) -> None:
    low, mid, high = 0, 0, len(nums) - 1
    while mid <= high:
        if nums[mid] == 0:
            nums[low], nums[mid] = nums[mid], nums[low]
            low += 1; mid += 1
        elif nums[mid] == 1:
            mid += 1
        else:
            nums[mid], nums[high] = nums[high], nums[mid]
            high -= 1

if __name__ == "__main__":
    a = [2, 0, 2, 1, 1, 0]
    sort_colors(a)
    assert a == [0, 0, 1, 1, 2, 2]
    b = [2, 0, 1]
    sort_colors(b)
    assert b == [0, 1, 2]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 039: 색 정렬 (Sort Colors — Dutch National Flag)
 *
 * [문제] 0, 1, 2로만 이루어진 배열을 제자리에서 정렬하라.
 * 한 번의 순회로 해결하라 (Dutch National Flag 알고리즘).
 *
 * [아키텍트의 시선]
 * 3-way 파티셔닝은 데이터를 범주별로 분류하는 핵심 패턴이다.
 * 네트워크 트래픽의 우선순위 분류(QoS), 요청의 긴급도 분류,
 * 멀티 레벨 캐시 할당과 동일한 원리다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
import java.util.Arrays;

public class P039SortColors {
    public static void sortColors(int[] nums) {
        int low = 0, mid = 0, high = nums.length - 1;
        while (mid <= high) {
            if (nums[mid] == 0) {
                swap(nums, low, mid);
                low++; mid++;
            } else if (nums[mid] == 1) {
                mid++;
            } else { // nums[mid] == 2
                swap(nums, mid, high);
                high--;
                // mid는 증가시키지 않음: 교환된 값을 다시 확인해야 함
            }
        }
    }

    private static void swap(int[] a, int i, int j) {
        int t = a[i]; a[i] = a[j]; a[j] = t;
    }

    public static void main(String[] args) {
        int[] a1 = {2,0,2,1,1,0};
        sortColors(a1);
        assert Arrays.equals(a1, new int[]{0,0,1,1,2,2});

        int[] a2 = {2,0,1};
        sortColors(a2);
        assert Arrays.equals(a2, new int[]{0,1,2});

        int[] a3 = {0};
        sortColors(a3);
        assert Arrays.equals(a3, new int[]{0});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
