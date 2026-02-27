---
title: "[알고리즘] 세 수의 합 (3Sum)"
date: "2025-05-18"
category: "Algorithm"
tags: ["Algorithm", "정렬+투포인터", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 세 수의 합 (3Sum) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**세 수의 합 (3Sum)**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 정렬+투포인터

> **Architect's View**
> 중복 제거와 탐색 전략

이 글에서는 세 수의 합 (3Sum) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
