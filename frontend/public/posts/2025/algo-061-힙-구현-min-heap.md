---
title: "[알고리즘] 힙 구현 (Min Heap)"
date: "2025-08-23"
category: "Algorithm"
tags: ["Algorithm", "배열 기반 힙", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - 힙 구현 (Min Heap) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

Min Heap 구현은 트리를 만드는 문제가 아니라, 완전 이진 트리의 부분 순서(partial order)를 연속 배열 위에 인코딩하는 문제입니다. 왜 parent/child 관계를 포인터 없이 인덱스 산술로 표현할 수 있는지 설명해 보세요.

1. 삽입 시 sift-up, 삭제 시 sift-down이 배열 인덱스와 값 순서를 어떻게 바꾸는지 추적하세요.
2. 정렬 배열, balanced BST, heap을 최소값 질의/삽입/삭제 혼합 workload 관점에서 비교하세요.
3. 힙이 완전 정렬 구조가 아닌데도 우선순위 스케줄러에 충분한 이유를 설명하세요.

## 답변할 때 포함할 것

- parent/child 인덱스 공식을 적을 것
- heap property의 의미를 설명할 것
- 완전 정렬과 부분 정렬을 구분할 것

## 🐍 Python 구현

```python
"""
문제 061: 최소 힙 구현 (Min Heap Implementation)
[문제] 배열 기반 최소 힙을 직접 구현하라. insert, extract_min, peek 연산.
[아키텍트의 시선] 완전 이진 트리의 배열 표현.
힙은 배열로 트리를 표현하는 전형적 패턴. parent=i//2, children=2i, 2i+1.
포인터 없이 트리 구조를 유지 → 캐시 친화적, 메모리 효율적.
실무: OS 스케줄러, 이벤트 루프의 타이머 큐, 우선순위 기반 태스크 관리.
[시간 복잡도] insert/extract O(log n), peek O(1) [공간 복잡도] O(n)
"""
from typing import List, Optional

class MinHeap:
    def __init__(self):
        self.heap: List[int] = []

    def _parent(self, i: int) -> int:
        return (i - 1) // 2

    def _left(self, i: int) -> int:
        return 2 * i + 1

    def _right(self, i: int) -> int:
        return 2 * i + 2

    def _swap(self, i: int, j: int) -> None:
        self.heap[i], self.heap[j] = self.heap[j], self.heap[i]

    def _sift_up(self, i: int) -> None:
        """삽입 후 위로 이동"""
        while i > 0 and self.heap[i] < self.heap[self._parent(i)]:
            self._swap(i, self._parent(i))
            i = self._parent(i)

    def _sift_down(self, i: int) -> None:
        """추출 후 아래로 이동"""
        size = len(self.heap)
        smallest = i
        left, right = self._left(i), self._right(i)
        if left < size and self.heap[left] < self.heap[smallest]:
            smallest = left
        if right < size and self.heap[right] < self.heap[smallest]:
            smallest = right
        if smallest != i:
            self._swap(i, smallest)
            self._sift_down(smallest)

    def insert(self, val: int) -> None:
        self.heap.append(val)
        self._sift_up(len(self.heap) - 1)

    def extract_min(self) -> int:
        if not self.heap:
            raise IndexError("Heap is empty")
        min_val = self.heap[0]
        last = self.heap.pop()
        if self.heap:
            self.heap[0] = last
            self._sift_down(0)
        return min_val

    def peek(self) -> int:
        if not self.heap:
            raise IndexError("Heap is empty")
        return self.heap[0]

    def size(self) -> int:
        return len(self.heap)

if __name__ == "__main__":
    h = MinHeap()
    for v in [5, 3, 8, 1, 2, 7]:
        h.insert(v)
    assert h.peek() == 1
    assert h.extract_min() == 1
    assert h.extract_min() == 2
    assert h.extract_min() == 3
    assert h.size() == 3
    # 정렬 검증
    sorted_rest = []
    while h.size() > 0:
        sorted_rest.append(h.extract_min())
    assert sorted_rest == [5, 7, 8]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 061: 최소 힙 구현 (Min Heap Implementation)
 *
 * [문제] 배열 기반 최소 힙을 직접 구현하라.
 * insert, extractMin, peek 연산을 지원해야 한다.
 *
 * [아키텍트의 시선]
 * 힙은 우선순위 큐의 근본 자료구조다. 운영체제의 프로세스 스케줄러,
 * 이벤트 드리븐 시스템의 타이머 관리, 네트워크 패킷의 QoS 우선순위 처리에
 * 직접 활용된다. O(log n) 삽입/삭제가 핵심이다.
 *
 * [시간 복잡도] insert/extract O(log n), peek O(1) [공간 복잡도] O(n)
 */
import java.util.ArrayList;
import java.util.List;

public class P061MinHeap {
    private List<Integer> heap;

    public P061MinHeap() {
        heap = new ArrayList<>();
    }

    public void insert(int val) {
        heap.add(val);
        siftUp(heap.size() - 1);
    }

    public int extractMin() {
        int min = heap.get(0);
        int last = heap.remove(heap.size() - 1);
        if (!heap.isEmpty()) {
            heap.set(0, last);
            siftDown(0);
        }
        return min;
    }

    public int peek() {
        return heap.get(0);
    }

    public int size() {
        return heap.size();
    }

    private void siftUp(int i) {
        while (i > 0) {
            int parent = (i - 1) / 2;
            if (heap.get(i) >= heap.get(parent)) break;
            swap(i, parent);
            i = parent;
        }
    }

    private void siftDown(int i) {
        int n = heap.size();
        while (true) {
            int smallest = i;
            int left = 2 * i + 1, right = 2 * i + 2;
            if (left < n && heap.get(left) < heap.get(smallest)) smallest = left;
            if (right < n && heap.get(right) < heap.get(smallest)) smallest = right;
            if (smallest == i) break;
            swap(i, smallest);
            i = smallest;
        }
    }

    private void swap(int i, int j) {
        int tmp = heap.get(i);
        heap.set(i, heap.get(j));
        heap.set(j, tmp);
    }

    public static void main(String[] args) {
        P061MinHeap h = new P061MinHeap();
        h.insert(5); h.insert(3); h.insert(8); h.insert(1); h.insert(4);
        assert h.peek() == 1;
        assert h.extractMin() == 1;
        assert h.extractMin() == 3;
        assert h.extractMin() == 4;
        assert h.size() == 2;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
