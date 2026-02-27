---
title: "[알고리즘] 스트림 중앙값"
date: "2025-08-29"
category: "Algorithm"
tags: ["Algorithm", "이중 힙", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - 스트림 중앙값 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**스트림 중앙값**
* 파트: Heap & Graph Basics
* 관련 알고리즘: 이중 힙

> **Architect's View**
> 실시간 통계 시스템

이 글에서는 스트림 중앙값 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 063: 데이터 스트림의 중앙값 (Find Median from Data Stream)
[문제] 정수 스트림에서 addNum, findMedian을 지원하는 자료구조를 설계하라.
[아키텍트의 시선] 실시간 통계 시스템.
이중 힙: max-heap(작은 쪽) + min-heap(큰 쪽)으로 중앙 분리.
항상 max_heap.size >= min_heap.size 유지 → peek만으로 중앙값 계산.
실무: 실시간 P50/P99 계산, 스트리밍 분석, 모니터링 대시보드.
[시간 복잡도] addNum O(log n), findMedian O(1) [공간 복잡도] O(n)
"""
import heapq

class MedianFinder:
    def __init__(self):
        self.small = []  # max-heap (부호 반전)
        self.large = []  # min-heap

    def add_num(self, num: int) -> None:
        # 1. 작은 쪽에 추가
        heapq.heappush(self.small, -num)
        # 2. 작은 쪽의 최대가 큰 쪽의 최소보다 크면 이동
        if self.small and self.large and (-self.small[0]) > self.large[0]:
            val = -heapq.heappop(self.small)
            heapq.heappush(self.large, val)
        # 3. 크기 균형: small이 최대 1개 더 많게
        if len(self.small) > len(self.large) + 1:
            val = -heapq.heappop(self.small)
            heapq.heappush(self.large, val)
        elif len(self.large) > len(self.small):
            val = heapq.heappop(self.large)
            heapq.heappush(self.small, -val)

    def find_median(self) -> float:
        if len(self.small) > len(self.large):
            return -self.small[0]
        return (-self.small[0] + self.large[0]) / 2.0

if __name__ == "__main__":
    mf = MedianFinder()
    mf.add_num(1)
    assert mf.find_median() == 1.0
    mf.add_num(2)
    assert mf.find_median() == 1.5
    mf.add_num(3)
    assert mf.find_median() == 2.0
    mf.add_num(4)
    assert mf.find_median() == 2.5
    mf.add_num(5)
    assert mf.find_median() == 3.0
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 063: 데이터 스트림의 중앙값 (Find Median from Data Stream)
 *
 * [문제] 데이터가 스트림으로 들어올 때, 실시간으로 중앙값을 반환하라.
 *
 * [아키텍트의 시선]
 * 두 개의 힙(최대힙 + 최소힙)으로 실시간 중앙값을 추적하는 것은
 * 시계열 모니터링의 P50 지표 계산, 네트워크 지연시간 중앙값 추적,
 * 실시간 가격 엔진의 중간 가격 계산에 직접 활용된다.
 *
 * [시간 복잡도] addNum O(log n), findMedian O(1) [공간 복잡도] O(n)
 */
import java.util.*;

public class P063StreamMedian {
    private PriorityQueue<Integer> maxHeap; // 작은 절반 (최대힙)
    private PriorityQueue<Integer> minHeap; // 큰 절반 (최소힙)

    public P063StreamMedian() {
        maxHeap = new PriorityQueue<>(Collections.reverseOrder());
        minHeap = new PriorityQueue<>();
    }

    public void addNum(int num) {
        maxHeap.offer(num);
        minHeap.offer(maxHeap.poll()); // 밸런싱
        if (minHeap.size() > maxHeap.size()) {
            maxHeap.offer(minHeap.poll());
        }
    }

    public double findMedian() {
        if (maxHeap.size() > minHeap.size()) {
            return maxHeap.peek();
        }
        return (maxHeap.peek() + minHeap.peek()) / 2.0;
    }

    public static void main(String[] args) {
        P063StreamMedian mf = new P063StreamMedian();
        mf.addNum(1);
        assert mf.findMedian() == 1.0;
        mf.addNum(2);
        assert mf.findMedian() == 1.5;
        mf.addNum(3);
        assert mf.findMedian() == 2.0;
        mf.addNum(4);
        assert mf.findMedian() == 2.5;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
