---
title: "Algorithm"
date: "2026-01-20"
category: "algorithm"
tags: ["algorithm", "CS", "math"]
excerpt: "알고리즘 리스트"
readTime: "2분"
---


### 1. 기초 및 정수 알고리즘 (Fundamentals & Number Theoretic)

이 알고리즘들은 수학적 계산이나 데이터 구조의 기초가 되는 연산을 수행합니다.

- **유클리드 알고리즘 (Euclid's Algorithm):** 두 정수의 최대공약수(GCD)를 계산합니다.
- **유니온-파인드 (Union-Find):** 서로소 집합(Disjoint Set) 자료구조를 관리하며, 동적 연결성(Dynamic Connectivity) 문제를 해결합니다.
- **카라츠바 알고리즘 (Karatsuba Algorithm):** 큰 정수의 곱셈을 분할 정복을 통해 기존 방식보다 빠르게 수행합니다.
- **격자 곱셈 (Lattice Multiplication) / 농부 곱셈 (Peasant Multiplication):** 전통적인 방식의 곱셈 알고리즘들입니다.

### 2. 정렬 알고리즘 (Sorting Algorithms)

데이터의 집합을 순서대로 나열하는 알고리즘들입니다.

- **선택 정렬 (Selection Sort):** 배열에서 최소값을 찾아 맨 앞과 교환하는 방식을 반복하여 정렬합니다.
- **삽입 정렬 (Insertion Sort):** 요소를 이미 정렬된 부분의 적절한 위치에 삽입하여 정렬합니다.
- **셸 정렬 (Shellsort):** 일정한 간격의 요소들을 먼저 정렬하여 삽입 정렬의 성능을 개선한 방식입니다.
- **병합 정렬 (Mergesort):** 데이터를 반으로 나누어 각각 정렬한 후 병합하는 분할 정복 알고리즘입니다. (Top-down 및 Bottom-up 방식이 있음)
- **퀵 정렬 (Quicksort):** 피벗(pivot)을 기준으로 데이터를 분할하여 정렬합니다. (3-way partitioning 포함)
- **힙 정렬 (Heapsort):** 힙(Heap) 자료구조를 사용하여 가장 큰(혹은 작은) 요소를 반복적으로 꺼내어 정렬합니다.

### 3. 검색 알고리즘 (Searching Algorithms)

데이터 집합에서 특정 값을 찾는 알고리즘들입니다.

- **이진 검색 (Binary Search):** 정렬된 배열에서 중간값과 비교하며 범위를 절반씩 줄여가며 값을 찾습니다.
- **이진 탐색 트리 (Binary Search Trees, BST):** 트리의 왼쪽에는 작은 값, 오른쪽에는 큰 값을 저장하여 검색, 삽입, 삭제를 수행합니다.
- **레드-블랙 트리 (Red-Black BST):** 트리의 균형을 유지하여 최악의 경우에도 검색 성능을 보장하는 균형 이진 탐색 트리입니다.
- **해싱 (Hashing):** 해시 함수를 이용해 데이터를 저장하고 검색합니다. (Separate chaining 및 Linear probing 방식)
- **퀵 셀렉트 (Quickselect):** 정렬되지 않은 배열에서 k번째로 작은 요소를 빠르게 찾습니다.

### 4. 그래프 알고리즘 (Graph Algorithms)

객체 간의 연결 관계(네트워크)를 다루는 알고리즘들입니다.

- **깊이 우선 탐색 (Depth-First Search, DFS):** 그래프의 깊은 부분을 우선적으로 탐색합니다. (연결성 확인, 위상 정렬 등에 활용)
- **너비 우선 탐색 (Breadth-First Search, BFS):** 시작 정점과 가까운 정점부터 탐색합니다. (가중치 없는 그래프의 최단 경로 탐색에 활용)
- **위상 정렬 (Topological Sort):** 방향 그래프에서 순서를 거스르지 않도록 정점들을 나열합니다. (선후 관계가 있는 작업 스케줄링에 활용)

#### 최소 신장 트리 (MST) 알고리즘
- **크루스칼 (Kruskal's):** 간선들을 가중치 순으로 선택하여 트리를 만듭니다.
- **프림 (Prim's / Jarník's):** 시작 정점에서 가까운 정점을 하나씩 추가하며 트리를 확장합니다.
- **보루프카 (Borůvka's):** 각 컴포넌트에서 가장 작은 간선을 선택하여 병합해 나갑니다.

#### 최단 경로 (Shortest Paths) 알고리즘
- **다익스트라 (Dijkstra's):** 음의 가중치가 없는 그래프에서 단일 출발점 최단 경로를 찾습니다.
- **벨만-포드 (Bellman-Ford):** 음의 가중치가 있는 그래프에서도 단일 출발점 최단 경로를 찾을 수 있습니다.
- **플로이드-워셜 (Floyd-Warshall):** 모든 정점 쌍 사이의 최단 경로를 찾습니다.
- **존슨 (Johnson's):** 희소 그래프에서 모든 정점 쌍 사이의 최단 경로를 효율적으로 찾습니다.

#### 최대 유량 (Maxflow) 알고리즘
- **포드-풀커슨 (Ford-Fulkerson):** 네트워크의 소스에서 싱크까지 흐를 수 있는 최대 유량을 계산합니다.
- **에드몬드-카프 (Edmonds-Karp):** BFS를 사용하여 포드-풀커슨을 구현한 방식입니다.

- **강한 연결 요소 (Strong Components):** 코사라주(Kosaraju-Sharir) 및 타잔(Tarjan) 알고리즘이 있습니다.

### 5. 문자열 알고리즘 (String Algorithms)

텍스트 데이터를 처리하는 알고리즘들입니다.

- **문자열 정렬 (String Sorts):** LSD(Least Significant Digit), MSD(Most Significant Digit), 3-way string quicksort 등이 있습니다.

#### 부분 문자열 검색 (Substring Search)
- **KMP (Knuth-Morris-Pratt):** 불일치가 발생했을 때 앞부분의 정보를 이용해 검색을 건너뜁니다.
- **보이어-무어 (Boyer-Moore):** 패턴의 뒤에서부터 문자를 비교하여 검색 속도를 높입니다.
- **라빈-카프 (Rabin-Karp):** 해싱을 이용하여 문자열 패턴을 찾습니다.

- **데이터 압축 (Data Compression):** 허프만(Huffman) 코딩, LZW 압축 등이 있습니다.
- **트라이 (Trie) 및 TST:** 문자열을 저장하고 효율적으로 검색하는 트리 구조입니다.

### 6. 기타 및 설계 기법 (Advanced & Design Paradigms)

- **동적 계획법 (Dynamic Programming):** 복잡한 문제를 부분 문제로 나누어 풀고 결과를 저장해 재사용합니다. (예: 피보나치 수열, 편집 거리, 배낭 문제 등)
- **그리디 알고리즘 (Greedy Algorithms):** 매 순간 최적이라고 생각되는 선택을 합니다. (예: 허프만 코드, 스케줄링)
- **안정적 매칭 (Stable Matching):** 게일-섀플리(Gale-Shapley) 알고리즘을 통해 선호도를 가진 두 집단을 안정적으로 짝지어줍니다.