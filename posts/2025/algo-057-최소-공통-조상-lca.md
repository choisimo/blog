---
title: "[알고리즘] 최소 공통 조상 (LCA)"
date: "2025-08-13"
category: "Algorithm"
tags: ["Algorithm", "재귀 분기", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 최소 공통 조상 (LCA) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**최소 공통 조상 (LCA)**
* 파트: Tree & Binary Search Tree
* 관련 알고리즘: 재귀 분기

> **Architect's View**
> 트리 쿼리와 분기점 탐색

이 글에서는 최소 공통 조상 (LCA) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 057: 최소 공통 조상 (Lowest Common Ancestor)
[문제] 이진 트리에서 두 노드 p, q의 최소 공통 조상(LCA)을 찾아라.
[아키텍트의 시선] 트리 쿼리와 분기점 탐색.
후위 순회로 왼쪽/오른쪽에서 각각 p, q를 찾으면 현재가 LCA.
한쪽에서만 찾으면 그쪽이 LCA (둘 다 같은 서브트리에 있으므로).
실무: 버전 관리의 merge-base, 조직도 공통 상위 관리자, DOM 공통 조상.
[시간 복잡도] O(n) [공간 복잡도] O(h)
"""
from typing import Optional

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def lowest_common_ancestor(root: Optional[TreeNode], p: TreeNode, q: TreeNode) -> Optional[TreeNode]:
    if not root or root == p or root == q:
        return root
    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)
    if left and right:
        return root  # p, q가 양쪽에 하나씩 → 현재가 LCA
    return left if left else right

if __name__ == "__main__":
    #       3
    #      / \\
    #     5   1
    #    / \\ / \\
    #   6  2 0  8
    #     / \\
    #    7   4
    n = {}
    for v in [3,5,1,6,2,0,8,7,4]:
        n[v] = TreeNode(v)
    n[3].left, n[3].right = n[5], n[1]
    n[5].left, n[5].right = n[6], n[2]
    n[1].left, n[1].right = n[0], n[8]
    n[2].left, n[2].right = n[7], n[4]
    assert lowest_common_ancestor(n[3], n[5], n[1]) == n[3]
    assert lowest_common_ancestor(n[3], n[5], n[4]) == n[5]
    assert lowest_common_ancestor(n[3], n[7], n[4]) == n[2]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 057: 최소 공통 조상 (Lowest Common Ancestor)
 *
 * [문제] 이진 트리에서 두 노드의 최소 공통 조상(LCA)을 찾아라.
 *
 * [아키텍트의 시선]
 * LCA는 조직 구조에서 두 팀의 공통 상위 관리자,
 * 버전 관리 시스템에서 두 브랜치의 공통 조상 커밋(git merge-base),
 * 네트워크에서 두 노드 간 통신의 최소 공통 라우터와 동일하다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(h)
 */
public class P057LCA {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        if (root == null || root == p || root == q) return root;

        TreeNode left = lowestCommonAncestor(root.left, p, q);
        TreeNode right = lowestCommonAncestor(root.right, p, q);

        // 양쪽에서 모두 찾았으면 현재 노드가 LCA
        if (left != null && right != null) return root;
        return (left != null) ? left : right;
    }

    public static void main(String[] args) {
        //       3
        //      / \
        //     5   1
        //    / \ / \
        //   6  2 0  8
        //     / \
        //    7   4
        TreeNode n7 = new TreeNode(7), n4 = new TreeNode(4);
        TreeNode n6 = new TreeNode(6);
        TreeNode n2 = new TreeNode(2, n7, n4);
        TreeNode n5 = new TreeNode(5, n6, n2);
        TreeNode n0 = new TreeNode(0), n8 = new TreeNode(8);
        TreeNode n1 = new TreeNode(1, n0, n8);
        TreeNode root = new TreeNode(3, n5, n1);

        assert lowestCommonAncestor(root, n5, n1) == root;
        assert lowestCommonAncestor(root, n5, n4) == n5;
        assert lowestCommonAncestor(root, n6, n4) == n5;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
