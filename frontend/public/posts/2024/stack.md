---
title: "스택(Stack) 완전 정복"
date: "2024-10-15"
category: "Algorithm"
tags: ['스택', '자료구조', 'LIFO', '알고리즘']
excerpt: "LIFO 구조의 스택 자료구조 개념부터 실전 활용까지 완벽 가이드"
readTime: "6분"
published: false
---

#  스택(Stack) 완전 정복

##  핵심 개념

스택은 **LIFO(Last In, First Out)** 원리를 따르는 선형 자료구조입니다. 마지막에 들어간 데이터가 가장 먼저 나오는 구조로, 접시를 쌓아놓은 것과 같은 개념입니다.

### 주요 특징
- **LIFO 구조**: 후입선출
- **한쪽 끝에서만 삽입/삭제**: Top에서만 연산 수행
- **순서 보장**: 삽입된 순서의 역순으로 데이터 접근

##  시간복잡도

| 연산 | 시간복잡도 | 설명 |
|------|------------|------|
| push() | O(1) | 스택 맨 위에 원소 추가 |
| pop() | O(1) | 스택 맨 위 원소 제거 및 반환 |
| top() | O(1) | 스택 맨 위 원소 확인 |
| empty() | O(1) | 스택이 비어있는지 확인 |
| size() | O(1) | 스택의 크기 반환 |

##  완전한 구현 코드

### Python 리스트를 이용한 구현
```python
class Stack:
    def __init__(self):
        self.items = []
    
    def push(self, item):
        """스택에 원소 추가"""
        self.items.append(item)
    
    def pop(self):
        """스택에서 원소 제거 및 반환"""
        if self.is_empty():
            raise IndexError("Stack is empty")
        return self.items.pop()
    
    def top(self):
        """스택 맨 위 원소 확인 (제거하지 않음)"""
        if self.is_empty():
            raise IndexError("Stack is empty")
        return self.items[-1]
    
    def is_empty(self):
        """스택이 비어있는지 확인"""
        return len(self.items) == 0
    
    def size(self):
        """스택 크기 반환"""
        return len(self.items)
    
    def __str__(self):
        """스택을 문자열로 표현"""
        return f"Stack({self.items})"

# 사용 예제
if __name__ == "__main__":
    stack = Stack()
    
    # 데이터 추가
    stack.push(1)
    stack.push(2)
    stack.push(3)
    print(f"Stack after pushes: {stack}")  # Stack([1, 2, 3])
    
    # 맨 위 원소 확인
    print(f"Top element: {stack.top()}")  # 3
    
    # 데이터 제거
    popped = stack.pop()
    print(f"Popped element: {popped}")  # 3
    print(f"Stack after pop: {stack}")  # Stack([1, 2])
    
    # 크기 확인
    print(f"Stack size: {stack.size()}")  # 2
```

### 연결 리스트를 이용한 구현
```python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedStack:
    def __init__(self):
        self.head = None
        self._size = 0
    
    def push(self, data):
        """스택에 원소 추가"""
        new_node = Node(data)
        new_node.next = self.head
        self.head = new_node
        self._size += 1
    
    def pop(self):
        """스택에서 원소 제거 및 반환"""
        if self.is_empty():
            raise IndexError("Stack is empty")
        
        data = self.head.data
        self.head = self.head.next
        self._size -= 1
        return data
    
    def top(self):
        """스택 맨 위 원소 확인"""
        if self.is_empty():
            raise IndexError("Stack is empty")
        return self.head.data
    
    def is_empty(self):
        """스택이 비어있는지 확인"""
        return self.head is None
    
    def size(self):
        """스택 크기 반환"""
        return self._size
    
    def display(self):
        """스택 내용 출력"""
        result = []
        current = self.head
        while current:
            result.append(current.data)
            current = current.next
        return result

# 사용 예제
linked_stack = LinkedStack()
linked_stack.push(10)
linked_stack.push(20)
linked_stack.push(30)
print(f"LinkedStack: {linked_stack.display()}")  # [30, 20, 10]
```

##  최적화 팁

### 1. 메모리 효율성
```python
class FixedSizeStack:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = [None] * capacity
        self.top_index = -1
    
    def push(self, item):
        if self.top_index >= self.capacity - 1:
            raise OverflowError("Stack overflow")
        self.top_index += 1
        self.items[self.top_index] = item
    
    def pop(self):
        if self.top_index < 0:
            raise IndexError("Stack underflow")
        item = self.items[self.top_index]
        self.items[self.top_index] = None  # 메모리 해제
        self.top_index -= 1
        return item
```

### 2. Python 내장 collections.deque 활용
```python
from collections import deque

class DequeStack:
    def __init__(self):
        self.stack = deque()
    
    def push(self, item):
        self.stack.append(item)
    
    def pop(self):
        if not self.stack:
            raise IndexError("Stack is empty")
        return self.stack.pop()
    
    def top(self):
        if not self.stack:
            raise IndexError("Stack is empty")
        return self.stack[-1]
    
    def is_empty(self):
        return len(self.stack) == 0
```

##  실전 예제

### 1. 괄호 검사 (BOJ 9012)
```python
def is_valid_parentheses(s):
    """올바른 괄호 문자열인지 검사"""
    stack = []
    
    for char in s:
        if char == '(':
            stack.append(char)
        elif char == ')':
            if not stack:
                return False
            stack.pop()
    
    return len(stack) == 0

# 테스트
test_cases = ["(()())", "((()))", "(())())", "(()", "())"]
for case in test_cases:
    result = is_valid_parentheses(case)
    print(f"{case}: {'Valid' if result else 'Invalid'}")
```

### 2. 스택 수열 (BOJ 1874)
```python
def stack_sequence(target):
    """스택으로 주어진 수열을 만들 수 있는지 확인"""
    stack = []
    operations = []
    current = 1
    
    for num in target:
        # 목표 숫자까지 스택에 push
        while current <= num:
            stack.append(current)
            operations.append('+')
            current += 1
        
        # 스택 top이 목표 숫자와 같으면 pop
        if stack and stack[-1] == num:
            stack.pop()
            operations.append('-')
        else:
            return None  # 불가능한 경우
    
    return operations

# 테스트
sequence = [4, 3, 6, 8, 7, 5, 2, 1]
result = stack_sequence(sequence)
if result:
    for op in result:
        print(op)
else:
    print("NO")
```

### 3. 히스토그램에서 가장 큰 직사각형 (BOJ 6549)
```python
def largest_rectangle_in_histogram(heights):
    """히스토그램에서 가장 큰 직사각형의 넓이"""
    stack = []
    max_area = 0
    
    for i, height in enumerate(heights):
        # 현재 높이보다 높은 막대들을 처리
        while stack and heights[stack[-1]] > height:
            h = heights[stack.pop()]
            w = i if not stack else i - stack[-1] - 1
            max_area = max(max_area, h * w)
        
        stack.append(i)
    
    # 남은 막대들 처리
    while stack:
        h = heights[stack.pop()]
        w = len(heights) if not stack else len(heights) - stack[-1] - 1
        max_area = max(max_area, h * w)
    
    return max_area

# 테스트
heights = [2, 1, 5, 6, 2, 3]
print(f"Maximum area: {largest_rectangle_in_histogram(heights)}")  # 10
```

##  스택의 다양한 응용

### 1. 계산기 구현 (후위 표기법)
```python
def evaluate_postfix(expression):
    """후위 표기법 수식 계산"""
    stack = []
    operators = {'+', '-', '*', '/'}
    
    for token in expression.split():
        if token not in operators:
            stack.append(int(token))
        else:
            b = stack.pop()
            a = stack.pop()
            
            if token == '+':
                result = a + b
            elif token == '-':
                result = a - b
            elif token == '*':
                result = a * b
            elif token == '/':
                result = int(a / b)  # 정수 나눗셈
            
            stack.append(result)
    
    return stack[0]

# 테스트: "3 4 + 2 * 7 /" = ((3 + 4) * 2) / 7 = 2
print(evaluate_postfix("3 4 + 2 * 7 /"))  # 2
```

### 2. 중위 표기법을 후위 표기법으로 변환
```python
def infix_to_postfix(expression):
    """중위 표기법을 후위 표기법으로 변환"""
    precedence = {'+': 1, '-': 1, '*': 2, '/': 2, '^': 3}
    stack = []
    postfix = []
    
    for char in expression:
        if char.isalnum():  # 피연산자
            postfix.append(char)
        elif char == '(':
            stack.append(char)
        elif char == ')':
            while stack and stack[-1] != '(':
                postfix.append(stack.pop())
            stack.pop()  # '(' 제거
        else:  # 연산자
            while (stack and stack[-1] != '(' and
                   stack[-1] in precedence and
                   precedence[stack[-1]] >= precedence[char]):
                postfix.append(stack.pop())
            stack.append(char)
    
    # 남은 연산자들 처리
    while stack:
        postfix.append(stack.pop())
    
    return ''.join(postfix)

# 테스트
print(infix_to_postfix("A+B*C"))      # ABC*+
print(infix_to_postfix("(A+B)*C"))    # AB+C*
```

### 3. 함수 호출 스택 시뮬레이션
```python
class CallStack:
    def __init__(self):
        self.stack = []
    
    def call_function(self, func_name, params=None):
        """함수 호출"""
        frame = {
            'function': func_name,
            'parameters': params or {},
            'local_vars': {}
        }
        self.stack.append(frame)
        print(f"Calling {func_name}({params})")
    
    def return_function(self, return_value=None):
        """함수 반환"""
        if self.stack:
            frame = self.stack.pop()
            print(f"Returning from {frame['function']} with value: {return_value}")
        else:
            print("No function to return from")
    
    def print_stack_trace(self):
        """스택 트레이스 출력"""
        print("Stack Trace:")
        for i, frame in enumerate(reversed(self.stack)):
            print(f"  {i}: {frame['function']}({frame['parameters']})")

# 재귀 함수 팩토리얼 시뮬레이션
def factorial_simulation(n):
    call_stack = CallStack()
    
    def factorial(n):
        call_stack.call_function('factorial', {'n': n})
        
        if n <= 1:
            call_stack.return_function(1)
            return 1
        else:
            result = n * factorial(n - 1)
            call_stack.return_function(result)
            return result
    
    result = factorial(4)
    print(f"Final result: {result}")

factorial_simulation(4)
```

## 🎖️ 레벨별 연습 문제

### 🥉 초급
- BOJ 10828: 스택
- BOJ 9012: 괄호
- BOJ 4949: 균형잡힌 세상

### 🥈 중급  
- BOJ 1874: 스택 수열
- BOJ 17298: 오큰수
- BOJ 3986: 좋은 단어

### 🥇 고급
- BOJ 6549: 히스토그램에서 가장 큰 직사각형
- BOJ 2493: 탑
- BOJ 1918: 후위 표기식

---

**다음 학습**: [큐(Queue) 완전 정복](../queue/) 

스택은 **재귀, 백트래킹, 파싱** 등 다양한 알고리즘의 핵심이 되는 자료구조입니다. 완벽하게 이해하고 넘어가세요!