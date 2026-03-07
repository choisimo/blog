---
title: "[알고리즘] 퀵 정렬 (Quick Sort)"
date: "2025-06-14"
category: "Algorithm"
tags: ["Algorithm", "피벗 분할", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 퀵 정렬 (Quick Sort) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**퀵 정렬 (Quick Sort)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 피벗 분할

> **Architect's View**
> 피벗 전략과 최악 케이스 방어

이 글에서는 퀵 정렬 (Quick Sort) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 032: 퀵 정렬 (Quick Sort)
==========================================================
[문제] 배열을 퀵 정렬로 정렬하라. 랜덤 피벗 사용.
[아키텍트의 시선 - 피벗 선택 전략과 최악 케이스 방어]
고정 피벗 → O(n²) 최악. 랜덤 피벗 → 기대 O(n log n).
실무: 대부분의 언어 내장 정렬이 퀵소트 변형 (Timsort, Introsort).
[시간 복잡도] 평균 O(n log n), 최악 O(n²) [공간 복잡도] O(log n) 스택
"""
from typing import List
import random

def quick_sort(arr: List[int]) -> List[int]:
    if len(arr) <= 1:
        return arr
    pivot = random.choice(arr)
    less = [x for x in arr if x < pivot]
    equal = [x for x in arr if x == pivot]
    greater = [x for x in arr if x > pivot]
    return quick_sort(less) + equal + quick_sort(greater)

def quick_sort_inplace(arr: List[int], low: int = 0, high: int = None) -> None:
    if high is None:
        high = len(arr) - 1
    if low < high:
        pi = partition(arr, low, high)
        quick_sort_inplace(arr, low, pi - 1)
        quick_sort_inplace(arr, pi + 1, high)

def partition(arr: List[int], low: int, high: int) -> int:
    ri = random.randint(low, high)
    arr[ri], arr[high] = arr[high], arr[ri]
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

if __name__ == "__main__":
    assert quick_sort([10, 7, 8, 9, 1, 5]) == [1, 5, 7, 8, 9, 10]
    arr = [3, 6, 8, 10, 1, 2, 1]
    quick_sort_inplace(arr)
    assert arr == [1, 1, 2, 3, 6, 8, 10]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 032: 퀵 정렬 (Quick Sort)
 *
 * [문제] 퀵 정렬을 구현하라. 피벗 선택과 파티셔닝의 원리를 이해하라.
 *
 * [아키텍트의 시선]
 * 퀵 정렬의 파티셔닝은 로드 밸런서의 트래픽 분배와 동일하다.
 * 피벗 선택의 품질이 성능을 결정하듯, 파티션 키의 선택이
 * 분산 데이터베이스의 핫스팟 방지에 핵심이다.
 *
 * [시간 복잡도] 평균 O(n log n), 최악 O(n^2) [공간 복잡도] O(log n) 스택
 */
import java.util.Arrays;

public class P032QuickSort {
    public static void quickSort(int[] arr, int low, int high) {
        if (low >= high) return;
        int pivotIdx = partition(arr, low, high);
        quickSort(arr, low, pivotIdx - 1);
        quickSort(arr, pivotIdx + 1, high);
    }

    private static int partition(int[] arr, int low, int high) {
        // 중간값 피벗 전략 (최악 O(n^2) 완화)
        int mid = low + (high - low) / 2;
        if (arr[mid] < arr[low]) swap(arr, low, mid);
        if (arr[high] < arr[low]) swap(arr, low, high);
        if (arr[mid] < arr[high]) swap(arr, mid, high);
        int pivot = arr[high];

        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (arr[j] <= pivot) {
                i++;
                swap(arr, i, j);
            }
        }
        swap(arr, i + 1, high);
        return i + 1;
    }

    private static void swap(int[] arr, int i, int j) {
        int tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }

    public static void main(String[] args) {
        int[] a1 = {5, 3, 8, 1, 2};
        quickSort(a1, 0, a1.length - 1);
        assert Arrays.equals(a1, new int[]{1, 2, 3, 5, 8});

        int[] a2 = {3, 1, 4, 1, 5, 9, 2, 6};
        quickSort(a2, 0, a2.length - 1);
        assert Arrays.equals(a2, new int[]{1, 1, 2, 3, 4, 5, 6, 9});

        int[] a3 = {};
        quickSort(a3, 0, -1);
        assert Arrays.equals(a3, new int[]{});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
