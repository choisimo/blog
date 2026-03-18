---
title: "[알고리즘] 애너그램 판별 (Valid Anagram)"
date: "2025-04-12"
category: "Algorithm"
tags: ["Algorithm", "카운팅", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 애너그램 판별 (Valid Anagram) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

애너그램 판별은 문자열을 "순서 있는 텍스트"로 볼지, "정규화된 빈도 벡터"로 볼지 결정하는 데이터 표현 문제입니다. `s="anagram", t="nagaram"`에서 문자 순서를 버려도 되는 이유와, 그 대신 무엇을 보존해야 하는지 설명해 보세요.

1. 문자 카운트 배열 또는 해시맵이 입력을 받아 어떤 상태로 바뀌는지 추적하고, 최종적으로 모든 카운트가 0이어야 한다는 조건이 왜 필요충분한지 증명하세요.
2. 정렬 후 비교 방식과 카운트 방식의 차이를 CPU cache locality, alphabet 크기, 메모리 상수항 측면에서 비교하세요.
3. 대소문자, Unicode 정규화, 결합 문자처럼 "겉보기에는 같은 문자"가 여러 표현을 가질 때, 동등성 비교 계층을 어떻게 설계할지 설명하세요.

## 답변할 때 포함할 것

- 빈도 구조의 전이 과정을 단계별로 적을 것
- 정규화되지 않은 입력이 만드는 반례를 하나 들 것
- 표현 계층과 비교 계층을 분리해서 설명할 것

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
