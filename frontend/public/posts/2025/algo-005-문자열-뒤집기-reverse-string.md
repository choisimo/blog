---
title: "[알고리즘] 문자열 뒤집기 (Reverse String)"
date: "2025-04-10"
category: "Algorithm"
tags: ["Algorithm", "양끝 포인터", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 문자열 뒤집기 (Reverse String) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

문자열 뒤집기는 단순한 교환 문제가 아니라, 연속 버퍼를 양끝에서 동시에 소비하며 덮어쓰기 위험 없이 대칭 변환을 수행하는 문제입니다. `['h','e','l','l','o']`를 예로 들어, in-place 버전과 immutable 문자열 환경의 설계 차이를 설명해 보세요.

1. `left`, `right` 포인터가 줄어드는 동안 각 swap이 어떤 메모리 셀을 바꾸는지 추적하고, 중앙을 넘기면 종료해도 되는 이유를 설명하세요.
2. 새 버퍼에 복사하는 방식과 in-place swap 방식을 캐시 접근 패턴, 추가 메모리, 병렬화 가능성 측면에서 비교하세요.
3. 문자가 UTF-16 surrogate pair나 가변 길이 인코딩 단위라면 "문자 하나"의 물리적 경계가 어떻게 달라지고, 알고리즘 가정이 어디서 깨지는지 설명하세요.

## 답변할 때 포함할 것

- swap 전후 배열 상태를 최소 2단계 이상 적을 것
- 종료 조건이 왜 `left >= right`인지 설명할 것
- 논리적 문자와 물리적 바이트 단위 차이를 분리할 것

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
