---
title: "[알고리즘] LCS (최장 공통 부분수열)"
date: "2025-10-25"
category: "Algorithm"
tags: ["Algorithm", "2D DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - LCS (최장 공통 부분수열) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**LCS (최장 공통 부분수열)**
* 파트: Dynamic Programming
* 관련 알고리즘: 2D DP

> **Architect's View**
> diff 알고리즘의 기초

이 글에서는 LCS (최장 공통 부분수열) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 086: 최장 공통 부분수열 (Longest Common Subsequence)
[문제] 두 문자열의 최장 공통 부분수열(LCS)의 길이를 구하라.
[아키텍트의 시선] diff 알고리즘의 기초.
dp[i][j] = dp[i-1][j-1]+1 if match, else max(dp[i-1][j], dp[i][j-1]).
git diff, DNA 서열 비교, 문서 비교의 핵심 알고리즘.
실무: 버전 관리 diff, 표절 탐지, 바이오인포매틱스.
[시간 복잡도] O(m*n) [공간 복잡도] O(min(m,n))
"""


def lcs_length(text1: str, text2: str) -> int:
    """2D DP → 1D 최적화"""
    if len(text1) < len(text2):
        text1, text2 = text2, text1
    m, n = len(text1), len(text2)
    prev = [0] * (n + 1)
    for i in range(1, m + 1):
        curr = [0] * (n + 1)
        for j in range(1, n + 1):
            if text1[i - 1] == text2[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(prev[j], curr[j - 1])
        prev = curr
    return prev[n]


def lcs_string(text1: str, text2: str) -> str:
    """실제 LCS 문자열 복원"""
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i - 1] == text2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    # 역추적
    result = []
    i, j = m, n
    while i > 0 and j > 0:
        if text1[i - 1] == text2[j - 1]:
            result.append(text1[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] > dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return "".join(reversed(result))


if __name__ == "__main__":
    assert lcs_length("abcde", "ace") == 3
    assert lcs_string("abcde", "ace") == "ace"
    assert lcs_length("abc", "def") == 0
    assert lcs_length("abc", "abc") == 3
    assert len(lcs_string("ABCBDAB", "BDCAB")) == 4  # BDAB 또는 BCAB 등 여러 정답 가능
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 086: 최장 공통 부분수열 (Longest Common Subsequence)
 *
 * [문제] 두 문자열의 최장 공통 부분수열(LCS)의 길이를 구하라.
 *
 * [아키텍트의 시선]
 * diff 알고리즘의 기초.
 * dp[i][j] = dp[i-1][j-1]+1 if match, else max(dp[i-1][j], dp[i][j-1]).
 * git diff, DNA 서열 비교, 문서 비교의 핵심 알고리즘.
 * 실무: 버전 관리 diff, 표절 탐지, 바이오인포매틱스.
 *
 * [시간 복잡도] O(m*n) [공간 복잡도] O(min(m,n))
 */

public class P086LCS {
    // 1D 최적화된 LCS 길이
    public static int lcsLength(String text1, String text2) {
        if (text1.length() < text2.length()) {
            String tmp = text1; text1 = text2; text2 = tmp;
        }
        int m = text1.length(), n = text2.length();
        int[] prev = new int[n + 1];
        for (int i = 1; i <= m; i++) {
            int[] curr = new int[n + 1];
            for (int j = 1; j <= n; j++) {
                if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                    curr[j] = prev[j - 1] + 1;
                } else {
                    curr[j] = Math.max(prev[j], curr[j - 1]);
                }
            }
            prev = curr;
        }
        return prev[n];
    }

    // 실제 LCS 문자열 복원
    public static String lcsString(String text1, String text2) {
        int m = text1.length(), n = text2.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }
        // 역추적
        StringBuilder sb = new StringBuilder();
        int i = m, j = n;
        while (i > 0 && j > 0) {
            if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                sb.append(text1.charAt(i - 1));
                i--; j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
        return sb.reverse().toString();
    }

    public static void main(String[] args) {
        assert lcsLength("abcde", "ace") == 3;
        assert lcsString("abcde", "ace").equals("ace");
        assert lcsLength("abc", "def") == 0;
        assert lcsLength("abc", "abc") == 3;
        assert lcsString("ABCBDAB", "BDCAB").length() == 4; // BDAB 또는 BCAB 등
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
