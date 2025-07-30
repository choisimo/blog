---
title: "9-10주차: 그래프 이론 기초"
date: "2024-02-12"
category: "Algorithm"
tags: ['그래프', 'BFS', 'DFS', '탐색', '알고리즘']
excerpt: "그래프의 표현 방법과 BFS, DFS 탐색 알고리즘을 완벽하게 마스터한다"
readTime: "4분"
---

<div class="week-badge">9-10주차</div>

# 🕸️ 그래프 이론 기초

> **학습 목표**: 그래프 표현 방법 완전 이해, BFS·DFS 탐색 알고리즘 마스터

실세계의 복잡한 관계를 모델링하는 그래프 자료구조를 학습합니다. 많은 고급 알고리즘의 기초가 되는 중요한 단원입니다.

## 📖 주요 학습 내용

### 그래프 기본 개념
- **정점(Vertex)과 간선(Edge)**: 그래프의 구성 요소
- **무향 그래프 vs 유향 그래프**: 방향성에 따른 분류
- **가중 그래프**: 간선에 비용이 있는 그래프
- **연결 그래프**: 모든 정점이 연결된 그래프

### 그래프 표현 방법
- **인접 행렬(Adjacency Matrix)**: 2차원 배열로 표현
- **인접 리스트(Adjacency List)**: 연결 리스트로 표현
- **간선 리스트(Edge List)**: 간선들의 집합으로 표현

### 그래프 탐색 알고리즘
- **깊이 우선 탐색(DFS)**: 스택을 이용한 깊이 탐색
- **너비 우선 탐색(BFS)**: 큐를 이용한 레벨별 탐색

## 🎯 추천 학습 자료

### 필수 자료
- **생활코딩**: 그래프 이론 강의
- **백준**: 그래프 탐색 분류 문제집
- **GeeksforGeeks**: Graph Data Structure

### 시각화 도구
- **Graph Visualizer**: 탐색 과정 시각화
- **VisuAlgo**: 그래프 알고리즘 애니메이션

## 💻 실습 문제

### 필수 문제
```markdown
🟢 BOJ 1260: DFS와 BFS
   - 그래프 탐색의 기본 문제
   - 난이도: ⭐⭐

🟡 BOJ 2178: 미로 탐색  
   - BFS를 이용한 최단 경로
   - 난이도: ⭐⭐⭐
```

### 추가 연습 문제
- BOJ 2606: 바이러스 (DFS/BFS)
- BOJ 1012: 유기농 배추 (연결 요소)
- BOJ 7576: 토마토 (BFS 응용)
- BOJ 2667: 단지번호붙이기

## 📊 그래프 표현 방법 비교

| 표현 방법 | 공간복잡도 | 간선 존재 확인 | 모든 간선 탐색 | 특징 |
|-----------|------------|----------------|----------------|------|
| 인접 행렬 | O(V²) | O(1) | O(V²) | 밀집 그래프에 적합 |
| 인접 리스트 | O(V+E) | O(V) | O(V+E) | 희소 그래프에 적합 |

## ⏰ 학습 스케줄

| 일차 | 학습 내용 | 소요 시간 |
|------|-----------|-----------|
| 1-2일 | 그래프 기본 개념과 표현 | 3-4시간 |
| 3-5일 | DFS 완전 정복 | 4-5시간 |
| 6-8일 | BFS 완전 정복 | 4-5시간 |
| 9-11일 | 미로 탐색, 연결 요소 | 4-5시간 |
| 12-14일 | 종합 문제 풀이 | 매일 2-3시간 |

## 🎉 학습 완료 체크리스트

- [ ] 인접 행렬과 인접 리스트를 모두 구현할 수 있다
- [ ] DFS를 재귀와 스택으로 모두 구현할 수 있다
- [ ] BFS를 큐를 이용해 정확히 구현할 수 있다
- [ ] 미로에서 최단 경로를 찾을 수 있다
- [ ] 연결 요소의 개수를 구할 수 있다

## 💡 핵심 코드 구현

### DFS (재귀 방식)
```python
def dfs(graph, start, visited):
    visited[start] = True
    print(start, end=' ')
    
    for neighbor in graph[start]:
        if not visited[neighbor]:
            dfs(graph, neighbor, visited)
```

### BFS (큐 방식)  
```python
from collections import deque

def bfs(graph, start):
    visited = [False] * len(graph)
    queue = deque([start])
    visited[start] = True
    
    while queue:
        vertex = queue.popleft()
        print(vertex, end=' ')
        
        for neighbor in graph[vertex]:
            if not visited[neighbor]:
                visited[neighbor] = True
                queue.append(neighbor)
```

### 미로 탐색 (BFS)
```python
def maze_bfs(maze, start, end):
    directions = [(0,1), (1,0), (0,-1), (-1,0)]  # 상하좌우
    queue = deque([(start[0], start[1], 0)])  # (x, y, distance)
    visited = set([start])
    
    while queue:
        x, y, dist = queue.popleft()
        
        if (x, y) == end:
            return dist
            
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            
            if (nx, ny) not in visited and maze[nx][ny] == 1:
                visited.add((nx, ny))
                queue.append((nx, ny, dist + 1))
    
    return -1  # 경로가 없는 경우
```

## ⚡ 그래프 탐색 핵심 팁

1. **방문 체크**: visited 배열로 무한루프 방지
2. **DFS는 깊이**: 한 방향으로 끝까지 탐색
3. **BFS는 레벨**: 가까운 정점부터 차례로 탐색  
4. **최단 경로는 BFS**: 가중치가 없는 그래프에서

## 🔍 응용 분야

- **연결 요소 찾기**: DFS/BFS로 그래프 분할
- **사이클 검출**: DFS로 역방향 간선 찾기
- **위상 정렬**: DAG에서 순서 결정
- **이분 그래프**: BFS로 색칠 가능성 판단

## 🔥 다음 단계 예고

- **최단 경로**: 다익스트라, 벨만-포드 알고리즘
- **최소 신장 트리**: 크루스칼, 프림 알고리즘  
- **강연결 요소**: 타잔, 코사라주 알고리즘
- **네트워크 플로우**: 최대 유량 문제

---

**이전 주차**: [7-8주차: 동적 계획법 기초](../week7-8) ⬅️
**다음 주차**: [11-12주차: 고급 자료구조 및 최단경로](../week11-12) ➡️

<div class="text-center">
  <a href="../week7-8" class="btn-secondary">← 이전 주차</a>
  <a href="../week11-12" class="btn">다음 주차로 →</a>
</div>