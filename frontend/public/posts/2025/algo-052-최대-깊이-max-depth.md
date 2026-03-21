---
title: "[알고리즘] 최대 깊이 (Max Depth)"
date: "2025-07-31"
category: "Algorithm"
tags: ["Algorithm", "재귀", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 최대 깊이 (Max Depth) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

최대 깊이는 단순 카운팅이 아니라, 각 서브트리에서 얻은 답을 부모가 어떻게 결합하는지 정의하는 재귀 contract 문제입니다. 노드 하나가 자기 서브트리에 대해 어떤 정보를 반환해야 부모가 전역 깊이를 만들 수 있는지 설명해 보세요.

1. `depth(node) = 1 + max(depth(left), depth(right))`가 어떤 정보 흐름을 의미하는지 추적하세요.
2. DFS 재귀와 BFS 레벨 카운팅 방식을 skewed tree, balanced tree, 매우 넓은 tree에서 비교하세요.
3. 깊이 대신 지름, 최소 깊이, 균형 여부를 구하는 문제로 바뀌면 반환 contract가 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- base case와 return 의미를 적을 것
- DFS/BFS 중 어느 쪽이 언제 더 위험한지 적을 것
- 반환 계약(contract) 개념을 설명할 것

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
