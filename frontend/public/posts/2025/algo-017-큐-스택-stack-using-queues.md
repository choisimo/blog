---
title: "[알고리즘] 큐→스택 (Stack using Queues)"
date: "2025-05-08"
category: "Algorithm"
tags: ["Algorithm", "어댑터", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 큐→스택 (Stack using Queues) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

이 문제는 자료구조 구현 문제가 아니라, FIFO 인터페이스만 가진 하부 계층 위에 LIFO 의미론을 얹는 어댑터 설계 문제입니다. 큐의 물리적 동작은 그대로인데 관찰 가능한 외부 행동만 스택처럼 보이게 만드는 방법을 설명해 보세요.

1. `push` 시 회전을 하든 `pop` 시 재배치를 하든, 어느 연산에 비용을 몰아넣을지 결정해야 합니다. 두 전략의 상태 변화를 큐 순서 기준으로 추적하세요.
2. 단일 큐 회전 방식과 이중 큐 전환 방식을 상수항, 캐시 locality, 구현 복잡도 관점에서 비교하세요.
3. 이런 의미론 변환이 실제 시스템에서 프로토콜 어댑터, API shim, 이벤트 재정렬 계층과 어떻게 닮아 있는지 설명하세요.

## 답변할 때 포함할 것

- 큐 내부 순서가 어떻게 바뀌는지 적을 것
- 어떤 연산을 비싸게 만들었는지 명시할 것
- 인터페이스와 구현 계층을 분리해서 설명할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 017: 큐를 이용한 스택 구현 (Stack using Queues)
==========================================================

[문제 설명]
두 개의 큐만을 사용하여 LIFO(스택) 동작을 구현하라.

[아키텍트의 시선 - 어댑터 패턴과 인터페이스 변환]
GoF Adapter Pattern의 전형적 사례.
기존 인터페이스(Queue/FIFO)를 다른 인터페이스(Stack/LIFO)로 변환.
실무: 레거시 시스템 래핑, 프로토콜 변환 게이트웨이.

[시간 복잡도] push O(n), pop O(1) [공간 복잡도] O(n)
"""
from collections import deque


class MyStack:
    def __init__(self):
        self.queue = deque()

    def push(self, x: int) -> None:
        self.queue.append(x)
        for _ in range(len(self.queue) - 1):
            self.queue.append(self.queue.popleft())

    def pop(self) -> int:
        return self.queue.popleft()

    def top(self) -> int:
        return self.queue[0]

    def empty(self) -> bool:
        return len(self.queue) == 0


if __name__ == "__main__":
    s = MyStack()
    s.push(1)
    s.push(2)
    assert s.top() == 2
    assert s.pop() == 2
    assert s.empty() is False
    assert s.pop() == 1
    assert s.empty() is True

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 017: 스택으로 큐 구현 (Queue Using Stacks)
 *
 * [문제] 두 개의 스택만 사용하여 FIFO 큐를 구현하라.
 * push, pop, peek, empty 연산을 지원해야 한다.
 *
 * [아키텍트의 시선]
 * 스택→큐 변환은 메시지 브로커의 내부 구현 패턴이다.
 * Producer/Consumer 패턴에서 LIFO→FIFO 변환은
 * 이벤트 순서 보장 메커니즘의 근본 원리다.
 * 분할 상환 분석(Amortized Analysis)으로 O(1) 평균 성능을 보장한다.
 *
 * [시간 복잡도] push O(1), pop 분할상환 O(1) [공간 복잡도] O(n)
 */
import java.util.Stack;

public class P017QueueUsingStacks {
    private Stack<Integer> inStack;  // push용
    private Stack<Integer> outStack; // pop용

    public P017QueueUsingStacks() {
        inStack = new Stack<>();
        outStack = new Stack<>();
    }

    public void push(int x) {
        inStack.push(x);
    }

    public int pop() {
        peek(); // outStack이 비어있으면 채움
        return outStack.pop();
    }

    public int peek() {
        if (outStack.isEmpty()) {
            // inStack의 모든 원소를 outStack으로 이동 → 순서 뒤집힘 → FIFO
            while (!inStack.isEmpty()) {
                outStack.push(inStack.pop());
            }
        }
        return outStack.peek();
    }

    public boolean empty() {
        return inStack.isEmpty() && outStack.isEmpty();
    }

    public static void main(String[] args) {
        P017QueueUsingStacks q = new P017QueueUsingStacks();
        q.push(1);
        q.push(2);
        assert q.peek() == 1;
        assert q.pop() == 1;
        assert !q.empty();
        assert q.pop() == 2;
        assert q.empty();
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
