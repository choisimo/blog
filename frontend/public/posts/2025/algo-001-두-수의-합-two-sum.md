---
title: "[알고리즘] 두 수의 합 (Two Sum)"
date: "2025-04-01"
category: "Algorithm"
tags: ["Algorithm", "해시맵", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 두 수의 합 (Two Sum) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

이 문제를 "배열에서 답 하나 찾기"로 보지 말고, 보조 인덱스를 세우지 않으면 조회 비용이 어떻게 폭증하는지 묻는 문제로 보세요. `nums=[2,7,11,15], target=9`가 순차적으로 메모리에 들어온다고 가정하고, 캐시 친화적인 선형 스캔과 해시 버킷의 랜덤 접근이 어떤 비용 교환을 만드는지 설명해 보세요.

1. 각 시점의 `num`, `complement`, `seen` 상태를 시간축으로 해체하고, 왜 "먼저 조회 후 저장" 순서가 같은 원소 재사용을 막는지 불변식으로 증명하세요.
2. 브루트포스 이중 루프와 해시 기반 단일 패스를 CPU 캐시 라인, 메모리 대역폭, 충돌/재해시 비용까지 포함해 비교하세요.
3. 메모리가 부족하거나 입력 분포가 매우 skewed할 때 정렬+투 포인터, 비트셋, 외부 인덱스 중 어떤 대안으로 바꿀지 기준을 제시하세요.

## 답변할 때 포함할 것

- `seen`의 누적 상태를 최소 4시점 이상 적을 것
- 정답 성립 이유를 수식이나 불변식으로 적을 것
- 시간 최적화와 메모리 비용의 교환을 분리해서 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 001: 두 수의 합 (Two Sum)
==========================================================

[문제 설명]
정수 배열 nums와 정수 target이 주어질 때,
합이 target이 되는 두 수의 인덱스를 반환하라.
각 입력에 대해 정확히 하나의 해가 존재하며, 같은 원소를 두 번 사용할 수 없다.

[아키텍트의 시선 - 인덱싱 전략과 조회 최적화]
이 문제는 "조회(Lookup)" 비용을 어떻게 줄이느냐의 핵심을 보여준다.
- 브루트포스: O(n²) - 모든 쌍을 비교 (중첩 루프)
- 해시맵: O(n) - "내가 찾는 값이 이미 등장했는가?"를 O(1)로 확인

실무에서 이 패턴은:
- DB 인덱스 설계 (조회 비용 O(n) → O(log n) → O(1))
- 캐시 레이어 (Redis, Memcached)의 존재 이유
- API Gateway의 라우팅 테이블

핵심 교훈: "반복 탐색"이 보이면 "해시맵으로 인덱싱"을 고려하라.

[시간 복잡도] O(n) - 배열 한 번 순회
[공간 복잡도] O(n) - 해시맵 저장 공간
"""

from typing import List


def two_sum(nums: List[int], target: int) -> List[int]:
    """
    해시맵을 사용한 Two Sum 풀이.

    전략: 배열을 순회하면서, 현재 숫자의 "보수(complement)"가
    이미 해시맵에 존재하는지 확인한다.

    complement = target - current_number
    """
    # 해시맵: {값: 인덱스} 매핑
    seen = {}

    for i, num in enumerate(nums):
        complement = target - num

        # 보수가 이미 등장했는가? → O(1) 조회
        if complement in seen:
            return [seen[complement], i]

        # 현재 값을 인덱싱 (나중에 누군가의 보수가 될 수 있음)
        seen[num] = i

    # 해가 없는 경우 (문제 조건상 발생하지 않음)
    return []


def two_sum_brute_force(nums: List[int], target: int) -> List[int]:
    """
    브루트포스 비교용: O(n²) 풀이.
    아키텍트 관점에서 "왜 해시맵이 필요한가"를 체감하기 위한 대조군.
    """
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []


if __name__ == "__main__":
    # 테스트 케이스 1: 기본
    assert two_sum([2, 7, 11, 15], 9) == [0, 1], "테스트 1 실패"

    # 테스트 케이스 2: 중간 위치
    assert two_sum([3, 2, 4], 6) == [1, 2], "테스트 2 실패"

    # 테스트 케이스 3: 같은 값 두 개
    assert two_sum([3, 3], 6) == [0, 1], "테스트 3 실패"

    # 테스트 케이스 4: 음수 포함
    assert two_sum([-1, -2, -3, -4, -5], -8) == [2, 4], "테스트 4 실패"

    # 테스트 케이스 5: 큰 배열
    large = list(range(10000))
    assert two_sum(large, 19997) == [9998, 9999], "테스트 5 실패"

    print("✓ 모든 테스트 통과!")
    print()
    print("=== 아키텍트 핵심 정리 ===")
    print("1. 해시맵은 '이미 본 것'을 O(1)에 찾는 인덱스다")
    print("2. complement 패턴: target - current → 역방향 사고")
    print("3. 실무 적용: DB 인덱스, 캐시, 라우팅 테이블 모두 같은 원리")
```

## ☕ Java 구현

```java
/**
 * 문제 001: 두 수의 합 (Two Sum)
 * [문제] 정수 배열에서 두 수의 합이 target인 인덱스 쌍을 찾아라.
 * [아키텍트의 시선] 해시맵 기반 인덱싱과 조회 최적화.
 * O(n^2) 브루트포스 → O(n) 해시맵: 공간을 시간으로 교환.
 * 실무: 데이터베이스 인덱스, 캐시 조회, 역인덱스 설계.
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P001TwoSum {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[]{map.get(complement), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        assert Arrays.equals(twoSum(new int[]{2, 7, 11, 15}, 9), new int[]{0, 1});
        assert Arrays.equals(twoSum(new int[]{3, 2, 4}, 6), new int[]{1, 2});
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
