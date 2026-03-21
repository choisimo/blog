---
title: "[알고리즘] 세그먼트 트리"
date: "2025-11-12"
category: "Algorithm"
tags: ["Algorithm", "구간 쿼리", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 세그먼트 트리 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

세그먼트 트리는 배열 문제를 구간 집계 인덱스로 끌어올린 구조입니다. 왜 prefix sum만으로는 업데이트와 질의를 동시에 싸게 처리할 수 없고, 구간을 계층적으로 쪼갠 트리가 필요한지 설명해 보세요.

1. 노드가 담당하는 구간 `[l, r]`와 집계값이 어떤 contract를 가지는지 설명하고, query/update가 어떤 노드들만 방문하는지 추적하세요.
2. 세그먼트 트리, 펜윅 트리, prefix sum을 업데이트 빈도와 질의 종류 관점에서 비교하세요.
3. lazy propagation이 왜 필요한지, 없는 경우 어떤 update pattern에서 병목이 생기는지 설명하세요.

## 답변할 때 포함할 것

- 노드-구간 대응을 적을 것
- 부분 겹침/완전 겹침/무관 구간을 구분할 것
- lazy propagation 필요 조건을 설명할 것

## 🐍 Python 구현

```python
"""
문제 093: 세그먼트 트리 (Segment Tree)
[문제] 구간 합 쿼리와 단일 원소 갱신을 지원하는 세그먼트 트리를 구현하라.
[아키텍트의 시선] 구간 쿼리와 지연 전파.
배열을 완전 이진 트리로 표현. 각 노드가 구간의 합(또는 min/max) 저장.
업데이트/쿼리 모두 O(log n). 지연 전파로 범위 업데이트도 O(log n).
실무: 주가 범위 쿼리, 네트워크 대역폭 모니터링, 게임 랭킹 시스템.
[시간 복잡도] O(log n) per query/update [공간 복잡도] O(n)
"""
from typing import List

class SegmentTree:
    def __init__(self, nums: List[int]):
        self.n = len(nums)
        self.tree = [0] * (4 * self.n)
        if self.n > 0:
            self._build(nums, 1, 0, self.n - 1)

    def _build(self, nums, node, start, end):
        if start == end:
            self.tree[node] = nums[start]
            return
        mid = (start + end) // 2
        self._build(nums, 2*node, start, mid)
        self._build(nums, 2*node+1, mid+1, end)
        self.tree[node] = self.tree[2*node] + self.tree[2*node+1]

    def update(self, idx: int, val: int) -> None:
        self._update(1, 0, self.n - 1, idx, val)

    def _update(self, node, start, end, idx, val):
        if start == end:
            self.tree[node] = val
            return
        mid = (start + end) // 2
        if idx <= mid:
            self._update(2*node, start, mid, idx, val)
        else:
            self._update(2*node+1, mid+1, end, idx, val)
        self.tree[node] = self.tree[2*node] + self.tree[2*node+1]

    def query(self, left: int, right: int) -> int:
        return self._query(1, 0, self.n - 1, left, right)

    def _query(self, node, start, end, left, right):
        if right < start or end < left:
            return 0
        if left <= start and end <= right:
            return self.tree[node]
        mid = (start + end) // 2
        return (self._query(2*node, start, mid, left, right) +
                self._query(2*node+1, mid+1, end, left, right))

if __name__ == "__main__":
    st = SegmentTree([1, 3, 5, 7, 9, 11])
    assert st.query(0, 2) == 9   # 1+3+5
    assert st.query(1, 4) == 24  # 3+5+7+9
    assert st.query(0, 5) == 36  # 전체
    st.update(2, 10)  # 5 → 10
    assert st.query(0, 2) == 14  # 1+3+10
    assert st.query(0, 5) == 41  # 1+3+10+7+9+11
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 093: 세그먼트 트리 (Segment Tree)
 *
 * [문제] 구간 합 쿼리와 단일 원소 갱신을 지원하는 세그먼트 트리를 구현하라.
 *
 * [아키텍트의 시선]
 * 구간 쿼리와 지연 전파.
 * 배열을 완전 이진 트리로 표현. 각 노드가 구간의 합(또는 min/max) 저장.
 * 업데이트/쿼리 모두 O(log n). 지연 전파로 범위 업데이트도 O(log n).
 * 실무: 주가 범위 쿼리, 네트워크 대역폭 모니터링, 게임 랭킹 시스템.
 *
 * [시간 복잡도] O(log n) per query/update [공간 복잡도] O(n)
 */

public class P093SegmentTree {
    private int[] tree;
    private int n;

    public P093SegmentTree(int[] nums) {
        n = nums.length;
        tree = new int[4 * n];
        if (n > 0) build(nums, 1, 0, n - 1);
    }

    private void build(int[] nums, int node, int start, int end) {
        if (start == end) { tree[node] = nums[start]; return; }
        int mid = (start + end) / 2;
        build(nums, 2 * node, start, mid);
        build(nums, 2 * node + 1, mid + 1, end);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }

    public void update(int idx, int val) {
        update(1, 0, n - 1, idx, val);
    }
    private void update(int node, int start, int end, int idx, int val) {
        if (start == end) { tree[node] = val; return; }
        int mid = (start + end) / 2;
        if (idx <= mid) update(2 * node, start, mid, idx, val);
        else update(2 * node + 1, mid + 1, end, idx, val);
        tree[node] = tree[2 * node] + tree[2 * node + 1];
    }

    public int query(int left, int right) {
        return query(1, 0, n - 1, left, right);
    }
    private int query(int node, int start, int end, int left, int right) {
        if (right < start || end < left) return 0;
        if (left <= start && end <= right) return tree[node];
        int mid = (start + end) / 2;
        return query(2 * node, start, mid, left, right)
             + query(2 * node + 1, mid + 1, end, left, right);
    }

    public static void main(String[] args) {
        P093SegmentTree st = new P093SegmentTree(new int[]{1, 3, 5, 7, 9, 11});
        assert st.query(0, 2) == 9;   // 1+3+5
        assert st.query(1, 4) == 24;  // 3+5+7+9
        assert st.query(0, 5) == 36;  // 전체
        st.update(2, 10);             // 5 -> 10
        assert st.query(0, 2) == 14;  // 1+3+10
        assert st.query(0, 5) == 41;  // 1+3+10+7+9+11
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
