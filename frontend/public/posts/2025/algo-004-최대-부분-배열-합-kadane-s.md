---
title: "[알고리즘] 최대 부분 배열 합 (Kadane's)"
date: "2025-04-08"
category: "Algorithm"
tags: ["Algorithm", "DP/그리디", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 최대 부분 배열 합 (Kadane's) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

카데인 알고리즘은 배열 문제라기보다, 과거 전체를 저장하지 않고도 "지금까지의 최선"을 유지해야 하는 온라인 상태 압축 문제입니다. `[-2,1,-3,4,-1,2,1,-5,4]`를 스트림으로 본다고 가정하고, 왜 음수 누적합을 과감히 버려도 되는지 설명해 보세요.

1. 각 원소 도착 시점마다 `current_sum`과 `best_sum`이 어떻게 갱신되는지 적고, 음수 prefix를 버리는 결정이 이후 최적해를 해치지 않는 이유를 증명하세요.
2. 모든 부분배열을 저장하거나 prefix-sum 전부를 비교하는 방식과 카데인 방식을 메모리 사용, 지연 시간, 온라인 처리 가능성 측면에서 비교하세요.
3. "합" 대신 "곱", "원형 배열", "삭제 1회 허용"으로 조건이 바뀌면 왜 같은 불변식이 깨지는지 설명하세요.

## 답변할 때 포함할 것

- 최소 5시점 이상의 `current_sum`, `best_sum` 변화를 적을 것
- 음수 prefix 제거의 논리를 반례 없이 설명할 것
- 온라인 처리 가능성과 정확성 보장을 함께 다룰 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 004: 최대 부분 배열 합 (Kadane's Algorithm)
==========================================================

[문제 설명]
정수 배열 nums에서 연속 부분 배열의 최대 합을 구하라.

[아키텍트의 시선 - 온라인 알고리즘과 상태 전이]
Kadane's Algorithm은 "온라인 알고리즘"의 전형.
데이터를 한 번만 순회하면서 답을 구한다 (스트리밍 처리).
상태 전이: current_sum = max(num, current_sum + num)
"이전까지의 합을 이어갈 것인가, 여기서 새로 시작할 것인가"

실무: 실시간 모니터링 시스템의 구간 최대값/최소값 추적.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""

from typing import List


def max_subarray(nums: List[int]) -> int:
    current_sum = max_sum = nums[0]

    for num in nums[1:]:
        # 상태 전이: 이어갈 것인가 vs 새로 시작할 것인가
        current_sum = max(num, current_sum + num)
        max_sum = max(max_sum, current_sum)

    return max_sum


if __name__ == "__main__":
    assert max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]) == 6  # [4,-1,2,1]
    assert max_subarray([1]) == 1
    assert max_subarray([5, 4, -1, 7, 8]) == 23
    assert max_subarray([-1]) == -1
    assert max_subarray([-2, -1]) == -1  # 모두 음수일 때

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 004: 최대 부분 배열 합 (Kadane's Algorithm)
 * [문제] 연속 부분 배열의 최대 합을 구하라.
 * [아키텍트의 시선] 온라인 알고리즘과 상태 전이.
 * current = max(nums[i], current + nums[i]) → 이전을 포함할지 새로 시작할지.
 * 실무: 주가 최대 수익 구간, 네트워크 트래픽 피크 분석.
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P004MaxSubarray {
    public static int maxSubArray(int[] nums) {
        int maxSum = nums[0], current = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            maxSum = Math.max(maxSum, current);
        }
        return maxSum;
    }

    public static void main(String[] args) {
        assert maxSubArray(new int[]{-2,1,-3,4,-1,2,1,-5,4}) == 6;
        assert maxSubArray(new int[]{1}) == 1;
        assert maxSubArray(new int[]{-1}) == -1;
        assert maxSubArray(new int[]{5,4,-1,7,8}) == 23;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
