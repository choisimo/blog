---
title: "[알고리즘] 최장 연속 수열"
date: "2025-05-29"
category: "Algorithm"
tags: ["Algorithm", "해시셋", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 최장 연속 수열 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

최장 연속 수열의 핵심은 각 값에서 무작정 확장하는 것이 아니라, "이 값이 어떤 연속 구간의 시작점인가"를 빠르게 판별하는 것입니다. 해시셋이 왜 시작점 탐지 장치로 동작하는지 설명해 보세요.

1. 임의의 값 `x`를 볼 때 `x-1`의 존재 여부가 왜 시작점 판정의 핵심인지 설명하고, 실제 수열 확장 과정을 추적하세요.
2. 정렬 후 선형 스캔과 해시셋 기반 확장 방식을 메모리 사용, 캐시 locality, 중복 처리 관점에서 비교하세요.
3. 값 범위가 좁다면 비트셋, 값 범위가 매우 넓다면 외부 정렬/분산셋으로 설계를 어떻게 바꿀지 설명하세요.

## 답변할 때 포함할 것

- 시작점과 비시작점을 구분해서 적을 것
- 각 값이 중복 탐색되지 않는 이유를 설명할 것
- 범위 특성에 따른 대안 구조를 제시할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 026: 최장 연속 수열 (Longest Consecutive Sequence)
==========================================================

[문제 설명]
정렬되지 않은 배열에서 가장 긴 연속 수열의 길이를 O(n)에 구하라.

[아키텍트의 시선 - 시퀀스 시작점 탐지와 유니온 파인드]
해시셋에 모든 값 저장 → num-1이 없는 값이 시퀀스 시작점.
시작점에서만 확장하므로 각 원소 최대 2번 접근 → O(n).
실무: 이벤트 시퀀스 탐지, 로그 연속 패턴 분석.

[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import List


def longest_consecutive(nums: List[int]) -> int:
    num_set = set(nums)
    max_length = 0

    for num in num_set:
        if num - 1 not in num_set:  # 시퀀스 시작점만 처리
            current = num
            length = 1
            while current + 1 in num_set:
                current += 1
                length += 1
            max_length = max(max_length, length)

    return max_length


if __name__ == "__main__":
    assert longest_consecutive([100, 4, 200, 1, 3, 2]) == 4
    assert longest_consecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]) == 9
    assert longest_consecutive([]) == 0
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 026: 가장 긴 연속 수열 (Longest Consecutive Sequence)
 *
 * [문제] 정렬되지 않은 배열에서 가장 긴 연속 수열의 길이를 O(n)에 구하라.
 *
 * [아키텍트의 시선]
 * HashSet 기반 O(n) 풀이는 "시퀀스의 시작점만 탐색"하는 전략이다.
 * 이는 분산 시스템의 리더 선출, 체인 시작점 탐지,
 * 연속적 이벤트 시퀀스의 시작/끝 감지와 동일한 패턴이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P026LongestConsecutive {
    public static int longestConsecutive(int[] nums) {
        Set<Integer> numSet = new HashSet<>();
        for (int n : nums) numSet.add(n);

        int maxLen = 0;
        for (int num : numSet) {
            // 시퀀스의 시작점인 경우만 탐색 (num-1이 없는 경우)
            if (!numSet.contains(num - 1)) {
                int current = num;
                int length = 1;
                while (numSet.contains(current + 1)) {
                    current++;
                    length++;
                }
                maxLen = Math.max(maxLen, length);
            }
        }
        return maxLen;
    }

    public static void main(String[] args) {
        assert longestConsecutive(new int[]{100, 4, 200, 1, 3, 2}) == 4;
        assert longestConsecutive(new int[]{0, 3, 7, 2, 5, 8, 4, 6, 0, 1}) == 9;
        assert longestConsecutive(new int[]{}) == 0;
        assert longestConsecutive(new int[]{1}) == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
