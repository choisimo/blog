---
title: "[알고리즘] 전화번호 조합"
date: "2025-07-13"
category: "Algorithm"
tags: ["Algorithm", "재귀 매핑", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 전화번호 조합 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

전화번호 조합은 백트래킹이라기보다, 각 자리의 문자 집합을 따라 카티전 프로덕트를 생성하는 문제입니다. 숫자 시퀀스가 깊이를 결정하고, 각 depth의 alphabet fan-out이 전체 출력 크기를 어떻게 지배하는지 설명해 보세요.

1. 입력 digits의 각 위치가 어떤 문자 집합으로 확장되는지 추적하고, 부분 문자열 builder가 어떤 상태를 보존하는지 설명하세요.
2. 재귀 생성, 반복적 큐 확장, lazy generator 방식을 메모리 피크와 출력 지연 관점에서 비교하세요.
3. 매핑이 균일하지 않거나 locale 별 keypad가 달라지면 상태 공간 크기와 구현 계층이 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- depth별 가능한 문자 수를 적을 것
- 출력 개수가 왜 곱셈 구조를 따르는지 설명할 것
- eager 생성과 lazy 생성의 차이를 적을 것

## 🐍 Python 구현

```python
"""
문제 044: 전화번호 문자 조합 (Letter Combinations of Phone Number)
[문제] 전화 다이얼의 숫자 조합으로 가능한 모든 문자 조합을 구하라.
[아키텍트의 시선] 카티전 프로덕트와 매핑 테이블. 각 자릿수는 독립.
[시간 복잡도] O(4^n) [공간 복잡도] O(n)
"""
from typing import List

PHONE_MAP = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl",
             "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}

def letter_combinations(digits: str) -> List[str]:
    if not digits:
        return []
    result = []
    def backtrack(idx, path):
        if idx == len(digits):
            result.append("".join(path))
            return
        for char in PHONE_MAP[digits[idx]]:
            path.append(char)
            backtrack(idx + 1, path)
            path.pop()
    backtrack(0, [])
    return result

if __name__ == "__main__":
    assert sorted(letter_combinations("23")) == sorted(["ad","ae","af","bd","be","bf","cd","ce","cf"])
    assert letter_combinations("") == []
    assert letter_combinations("2") == ["a", "b", "c"]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 044: 전화번호 문자 조합 (Letter Combinations of a Phone Number)
 *
 * [문제] 전화 키패드의 숫자에 해당하는 모든 문자 조합을 반환하라.
 *
 * [아키텍트의 시선]
 * 다중 입력의 카르테시안 곱(Cartesian Product)은
 * API 파라미터 조합 테스트, 설정 매트릭스 생성,
 * 멀티 플랫폼 빌드 매트릭스(CI/CD)와 동일한 패턴이다.
 *
 * [시간 복잡도] O(4^n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P044PhoneLetterCombinations {
    private static final String[] MAPPING = {
        "", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"
    };

    public static List<String> letterCombinations(String digits) {
        List<String> result = new ArrayList<>();
        if (digits == null || digits.isEmpty()) return result;
        backtrack(digits, 0, new StringBuilder(), result);
        return result;
    }

    private static void backtrack(String digits, int idx, StringBuilder current, List<String> result) {
        if (idx == digits.length()) {
            result.add(current.toString());
            return;
        }
        String letters = MAPPING[digits.charAt(idx) - '0'];
        for (char c : letters.toCharArray()) {
            current.append(c);
            backtrack(digits, idx + 1, current, result);
            current.deleteCharAt(current.length() - 1);
        }
    }

    public static void main(String[] args) {
        List<String> r = letterCombinations("23");
        assert r.size() == 9; // 3 * 3
        assert r.contains("ad");
        assert r.contains("cf");

        assert letterCombinations("").isEmpty();
        assert letterCombinations("2").size() == 3;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
