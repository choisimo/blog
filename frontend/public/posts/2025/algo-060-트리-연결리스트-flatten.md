---
title: "[알고리즘] 트리→연결리스트 (Flatten)"
date: "2025-08-20"
category: "Algorithm"
tags: ["Algorithm", "전위 기반", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 트리→연결리스트 (Flatten) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

트리 flatten은 노드를 새로 복사하는 문제가 아니라, 전위 순회를 보존한 채 기존 포인터를 파괴적으로 재배선해 선형 구조로 바꾸는 문제입니다. "트리를 없애고 리스트를 만든다"가 아니라 "같은 노드 집합의 연결 토폴로지를 바꾼다"는 점을 설명해 보세요.

1. 어떤 노드에서 왼쪽 서브트리를 오른쪽으로 옮기고, 원래 오른쪽 서브트리를 어디에 붙이는지 단계별로 추적하세요.
2. 재귀, 스택 기반 전위 순회, Morris-style O(1) 추가 공간 방식을 메모리 사용량과 포인터 조작 위험 관점에서 비교하세요.
3. 이 변환이 끝난 뒤 원래 트리 구조 정보가 왜 사라지는지, 역변환이 일반적으로 불가능한 이유를 설명하세요.

## 답변할 때 포함할 것

- 포인터 재배선 순서를 적을 것
- 전위 순서 보존이 왜 중요한지 설명할 것
- 파괴적 변환의 대가를 적을 것

## 🐍 Python 구현

```python
"""
문제 060: 트리를 연결 리스트로 변환 (Flatten Binary Tree to Linked List)
[문제] 이진 트리를 전위 순회 순서로 right 포인터만 사용하는 연결 리스트로 변환하라.
[아키텍트의 시선] 구조의 선형화와 모리스 순회.
트리 구조를 선형 구조로 변환 → 메모리 지역성 향상, 순차 접근 최적화.
모리스 순회: O(1) 공간으로 트리 순회 (스레드 기법).
실무: DB 인덱스 선형화, 트리 직렬화, 이터레이터 패턴.
[시간 복잡도] O(n) [공간 복잡도] O(1) 모리스, O(h) 재귀
"""
from typing import Optional, List

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def flatten(root: Optional[TreeNode]) -> None:
    """모리스 순회 기반 O(1) 공간"""
    current = root
    while current:
        if current.left:
            # 왼쪽 서브트리의 가장 오른쪽 노드 찾기
            rightmost = current.left
            while rightmost.right:
                rightmost = rightmost.right
            # 현재의 오른쪽을 왼쪽 서브트리의 가장 오른쪽에 연결
            rightmost.right = current.right
            current.right = current.left
            current.left = None
        current = current.right

def tree_to_list(root: Optional[TreeNode]) -> List[int]:
    """검증용: 연결 리스트를 배열로 변환"""
    result = []
    while root:
        result.append(root.val)
        assert root.left is None, "left must be None"
        root = root.right
    return result

if __name__ == "__main__":
    #     1
    #    / \\
    #   2   5
    #  / \\   \\
    # 3   4   6
    root = TreeNode(1,
        TreeNode(2, TreeNode(3), TreeNode(4)),
        TreeNode(5, None, TreeNode(6)))
    flatten(root)
    assert tree_to_list(root) == [1, 2, 3, 4, 5, 6]
    # 빈 트리
    flatten(None)
    # 단일 노드
    single = TreeNode(0)
    flatten(single)
    assert tree_to_list(single) == [0]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 060: 이진 트리를 연결 리스트로 평탄화 (Flatten Binary Tree to Linked List)
 *
 * [문제] 이진 트리를 전위 순회 순서의 단일 연결 리스트(right 포인터만 사용)로 평탄화하라.
 *
 * [아키텍트의 시선]
 * 트리 → 리스트 변환은 계층 구조를 순차 구조로 변환하는 패턴이다.
 * 중첩 JSON을 플랫 키-값으로 변환, 재귀적 메뉴 구조를 브레드크럼으로 변환,
 * 트리 기반 인덱스를 정렬된 스캔 리스트로 변환하는 것과 동일하다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1) Morris 방법
 */
import java.util.*;

public class P060FlattenTree {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
        TreeNode(int val, TreeNode left, TreeNode right) {
            this.val = val; this.left = left; this.right = right;
        }
    }

    // Morris 순회 아이디어: O(1) 공간
    public static void flatten(TreeNode root) {
        TreeNode curr = root;
        while (curr != null) {
            if (curr.left != null) {
                // 왼쪽 서브트리의 가장 오른쪽 노드를 찾아 현재의 right를 연결
                TreeNode rightmost = curr.left;
                while (rightmost.right != null) {
                    rightmost = rightmost.right;
                }
                rightmost.right = curr.right;
                curr.right = curr.left;
                curr.left = null;
            }
            curr = curr.right;
        }
    }

    static List<Integer> toList(TreeNode root) {
        List<Integer> result = new ArrayList<>();
        while (root != null) {
            result.add(root.val);
            assert root.left == null; // 평탄화 확인
            root = root.right;
        }
        return result;
    }

    public static void main(String[] args) {
        //     1
        //    / \
        //   2   5
        //  / \   \
        // 3   4   6
        TreeNode root = new TreeNode(1,
            new TreeNode(2, new TreeNode(3), new TreeNode(4)),
            new TreeNode(5, null, new TreeNode(6)));
        flatten(root);
        assert toList(root).equals(Arrays.asList(1, 2, 3, 4, 5, 6));

        flatten(null); // null 처리
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
