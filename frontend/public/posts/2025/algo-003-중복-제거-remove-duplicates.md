---
title: "[알고리즘] 중복 제거 (Remove Duplicates)"
date: "2025-04-06"
category: "Algorithm"
tags: ["Algorithm", "투 포인터", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 중복 제거 (Remove Duplicates) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**중복 제거 (Remove Duplicates)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: 투 포인터

> **Architect's View**
> 포인터 기반 스트림 처리

이 글에서는 중복 제거 (Remove Duplicates) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 003: 중복 제거 (Remove Duplicates from Sorted Array)
==========================================================

[문제 설명]
정렬된 배열 nums에서 중복을 in-place로 제거하고,
고유한 원소의 개수를 반환하라.

[아키텍트의 시선 - 포인터 기반 스트림 처리]
"읽기 포인터"와 "쓰기 포인터"를 분리하는 패턴.
실무에서 로그 필터링, 스트림 데이터 중복 제거에 동일한 패턴 적용.
핵심: 데이터를 읽는 속도와 쓰는 속도를 분리하면 in-place 변환이 가능.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""

from typing import List


def remove_duplicates(nums: List[int]) -> int:
    if not nums:
        return 0

    write_idx = 1  # 쓰기 포인터: 다음 고유 원소를 쓸 위치
    for read_idx in range(1, len(nums)):  # 읽기 포인터: 배열 순회
        if nums[read_idx] != nums[read_idx - 1]:
            nums[write_idx] = nums[read_idx]
            write_idx += 1

    return write_idx


if __name__ == "__main__":
    nums1 = [1, 1, 2]
    k1 = remove_duplicates(nums1)
    assert k1 == 2 and nums1[:k1] == [1, 2]

    nums2 = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]
    k2 = remove_duplicates(nums2)
    assert k2 == 5 and nums2[:k2] == [0, 1, 2, 3, 4]

    nums3 = [1]
    assert remove_duplicates(nums3) == 1

    nums4 = []
    assert remove_duplicates(nums4) == 0

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 003: 중복 제거 (Remove Duplicates from Sorted Array)
 * [문제] 정렬된 배열에서 중복을 in-place로 제거하고 유니크 원소 수를 반환하라.
 * [아키텍트의 시선] 투 포인터 기반 스트림 필터링.
 * slow/fast 포인터로 유니크 원소만 앞쪽에 모은다.
 * 실무: 데이터 파이프라인의 중복 제거, 스트림 처리.
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P003RemoveDuplicates {
    public static int removeDuplicates(int[] nums) {
        if (nums.length == 0) return 0;
        int slow = 0;
        for (int fast = 1; fast < nums.length; fast++) {
            if (nums[fast] != nums[slow]) {
                slow++;
                nums[slow] = nums[fast];
            }
        }
        return slow + 1;
    }

    public static void main(String[] args) {
        int[] a = {1, 1, 2};
        assert removeDuplicates(a) == 2;
        int[] b = {0, 0, 1, 1, 1, 2, 2, 3, 3, 4};
        assert removeDuplicates(b) == 5;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
