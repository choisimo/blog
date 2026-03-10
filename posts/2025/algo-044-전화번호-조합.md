---
title: "[알고리즘] 전화번호 조합"
date: "2025-07-13"
category: "Algorithm"
tags: ["Algorithm", "재귀 매핑", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 전화번호 조합 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**전화번호 조합**
* 파트: Recursion & Backtracking
* 관련 알고리즘: 재귀 매핑

> **Architect's View**
> 카티전 프로덕트와 매핑

이 글에서는 전화번호 조합 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
