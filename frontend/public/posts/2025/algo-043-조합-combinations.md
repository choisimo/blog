---
title: "[알고리즘] 조합 (Combinations)"
date: "2025-07-10"
category: "Algorithm"
tags: ["Algorithm", "가지치기", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 조합 (Combinations) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

조합 생성은 순열과 달리 순서가 의미 없으므로, 같은 원소 집합을 여러 경로로 다시 만들지 않게 탐색 공간을 잘라내는 것이 핵심입니다. 왜 `start` 인덱스가 단순 구현 변수 이상인지 설명해 보세요.

1. 현재 depth와 `start`가 어떤 후보 공간을 남겨 두는지 추적하고, 왜 이전 인덱스로 되돌아가면 중복이 생기는지 설명하세요.
2. 순열 생성과 비교해 탐색 트리의 branching factor가 어떻게 달라지는지, pruning이 어느 수준에서 가능한지 설명하세요.
3. `n choose k`를 단순 생성이 아니라 자원 선택, 샘플링, 조합 최적화로 일반화하면 어떤 추가 제약이 들어올 수 있는지 설명하세요.

## 답변할 때 포함할 것

- `start`가 표현하는 후보 범위를 적을 것
- 순열과의 차이를 명확히 적을 것
- pruning이 가능한 근거를 설명할 것

## 🐍 Python 구현

```python
"""
문제 043: 조합 (Combinations)
[문제] 1~n에서 k개를 선택하는 모든 조합을 구하라.
[아키텍트의 시선] 가지치기로 탐색 공간 축소. 남은 개수 부족 시 조기 종료.
[시간 복잡도] O(C(n,k) * k) [공간 복잡도] O(C(n,k) * k)
"""
from typing import List

def combine(n: int, k: int) -> List[List[int]]:
    result = []
    def backtrack(start, current):
        if len(current) == k:
            result.append(current[:])
            return
        remaining_needed = k - len(current)
        for i in range(start, n - remaining_needed + 2):
            current.append(i)
            backtrack(i + 1, current)
            current.pop()
    backtrack(1, [])
    return result

if __name__ == "__main__":
    assert len(combine(4, 2)) == 6
    assert [1, 2] in combine(4, 2)
    assert len(combine(5, 3)) == 10
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 043: 조합 (Combinations)
 *
 * [문제] 1부터 n까지의 수에서 k개를 선택하는 모든 조합을 반환하라.
 *
 * [아키텍트의 시선]
 * 조합 생성은 팀 구성, 리소스 할당, 포트폴리오 최적화에서
 * 가능한 선택지를 열거하는 기본 패턴이다.
 * 가지치기(pruning)로 불필요한 탐색을 줄이는 것이 핵심이다.
 *
 * [시간 복잡도] O(C(n,k) * k) [공간 복잡도] O(C(n,k) * k)
 */
import java.util.*;

public class P043Combinations {
    public static List<List<Integer>> combine(int n, int k) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(n, k, 1, new ArrayList<>(), result);
        return result;
    }

    private static void backtrack(int n, int k, int start, List<Integer> current, List<List<Integer>> result) {
        if (current.size() == k) {
            result.add(new ArrayList<>(current));
            return;
        }
        // 가지치기: 남은 수가 부족하면 중단
        for (int i = start; i <= n - (k - current.size()) + 1; i++) {
            current.add(i);
            backtrack(n, k, i + 1, current, result);
            current.remove(current.size() - 1);
        }
    }

    public static void main(String[] args) {
        List<List<Integer>> r = combine(4, 2);
        assert r.size() == 6; // C(4,2) = 6
        assert r.contains(Arrays.asList(1, 2));
        assert r.contains(Arrays.asList(3, 4));

        assert combine(1, 1).size() == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
