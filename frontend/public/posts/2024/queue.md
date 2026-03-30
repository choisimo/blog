---
title: "큐(Queue) 완전 정복"
date: "2024-10-22"
category: "Algorithm"
tags: ['큐', '자료구조', 'FIFO', 'BFS', '알고리즘']
excerpt: "FIFO 구조의 큐 자료구조 개념부터 우선순위 큐까지 완벽 가이드"
readTime: "9분"
published: false
---

# 🚶‍♂️ 큐(Queue) 완전 정복

##  핵심 개념

큐는 **FIFO(First In, First Out)** 원리를 따르는 선형 자료구조입니다. 먼저 들어간 데이터가 가장 먼저 나오는 구조로, 마치 줄을 서서 기다리는 것과 같은 개념입니다.

### 주요 특징
- **FIFO 구조**: 선입선출
- **양쪽 끝에서 연산**: Front에서 삭제, Rear에서 삽입
- **BFS의 핵심**: 그래프 탐색에서 필수적

##  시간복잡도

| 연산 | 시간복잡도 | 설명 |
|------|------------|------|
| enqueue() | O(1) | 큐의 뒤쪽에 원소 추가 |
| dequeue() | O(1) | 큐의 앞쪽에서 원소 제거 및 반환 |
| front() | O(1) | 큐의 앞쪽 원소 확인 |
| rear() | O(1) | 큐의 뒤쪽 원소 확인 |
| empty() | O(1) | 큐가 비어있는지 확인 |
| size() | O(1) | 큐의 크기 반환 |

##  완전한 구현 코드

### 1. 리스트를 이용한 기본 구현
```python
class Queue:
    def __init__(self):
        self.items = []
    
    def enqueue(self, item):
        """큐에 원소 추가 (뒤쪽에 삽입)"""
        self.items.append(item)
    
    def dequeue(self):
        """큐에서 원소 제거 및 반환 (앞쪽에서 제거)"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.items.pop(0)  # O(n) 시간복잡도 주의!
    
    def front(self):
        """큐의 앞쪽 원소 확인"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.items[0]
    
    def rear(self):
        """큐의 뒤쪽 원소 확인"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.items[-1]
    
    def is_empty(self):
        """큐가 비어있는지 확인"""
        return len(self.items) == 0
    
    def size(self):
        """큐 크기 반환"""
        return len(self.items)
    
    def __str__(self):
        return f"Queue({self.items})"

# 사용 예제
queue = Queue()
queue.enqueue(1)
queue.enqueue(2)
queue.enqueue(3)
print(queue)  # Queue([1, 2, 3])
print(queue.dequeue())  # 1
print(queue)  # Queue([2, 3])
```

### 2. collections.deque를 이용한 최적화된 구현
```python
from collections import deque

class OptimizedQueue:
    def __init__(self):
        self.items = deque()
    
    def enqueue(self, item):
        """O(1) 시간에 원소 추가"""
        self.items.append(item)
    
    def dequeue(self):
        """O(1) 시간에 원소 제거"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.items.popleft()
    
    def front(self):
        """큐의 앞쪽 원소 확인"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.items[0]
    
    def rear(self):
        """큐의 뒤쪽 원소 확인"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.items[-1]
    
    def is_empty(self):
        return len(self.items) == 0
    
    def size(self):
        return len(self.items)
    
    def __str__(self):
        return f"Queue({list(self.items)})"

# 성능 비교 예제
import time

def performance_test():
    # 기본 리스트 큐
    basic_queue = Queue()
    start_time = time.time()
    for i in range(10000):
        basic_queue.enqueue(i)
        if i % 2 == 1:
            basic_queue.dequeue()
    basic_time = time.time() - start_time
    
    # 최적화된 큐
    opt_queue = OptimizedQueue()
    start_time = time.time()
    for i in range(10000):
        opt_queue.enqueue(i)
        if i % 2 == 1:
            opt_queue.dequeue()
    opt_time = time.time() - start_time
    
    print(f"Basic Queue: {basic_time:.4f}s")
    print(f"Optimized Queue: {opt_time:.4f}s")
    print(f"Speedup: {basic_time/opt_time:.2f}x")

performance_test()
```

### 3. 연결 리스트를 이용한 구현
```python
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedQueue:
    def __init__(self):
        self.front_node = None
        self.rear_node = None
        self._size = 0
    
    def enqueue(self, data):
        """큐에 원소 추가"""
        new_node = Node(data)
        
        if self.rear_node is None:  # 큐가 비어있는 경우
            self.front_node = self.rear_node = new_node
        else:
            self.rear_node.next = new_node
            self.rear_node = new_node
        
        self._size += 1
    
    def dequeue(self):
        """큐에서 원소 제거"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        
        data = self.front_node.data
        self.front_node = self.front_node.next
        
        if self.front_node is None:  # 큐가 비게 된 경우
            self.rear_node = None
        
        self._size -= 1
        return data
    
    def front(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.front_node.data
    
    def rear(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.rear_node.data
    
    def is_empty(self):
        return self.front_node is None
    
    def size(self):
        return self._size
    
    def display(self):
        """큐 내용 출력"""
        result = []
        current = self.front_node
        while current:
            result.append(current.data)
            current = current.next
        return result

# 사용 예제
linked_queue = LinkedQueue()
for i in range(5):
    linked_queue.enqueue(i)
print(f"Queue: {linked_queue.display()}")  # [0, 1, 2, 3, 4]

while not linked_queue.is_empty():
    print(f"Dequeued: {linked_queue.dequeue()}")
```

### 4. 원형 큐(Circular Queue) 구현
```python
class CircularQueue:
    def __init__(self, capacity):
        self.capacity = capacity
        self.queue = [None] * capacity
        self.front_idx = 0
        self.rear_idx = -1
        self._size = 0
    
    def enqueue(self, item):
        """원형 큐에 원소 추가"""
        if self.is_full():
            raise OverflowError("Queue is full")
        
        self.rear_idx = (self.rear_idx + 1) % self.capacity
        self.queue[self.rear_idx] = item
        self._size += 1
    
    def dequeue(self):
        """원형 큐에서 원소 제거"""
        if self.is_empty():
            raise IndexError("Queue is empty")
        
        item = self.queue[self.front_idx]
        self.queue[self.front_idx] = None
        self.front_idx = (self.front_idx + 1) % self.capacity
        self._size -= 1
        return item
    
    def front(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.queue[self.front_idx]
    
    def rear(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self.queue[self.rear_idx]
    
    def is_empty(self):
        return self._size == 0
    
    def is_full(self):
        return self._size == self.capacity
    
    def size(self):
        return self._size
    
    def display(self):
        """큐 내용 출력 (순서대로)"""
        if self.is_empty():
            return []
        
        result = []
        idx = self.front_idx
        for _ in range(self._size):
            result.append(self.queue[idx])
            idx = (idx + 1) % self.capacity
        return result

# 원형 큐 테스트
circular_queue = CircularQueue(5)
for i in range(5):
    circular_queue.enqueue(i)

print(f"Full queue: {circular_queue.display()}")  # [0, 1, 2, 3, 4]

# 몇 개 제거 후 다시 추가
circular_queue.dequeue()
circular_queue.dequeue()
circular_queue.enqueue(5)
circular_queue.enqueue(6)

print(f"After operations: {circular_queue.display()}")  # [2, 3, 4, 5, 6]
```

##  최적화 팁

### 1. 우선순위 큐 구현
```python
import heapq

class PriorityQueue:
    def __init__(self):
        self.heap = []
        self.entry_count = 0
    
    def enqueue(self, item, priority):
        """우선순위와 함께 원소 추가"""
        # (우선순위, 순서, 데이터) 튜플로 저장
        entry = (priority, self.entry_count, item)
        heapq.heappush(self.heap, entry)
        self.entry_count += 1
    
    def dequeue(self):
        """우선순위가 가장 높은 원소 제거"""
        if self.is_empty():
            raise IndexError("Priority queue is empty")
        priority, count, item = heapq.heappop(self.heap)
        return item
    
    def front(self):
        """우선순위가 가장 높은 원소 확인"""
        if self.is_empty():
            raise IndexError("Priority queue is empty")
        return self.heap[0][2]
    
    def is_empty(self):
        return len(self.heap) == 0
    
    def size(self):
        return len(self.heap)

# 우선순위 큐 사용 예제
pq = PriorityQueue()
pq.enqueue("Low priority task", 3)
pq.enqueue("High priority task", 1)
pq.enqueue("Medium priority task", 2)

while not pq.is_empty():
    print(pq.dequeue())
# 출력: High priority task, Medium priority task, Low priority task
```

### 2. 멀티스레드 안전 큐
```python
import threading
from queue import Queue as ThreadSafeQueue

class ThreadSafeQueueWrapper:
    def __init__(self):
        self.queue = ThreadSafeQueue()
    
    def enqueue(self, item):
        self.queue.put(item)
    
    def dequeue(self, timeout=None):
        """timeout 시간 내에 데이터가 없으면 예외 발생"""
        try:
            return self.queue.get(timeout=timeout)
        except:
            raise IndexError("Queue is empty or timeout")
    
    def is_empty(self):
        return self.queue.empty()
    
    def size(self):
        return self.queue.qsize()

# 멀티스레드 환경에서 안전한 큐 사용
def producer(queue, name, count):
    for i in range(count):
        queue.enqueue(f"{name}-{i}")
        print(f"Produced: {name}-{i}")

def consumer(queue, name, count):
    for _ in range(count):
        try:
            item = queue.dequeue(timeout=1)
            print(f"Consumed by {name}: {item}")
        except IndexError:
            print(f"{name}: Queue is empty or timeout")

# 스레드 안전 큐 테스트
safe_queue = ThreadSafeQueueWrapper()

producer_thread = threading.Thread(target=producer, args=(safe_queue, "Producer1", 5))
consumer_thread = threading.Thread(target=consumer, args=(safe_queue, "Consumer1", 5))

producer_thread.start()
consumer_thread.start()

producer_thread.join()
consumer_thread.join()
```

##  실전 예제

### 1. BFS (너비 우선 탐색)
```python
from collections import deque

def bfs(graph, start):
    """그래프에서 BFS 수행"""
    visited = set()
    queue = deque([start])
    visited.add(start)
    result = []
    
    while queue:
        vertex = queue.popleft()
        result.append(vertex)
        
        # 인접한 정점들을 큐에 추가
        for neighbor in graph[vertex]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    
    return result

# 그래프 예제
graph = {
    'A': ['B', 'C'],
    'B': ['A', 'D', 'E'],
    'C': ['A', 'F'],
    'D': ['B'],
    'E': ['B', 'F'],
    'F': ['C', 'E']
}

print(f"BFS traversal: {bfs(graph, 'A')}")  # ['A', 'B', 'C', 'D', 'E', 'F']
```

### 2. 미로 탐색 (최단 경로)
```python
from collections import deque

def solve_maze(maze, start, end):
    """미로에서 최단 경로 찾기"""
    rows, cols = len(maze), len(maze[0])
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # 우, 하, 좌, 상
    
    queue = deque([(start[0], start[1], 0)])  # (x, y, distance)
    visited = set([start])
    
    while queue:
        x, y, dist = queue.popleft()
        
        if (x, y) == end:
            return dist
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            
            if (0 <= nx < rows and 0 <= ny < cols and 
                maze[nx][ny] == 0 and (nx, ny) not in visited):
                visited.add((nx, ny))
                queue.append((nx, ny, dist + 1))
    
    return -1  # 경로가 없는 경우

# 미로 예제 (0: 길, 1: 벽)
maze = [
    [0, 1, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [1, 1, 0, 0, 0],
    [0, 0, 0, 1, 0]
]

start = (0, 0)
end = (4, 4)
distance = solve_maze(maze, start, end)
print(f"Shortest path distance: {distance}")  # 8
```

### 3. 프로세스 스케줄링 시뮬레이션
```python
from collections import deque

class Process:
    def __init__(self, pid, burst_time, arrival_time=0):
        self.pid = pid
        self.burst_time = burst_time
        self.arrival_time = arrival_time
        self.remaining_time = burst_time
        self.completion_time = 0
        self.waiting_time = 0
        self.turnaround_time = 0

def round_robin_scheduling(processes, quantum):
    """라운드 로빈 스케줄링 시뮬레이션"""
    queue = deque()
    current_time = 0
    completed = []
    
    # 프로세스들을 도착 시간 순으로 정렬
    processes.sort(key=lambda p: p.arrival_time)
    process_index = 0
    
    while process_index < len(processes) or queue:
        # 현재 시간에 도착한 프로세스들을 큐에 추가
        while (process_index < len(processes) and 
               processes[process_index].arrival_time <= current_time):
            queue.append(processes[process_index])
            process_index += 1
        
        if queue:
            current_process = queue.popleft()
            
            # 실행 시간 계산
            execution_time = min(quantum, current_process.remaining_time)
            current_time += execution_time
            current_process.remaining_time -= execution_time
            
            print(f"Time {current_time - execution_time}-{current_time}: "
                  f"Process {current_process.pid} executed")
            
            # 새로 도착한 프로세스들을 큐에 추가
            while (process_index < len(processes) and 
                   processes[process_index].arrival_time <= current_time):
                queue.append(processes[process_index])
                process_index += 1
            
            # 프로세스가 완료되지 않았으면 다시 큐에 추가
            if current_process.remaining_time > 0:
                queue.append(current_process)
            else:
                # 프로세스 완료
                current_process.completion_time = current_time
                current_process.turnaround_time = (
                    current_process.completion_time - current_process.arrival_time
                )
                current_process.waiting_time = (
                    current_process.turnaround_time - current_process.burst_time
                )
                completed.append(current_process)
        else:
            current_time += 1
    
    # 결과 출력
    print("\nProcess scheduling results:")
    print("PID\tBurst\tArrival\tCompletion\tTurnaround\tWaiting")
    for p in completed:
        print(f"{p.pid}\t{p.burst_time}\t{p.arrival_time}\t"
              f"{p.completion_time}\t\t{p.turnaround_time}\t\t{p.waiting_time}")

# 라운드 로빈 스케줄링 테스트
processes = [
    Process(1, 5, 0),
    Process(2, 3, 1),
    Process(3, 8, 2),
    Process(4, 6, 3)
]

round_robin_scheduling(processes, 2)
```

### 4. 큐를 이용한 이진 트리 레벨 순회
```python
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def level_order_traversal(root):
    """이진 트리 레벨 순회"""
    if not root:
        return []
    
    result = []
    queue = deque([root])
    
    while queue:
        level_size = len(queue)
        current_level = []
        
        for _ in range(level_size):
            node = queue.popleft()
            current_level.append(node.val)
            
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        
        result.append(current_level)
    
    return result

# 이진 트리 예제
#       3
#      / \
#     9   20
#        /  \
#       15   7

root = TreeNode(3)
root.left = TreeNode(9)
root.right = TreeNode(20)
root.right.left = TreeNode(15)
root.right.right = TreeNode(7)

levels = level_order_traversal(root)
print("Level order traversal:")
for i, level in enumerate(levels):
    print(f"Level {i}: {level}")
# Output:
# Level 0: [3]
# Level 1: [9, 20]
# Level 2: [15, 7]
```

##  큐의 다양한 응용

### 1. 슬라이딩 윈도우 최댓값
```python
from collections import deque

def sliding_window_maximum(nums, k):
    """슬라이딩 윈도우에서 최댓값 찾기"""
    if not nums or k == 0:
        return []
    
    dq = deque()  # 인덱스를 저장하는 덱
    result = []
    
    for i in range(len(nums)):
        # 윈도우 범위를 벗어난 인덱스 제거
        while dq and dq[0] <= i - k:
            dq.popleft()
        
        # 현재 원소보다 작은 원소들의 인덱스 제거
        while dq and nums[dq[-1]] <= nums[i]:
            dq.pop()
        
        dq.append(i)
        
        # 윈도우가 완성되면 결과에 추가
        if i >= k - 1:
            result.append(nums[dq[0]])
    
    return result

# 테스트
nums = [1, 3, -1, -3, 5, 3, 6, 7]
k = 3
result = sliding_window_maximum(nums, k)
print(f"Sliding window maximum: {result}")  # [3, 3, 5, 5, 6, 7]
```

### 2. 큐를 이용한 캐시 구현 (LRU Cache)
```python
from collections import deque

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.cache = {}  # key -> value 매핑
        self.queue = deque()  # 사용 순서 추적
    
    def get(self, key):
        """캐시에서 값 조회"""
        if key in self.cache:
            # 최근 사용으로 업데이트
            self.queue.remove(key)
            self.queue.append(key)
            return self.cache[key]
        return -1
    
    def put(self, key, value):
        """캐시에 값 저장"""
        if key in self.cache:
            # 기존 키 업데이트
            self.cache[key] = value
            self.queue.remove(key)
            self.queue.append(key)
        else:
            # 새로운 키 추가
            if len(self.cache) >= self.capacity:
                # 가장 오래된 항목 제거
                oldest = self.queue.popleft()
                del self.cache[oldest]
            
            self.cache[key] = value
            self.queue.append(key)
    
    def display(self):
        """현재 캐시 상태 출력"""
        return [(key, self.cache[key]) for key in self.queue]

# LRU 캐시 테스트
lru = LRUCache(3)
lru.put(1, "A")
lru.put(2, "B")
lru.put(3, "C")
print(f"Cache: {lru.display()}")  # [(1, 'A'), (2, 'B'), (3, 'C')]

lru.get(1)  # A를 최근 사용으로 이동
lru.put(4, "D")  # B가 제거되고 D 추가
print(f"Cache: {lru.display()}")  # [(3, 'C'), (1, 'A'), (4, 'D')]
```

## 🎖️ 레벨별 연습 문제

### 🥉 초급
- BOJ 10845: 큐
- BOJ 2164: 카드2
- BOJ 1158: 요세푸스 문제

### 🥈 중급
- BOJ 2178: 미로 탐색
- BOJ 7576: 토마토
- BOJ 1966: 프린터 큐

### 🥇 고급
- BOJ 5430: AC
- BOJ 13913: 숨바꼭질 4
- BOJ 11003: 최솟값 찾기

---

**이전 학습**: [스택(Stack) 완전 정복](../stack/) ⬅️
**다음 학습**: [덱(Deque) 완전 정복](../deque/) 

큐는 **BFS, 레벨 순회, 스케줄링** 등에서 핵심적인 역할을 하는 자료구조입니다. 특히 그래프 알고리즘에서는 필수입니다!