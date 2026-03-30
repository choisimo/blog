---
title: "BFS (너비 우선 탐색) 완전 정복"
date: "2024-11-15"
category: "Algorithm"
tags: ['BFS', '그래프', '탐색', '최단경로', '알고리즘']
excerpt: "큐를 이용한 레벨별 그래프 탐색과 최단 경로 알고리즘의 핵심"
readTime: "11분"
published: false
---

# 🌊 BFS (너비 우선 탐색) 완전 정복

##  핵심 개념

BFS(Breadth-First Search)는 **큐(Queue)**를 사용하여 그래프를 **레벨별로 탐색**하는 알고리즘입니다. 시작 정점에서 가까운 정점부터 차례대로 방문하며, **가중치가 없는 그래프에서 최단 경로**를 찾는 데 사용됩니다.

### 알고리즘 동작 과정
1. **시작 정점 삽입**: 시작 정점을 큐에 넣고 방문 표시
2. **큐에서 정점 제거**: 큐의 앞에서 정점을 하나 꺼냄  
3. **인접 정점 탐색**: 꺼낸 정점의 모든 인접 정점 확인
4. **미방문 정점 추가**: 아직 방문하지 않은 인접 정점들을 큐에 추가
5. **반복**: 큐가 빌 때까지 2-4 과정 반복

##  시간복잡도

| 그래프 표현 | 시간복잡도 | 공간복잡도 |
|-------------|------------|------------|
| **인접 리스트** | O(V + E) | O(V) |
| **인접 행렬** | O(V²) | O(V) |

- V: 정점의 수, E: 간선의 수

##  완전한 구현 코드

### 1. 기본 BFS 구현
```python
from collections import deque

def bfs_basic(graph, start):
    """기본 BFS 구현"""
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

# 그래프 예제 (인접 리스트)
graph_example = {
    'A': ['B', 'C'],
    'B': ['A', 'D', 'E'],
    'C': ['A', 'F'],
    'D': ['B'],
    'E': ['B', 'F'],
    'F': ['C', 'E']
}

print("=== Basic BFS ===")
bfs_result = bfs_basic(graph_example, 'A')
print(f"BFS traversal from 'A': {bfs_result}")
```

### 2. 상세한 과정을 보여주는 BFS
```python
def bfs_detailed(graph, start):
    """BFS 탐색 과정을 상세히 출력"""
    visited = set()
    queue = deque([start])
    visited.add(start)
    level = 0
    
    print(f"Starting BFS from vertex '{start}'")
    print(f"Initial queue: {list(queue)}")
    
    while queue:
        level_size = len(queue)
        current_level = []
        
        print(f"\n--- Level {level} ---")
        print(f"Queue at start of level: {list(queue)}")
        
        # 현재 레벨의 모든 정점 처리
        for _ in range(level_size):
            vertex = queue.popleft()
            current_level.append(vertex)
            
            print(f"Processing vertex '{vertex}'")
            print(f"  Neighbors: {graph[vertex]}")
            
            # 인접한 정점들 확인
            new_neighbors = []
            for neighbor in graph[vertex]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
                    new_neighbors.append(neighbor)
            
            if new_neighbors:
                print(f"  Added to queue: {new_neighbors}")
            else:
                print(f"  No new neighbors to add")
        
        print(f"Vertices processed at level {level}: {current_level}")
        print(f"Queue after level {level}: {list(queue)}")
        level += 1
    
    print(f"\nBFS completed! Total levels: {level}")

# 상세한 BFS 실행
print("=== Detailed BFS Process ===")
bfs_detailed(graph_example, 'A')
```

### 3. 최단 경로를 기록하는 BFS
```python
def bfs_shortest_path(graph, start, end):
    """두 정점 사이의 최단 경로 찾기"""
    if start == end:
        return [start]
    
    visited = set([start])
    queue = deque([(start, [start])])  # (현재 정점, 경로)
    
    while queue:
        vertex, path = queue.popleft()
        
        for neighbor in graph[vertex]:
            if neighbor not in visited:
                new_path = path + [neighbor]
                
                if neighbor == end:
                    return new_path
                
                visited.add(neighbor)
                queue.append((neighbor, new_path))
    
    return None  # 경로가 없는 경우

def bfs_all_shortest_paths(graph, start):
    """시작 정점에서 모든 정점까지의 최단 경로"""
    distances = {start: 0}
    parents = {start: None}
    queue = deque([start])
    
    while queue:
        vertex = queue.popleft()
        
        for neighbor in graph[vertex]:
            if neighbor not in distances:
                distances[neighbor] = distances[vertex] + 1
                parents[neighbor] = vertex
                queue.append(neighbor)
    
    return distances, parents

def reconstruct_path(parents, start, end):
    """부모 정보로부터 경로 재구성"""
    if end not in parents:
        return None
    
    path = []
    current = end
    
    while current is not None:
        path.append(current)
        current = parents[current]
    
    return path[::-1]

# 최단 경로 테스트
print("\n=== Shortest Path BFS ===")
path = bfs_shortest_path(graph_example, 'A', 'F')
print(f"Shortest path from A to F: {path}")

distances, parents = bfs_all_shortest_paths(graph_example, 'A')
print(f"Distances from A: {distances}")

for vertex in graph_example:
    if vertex != 'A':
        path = reconstruct_path(parents, 'A', vertex)
        print(f"Path to {vertex}: {path} (distance: {distances[vertex]})")
```

### 4. 2D 그리드에서의 BFS
```python
def bfs_grid(grid, start, end):
    """2D 그리드에서 BFS로 최단 경로 찾기"""
    if not grid or not grid[0]:
        return -1
    
    rows, cols = len(grid), len(grid[0])
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
                grid[nx][ny] == 0 and (nx, ny) not in visited):
                visited.add((nx, ny))
                queue.append((nx, ny, dist + 1))
    
    return -1  # 경로가 없는 경우

def bfs_grid_with_path(grid, start, end):
    """경로까지 함께 반환하는 그리드 BFS"""
    if not grid or not grid[0]:
        return -1, []
    
    rows, cols = len(grid), len(grid[0])
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    queue = deque([(start[0], start[1], 0, [start])])  # (x, y, dist, path)
    visited = set([start])
    
    while queue:
        x, y, dist, path = queue.popleft()
        
        if (x, y) == end:
            return dist, path
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            
            if (0 <= nx < rows and 0 <= ny < cols and 
                grid[nx][ny] == 0 and (nx, ny) not in visited):
                visited.add((nx, ny))
                queue.append((nx, ny, dist + 1, path + [(nx, ny)]))
    
    return -1, []

# 그리드 BFS 테스트
print("\n=== Grid BFS ===")
# 0: 이동 가능, 1: 벽
maze = [
    [0, 1, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [1, 1, 0, 0, 0],
    [0, 0, 0, 1, 0]
]

start_pos = (0, 0)
end_pos = (4, 4)

print("Maze (0: path, 1: wall):")
for row in maze:
    print(row)

distance = bfs_grid(maze, start_pos, end_pos)
print(f"Shortest distance from {start_pos} to {end_pos}: {distance}")

dist_with_path, path = bfs_grid_with_path(maze, start_pos, end_pos)
print(f"Path: {path}")
```

### 5. 레벨별 BFS (레벨 순회)
```python
def bfs_level_order(graph, start):
    """레벨별로 정점들을 그룹화하여 반환"""
    if not graph or start not in graph:
        return []
    
    visited = set([start])
    queue = deque([start])
    levels = []
    
    while queue:
        level_size = len(queue)
        current_level = []
        
        for _ in range(level_size):
            vertex = queue.popleft()
            current_level.append(vertex)
            
            for neighbor in graph[vertex]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        
        levels.append(current_level)
    
    return levels

# 이진 트리에서의 레벨 순회
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def bfs_binary_tree(root):
    """이진 트리의 레벨 순회"""
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

# 레벨별 BFS 테스트
print("\n=== Level Order BFS ===")
levels = bfs_level_order(graph_example, 'A')
print("Graph levels:")
for i, level in enumerate(levels):
    print(f"Level {i}: {level}")

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

tree_levels = bfs_binary_tree(root)
print("\nBinary tree levels:")
for i, level in enumerate(tree_levels):
    print(f"Level {i}: {level}")
```

##  고급 응용

### 1. 다중 소스 BFS
```python
def multi_source_bfs(grid, sources):
    """여러 시작점에서 동시에 BFS 수행"""
    if not grid or not grid[0]:
        return []
    
    rows, cols = len(grid), len(grid[0])
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    # 모든 소스를 큐에 추가
    queue = deque()
    distances = [[-1] * cols for _ in range(rows)]
    
    for x, y in sources:
        queue.append((x, y, 0))
        distances[x][y] = 0
    
    while queue:
        x, y, dist = queue.popleft()
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            
            if (0 <= nx < rows and 0 <= ny < cols and 
                distances[nx][ny] == -1):  # 아직 방문하지 않은 경우
                distances[nx][ny] = dist + 1
                queue.append((nx, ny, dist + 1))
    
    return distances

# 다중 소스 BFS 테스트 (썩은 토마토 문제)
def oranges_rotting(grid):
    """썩은 오렌지가 퍼지는 시간 계산"""
    if not grid or not grid[0]:
        return 0
    
    rows, cols = len(grid), len(grid[0])
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    queue = deque()
    fresh_count = 0
    
    # 초기 썩은 오렌지들을 큐에 추가하고 신선한 오렌지 개수 계산
    for i in range(rows):
        for j in range(cols):
            if grid[i][j] == 2:  # 썩은 오렌지
                queue.append((i, j, 0))
            elif grid[i][j] == 1:  # 신선한 오렌지
                fresh_count += 1
    
    max_time = 0
    
    while queue:
        x, y, time = queue.popleft()
        max_time = max(max_time, time)
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            
            if (0 <= nx < rows and 0 <= ny < cols and grid[nx][ny] == 1):
                grid[nx][ny] = 2  # 썩게 만들기
                fresh_count -= 1
                queue.append((nx, ny, time + 1))
    
    return max_time if fresh_count == 0 else -1

print("\n=== Multi-source BFS ===")
# 0: 빈칸, 1: 신선한 오렌지, 2: 썩은 오렌지
oranges = [
    [2, 1, 1],
    [1, 1, 0],
    [0, 1, 1]
]

print("Initial oranges grid:")
for row in oranges:
    print(row)

time_needed = oranges_rotting([row[:] for row in oranges])  # 복사본 사용
print(f"Time to rot all oranges: {time_needed}")
```

### 2. 0-1 BFS (가중치가 0 또는 1인 경우)
```python
from collections import deque

def zero_one_bfs(graph, start, end):
    """가중치가 0 또는 1인 그래프에서 최단 경로"""
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    deque_queue = deque([start])
    
    while deque_queue:
        vertex = deque_queue.popleft()
        
        for neighbor, weight in graph[vertex]:
            new_dist = distances[vertex] + weight
            
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                
                if weight == 0:
                    deque_queue.appendleft(neighbor)  # 가중치 0은 앞에 추가
                else:
                    deque_queue.append(neighbor)      # 가중치 1은 뒤에 추가
    
    return distances[end] if distances[end] != float('inf') else -1

# 0-1 BFS 그래프 예제
zero_one_graph = {
    'A': [('B', 0), ('C', 1)],
    'B': [('D', 1), ('E', 0)],
    'C': [('F', 0)],
    'D': [('F', 0)],
    'E': [('F', 1)],
    'F': []
}

print("\n=== 0-1 BFS ===")
shortest_dist = zero_one_bfs(zero_one_graph, 'A', 'F')
print(f"Shortest distance from A to F: {shortest_dist}")
```

### 3. 양방향 BFS
```python
def bidirectional_bfs(graph, start, end):
    """양방향 BFS로 최단 경로 찾기"""
    if start == end:
        return 0
    
    # 두 방향에서 시작
    visited_start = {start: 0}
    visited_end = {end: 0}
    queue_start = deque([start])
    queue_end = deque([end])
    
    while queue_start or queue_end:
        # 시작점에서 한 단계 확장
        if queue_start:
            vertex = queue_start.popleft()
            for neighbor in graph[vertex]:
                if neighbor in visited_end:
                    return visited_start[vertex] + 1 + visited_end[neighbor]
                
                if neighbor not in visited_start:
                    visited_start[neighbor] = visited_start[vertex] + 1
                    queue_start.append(neighbor)
        
        # 끝점에서 한 단계 확장
        if queue_end:
            vertex = queue_end.popleft()
            for neighbor in graph[vertex]:
                if neighbor in visited_start:
                    return visited_end[vertex] + 1 + visited_start[neighbor]
                
                if neighbor not in visited_end:
                    visited_end[neighbor] = visited_end[vertex] + 1
                    queue_end.append(neighbor)
    
    return -1  # 경로가 없는 경우

print("\n=== Bidirectional BFS ===")
bi_distance = bidirectional_bfs(graph_example, 'A', 'F')
print(f"Bidirectional BFS distance from A to F: {bi_distance}")
```

##  실전 예제

### 1. 단어 사다리 (Word Ladder)
```python
def word_ladder(begin_word, end_word, word_list):
    """한 글자씩 바꿔가며 단어를 변환하는 최소 단계"""
    if end_word not in word_list:
        return 0
    
    word_set = set(word_list)
    queue = deque([(begin_word, 1)])
    visited = set([begin_word])
    
    while queue:
        word, steps = queue.popleft()
        
        if word == end_word:
            return steps
        
        # 한 글자씩 변경해보기
        for i in range(len(word)):
            for c in 'abcdefghijklmnopqrstuvwxyz':
                new_word = word[:i] + c + word[i+1:]
                
                if new_word in word_set and new_word not in visited:
                    visited.add(new_word)
                    queue.append((new_word, steps + 1))
    
    return 0

# 단어 사다리 테스트
print("\n=== Word Ladder ===")
word_list = ["hot", "dot", "dog", "lot", "log", "cog"]
begin = "hit"
end = "cog"

steps = word_ladder(begin, end, word_list)
print(f"Minimum steps from '{begin}' to '{end}': {steps}")
```

### 2. 연결 컴포넌트 찾기
```python
def find_connected_components(graph):
    """그래프의 모든 연결 컴포넌트 찾기"""
    visited = set()
    components = []
    
    for vertex in graph:
        if vertex not in visited:
            component = []
            queue = deque([vertex])
            visited.add(vertex)
            
            while queue:
                current = queue.popleft()
                component.append(current)
                
                for neighbor in graph[current]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            
            components.append(component)
    
    return components

# 연결 컴포넌트 테스트
disconnected_graph = {
    'A': ['B', 'C'],
    'B': ['A'],
    'C': ['A'],
    'D': ['E'],
    'E': ['D', 'F'],
    'F': ['E'],
    'G': ['H'],
    'H': ['G'],
    'I': []
}

print("\n=== Connected Components ===")
components = find_connected_components(disconnected_graph)
print("Connected components:")
for i, component in enumerate(components):
    print(f"Component {i+1}: {component}")
```

### 3. 미로에서 벽 부수기
```python
def bfs_with_wall_breaking(grid, max_breaks):
    """벽을 최대 max_breaks만큼 부수며 최단 경로 찾기"""
    if not grid or not grid[0]:
        return -1
    
    rows, cols = len(grid), len(grid[0])
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    # (x, y, breaks_used, distance)
    queue = deque([(0, 0, 0, 0)])
    # visited[x][y][breaks] = 해당 위치에 breaks만큼 벽을 부수고 도달했는지
    visited = set([(0, 0, 0)])
    
    while queue:
        x, y, breaks, dist = queue.popleft()
        
        # 목표 지점 도달
        if x == rows - 1 and y == cols - 1:
            return dist
        
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            
            if 0 <= nx < rows and 0 <= ny < cols:
                new_breaks = breaks
                
                # 벽인 경우 부수기
                if grid[nx][ny] == 1:
                    new_breaks += 1
                
                # 벽을 부수는 횟수가 제한을 넘지 않고, 방문하지 않은 상태인 경우
                if (new_breaks <= max_breaks and 
                    (nx, ny, new_breaks) not in visited):
                    visited.add((nx, ny, new_breaks))
                    queue.append((nx, ny, new_breaks, dist + 1))
    
    return -1

# 벽 부수기 테스트
print("\n=== Wall Breaking BFS ===")
wall_maze = [
    [0, 1, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 0, 0],
    [0, 0, 0, 0]
]

print("Maze (0: path, 1: wall):")
for row in wall_maze:
    print(row)

for max_breaks in range(3):
    result = bfs_with_wall_breaking(wall_maze, max_breaks)
    print(f"With {max_breaks} wall breaks: {result}")
```

##  BFS vs DFS 비교

| 특징 | BFS | DFS |
|------|-----|-----|
| **자료구조** | 큐(Queue) | 스택(Stack) 또는 재귀 |
| **탐색 순서** | 레벨별 (너비 우선) | 깊이 우선 |
| **메모리 사용** | O(최대 너비) | O(최대 깊이) |
| **최단 경로** | ✅ 보장 (가중치 없는 그래프) | ❌ 보장하지 않음 |
| **사용 사례** | 최단 경로, 레벨 순회 | 경로 존재 여부, 백트래킹 |

## 🎖️ 레벨별 연습 문제

### 🥉 초급
- BOJ 1260: DFS와 BFS
- BOJ 2178: 미로 탐색
- BOJ 7576: 토마토

### 🥈 중급
- BOJ 7569: 토마토 (3D)
- BOJ 1697: 숨바꼭질
- BOJ 2667: 단지번호붙이기

### 🥇 고급
- BOJ 13913: 숨바꼭질 4
- BOJ 16234: 인구 이동
- BOJ 17144: 미세먼지 안녕!

---

**다음 학습**: [다익스트라(Dijkstra) 최단 경로](../dijkstra/) 

BFS는 **최단 경로의 기본**이자 **레벨별 탐색의 핵심**입니다. 그래프 알고리즘의 근간을 완벽하게 마스터하세요!