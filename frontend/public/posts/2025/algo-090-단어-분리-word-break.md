---
title: "[알고리즘] 단어 분리 (Word Break)"
date: "2025-11-05"
category: "Algorithm"
tags: ["Algorithm", "문자열 DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 단어 분리 (Word Break) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

Word Break는 문자열을 자르는 문제가 아니라, prefix 경계들 사이를 사전 단어가 간선으로 잇는 implicit graph/DP 문제입니다. 왜 `dp[i]`를 "i까지 분해 가능"으로 두면 전체 문장을 판정할 수 있는지 설명해 보세요.

1. 각 인덱스 `i`에 대해 어떤 `j < i`가 `dp[j] && s[j:i] in dict`를 만족해야 하는지 추적하세요.
2. DP, BFS on indices, Trie 최적화를 비교해 어느 단계에서 문자열 슬라이스 비용을 줄일 수 있는지 설명하세요.
3. "가능 여부"가 아니라 "모든 분해 경우", "최소 단어 수"로 바뀌면 상태가 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- 인덱스 기반 상태 정의를 적을 것
- 사전 membership 검사의 역할을 설명할 것
- Trie가 줄이는 비용이 무엇인지 적을 것

## 🐍 Python 구현

```python
"""
문제 090: 단어 분리 (Word Break)
[문제] 문자열 s를 사전 wordDict의 단어들로 분리할 수 있는지 판별하라.
[아키텍트의 시선] 문자열 DP와 트라이 기반 최적화.
dp[i] = s[:i]가 분리 가능한가. dp[i] = any(dp[j] and s[j:i] in dict).
트라이 사용 시 접두사 매칭 최적화 가능.
실무: 자연어 처리(형태소 분석), URL 파싱, 토크나이저.
[시간 복잡도] O(n^2) 또는 O(n*m) m=최대 단어 길이 [공간 복잡도] O(n)
"""
from typing import List

def word_break(s: str, word_dict: List[str]) -> bool:
    """DP 풀이"""
    word_set = set(word_dict)
    n = len(s)
    dp = [False] * (n + 1)
    dp[0] = True
    for i in range(1, n + 1):
        for j in range(i):
            if dp[j] and s[j:i] in word_set:
                dp[i] = True
                break
    return dp[n]

def word_break_all(s: str, word_dict: List[str]) -> List[str]:
    """모든 분리 방법 반환 (백트래킹)"""
    word_set = set(word_dict)
    result = []
    def backtrack(start, path):
        if start == len(s):
            result.append(" ".join(path))
            return
        for end in range(start + 1, len(s) + 1):
            word = s[start:end]
            if word in word_set:
                backtrack(end, path + [word])
    backtrack(0, [])
    return result

if __name__ == "__main__":
    assert word_break("leetcode", ["leet", "code"]) == True
    assert word_break("applepenapple", ["apple", "pen"]) == True
    assert word_break("catsandog", ["cats", "dog", "sand", "and", "cat"]) == False
    # 모든 분리
    result = word_break_all("catsanddog", ["cat","cats","and","sand","dog"])
    assert "cats and dog" in result
    assert "cat sand dog" in result
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 090: 단어 분리 (Word Break)
 *
 * [문제] 문자열 s를 사전 wordDict의 단어들로 분리할 수 있는지 판별하라.
 *
 * [아키텍트의 시선]
 * 문자열 DP와 트라이 기반 최적화.
 * dp[i] = s[:i]가 분리 가능한가. dp[i] = any(dp[j] and s[j:i] in dict).
 * 트라이 사용 시 접두사 매칭 최적화 가능.
 * 실무: 자연어 처리(형태소 분석), URL 파싱, 토크나이저.
 *
 * [시간 복잡도] O(n^2) 또는 O(n*m) m=최대 단어 길이 [공간 복잡도] O(n)
 */
import java.util.*;

public class P090WordBreak {
    // DP 풀이
    public static boolean wordBreak(String s, List<String> wordDict) {
        Set<String> wordSet = new HashSet<>(wordDict);
        int n = s.length();
        boolean[] dp = new boolean[n + 1];
        dp[0] = true;
        for (int i = 1; i <= n; i++) {
            for (int j = 0; j < i; j++) {
                if (dp[j] && wordSet.contains(s.substring(j, i))) {
                    dp[i] = true;
                    break;
                }
            }
        }
        return dp[n];
    }

    // 모든 분리 방법 반환 (백트래킹)
    public static List<String> wordBreakAll(String s, List<String> wordDict) {
        Set<String> wordSet = new HashSet<>(wordDict);
        List<String> result = new ArrayList<>();
        backtrack(s, wordSet, 0, new ArrayList<>(), result);
        return result;
    }
    private static void backtrack(String s, Set<String> wordSet, int start,
                                   List<String> path, List<String> result) {
        if (start == s.length()) {
            result.add(String.join(" ", path));
            return;
        }
        for (int end = start + 1; end <= s.length(); end++) {
            String word = s.substring(start, end);
            if (wordSet.contains(word)) {
                path.add(word);
                backtrack(s, wordSet, end, path, result);
                path.remove(path.size() - 1);
            }
        }
    }

    public static void main(String[] args) {
        assert wordBreak("leetcode", Arrays.asList("leet", "code")) == true;
        assert wordBreak("applepenapple", Arrays.asList("apple", "pen")) == true;
        assert wordBreak("catsandog", Arrays.asList("cats", "dog", "sand", "and", "cat")) == false;
        // 모든 분리
        List<String> result = wordBreakAll("catsanddog",
            Arrays.asList("cat", "cats", "and", "sand", "dog"));
        assert result.contains("cats and dog");
        assert result.contains("cat sand dog");
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
