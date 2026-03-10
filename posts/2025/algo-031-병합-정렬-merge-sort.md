---
title: "[알고리즘] 병합 정렬 (Merge Sort)"
date: "2025-06-11"
category: "Algorithm"
tags: ["Algorithm", "분할 정복", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 병합 정렬 (Merge Sort) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**병합 정렬 (Merge Sort)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 분할 정복

> **Architect's View**
> 안정 정렬과 Divide & Conquer

이 글에서는 병합 정렬 (Merge Sort) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 031: 병합 정렬 (Merge Sort)
==========================================================
[문제] 배열을 병합 정렬로 정렬하라.
[아키텍트의 시선 - 분할 정복 패러다임과 안정성(Stability)]
분할 → 정복 → 결합. 안정 정렬(같은 값의 상대 순서 유지).
실무: 외부 정렬, 연결 리스트 정렬, MapReduce의 Reduce 단계.
[시간 복잡도] O(n log n) [공간 복잡도] O(n)
"""
from typing import List

def merge_sort(arr: List[int]) -> List[int]:
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left: List[int], right: List[int]) -> List[int]:
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result

if __name__ == "__main__":
    assert merge_sort([38, 27, 43, 3, 9, 82, 10]) == [3, 9, 10, 27, 38, 43, 82]
    assert merge_sort([5, 1, 4, 2, 8]) == [1, 2, 4, 5, 8]
    assert merge_sort([]) == []
    assert merge_sort([1]) == [1]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 031: 병합 정렬 (Merge Sort)
 *
 * [문제] 병합 정렬을 구현하라. 분할 정복의 대표적 정렬 알고리즘.
 *
 * [아키텍트의 시선]
 * 병합 정렬의 분할-정복-결합은 MapReduce의 근본 원리다.
 * 대규모 데이터를 분할하여 병렬 처리 후 결과를 병합하는 패턴은
 * 분산 시스템 아키텍처의 핵심 설계 패턴이다. 안정 정렬 보장.
 *
 * [시간 복잡도] O(n log n) [공간 복잡도] O(n)
 */
import java.util.Arrays;

public class P031MergeSort {
    public static void mergeSort(int[] arr, int left, int right) {
        if (left >= right) return;
        int mid = left + (right - left) / 2;
        mergeSort(arr, left, mid);      // 좌측 정복
        mergeSort(arr, mid + 1, right); // 우측 정복
        merge(arr, left, mid, right);   // 결합
    }

    private static void merge(int[] arr, int left, int mid, int right) {
        int[] temp = new int[right - left + 1];
        int i = left, j = mid + 1, k = 0;
        while (i <= mid && j <= right) {
            if (arr[i] <= arr[j]) temp[k++] = arr[i++];
            else temp[k++] = arr[j++];
        }
        while (i <= mid) temp[k++] = arr[i++];
        while (j <= right) temp[k++] = arr[j++];
        System.arraycopy(temp, 0, arr, left, temp.length);
    }

    public static void main(String[] args) {
        int[] a1 = {5, 3, 8, 1, 2};
        mergeSort(a1, 0, a1.length - 1);
        assert Arrays.equals(a1, new int[]{1, 2, 3, 5, 8});

        int[] a2 = {1};
        mergeSort(a2, 0, 0);
        assert Arrays.equals(a2, new int[]{1});

        int[] a3 = {3, 1, 4, 1, 5, 9, 2, 6};
        mergeSort(a3, 0, a3.length - 1);
        assert Arrays.equals(a3, new int[]{1, 1, 2, 3, 4, 5, 6, 9});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
