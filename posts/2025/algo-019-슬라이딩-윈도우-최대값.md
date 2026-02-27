---
title: "[알고리즘] 슬라이딩 윈도우 최대값"
date: "2025-05-13"
category: "Algorithm"
tags: ["Algorithm", "덱(Deque)", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 슬라이딩 윈도우 최대값 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**슬라이딩 윈도우 최대값**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 덱(Deque)

> **Architect's View**
> 덱 기반 윈도우와 스트림 처리

이 글에서는 슬라이딩 윈도우 최대값 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 019: 슬라이딩 윈도우 최대값 (Sliding Window Maximum)
==========================================================

[문제 설명]
배열 nums와 윈도우 크기 k가 주어질 때,
크기 k의 슬라이딩 윈도우가 이동하며 각 위치의 최대값을 반환.

[아키텍트의 시선 - 덱 기반 윈도우 관리와 스트림 처리]
덱(Deque)에 "유망한 후보"만 유지 → 최대값을 O(1)에 조회.
실무: 실시간 모니터링의 이동 평균/최대, 네트워크 패킷 분석.

[시간 복잡도] O(n) [공간 복잡도] O(k)
"""
from typing import List
from collections import deque


def max_sliding_window(nums: List[int], k: int) -> List[int]:
    dq = deque()  # 인덱스 저장, 값 내림차순 유지
    result = []

    for i, num in enumerate(nums):
        # 윈도우 범위 밖의 인덱스 제거
        while dq and dq[0] < i - k + 1:
            dq.popleft()

        # 현재 값보다 작은 뒤쪽 원소 제거 (절대 최대가 될 수 없으므로)
        while dq and nums[dq[-1]] < num:
            dq.pop()

        dq.append(i)

        if i >= k - 1:
            result.append(nums[dq[0]])

    return result


if __name__ == "__main__":
    assert max_sliding_window([1, 3, -1, -3, 5, 3, 6, 7], 3) == [3, 3, 5, 5, 6, 7]
    assert max_sliding_window([1], 1) == [1]
    assert max_sliding_window([9, 11], 2) == [11]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 019: 슬라이딩 윈도우 최댓값 (Sliding Window Maximum)
 *
 * [문제] 크기 k의 슬라이딩 윈도우가 배열을 지날 때,
 * 각 위치에서의 윈도우 내 최댓값을 반환하라.
 *
 * [아키텍트의 시선]
 * 덱(Deque) 기반 슬라이딩 윈도우는 실시간 스트리밍에서
 * 윈도우 집계(max, min)를 O(1)에 수행하는 핵심 패턴이다.
 * 시계열 DB의 윈도우 함수, 네트워크 QoS 모니터링에 직접 적용된다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(k)
 */
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Arrays;

public class P019SlidingWindowMax {
    public static int[] maxSlidingWindow(int[] nums, int k) {
        if (nums.length == 0) return new int[]{};
        int n = nums.length;
        int[] result = new int[n - k + 1];
        Deque<Integer> deque = new ArrayDeque<>(); // 인덱스 저장, 내림차순 유지

        for (int i = 0; i < n; i++) {
            // 윈도우 범위 밖의 원소 제거
            while (!deque.isEmpty() && deque.peekFirst() < i - k + 1) {
                deque.pollFirst();
            }
            // 현재 값보다 작은 원소는 불필요 → 제거
            while (!deque.isEmpty() && nums[deque.peekLast()] < nums[i]) {
                deque.pollLast();
            }
            deque.offerLast(i);
            // 윈도우가 완성된 시점부터 결과 기록
            if (i >= k - 1) {
                result[i - k + 1] = nums[deque.peekFirst()];
            }
        }
        return result;
    }

    public static void main(String[] args) {
        assert Arrays.equals(
            maxSlidingWindow(new int[]{1,3,-1,-3,5,3,6,7}, 3),
            new int[]{3,3,5,5,6,7});
        assert Arrays.equals(
            maxSlidingWindow(new int[]{1}, 1),
            new int[]{1});
        assert Arrays.equals(
            maxSlidingWindow(new int[]{9,11}, 2),
            new int[]{11});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
