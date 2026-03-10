---
title: "[알고리즘] 두 배열 교집합"
date: "2025-06-03"
category: "Algorithm"
tags: ["Algorithm", "해시맵 카운팅", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 두 배열 교집합 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**두 배열 교집합**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 해시맵 카운팅

> **Architect's View**
> 멀티셋 연산과 데이터 조인

이 글에서는 두 배열 교집합 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 028: 두 배열의 교집합 (Intersection of Two Arrays II)
==========================================================

[문제 설명]
두 배열의 교집합을 구하라 (중복 포함).

[아키텍트의 시선 - 멀티셋 연산과 데이터 조인 전략]
해시맵으로 빈도수 카운팅 → SQL의 INNER JOIN과 동일.
실무: DB 조인 최적화, 집합 연산, 데이터 매칭.

[시간 복잡도] O(m+n) [공간 복잡도] O(min(m,n))
"""
from typing import List
from collections import Counter


def intersect(nums1: List[int], nums2: List[int]) -> List[int]:
    counts = Counter(nums1)
    result = []
    for num in nums2:
        if counts[num] > 0:
            result.append(num)
            counts[num] -= 1
    return result


if __name__ == "__main__":
    assert sorted(intersect([1, 2, 2, 1], [2, 2])) == [2, 2]
    assert sorted(intersect([4, 9, 5], [9, 4, 9, 8, 4])) == [4, 9]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 028: 두 배열의 교집합 II (Intersection of Two Arrays II)
 *
 * [문제] 두 배열의 교집합을 구하라. 결과에서 각 원소의 등장 횟수는
 * 두 배열 모두에서의 등장 횟수 중 작은 값만큼이어야 한다.
 *
 * [아키텍트의 시선]
 * 교집합 연산은 데이터베이스 INNER JOIN, API 필터링의 기본이다.
 * 해시맵 기반 구현은 메모리 내 해시 조인과 동일하며,
 * 정렬 기반은 소트-머지 조인에 해당한다.
 *
 * [시간 복잡도] O(n+m) [공간 복잡도] O(min(n,m))
 */
import java.util.*;

public class P028IntersectionOfArrays {
    public static int[] intersect(int[] nums1, int[] nums2) {
        Map<Integer, Integer> countMap = new HashMap<>();
        for (int n : nums1) countMap.merge(n, 1, Integer::sum);

        List<Integer> result = new ArrayList<>();
        for (int n : nums2) {
            if (countMap.getOrDefault(n, 0) > 0) {
                result.add(n);
                countMap.merge(n, -1, Integer::sum);
            }
        }
        return result.stream().mapToInt(i -> i).toArray();
    }

    public static void main(String[] args) {
        int[] r1 = intersect(new int[]{1,2,2,1}, new int[]{2,2});
        Arrays.sort(r1);
        assert Arrays.equals(r1, new int[]{2,2});

        int[] r2 = intersect(new int[]{4,9,5}, new int[]{9,4,9,8,4});
        Arrays.sort(r2);
        assert Arrays.equals(r2, new int[]{4,9});

        assert intersect(new int[]{1}, new int[]{2}).length == 0;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
