---
title: "[알고리즘] 우측 뷰 (Right View)"
date: "2025-08-18"
category: "Algorithm"
tags: ["Algorithm", "레벨 순회", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 우측 뷰 (Right View) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

우측 뷰는 트리 전체를 보는 문제가 아니라, 계층 구조를 특정 시점(side projection)에서 투영했을 때 보이는 frontier를 추출하는 문제입니다. 왜 각 레벨에서 마지막 노드만 남기면 되는지 설명해 보세요.

1. 레벨 순회에서 각 depth의 노드 집합이 어떻게 형성되고, 그중 어떤 노드가 투영 결과로 선택되는지 추적하세요.
2. BFS level-order 방식과 우선 순서를 조정한 DFS 방식이 같은 답을 만드는 이유와, 내부 상태는 어떻게 다른지 설명하세요.
3. 좌측 뷰, 상단 뷰, 실루엣 문제로 일반화하면 어떤 추가 좌표 정보가 필요해지는지 설명하세요.

## 답변할 때 포함할 것

- 레벨별 frontier를 적을 것
- 투영 관점에서 문제를 설명할 것
- BFS와 DFS의 상태 차이를 적을 것

## 🐍 Python 구현

```python
"""
문제 059: 이진 트리 우측 뷰 (Binary Tree Right Side View)
[문제] 이진 트리를 오른쪽에서 보았을 때 보이는 노드들을 반환하라.
[아키텍트의 시선] View Projection 패턴.
각 레벨의 마지막 노드만 수집 → 레벨 순회(BFS)에서 마지막 원소 추출.
실무: 대시보드 요약 뷰, 조직도 계층별 대표자, 트리 구조 시각화.
[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import Optional, List
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def right_side_view(root: Optional[TreeNode]) -> List[int]:
    """BFS: 각 레벨의 마지막 노드"""
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level_size = len(queue)
        for i in range(level_size):
            node = queue.popleft()
            if i == level_size - 1:
                result.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
    return result

def right_side_view_dfs(root: Optional[TreeNode]) -> List[int]:
    """DFS: 오른쪽 먼저, 깊이별 첫 방문만 기록"""
    result = []
    def dfs(node, depth):
        if not node:
            return
        if depth == len(result):
            result.append(node.val)
        dfs(node.right, depth + 1)
        dfs(node.left, depth + 1)
    dfs(root, 0)
    return result

if __name__ == "__main__":
    #     1
    #    / \\
    #   2   3
    #    \\   \\
    #     5   4
    root = TreeNode(1, TreeNode(2, None, TreeNode(5)), TreeNode(3, None, TreeNode(4)))
    assert right_side_view(root) == [1, 3, 4]
    assert right_side_view_dfs(root) == [1, 3, 4]
    # 왼쪽이 더 깊은 경우
    root2 = TreeNode(1, TreeNode(2, TreeNode(4)), TreeNode(3))
    assert right_side_view(root2) == [1, 3, 4]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 059: 이진 트리 오른쪽 뷰 (Binary Tree Right Side View)
 *
 * [문제] 이진 트리를 오른쪽에서 바라봤을 때 보이는 노드의 값을 반환하라.
 *
 * [아키텍트의 시선]
 * 레벨별 마지막 노드 선택은 각 계층에서 대표 인스턴스를 선정하는 패턴이다.
 * 모니터링 대시보드에서 각 서비스 레이어의 상태 대표값 선정,
 * 조직도에서 각 레벨의 가장 최근 입사자 조회와 동일하다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P059RightSideView {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    public static List<Integer> rightSideView(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        if (root == null) return result;
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            int size = queue.size();
            for (int i = 0; i < size; i++) {
                TreeNode node = queue.poll();
                if (i == size - 1) result.add(node.val); // 각 레벨의 마지막 노드
                if (node.left != null) queue.offer(node.left);
                if (node.right != null) queue.offer(node.right);
            }
        }
        return result;
    }

    public static void main(String[] args) {
        //   1
        //  / \
        // 2   3
        //  \   \
        //   5   4
        TreeNode root = new TreeNode(1,
            new TreeNode(2, null, new TreeNode(5)),
            new TreeNode(3, null, new TreeNode(4)));
        assert rightSideView(root).equals(Arrays.asList(1, 3, 4));
        assert rightSideView(null).isEmpty();
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
