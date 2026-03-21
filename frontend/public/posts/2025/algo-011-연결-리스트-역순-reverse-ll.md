---
title: "[알고리즘] 연결 리스트 역순 (Reverse LL)"
date: "2025-04-25"
category: "Algorithm"
tags: ["Algorithm", "포인터 반전", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 연결 리스트 역순 (Reverse LL) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

연결 리스트 역순은 값을 바꾸는 작업이 아니라, 포인터 그래프의 방향을 한 간선씩 뒤집어도 나머지 그래프를 잃지 않는지 검증하는 문제입니다. `1 -> 2 -> 3 -> 4 -> 5`에서 `prev`, `curr`, `next` 세 포인터가 없으면 어떤 정보가 사라지는지 설명해 보세요.

1. 각 반복 시점에 역전이 끝난 prefix와 아직 보존된 suffix를 구분해 적고, 왜 `next`를 먼저 잡지 않으면 구조가 끊기는지 설명하세요.
2. 반복 방식과 재귀 방식을 호출 스택 사용량, 포인터 가시성, 긴 리스트에서의 안정성 관점에서 비교하세요.
3. 배열처럼 연속 메모리가 아닌 연결 리스트에서 캐시 miss와 pointer chasing이 어떤 비용을 만들고, 그럼에도 이 구조를 쓰는 이유가 무엇인지 설명하세요.

## 답변할 때 포함할 것

- `prev/curr/next` 상태를 최소 3단계 이상 적을 것
- 이미 뒤집힌 구간의 의미를 불변식으로 정의할 것
- 재귀가 깨지는 물리적 한계를 함께 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 011: 연결 리스트 역순 (Reverse Linked List)
==========================================================

[문제 설명]
단일 연결 리스트의 노드 순서를 뒤집어라.
반복(Iterative)과 재귀(Recursive) 두 가지 방식으로 구현.

[아키텍트의 시선 - Iterative vs Recursive 설계 선택]
반복: 명시적 상태 관리, 스택 오버플로우 없음, 디버깅 용이.
재귀: 선언적 표현, 코드 간결, 하지만 스택 깊이 제한.
실무 선택 기준: 데이터 크기가 예측 불가 → 반복, 트리 구조 → 재귀.

[시간 복잡도] O(n) [공간 복잡도] 반복 O(1), 재귀 O(n)
"""


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


def reverse_iterative(head: ListNode) -> ListNode:
    prev, curr = None, head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev


def reverse_recursive(head: ListNode) -> ListNode:
    if not head or not head.next:
        return head
    new_head = reverse_recursive(head.next)
    head.next.next = head
    head.next = None
    return new_head


def to_list(head):
    result = []
    while head:
        result.append(head.val)
        head = head.next
    return result


def from_list(arr):
    dummy = ListNode(0)
    curr = dummy
    for v in arr:
        curr.next = ListNode(v)
        curr = curr.next
    return dummy.next


if __name__ == "__main__":
    h1 = from_list([1, 2, 3, 4, 5])
    assert to_list(reverse_iterative(h1)) == [5, 4, 3, 2, 1]

    h2 = from_list([1, 2])
    assert to_list(reverse_recursive(h2)) == [2, 1]

    h3 = from_list([])
    assert to_list(reverse_iterative(h3)) == []

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 011: 연결 리스트 뒤집기 (Reverse Linked List)
 *
 * [문제] 단일 연결 리스트를 뒤집어라.
 *
 * [아키텍트의 시선]
 * 연결 리스트 뒤집기는 이벤트 소싱에서 시간 역순 조회,
 * Undo 스택 구현, 역방향 데이터 스트림 처리의 기초다.
 * 포인터 조작은 마이크로서비스 간 의존성 방향 전환과 유사하다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */
public class P011ReverseLinkedList {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int val) { this.val = val; }
        ListNode(int val, ListNode next) { this.val = val; this.next = next; }
    }

    // 반복적 방법: 세 포인터(prev, curr, next) 활용
    public static ListNode reverse(ListNode head) {
        ListNode prev = null;
        ListNode curr = head;
        while (curr != null) {
            ListNode next = curr.next; // 다음 노드 저장
            curr.next = prev;          // 방향 전환
            prev = curr;               // prev 전진
            curr = next;               // curr 전진
        }
        return prev;
    }

    // 재귀적 방법
    public static ListNode reverseRecursive(ListNode head) {
        if (head == null || head.next == null) return head;
        ListNode newHead = reverseRecursive(head.next);
        head.next.next = head;
        head.next = null;
        return newHead;
    }

    static int[] toArray(ListNode head) {
        java.util.List<Integer> list = new java.util.ArrayList<>();
        while (head != null) { list.add(head.val); head = head.next; }
        return list.stream().mapToInt(i -> i).toArray();
    }

    static ListNode fromArray(int[] arr) {
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (int v : arr) { curr.next = new ListNode(v); curr = curr.next; }
        return dummy.next;
    }

    public static void main(String[] args) {
        assert java.util.Arrays.equals(toArray(reverse(fromArray(new int[]{1,2,3,4,5}))), new int[]{5,4,3,2,1});
        assert java.util.Arrays.equals(toArray(reverse(fromArray(new int[]{1}))), new int[]{1});
        assert reverse(null) == null;
        assert java.util.Arrays.equals(toArray(reverseRecursive(fromArray(new int[]{1,2,3}))), new int[]{3,2,1});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
