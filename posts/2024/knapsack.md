---
title: "배낭 문제 (Knapsack Problem)"
date: "2024-12-21"
category: "Algorithm"
tags: ['Knapsack', '배낭문제', '동적계획법', '최적화']
excerpt: "0-1 배낭 문제와 무한 배낭 문제를 동적 계획법으로 해결하는 다양한 방법을 학습합니다."
readTime: "9분"
---

## 개요

**배낭 문제(Knapsack Problem)**는 제한된 용량의 배낭에 최대한 가치 있는 물건들을 넣는 최적화 문제입니다. 동적 계획법의 대표적인 응용 분야입니다.

### 문제 유형
- **0-1 배낭**: 각 물건을 최대 1개만 선택 가능
- **무한 배낭**: 각 물건을 무한히 선택 가능
- **유한 배낭**: 각 물건을 정해진 개수만큼 선택 가능
- **분할 배낭**: 물건을 부분적으로 선택 가능 (그리디)

### 시간 복잡도
- **0-1 배낭**: O(N × W)
- **무한 배낭**: O(N × W)
- **공간 복잡도**: O(W) (최적화 시)

## 0-1 배낭 문제

### 1. 기본 구현 (2차원 DP)

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Knapsack01 {
private:
    struct Item {
        int weight, value;
        Item(int w, int v) : weight(w), value(v) {}
    };
    
    vector<Item> items;
    int n, capacity;
    vector<vector<int>> dp;
    
public:
    Knapsack01(int cap) : capacity(cap) {}
    
    void addItem(int weight, int value) {
        items.push_back(Item(weight, value));
        n = items.size();
    }
    
    int solve() {
        dp.assign(n + 1, vector<int>(capacity + 1, 0));
        
        for (int i = 1; i <= n; i++) {
            for (int w = 0; w <= capacity; w++) {
                // 물건 i-1을 넣지 않는 경우
                dp[i][w] = dp[i-1][w];
                
                // 물건 i-1을 넣는 경우
                if (w >= items[i-1].weight) {
                    dp[i][w] = max(dp[i][w], 
                                   dp[i-1][w - items[i-1].weight] + items[i-1].value);
                }
            }
        }
        
        return dp[n][capacity];
    }
    
    vector<int> getSelectedItems() {
        vector<int> selected;
        int w = capacity;
        
        for (int i = n; i > 0; i--) {
            if (dp[i][w] != dp[i-1][w]) {
                selected.push_back(i-1);  // 0-based 인덱스
                w -= items[i-1].weight;
            }
        }
        
        reverse(selected.begin(), selected.end());
        return selected;
    }
    
    void printDP() {
        cout << "DP Table:" << endl;
        for (int i = 0; i <= n; i++) {
            for (int w = 0; w <= capacity; w++) {
                cout << dp[i][w] << " ";
            }
            cout << endl;
        }
    }
};
```

### 2. 공간 최적화 (1차원 DP)

```cpp
class Knapsack01Optimized {
private:
    struct Item {
        int weight, value;
        Item(int w, int v) : weight(w), value(v) {}
    };
    
    vector<Item> items;
    int capacity;
    
public:
    Knapsack01Optimized(int cap) : capacity(cap) {}
    
    void addItem(int weight, int value) {
        items.push_back(Item(weight, value));
    }
    
    int solve() {
        vector<int> dp(capacity + 1, 0);
        
        for (const Item& item : items) {
            // 역순으로 진행 (중복 사용 방지)
            for (int w = capacity; w >= item.weight; w--) {
                dp[w] = max(dp[w], dp[w - item.weight] + item.value);
            }
        }
        
        return dp[capacity];
    }
    
    // 선택된 물건들을 추적하는 버전
    pair<int, vector<int>> solveWithTrace() {
        vector<vector<int>> dp(items.size() + 1, vector<int>(capacity + 1, 0));
        
        // DP 테이블 채우기
        for (int i = 1; i <= items.size(); i++) {
            for (int w = 0; w <= capacity; w++) {
                dp[i][w] = dp[i-1][w];
                if (w >= items[i-1].weight) {
                    dp[i][w] = max(dp[i][w], 
                                   dp[i-1][w - items[i-1].weight] + items[i-1].value);
                }
            }
        }
        
        // 선택된 물건들 추적
        vector<int> selected;
        int w = capacity;
        for (int i = items.size(); i > 0; i--) {
            if (dp[i][w] != dp[i-1][w]) {
                selected.push_back(i-1);
                w -= items[i-1].weight;
            }
        }
        
        return {dp[items.size()][capacity], selected};
    }
};
```

## 무한 배낭 문제 (Unbounded Knapsack)

### 1. 기본 구현

```cpp
class UnboundedKnapsack {
private:
    struct Item {
        int weight, value;
        Item(int w, int v) : weight(w), value(v) {}
    };
    
    vector<Item> items;
    int capacity;
    
public:
    UnboundedKnapsack(int cap) : capacity(cap) {}
    
    void addItem(int weight, int value) {
        items.push_back(Item(weight, value));
    }
    
    int solve() {
        vector<int> dp(capacity + 1, 0);
        
        for (int w = 1; w <= capacity; w++) {
            for (const Item& item : items) {
                if (w >= item.weight) {
                    dp[w] = max(dp[w], dp[w - item.weight] + item.value);
                }
            }
        }
        
        return dp[capacity];
    }
    
    // 각 물건을 몇 개씩 선택했는지 추적
    vector<int> getItemCounts() {
        vector<int> dp(capacity + 1, 0);
        vector<int> choice(capacity + 1, -1);  // 어떤 물건을 선택했는지
        
        for (int w = 1; w <= capacity; w++) {
            for (int i = 0; i < items.size(); i++) {
                if (w >= items[i].weight && 
                    dp[w - items[i].weight] + items[i].value > dp[w]) {
                    dp[w] = dp[w - items[i].weight] + items[i].value;
                    choice[w] = i;
                }
            }
        }
        
        // 개수 세기
        vector<int> counts(items.size(), 0);
        int w = capacity;
        while (w > 0 && choice[w] != -1) {
            int item = choice[w];
            counts[item]++;
            w -= items[item].weight;
        }
        
        return counts;
    }
};
```

### 2. 동전 거슬러주기 문제

```cpp
class CoinChange {
private:
    vector<int> coins;
    
public:
    void addCoin(int value) {
        coins.push_back(value);
    }
    
    // 최소 동전 개수
    int minCoins(int amount) {
        vector<int> dp(amount + 1, INT_MAX);
        dp[0] = 0;
        
        for (int i = 1; i <= amount; i++) {
            for (int coin : coins) {
                if (i >= coin && dp[i - coin] != INT_MAX) {
                    dp[i] = min(dp[i], dp[i - coin] + 1);
                }
            }
        }
        
        return dp[amount] == INT_MAX ? -1 : dp[amount];
    }
    
    // 동전 조합의 총 개수
    int countWays(int amount) {
        vector<int> dp(amount + 1, 0);
        dp[0] = 1;
        
        for (int coin : coins) {
            for (int i = coin; i <= amount; i++) {
                dp[i] += dp[i - coin];
            }
        }
        
        return dp[amount];
    }
    
    // 거슬러준 동전들 반환
    vector<int> getCoins(int amount) {
        vector<int> dp(amount + 1, INT_MAX);
        vector<int> choice(amount + 1, -1);
        dp[0] = 0;
        
        for (int i = 1; i <= amount; i++) {
            for (int coin : coins) {
                if (i >= coin && dp[i - coin] != INT_MAX && 
                    dp[i - coin] + 1 < dp[i]) {
                    dp[i] = dp[i - coin] + 1;
                    choice[i] = coin;
                }
            }
        }
        
        vector<int> result;
        while (amount > 0) {
            result.push_back(choice[amount]);
            amount -= choice[amount];
        }
        
        return result;
    }
};
```

## 고급 변형 문제

### 1. 다중 배낭 (Multiple Knapsack)

```cpp
class MultipleKnapsack {
private:
    struct Item {
        int weight, value, count;
        Item(int w, int v, int c) : weight(w), value(v), count(c) {}
    };
    
    vector<Item> items;
    int capacity;
    
public:
    MultipleKnapsack(int cap) : capacity(cap) {}
    
    void addItem(int weight, int value, int count) {
        items.push_back(Item(weight, value, count));
    }
    
    // 이진 표현을 이용한 최적화
    int solve() {
        vector<pair<int, int>> expandedItems;  // (weight, value)
        
        // 각 물건을 이진 표현으로 분해
        for (const Item& item : items) {
            int remain = item.count;
            int k = 1;
            
            while (k <= remain) {
                expandedItems.push_back({item.weight * k, item.value * k});
                remain -= k;
                k *= 2;
            }
            
            if (remain > 0) {
                expandedItems.push_back({item.weight * remain, item.value * remain});
            }
        }
        
        // 0-1 배낭으로 변환하여 해결
        vector<int> dp(capacity + 1, 0);
        
        for (const auto& item : expandedItems) {
            for (int w = capacity; w >= item.first; w--) {
                dp[w] = max(dp[w], dp[w - item.first] + item.second);
            }
        }
        
        return dp[capacity];
    }
};
```

### 2. 2차원 배낭 문제

```cpp
class Knapsack2D {
private:
    struct Item {
        int weight, volume, value;
        Item(int w, int v, int val) : weight(w), volume(v), value(val) {}
    };
    
    vector<Item> items;
    int maxWeight, maxVolume;
    
public:
    Knapsack2D(int w, int v) : maxWeight(w), maxVolume(v) {}
    
    void addItem(int weight, int volume, int value) {
        items.push_back(Item(weight, volume, value));
    }
    
    int solve() {
        // dp[w][v] = 무게 w, 부피 v 제한에서의 최대 가치
        vector<vector<int>> dp(maxWeight + 1, vector<int>(maxVolume + 1, 0));
        
        for (const Item& item : items) {
            for (int w = maxWeight; w >= item.weight; w--) {
                for (int v = maxVolume; v >= item.volume; v--) {
                    dp[w][v] = max(dp[w][v], 
                                   dp[w - item.weight][v - item.volume] + item.value);
                }
            }
        }
        
        return dp[maxWeight][maxVolume];
    }
};
```

### 3. 분할 가능 배낭 (Fractional Knapsack)

```cpp
class FractionalKnapsack {
private:
    struct Item {
        int weight, value;
        double ratio;
        
        Item(int w, int v) : weight(w), value(v), ratio((double)v / w) {}
        
        bool operator>(const Item& other) const {
            return ratio > other.ratio;
        }
    };
    
    vector<Item> items;
    int capacity;
    
public:
    FractionalKnapsack(int cap) : capacity(cap) {}
    
    void addItem(int weight, int value) {
        items.push_back(Item(weight, value));
    }
    
    double solve() {
        // 가치/무게 비율로 내림차순 정렬
        sort(items.begin(), items.end(), greater<Item>());
        
        double totalValue = 0.0;
        int remainingCapacity = capacity;
        
        for (const Item& item : items) {
            if (remainingCapacity >= item.weight) {
                // 전체를 넣을 수 있는 경우
                totalValue += item.value;
                remainingCapacity -= item.weight;
            } else {
                // 일부만 넣을 수 있는 경우
                double fraction = (double)remainingCapacity / item.weight;
                totalValue += item.value * fraction;
                break;
            }
        }
        
        return totalValue;
    }
    
    vector<double> getFractions() {
        sort(items.begin(), items.end(), greater<Item>());
        
        vector<double> fractions(items.size(), 0.0);
        int remainingCapacity = capacity;
        
        for (int i = 0; i < items.size(); i++) {
            if (remainingCapacity >= items[i].weight) {
                fractions[i] = 1.0;
                remainingCapacity -= items[i].weight;
            } else {
                fractions[i] = (double)remainingCapacity / items[i].weight;
                break;
            }
        }
        
        return fractions;
    }
};
```

## 실전 문제 해결

### 백준 예제 문제들

#### 1. 평범한 배낭 (12865)
```cpp
int main() {
    int N, K;
    cin >> N >> K;
    
    Knapsack01 knapsack(K);
    
    for (int i = 0; i < N; i++) {
        int w, v;
        cin >> w >> v;
        knapsack.addItem(w, v);
    }
    
    cout << knapsack.solve() << endl;
    
    return 0;
}
```

#### 2. 동전 1 (2293)
```cpp
int main() {
    int n, k;
    cin >> n >> k;
    
    CoinChange coinChange;
    for (int i = 0; i < n; i++) {
        int coin;
        cin >> coin;
        coinChange.addCoin(coin);
    }
    
    cout << coinChange.countWays(k) << endl;
    
    return 0;
}
```

#### 3. 동전 2 (2294)
```cpp
int main() {
    int n, k;
    cin >> n >> k;
    
    CoinChange coinChange;
    for (int i = 0; i < n; i++) {
        int coin;
        cin >> coin;
        coinChange.addCoin(coin);
    }
    
    int result = coinChange.minCoins(k);
    cout << result << endl;
    
    return 0;
}
```

## 최적화 기법

### 1. 공간 최적화
```cpp
// 슬라이딩 윈도우 기법
class OptimizedKnapsack {
private:
    int solve(vector<pair<int, int>>& items, int capacity) {
        vector<int> prev(capacity + 1, 0);
        vector<int> curr(capacity + 1, 0);
        
        for (const auto& item : items) {
            for (int w = 0; w <= capacity; w++) {
                curr[w] = prev[w];
                if (w >= item.first) {
                    curr[w] = max(curr[w], prev[w - item.first] + item.second);
                }
            }
            prev = curr;
        }
        
        return curr[capacity];
    }
};
```

### 2. 근사 알고리즘
```cpp
class ApproximateKnapsack {
public:
    // FPTAS (Fully Polynomial-Time Approximation Scheme)
    double approximateSolve(vector<pair<int, int>>& items, int capacity, double epsilon) {
        int maxValue = 0;
        for (const auto& item : items) {
            maxValue = max(maxValue, item.second);
        }
        
        int K = epsilon * maxValue / items.size();
        
        // 가치를 K로 스케일링
        for (auto& item : items) {
            item.second /= K;
        }
        
        // 스케일된 문제 해결
        Knapsack01 knapsack(capacity);
        for (const auto& item : items) {
            knapsack.addItem(item.first, item.second);
        }
        
        return knapsack.solve() * K;
    }
};
```

## 주의사항과 팁

### 1. 메모리 관리
```cpp
// 큰 용량일 때는 map 사용 고려
class SparseKnapsack {
private:
    map<int, int> dp;  // 용량 -> 최대 가치
    
public:
    int solve(vector<pair<int, int>>& items, int capacity) {
        dp[0] = 0;
        
        for (const auto& item : items) {
            map<int, int> newDp = dp;
            for (const auto& state : dp) {
                int w = state.first;
                int v = state.second;
                
                if (w + item.first <= capacity) {
                    newDp[w + item.first] = max(newDp[w + item.first], v + item.second);
                }
            }
            dp = newDp;
        }
        
        int result = 0;
        for (const auto& state : dp) {
            result = max(result, state.second);
        }
        
        return result;
    }
};
```

### 2. 디버깅 도구
```cpp
void debugKnapsack(const vector<pair<int, int>>& items, int capacity) {
    cout << "Items: ";
    for (int i = 0; i < items.size(); i++) {
        cout << "(" << items[i].first << "," << items[i].second << ") ";
    }
    cout << "\nCapacity: " << capacity << endl;
    
    Knapsack01 knapsack(capacity);
    for (const auto& item : items) {
        knapsack.addItem(item.first, item.second);
    }
    
    cout << "Maximum value: " << knapsack.solve() << endl;
    
    vector<int> selected = knapsack.getSelectedItems();
    cout << "Selected items: ";
    for (int idx : selected) {
        cout << idx << " ";
    }
    cout << endl;
}
```

## 연관 알고리즘
- **[동적 계획법 기초](/post/algorithms/dynamic-programming)**: 기본 개념
- **[그리디 알고리즘](/post/algorithms/greedy)**: 분할 가능 배낭
- **[최적화 문제](/post/algorithms/optimization)**: 근사 알고리즘

## 마무리

배낭 문제는 동적 계획법의 핵심 문제로, 다양한 변형과 최적화 기법을 통해 실제 최적화 문제에 광범위하게 응용됩니다. 기본 개념부터 고급 최적화까지 단계적으로 학습하세요.

**학습 순서**: 0-1 배낭 → 무한 배낭 → 다중 배낭 → 2차원 배낭 → 근사 알고리즘