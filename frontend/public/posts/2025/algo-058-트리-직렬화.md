---
title: "[알고리즘] 트리 직렬화"
date: "2025-08-16"
category: "Algorithm"
tags: ["Algorithm", "직렬화/역직렬화", "Problem Solving", "Python", "Java"]
excerpt: "Tree & Binary Search Tree - 트리 직렬화 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

트리 직렬화는 자료구조 문제라기보다, 메모리 안의 포인터 구조를 네트워크나 저장소를 건널 수 있는 선형 프로토콜로 바꾸는 문제입니다. 값 나열만으로는 왜 원래 구조를 복원할 수 없는지 설명해 보세요.

1. preorder + null marker 방식이 어떤 토큰 스트림을 만들고, 역직렬화가 그 스트림을 어떻게 다시 트리 구조로 복원하는지 추적하세요.
2. preorder null marker, level-order, 괄호 표기법을 직렬화 크기, 모호성, 스트리밍 적합성 관점에서 비교하세요.
3. 이 프로토콜에 버전 필드, 압축, checksum이 추가되면 왜 단순 알고리즘 문제가 시스템 설계 문제로 바뀌는지 설명하세요.

## 답변할 때 포함할 것

- 토큰 스트림 예시를 적을 것
- 복원 가능성이 왜 null marker에 달려 있는지 적을 것
- 프로토콜 설계 관점의 trade-off를 설명할 것

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
