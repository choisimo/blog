---
title: "[알고리즘] 문자열 뒤집기 (Reverse String)"
date: "2025-04-10"
category: "Algorithm"
tags: ["Algorithm", "양끝 포인터", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 문자열 뒤집기 (Reverse String) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**문자열 뒤집기 (Reverse String)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: 양끝 포인터

> **Architect's View**
> 불변성 vs 가변성 트레이드오프

이 글에서는 문자열 뒤집기 (Reverse String) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 005: 문자열 뒤집기 (Reverse String In-Place)
==========================================================

[문제 설명]
문자 배열 s를 추가 공간 없이 in-place로 뒤집어라.

[아키텍트의 시선 - 불변성 vs 가변성 트레이드오프]
파이썬 str은 불변(immutable), 리스트는 가변(mutable).
시스템 설계에서 불변 객체는 스레드 안전성을 보장하지만,
in-place 수정이 필요할 때는 가변 구조가 필요.
양끝 포인터(Two Pointer) 패턴으로 O(1) 공간에 해결.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""

from typing import List


def reverse_string(s: List[str]) -> None:
    left, right = 0, len(s) - 1
    while left < right:
        s[left], s[right] = s[right], s[left]
        left += 1
        right -= 1


if __name__ == "__main__":
    s1 = ["h", "e", "l", "l", "o"]
    reverse_string(s1)
    assert s1 == ["o", "l", "l", "e", "h"]

    s2 = ["H", "a", "n", "n", "a", "h"]
    reverse_string(s2)
    assert s2 == ["h", "a", "n", "n", "a", "H"]

    s3 = ["a"]
    reverse_string(s3)
    assert s3 == ["a"]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 005: 문자열 뒤집기 (Reverse String)
 * [문제] 문자 배열을 in-place로 뒤집어라.
 * [아키텍트의 시선] 불변성 vs 가변성 트레이드오프.
 * Java String은 불변 → char[]로 가변 처리. 양끝 포인터 교환.
 * 실무: 버퍼 처리, 인코딩 변환, 데이터 직렬화.
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P005ReverseString {
    public static void reverseString(char[] s) {
        int left = 0, right = s.length - 1;
        while (left < right) {
            char temp = s[left];
            s[left] = s[right];
            s[right] = temp;
            left++;
            right--;
        }
    }

    public static void main(String[] args) {
        char[] a = {'h','e','l','l','o'};
        reverseString(a);
        assert new String(a).equals("olleh");
        char[] b = {'H','a','n','n','a','h'};
        reverseString(b);
        assert new String(b).equals("hannaH");
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
