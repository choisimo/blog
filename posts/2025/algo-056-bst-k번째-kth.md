---
title: "[알고리즘] BST K번째 (Kth)"
date: "2025-08-10"
category: "Algorithm"
tags: ["Algorithm", "중위 순회", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - BST K번째 (Kth) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**BST K번째 (Kth)**
* 파트: Tree & Binary Search Tree
* 관련 알고리즘: 중위 순회

> **Architect's View**
> Order-Statistic과 이터레이터

이 글에서는 BST K번째 (Kth) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 056: BST에서 K번째 작은 수 (Kth Smallest Element in BST)
[문제] BST에서 K번째로 작은 원소를 찾아라.
[아키텍트의 시선] Order-Statistic과 이터레이터 패턴.
BST의 중위 순회 = 정렬 순서. K번째 방문 시 즉시 반환하면 O(h+k).
전체 정렬 불필요 → 지연 평가(Lazy Evaluation)의 전형적 적용.
실무: 데이터베이스 ORDER BY LIMIT k, 스트림에서 k번째 원소.
[시간 복잡도] O(H+k) [공간 복잡도] O(H) H=트리 높이
"""
from typing import Optional

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def kth_smallest(root: Optional[TreeNode], k: int) -> int:
    """반복적 중위 순회 (스택)"""
    stack = []
    current = root
    count = 0
    while stack or current:
        while current:
            stack.append(current)
            current = current.left
        current = stack.pop()
        count += 1
        if count == k:
            return current.val
        current = current.right
    return -1

def kth_smallest_recursive(root: Optional[TreeNode], k: int) -> int:
    """재귀적 중위 순회"""
    result = [0]
    counter = [0]
    def inorder(node):
        if not node:
            return
        inorder(node.left)
        counter[0] += 1
        if counter[0] == k:
            result[0] = node.val
            return
        inorder(node.right)
    inorder(root)
    return result[0]

if __name__ == "__main__":
    #       3
    #      / \\
    #     1   4
    #      \\
    #       2
    root = TreeNode(3, TreeNode(1, None, TreeNode(2)), TreeNode(4))
    assert kth_smallest(root, 1) == 1
    assert kth_smallest(root, 2) == 2
    assert kth_smallest(root, 3) == 3
    assert kth_smallest_recursive(root, 1) == 1
    assert kth_smallest_recursive(root, 3) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 056: BST에서 K번째로 작은 원소 (Kth Smallest Element in BST)
 *
 * [문제] BST에서 k번째로 작은 값을 찾아라.
 *
 * [아키텍트의 시선]
 * BST의 중위 순회는 정렬된 순서를 O(n)에 생성한다.
 * 이는 정렬 인덱스에서 페이지네이션, 순위 기반 질의(RANK),
 * 리더보드 시스템의 순위 조회와 동일한 패턴이다.
 *
 * [시간 복잡도] O(h + k) [공간 복잡도] O(h)
 */
import java.util.*;

public class P056KthSmallestBST {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static int kthSmallest(TreeNode root, int k) {
        // 반복적 중위 순회 (스택 사용)
        Stack<TreeNode> stack = new Stack<>();
        TreeNode curr = root;
        int count = 0;

        while (curr != null || !stack.isEmpty()) {
            while (curr != null) {
                stack.push(curr);
                curr = curr.left;
            }
            curr = stack.pop();
            count++;
            if (count == k) return curr.val;
            curr = curr.right;
        }
        return -1; // 도달 불가
    }

    public static void main(String[] args) {
        //     3
        //    / \
        //   1   4
        //    \
        //     2
        TreeNode root = new TreeNode(3,
            new TreeNode(1, null, new TreeNode(2)),
            new TreeNode(4));
        assert kthSmallest(root, 1) == 1;
        assert kthSmallest(root, 2) == 2;
        assert kthSmallest(root, 3) == 3;
        assert kthSmallest(root, 4) == 4;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
