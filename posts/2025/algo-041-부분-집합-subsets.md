---
title: "[알고리즘] 부분 집합 (Subsets)"
date: "2025-07-05"
category: "Algorithm"
tags: ["Algorithm", "포함/배제 재귀", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 부분 집합 (Subsets) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**부분 집합 (Subsets)**
* 파트: Recursion & Backtracking
* 관련 알고리즘: 포함/배제 재귀

> **Architect's View**
> 비트마스크와 재귀적 열거

이 글에서는 부분 집합 (Subsets) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 041: 부분 집합 (Subsets)
[문제] 중복 없는 정수 배열의 모든 부분집합을 구하라.
[아키텍트의 시선] 비트마스크와 포함/배제 패턴. 2^n개 상태 열거.
실무: 기능 플래그 조합, A/B 테스트 조합, 설정 조합 탐색.
[시간 복잡도] O(n * 2^n) [공간 복잡도] O(n * 2^n)
"""
from typing import List

def subsets(nums: List[int]) -> List[List[int]]:
    result = []
    def backtrack(start, current):
        result.append(current[:])
        for i in range(start, len(nums)):
            current.append(nums[i])
            backtrack(i + 1, current)
            current.pop()
    backtrack(0, [])
    return result

def subsets_bitmask(nums: List[int]) -> List[List[int]]:
    n = len(nums)
    return [[nums[j] for j in range(n) if i & (1 << j)] for i in range(1 << n)]

if __name__ == "__main__":
    r = subsets([1, 2, 3])
    assert len(r) == 8
    assert [] in r and [1, 2, 3] in r
    assert len(subsets_bitmask([1, 2, 3])) == 8
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 041: 부분집합 (Subsets)
 *
 * [문제] 중복 없는 정수 배열의 모든 부분집합(멱집합)을 반환하라.
 *
 * [아키텍트의 시선]
 * 부분집합 열거는 기능 플래그 조합 테스트, 마이크로서비스 의존성 분석,
 * 설정 옵션의 모든 가능한 조합 검증과 동일하다.
 * 비트마스킹과 백트래킹 두 방법 모두 이해해야 한다.
 *
 * [시간 복잡도] O(n * 2^n) [공간 복잡도] O(n * 2^n)
 */
import java.util.*;

public class P041Subsets {
    public static List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(nums, 0, new ArrayList<>(), result);
        return result;
    }

    private static void backtrack(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
        result.add(new ArrayList<>(current)); // 현재 상태를 결과에 추가
        for (int i = start; i < nums.length; i++) {
            current.add(nums[i]);          // 선택
            backtrack(nums, i + 1, current, result); // 탐색
            current.remove(current.size() - 1);       // 되돌리기
        }
    }

    // 비트마스킹 방법
    public static List<List<Integer>> subsetsBitmask(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        int n = nums.length;
        for (int mask = 0; mask < (1 << n); mask++) {
            List<Integer> subset = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                if ((mask & (1 << i)) != 0) subset.add(nums[i]);
            }
            result.add(subset);
        }
        return result;
    }

    public static void main(String[] args) {
        List<List<Integer>> r = subsets(new int[]{1, 2, 3});
        assert r.size() == 8; // 2^3 = 8
        assert r.contains(Arrays.asList());
        assert r.contains(Arrays.asList(1, 2, 3));

        List<List<Integer>> r2 = subsetsBitmask(new int[]{1, 2});
        assert r2.size() == 4;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
