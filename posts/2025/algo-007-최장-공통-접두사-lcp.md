---
title: "[알고리즘] 최장 공통 접두사 (LCP)"
date: "2025-04-14"
category: "Algorithm"
tags: ["Algorithm", "수직/수평 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 최장 공통 접두사 (LCP) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**최장 공통 접두사 (LCP)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: 수직/수평 탐색

> **Architect's View**
> 조기 종료(Early Exit) 전략

이 글에서는 최장 공통 접두사 (LCP) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 007: 가장 긴 공통 접두사 (Longest Common Prefix)
==========================================================

[문제 설명]
문자열 배열에서 가장 긴 공통 접두사를 찾아라.

[아키텍트의 시선 - 수직/수평 탐색과 조기 종료(Early Exit)]
수직 탐색: 모든 문자열의 i번째 문자를 동시에 비교 → 불일치 시 즉시 종료.
실무: API 라우팅 매칭, 파일 경로 공통 디렉토리 찾기.
핵심: 조기 종료로 불필요한 비교를 방지.

[시간 복잡도] O(S) S=모든 문자열 문자 수 합 [공간 복잡도] O(1)
"""

from typing import List


def longest_common_prefix(strs: List[str]) -> str:
    if not strs:
        return ""

    for i, char in enumerate(strs[0]):
        for s in strs[1:]:
            if i >= len(s) or s[i] != char:
                return strs[0][:i]

    return strs[0]


if __name__ == "__main__":
    assert longest_common_prefix(["flower", "flow", "flight"]) == "fl"
    assert longest_common_prefix(["dog", "racecar", "car"]) == ""
    assert longest_common_prefix(["a"]) == "a"
    assert longest_common_prefix([""]) == ""
    assert longest_common_prefix(["prefix", "prefix"]) == "prefix"

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 007: 최장 공통 접두사 (Longest Common Prefix)
 * [문제] 문자열 배열의 최장 공통 접두사를 구하라.
 * [아키텍트의 시선] 조기 종료(Early Exit) 전략.
 * 수직 탐색: 첫 문자열의 각 위치에서 모든 문자열 비교 → 불일치 시 즉시 반환.
 * 실무: 파일 경로 공통 접두사, DNS 접미사 매칭, 라우팅 테이블.
 * [시간 복잡도] O(S) S=모든 문자 총합 [공간 복잡도] O(1)
 */
public class P007LongestCommonPrefix {
    public static String longestCommonPrefix(String[] strs) {
        if (strs == null || strs.length == 0) return "";
        for (int i = 0; i < strs[0].length(); i++) {
            char c = strs[0].charAt(i);
            for (int j = 1; j < strs.length; j++) {
                if (i >= strs[j].length() || strs[j].charAt(i) != c) {
                    return strs[0].substring(0, i);
                }
            }
        }
        return strs[0];
    }

    public static void main(String[] args) {
        assert longestCommonPrefix(new String[]{"flower","flow","flight"}).equals("fl");
        assert longestCommonPrefix(new String[]{"dog","racecar","car"}).equals("");
        assert longestCommonPrefix(new String[]{"a"}).equals("a");
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
