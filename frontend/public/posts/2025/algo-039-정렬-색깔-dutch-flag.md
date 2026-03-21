---
title: "[알고리즘] 정렬 색깔 (Dutch Flag)"
date: "2025-06-30"
category: "Algorithm"
tags: ["Algorithm", "3-way partition", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 정렬 색깔 (Dutch Flag) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

Dutch National Flag는 정렬 문제라기보다, 하나의 스트림을 단일 패스에서 세 클래스 구간으로 안정적으로 분할하는 문제입니다. `0`, `1`, `2`가 각각 어떤 메모리 구간으로 모여 가는지 설명해 보세요.

1. `low`, `mid`, `high`가 가리키는 구간의 의미를 정의하고, 현재 값이 0/1/2일 때 왜 서로 다른 이동 규칙을 써야 하는지 추적하세요.
2. counting sort, 일반 정렬, 3-way partition을 쓰기 횟수, 추가 메모리, 단일 패스 가능성 관점에서 비교하세요.
3. 클래스가 3개가 아니라 k개로 늘어나면 왜 같은 포인터 체계가 바로 일반화되지 않는지 설명하세요.

## 답변할 때 포함할 것

- 세 구간의 의미를 정확히 적을 것
- swap 뒤 `mid`를 움직일지 말지 이유를 설명할 것
- k-way 일반화의 어려움을 적을 것

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
