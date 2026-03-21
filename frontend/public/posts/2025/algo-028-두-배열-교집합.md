---
title: "[알고리즘] 두 배열 교집합"
date: "2025-06-03"
category: "Algorithm"
tags: ["Algorithm", "해시맵 카운팅", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 두 배열 교집합 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

두 배열 교집합은 "같은 값 찾기"가 아니라, 두 입력을 멀티셋으로 보고 조인(join) 연산을 수행하는 문제입니다. 값의 존재만 볼지, 등장 횟수까지 보존할지에 따라 알고리즘 의미가 달라지는 이유를 설명해 보세요.

1. 작은 배열을 카운트 맵으로 만들고 큰 배열을 스캔할 때, 카운터가 어떻게 줄어들며 언제 결과에 값을 추가하는지 추적하세요.
2. 해시 카운팅 방식과 정렬 후 투 포인터 방식을 중복 처리, 메모리 사용, 캐시 locality 관점에서 비교하세요.
3. 교집합 대신 inner join, semi join, approximate join으로 확장하면 어떤 추가 상태가 필요해지는지 설명하세요.

## 답변할 때 포함할 것

- 존재 기반 교집합과 개수 기반 교집합을 구분할 것
- 카운터 감소가 왜 필요한지 설명할 것
- 데이터 조인 관점의 비유를 포함할 것

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
