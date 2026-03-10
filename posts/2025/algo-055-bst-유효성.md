---
title: "[알고리즘] BST 유효성"
date: "2025-08-08"
category: "Algorithm"
tags: ["Algorithm", "범위 검증", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - BST 유효성 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**BST 유효성**
* 파트: Tree & Binary Search Tree
* 관련 알고리즘: 범위 검증

> **Architect's View**
> 불변식 검증과 범위 제약

이 글에서는 BST 유효성 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 055: BST 유효성 검증 (Validate Binary Search Tree)
[문제] 이진 트리가 유효한 BST인지 검증하라.
BST 조건: 모든 노드에 대해 왼쪽 < 현재 < 오른쪽 (서브트리 전체).
[아키텍트의 시선] 불변식(Invariant) 검증과 범위 제약.
단순히 부모-자식만 비교하면 안 됨. 상위 조상의 범위 제약까지 전파해야 함.
실무: 데이터 무결성 검증, 인덱스 정합성 확인, 설정값 범위 검증.
[시간 복잡도] O(n) [공간 복잡도] O(h)
"""
from typing import Optional
import math

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def is_valid_bst(root: Optional[TreeNode]) -> bool:
    """범위 검증 방식"""
    def validate(node, low, high):
        if not node:
            return True
        if node.val <= low or node.val >= high:
            return False
        return validate(node.left, low, node.val) and validate(node.right, node.val, high)
    return validate(root, -math.inf, math.inf)

def is_valid_bst_inorder(root: Optional[TreeNode]) -> bool:
    """중위 순회 방식: BST의 중위 순회는 오름차순"""
    prev = -math.inf
    def inorder(node):
        nonlocal prev
        if not node:
            return True
        if not inorder(node.left):
            return False
        if node.val <= prev:
            return False
        prev = node.val
        return inorder(node.right)
    return inorder(root)

if __name__ == "__main__":
    # 유효: 2-1-3
    valid = TreeNode(2, TreeNode(1), TreeNode(3))
    assert is_valid_bst(valid) == True
    assert is_valid_bst_inorder(valid) == True
    # 무효: 5-1-4(3,6) → 4가 5보다 작은데 오른쪽에 있음
    invalid = TreeNode(5, TreeNode(1), TreeNode(4, TreeNode(3), TreeNode(6)))
    assert is_valid_bst(invalid) == False
    assert is_valid_bst_inorder(invalid) == False
    # 무효: 5-4-6(3,7) → 3이 5보다 작은데 오른쪽 서브트리에 있음
    tricky = TreeNode(5, TreeNode(4), TreeNode(6, TreeNode(3), TreeNode(7)))
    assert is_valid_bst(tricky) == False
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 055: BST 유효성 검증 (Validate Binary Search Tree)
 *
 * [문제] 이진 트리가 유효한 이진 탐색 트리(BST)인지 검증하라.
 *
 * [아키텍트의 시선]
 * BST 유효성 검증은 데이터 무결성 검증의 핵심 패턴이다.
 * 데이터베이스 인덱스 일관성 검증, 분산 시스템의 순서 보장 확인,
 * 이벤트 소싱의 타임스탬프 순서 검증과 동일하다.
 * "로컬은 OK이지만 글로벌은 NO"인 경우를 잡아야 한다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(h)
 */
public class P055ValidateBST {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static boolean isValidBST(TreeNode root) {
        return validate(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private static boolean validate(TreeNode node, long min, long max) {
        if (node == null) return true;
        if (node.val <= min || node.val >= max) return false;
        return validate(node.left, min, node.val)
            && validate(node.right, node.val, max);
    }

    public static void main(String[] args) {
        TreeNode valid = new TreeNode(2, new TreeNode(1), new TreeNode(3));
        assert isValidBST(valid);

        // 5의 왼쪽 서브트리에 6이 있음 → 무효
        TreeNode invalid = new TreeNode(5,
            new TreeNode(1),
            new TreeNode(4, new TreeNode(3), new TreeNode(6)));
        assert !isValidBST(invalid);

        assert isValidBST(null);
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
