---
title: "다익스트라 알고리즘 (Dijkstra's Algorithm)"
date: "2025-04-21"
category: "Algorithm"
tags: ['Dijkstra', '최단경로', '우선순위큐', '그래프']
excerpt: "다익스트라 알고리즘을 통해 가중 그래프에서의 최단 경로를 효율적으로 찾는 방법을 학습합니다."
readTime: "9분"
---

## 개요

**다익스트라 알고리즘(Dijkstra's Algorithm)**은 음이 아닌 가중치를 가진 그래프에서 한 정점으로부터 다른 모든 정점까지의 최단 경로를 찾는 알고리즘입니다.

### 핵심 특징
- **그리디 접근**: 현재까지 발견된 최단 거리를 기반으로 선택
- **음이 아닌 가중치**: 음수 가중치가 있으면 작동하지 않음
- **단일 출발점**: 하나의 시작점에서 모든 정점까지의 최단 거리
- **우선순위 큐 활용**: 효율적인 구현을 위해 힙 사용

### 시간 복잡도
- **기본 구현**: O(V²)
- **우선순위 큐 사용**: O((V + E) log V)
- **피보나치 힙 사용**: O(V log V + E)

## 기본 구현

### 1. 우선순위 큐를 사용한 구현

```cpp
#include <iostream>
#include <vector>
#include <queue>
#include <limits>
using namespace std;

const int INF = numeric_limits<int>::max();

class Dijkstra {
private:
    struct Edge {
        int to, weight;
        Edge(int t, int w) : to(t), weight(w) {}
    };
    
    struct State {
        int vertex, distance;
        State(int v, int d) : vertex(v), distance(d) {}
        
        bool operator>(const State& other) const {
            return distance > other.distance;
        }
    };
    
    vector<vector<Edge>> adj;
    int n;
    
public:
    Dijkstra(int vertices) : n(vertices) {
        adj.resize(n);
    }
    
    void addEdge(int from, int to, int weight) {
        adj[from].push_back(Edge(to, weight));
    }
    
    vector<int> shortestPath(int start) {
        vector<int> dist(n, INF);
        priority_queue<State, vector<State>, greater<State>> pq;
        
        dist[start] = 0;
        pq.push(State(start, 0));
        
        while (!pq.empty()) {
            State current = pq.top();
            pq.pop();
            
            int u = current.vertex;
            int d = current.distance;
            
            // 이미 처리된 정점이면 무시
            if (d > dist[u]) continue;
            
            // 인접한 모든 정점 확인
            for (const Edge& edge : adj[u]) {
                int v = edge.to;
                int weight = edge.weight;
                
                // 더 짧은 경로 발견시 갱신
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push(State(v, dist[v]));
                }
            }
        }
        
        return dist;
    }
};
```

### 2. 경로 추적 기능 포함

```cpp
class DijkstraWithPath {
private:
    struct Edge {
        int to, weight;
        Edge(int t, int w) : to(t), weight(w) {}
    };
    
    vector<vector<Edge>> adj;
    int n;
    
public:
    DijkstraWithPath(int vertices) : n(vertices) {
        adj.resize(n);
    }
    
    void addEdge(int from, int to, int weight) {
        adj[from].push_back(Edge(to, weight));
    }
    
    pair<vector<int>, vector<int>> shortestPathWithParent(int start) {
        vector<int> dist(n, INF);
        vector<int> parent(n, -1);
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        
        dist[start] = 0;
        pq.push({0, start});
        
        while (!pq.empty()) {
            int d = pq.top().first;
            int u = pq.top().second;
            pq.pop();
            
            if (d > dist[u]) continue;
            
            for (const Edge& edge : adj[u]) {
                int v = edge.to;
                int weight = edge.weight;
                
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    parent[v] = u;
                    pq.push({dist[v], v});
                }
            }
        }
        
        return {dist, parent};
    }
    
    vector<int> reconstructPath(int start, int end, const vector<int>& parent) {
        vector<int> path;
        int current = end;
        
        while (current != -1) {
            path.push_back(current);
            current = parent[current];
        }
        
        reverse(path.begin(), path.end());
        
        // 경로가 존재하지 않는 경우
        if (path[0] != start) {
            return {};
        }
        
        return path;
    }
};
```

### 3. 인접 행렬 버전 (작은 그래프용)

```cpp
class DijkstraMatrix {
private:
    vector<vector<int>> graph;
    int n;
    
public:
    DijkstraMatrix(int vertices) : n(vertices) {
        graph.assign(n, vector<int>(n, INF));
        for (int i = 0; i < n; i++) {
            graph[i][i] = 0;
        }
    }
    
    void addEdge(int from, int to, int weight) {
        graph[from][to] = weight;
    }
    
    vector<int> shortestPath(int start) {
        vector<int> dist(n, INF);
        vector<bool> visited(n, false);
        
        dist[start] = 0;
        
        for (int count = 0; count < n - 1; count++) {
            // 방문하지 않은 정점 중 최소 거리 정점 찾기
            int u = -1;
            for (int v = 0; v < n; v++) {
                if (!visited[v] && (u == -1 || dist[v] < dist[u])) {
                    u = v;
                }
            }
            
            visited[u] = true;
            
            // 인접한 정점들의 거리 갱신
            for (int v = 0; v < n; v++) {
                if (!visited[v] && graph[u][v] != INF && 
                    dist[u] + graph[u][v] < dist[v]) {
                    dist[v] = dist[u] + graph[u][v];
                }
            }
        }
        
        return dist;
    }
};
```

## 응용 문제

### 1. K번째 최단 경로

```cpp
class KthShortestPath {
private:
    struct Edge {
        int to, weight;
        Edge(int t, int w) : to(t), weight(w) {}
    };
    
    vector<vector<Edge>> adj;
    int n;
    
public:
    KthShortestPath(int vertices) : n(vertices) {
        adj.resize(n);
    }
    
    void addEdge(int from, int to, int weight) {
        adj[from].push_back(Edge(to, weight));
    }
    
    int findKthShortestPath(int start, int end, int k) {
        vector<priority_queue<int>> kShortest(n);  // 각 정점의 k개 최단 거리
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        
        pq.push({0, start});
        
        while (!pq.empty()) {
            int dist = pq.top().first;
            int u = pq.top().second;
            pq.pop();
            
            // k개보다 많으면 무시
            if (kShortest[u].size() >= k) continue;
            
            kShortest[u].push(dist);
            
            // 목표 정점에 k개 경로가 찾아졌으면 종료
            if (u == end && kShortest[u].size() == k) {
                vector<int> paths;
                while (!kShortest[u].empty()) {
                    paths.push_back(kShortest[u].top());
                    kShortest[u].pop();
                }
                reverse(paths.begin(), paths.end());
                return paths[k-1];
            }
            
            for (const Edge& edge : adj[u]) {
                int v = edge.to;
                int weight = edge.weight;
                
                if (kShortest[v].size() < k) {
                    pq.push({dist + weight, v});
                }
            }
        }
        
        return -1;  // k번째 경로가 존재하지 않음
    }
};
```

### 2. 조건부 최단 경로

```cpp
class ConditionalShortest {
private:
    struct Edge {
        int to, weight;
        Edge(int t, int w) : to(t), weight(w) {}
    };
    
    vector<vector<Edge>> adj;
    vector<bool> isSpecial;  // 특별한 정점 표시
    int n;
    
public:
    ConditionalShortest(int vertices) : n(vertices) {
        adj.resize(n);
        isSpecial.resize(n, false);
    }
    
    void addEdge(int from, int to, int weight) {
        adj[from].push_back(Edge(to, weight));
    }
    
    void setSpecial(int vertex) {
        isSpecial[vertex] = true;
    }
    
    // 특별한 정점을 최소 하나 거쳐야 하는 최단 경로
    int shortestPathWithSpecial(int start, int end) {
        // 시작점에서 모든 정점까지의 최단 거리
        vector<int> distFromStart = dijkstra(start);
        
        // 끝점에서 모든 정점까지의 최단 거리 (역방향)
        vector<int> distToEnd = dijkstraReverse(end);
        
        int result = INF;
        
        // 모든 특별한 정점을 거치는 경로 중 최단 찾기
        for (int i = 0; i < n; i++) {
            if (isSpecial[i]) {
                if (distFromStart[i] != INF && distToEnd[i] != INF) {
                    result = min(result, distFromStart[i] + distToEnd[i]);
                }
            }
        }
        
        return result == INF ? -1 : result;
    }
    
private:
    vector<int> dijkstra(int start) {
        vector<int> dist(n, INF);
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        
        dist[start] = 0;
        pq.push({0, start});
        
        while (!pq.empty()) {
            int d = pq.top().first;
            int u = pq.top().second;
            pq.pop();
            
            if (d > dist[u]) continue;
            
            for (const Edge& edge : adj[u]) {
                int v = edge.to;
                int weight = edge.weight;
                
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push({dist[v], v});
                }
            }
        }
        
        return dist;
    }
    
    vector<int> dijkstraReverse(int end) {
        // 역방향 그래프 생성
        vector<vector<Edge>> radj(n);
        for (int u = 0; u < n; u++) {
            for (const Edge& edge : adj[u]) {
                radj[edge.to].push_back(Edge(u, edge.weight));
            }
        }
        
        vector<int> dist(n, INF);
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        
        dist[end] = 0;
        pq.push({0, end});
        
        while (!pq.empty()) {
            int d = pq.top().first;
            int u = pq.top().second;
            pq.pop();
            
            if (d > dist[u]) continue;
            
            for (const Edge& edge : radj[u]) {
                int v = edge.to;
                int weight = edge.weight;
                
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push({dist[v], v});
                }
            }
        }
        
        return dist;
    }
};
```

## 고급 응용

### 1. 다중 출발점 다익스트라

```cpp
class MultiSourceDijkstra {
private:
    struct Edge {
        int to, weight;
        Edge(int t, int w) : to(t), weight(w) {}
    };
    
    vector<vector<Edge>> adj;
    int n;
    
public:
    MultiSourceDijkstra(int vertices) : n(vertices) {
        adj.resize(n);
    }
    
    void addEdge(int from, int to, int weight) {
        adj[from].push_back(Edge(to, weight));
    }
    
    vector<int> multiSourceShortest(const vector<int>& sources) {
        vector<int> dist(n, INF);
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        
        // 모든 출발점을 0 거리로 초기화
        for (int source : sources) {
            dist[source] = 0;
            pq.push({0, source});
        }
        
        while (!pq.empty()) {
            int d = pq.top().first;
            int u = pq.top().second;
            pq.pop();
            
            if (d > dist[u]) continue;
            
            for (const Edge& edge : adj[u]) {
                int v = edge.to;
                int weight = edge.weight;
                
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push({dist[v], v});
                }
            }
        }
        
        return dist;
    }
};
```

### 2. 시간 종속 다익스트라

```cpp
class TimeDependentDijkstra {
private:
    struct Edge {
        int to;
        vector<pair<int, int>> timeWeights;  // (시간, 가중치) 쌍
        Edge(int t) : to(t) {}
    };
    
    vector<vector<Edge>> adj;
    int n, maxTime;
    
    int getWeight(const Edge& edge, int time) {
        // 시간에 따른 가중치 계산
        for (int i = 0; i < edge.timeWeights.size(); i++) {
            if (time <= edge.timeWeights[i].first) {
                return edge.timeWeights[i].second;
            }
        }
        return edge.timeWeights.back().second;
    }
    
public:
    TimeDependentDijkstra(int vertices, int maxT) : n(vertices), maxTime(maxT) {
        adj.resize(n);
    }
    
    void addEdge(int from, int to, const vector<pair<int, int>>& timeWeights) {
        adj[from].push_back(Edge(to));
        adj[from].back().timeWeights = timeWeights;
    }
    
    vector<int> shortestPath(int start, int startTime) {
        vector<vector<int>> dist(n, vector<int>(maxTime + 1, INF));
        priority_queue<tuple<int, int, int>, vector<tuple<int, int, int>>, greater<tuple<int, int, int>>> pq;
        
        dist[start][startTime] = 0;
        pq.push({0, start, startTime});
        
        while (!pq.empty()) {
            auto [d, u, time] = pq.top();
            pq.pop();
            
            if (d > dist[u][time]) continue;
            
            for (const Edge& edge : adj[u]) {
                int v = edge.to;
                int weight = getWeight(edge, time);
                int newTime = min(maxTime, time + weight);
                
                if (dist[u][time] + weight < dist[v][newTime]) {
                    dist[v][newTime] = dist[u][time] + weight;
                    pq.push({dist[v][newTime], v, newTime});
                }
            }
        }
        
        // 각 정점의 최소 거리 반환
        vector<int> result(n, INF);
        for (int v = 0; v < n; v++) {
            for (int t = 0; t <= maxTime; t++) {
                result[v] = min(result[v], dist[v][t]);
            }
        }
        
        return result;
    }
};
```

## 실전 문제 해결

### 백준 예제 문제들

#### 1. 최단경로 (1753)
```cpp
int main() {
    int V, E, K;
    cin >> V >> E >> K;
    
    Dijkstra dijkstra(V + 1);
    
    for (int i = 0; i < E; i++) {
        int u, v, w;
        cin >> u >> v >> w;
        dijkstra.addEdge(u, v, w);
    }
    
    vector<int> dist = dijkstra.shortestPath(K);
    
    for (int i = 1; i <= V; i++) {
        if (dist[i] == INF) {
            cout << "INF\n";
        } else {
            cout << dist[i] << "\n";
        }
    }
    
    return 0;
}
```

#### 2. 특정한 최단 경로 (1504)
```cpp
int main() {
    int N, E;
    cin >> N >> E;
    
    Dijkstra dijkstra(N + 1);
    
    for (int i = 0; i < E; i++) {
        int a, b, c;
        cin >> a >> b >> c;
        dijkstra.addEdge(a, b, c);
        dijkstra.addEdge(b, a, c);  // 양방향
    }
    
    int v1, v2;
    cin >> v1 >> v2;
    
    // 1 -> v1 -> v2 -> N 경로
    vector<int> dist1 = dijkstra.shortestPath(1);
    vector<int> distV1 = dijkstra.shortestPath(v1);
    vector<int> distV2 = dijkstra.shortestPath(v2);
    
    int path1 = dist1[v1] + distV1[v2] + distV2[N];
    int path2 = dist1[v2] + distV2[v1] + distV1[N];
    
    int result = min(path1, path2);
    
    if (result >= INF) {
        cout << -1 << endl;
    } else {
        cout << result << endl;
    }
    
    return 0;
}
```

## 주의사항과 팁

### 1. 음수 가중치 처리
- 다익스트라는 음수 가중치를 처리할 수 없음
- 음수 가중치가 있다면 벨만-포드 알고리즘 사용

### 2. 우선순위 큐 최적화
```cpp
// 중복 상태 제거를 위한 체크
if (d > dist[u]) continue;

// pair 사용시 첫 번째 원소가 우선순위
priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
```

### 3. 메모리 최적화
```cpp
// 큰 그래프에서는 인접 리스트 사용
// 필요시 압축된 표현 사용
struct CompressedEdge {
    int to : 20;     // 정점 번호 (최대 1M)
    int weight : 12; // 가중치 (최대 4K)
};
```

## 연관 알고리즘
- **[BFS (너비 우선 탐색)](/post/algorithms/bfs)**: 가중치가 1인 경우
- **[벨만-포드](/post/algorithms/bellman-ford)**: 음수 가중치 처리
- **[플로이드-워셜](/post/algorithms/floyd-warshall)**: 모든 쌍 최단 경로

## 마무리

다익스트라 알고리즘은 가중치가 있는 그래프에서의 최단 경로 문제를 효율적으로 해결하는 핵심 알고리즘입니다. 우선순위 큐를 활용한 구현을 숙지하고, 다양한 변형 문제에 응용할 수 있도록 연습하세요.

**학습 순서**: 기본 다익스트라 → 경로 추적 → 조건부 최단경로 → 고급 응용