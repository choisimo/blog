---
title: "[알고리즘] 유효한 괄호 (Valid Parentheses)"
date: "2025-05-04"
category: "Algorithm"
tags: ["Algorithm", "스택", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 유효한 괄호 (Valid Parentheses) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**유효한 괄호 (Valid Parentheses)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 스택

> **Architect's View**
> 상태 머신과 구문 분석

이 글에서는 유효한 괄호 (Valid Parentheses) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 015: 유효한 괄호 (Valid Parentheses)
==========================================================

[문제 설명]
'(', ')', '{', '}', '[', ']' 로 이루어진 문자열의 괄호 유효성을 판별.

[아키텍트의 시선 - 스택 기반 상태 머신과 구문 분석]
컴파일러의 구문 분석기(Parser)는 이 패턴의 확장.
스택은 "가장 최근에 열린 것을 먼저 닫아야 한다"는 LIFO 제약을 강제.
실무: HTML/XML 파서, 표현식 평가기, IDE 괄호 매칭.

[시간 복잡도] O(n) [공간 복잡도] O(n)
"""


def is_valid(s: str) -> bool:
    stack = []
    mapping = {")": "(", "}": "{", "]": "["}

    for char in s:
        if char in mapping:
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        else:
            stack.append(char)

    return len(stack) == 0


if __name__ == "__main__":
    assert is_valid("()") is True
    assert is_valid("()[]{}") is True
    assert is_valid("(]") is False
    assert is_valid("([)]") is False
    assert is_valid("{[]}") is True
    assert is_valid("") is True
    assert is_valid("(") is False

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 015: 유효한 괄호 (Valid Parentheses)
 *
 * [문제] 괄호 문자열이 올바르게 열리고 닫히는지 검증하라.
 * '(', ')', '{', '}', '[', ']'만 포함.
 *
 * [아키텍트의 시선]
 * 괄호 매칭은 컴파일러 파서, XML/HTML 유효성 검증,
 * 트랜잭션 범위 검증(Begin/Commit/Rollback)의 기본 원리다.
 * 스택은 중첩 구조를 선형으로 처리하는 가장 자연스러운 자료구조다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.Stack;
import java.util.Map;

public class P015ValidParentheses {
    public static boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        Map<Character, Character> pairs = Map.of(')', '(', '}', '{', ']', '[');

        for (char c : s.toCharArray()) {
            if (pairs.containsValue(c)) {
                stack.push(c);
            } else if (pairs.containsKey(c)) {
                if (stack.isEmpty() || stack.pop() != pairs.get(c)) {
                    return false;
                }
            }
        }
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        assert isValid("()");
        assert isValid("()[]{}");
        assert !isValid("(]");
        assert !isValid("([)]");
        assert isValid("{[]}");
        assert !isValid("]");
        assert isValid("");
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
