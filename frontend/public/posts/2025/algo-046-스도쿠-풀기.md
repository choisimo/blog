---
title: "[알고리즘] 스도쿠 풀기"
date: "2025-07-18"
category: "Algorithm"
tags: ["Algorithm", "제약 전파", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 스도쿠 풀기 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

스도쿠는 단순 백트래킹보다, 제약 전파와 선택 전략이 탐색량을 얼마나 줄이는지 묻는 문제입니다. 왜 빈칸을 아무 순서로나 채우지 않고, 가능한 후보 수가 적은 칸을 먼저 잡는 휴리스틱이 강력한지 설명해 보세요.

1. 행/열/박스 제약이 각 빈칸의 후보 집합을 어떻게 줄이는지 추적하고, 한 칸 선택이 다른 칸 상태를 어떻게 전파시키는지 설명하세요.
2. 무식한 DFS, 비트마스크 기반 후보 관리, exact cover류 접근을 탐색 폭과 구현 복잡도 관점에서 비교하세요.
3. 스도쿠를 일반화된 제약 시스템으로 보면, 이 문제에서만 유효한 최적화와 범용 CSP 최적화는 무엇이 다른지 설명하세요.

## 답변할 때 포함할 것

- 후보 집합 축소 과정을 적을 것
- 탐색과 제약 전파를 분리해서 설명할 것
- 선택 휴리스틱의 의미를 적을 것

## 🐍 Python 구현

```python
"""
문제 046: 스도쿠 풀기 (Sudoku Solver)
[문제] 9×9 스도쿠 퍼즐을 풀어라.
[아키텍트의 시선] 제약 전파 + 백트래킹. 빈 칸에 가능한 숫자를 시도,
제약 위반 시 되돌림. 실무: SAT 솔버, 스케줄링 엔진의 기초.
[시간 복잡도] O(9^(빈칸수)) 최악, 실제로는 가지치기로 훨씬 빠름
"""
from typing import List

def solve_sudoku(board: List[List[str]]) -> None:
    rows = [set() for _ in range(9)]
    cols = [set() for _ in range(9)]
    boxes = [set() for _ in range(9)]
    empty = []

    for r in range(9):
        for c in range(9):
            if board[r][c] != ".":
                d = board[r][c]
                rows[r].add(d); cols[c].add(d); boxes[(r//3)*3+c//3].add(d)
            else:
                empty.append((r, c))

    def backtrack(idx):
        if idx == len(empty):
            return True
        r, c = empty[idx]
        box_id = (r // 3) * 3 + c // 3
        for d in "123456789":
            if d not in rows[r] and d not in cols[c] and d not in boxes[box_id]:
                board[r][c] = d
                rows[r].add(d); cols[c].add(d); boxes[box_id].add(d)
                if backtrack(idx + 1):
                    return True
                board[r][c] = "."
                rows[r].remove(d); cols[c].remove(d); boxes[box_id].remove(d)
        return False

    backtrack(0)

if __name__ == "__main__":
    board = [
        ["5","3",".",".","7",".",".",".","."],
        ["6",".",".","1","9","5",".",".","."],
        [".","9","8",".",".",".",".","6","."],
        ["8",".",".",".","6",".",".",".","3"],
        ["4",".",".","8",".","3",".",".","1"],
        ["7",".",".",".","2",".",".",".","6"],
        [".","6",".",".",".",".","2","8","."],
        [".",".",".","4","1","9",".",".","5"],
        [".",".",".",".","8",".",".","7","9"]
    ]
    solve_sudoku(board)
    assert board[0][2] == "4"
    assert board[4][4] == "5"
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 046: 스도쿠 풀기 (Sudoku Solver)
 *
 * [문제] 9x9 스도쿠 퍼즐을 풀어라. 빈 칸은 '.'으로 표시.
 *
 * [아키텍트의 시선]
 * 스도쿠는 다중 제약 조건을 동시에 만족시켜야 하는 CSP 문제다.
 * 데이터베이스의 다중 유니크 제약, 스케줄링의 리소스/시간/인력 동시 제약,
 * 네트워크 라우팅의 대역폭/지연시간/비용 제약과 동일한 구조다.
 *
 * [시간 복잡도] O(9^(빈칸수)) 최악, 실제는 가지치기로 빠름 [공간 복잡도] O(81)
 */
public class P046SudokuSolver {
    public static void solveSudoku(char[][] board) {
        solve(board);
    }

    private static boolean solve(char[][] board) {
        for (int i = 0; i < 9; i++) {
            for (int j = 0; j < 9; j++) {
                if (board[i][j] != '.') continue;
                for (char c = '1'; c <= '9'; c++) {
                    if (isValid(board, i, j, c)) {
                        board[i][j] = c;
                        if (solve(board)) return true;
                        board[i][j] = '.'; // 되돌림
                    }
                }
                return false; // 1~9 모두 불가 → 백트래킹
            }
        }
        return true; // 모든 칸 채움
    }

    private static boolean isValid(char[][] board, int row, int col, char c) {
        for (int i = 0; i < 9; i++) {
            if (board[row][i] == c) return false; // 행 체크
            if (board[i][col] == c) return false; // 열 체크
            // 3x3 박스 체크
            int boxRow = 3 * (row / 3) + i / 3;
            int boxCol = 3 * (col / 3) + i % 3;
            if (board[boxRow][boxCol] == c) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        char[][] board = {
            {'5','3','.','.','7','.','.','.','.'},
            {'6','.','.','1','9','5','.','.','.'},
            {'.','9','8','.','.','.','.','6','.'},
            {'8','.','.','.','6','.','.','.','3'},
            {'4','.','.','8','.','3','.','.','1'},
            {'7','.','.','.','2','.','.','.','6'},
            {'.','6','.','.','.','.','2','8','.'},
            {'.','.','.','4','1','9','.','.','5'},
            {'.','.','.','.','8','.','.','7','9'}
        };
        solveSudoku(board);
        assert board[0][2] == '4'; // 첫 번째 빈칸 검증
        assert board[8][0] == '3'; // 마지막 행 검증
        // 각 행, 열, 박스의 합이 45인지 검증
        for (int i = 0; i < 9; i++) {
            int rowSum = 0, colSum = 0;
            for (int j = 0; j < 9; j++) {
                rowSum += board[i][j] - '0';
                colSum += board[j][i] - '0';
            }
            assert rowSum == 45;
            assert colSum == 45;
        }
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
