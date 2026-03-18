---
title: "[알고리즘] 최소 스택 (Min Stack)"
date: "2025-05-06"
category: "Algorithm"
tags: ["Algorithm", "보조 스택", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 최소 스택 (Min Stack) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

Min Stack은 "최솟값 하나 저장" 문제가 아니라, push/pop이 이어지는 가변 상태에서 `getMin()`을 O(1)로 보장하려면 어떤 보조 관측치를 함께 저장해야 하는지 묻는 문제입니다. 메인 스택과 보조 스택이 어떤 관계를 유지해야 하는지 설명해 보세요.

1. 각 push/pop 시점에서 메인 스택과 최소 스택의 상태를 같이 적고, 왜 보조 스택 top이 항상 현재 전체 최소값이어야 하는지 불변식으로 설명하세요.
2. 매번 전체 스택을 스캔하는 방식과 보조 스택 중복 저장 방식을 읽기 지연, 추가 메모리, branch predictability 관점에서 비교하세요.
3. min뿐 아니라 max, median, frequency까지 즉시 질의해야 한다면 어떤 자료구조 조합이 필요해지는지 설계 관점에서 설명하세요.

## 답변할 때 포함할 것

- 두 스택 상태를 같은 시점에 나란히 적을 것
- O(1) 보장을 위해 중복 저장하는 이유를 설명할 것
- 읽기 최적화와 쓰기 비용 증가를 분리해서 적을 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 016: 최소 스택 (Min Stack)
==========================================================

[문제 설명]
push, pop, top, getMin 모두 O(1)에 동작하는 스택을 설계하라.

[아키텍트의 시선 - 보조 데이터 구조와 CQRS 패턴]
보조 스택에 "현재까지의 최솟값"을 추적 → 조회 O(1) 보장.
CQRS(Command Query Responsibility Segregation) 관점:
쓰기(push/pop)와 읽기(getMin)의 책임을 분리한 구조.

[시간 복잡도] 모든 연산 O(1) [공간 복잡도] O(n)
"""


class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []

    def push(self, val: int) -> None:
        self.stack.append(val)
        min_val = min(val, self.min_stack[-1] if self.min_stack else val)
        self.min_stack.append(min_val)

    def pop(self) -> None:
        self.stack.pop()
        self.min_stack.pop()

    def top(self) -> int:
        return self.stack[-1]

    def get_min(self) -> int:
        return self.min_stack[-1]


if __name__ == "__main__":
    ms = MinStack()
    ms.push(-2)
    ms.push(0)
    ms.push(-3)
    assert ms.get_min() == -3
    ms.pop()
    assert ms.top() == 0
    assert ms.get_min() == -2

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 016: 최소 스택 (Min Stack)
 *
 * [문제] push, pop, top, getMin 모두 O(1)에 동작하는 스택을 구현하라.
 *
 * [아키텍트의 시선]
 * O(1) 최솟값 조회는 모니터링 시스템의 실시간 최솟값 추적,
 * SLA 위반 즉시 감지, 리소스 사용량 하한선 모니터링과 동일하다.
 * 보조 자료구조로 시간 복잡도를 낮추는 것은 캐싱 전략의 핵심이다.
 *
 * [시간 복잡도] O(1) 모든 연산 [공간 복잡도] O(n)
 */
import java.util.Stack;

public class P016MinStack {
    private Stack<Integer> stack;
    private Stack<Integer> minStack; // 각 시점의 최솟값을 추적

    public P016MinStack() {
        stack = new Stack<>();
        minStack = new Stack<>();
    }

    public void push(int val) {
        stack.push(val);
        // 현재까지의 최솟값을 minStack에 유지
        if (minStack.isEmpty() || val <= minStack.peek()) {
            minStack.push(val);
        } else {
            minStack.push(minStack.peek());
        }
    }

    public void pop() {
        stack.pop();
        minStack.pop();
    }

    public int top() {
        return stack.peek();
    }

    public int getMin() {
        return minStack.peek();
    }

    public static void main(String[] args) {
        P016MinStack ms = new P016MinStack();
        ms.push(-2);
        ms.push(0);
        ms.push(-3);
        assert ms.getMin() == -3;
        ms.pop();
        assert ms.top() == 0;
        assert ms.getMin() == -2;
        ms.push(1);
        assert ms.getMin() == -2;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
