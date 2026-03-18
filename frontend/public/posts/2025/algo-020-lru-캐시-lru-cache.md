---
title: "[알고리즘] LRU 캐시 (LRU Cache)"
date: "2025-05-16"
category: "Algorithm"
tags: ["Algorithm", "해시맵+DLL", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - LRU 캐시 (LRU Cache) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

LRU 캐시는 "최근 사용 순서"와 "키 직접 조회"를 동시에 만족해야 하는 시스템 설계 문제입니다. 단일 자료구조로는 왜 둘을 함께 얻기 어렵고, 해시맵과 이중 연결 리스트를 묶어야 하는지 설명해 보세요.

1. `put`, `get`, eviction이 일어날 때 hash table, head/tail 근처 노드, recency 순서가 어떻게 바뀌는지 순서대로 적으세요.
2. 배열 기반 순서 관리, 단일 연결 리스트, balanced tree와 비교해 O(1) 보장을 깨뜨리는 병목이 어디서 생기는지 설명하세요.
3. 실제 시스템에서 TTL, 동시성, write-back, clock algorithm이 들어오면 왜 "순수 LRU"만으로는 부족한지 설명하세요.

## 답변할 때 포함할 것

- 키 조회 경로와 순서 갱신 경로를 분리해서 적을 것
- eviction 대상이 왜 tail 직전인지 설명할 것
- 시간 최적화와 포인터 관리 비용을 함께 다룰 것

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
