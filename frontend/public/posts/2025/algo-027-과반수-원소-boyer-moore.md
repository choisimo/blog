---
title: "[알고리즘] 과반수 원소 (Boyer-Moore)"
date: "2025-05-31"
category: "Algorithm"
tags: ["Algorithm", "투표 알고리즘", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 과반수 원소 (Boyer-Moore) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

Boyer-Moore는 빈도를 다 세지 않고도 과반수를 찾는 상태 압축 알고리즘입니다. 핵심은 "서로 다른 두 표를 지워도 과반수 여부는 보존된다"는 상쇄(cancellation) 논리인데, 이를 스트림 처리 관점에서 설명해 보세요.

1. `candidate`와 `count`가 입력 스트림을 따라 어떻게 변하는지 추적하고, count가 0이 되는 순간 후보를 갈아끼워도 되는 이유를 설명하세요.
2. 해시맵 전체 카운팅 방식과 Boyer-Moore 방식을 메모리 사용량, 온라인 처리, 검증 필요성 관점에서 비교하세요.
3. 과반수가 항상 존재하지 않는 경우 왜 2차 검증이 필요하며, 이 알고리즘이 즉시 깨지는 반례는 무엇인지 제시하세요.

## 답변할 때 포함할 것

- 상쇄되는 쌍의 의미를 문장으로 적을 것
- 후보 교체 시점을 단계별로 적을 것
- 1차 선택과 2차 검증을 분리해서 설명할 것

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
