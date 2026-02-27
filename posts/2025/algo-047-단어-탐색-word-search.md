---
title: "[알고리즘] 단어 탐색 (Word Search)"
date: "2025-07-20"
category: "Algorithm"
tags: ["Algorithm", "DFS+백트래킹", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 단어 탐색 (Word Search) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**단어 탐색 (Word Search)**
* 파트: Recursion & Backtracking
* 관련 알고리즘: DFS+백트래킹

> **Architect's View**
> 패턴 매칭과 상태 관리

이 글에서는 단어 탐색 (Word Search) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 047: 단어 탐색 (Word Search)
[문제] 2D 문자 그리드에서 상하좌우 이동으로 주어진 단어를 찾을 수 있는지 판별.
[아키텍트의 시선] DFS + 방문 상태 관리. 각 셀에서 시작하여 재귀 탐색.
실무: 패턴 매칭 엔진, 경로 탐색, 게임 AI.
[시간 복잡도] O(m*n*4^L) L=단어길이 [공간 복잡도] O(L) 재귀 스택
"""
from typing import List

def exist(board: List[List[str]], word: str) -> bool:
    m, n = len(board), len(board[0])

    def dfs(r, c, idx):
        if idx == len(word):
            return True
        if r < 0 or r >= m or c < 0 or c >= n or board[r][c] != word[idx]:
            return False
        tmp = board[r][c]
        board[r][c] = "#"
        found = any(dfs(r+dr, c+dc, idx+1) for dr, dc in [(0,1),(0,-1),(1,0),(-1,0)])
        board[r][c] = tmp
        return found

    return any(dfs(r, c, 0) for r in range(m) for c in range(n))

if __name__ == "__main__":
    board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]]
    assert exist(board, "ABCCED") is True
    assert exist(board, "SEE") is True
    assert exist(board, "ABCB") is False
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 047: 단어 찾기 (Word Search)
 *
 * [문제] 2D 문자 격자에서 상하좌우로 인접한 셀을 이용하여
 * 주어진 단어를 찾을 수 있는지 판별하라.
 *
 * [아키텍트의 시선]
 * 그리드 탐색 + 백트래킹은 네트워크 토폴로지에서 경로 탐색,
 * 맵 기반 서비스의 경로 검증, 2D 공간 인덱스에서의 패턴 매칭과 동일하다.
 * 방문 마킹/해제는 분산 락의 acquire/release와 같다.
 *
 * [시간 복잡도] O(m * n * 4^L) L=단어길이 [공간 복잡도] O(L) 재귀 스택
 */
public class P047WordSearch {
    public static boolean exist(char[][] board, String word) {
        int m = board.length, n = board[0].length;
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                if (dfs(board, word, i, j, 0)) return true;
            }
        }
        return false;
    }

    private static boolean dfs(char[][] board, String word, int i, int j, int idx) {
        if (idx == word.length()) return true;
        if (i < 0 || i >= board.length || j < 0 || j >= board[0].length) return false;
        if (board[i][j] != word.charAt(idx)) return false;

        char temp = board[i][j];
        board[i][j] = '#'; // 방문 마킹 (제자리)
        boolean found = dfs(board, word, i+1, j, idx+1) ||
                         dfs(board, word, i-1, j, idx+1) ||
                         dfs(board, word, i, j+1, idx+1) ||
                         dfs(board, word, i, j-1, idx+1);
        board[i][j] = temp; // 방문 해제
        return found;
    }

    public static void main(String[] args) {
        char[][] board = {
            {'A','B','C','E'},
            {'S','F','C','S'},
            {'A','D','E','E'}
        };
        assert exist(board, "ABCCED");
        assert exist(board, "SEE");
        assert !exist(board, "ABCB");
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
