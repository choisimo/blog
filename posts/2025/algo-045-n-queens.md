---
title: "[알고리즘] N-Queens"
date: "2025-07-16"
category: "Algorithm"
tags: ["Algorithm", "CSP+백트래킹", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - N-Queens 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

N-Queens는 단순 배치 문제가 아니라, 행/열/대각선 제약이 동시에 걸린 CSP(Constraint Satisfaction Problem)입니다. 왜 보드를 완성한 뒤 충돌을 검사하는 방식이 아니라, 놓는 순간 제약 위반을 차단해야 하는지 설명해 보세요.

1. 각 행에 퀸 하나를 놓는다고 가정할 때, 열 집합과 두 대각선 집합이 어떤 제약 상태를 표현하는지 추적하세요.
2. 보드를 매번 다시 스캔하는 방식과 set/bitmask 제약 추적 방식을 비교해, 어떤 비용을 사전 지불함으로써 branching factor를 줄이는지 설명하세요.
3. N이 커질수록 메모리보다 탐색 폭이 병목이 되는 이유와, 대칭성 제거 같은 최적화가 왜 중요한지 설명하세요.

## 답변할 때 포함할 것

- 열/대각선 제약 상태를 명시할 것
- prune가 일어나는 시점을 적을 것
- CSP라는 관점으로 문제를 설명할 것

## 🐍 Python 구현

```python
"""
문제 045: N-Queens
[문제] N×N 체스판에 N개의 퀸을 서로 공격 불가능하게 배치하는 모든 방법.
[아키텍트의 시선] 제약 만족 문제(CSP)와 백트래킹.
행 단위로 배치하며, 열/대각선 충돌을 O(1)에 검사 (집합 사용).
[시간 복잡도] O(N!) [공간 복잡도] O(N²)
"""
from typing import List

def solve_n_queens(n: int) -> List[List[str]]:
    result = []
    cols = set()
    diag1 = set()  # row - col
    diag2 = set()  # row + col

    def backtrack(row, board):
        if row == n:
            result.append(["".join(r) for r in board])
            return
        for col in range(n):
            if col in cols or (row - col) in diag1 or (row + col) in diag2:
                continue
            cols.add(col); diag1.add(row - col); diag2.add(row + col)
            board[row][col] = "Q"
            backtrack(row + 1, board)
            board[row][col] = "."
            cols.remove(col); diag1.remove(row - col); diag2.remove(row + col)

    board = [["." for _ in range(n)] for _ in range(n)]
    backtrack(0, board)
    return result

if __name__ == "__main__":
    assert len(solve_n_queens(4)) == 2
    assert len(solve_n_queens(1)) == 1
    assert len(solve_n_queens(8)) == 92
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 045: N-Queens
 *
 * [문제] N x N 체스판에 N개의 퀸을 서로 공격하지 않도록 배치하는
 * 모든 해를 찾아라.
 *
 * [아키텍트의 시선]
 * N-Queens는 제약 만족 문제(CSP)의 대표 사례다.
 * 리소스 할당에서 충돌 회피(포트 할당, IP 충돌 방지, 스레드 교착 회피)와
 * 동일한 구조다. 백트래킹 + 가지치기 = 제약 전파(Constraint Propagation).
 *
 * [시간 복잡도] O(n!) [공간 복잡도] O(n)
 */
import java.util.*;

public class P045NQueens {
    public static List<List<String>> solveNQueens(int n) {
        List<List<String>> result = new ArrayList<>();
        int[] queens = new int[n]; // queens[row] = col
        Arrays.fill(queens, -1);
        Set<Integer> cols = new HashSet<>();
        Set<Integer> diag1 = new HashSet<>(); // row - col
        Set<Integer> diag2 = new HashSet<>(); // row + col
        backtrack(n, 0, queens, cols, diag1, diag2, result);
        return result;
    }

    private static void backtrack(int n, int row, int[] queens,
            Set<Integer> cols, Set<Integer> diag1, Set<Integer> diag2,
            List<List<String>> result) {
        if (row == n) {
            result.add(buildBoard(queens, n));
            return;
        }
        for (int col = 0; col < n; col++) {
            if (cols.contains(col) || diag1.contains(row - col) || diag2.contains(row + col))
                continue;
            queens[row] = col;
            cols.add(col); diag1.add(row - col); diag2.add(row + col);
            backtrack(n, row + 1, queens, cols, diag1, diag2, result);
            cols.remove(col); diag1.remove(row - col); diag2.remove(row + col);
        }
    }

    private static List<String> buildBoard(int[] queens, int n) {
        List<String> board = new ArrayList<>();
        for (int row = 0; row < n; row++) {
            char[] line = new char[n];
            Arrays.fill(line, '.');
            line[queens[row]] = 'Q';
            board.add(new String(line));
        }
        return board;
    }

    public static void main(String[] args) {
        assert solveNQueens(4).size() == 2;
        assert solveNQueens(1).size() == 1;
        assert solveNQueens(8).size() == 92;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
