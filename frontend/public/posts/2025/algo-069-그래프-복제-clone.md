---
title: "[알고리즘] 그래프 복제 (Clone)"
date: "2025-09-14"
category: "Algorithm"
tags: ["Algorithm", "DFS+해시", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - 그래프 복제 (Clone) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**그래프 복제 (Clone)**
* 파트: Heap & Graph Basics
* 관련 알고리즘: DFS+해시

> **Architect's View**
> 깊은 복사와 순환 참조

이 글에서는 그래프 복제 (Clone) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 069: 그래프 복제 (Clone Graph)
[문제] 무방향 연결 그래프를 깊은 복사(deep copy)하라.
[아키텍트의 시선] 깊은 복사와 순환 참조 처리.
해시맵으로 원본→복사본 매핑. DFS/BFS로 순회하며 이미 복사한 노드는 재사용.
순환 참조가 있어도 무한 루프 방지 → visited 맵이 핵심.
실무: 객체 그래프 직렬화, 프로토타입 패턴, 스냅샷 생성.
[시간 복잡도] O(V+E) [공간 복잡도] O(V)
"""
from typing import Optional, Dict

class Node:
    def __init__(self, val: int = 0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []

def clone_graph(node: Optional[Node]) -> Optional[Node]:
    """DFS + 해시맵 방식"""
    if not node:
        return None
    cloned: Dict[Node, Node] = {}

    def dfs(original: Node) -> Node:
        if original in cloned:
            return cloned[original]
        copy = Node(original.val)
        cloned[original] = copy
        for neighbor in original.neighbors:
            copy.neighbors.append(dfs(neighbor))
        return copy

    return dfs(node)

if __name__ == "__main__":
    # 1 -- 2
    # |    |
    # 4 -- 3
    n1, n2, n3, n4 = Node(1), Node(2), Node(3), Node(4)
    n1.neighbors = [n2, n4]
    n2.neighbors = [n1, n3]
    n3.neighbors = [n2, n4]
    n4.neighbors = [n1, n3]
    clone = clone_graph(n1)
    # 값 동일 확인
    assert clone.val == 1
    assert len(clone.neighbors) == 2
    # 참조 다름 확인 (깊은 복사)
    assert clone is not n1
    assert clone.neighbors[0] is not n2
    # None 처리
    assert clone_graph(None) is None
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 069: 그래프 복제 (Clone Graph)
 *
 * [문제] 무방향 연결 그래프의 깊은 복사본을 만들어라.
 *
 * [아키텍트의 시선]
 * 그래프 깊은 복사는 시스템 스냅샷, VM 복제, 데이터베이스 레플리카 생성의
 * 기본 원리다. 순환 참조 처리가 핵심 — 무한 루프 방지를 위해
 * 복사 레지스트리(방문 맵)가 필수다. Prototype 패턴의 구현이다.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P069CloneGraph {
    static class Node {
        int val;
        List<Node> neighbors;
        Node(int val) {
            this.val = val;
            this.neighbors = new ArrayList<>();
        }
    }

    public static Node cloneGraph(Node node) {
        if (node == null) return null;
        Map<Node, Node> cloned = new HashMap<>();
        return dfsClone(node, cloned);
    }

    private static Node dfsClone(Node node, Map<Node, Node> cloned) {
        if (cloned.containsKey(node)) return cloned.get(node);

        Node copy = new Node(node.val);
        cloned.put(node, copy);
        for (Node neighbor : node.neighbors) {
            copy.neighbors.add(dfsClone(neighbor, cloned));
        }
        return copy;
    }

    public static void main(String[] args) {
        // 1 -- 2
        // |    |
        // 4 -- 3
        Node n1 = new Node(1), n2 = new Node(2), n3 = new Node(3), n4 = new Node(4);
        n1.neighbors.addAll(Arrays.asList(n2, n4));
        n2.neighbors.addAll(Arrays.asList(n1, n3));
        n3.neighbors.addAll(Arrays.asList(n2, n4));
        n4.neighbors.addAll(Arrays.asList(n1, n3));

        Node clone = cloneGraph(n1);
        assert clone != n1;           // 다른 객체
        assert clone.val == 1;
        assert clone.neighbors.size() == 2;
        assert clone.neighbors.get(0).val == 2;
        assert clone.neighbors.get(0) != n2; // 깊은 복사

        assert cloneGraph(null) == null;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
