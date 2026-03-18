---
title: "[알고리즘] 대칭 트리 (Symmetric)"
date: "2025-08-03"
category: "Algorithm"
tags: ["Algorithm", "거울 비교", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 대칭 트리 (Symmetric) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

대칭 트리는 값 비교 문제가 아니라, 두 서브트리가 거울 대응 관계를 만족하는지 검증하는 구조적 동등성 문제입니다. 단순 inorder 값 비교만으로는 왜 충분하지 않은지 설명해 보세요.

1. `left.left`와 `right.right`, `left.right`와 `right.left`가 서로 대응해야 한다는 거울 매핑을 추적하세요.
2. 값 시퀀스만 비교하는 방식과 구조+값을 함께 비교하는 방식을 반례와 함께 비교하세요.
3. 이 문제를 일반 그래프 동형성 문제와 비교하면 왜 트리에서는 훨씬 단순한지 설명하세요.

## 답변할 때 포함할 것

- 거울 대응 쌍을 명시할 것
- 구조와 값 비교를 분리할 것
- 단순 순회 시퀀스 비교가 실패하는 반례를 적을 것

## 🐍 Python 구현

```python
"""
문제 053: 대칭 트리 (Symmetric Tree)
[문제] 이진 트리가 좌우 대칭(거울상)인지 판별하라.
[아키텍트의 시선] 구조적 동등성 비교.
두 서브트리의 '거울 동등성'을 재귀적으로 검증한다.
is_mirror(left, right) = left.val == right.val AND
is_mirror(left.left, right.right) AND is_mirror(left.right, right.left).
실무: 데이터 무결성 검증, 분산 시스템의 대칭 복제 확인.
[시간 복잡도] O(n) [공간 복잡도] O(h)
"""
from typing import Optional

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def is_symmetric(root: Optional[TreeNode]) -> bool:
    if not root:
        return True

    def is_mirror(t1: Optional[TreeNode], t2: Optional[TreeNode]) -> bool:
        if not t1 and not t2:
            return True
        if not t1 or not t2:
            return False
        return (t1.val == t2.val and
                is_mirror(t1.left, t2.right) and
                is_mirror(t1.right, t2.left))

    return is_mirror(root.left, root.right)

if __name__ == "__main__":
    # 대칭:    1
    #        / \\
    #       2   2
    #      / \\ / \\
    #     3  4 4  3
    sym = TreeNode(1, TreeNode(2, TreeNode(3), TreeNode(4)),
                      TreeNode(2, TreeNode(4), TreeNode(3)))
    assert is_symmetric(sym) == True
    # 비대칭
    asym = TreeNode(1, TreeNode(2, None, TreeNode(3)),
                       TreeNode(2, None, TreeNode(3)))
    assert is_symmetric(asym) == False
    assert is_symmetric(None) == True
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 053: 대칭 트리 (Symmetric Tree)
 *
 * [문제] 이진 트리가 좌우 대칭인지 판별하라.
 *
 * [아키텍트의 시선]
 * 대칭 검증은 시스템 이중화 검증의 핵심이다.
 * Active-Active 구성의 대칭성 확인, 데이터 레플리카의 일관성 검증,
 * 로드 밸런서의 균등 분배 확인과 동일한 사고방식이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(h)
 */
public class P053SymmetricTree {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static boolean isSymmetric(TreeNode root) {
        if (root == null) return true;
        return isMirror(root.left, root.right);
    }

    private static boolean isMirror(TreeNode t1, TreeNode t2) {
        if (t1 == null && t2 == null) return true;
        if (t1 == null || t2 == null) return false;
        return t1.val == t2.val
            && isMirror(t1.left, t2.right)
            && isMirror(t1.right, t2.left);
    }

    public static void main(String[] args) {
        TreeNode sym = new TreeNode(1,
            new TreeNode(2, new TreeNode(3), new TreeNode(4)),
            new TreeNode(2, new TreeNode(4), new TreeNode(3)));
        assert isSymmetric(sym);

        TreeNode asym = new TreeNode(1,
            new TreeNode(2, null, new TreeNode(3)),
            new TreeNode(2, null, new TreeNode(3)));
        assert !isSymmetric(asym);
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
