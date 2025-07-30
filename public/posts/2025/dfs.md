---
title: "깊이 우선 탐색 (DFS, Depth-First Search)"
date: "2025-04-21"
category: "Algorithm"
tags: ['DFS', '그래프', '탐색', '재귀', '스택']
excerpt: "깊이 우선 탐색(DFS) 알고리즘의 원리와 구현, 다양한 응용 문제 해결법을 학습합니다."
readTime: "6분"
---

## 개요

**깊이 우선 탐색(DFS, Depth-First Search)**은 그래프나 트리를 탐색하는 알고리즘으로, 한 경로를 끝까지 탐색한 후 다른 경로를 탐색하는 방식입니다.

### 핵심 특징
- **깊이 우선**: 가능한 한 깊이 들어가며 탐색
- **백트래킹**: 더 이상 갈 곳이 없으면 되돌아감
- **완전 탐색**: 모든 정점을 방문할 수 있음
- **스택 구조**: 후입선출(LIFO) 특성 활용

### 시간 복잡도
- **인접 리스트**: O(V + E)
- **인접 행렬**: O(V²)
- **공간 복잡도**: O(V) (재귀 호출 스택)

## 기본 구현

### 1. 재귀를 이용한 DFS

```cpp
#include <iostream>
#include <vector>
using namespace std;

class DFS {
private:
    vector<vector<int>> adj;  // 인접 리스트
    vector<bool> visited;     // 방문 체크
    int n;                    // 정점 개수
    
public:
    DFS(int vertices) : n(vertices) {
        adj.resize(n);
        visited.resize(n);
    }
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);  // 무방향 그래프
    }
    
    void dfs(int vertex) {
        visited[vertex] = true;
        cout << vertex << " ";
        
        // 인접한 모든 정점 탐색
        for (int next : adj[vertex]) {
            if (!visited[next]) {
                dfs(next);
            }
        }
    }
    
    void dfsAll() {
        fill(visited.begin(), visited.end(), false);
        
        // 모든 연결 컴포넌트 탐색
        for (int i = 0; i < n; i++) {
            if (!visited[i]) {
                cout << "Component: ";
                dfs(i);
                cout << "\n";
            }
        }
    }
};
```

### 2. 스택을 이용한 반복적 DFS

```cpp
#include <stack>

void dfsIterative(int start) {
    vector<bool> visited(n, false);
    stack<int> st;
    
    st.push(start);
    
    while (!st.empty()) {
        int vertex = st.top();
        st.pop();
        
        if (!visited[vertex]) {
            visited[vertex] = true;
            cout << vertex << " ";
            
            // 인접한 정점들을 스택에 추가
            // 역순으로 넣어야 올바른 DFS 순서가 됨
            for (int i = adj[vertex].size() - 1; i >= 0; i--) {
                int next = adj[vertex][i];
                if (!visited[next]) {
                    st.push(next);
                }
            }
        }
    }
}
```

## 응용 문제

### 1. 연결 컴포넌트 개수 구하기

```cpp
class ConnectedComponents {
private:
    vector<vector<int>> adj;
    vector<bool> visited;
    int n;
    
    void dfs(int v) {
        visited[v] = true;
        for (int next : adj[v]) {
            if (!visited[next]) {
                dfs(next);
            }
        }
    }
    
public:
    ConnectedComponents(int vertices) : n(vertices) {
        adj.resize(n);
        visited.resize(n);
    }
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);
    }
    
    int countComponents() {
        fill(visited.begin(), visited.end(), false);
        int count = 0;
        
        for (int i = 0; i < n; i++) {
            if (!visited[i]) {
                dfs(i);
                count++;
            }
        }
        
        return count;
    }
};
```

### 2. 사이클 검출 (무방향 그래프)

```cpp
class CycleDetection {
private:
    vector<vector<int>> adj;
    vector<bool> visited;
    int n;
    
    bool dfs(int v, int parent) {
        visited[v] = true;
        
        for (int next : adj[v]) {
            if (!visited[next]) {
                if (dfs(next, v)) return true;
            }
            else if (next != parent) {
                return true;  // 사이클 발견
            }
        }
        return false;
    }
    
public:
    CycleDetection(int vertices) : n(vertices) {
        adj.resize(n);
        visited.resize(n);
    }
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);
    }
    
    bool hasCycle() {
        fill(visited.begin(), visited.end(), false);
        
        for (int i = 0; i < n; i++) {
            if (!visited[i]) {
                if (dfs(i, -1)) return true;
            }
        }
        return false;
    }
};
```

### 3. 경로 찾기

```cpp
class PathFinding {
private:
    vector<vector<int>> adj;
    vector<bool> visited;
    vector<int> path;
    int n;
    
    bool dfs(int current, int target) {
        visited[current] = true;
        path.push_back(current);
        
        if (current == target) {
            return true;  // 목표 도달
        }
        
        for (int next : adj[current]) {
            if (!visited[next]) {
                if (dfs(next, target)) {
                    return true;
                }
            }
        }
        
        path.pop_back();  // 백트래킹
        return false;
    }
    
public:
    PathFinding(int vertices) : n(vertices) {
        adj.resize(n);
        visited.resize(n);
    }
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);
    }
    
    vector<int> findPath(int start, int end) {
        fill(visited.begin(), visited.end(), false);
        path.clear();
        
        if (dfs(start, end)) {
            return path;
        }
        return {};  // 경로 없음
    }
};
```

## 고급 응용

### 1. 위상 정렬 (방향 그래프)

```cpp
class TopologicalSort {
private:
    vector<vector<int>> adj;
    vector<bool> visited;
    stack<int> result;
    int n;
    
    void dfs(int v) {
        visited[v] = true;
        
        for (int next : adj[v]) {
            if (!visited[next]) {
                dfs(next);
            }
        }
        
        result.push(v);  // 완료 시점에 스택에 추가
    }
    
public:
    TopologicalSort(int vertices) : n(vertices) {
        adj.resize(n);
        visited.resize(n);
    }
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);  // 방향 그래프
    }
    
    vector<int> topologicalSort() {
        fill(visited.begin(), visited.end(), false);
        
        for (int i = 0; i < n; i++) {
            if (!visited[i]) {
                dfs(i);
            }
        }
        
        vector<int> sorted;
        while (!result.empty()) {
            sorted.push_back(result.top());
            result.pop();
        }
        
        return sorted;
    }
};
```

### 2. 강한 연결 컴포넌트 (SCC)

```cpp
class StronglyConnectedComponents {
private:
    vector<vector<int>> adj, radj;  // 원본 그래프, 역방향 그래프
    vector<bool> visited;
    stack<int> order;
    vector<vector<int>> components;
    int n;
    
    void dfs1(int v) {
        visited[v] = true;
        for (int next : adj[v]) {
            if (!visited[next]) {
                dfs1(next);
            }
        }
        order.push(v);
    }
    
    void dfs2(int v, vector<int>& component) {
        visited[v] = true;
        component.push_back(v);
        
        for (int next : radj[v]) {
            if (!visited[next]) {
                dfs2(next, component);
            }
        }
    }
    
public:
    StronglyConnectedComponents(int vertices) : n(vertices) {
        adj.resize(n);
        radj.resize(n);
        visited.resize(n);
    }
    
    void addEdge(int u, int v) {
        adj[u].push_back(v);
        radj[v].push_back(u);  // 역방향 엣지
    }
    
    vector<vector<int>> findSCC() {
        // 1단계: 원본 그래프에서 완료 시간 순서 구하기
        fill(visited.begin(), visited.end(), false);
        for (int i = 0; i < n; i++) {
            if (!visited[i]) {
                dfs1(i);
            }
        }
        
        // 2단계: 역방향 그래프에서 SCC 찾기
        fill(visited.begin(), visited.end(), false);
        components.clear();
        
        while (!order.empty()) {
            int v = order.top();
            order.pop();
            
            if (!visited[v]) {
                vector<int> component;
                dfs2(v, component);
                components.push_back(component);
            }
        }
        
        return components;
    }
};
```

## 실전 문제 해결

### 백준 예제 문제들

#### 1. DFS와 BFS (1260)
```cpp
// 정점 번호가 작은 것부터 방문하는 DFS
void dfs(int v, vector<vector<int>>& adj, vector<bool>& visited) {
    visited[v] = true;
    cout << v << " ";
    
    for (int next : adj[v]) {
        if (!visited[next]) {
            dfs(next, adj, visited);
        }
    }
}
```

#### 2. 연결 요소의 개수 (11724)
```cpp
int countConnectedComponents(int n, vector<vector<int>>& adj) {
    vector<bool> visited(n + 1, false);
    int count = 0;
    
    for (int i = 1; i <= n; i++) {
        if (!visited[i]) {
            dfs(i, adj, visited);
            count++;
        }
    }
    
    return count;
}
```

## 주의사항과 팁

### 1. 시간 복잡도 최적화
- 인접 리스트 사용으로 O(V + E) 달성
- 불필요한 방문 체크로 무한 루프 방지
- 재귀 깊이 제한 고려 (스택 오버플로우)

### 2. 메모리 관리
- 큰 그래프에서는 재귀 대신 반복적 구현 고려
- 방문 배열 초기화 확인
- 벡터 크기 사전 할당

### 3. 디버깅 요령
```cpp
void debugDFS(int v, int depth = 0) {
    string indent(depth * 2, ' ');
    cout << indent << "Visiting: " << v << endl;
    
    visited[v] = true;
    
    for (int next : adj[v]) {
        if (!visited[next]) {
            debugDFS(next, depth + 1);
        }
    }
    
    cout << indent << "Backtrack from: " << v << endl;
}
```

## 연관 알고리즘
- **[BFS (너비 우선 탐색)](/post/algorithms/bfs)**: 레벨 단위 탐색
- **[다이나믹 프로그래밍](/post/algorithms/dynamic-programming)**: 메모이제이션과 백트래킹
- **[백트래킹](/post/algorithms/backtracking)**: 조건부 탐색

## 마무리

DFS는 그래프 탐색의 기본이 되는 알고리즘으로, 다양한 그래프 문제의 해결책이 됩니다. 재귀의 특성을 이해하고 백트래킹 개념을 숙지하면 복잡한 탐색 문제도 해결할 수 있습니다.

**학습 순서**: 기본 DFS → 연결 컴포넌트 → 사이클 검출 → 위상 정렬 → SCC