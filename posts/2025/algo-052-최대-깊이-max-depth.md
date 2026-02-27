---
title: "[알고리즘] 최대 깊이 (Max Depth)"
date: "2025-07-31"
category: "Algorithm"
tags: ["Algorithm", "재귀", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 최대 깊이 (Max Depth) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**최대 깊이 (Max Depth)**
* 파트: Tree & Binary Search Tree
* 관련 알고리즘: 재귀

> **Architect's View**
> 트리 속성의 재귀적 분해

이 글에서는 최대 깊이 (Max Depth) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 052: 최대 깊이 (Maximum Depth of Binary Tree)
[문제] 이진 트리의 최대 깊이(루트~리프 최장 경로의 노드 수)를 구하라.
[아키텍트의 시선] 트리 속성의 재귀적 분해.
max_depth(node) = 1 + max(max_depth(left), max_depth(right)).
단순하지만 핵심: 복잡한 트리 속성을 부분 문제로 분해하는 패턴.
실무: 디렉토리 깊이 제한, DOM 깊이 분석, 조직 계층 측정.
[시간 복잡도] O(n) [공간 복잡도] O(h) h=트리 높이
"""
from typing import Optional
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def max_depth_recursive(root: Optional[TreeNode]) -> int:
    """재귀 DFS 풀이"""
    if not root:
        return 0
    return 1 + max(max_depth_recursive(root.left), max_depth_recursive(root.right))

def max_depth_iterative(root: Optional[TreeNode]) -> int:
    """반복 BFS 풀이"""
    if not root:
        return 0
    depth = 0
    queue = deque([root])
    while queue:
        depth += 1
        for _ in range(len(queue)):
            node = queue.popleft()
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
    return depth

if __name__ == "__main__":
    root = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
    assert max_depth_recursive(root) == 3
    assert max_depth_iterative(root) == 3
    assert max_depth_recursive(None) == 0
    assert max_depth_recursive(TreeNode(1)) == 1
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 052: 이진 트리 최대 깊이 (Maximum Depth of Binary Tree)
 *
 * [문제] 이진 트리의 최대 깊이(루트~리프 경로의 최대 노드 수)를 구하라.
 *
 * [아키텍트의 시선]
 * 트리 깊이는 시스템의 계층 복잡도를 나타낸다.
 * 조직도의 관리 계층 수, 마이크로서비스 호출 체인 깊이,
 * 재귀적 의존성 트리의 최대 깊이 — 깊을수록 취약해진다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(h) h=트리 높이
 */
public class P052MaxDepth {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }

    public static void main(String[] args) {
        TreeNode root = new TreeNode(3,
            new TreeNode(9),
            new TreeNode(20, new TreeNode(15), new TreeNode(7)));
        assert maxDepth(root) == 3;
        assert maxDepth(null) == 0;
        assert maxDepth(new TreeNode(1)) == 1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
