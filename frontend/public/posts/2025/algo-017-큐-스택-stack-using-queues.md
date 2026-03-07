---
title: "[알고리즘] 큐→스택 (Stack using Queues)"
date: "2025-05-08"
category: "Algorithm"
tags: ["Algorithm", "어댑터", "Problem Solving", "Python", "Java"]
excerpt: "Linked List & Stack/Queue - 큐→스택 (Stack using Queues) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**큐→스택 (Stack using Queues)**
* 파트: Linked List & Stack/Queue
* 관련 알고리즘: 어댑터

> **Architect's View**
> Adapter Pattern과 인터페이스 변환

이 글에서는 큐→스택 (Stack using Queues) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
