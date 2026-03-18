---
title: "[알고리즘] 유효한 괄호 (Valid Parentheses)"
date: "2025-05-04"
category: "Algorithm"
tags: ["Algorithm", "스택", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 유효한 괄호 (Valid Parentheses) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

유효한 괄호는 카운팅 문제가 아니라, 아직 닫히지 않은 문맥(context)을 스택 위에 올려두는 단순 파서 문제입니다. `"([{}])"`와 `"([)]"`를 비교하면서, 왜 개수만 맞아서는 안 되는지 설명해 보세요.

1. 입력 문자를 하나씩 읽을 때 스택이 어떤 "미해결 문맥"을 표현하는지 적고, 닫는 괄호가 나왔을 때 top 검사가 왜 필요충분한지 설명하세요.
2. 단순 카운트 방식, 재귀 하강 방식, 명시적 스택 방식을 오류 탐지 시점, 메모리 사용량, 일반화 가능성 관점에서 비교하세요.
3. 이 문제를 실제 구문 분석기로 확장할 때 토큰 종류가 늘어나면 스택 원소가 단순 문자에서 어떤 구조로 확장되어야 하는지 설명하세요.

## 답변할 때 포함할 것

- 두 문자열의 스택 상태를 대비해서 적을 것
- "순서"가 왜 핵심인지 반례를 들어 설명할 것
- 스택이 표현하는 문맥의 의미를 문장으로 정의할 것

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
