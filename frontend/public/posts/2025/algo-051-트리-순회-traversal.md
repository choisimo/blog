---
title: "[알고리즘] 트리 순회 (Traversal)"
date: "2025-07-29"
category: "Algorithm"
tags: ["Algorithm", "전위/중위/후위/레벨", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 트리 순회 (Traversal) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

트리 순회는 노드를 방문하는 순서 암기 문제가 아니라, 계층 구조에서 어떤 정보가 "내려갈 때" 필요한지, 어떤 정보가 "돌아올 때" 필요한지에 따라 방문 전략을 선택하는 문제입니다. 전위, 중위, 후위, 레벨 순회가 각각 어떤 시스템적 의미를 갖는지 설명해 보세요.

1. 같은 트리에 대해 네 순회가 만들어 내는 방문 순서와 정보 흐름 차이를 적고, 왜 어떤 것은 직렬화/복제에 유리하고 어떤 것은 평가/집계에 유리한지 설명하세요.
2. 재귀 DFS, 명시적 스택 DFS, 큐 기반 BFS를 호출 스택, 메모리 피크, skewed tree에서의 안정성 관점에서 비교하세요.
3. Visitor pattern 관점에서 "방문 시점"이 API 설계를 어떻게 바꾸는지 설명하세요.

## 답변할 때 포함할 것

- 순회마다 사용되는 보조 상태를 적을 것
- 내려갈 때와 올라올 때의 정보 차이를 적을 것
- BFS와 DFS의 공간 프로필 차이를 설명할 것

## 🐍 Python 구현

```python
"""
문제 051: 트리 순회 (Binary Tree Traversal)
[문제] 이진 트리의 전위/중위/후위/레벨 순회 결과를 각각 반환하라.
[아키텍트의 시선] Visitor Pattern과 순회 전략.
트리 순회는 Visitor 패턴의 본질이다. 전위=루트 먼저(DOM 렌더링),
중위=정렬 순서(BST 출력), 후위=자식 먼저(의존성 해소, GC),
레벨=BFS(계층 탐색, 조직도). 실무에서 AST 파서, 컴파일러, UI 렌더링 트리에 필수.
[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import List, Optional
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def preorder(root: Optional[TreeNode]) -> List[int]:
    """전위 순회: 루트 → 왼쪽 → 오른쪽"""
    result = []
    def dfs(node):
        if not node:
            return
        result.append(node.val)
        dfs(node.left)
        dfs(node.right)
    dfs(root)
    return result

def inorder(root: Optional[TreeNode]) -> List[int]:
    """중위 순회: 왼쪽 → 루트 → 오른쪽"""
    result = []
    def dfs(node):
        if not node:
            return
        dfs(node.left)
        result.append(node.val)
        dfs(node.right)
    dfs(root)
    return result

def postorder(root: Optional[TreeNode]) -> List[int]:
    """후위 순회: 왼쪽 → 오른쪽 → 루트"""
    result = []
    def dfs(node):
        if not node:
            return
        dfs(node.left)
        dfs(node.right)
        result.append(node.val)
    dfs(root)
    return result

def levelorder(root: Optional[TreeNode]) -> List[List[int]]:
    """레벨 순회: BFS 기반"""
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        result.append(level)
    return result

if __name__ == "__main__":
    #       1
    #      / \\
    #     2   3
    #    / \\
    #   4   5
    root = TreeNode(1, TreeNode(2, TreeNode(4), TreeNode(5)), TreeNode(3))
    assert preorder(root) == [1, 2, 4, 5, 3]
    assert inorder(root) == [4, 2, 5, 1, 3]
    assert postorder(root) == [4, 5, 2, 3, 1]
    assert levelorder(root) == [[1], [2, 3], [4, 5]]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 051: 이진 트리 순회 (Binary Tree Traversal)
 *
 * [문제] 이진 트리의 전위/중위/후위/레벨 순회를 모두 구현하라.
 *
 * [아키텍트의 시선]
 * 트리 순회는 파일 시스템 탐색, DOM 트리 처리, AST 분석의 기본이다.
 * 전위=복사, 중위=정렬된 출력, 후위=삭제/의존성 해소, 레벨=BFS.
 * 순회 방식의 선택이 곧 처리 순서 전략이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P051TreeTraversal {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    // 전위 순회 (Root → Left → Right)
    public static List<Integer> preorder(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        preorderHelper(root, result);
        return result;
    }
    private static void preorderHelper(TreeNode node, List<Integer> result) {
        if (node == null) return;
        result.add(node.val);
        preorderHelper(node.left, result);
        preorderHelper(node.right, result);
    }

    // 중위 순회 (Left → Root → Right)
    public static List<Integer> inorder(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        inorderHelper(root, result);
        return result;
    }
    private static void inorderHelper(TreeNode node, List<Integer> result) {
        if (node == null) return;
        inorderHelper(node.left, result);
        result.add(node.val);
        inorderHelper(node.right, result);
    }

    // 후위 순회 (Left → Right → Root)
    public static List<Integer> postorder(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        postorderHelper(root, result);
        return result;
    }
    private static void postorderHelper(TreeNode node, List<Integer> result) {
        if (node == null) return;
        postorderHelper(node.left, result);
        postorderHelper(node.right, result);
        result.add(node.val);
    }

    // 레벨 순회 (BFS)
    public static List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>();
        if (root == null) return result;
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            int size = queue.size();
            List<Integer> level = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();
                level.add(node.val);
                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }
            result.add(level);
        }
        return result;
    }

    public static void main(String[] args) {
        //     1
        //    / \
        //   2   3
        //  / \
        // 4   5
        TreeNode root = new TreeNode(1,
            new TreeNode(2, new TreeNode(4), new TreeNode(5)),
            new TreeNode(3));

        assert preorder(root).equals(Arrays.asList(1, 2, 4, 5, 3));
        assert inorder(root).equals(Arrays.asList(4, 2, 5, 1, 3));
        assert postorder(root).equals(Arrays.asList(4, 5, 2, 3, 1));

        List<List<Integer>> levels = levelOrder(root);
        assert levels.get(0).equals(Arrays.asList(1));
        assert levels.get(1).equals(Arrays.asList(2, 3));
        assert levels.get(2).equals(Arrays.asList(4, 5));
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
