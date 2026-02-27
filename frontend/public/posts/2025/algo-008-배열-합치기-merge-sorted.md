---
title: "[알고리즘] 배열 합치기 (Merge Sorted)"
date: "2025-04-17"
category: "Algorithm"
tags: ["Algorithm", "역방향 병합", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 배열 합치기 (Merge Sorted) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**배열 합치기 (Merge Sorted)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: 역방향 병합

> **Architect's View**
> 역방향 포인터와 병합 전략

이 글에서는 배열 합치기 (Merge Sorted) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 008: 배열 합치기 (Merge Sorted Arrays)
==========================================================

[문제 설명]
정렬된 두 배열 nums1(크기 m+n), nums2(크기 n)를 nums1에 in-place 병합.
nums1의 뒤쪽에 0으로 채워진 공간이 확보되어 있다.

[아키텍트의 시선 - 역방향 포인터와 병합 전략]
앞에서부터 병합하면 기존 데이터를 덮어쓴다 → 역방향(뒤→앞)으로 병합.
실무: 외부 정렬(External Sort)의 병합 단계,
CQRS 패턴에서 이벤트 병합 시 동일 패턴.

[시간 복잡도] O(m+n) [공간 복잡도] O(1)
"""

from typing import List


def merge(nums1: List[int], m: int, nums2: List[int], n: int) -> None:
    p1, p2, p = m - 1, n - 1, m + n - 1

    while p2 >= 0:
        if p1 >= 0 and nums1[p1] > nums2[p2]:
            nums1[p] = nums1[p1]
            p1 -= 1
        else:
            nums1[p] = nums2[p2]
            p2 -= 1
        p -= 1


if __name__ == "__main__":
    nums1 = [1, 2, 3, 0, 0, 0]
    merge(nums1, 3, [2, 5, 6], 3)
    assert nums1 == [1, 2, 2, 3, 5, 6]

    nums2 = [1]
    merge(nums2, 1, [], 0)
    assert nums2 == [1]

    nums3 = [0]
    merge(nums3, 0, [1], 1)
    assert nums3 == [1]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 008: 정렬된 배열 합치기 (Merge Sorted Arrays)
 * [문제] 정렬된 배열 nums1(크기 m+n)에 nums2(크기 n)를 병합하라.
 * [아키텍트의 시선] 역방향 포인터로 in-place 병합.
 * 뒤에서부터 채우면 덮어쓰기 충돌 없음.
 * 실무: 외부 정렬, 병합 조인, 스트림 병합.
 * [시간 복잡도] O(m+n) [공간 복잡도] O(1)
 */
import java.util.*;

public class P008MergeSortedArrays {
    public static void merge(int[] nums1, int m, int[] nums2, int n) {
        int i = m - 1, j = n - 1, k = m + n - 1;
        while (j >= 0) {
            if (i >= 0 && nums1[i] > nums2[j]) {
                nums1[k--] = nums1[i--];
            } else {
                nums1[k--] = nums2[j--];
            }
        }
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 0, 0, 0};
        merge(a, 3, new int[]{2, 5, 6}, 3);
        assert Arrays.equals(a, new int[]{1, 2, 2, 3, 5, 6});
        int[] b = {1};
        merge(b, 1, new int[]{}, 0);
        assert Arrays.equals(b, new int[]{1});
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
