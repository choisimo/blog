---
title: "[알고리즘] 최장 부분 문자열"
date: "2025-05-23"
category: "Algorithm"
tags: ["Algorithm", "슬라이딩 윈도우", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 최장 부분 문자열 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

중복 없는 최장 부분 문자열은 "현재 윈도우가 유효한가"를 계속 유지하는 스트림 검증 문제입니다. 입력 문자가 한 글자씩 들어온다고 보고, 왜 윈도우를 통째로 다시 검사하지 않고도 최대 길이를 유지할 수 있는지 설명해 보세요.

1. `left`, `right`, 마지막 등장 위치 맵이 어떻게 갱신되는지 추적하고, 중복 문자를 만났을 때 `left`가 뒤로 가지 않도록 막는 이유를 설명하세요.
2. 집합 기반 한 칸씩 축소 방식과 last-seen index 방식의 차이를 반복 횟수, 캐시 접근, 구현 안정성 관점에서 비교하세요.
3. 문자 집합이 매우 크거나 UTF-8 바이트 스트림으로 온다면 "문자 단위" 경계를 어떻게 다뤄야 하는지 설명하세요.

## 답변할 때 포함할 것

- 윈도우 경계와 해시 상태를 같은 시점에 적을 것
- `left = max(left, last_seen+1)`의 의미를 설명할 것
- 유효성 유지와 최대값 갱신을 분리해서 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 023: 가장 긴 부분 문자열 (Longest Substring Without Repeating Characters)
==========================================================

[문제 설명]
문자열에서 중복 문자가 없는 가장 긴 부분 문자열의 길이를 구하라.

[아키텍트의 시선 - 윈도우 기반 스트림 분석]
슬라이딩 윈도우: 오른쪽 확장 + 조건 위반 시 왼쪽 수축.
실무: 네트워크 패킷 분석, 로그 스트림의 고유 세션 탐지.

[시간 복잡도] O(n) [공간 복잡도] O(min(m,n)) m=문자셋 크기
"""


def length_of_longest_substring(s: str) -> int:
    char_index = {}
    left = max_len = 0

    for right, char in enumerate(s):
        if char in char_index and char_index[char] >= left:
            left = char_index[char] + 1
        char_index[char] = right
        max_len = max(max_len, right - left + 1)

    return max_len


if __name__ == "__main__":
    assert length_of_longest_substring("abcabcbb") == 3
    assert length_of_longest_substring("bbbbb") == 1
    assert length_of_longest_substring("pwwkew") == 3
    assert length_of_longest_substring("") == 0
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 023: 반복 없는 가장 긴 부분 문자열 (Longest Substring Without Repeating Characters)
 *
 * [문제] 문자열에서 중복 문자 없는 가장 긴 부분 문자열의 길이를 구하라.
 *
 * [아키텍트의 시선]
 * 슬라이딩 윈도우 + 해시맵은 스트리밍 데이터에서 고유 세션 추적,
 * 네트워크 패킷의 중복 감지 윈도우, 실시간 유니크 사용자 카운팅과 동일하다.
 * 윈도우의 확장/축소는 auto-scaling의 원리와 같다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(min(n, 문자집합크기))
 */
import java.util.*;

public class P023LongestSubstringWithoutRepeating {
    public static int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> lastSeen = new HashMap<>();
        int maxLen = 0;
        int start = 0;

        for (int end = 0; end < s.length(); end++) {
            char c = s.charAt(end);
            if (lastSeen.containsKey(c) && lastSeen.get(c) >= start) {
                start = lastSeen.get(c) + 1; // 중복 문자 다음으로 윈도우 시작점 이동
            }
            lastSeen.put(c, end);
            maxLen = Math.max(maxLen, end - start + 1);
        }
        return maxLen;
    }

    public static void main(String[] args) {
        assert lengthOfLongestSubstring("abcabcbb") == 3;
        assert lengthOfLongestSubstring("bbbbb") == 1;
        assert lengthOfLongestSubstring("pwwkew") == 3;
        assert lengthOfLongestSubstring("") == 0;
        assert lengthOfLongestSubstring("abcdef") == 6;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
