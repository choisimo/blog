---
title: "[알고리즘] 중간 노드 (Middle Node)"
date: "2025-05-02"
category: "Algorithm"
tags: ["Algorithm", "빠른/느린 포인터", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 중간 노드 (Middle Node) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**중간 노드 (Middle Node)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 빠른/느린 포인터

> **Architect's View**
> 포인터 패턴의 일반화

이 글에서는 중간 노드 (Middle Node) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 014: 중간 노드 찾기 (Middle of Linked List)
==========================================================

[문제 설명]
연결 리스트의 중간 노드를 반환하라. 두 개일 경우 두 번째.

[아키텍트의 시선 - 빠른/느린 포인터의 일반화]
slow(1칸) + fast(2칸): fast가 끝에 도달할 때 slow는 중간.
이 패턴은 1/3 지점, 1/4 지점 등으로 일반화 가능.
실무: 부하 분산에서 중간점 기반 파티셔닝.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def middle_node(head: ListNode) -> ListNode:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow


def from_list(arr):
    dummy = ListNode(0)
    c = dummy
    for v in arr:
        c.next = ListNode(v)
        c = c.next
    return dummy.next


if __name__ == "__main__":
    h1 = from_list([1, 2, 3, 4, 5])
    assert middle_node(h1).val == 3

    h2 = from_list([1, 2, 3, 4, 5, 6])
    assert middle_node(h2).val == 4

    h3 = from_list([1])
    assert middle_node(h3).val == 1

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 014: 연결 리스트 중간 노드 (Middle of Linked List)
 *
 * [문제] 연결 리스트의 중간 노드를 반환하라. 노드가 짝수개면 두 번째 중간 노드를 반환.
 *
 * [아키텍트의 시선]
 * 빠른/느린 포인터 패턴은 로드 밸런서의 중간점 분할,
 * 스트리밍 데이터의 중앙값 추적, 분산 시스템의 파티셔닝 기준점 선정과 같다.
 * 단일 순회로 중간을 찾는 것은 메모리 효율적 파이프라인 설계의 핵심이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P014MiddleOfLinkedList {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int val) { this.val = val; }
    }

    // 빠른/느린 포인터: slow는 1칸, fast는 2칸
    public static ListNode middleNode(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }
        return slow;
    }

    static ListNode fromArray(int[] arr) {
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (int v : arr) { curr.next = new ListNode(v); curr = curr.next; }
        return dummy.next;
    }

    public static void main(String[] args) {
        assert middleNode(fromArray(new int[]{1,2,3,4,5})).val == 3;
        assert middleNode(fromArray(new int[]{1,2,3,4,5,6})).val == 4;
        assert middleNode(fromArray(new int[]{1})).val == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
