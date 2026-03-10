---
title: "[알고리즘] LRU 캐시 (LRU Cache)"
date: "2025-05-16"
category: "Algorithm"
tags: ["Algorithm", "해시맵+DLL", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - LRU 캐시 (LRU Cache) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**LRU 캐시 (LRU Cache)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 해시맵+DLL

> **Architect's View**
> 캐시 교체 정책과 복합 자료구조

이 글에서는 LRU 캐시 (LRU Cache) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 020: LRU 캐시 (Least Recently Used Cache)
==========================================================

[문제 설명]
get(key)과 put(key, value)를 O(1)에 수행하는 LRU 캐시를 설계.
용량 초과 시 가장 오래 전에 사용된 항목을 제거.

[아키텍트의 시선 - 캐시 교체 정책과 복합 자료구조 설계]
해시맵(O(1) 조회) + 이중 연결 리스트(O(1) 삽입/삭제)의 결합.
실무: 웹 브라우저 캐시, CDN, DB 버퍼 풀, CPU 캐시 교체 정책.
핵심: 단일 자료구조로 불가능한 것을 복합 구조로 해결.

[시간 복잡도] get/put O(1) [공간 복잡도] O(capacity)
"""


class DLinkedNode:
    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = None
        self.next = None


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}
        self.head = DLinkedNode()
        self.tail = DLinkedNode()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node: DLinkedNode) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev

    def _add_to_front(self, node: DLinkedNode) -> None:
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        node = self.cache[key]
        self._remove(node)
        self._add_to_front(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self._remove(self.cache[key])
            del self.cache[key]

        node = DLinkedNode(key, value)
        self._add_to_front(node)
        self.cache[key] = node

        if len(self.cache) > self.capacity:
            lru = self.tail.prev
            self._remove(lru)
            del self.cache[lru.key]


if __name__ == "__main__":
    cache = LRUCache(2)
    cache.put(1, 1)
    cache.put(2, 2)
    assert cache.get(1) == 1
    cache.put(3, 3)  # 2 제거됨
    assert cache.get(2) == -1
    cache.put(4, 4)  # 1 제거됨
    assert cache.get(1) == -1
    assert cache.get(3) == 3
    assert cache.get(4) == 4

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 020: LRU 캐시 (LRU Cache)
 *
 * [문제] Least Recently Used 캐시를 구현하라.
 * get(key)과 put(key, value) 모두 O(1)에 동작해야 한다.
 *
 * [아키텍트의 시선]
 * LRU 캐시는 CDN, 데이터베이스 버퍼 풀, CPU 캐시의 핵심 교체 전략이다.
 * HashMap + Doubly Linked List 조합은 O(1) 조회와 O(1) 순서 갱신을 동시에
 * 달성하는 복합 자료구조 설계의 교과서적 사례다.
 *
 * [시간 복잡도] O(1) get/put [공간 복잡도] O(capacity)
 */
import java.util.HashMap;
import java.util.Map;

public class P020LRUCache {
    // 이중 연결 리스트 노드
    static class DNode {
        int key, value;
        DNode prev, next;
        DNode(int key, int value) { this.key = key; this.value = value; }
    }

    private int capacity;
    private Map<Integer, DNode> cache;
    private DNode head, tail; // sentinel 노드

    public P020LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new HashMap<>();
        // 센티넬 노드로 경계 조건 제거
        head = new DNode(0, 0);
        tail = new DNode(0, 0);
        head.next = tail;
        tail.prev = head;
    }

    public int get(int key) {
        if (!cache.containsKey(key)) return -1;
        DNode node = cache.get(key);
        moveToHead(node); // 최근 사용으로 갱신
        return node.value;
    }

    public void put(int key, int value) {
        if (cache.containsKey(key)) {
            DNode node = cache.get(key);
            node.value = value;
            moveToHead(node);
        } else {
            DNode newNode = new DNode(key, value);
            cache.put(key, newNode);
            addToHead(newNode);
            if (cache.size() > capacity) {
                // 가장 오래된 노드(tail 직전) 제거
                DNode lru = tail.prev;
                removeNode(lru);
                cache.remove(lru.key);
            }
        }
    }

    private void addToHead(DNode node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(DNode node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void moveToHead(DNode node) {
        removeNode(node);
        addToHead(node);
    }

    public static void main(String[] args) {
        P020LRUCache lru = new P020LRUCache(2);
        lru.put(1, 1);
        lru.put(2, 2);
        assert lru.get(1) == 1;      // 1이 최근 사용됨
        lru.put(3, 3);                // 용량 초과 → 2 제거 (LRU)
        assert lru.get(2) == -1;      // 2는 제거됨
        lru.put(4, 4);                // 용량 초과 → 1 제거 (LRU)
        assert lru.get(1) == -1;
        assert lru.get(3) == 3;
        assert lru.get(4) == 4;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
