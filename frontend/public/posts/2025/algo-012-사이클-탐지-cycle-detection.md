---
title: "[알고리즘] 사이클 탐지 (Cycle Detection)"
date: "2025-04-27"
category: "Algorithm"
tags: ["Algorithm", "Floyd's 알고리즘", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 사이클 탐지 (Cycle Detection) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**사이클 탐지 (Cycle Detection)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: Floyd's 알고리즘

> **Architect's View**
> 이중 속도 포인터와 불변식 탐지

이 글에서는 사이클 탐지 (Cycle Detection) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 012: 연결 리스트 사이클 탐지 (Floyd's Cycle Detection)
==========================================================

[문제 설명]
연결 리스트에 사이클이 존재하는지 판별하라.

[아키텍트의 시선 - 이중 속도 포인터와 불변식 기반 탐지]
Floyd의 토끼와 거북이: slow(1칸), fast(2칸) 이동.
사이클 존재 시 반드시 만남 (수학적 증명 가능).
실무: 데드락 탐지, 순환 참조 감지, 가비지 컬렉션 마크 단계.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def has_cycle(head: ListNode) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False


def detect_cycle_start(head: ListNode) -> ListNode:
    """사이클 시작 노드를 반환. 없으면 None."""
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            slow = head
            while slow is not fast:
                slow = slow.next
                fast = fast.next
            return slow
    return None


if __name__ == "__main__":
    n1 = ListNode(3)
    n2 = ListNode(2)
    n3 = ListNode(0)
    n4 = ListNode(-4)
    n1.next = n2; n2.next = n3; n3.next = n4; n4.next = n2
    assert has_cycle(n1) is True
    assert detect_cycle_start(n1) is n2

    a1 = ListNode(1)
    a2 = ListNode(2)
    a1.next = a2
    assert has_cycle(a1) is False

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 012: 연결 리스트 순환 탐지 (Linked List Cycle)
 *
 * [문제] 연결 리스트에 순환(cycle)이 있는지 판별하라.
 * 보너스: 순환 시작점을 찾아라.
 *
 * [아키텍트의 시선]
 * Floyd의 토끼와 거북이 알고리즘은 분산 시스템의 데드락 탐지,
 * 의존성 그래프의 순환 참조 감지와 동일한 원리다.
 * O(1) 공간으로 순환을 탐지하는 것은 리소스 제약 환경의 핵심 기법이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P012LinkedListCycle {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int val) { this.val = val; }
    }

    // Floyd's Cycle Detection: 빠른/느린 포인터
    public static boolean hasCycle(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) return true;
        }
        return false;
    }

    // 순환 시작점 찾기
    public static ListNode detectCycleStart(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {
                // 시작점 탐색: head에서, 만난점에서 동시에 한 칸씩
                ListNode p = head;
                while (p != slow) {
                    p = p.next;
                    slow = slow.next;
                }
                return p;
            }
        }
        return null;
    }

    public static void main(String[] args) {
        // 순환 있는 리스트: 1->2->3->4->2(순환)
        ListNode n1 = new ListNode(1);
        ListNode n2 = new ListNode(2);
        ListNode n3 = new ListNode(3);
        ListNode n4 = new ListNode(4);
        n1.next = n2; n2.next = n3; n3.next = n4; n4.next = n2;
        assert hasCycle(n1);
        assert detectCycleStart(n1) == n2;

        // 순환 없는 리스트
        ListNode a1 = new ListNode(1);
        ListNode a2 = new ListNode(2);
        a1.next = a2;
        assert !hasCycle(a1);
        assert detectCycleStart(a1) == null;

        // 빈 리스트
        assert !hasCycle(null);

        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
