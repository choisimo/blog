---
title: "KMP 알고리즘 (Knuth-Morris-Pratt)"
date: "2024-11-08"
category: "Algorithm"
tags: ['KMP', '문자열매칭', '패턴매칭', '실패함수']
excerpt: "KMP 알고리즘을 통해 문자열 패턴 매칭을 효율적으로 수행하는 방법과 실패 함수의 원리를 학습합니다."
readTime: "9분"
---

## 개요

**KMP 알고리즘(Knuth-Morris-Pratt Algorithm)**은 문자열에서 특정 패턴을 효율적으로 찾는 알고리즘입니다. 실패 함수(Failure Function)를 이용하여 불필요한 비교를 건너뛰는 것이 핵심입니다.

### 핵심 특징
- **선형 시간**: O(N + M) 시간 복잡도
- **실패 함수**: 패턴의 접두사와 접미사 일치 정보 활용
- **백트래킹 최소화**: 불필요한 문자 비교 생략
- **전처리 단계**: 패턴 분석을 통한 최적화

### 시간 복잡도
- **전처리**: O(M) - 패턴 길이
- **검색**: O(N) - 텍스트 길이  
- **전체**: O(N + M)
- **공간 복잡도**: O(M)

## 실패 함수 (Failure Function)

### 1. 실패 함수의 정의

```cpp
#include <iostream>
#include <vector>
#include <string>
using namespace std;

class KMP {
private:
    string pattern;
    vector<int> failure;
    
    void computeFailure() {
        int m = pattern.length();
        failure.assign(m, 0);
        
        int j = 0;
        for (int i = 1; i < m; i++) {
            // 불일치가 발생할 때까지 j를 줄임
            while (j > 0 && pattern[i] != pattern[j]) {
                j = failure[j - 1];
            }
            
            // 일치하면 j 증가
            if (pattern[i] == pattern[j]) {
                j++;
            }
            
            failure[i] = j;
        }
    }
    
public:
    KMP(const string& pat) : pattern(pat) {
        computeFailure();
    }
    
    void printFailureFunction() {
        cout << "Pattern: " << pattern << endl;
        cout << "Index:   ";
        for (int i = 0; i < pattern.length(); i++) {
            cout << i << " ";
        }
        cout << "\nFailure: ";
        for (int f : failure) {
            cout << f << " ";
        }
        cout << "\n\n";
    }
    
    vector<int> search(const string& text) {
        vector<int> matches;
        int n = text.length();
        int m = pattern.length();
        
        int j = 0;  // 패턴에서의 현재 위치
        for (int i = 0; i < n; i++) {
            // 불일치 시 실패 함수를 이용해 j 조정
            while (j > 0 && text[i] != pattern[j]) {
                j = failure[j - 1];
            }
            
            // 일치하면 j 증가
            if (text[i] == pattern[j]) {
                j++;
            }
            
            // 패턴 전체가 일치하면 매치 발견
            if (j == m) {
                matches.push_back(i - m + 1);  // 시작 위치
                j = failure[j - 1];  // 다음 매치를 위해 조정
            }
        }
        
        return matches;
    }
};
```

### 2. 실패 함수 시각화

```cpp
class KMPVisualizer {
public:
    static void visualizeFailureFunction(const string& pattern) {
        KMP kmp(pattern);
        
        cout << "=== 실패 함수 계산 과정 ===" << endl;
        cout << "패턴: " << pattern << endl;
        
        vector<int> failure(pattern.length(), 0);
        int j = 0;
        
        cout << "\n단계별 계산:" << endl;
        for (int i = 1; i < pattern.length(); i++) {
            cout << "i=" << i << ", j=" << j << ": ";
            
            // 불일치 처리
            while (j > 0 && pattern[i] != pattern[j]) {
                cout << "불일치(" << pattern[i] << "≠" << pattern[j] 
                     << ") → j=" << failure[j-1] << " ";
                j = failure[j - 1];
            }
            
            // 일치 처리
            if (pattern[i] == pattern[j]) {
                j++;
                cout << "일치(" << pattern[i] << "=" << pattern[j-1] << ") → j=" << j;
            }
            
            failure[i] = j;
            cout << " → failure[" << i << "]=" << failure[i] << endl;
        }
        
        // 최종 결과
        cout << "\n최종 실패 함수:" << endl;
        for (int i = 0; i < pattern.length(); i++) {
            cout << "failure[" << i << "] = " << failure[i] << endl;
        }
    }
};
```

## KMP 검색 과정

### 1. 단계별 검색 시각화

```cpp
class KMPSearchVisualizer {
public:
    static void visualizeSearch(const string& text, const string& pattern) {
        KMP kmp(pattern);
        
        cout << "=== KMP 검색 과정 ===" << endl;
        cout << "텍스트: " << text << endl;
        cout << "패턴:   " << pattern << endl;
        cout << endl;
        
        vector<int> failure(pattern.length(), 0);
        // 실패 함수 계산 (생략 - 위에서 구현됨)
        
        int n = text.length();
        int m = pattern.length();
        int j = 0;
        
        for (int i = 0; i < n; i++) {
            cout << "i=" << i << ", j=" << j << ": ";
            
            // 현재 상태 출력
            cout << text << endl;
            cout << string(i - j, ' ') << pattern << endl;
            
            // 불일치 처리
            while (j > 0 && text[i] != pattern[j]) {
                cout << "불일치 → j=" << failure[j-1] << endl;
                j = failure[j - 1];
                
                if (j > 0) {
                    cout << text << endl;
                    cout << string(i - j, ' ') << pattern << endl;
                }
            }
            
            // 일치 처리
            if (text[i] == pattern[j]) {
                j++;
                cout << "일치: " << text[i] << endl;
            } else {
                cout << "불일치: " << text[i] << "≠" << pattern[j] << endl;
            }
            
            // 완전 매치 확인
            if (j == m) {
                cout << "*** 매치 발견! 위치: " << (i - m + 1) << " ***" << endl;
                j = failure[j - 1];
            }
            
            cout << "---" << endl;
        }
    }
};
```

## 고급 구현 및 최적화

### 1. 다중 패턴 검색

```cpp
class MultiplePatternKMP {
private:
    vector<string> patterns;
    vector<KMP> kmps;
    
public:
    void addPattern(const string& pattern) {
        patterns.push_back(pattern);
        kmps.push_back(KMP(pattern));
    }
    
    vector<pair<int, int>> searchAll(const string& text) {
        vector<pair<int, int>> results;  // (패턴 인덱스, 위치)
        
        for (int p = 0; p < patterns.size(); p++) {
            vector<int> matches = kmps[p].search(text);
            for (int pos : matches) {
                results.push_back({p, pos});
            }
        }
        
        // 위치 순으로 정렬
        sort(results.begin(), results.end(), 
             [](const pair<int, int>& a, const pair<int, int>& b) {
                 return a.second < b.second;
             });
        
        return results;
    }
};
```

### 2. KMP를 이용한 문자열 분석

```cpp
class StringAnalyzer {
public:
    // 문자열의 주기 찾기
    static vector<int> findPeriods(const string& s) {
        KMP kmp(s);
        vector<int> periods;
        int n = s.length();
        
        // failure 함수를 역으로 추적
        int len = n;
        while (len > 0) {
            int period = len - kmp.failure[len - 1];
            if (len % period == 0) {
                periods.push_back(period);
            }
            len = kmp.failure[len - 1];
        }
        
        reverse(periods.begin(), periods.end());
        return periods;
    }
    
    // 최소 주기 반복 문자열 만들기
    static string getMinimalPeriod(const string& s) {
        vector<int> periods = findPeriods(s);
        if (periods.empty()) return s;
        
        int minPeriod = periods[0];
        return s.substr(0, minPeriod);
    }
    
    // 문자열을 주기적으로 확장하여 목표 길이 만들기
    static string extendToPeriodic(const string& s, int targetLength) {
        string period = getMinimalPeriod(s);
        string result;
        
        while (result.length() < targetLength) {
            result += period;
        }
        
        return result.substr(0, targetLength);
    }
};
```

### 3. Z-알고리즘과 KMP 비교

```cpp
class ZAlgorithm {
private:
    static vector<int> computeZ(const string& s) {
        int n = s.length();
        vector<int> z(n);
        int l = 0, r = 0;
        
        for (int i = 1; i < n; i++) {
            if (i <= r) {
                z[i] = min(r - i + 1, z[i - l]);
            }
            
            while (i + z[i] < n && s[z[i]] == s[i + z[i]]) {
                z[i]++;
            }
            
            if (i + z[i] - 1 > r) {
                l = i;
                r = i + z[i] - 1;
            }
        }
        
        return z;
    }
    
public:
    static vector<int> search(const string& text, const string& pattern) {
        string combined = pattern + "$" + text;
        vector<int> z = computeZ(combined);
        
        vector<int> matches;
        int patternLen = pattern.length();
        
        for (int i = patternLen + 1; i < combined.length(); i++) {
            if (z[i] == patternLen) {
                matches.push_back(i - patternLen - 1);
            }
        }
        
        return matches;
    }
};

class AlgorithmComparison {
public:
    static void compareKMPvsZ(const string& text, const string& pattern) {
        // KMP 측정
        auto start = chrono::high_resolution_clock::now();
        KMP kmp(pattern);
        vector<int> kmpResults = kmp.search(text);
        auto end = chrono::high_resolution_clock::now();
        auto kmpTime = chrono::duration_cast<chrono::microseconds>(end - start);
        
        // Z-알고리즘 측정
        start = chrono::high_resolution_clock::now();
        vector<int> zResults = ZAlgorithm::search(text, pattern);
        end = chrono::high_resolution_clock::now();
        auto zTime = chrono::duration_cast<chrono::microseconds>(end - start);
        
        cout << "KMP 실행 시간: " << kmpTime.count() << " μs" << endl;
        cout << "Z-알고리즘 실행 시간: " << zTime.count() << " μs" << endl;
        cout << "매치 개수: " << kmpResults.size() << endl;
    }
};
```

## 응용 문제

### 1. 회전 문자열 판별

```cpp
class RotationChecker {
public:
    static bool isRotation(const string& s1, const string& s2) {
        if (s1.length() != s2.length()) return false;
        
        string doubled = s1 + s1;
        KMP kmp(s2);
        vector<int> matches = kmp.search(doubled);
        
        return !matches.empty();
    }
    
    static int findRotationDistance(const string& s1, const string& s2) {
        if (!isRotation(s1, s2)) return -1;
        
        string doubled = s1 + s1;
        KMP kmp(s2);
        vector<int> matches = kmp.search(doubled);
        
        return matches.empty() ? -1 : matches[0];
    }
};
```

### 2. 부분 문자열 개수 세기

```cpp
class SubstringCounter {
public:
    // 겹치지 않는 부분 문자열 개수
    static int countNonOverlapping(const string& text, const string& pattern) {
        KMP kmp(pattern);
        vector<int> matches = kmp.search(text);
        
        int count = 0;
        int lastEnd = -1;
        
        for (int pos : matches) {
            if (pos > lastEnd) {
                count++;
                lastEnd = pos + pattern.length() - 1;
            }
        }
        
        return count;
    }
    
    // 겹치는 부분 문자열 개수 (전체 매치 개수)
    static int countOverlapping(const string& text, const string& pattern) {
        KMP kmp(pattern);
        return kmp.search(text).size();
    }
};
```

### 3. 최장 공통 접두사-접미사

```cpp
class CommonPrefixSuffix {
public:
    // 두 문자열의 최장 공통 접두사-접미사 찾기
    static string findLongestCommonPrefixSuffix(const string& s1, const string& s2) {
        string combined = s1 + "#" + s2;
        KMP kmp(combined);
        
        // s2의 마지막 위치에서 failure 값 확인
        int maxLen = kmp.failure.back();
        
        // "#" 이후의 길이가 더 클 수 없음
        maxLen = min(maxLen, (int)min(s1.length(), s2.length()));
        
        return s1.substr(0, maxLen);
    }
    
    // 문자열 자체의 최장 접두사-접미사 (자기 자신 제외)
    static string findLongestProperPrefixSuffix(const string& s) {
        KMP kmp(s);
        int len = kmp.failure.back();
        return s.substr(0, len);
    }
};
```

## 실전 문제 해결

### 백준 예제 문제들

#### 1. 찾기 (1786)
```cpp
int main() {
    string text, pattern;
    getline(cin, text);
    getline(cin, pattern);
    
    KMP kmp(pattern);
    vector<int> matches = kmp.search(text);
    
    cout << matches.size() << "\n";
    for (int pos : matches) {
        cout << pos + 1 << " ";  // 1-based 인덱스
    }
    cout << "\n";
    
    return 0;
}
```

#### 2. 광고 (1305)
```cpp
int main() {
    int L;
    cin >> L;
    
    string s;
    cin >> s;
    
    KMP kmp(s);
    int longestPrefixSuffix = kmp.failure[L - 1];
    int minLength = L - longestPrefixSuffix;
    
    cout << minLength << endl;
    
    return 0;
}
```

#### 3. 부분 문자열 (16916)
```cpp
int main() {
    string S, P;
    cin >> S >> P;
    
    KMP kmp(P);
    vector<int> matches = kmp.search(S);
    
    cout << (matches.empty() ? 0 : 1) << endl;
    
    return 0;
}
```

## 주의사항과 팁

### 1. 실패 함수 구현 주의점
```cpp
// 잘못된 구현 (무한 루프 위험)
void wrongComputeFailure() {
    int j = 0;
    for (int i = 1; i < pattern.length(); i++) {
        while (pattern[i] != pattern[j]) {  // j > 0 조건 누락
            j = failure[j - 1];  // j=0일 때 음수 인덱스!
        }
        // ...
    }
}

// 올바른 구현
void correctComputeFailure() {
    int j = 0;
    for (int i = 1; i < pattern.length(); i++) {
        while (j > 0 && pattern[i] != pattern[j]) {  // j > 0 조건 필수
            j = failure[j - 1];
        }
        // ...
    }
}
```

### 2. 메모리 최적화
```cpp
// 스트리밍 환경에서의 KMP
class StreamingKMP {
private:
    string pattern;
    vector<int> failure;
    int currentJ;
    
public:
    StreamingKMP(const string& pat) : pattern(pat), currentJ(0) {
        // failure 함수 계산
    }
    
    bool processCharacter(char c) {
        while (currentJ > 0 && c != pattern[currentJ]) {
            currentJ = failure[currentJ - 1];
        }
        
        if (c == pattern[currentJ]) {
            currentJ++;
        }
        
        if (currentJ == pattern.length()) {
            currentJ = failure[currentJ - 1];
            return true;  // 매치 발견
        }
        
        return false;
    }
};
```

### 3. 디버깅 도구
```cpp
void debugKMP(const string& text, const string& pattern) {
    cout << "=== KMP 디버그 정보 ===" << endl;
    
    KMP kmp(pattern);
    kmp.printFailureFunction();
    
    cout << "검색 결과:" << endl;
    vector<int> matches = kmp.search(text);
    
    if (matches.empty()) {
        cout << "매치 없음" << endl;
    } else {
        for (int pos : matches) {
            cout << "위치 " << pos << ": ";
            cout << text.substr(pos, pattern.length()) << endl;
        }
    }
}
```

## 연관 알고리즘
- **[라빈-카프](/post/algorithms/rabin-karp)**: 해싱 기반 패턴 매칭
- **[Z-알고리즘](/post/algorithms/z-algorithm)**: 접두사 기반 매칭
- **[아호-코라식](/post/algorithms/aho-corasick)**: 다중 패턴 매칭

## 마무리

KMP 알고리즘은 문자열 패턴 매칭의 핵심 알고리즘으로, 실패 함수의 개념을 정확히 이해하는 것이 중요합니다. 다양한 문자열 처리 문제에서 기본이 되는 알고리즘이므로 충분한 연습이 필요합니다.

**학습 순서**: 실패 함수 이해 → 기본 KMP 구현 → 응용 문제 → 최적화 기법