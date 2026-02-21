---
title: "[알고리즘] 트리 직렬화"
date: "2025-08-16"
category: "Algorithm"
tags: ["Algorithm", "직렬화/역직렬화", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 트리 직렬화 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**트리 직렬화**
* 파트: Tree & Binary Search Tree
* 관련 알고리즘: 직렬화/역직렬화

> **Architect's View**
> 데이터 교환 프로토콜 설계

이 글에서는 트리 직렬화 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 058: 트리 직렬화/역직렬화 (Serialize and Deserialize Binary Tree)
[문제] 이진 트리를 문자열로 직렬화하고 다시 트리로 복원하라.
[아키텍트의 시선] 데이터 교환 프로토콜 설계.
구조 데이터를 문자열로 변환 → 네트워크 전송 → 복원. JSON, Protobuf의 본질.
전위 순회 + null 마커로 트리 구조를 완벽히 보존.
실무: RPC 직렬화, 캐시 저장/복원, 세션 상태 전이.
[시간 복잡도] O(n) [공간 복잡도] O(n)
"""
from typing import Optional
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Codec:
    def serialize(self, root: Optional[TreeNode]) -> str:
        """전위 순회 기반 직렬화"""
        tokens = []
        def dfs(node):
            if not node:
                tokens.append("#")
                return
            tokens.append(str(node.val))
            dfs(node.left)
            dfs(node.right)
        dfs(root)
        return ",".join(tokens)

    def deserialize(self, data: str) -> Optional[TreeNode]:
        """토큰 스트림 기반 역직렬화"""
        tokens = deque(data.split(","))
        def dfs():
            token = tokens.popleft()
            if token == "#":
                return None
            node = TreeNode(int(token))
            node.left = dfs()
            node.right = dfs()
            return node
        return dfs()

if __name__ == "__main__":
    #     1
    #    / \\
    #   2   3
    #      / \\
    #     4   5
    root = TreeNode(1, TreeNode(2), TreeNode(3, TreeNode(4), TreeNode(5)))
    codec = Codec()
    serialized = codec.serialize(root)
    restored = codec.deserialize(serialized)
    assert codec.serialize(restored) == serialized
    assert codec.serialize(None) == "#"
    assert codec.deserialize("#") is None
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 058: 이진 트리 직렬화/역직렬화 (Serialize and Deserialize Binary Tree)
 *
 * [문제] 이진 트리를 문자열로 직렬화하고, 다시 트리로 역직렬화하라.
 *
 * [아키텍트의 시선]
 * 직렬화/역직렬화는 마이크로서비스 간 데이터 교환(protobuf, JSON),
 * 캐시 저장/복원, 메시지 큐를 통한 복잡한 객체 전달의 근본 원리다.
 * 구조화된 데이터의 평탄화(flatten)와 복원은 아키텍처 통합의 핵심이다.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P058SerializeTree {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int val) { this.val = val; }
    }

    // 전위 순회 기반 직렬화
    public static String serialize(TreeNode root) {
        StringBuilder sb = new StringBuilder();
        serializeHelper(root, sb);
        return sb.toString();
    }

    private static void serializeHelper(TreeNode node, StringBuilder sb) {
        if (node == null) {
            sb.append("null,");
            return;
        }
        sb.append(node.val).append(",");
        serializeHelper(node.left, sb);
        serializeHelper(node.right, sb);
    }

    public static TreeNode deserialize(String data) {
        Queue<String> queue = new LinkedList<>(Arrays.asList(data.split(",")));
        return deserializeHelper(queue);
    }

    private static TreeNode deserializeHelper(Queue<String> queue) {
        String val = queue.poll();
        if (val == null || val.equals("null")) return null;
        TreeNode node = new TreeNode(Integer.parseInt(val));
        node.left = deserializeHelper(queue);
        node.right = deserializeHelper(queue);
        return node;
    }

    // 트리 비교 유틸
    static boolean isSame(TreeNode a, TreeNode b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.val == b.val && isSame(a.left, b.left) && isSame(a.right, b.right);
    }

    public static void main(String[] args) {
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.right = new TreeNode(3);
        root.right.left = new TreeNode(4);
        root.right.right = new TreeNode(5);

        String serialized = serialize(root);
        TreeNode deserialized = deserialize(serialized);
        assert isSame(root, deserialized);

        // 빈 트리
        assert deserialize(serialize(null)) == null;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
