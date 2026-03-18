---
title: "[알고리즘] 세 수의 합 (3Sum)"
date: "2025-05-18"
category: "Algorithm"
tags: ["Algorithm", "정렬+투포인터", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 세 수의 합 (3Sum) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

3Sum은 세 값을 찾는 문제가 아니라, 정렬을 통해 탐색 공간의 기하학을 바꾸고 중복 해를 폭발시키지 않도록 경계를 제어하는 문제입니다. `[-1,0,1,2,-1,-4]`를 정렬한 뒤 투 포인터를 움직일 때, 왜 중복 제거가 성능과 정확성 둘 다에 필수인지 설명해 보세요.

1. 기준 인덱스 `i`를 고정한 뒤 `left`, `right`가 움직이며 합을 0으로 수렴시키는 과정을 시공간적으로 추적하세요.
2. 해시 기반 2Sum을 각 `i`마다 반복하는 방식과 정렬+투 포인터 방식을 중복 제어, 메모리 사용, 캐시 locality 관점에서 비교하세요.
3. 값이 아니라 인덱스 구별이 필요하거나, 중복 원소를 여러 번 허용하는 변형이면 불변식이 어떻게 바뀌는지 설명하세요.

## 답변할 때 포함할 것

- 정렬 후 포인터 이동을 최소 3단계 적을 것
- duplicate skip이 필요한 지점을 명시할 것
- 탐색 공간 축소의 이유를 설명할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 021: 세 수의 합 (3Sum)
==========================================================

[문제 설명]
정수 배열에서 합이 0인 고유한 세 수 조합을 모두 찾아라.

[아키텍트의 시선 - 정렬 + 투 포인터와 중복 제거 전략]
정렬 후 하나를 고정, 나머지 둘을 투 포인터로 탐색.
중복 제거: 같은 값 건너뛰기로 O(1) 추가 비용.
실무: 다중 조건 검색에서의 차원 축소 전략.

[시간 복잡도] O(n²) [공간 복잡도] O(1) (결과 제외)
"""
from typing import List


def three_sum(nums: List[int]) -> List[List[int]]:
    nums.sort()
    result = []
    n = len(nums)

    for i in range(n - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        left, right = i + 1, n - 1
        while left < right:
            total = nums[i] + nums[left] + nums[right]
            if total < 0:
                left += 1
            elif total > 0:
                right -= 1
            else:
                result.append([nums[i], nums[left], nums[right]])
                while left < right and nums[left] == nums[left + 1]:
                    left += 1
                while left < right and nums[right] == nums[right - 1]:
                    right -= 1
                left += 1
                right -= 1
    return result


if __name__ == "__main__":
    assert three_sum([-1, 0, 1, 2, -1, -4]) == [[-1, -1, 2], [-1, 0, 1]]
    assert three_sum([0, 1, 1]) == []
    assert three_sum([0, 0, 0]) == [[0, 0, 0]]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 021: 세 수의 합 (3Sum)
 *
 * [문제] 배열에서 합이 0이 되는 세 수의 조합을 모두 찾아라. 중복 제거.
 *
 * [아키텍트의 시선]
 * 정렬 + 투 포인터는 O(n^3)을 O(n^2)로 줄이는 전형적 최적화 패턴이다.
 * 데이터베이스 조인 최적화에서 정렬 기반 머지 조인과 동일한 원리다.
 * 중복 제거 로직은 결과 집합의 유일성 보장 — API 응답 정규화와 같다.
 *
 * [시간 복잡도] O(n^2) [공간 복잡도] O(1) 정렬 제외
 */
import java.util.*;

public class P021ThreeSum {
    public static List<List<Integer>> threeSum(int[] nums) {
        List<List<Integer>> result = new ArrayList<>();
        Arrays.sort(nums);

        for (int i = 0; i < nums.length - 2; i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue; // 중복 건너뛰기
            int left = i + 1, right = nums.length - 1;
            while (left < right) {
                int sum = nums[i] + nums[left] + nums[right];
                if (sum == 0) {
                    result.add(Arrays.asList(nums[i], nums[left], nums[right]));
                    while (left < right && nums[left] == nums[left + 1]) left++;
                    while (left < right && nums[right] == nums[right - 1]) right--;
                    left++; right--;
                } else if (sum < 0) {
                    left++;
                } else {
                    right--;
                }
            }
        }
        return result;
    }

    public static void main(String[] args) {
        List<List<Integer>> r = threeSum(new int[]{-1, 0, 1, 2, -1, -4});
        assert r.size() == 2;
        assert r.contains(Arrays.asList(-1, -1, 2));
        assert r.contains(Arrays.asList(-1, 0, 1));
        assert threeSum(new int[]{0, 0, 0}).size() == 1;
        assert threeSum(new int[]{1, 2, 3}).isEmpty();
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
