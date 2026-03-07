---
title: "[알고리즘] 배열 회전 (Rotate Array)"
date: "2025-04-03"
category: "Algorithm"
tags: ["Algorithm", "3회 반전", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 배열 회전 (Rotate Array) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**배열 회전 (Rotate Array)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: 3회 반전

> **Architect's View**
> in-place 알고리즘과 메모리 효율성

이 글에서는 배열 회전 (Rotate Array) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 002: 배열 회전 (Rotate Array)
==========================================================

[문제 설명]
정수 배열 nums를 오른쪽으로 k번 회전하라. (in-place, O(1) 추가 공간)

[아키텍트의 시선 - in-place 알고리즘과 메모리 효율성]
"3회 반전(Three Reversals)" 기법은 추가 배열 없이 순환 이동을 구현한다.
실무에서 메모리 제약이 있는 임베디드/스트리밍 시스템에서 핵심적인 사고방식.
핵심: 전체 반전 → 앞부분 반전 → 뒷부분 반전

[시간 복잡도] O(n)
[공간 복잡도] O(1) - in-place
"""

from typing import List


def rotate(nums: List[int], k: int) -> None:
    n = len(nums)
    k %= n  # k가 배열 길이보다 클 수 있음

    def reverse(start: int, end: int) -> None:
        while start < end:
            nums[start], nums[end] = nums[end], nums[start]
            start += 1
            end -= 1

    # 3회 반전: [1,2,3,4,5,6,7] k=3
    # 1단계 전체 반전: [7,6,5,4,3,2,1]
    reverse(0, n - 1)
    # 2단계 앞 k개 반전: [5,6,7,4,3,2,1]
    reverse(0, k - 1)
    # 3단계 나머지 반전: [5,6,7,1,2,3,4]
    reverse(k, n - 1)


if __name__ == "__main__":
    arr1 = [1, 2, 3, 4, 5, 6, 7]
    rotate(arr1, 3)
    assert arr1 == [5, 6, 7, 1, 2, 3, 4], f"실패: {arr1}"

    arr2 = [-1, -100, 3, 99]
    rotate(arr2, 2)
    assert arr2 == [3, 99, -1, -100], f"실패: {arr2}"

    arr3 = [1, 2]
    rotate(arr3, 5)  # k > len
    assert arr3 == [2, 1], f"실패: {arr3}"

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 002: 배열 회전 (Rotate Array)
 * [문제] 배열을 오른쪽으로 k칸 회전하라 (in-place).
 * [아키텍트의 시선] 3회 반전(reverse)으로 in-place 회전.
 * 추가 배열 O(n) 대신 reverse 3번으로 O(1) 공간.
 * 실무: 로그 로테이션, 원형 버퍼, 데이터 파이프라인.
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
import java.util.*;

public class P002RotateArray {
    public static void rotate(int[] nums, int k) {
        int n = nums.length;
        k = k % n;
        reverse(nums, 0, n - 1);
        reverse(nums, 0, k - 1);
        reverse(nums, k, n - 1);
    }

    private static void reverse(int[] nums, int start, int end) {
        while (start < end) {
            int temp = nums[start];
            nums[start] = nums[end];
            nums[end] = temp;
            start++;
            end--;
        }
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4, 5, 6, 7};
        rotate(a, 3);
        assert Arrays.equals(a, new int[]{5, 6, 7, 1, 2, 3, 4});
        int[] b = {-1, -100, 3, 99};
        rotate(b, 2);
        assert Arrays.equals(b, new int[]{3, 99, -1, -100});
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
