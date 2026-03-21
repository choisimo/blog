---
title: "[알고리즘] 두 리스트 병합 (Merge Lists)"
date: "2025-04-30"
category: "Algorithm"
tags: ["Algorithm", "병합", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 두 리스트 병합 (Merge Lists) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

정렬된 두 연결 리스트 병합은 "작은 값을 고른다"가 아니라, 두 개의 순차 스트림을 끊김 없이 하나의 정렬 스트림으로 재배선(rewire)하는 문제입니다. `dummy` 노드가 왜 편의 장치가 아니라 경계 조건 제거 장치인지 설명해 보세요.

1. `l1`, `l2`, `tail`이 가리키는 위치를 시간축으로 추적하고, 병합된 prefix가 항상 정렬 상태를 유지하는 이유를 불변식으로 설명하세요.
2. 새 노드를 계속 할당하는 방식과 기존 포인터만 재연결하는 방식을 메모리 단편화, allocator pressure, GC 부담 관점에서 비교하세요.
3. 이 병합 추상화가 merge sort, 외부 정렬, 다중 스트림 병합으로 확장될 때 어떤 조건이 추가로 필요해지는지 설명하세요.

## 답변할 때 포함할 것

- `tail.next`가 바뀌는 순서를 단계별로 적을 것
- 정렬 불변식이 깨지지 않는 이유를 설명할 것
- 포인터 재사용과 새 할당의 비용 차이를 적을 것

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
