---
title: "[알고리즘] 애너그램 판별 (Valid Anagram)"
date: "2025-04-12"
category: "Algorithm"
tags: ["Algorithm", "카운팅", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 애너그램 판별 (Valid Anagram) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**애너그램 판별 (Valid Anagram)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: 카운팅

> **Architect's View**
> 데이터 정규화와 동등성 비교

이 글에서는 애너그램 판별 (Valid Anagram) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 006: 애너그램 판별 (Valid Anagram)
==========================================================

[문제 설명]
두 문자열 s와 t가 주어질 때, t가 s의 애너그램인지 판별하라.

[아키텍트의 시선 - 데이터 정규화와 동등성 비교]
"같음"을 판별하려면 먼저 "정규화(Normalization)"가 필요.
문자열을 정렬하거나, 문자 빈도수로 변환하여 비교.
실무: API 입력 정규화, DB 중복 검사, 해시 기반 분류.

[시간 복잡도] O(n) [공간 복잡도] O(1) - 알파벳 26자 고정
"""

from collections import Counter


def is_anagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    return Counter(s) == Counter(t)


def is_anagram_array(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    count = [0] * 26
    for cs, ct in zip(s, t):
        count[ord(cs) - ord("a")] += 1
        count[ord(ct) - ord("a")] -= 1
    return all(c == 0 for c in count)


if __name__ == "__main__":
    assert is_anagram("anagram", "nagaram") is True
    assert is_anagram("rat", "car") is False
    assert is_anagram("", "") is True
    assert is_anagram("a", "ab") is False

    assert is_anagram_array("anagram", "nagaram") is True
    assert is_anagram_array("rat", "car") is False

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 006: 애너그램 판별 (Valid Anagram)
 * [문제] 두 문자열이 애너그램인지 판별하라.
 * [아키텍트의 시선] 데이터 정규화와 동등성 비교.
 * 카운팅 배열로 문자 빈도 비교 → O(n) 시간, O(1) 공간.
 * 실무: 해시 기반 그룹핑, 데이터 정규화, 중복 탐지.
 * [시간 복잡도] O(n) [공간 복잡도] O(1) (26글자)
 */
public class P006ValidAnagram {
    public static boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) {
            count[s.charAt(i) - 'a']++;
            count[t.charAt(i) - 'a']--;
        }
        for (int c : count) {
            if (c != 0) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        assert isAnagram("anagram", "nagaram") == true;
        assert isAnagram("rat", "car") == false;
        assert isAnagram("", "") == true;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
