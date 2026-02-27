---
title: "최장 증가 부분 수열 (LIS, Longest Increasing Subsequence)"
date: "2024-12-08"
category: "Algorithm"
tags: ['LIS', '동적계획법', '이분탐색', '부분수열']
excerpt: "최장 증가 부분 수열(LIS) 문제를 동적 계획법과 이분 탐색으로 효율적으로 해결하는 방법을 학습합니다."
readTime: "8분"
---

## 개요

**최장 증가 부분 수열(LIS, Longest Increasing Subsequence)**은 주어진 수열에서 원소들이 증가하는 순서로 배열된 가장 긴 부분 수열을 찾는 문제입니다.

### 핵심 특징
- **부분 수열**: 원래 수열에서 일부를 선택하되 순서 유지
- **증가 조건**: 선택된 원소들이 오름차순으로 배열
- **최적 부분 구조**: 동적 계획법으로 해결 가능
- **다양한 접근법**: O(N²), O(N log N) 해법 존재

### 시간 복잡도
- **기본 DP**: O(N²)
- **이분 탐색 활용**: O(N log N)
- **공간 복잡도**: O(N)

## 기본 구현

### 1. 동적 계획법 접근 (O(N²))

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class LIS_DP {
private:
    vector<int> arr;
    vector<int> dp;
    int n;
    
public:
    LIS_DP(const vector<int>& sequence) : arr(sequence), n(sequence.size()) {
        dp.resize(n, 1);  // 모든 원소는 최소 길이 1의 LIS
    }
    
    int findLIS() {
        // dp[i] = arr[i]로 끝나는 LIS의 길이
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++) {
                if (arr[j] < arr[i]) {
                    dp[i] = max(dp[i], dp[j] + 1);
                }
            }
        }
        
        return *max_element(dp.begin(), dp.end());
    }
    
    vector<int> reconstructLIS() {
        int maxLength = findLIS();
        vector<int> lis;
        
        // 뒤에서부터 LIS 복원
        int currentLength = maxLength;
        for (int i = n - 1; i >= 0; i--) {
            if (dp[i] == currentLength) {
                lis.push_back(arr[i]);
                currentLength--;
            }
        }
        
        reverse(lis.begin(), lis.end());
        return lis;
    }
    
    void printDP() {
        cout << "Array: ";
        for (int x : arr) cout << x << " ";
        cout << "\nDP:    ";
        for (int x : dp) cout << x << " ";
        cout << "\n";
    }
};
```

### 2. 이분 탐색 최적화 (O(N log N))

```cpp
class LIS_BinarySearch {
private:
    vector<int> arr;
    vector<int> tail;  // LIS를 구성하는 가장 작은 끝 원소들
    int n;
    
public:
    LIS_BinarySearch(const vector<int>& sequence) : arr(sequence), n(sequence.size()) {}
    
    int findLIS() {
        tail.clear();
        
        for (int i = 0; i < n; i++) {
            // tail에서 arr[i]보다 크거나 같은 첫 번째 원소 위치
            auto pos = lower_bound(tail.begin(), tail.end(), arr[i]);
            
            if (pos == tail.end()) {
                // arr[i]가 가장 크면 끝에 추가
                tail.push_back(arr[i]);
            } else {
                // 해당 위치의 값을 arr[i]로 교체
                *pos = arr[i];
            }
        }
        
        return tail.size();
    }
    
    // 실제 LIS를 복원하는 고급 버전
    vector<int> reconstructLIS() {
        vector<int> tail;
        vector<int> parent(n, -1);
        vector<int> tailIndex;  // tail[i]에 해당하는 원소의 인덱스
        
        for (int i = 0; i < n; i++) {
            auto pos = lower_bound(tail.begin(), tail.end(), arr[i]);
            int idx = pos - tail.begin();
            
            if (pos == tail.end()) {
                tail.push_back(arr[i]);
                tailIndex.push_back(i);
            } else {
                *pos = arr[i];
                tailIndex[idx] = i;
            }
            
            if (idx > 0) {
                parent[i] = tailIndex[idx - 1];
            }
        }
        
        // LIS 복원
        vector<int> lis;
        int current = tailIndex.back();
        
        while (current != -1) {
            lis.push_back(arr[current]);
            current = parent[current];
        }
        
        reverse(lis.begin(), lis.end());
        return lis;
    }
};
```

### 3. LIS 변형 문제들

#### 최장 감소 부분 수열 (LDS)
```cpp
class LDS {
public:
    static int findLDS(const vector<int>& arr) {
        int n = arr.size();
        vector<int> dp(n, 1);
        
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++) {
                if (arr[j] > arr[i]) {  // 감소 조건
                    dp[i] = max(dp[i], dp[j] + 1);
                }
            }
        }
        
        return *max_element(dp.begin(), dp.end());
    }
};
```

#### 최장 비내림차순 부분 수열 (Non-decreasing)
```cpp
class LIS_NonDecreasing {
public:
    static int findLIS(const vector<int>& arr) {
        vector<int> tail;
        
        for (int x : arr) {
            // upper_bound 사용 (중복 허용)
            auto pos = upper_bound(tail.begin(), tail.end(), x);
            
            if (pos == tail.end()) {
                tail.push_back(x);
            } else {
                *pos = x;
            }
        }
        
        return tail.size();
    }
};
```

## 응용 문제

### 1. 바이토닉 수열 (Bitonic Sequence)

```cpp
class BitonicSequence {
private:
    vector<int> arr;
    int n;
    
public:
    BitonicSequence(const vector<int>& sequence) : arr(sequence), n(sequence.size()) {}
    
    int findLongestBitonic() {
        vector<int> lis(n, 1);  // 증가하는 LIS
        vector<int> lds(n, 1);  // 감소하는 LIS (뒤에서부터)
        
        // 왼쪽에서 오른쪽으로 LIS 계산
        for (int i = 1; i < n; i++) {
            for (int j = 0; j < i; j++) {
                if (arr[j] < arr[i]) {
                    lis[i] = max(lis[i], lis[j] + 1);
                }
            }
        }
        
        // 오른쪽에서 왼쪽으로 LIS 계산 (LDS)
        for (int i = n - 2; i >= 0; i--) {
            for (int j = i + 1; j < n; j++) {
                if (arr[i] > arr[j]) {
                    lds[i] = max(lds[i], lds[j] + 1);
                }
            }
        }
        
        int maxBitonic = 0;
        for (int i = 0; i < n; i++) {
            maxBitonic = max(maxBitonic, lis[i] + lds[i] - 1);
        }
        
        return maxBitonic;
    }
};
```

### 2. 최장 공통 부분 수열과 LIS의 관계

```cpp
class LCS_to_LIS {
private:
    // 수열 A에서 수열 B의 순서를 유지하는 LIS 찾기
    vector<int> convertToLIS(const vector<int>& a, const vector<int>& b) {
        // B의 각 원소에 대한 위치 매핑
        map<int, int> posInB;
        for (int i = 0; i < b.size(); i++) {
            posInB[b[i]] = i;
        }
        
        // A를 B에서의 위치로 변환
        vector<int> converted;
        for (int x : a) {
            if (posInB.find(x) != posInB.end()) {
                converted.push_back(posInB[x]);
            }
        }
        
        return converted;
    }
    
public:
    int longestCommonSubsequence(const vector<int>& a, const vector<int>& b) {
        vector<int> converted = convertToLIS(a, b);
        
        // 변환된 수열에서 LIS 찾기
        LIS_BinarySearch lis(converted);
        return lis.findLIS();
    }
};
```

### 3. 2D LIS (Box Stacking Problem)

```cpp
struct Box {
    int width, height, depth;
    
    bool operator<(const Box& other) const {
        return width < other.width;
    }
    
    bool canStack(const Box& other) const {
        return width < other.width && depth < other.depth;
    }
};

class BoxStacking {
private:
    vector<Box> boxes;
    int n;
    
public:
    BoxStacking(const vector<Box>& boxList) : boxes(boxList), n(boxList.size()) {
        sort(boxes.begin(), boxes.end());
    }
    
    int maxHeight() {
        vector<int> dp(n);
        
        for (int i = 0; i < n; i++) {
            dp[i] = boxes[i].height;
            
            for (int j = 0; j < i; j++) {
                if (boxes[j].canStack(boxes[i])) {
                    dp[i] = max(dp[i], dp[j] + boxes[i].height);
                }
            }
        }
        
        return *max_element(dp.begin(), dp.end());
    }
};
```

## 고급 기법

### 1. K개의 LIS 찾기

```cpp
class K_LIS {
private:
    vector<int> arr;
    int n, k;
    
public:
    K_LIS(const vector<int>& sequence, int kValue) : arr(sequence), n(sequence.size()), k(kValue) {}
    
    vector<vector<int>> findKLongestIS() {
        vector<vector<vector<int>>> dp(n);
        
        // dp[i] = arr[i]로 끝나는 모든 LIS들
        for (int i = 0; i < n; i++) {
            dp[i].push_back({arr[i]});  // 자기 자신만으로 이루어진 수열
            
            for (int j = 0; j < i; j++) {
                if (arr[j] < arr[i]) {
                    for (const auto& seq : dp[j]) {
                        vector<int> newSeq = seq;
                        newSeq.push_back(arr[i]);
                        dp[i].push_back(newSeq);
                    }
                }
            }
            
            // 길이 기준으로 정렬하고 상위 k개만 유지
            sort(dp[i].begin(), dp[i].end(), [](const vector<int>& a, const vector<int>& b) {
                return a.size() > b.size();
            });
            
            if (dp[i].size() > k) {
                dp[i].resize(k);
            }
        }
        
        // 모든 dp[i]에서 최장 k개 수집
        vector<vector<int>> allLIS;
        for (int i = 0; i < n; i++) {
            for (const auto& seq : dp[i]) {
                allLIS.push_back(seq);
            }
        }
        
        sort(allLIS.begin(), allLIS.end(), [](const vector<int>& a, const vector<int>& b) {
            return a.size() > b.size();
        });
        
        if (allLIS.size() > k) {
            allLIS.resize(k);
        }
        
        return allLIS;
    }
};
```

### 2. 온라인 LIS (스트리밍 데이터)

```cpp
class OnlineLIS {
private:
    vector<int> tail;
    int currentLength;
    
public:
    OnlineLIS() : currentLength(0) {}
    
    int addElement(int value) {
        auto pos = lower_bound(tail.begin(), tail.end(), value);
        
        if (pos == tail.end()) {
            tail.push_back(value);
            currentLength++;
        } else {
            *pos = value;
        }
        
        return currentLength;
    }
    
    int getCurrentLISLength() const {
        return currentLength;
    }
    
    void reset() {
        tail.clear();
        currentLength = 0;
    }
};
```

## 실전 문제 해결

### 백준 예제 문제들

#### 1. 가장 긴 증가하는 부분 수열 (11053)
```cpp
int main() {
    int n;
    cin >> n;
    
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    
    LIS_BinarySearch lis(arr);
    cout << lis.findLIS() << endl;
    
    return 0;
}
```

#### 2. 가장 긴 증가하는 부분 수열 4 (14002)
```cpp
int main() {
    int n;
    cin >> n;
    
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    
    LIS_BinarySearch lis(arr);
    vector<int> result = lis.reconstructLIS();
    
    cout << result.size() << "\n";
    for (int x : result) {
        cout << x << " ";
    }
    cout << "\n";
    
    return 0;
}
```

#### 3. 전깃줄 (2565)
```cpp
int main() {
    int n;
    cin >> n;
    
    vector<pair<int, int>> wires(n);
    for (int i = 0; i < n; i++) {
        cin >> wires[i].first >> wires[i].second;
    }
    
    // A 기준으로 정렬
    sort(wires.begin(), wires.end());
    
    // B 값들의 LIS를 구하면, 제거하지 않아도 되는 전깃줄의 개수
    vector<int> b_values;
    for (const auto& wire : wires) {
        b_values.push_back(wire.second);
    }
    
    LIS_BinarySearch lis(b_values);
    int keepCount = lis.findLIS();
    
    cout << n - keepCount << endl;  // 제거해야 할 전깃줄의 개수
    
    return 0;
}
```

## 주의사항과 팁

### 1. 구현 시 주의점
```cpp
// lower_bound vs upper_bound
// 엄격한 증가: lower_bound 사용
// 비내림차순: upper_bound 사용

// 인덱스 처리 주의
auto pos = lower_bound(tail.begin(), tail.end(), arr[i]);
int idx = pos - tail.begin();  // 위치 계산
```

### 2. 최적화 기법
```cpp
// 메모리 최적화: 공간 압축
class CompressedLIS {
private:
    vector<int> compress(vector<int>& arr) {
        vector<int> sorted = arr;
        sort(sorted.begin(), sorted.end());
        sorted.erase(unique(sorted.begin(), sorted.end()), sorted.end());
        
        for (int& x : arr) {
            x = lower_bound(sorted.begin(), sorted.end(), x) - sorted.begin();
        }
        
        return sorted;
    }
};
```

### 3. 디버깅 도구
```cpp
void debugLIS(const vector<int>& arr) {
    LIS_DP lis(arr);
    int length = lis.findLIS();
    vector<int> sequence = lis.reconstructLIS();
    
    cout << "Array: ";
    for (int x : arr) cout << x << " ";
    cout << "\nLIS Length: " << length << endl;
    cout << "LIS: ";
    for (int x : sequence) cout << x << " ";
    cout << endl;
    
    lis.printDP();
}
```

## 연관 알고리즘
- **[동적 계획법 기초](/post/algorithms/dynamic-programming)**: DP 접근법
- **[이분 탐색](/post/algorithms/binary-search)**: 최적화 기법
- **[최장 공통 부분 수열](/post/algorithms/lcs)**: 관련 문제

## 마무리

LIS는 동적 계획법의 대표적인 문제로, 기본적인 O(N²) 해법부터 이분 탐색을 활용한 O(N log N) 최적화까지 다양한 접근법을 학습할 수 있습니다. 실제 LIS를 복원하는 방법까지 익혀두면 더욱 유용합니다.

**학습 순서**: 기본 DP → 이분 탐색 최적화 → LIS 복원 → 변형 문제