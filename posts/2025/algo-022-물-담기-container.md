---
title: "[알고리즘] 물 담기 (Container)"
date: "2025-05-21"
category: "Algorithm"
tags: ["Algorithm", "그리디 수축", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 물 담기 (Container) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**물 담기 (Container)**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 그리디 수축

> **Architect's View**
> 탐욕적 수축과 최적 부분 구조

이 글에서는 물 담기 (Container) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
