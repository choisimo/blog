---
title: "[알고리즘] 편집 거리 (Edit Distance)"
date: "2025-10-27"
category: "Algorithm"
tags: ["Algorithm", "2D DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 편집 거리 (Edit Distance) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**편집 거리 (Edit Distance)**
* 파트: Dynamic Programming
* 관련 알고리즘: 2D DP

> **Architect's View**
> 문자열 유사도 측정

이 글에서는 편집 거리 (Edit Distance) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 087: 편집 거리 (Edit Distance / Levenshtein Distance)
[문제] 문자열 word1을 word2로 변환하는 최소 연산(삽입/삭제/교체) 수를 구하라.
[아키텍트의 시선] 문자열 유사도 측정.
dp[i][j] = word1[:i] → word2[:j] 최소 편집.
삽입(dp[i][j-1]+1), 삭제(dp[i-1][j]+1), 교체(dp[i-1][j-1]+1).
실무: 맞춤법 검사, DNA 돌연변이 분석, 퍼지 매칭, 자동 수정.
[시간 복잡도] O(m*n) [공간 복잡도] O(min(m,n))
"""

def min_distance(word1: str, word2: str) -> int:
    """1D 공간 최적화"""
    m, n = len(word1), len(word2)
    if m < n:
        word1, word2 = word2, word1
        m, n = n, m
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            if word1[i-1] == word2[j-1]:
                curr[j] = prev[j-1]
            else:
                curr[j] = 1 + min(prev[j],      # 삭제
                                  curr[j-1],     # 삽입
                                  prev[j-1])     # 교체
        prev = curr
    return prev[n]

if __name__ == "__main__":
    assert min_distance("horse", "ros") == 3
    assert min_distance("intention", "execution") == 5
    assert min_distance("", "abc") == 3
    assert min_distance("abc", "abc") == 0
    assert min_distance("kitten", "sitting") == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 087: 편집 거리 (Edit Distance / Levenshtein Distance)
 *
 * [문제] 문자열 word1을 word2로 변환하는 최소 연산(삽입/삭제/교체) 수를 구하라.
 *
 * [아키텍트의 시선]
 * 문자열 유사도 측정.
 * dp[i][j] = word1[:i] → word2[:j] 최소 편집.
 * 삽입(dp[i][j-1]+1), 삭제(dp[i-1][j]+1), 교체(dp[i-1][j-1]+1).
 * 실무: 맞춤법 검사, DNA 돌연변이 분석, 퍼지 매칭, 자동 수정.
 *
 * [시간 복잡도] O(m*n) [공간 복잡도] O(min(m,n))
 */

public class P087EditDistance {
    public static int minDistance(String word1, String word2) {
        int m = word1.length(), n = word2.length();
        if (m < n) return minDistance(word2, word1); // 짧은 쪽을 열로
        int[] prev = new int[n + 1];
        for (int j = 0; j <= n; j++) prev[j] = j;
        for (int i = 1; i <= m; i++) {
            int[] curr = new int[n + 1];
            curr[0] = i;
            for (int j = 1; j <= n; j++) {
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                    curr[j] = prev[j - 1];
                } else {
                    curr[j] = 1 + Math.min(prev[j],        // 삭제
                                  Math.min(curr[j - 1],     // 삽입
                                           prev[j - 1]));   // 교체
                }
            }
            prev = curr;
        }
        return prev[n];
    }

    public static void main(String[] args) {
        assert minDistance("horse", "ros") == 3;
        assert minDistance("intention", "execution") == 5;
        assert minDistance("", "abc") == 3;
        assert minDistance("abc", "abc") == 0;
        assert minDistance("kitten", "sitting") == 3;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
