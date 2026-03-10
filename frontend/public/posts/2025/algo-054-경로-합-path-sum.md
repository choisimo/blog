---
title: "[알고리즘] 경로 합 (Path Sum)"
date: "2025-08-06"
category: "Algorithm"
tags: ["Algorithm", "DFS", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 경로 합 (Path Sum) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**경로 합 (Path Sum)**
* 파트: Tree & Binary Search Tree
* 관련 알고리즘: DFS

> **Architect's View**
> 경로 탐색과 목표 분해

이 글에서는 경로 합 (Path Sum) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 054: 경로 합 (Path Sum)
[문제] 루트~리프 경로 중 합이 targetSum인 경로가 있는지 판별하라.
[아키텍트의 시선] 경로 탐색과 목표 분해.
각 노드에서 남은 목표를 줄여가며 리프에서 0이 되는지 확인.
'큰 문제를 단계별로 줄여가는' DP/재귀적 사고의 전형.
실무: 비용 경로 분석, 의존성 체인의 총 비용 계산.
[시간 복잡도] O(n) [공간 복잡도] O(h)
"""
from typing import Optional, List

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def has_path_sum(root: Optional[TreeNode], target_sum: int) -> bool:
    """경로 합 존재 여부"""
    if not root:
        return False
    if not root.left and not root.right:
        return root.val == target_sum
    remainder = target_sum - root.val
    return has_path_sum(root.left, remainder) or has_path_sum(root.right, remainder)

def path_sum_all(root: Optional[TreeNode], target_sum: int) -> List[List[int]]:
    """모든 경로 합 반환 (확장)"""
    result = []
    def dfs(node, remaining, path):
        if not node:
            return
        path.append(node.val)
        if not node.left and not node.right and remaining == node.val:
            result.append(path[:])
        dfs(node.left, remaining - node.val, path)
        dfs(node.right, remaining - node.val, path)
        path.pop()
    dfs(root, target_sum, [])
    return result

if __name__ == "__main__":
    #       5
    #      / \\
    #     4   8
    #    /   / \\
    #   11  13  4
    #  / \\      \\
    # 7   2      1
    root = TreeNode(5,
        TreeNode(4, TreeNode(11, TreeNode(7), TreeNode(2))),
        TreeNode(8, TreeNode(13), TreeNode(4, None, TreeNode(1))))
    assert has_path_sum(root, 22) == True
    assert has_path_sum(root, 26) == True
    assert has_path_sum(root, 100) == False
    assert path_sum_all(root, 22) == [[5, 4, 11, 2]]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 054: 경로 합 (Path Sum)
 *
 * [문제] 루트에서 리프까지의 경로 중 합이 targetSum인 경로가 있는지 판별하라.
 *
 * [아키텍트의 시선]
 * 경로 합 탐색은 비용 제한 경로 탐색(Budget-constrained routing)과 동일하다.
 * SLA 예산 내 서비스 호출 체인 검증, 네트워크 홉 수 제한 경로 탐색,
 * 워크플로우의 총 실행 시간 검증에 직접 활용된다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(h)
 */
public class P054PathSum {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static boolean hasPathSum(TreeNode root, int targetSum) {
        if (root == null) return false;
        // 리프 노드인 경우 남은 합이 현재 값과 같은지 확인
        if (root.left == null && root.right == null) {
            return root.val == targetSum;
        }
        int remaining = targetSum - root.val;
        return hasPathSum(root.left, remaining) || hasPathSum(root.right, remaining);
    }

    public static void main(String[] args) {
        //       5
        //      / \
        //     4   8
        //    /   / \
        //   11  13  4
        //  / \       \
        // 7   2       1
        TreeNode root = new TreeNode(5,
            new TreeNode(4, new TreeNode(11, new TreeNode(7), new TreeNode(2)), null),
            new TreeNode(8, new TreeNode(13), new TreeNode(4, null, new TreeNode(1))));
        assert hasPathSum(root, 22);  // 5→4→11→2
        assert !hasPathSum(root, 1);
        assert !hasPathSum(null, 0);
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
