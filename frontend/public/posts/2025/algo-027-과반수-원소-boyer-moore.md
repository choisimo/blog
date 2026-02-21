---
title: "[알고리즘] 과반수 원소 (Boyer-Moore)"
date: "2025-05-31"
category: "Algorithm"
tags: ["Algorithm", "투표 알고리즘", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 과반수 원소 (Boyer-Moore) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**과반수 원소 (Boyer-Moore)**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 투표 알고리즘

> **Architect's View**
> 스트리밍 알고리즘과 상태 압축

이 글에서는 과반수 원소 (Boyer-Moore) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 027: 과반수 원소 (Majority Element - Boyer-Moore Voting)
==========================================================

[문제 설명]
배열에서 n/2번 이상 등장하는 원소를 찾아라. 항상 존재한다고 가정.

[아키텍트의 시선 - 스트리밍 알고리즘과 상태 압축]
Boyer-Moore 투표: O(1) 공간으로 과반수 원소 탐지.
"다른 원소와 상쇄" → 과반수는 상쇄 후에도 남는다.
실무: 대규모 분산 시스템의 리더 선출, 네트워크 다수결.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""
from typing import List


def majority_element(nums: List[int]) -> int:
    candidate = None
    count = 0

    for num in nums:
        if count == 0:
            candidate = num
        count += 1 if num == candidate else -1

    return candidate


if __name__ == "__main__":
    assert majority_element([3, 2, 3]) == 3
    assert majority_element([2, 2, 1, 1, 1, 2, 2]) == 2
    assert majority_element([1]) == 1
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 027: 과반수 원소 (Majority Element)
 *
 * [문제] 배열에서 n/2번 초과 등장하는 원소를 찾아라.
 * Boyer-Moore 투표 알고리즘을 사용하라.
 *
 * [아키텍트의 시선]
 * Boyer-Moore 투표는 스트리밍 데이터에서 O(1) 공간으로 빈도 분석하는 핵심이다.
 * 분산 시스템의 쿼럼(Quorum) 합의, 리더 선출 프로토콜(Raft/Paxos)에서
 * 과반수 결정과 동일한 원리다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P027MajorityElement {
    public static int majorityElement(int[] nums) {
        int candidate = 0, count = 0;
        // Phase 1: 후보 선정 (상쇄 원리)
        for (int num : nums) {
            if (count == 0) candidate = num;
            count += (num == candidate) ? 1 : -1;
        }
        // Phase 2: 검증 (문제에서 과반수 보장이므로 생략 가능)
        return candidate;
    }

    public static void main(String[] args) {
        assert majorityElement(new int[]{3, 2, 3}) == 3;
        assert majorityElement(new int[]{2, 2, 1, 1, 1, 2, 2}) == 2;
        assert majorityElement(new int[]{1}) == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
