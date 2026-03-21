---
title: "[알고리즘] 최소 윈도우 부분 문자열"
date: "2025-06-05"
category: "Algorithm"
tags: ["Algorithm", "슬라이딩 윈도우", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 최소 윈도우 부분 문자열 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

최소 윈도우 부분 문자열은 "조건을 만족하는 아무 구간"이 아니라, 만족 상태를 유지하는 동안 왼쪽 경계를 최대한 밀어 최소 구간을 찾는 제약 최적화 문제입니다. `s="ADOBECODEBANC", t="ABC"`에서 윈도우가 유효해지는 순간과 무효해지는 순간을 분리해서 설명해 보세요.

1. `need`, `window`, `formed`, `left`, `right`가 어떻게 변하는지 추적하고, 유효 상태에서만 축소를 시도해야 하는 이유를 설명하세요.
2. 모든 부분 문자열 검사, 집합 기반 단순 포함 검사, 카운트 기반 윈도우 최적화를 비교해 어떤 정보가 부족하면 최소성을 잃는지 설명하세요.
3. 대소문자 구분, 중복 문자 요구량, 스트리밍 입력처럼 조건이 바뀌면 윈도우 상태 정의를 어떻게 수정해야 하는지 설명하세요.

## 답변할 때 포함할 것

- 유효/무효 전환 시점을 명확히 적을 것
- 최소성 확보가 왜 축소 단계에 달려 있는지 설명할 것
- 단순 포함 검사로는 안 되는 이유를 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 029: 최소 윈도우 부분 문자열 (Minimum Window Substring)
==========================================================

[문제 설명]
문자열 s에서 t의 모든 문자를 포함하는 최소 길이 부분 문자열을 구하라.

[아키텍트의 시선 - 조건부 윈도우 최적화와 필터링 파이프라인]
확장-수축 패턴: 오른쪽으로 확장하여 조건 충족 → 왼쪽에서 수축하여 최소화.
실무: 데이터 스트림에서 조건 만족 구간 탐지, 네트워크 패킷 필터.

[시간 복잡도] O(|s| + |t|) [공간 복잡도] O(|t|)
"""
from collections import Counter


def min_window(s: str, t: str) -> str:
    if not s or not t:
        return ""

    need = Counter(t)
    missing = len(t)
    left = 0
    best_start, best_len = 0, float("inf")

    for right, char in enumerate(s):
        if need[char] > 0:
            missing -= 1
        need[char] -= 1

        while missing == 0:
            window_len = right - left + 1
            if window_len < best_len:
                best_start, best_len = left, window_len

            need[s[left]] += 1
            if need[s[left]] > 0:
                missing += 1
            left += 1

    return "" if best_len == float("inf") else s[best_start:best_start + best_len]


if __name__ == "__main__":
    assert min_window("ADOBECODEBANC", "ABC") == "BANC"
    assert min_window("a", "a") == "a"
    assert min_window("a", "aa") == ""
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 029: 최소 윈도우 부분 문자열 (Minimum Window Substring)
 *
 * [문제] 문자열 s에서 문자열 t의 모든 문자를 포함하는 최소 길이 윈도우를 찾아라.
 *
 * [아키텍트의 시선]
 * 슬라이딩 윈도우의 확장/축소는 auto-scaling의 정수다.
 * "필요한 조건을 만족할 때까지 확장, 만족하면 축소" —
 * 이는 리소스 프로비저닝, 커넥션 풀 조절과 동일한 알고리즘이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(문자집합 크기)
 */
import java.util.*;

public class P029MinWindowSubstring {
    public static String minWindow(String s, String t) {
        if (s.isEmpty() || t.isEmpty()) return "";

        Map<Character, Integer> need = new HashMap<>();
        for (char c : t.toCharArray()) need.merge(c, 1, Integer::sum);

        int required = need.size(); // 만족시켜야 할 고유 문자 수
        int formed = 0;
        Map<Character, Integer> window = new HashMap<>();
        int[] ans = {Integer.MAX_VALUE, 0, 0}; // {길이, 시작, 끝}
        int left = 0;

        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            window.merge(c, 1, Integer::sum);

            if (need.containsKey(c) && window.get(c).intValue() == need.get(c).intValue()) {
                formed++;
            }

            // 조건 만족 → 윈도우 축소 시도
            while (left <= right && formed == required) {
                if (right - left + 1 < ans[0]) {
                    ans[0] = right - left + 1;
                    ans[1] = left;
                    ans[2] = right;
                }
                char lc = s.charAt(left);
                window.merge(lc, -1, Integer::sum);
                if (need.containsKey(lc) && window.get(lc) < need.get(lc)) {
                    formed--;
                }
                left++;
            }
        }
        return ans[0] == Integer.MAX_VALUE ? "" : s.substring(ans[1], ans[2] + 1);
    }

    public static void main(String[] args) {
        assert minWindow("ADOBECODEBANC", "ABC").equals("BANC");
        assert minWindow("a", "a").equals("a");
        assert minWindow("a", "aa").equals("");
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
