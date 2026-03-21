---
title: "[알고리즘] 중간 노드 (Middle Node)"
date: "2025-05-02"
category: "Algorithm"
tags: ["Algorithm", "빠른/느린 포인터", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 중간 노드 (Middle Node) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

중간 노드 찾기는 길이를 먼저 재지 않고도 상대 속도만으로 위치를 샘플링하는 문제입니다. 연결 리스트의 끝을 모르는 상태에서 `fast`가 2배 속도로 달릴 때 `slow`가 왜 중앙에 놓이게 되는지 설명해 보세요.

1. 홀수 길이와 짝수 길이에서 `fast` 종료 조건이 어떤 차이를 만들고, 왜 구현에 따라 "왼쪽 중간"과 "오른쪽 중간"이 갈리는지 설명하세요.
2. 길이 계산 후 두 번째 순회를 하는 방식과 fast/slow 단일 순회 방식을 캐시 miss, 포인터 재방문, 지연 시간 관점에서 비교하세요.
3. 이 패턴이 사이클 탐지, palindrome 검사, split 단계로 확장될 때 무엇이 공통 불변식으로 남는지 설명하세요.

## 답변할 때 포함할 것

- 홀수/짝수 예시를 하나씩 적을 것
- 종료 조건이 결과 정의에 미치는 영향을 적을 것
- 속도 차이 기반 추론을 수식이나 거리 관계로 설명할 것

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
