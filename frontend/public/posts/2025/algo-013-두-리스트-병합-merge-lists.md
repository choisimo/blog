---
title: "[알고리즘] 두 리스트 병합 (Merge Lists)"
date: "2025-04-30"
category: "Algorithm"
tags: ["Algorithm", "병합", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 두 리스트 병합 (Merge Lists) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**두 리스트 병합 (Merge Lists)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 병합

> **Architect's View**
> 분할 정복과 합병 추상화

이 글에서는 두 리스트 병합 (Merge Lists) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 013: 두 연결 리스트 병합 (Merge Two Sorted Lists)
==========================================================

[문제 설명]
정렬된 두 연결 리스트를 하나의 정렬된 리스트로 병합하라.

[아키텍트의 시선 - 분할 정복과 합병(Merge) 추상화]
병합 정렬의 핵심 서브루틴. 두 정렬된 스트림을 하나로 합치는 패턴.
실무: k-way 병합의 기초, 이벤트 소싱에서 시간순 이벤트 병합.

[시간 복잡도] O(m+n) [공간 복잡도] O(1) (노드 재활용)
"""


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def merge_two_lists(l1: ListNode, l2: ListNode) -> ListNode:
    dummy = ListNode(0)
    curr = dummy

    while l1 and l2:
        if l1.val <= l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next

    curr.next = l1 or l2
    return dummy.next


def to_list(head):
    r = []
    while head:
        r.append(head.val)
        head = head.next
    return r


def from_list(arr):
    dummy = ListNode(0)
    c = dummy
    for v in arr:
        c.next = ListNode(v)
        c = c.next
    return dummy.next


if __name__ == "__main__":
    r1 = merge_two_lists(from_list([1, 2, 4]), from_list([1, 3, 4]))
    assert to_list(r1) == [1, 1, 2, 3, 4, 4]

    r2 = merge_two_lists(from_list([]), from_list([0]))
    assert to_list(r2) == [0]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 013: 정렬된 연결 리스트 병합 (Merge Two Sorted Lists)
 *
 * [문제] 두 개의 정렬된 연결 리스트를 하나의 정렬된 리스트로 병합하라.
 *
 * [아키텍트의 시선]
 * 정렬된 스트림 병합은 K-way merge, 외부 정렬, CQRS 이벤트 병합의 기초다.
 * 여러 데이터 소스를 시간순 통합하는 패턴은 로그 집계 시스템의 핵심이다.
 *
 * [시간 복잡도] O(n+m) [공간 복잡도] O(1)
 */
public class P013MergeTwoLists {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int val) { this.val = val; }
    }

    public static ListNode merge(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        while (l1 != null && l2 != null) {
            if (l1.val <= l2.val) {
                curr.next = l1;
                l1 = l1.next;
            } else {
                curr.next = l2;
                l2 = l2.next;
            }
            curr = curr.next;
        }
        curr.next = (l1 != null) ? l1 : l2;
        return dummy.next;
    }

    static ListNode fromArray(int[] arr) {
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (int v : arr) { curr.next = new ListNode(v); curr = curr.next; }
        return dummy.next;
    }

    static int[] toArray(ListNode head) {
        java.util.List<Integer> list = new java.util.ArrayList<>();
        while (head != null) { list.add(head.val); head = head.next; }
        return list.stream().mapToInt(i -> i).toArray();
    }

    public static void main(String[] args) {
        assert java.util.Arrays.equals(
            toArray(merge(fromArray(new int[]{1,3,5}), fromArray(new int[]{2,4,6}))),
            new int[]{1,2,3,4,5,6});
        assert java.util.Arrays.equals(
            toArray(merge(fromArray(new int[]{}), fromArray(new int[]{1,2}))),
            new int[]{1,2});
        assert merge(null, null) == null;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
