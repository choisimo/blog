---
title: "[알고리즘] 괄호 생성"
date: "2025-07-24"
category: "Algorithm"
tags: ["Algorithm", "문법 생성", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 괄호 생성 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

괄호 생성은 문자열 나열이 아니라, 잘 형성된 문법만 생성하도록 탐색 트리를 제한하는 생성(grammar production) 문제입니다. 여는 괄호와 닫는 괄호 개수 조건이 왜 지역 제약이면서도 전체 문법을 보장하는지 설명해 보세요.

1. 현재 문자열, `open`, `close` 카운터가 어떤 상태를 표현하는지 추적하고, `close > open`이 왜 금지 상태인지 설명하세요.
2. 모든 2n 길이 이진 문자열 생성 후 필터링하는 방식과 제약 기반 생성 방식을 출력 수, 낭비 연산, 메모리 관점에서 비교하세요.
3. 이 구조가 카탈란 수, 파서 테스트 케이스 생성, balanced structure enumeration과 어떻게 연결되는지 설명하세요.

## 답변할 때 포함할 것

- 유효 prefix 조건을 명시할 것
- 생성과 검증을 분리해서 설명할 것
- 왜 필터링보다 생성 제약이 강한지 적을 것

## 🐍 Python 구현

```python
"""
문제 049: 괄호 생성 (Generate Parentheses)
[문제] n쌍의 유효한 괄호 조합을 모두 생성하라.
[아키텍트의 시선] 문법 생성(Grammar Production)과 카탈란 수.
조건: open < n이면 여는 괄호 추가, close < open이면 닫는 괄호 추가.
실무: 구문 트리 생성, 코드 자동 생성, 템플릿 엔진.
[시간 복잡도] O(4^n / sqrt(n)) - 카탈란 수
"""
from typing import List

def generate_parenthesis(n: int) -> List[str]:
    result = []
    def backtrack(current, open_count, close_count):
        if len(current) == 2 * n:
            result.append("".join(current))
            return
        if open_count < n:
            current.append("(")
            backtrack(current, open_count + 1, close_count)
            current.pop()
        if close_count < open_count:
            current.append(")")
            backtrack(current, open_count, close_count + 1)
            current.pop()
    backtrack([], 0, 0)
    return result

if __name__ == "__main__":
    assert sorted(generate_parenthesis(3)) == sorted(["((()))","(()())","(())()","()(())","()()()"])
    assert generate_parenthesis(1) == ["()"]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 049: 괄호 생성 (Generate Parentheses)
 *
 * [문제] n쌍의 괄호로 만들 수 있는 모든 유효한 조합을 생성하라.
 *
 * [아키텍트의 시선]
 * 유효한 괄호 생성은 문법 기반 코드 생성, API 스키마 유효성 검증,
 * 컴파일러의 구문 트리 생성과 동일한 패턴이다.
 * "열린 괄호 수 >= 닫힌 괄호 수" 불변식은 리소스 할당/해제의 순서 규칙이다.
 *
 * [시간 복잡도] O(4^n / sqrt(n)) 카탈란 수 [공간 복잡도] O(n)
 */
import java.util.*;

public class P049GenerateParentheses {
    public static List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList<>();
        backtrack(n, 0, 0, new StringBuilder(), result);
        return result;
    }

    private static void backtrack(int n, int open, int close, StringBuilder current, List<String> result) {
        if (current.length() == 2 * n) {
            result.add(current.toString());
            return;
        }
        if (open < n) {
            current.append('(');
            backtrack(n, open + 1, close, current, result);
            current.deleteCharAt(current.length() - 1);
        }
        if (close < open) {
            current.append(')');
            backtrack(n, open, close + 1, current, result);
            current.deleteCharAt(current.length() - 1);
        }
    }

    public static void main(String[] args) {
        List<String> r = generateParenthesis(3);
        assert r.size() == 5; // 카탈란 수 C(3) = 5
        assert r.contains("((()))");
        assert r.contains("(()())");
        assert r.contains("(())()");

        assert generateParenthesis(1).size() == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
