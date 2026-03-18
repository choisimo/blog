---
title: "[알고리즘] 순열 (Permutations)"
date: "2025-07-08"
category: "Algorithm"
tags: ["Algorithm", "백트래킹", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 순열 (Permutations) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

순열 생성은 원소를 "모두 한 번씩 쓰는" 전역 제약을 가진 상태 공간 탐색입니다. 부분집합과 달리 위치 정보가 중요해지므로, 같은 원소 집합이라도 배치 순서가 곧 다른 상태가 되는 이유를 설명해 보세요.

1. 깊이별로 선택된 원소 집합과 아직 남은 원소 집합이 어떻게 바뀌는지 추적하고, visited 배열이나 swap 기반 상태가 무엇을 보존하는지 설명하세요.
2. visited 배열 방식과 in-place swap 방식을 캐시 locality, 복사 비용, 상태 복원 난이도 측면에서 비교하세요.
3. 중복 원소가 있을 때 왜 같은 순열이 폭발적으로 중복 생성되는지, 이를 막으려면 어떤 정렬/skip 규칙이 필요한지 설명하세요.

## 답변할 때 포함할 것

- 깊이별 선택 상태를 적을 것
- 상태 복원(backtrack)의 의미를 설명할 것
- 위치와 값이 동시에 제약이 된다는 점을 적을 것

## 🐍 Python 구현

```python
"""
문제 042: 순열 (Permutations)
[문제] 중복 없는 정수 배열의 모든 순열을 구하라.
[아키텍트의 시선] 상태 공간 트리와 백트래킹. n! 경우의 수.
실무: 작업 스케줄링 순서 최적화, 조합 최적화 문제.
[시간 복잡도] O(n * n!) [공간 복잡도] O(n!)
"""
from typing import List

def permute(nums: List[int]) -> List[List[int]]:
    result = []
    def backtrack(current, remaining):
        if not remaining:
            result.append(current[:])
            return
        for i in range(len(remaining)):
            current.append(remaining[i])
            backtrack(current, remaining[:i] + remaining[i+1:])
            current.pop()
    backtrack([], nums)
    return result

if __name__ == "__main__":
    r = permute([1, 2, 3])
    assert len(r) == 6
    assert [1, 2, 3] in r and [3, 2, 1] in r
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 042: 순열 (Permutations)
 *
 * [문제] 중복 없는 정수 배열의 모든 순열을 반환하라.
 *
 * [아키텍트의 시선]
 * 순열 생성은 작업 스케줄링의 모든 실행 순서 탐색,
 * A/B 테스트의 변형 생성, 라우팅 경로 탐색의 기초다.
 * 백트래킹의 "선택-탐색-되돌림" 패턴은 트랜잭션의 commit/rollback과 같다.
 *
 * [시간 복잡도] O(n! * n) [공간 복잡도] O(n!)
 */
import java.util.*;

public class P042Permutations {
    public static List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        boolean[] used = new boolean[nums.length];
        backtrack(nums, used, new ArrayList<>(), result);
        return result;
    }

    private static void backtrack(int[] nums, boolean[] used, List<Integer> current, List<List<Integer>> result) {
        if (current.size() == nums.length) {
            result.add(new ArrayList<>(current));
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            current.add(nums[i]);
            backtrack(nums, used, current, result);
            current.remove(current.size() - 1);
            used[i] = false;
        }
    }

    public static void main(String[] args) {
        List<List<Integer>> r = permute(new int[]{1, 2, 3});
        assert r.size() == 6; // 3! = 6
        assert r.contains(Arrays.asList(1, 2, 3));
        assert r.contains(Arrays.asList(3, 2, 1));

        assert permute(new int[]{1}).size() == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
