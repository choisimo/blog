---
title: "[알고리즘] 물 담기 (Container)"
date: "2025-05-21"
category: "Algorithm"
tags: ["Algorithm", "그리디 수축", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 물 담기 (Container) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

이 문제의 핵심은 넓이 계산이 아니라, 두 경계를 줄여 가는 동안 어떤 쪽을 버려야 미래 최대 면적의 가능성을 덜 잃는지 판단하는 것입니다. 가장 낮은 벽을 움직이는 전략이 왜 탐욕적으로 정당화되는지 설명해 보세요.

1. `height[left]`, `height[right]`, 폭 `w`가 면적을 어떻게 결정하는지 추적하고, 작은 쪽을 이동해야만 더 큰 면적 가능성이 남는 이유를 논리적으로 설명하세요.
2. 모든 쌍 비교 방식과 투 포인터 수축 방식을 메모리 접근 패턴, 비교 횟수, 조기 가지치기 관점에서 비교하세요.
3. 벽 하나의 두께, 비균일 간격, 3차원 용기처럼 문제 모델이 바뀌면 왜 같은 그리디 불변식이 무너지는지 설명하세요.

## 답변할 때 포함할 것

- 면적이 줄거나 늘 수 있는 조건을 명시할 것
- 왜 큰 쪽을 움직여도 소용없는지 설명할 것
- 모델 변경 시 깨지는 전제를 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 022: 물 담기 (Container With Most Water)
==========================================================

[문제 설명]
높이 배열이 주어질 때, 가장 많은 물을 담을 수 있는 두 벽을 찾아라.

[아키텍트의 시선 - 탐욕적 수축과 최적 부분 구조]
양 끝에서 시작하여 짧은 쪽을 안쪽으로 이동 (더 높은 벽을 찾아).
짧은 벽을 유지하면 면적이 절대 증가할 수 없으므로 안전한 탐욕 선택.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""
from typing import List


def max_area(height: List[int]) -> int:
    left, right = 0, len(height) - 1
    max_water = 0

    while left < right:
        w = right - left
        h = min(height[left], height[right])
        max_water = max(max_water, w * h)

        if height[left] < height[right]:
            left += 1
        else:
            right -= 1

    return max_water


if __name__ == "__main__":
    assert max_area([1, 8, 6, 2, 5, 4, 8, 3, 7]) == 49
    assert max_area([1, 1]) == 1
    assert max_area([4, 3, 2, 1, 4]) == 16
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 022: 가장 많은 물을 담는 컨테이너 (Container With Most Water)
 *
 * [문제] 높이 배열이 주어질 때, 두 선분과 x축으로 만든 컨테이너에
 * 담을 수 있는 최대 물의 양을 구하라.
 *
 * [아키텍트의 시선]
 * 투 포인터의 탐욕적 이동은 리소스 할당 최적화의 핵심이다.
 * "병목(짧은 쪽)을 먼저 개선"하는 전략은 시스템 성능 튜닝의 기본 원칙 —
 * Amdahl의 법칙과 동일한 사고방식이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P022ContainerWithMostWater {
    public static int maxArea(int[] height) {
        int left = 0, right = height.length - 1;
        int maxWater = 0;

        while (left < right) {
            int h = Math.min(height[left], height[right]);
            int w = right - left;
            maxWater = Math.max(maxWater, h * w);
            // 낮은 쪽을 이동해야 더 큰 영역을 찾을 가능성이 있다
            if (height[left] < height[right]) {
                left++;
            } else {
                right--;
            }
        }
        return maxWater;
    }

    public static void main(String[] args) {
        assert maxArea(new int[]{1,8,6,2,5,4,8,3,7}) == 49;
        assert maxArea(new int[]{1,1}) == 1;
        assert maxArea(new int[]{4,3,2,1,4}) == 16;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
