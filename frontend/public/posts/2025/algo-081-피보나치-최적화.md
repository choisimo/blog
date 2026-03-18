---
title: "[알고리즘] 피보나치 최적화"
date: "2025-10-13"
category: "Algorithm"
tags: ["Algorithm", "메모이제이션/행렬", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 피보나치 최적화 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

피보나치 최적화는 수열 계산이 아니라, 중복되는 하위 문제를 어디에 캐시하고 어떤 순서로 재사용할지 결정하는 문제입니다. 왜 naive recursion이 호출 트리를 폭발시키는지 설명해 보세요.

1. 동일한 `F(k)`가 호출 트리에서 몇 번 재방문되는지 추적하고, memoization이 그 중복을 어떻게 없애는지 설명하세요.
2. top-down memo, bottom-up DP, matrix exponentiation을 시간/공간/상수항 관점에서 비교하세요.
3. 캐시가 CPU L1에 남는 작은 n과 큰 정수 arithmetic가 필요한 큰 n에서 어떤 방식이 유리한지 설명하세요.

## 답변할 때 포함할 것

- 중복 호출 구조를 적을 것
- top-down과 bottom-up의 차이를 설명할 것
- 더 빠른 수학적 방법과 DP를 비교할 것

## 🐍 Python 구현

```python
"""
문제 081: 피보나치 최적화 (Fibonacci Optimization)
[문제] n번째 피보나치 수를 O(log n)에 구하라. 재귀/반복/행렬 거듭제곱 비교.
[아키텍트의 시선] Top-down vs Bottom-up vs 행렬 거듭제곱.
재귀+메모이제이션(Top-down): 호출 스택 O(n), 직관적.
반복(Bottom-up): 공간 O(1), 실용적.
행렬 거듭제곱: O(log n), 이론적 최적 → 대규모 n에 필수.
실무: 분할 정복의 본질, 상태 전이의 행렬 표현.
[시간 복잡도] O(log n) 행렬 / O(n) 반복 [공간 복잡도] O(1)
"""
from typing import List

def fib_recursive(n: int, memo: dict = None) -> int:
    """Top-down 메모이제이션"""
    if memo is None:
        memo = {}
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib_recursive(n-1, memo) + fib_recursive(n-2, memo)
    return memo[n]

def fib_iterative(n: int) -> int:
    """Bottom-up O(1) 공간"""
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

def matrix_mult(A: List[List[int]], B: List[List[int]]) -> List[List[int]]:
    """2x2 행렬 곱셈"""
    return [
        [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
        [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]]
    ]

def matrix_pow(M: List[List[int]], p: int) -> List[List[int]]:
    """행렬 거듭제곱 O(log p)"""
    result = [[1,0],[0,1]]  # 단위 행렬
    while p > 0:
        if p % 2 == 1:
            result = matrix_mult(result, M)
        M = matrix_mult(M, M)
        p //= 2
    return result

def fib_matrix(n: int) -> int:
    """행렬 거듭제곱 O(log n)"""
    if n <= 1:
        return n
    M = [[1,1],[1,0]]
    result = matrix_pow(M, n - 1)
    return result[0][0]

if __name__ == "__main__":
    for n, expected in [(0,0),(1,1),(2,1),(5,5),(10,55),(20,6765)]:
        assert fib_recursive(n) == expected
        assert fib_iterative(n) == expected
        assert fib_matrix(n) == expected
    assert fib_matrix(50) == 12586269025
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 081: 피보나치 최적화 (Fibonacci Optimization)
 *
 * [문제] n번째 피보나치 수를 O(log n)에 구하라. 재귀/반복/행렬 거듭제곱 비교.
 *
 * [아키텍트의 시선]
 * Top-down vs Bottom-up vs 행렬 거듭제곱.
 * 재귀+메모이제이션(Top-down): 호출 스택 O(n), 직관적.
 * 반복(Bottom-up): 공간 O(1), 실용적.
 * 행렬 거듭제곱: O(log n), 이론적 최적 → 대규모 n에 필수.
 * 실무: 분할 정복의 본질, 상태 전이의 행렬 표현.
 *
 * [시간 복잡도] O(log n) 행렬 / O(n) 반복 [공간 복잡도] O(1)
 */
import java.util.*;

public class P081Fibonacci {
    // --- Top-down 메모이제이션 ---
    public static long fibRecursive(int n, Map<Integer,Long> memo) {
        if (n <= 1) return n;
        if (memo.containsKey(n)) return memo.get(n);
        long val = fibRecursive(n - 1, memo) + fibRecursive(n - 2, memo);
        memo.put(n, val);
        return val;
    }

    // --- Bottom-up O(1) 공간 ---
    public static long fibIterative(int n) {
        if (n <= 1) return n;
        long a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            long tmp = a + b;
            a = b;
            b = tmp;
        }
        return b;
    }

    // --- 행렬 거듭제곱 O(log n) ---
    static long[][] matMult(long[][] A, long[][] B) {
        return new long[][] {
            {A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]},
            {A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]}
        };
    }
    static long[][] matPow(long[][] M, int p) {
        long[][] result = {{1,0},{0,1}}; // 단위 행렬
        while (p > 0) {
            if ((p & 1) == 1) result = matMult(result, M);
            M = matMult(M, M);
            p >>= 1;
        }
        return result;
    }
    public static long fibMatrix(int n) {
        if (n <= 1) return n;
        long[][] M = {{1,1},{1,0}};
        long[][] result = matPow(M, n - 1);
        return result[0][0];
    }

    public static void main(String[] args) {
        int[][] tests = {{0,0},{1,1},{2,1},{5,5},{10,55},{20,6765}};
        for (int[] t : tests) {
            assert fibRecursive(t[0], new HashMap<>()) == t[1];
            assert fibIterative(t[0]) == t[1];
            assert fibMatrix(t[0]) == t[1];
        }
        assert fibMatrix(50) == 12586269025L;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
