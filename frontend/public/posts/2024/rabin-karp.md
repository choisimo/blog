---
title: "라빈-카프 알고리즘 (Rabin-Karp Algorithm)"
date: "2024-11-05"
category: "Algorithm"
tags: ['Rabin-Karp', '해싱', '문자열매칭', '롤링해시']
excerpt: "라빈-카프 알고리즘을 통해 해싱을 활용한 효율적인 문자열 패턴 매칭과 롤링 해시 기법을 학습합니다."
readTime: "11분"
---

## 개요

**라빈-카프 알고리즘(Rabin-Karp Algorithm)**은 해싱을 이용하여 문자열에서 패턴을 찾는 알고리즘입니다. 롤링 해시(Rolling Hash) 기법을 사용하여 평균적으로 선형 시간에 동작합니다.

### 핵심 특징
- **해시 기반**: 문자열을 해시값으로 변환하여 비교
- **롤링 해시**: 슬라이딩 윈도우의 해시값을 효율적으로 갱신
- **다중 패턴**: 여러 패턴을 동시에 검색 가능
- **확률적 정확성**: 해시 충돌 가능성으로 인한 검증 필요

### 시간 복잡도
- **평균**: O(N + M)
- **최악**: O(NM) - 모든 해시값이 같을 때
- **공간 복잡도**: O(1)

## 기본 구현

### 1. 단순 라빈-카프 구현

```cpp
#include <iostream>
#include <vector>
#include <string>
using namespace std;

class RabinKarp {
private:
    static const int BASE = 256;    // 문자 개수 (ASCII)
    static const int MOD = 1000000007;  // 큰 소수
    
    long long computeHash(const string& str, int start, int len) {
        long long hash = 0;
        long long pow = 1;
        
        for (int i = 0; i < len; i++) {
            hash = (hash + (str[start + i] * pow) % MOD) % MOD;
            pow = (pow * BASE) % MOD;
        }
        
        return hash;
    }
    
    long long rollingHash(const string& str, int oldStart, int newStart, 
                         int len, long long oldHash, long long basePow) {
        // 이전 문자 제거
        long long newHash = (oldHash - str[oldStart] + MOD) % MOD;
        newHash = (newHash * modInverse(BASE)) % MOD;
        
        // 새 문자 추가
        newHash = (newHash + (str[newStart + len - 1] * basePow) % MOD) % MOD;
        
        return newHash;
    }
    
    // 모듈로 역원 계산 (확장 유클리드 호제법)
    long long modInverse(long long a) {
        return power(a, MOD - 2, MOD);
    }
    
    long long power(long long base, long long exp, long long mod) {
        long long result = 1;
        while (exp > 0) {
            if (exp % 2 == 1) {
                result = (result * base) % mod;
            }
            base = (base * base) % mod;
            exp /= 2;
        }
        return result;
    }
    
public:
    vector<int> search(const string& text, const string& pattern) {
        vector<int> matches;
        int n = text.length();
        int m = pattern.length();
        
        if (m > n) return matches;
        
        // 패턴의 해시값 계산
        long long patternHash = computeHash(pattern, 0, m);
        
        // 첫 번째 윈도우의 해시값 계산
        long long textHash = computeHash(text, 0, m);
        
        // BASE^(m-1) 계산 (롤링 해시용)
        long long basePow = power(BASE, m - 1, MOD);
        
        // 첫 번째 위치 확인
        if (textHash == patternHash && text.substr(0, m) == pattern) {
            matches.push_back(0);
        }
        
        // 슬라이딩 윈도우로 검색
        for (int i = 1; i <= n - m; i++) {
            textHash = rollingHash(text, i - 1, i, m, textHash, basePow);
            
            if (textHash == patternHash && text.substr(i, m) == pattern) {
                matches.push_back(i);
            }
        }
        
        return matches;
    }
};
```

### 2. 개선된 롤링 해시 구현

```cpp
class ImprovedRabinKarp {
private:
    static const int BASE = 31;  // 소수 사용
    static const int MOD = 1e9 + 7;
    
    struct RollingHash {
        vector<long long> hash;
        vector<long long> basePow;
        string str;
        
        RollingHash(const string& s) : str(s) {
            int n = s.length();
            hash.resize(n + 1, 0);
            basePow.resize(n + 1, 1);
            
            // 전처리: 누적 해시와 거듭제곱 계산
            for (int i = 0; i < n; i++) {
                hash[i + 1] = (hash[i] * BASE + s[i]) % MOD;
                basePow[i + 1] = (basePow[i] * BASE) % MOD;
            }
        }
        
        // 부분 문자열 [l, r)의 해시값 반환
        long long getHash(int l, int r) {
            long long result = (hash[r] - hash[l] * basePow[r - l]) % MOD;
            return (result + MOD) % MOD;
        }
    };
    
public:
    vector<int> search(const string& text, const string& pattern) {
        if (pattern.length() > text.length()) return {};
        
        RollingHash textHash(text);
        RollingHash patternHash(pattern);
        
        vector<int> matches;
        int m = pattern.length();
        long long targetHash = patternHash.getHash(0, m);
        
        for (int i = 0; i <= (int)text.length() - m; i++) {
            if (textHash.getHash(i, i + m) == targetHash) {
                // 해시 충돌 확인을 위한 실제 문자열 비교
                if (text.substr(i, m) == pattern) {
                    matches.push_back(i);
                }
            }
        }
        
        return matches;
    }
    
    // 두 부분 문자열이 같은지 확인
    bool isEqual(const string& s1, int start1, int len1,
                 const string& s2, int start2, int len2) {
        if (len1 != len2) return false;
        
        RollingHash hash1(s1);
        RollingHash hash2(s2);
        
        return hash1.getHash(start1, start1 + len1) == 
               hash2.getHash(start2, start2 + len2);
    }
};
```

## 고급 응용

### 1. 다중 패턴 검색

```cpp
class MultiPatternRabinKarp {
private:
    static const int BASE = 31;
    static const int MOD = 1e9 + 7;
    
    struct PatternInfo {
        string pattern;
        long long hash;
        int id;
    };
    
    long long computePatternHash(const string& pattern) {
        long long hash = 0;
        long long basePow = 1;
        
        for (char c : pattern) {
            hash = (hash + c * basePow) % MOD;
            basePow = (basePow * BASE) % MOD;
        }
        
        return hash;
    }
    
public:
    vector<pair<int, int>> searchMultiple(const string& text, 
                                        const vector<string>& patterns) {
        // 패턴들을 길이별로 그룹화
        map<int, vector<PatternInfo>> patternsByLength;
        
        for (int i = 0; i < patterns.size(); i++) {
            PatternInfo info;
            info.pattern = patterns[i];
            info.hash = computePatternHash(patterns[i]);
            info.id = i;
            
            patternsByLength[patterns[i].length()].push_back(info);
        }
        
        vector<pair<int, int>> results;  // (패턴 ID, 위치)
        
        // 각 길이별로 검색 수행
        for (const auto& group : patternsByLength) {
            int len = group.first;
            const vector<PatternInfo>& patternList = group.second;
            
            if (len > text.length()) continue;
            
            // 해시 맵으로 빠른 검색
            unordered_map<long long, vector<int>> hashToPatterns;
            for (int i = 0; i < patternList.size(); i++) {
                hashToPatterns[patternList[i].hash].push_back(i);
            }
            
            // 롤링 해시로 텍스트 스캔
            ImprovedRabinKarp::RollingHash textHash(text);
            
            for (int pos = 0; pos <= (int)text.length() - len; pos++) {
                long long windowHash = textHash.getHash(pos, pos + len);
                
                if (hashToPatterns.find(windowHash) != hashToPatterns.end()) {
                    for (int patIdx : hashToPatterns[windowHash]) {
                        if (text.substr(pos, len) == patternList[patIdx].pattern) {
                            results.push_back({patternList[patIdx].id, pos});
                        }
                    }
                }
            }
        }
        
        // 위치순으로 정렬
        sort(results.begin(), results.end(), 
             [](const pair<int, int>& a, const pair<int, int>& b) {
                 return a.second < b.second;
             });
        
        return results;
    }
};
```

### 2. 문자열 해시 기반 비교

```cpp
class StringHashComparator {
private:
    static const int BASE = 31;
    static const int MOD = 1e9 + 7;
    
public:
    // 모든 부분 문자열의 해시값 전처리
    struct StringHasher {
        vector<long long> prefixHash;
        vector<long long> basePow;
        string str;
        
        StringHasher(const string& s) : str(s) {
            int n = s.length();
            prefixHash.resize(n + 1, 0);
            basePow.resize(n + 1, 1);
            
            for (int i = 0; i < n; i++) {
                prefixHash[i + 1] = (prefixHash[i] * BASE + s[i]) % MOD;
                basePow[i + 1] = (basePow[i] * BASE) % MOD;
            }
        }
        
        long long getHash(int l, int r) {  // [l, r)
            long long result = (prefixHash[r] - prefixHash[l] * basePow[r - l]) % MOD;
            return (result + MOD) % MOD;
        }
    };
    
    // 최장 공통 부분 문자열 길이
    static int longestCommonSubstring(const string& s1, const string& s2) {
        StringHasher hash1(s1);
        StringHasher hash2(s2);
        
        int maxLen = 0;
        
        // 모든 가능한 길이에 대해 이분 탐색
        int left = 0, right = min(s1.length(), s2.length());
        
        while (left <= right) {
            int mid = (left + right) / 2;
            bool found = false;
            
            // 길이 mid인 부분 문자열들의 해시값 수집
            unordered_set<long long> hashes1;
            for (int i = 0; i <= (int)s1.length() - mid; i++) {
                hashes1.insert(hash1.getHash(i, i + mid));
            }
            
            // s2에서 같은 해시값 찾기
            for (int i = 0; i <= (int)s2.length() - mid; i++) {
                if (hashes1.count(hash2.getHash(i, i + mid))) {
                    found = true;
                    break;
                }
            }
            
            if (found) {
                maxLen = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        return maxLen;
    }
    
    // 회문 판별
    static bool isPalindrome(const string& s, int l, int r) {
        StringHasher hash(s);
        string rev = s;
        reverse(rev.begin(), rev.end());
        StringHasher revHash(rev);
        
        int len = r - l;
        long long frontHash = hash.getHash(l, r);
        long long backHash = revHash.getHash(s.length() - r, s.length() - l);
        
        return frontHash == backHash;
    }
};
```

### 3. 중복 부분 문자열 찾기

```cpp
class DuplicateFinder {
private:
    static const int BASE = 31;
    static const int MOD = 1e9 + 7;
    
public:
    // 길이 k인 중복 부분 문자열들 찾기
    static vector<string> findDuplicatesOfLength(const string& s, int k) {
        if (k > s.length()) return {};
        
        StringHashComparator::StringHasher hasher(s);
        unordered_map<long long, vector<int>> hashToPositions;
        
        // 모든 길이 k인 부분 문자열의 해시값과 위치 저장
        for (int i = 0; i <= (int)s.length() - k; i++) {
            long long hash = hasher.getHash(i, i + k);
            hashToPositions[hash].push_back(i);
        }
        
        // 중복되는 부분 문자열들 수집
        set<string> duplicates;
        for (const auto& entry : hashToPositions) {
            if (entry.second.size() > 1) {
                string substr = s.substr(entry.second[0], k);
                duplicates.insert(substr);
            }
        }
        
        return vector<string>(duplicates.begin(), duplicates.end());
    }
    
    // 가장 긴 중복 부분 문자열
    static string longestDuplicateSubstring(const string& s) {
        int left = 1, right = s.length();
        string result = "";
        
        while (left <= right) {
            int mid = (left + right) / 2;
            vector<string> duplicates = findDuplicatesOfLength(s, mid);
            
            if (!duplicates.empty()) {
                result = duplicates[0];  // 사전순으로 첫 번째
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        return result;
    }
    
    // 정확히 k번 나타나는 부분 문자열들
    static vector<string> findSubstringsWithFrequency(const string& s, int len, int freq) {
        StringHashComparator::StringHasher hasher(s);
        unordered_map<long long, int> hashCount;
        unordered_map<long long, string> hashToString;
        
        for (int i = 0; i <= (int)s.length() - len; i++) {
            long long hash = hasher.getHash(i, i + len);
            hashCount[hash]++;
            
            if (hashToString.find(hash) == hashToString.end()) {
                hashToString[hash] = s.substr(i, len);
            }
        }
        
        vector<string> result;
        for (const auto& entry : hashCount) {
            if (entry.second == freq) {
                result.push_back(hashToString[entry.first]);
            }
        }
        
        return result;
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
    
    RabinKarp rk;
    vector<int> matches = rk.search(text, pattern);
    
    cout << matches.size() << "\n";
    for (int pos : matches) {
        cout << pos + 1 << " ";  // 1-based 인덱스
    }
    cout << "\n";
    
    return 0;
}
```

#### 2. 문자열 해싱 (15829)
```cpp
int main() {
    int L;
    cin >> L;
    
    string s;
    cin >> s;
    
    const int BASE = 31;
    const int MOD = 1234567891;
    
    long long hash = 0;
    long long basePow = 1;
    
    for (int i = 0; i < L; i++) {
        int charValue = s[i] - 'a' + 1;
        hash = (hash + charValue * basePow) % MOD;
        basePow = (basePow * BASE) % MOD;
    }
    
    cout << hash << endl;
    
    return 0;
}
```

#### 3. 부분 문자열 (16916)
```cpp
int main() {
    string S, P;
    cin >> S >> P;
    
    ImprovedRabinKarp rk;
    vector<int> matches = rk.search(S, P);
    
    cout << (matches.empty() ? 0 : 1) << endl;
    
    return 0;
}
```

## 해시 충돌 처리 및 최적화

### 1. 이중 해싱

```cpp
class DoubleHashingRabinKarp {
private:
    static const int BASE1 = 31;
    static const int BASE2 = 37;
    static const int MOD1 = 1e9 + 7;
    static const int MOD2 = 1e9 + 9;
    
    struct DoubleHash {
        long long hash1, hash2;
        
        DoubleHash(long long h1 = 0, long long h2 = 0) : hash1(h1), hash2(h2) {}
        
        bool operator==(const DoubleHash& other) const {
            return hash1 == other.hash1 && hash2 == other.hash2;
        }
    };
    
    DoubleHash computeHash(const string& s, int start, int len) {
        long long h1 = 0, h2 = 0;
        long long p1 = 1, p2 = 1;
        
        for (int i = 0; i < len; i++) {
            h1 = (h1 + s[start + i] * p1) % MOD1;
            h2 = (h2 + s[start + i] * p2) % MOD2;
            p1 = (p1 * BASE1) % MOD1;
            p2 = (p2 * BASE2) % MOD2;
        }
        
        return DoubleHash(h1, h2);
    }
    
public:
    vector<int> search(const string& text, const string& pattern) {
        vector<int> matches;
        int n = text.length();
        int m = pattern.length();
        
        if (m > n) return matches;
        
        DoubleHash patternHash = computeHash(pattern, 0, m);
        
        for (int i = 0; i <= n - m; i++) {
            DoubleHash textHash = computeHash(text, i, m);
            
            if (textHash == patternHash) {
                // 이중 해시가 같으면 실제 문자열 비교 생략 가능 (확률적으로 안전)
                matches.push_back(i);
            }
        }
        
        return matches;
    }
};
```

### 2. 성능 측정 및 비교

```cpp
class PerformanceAnalyzer {
public:
    static void compareAlgorithms(const string& text, const string& pattern) {
        // 라빈-카프
        auto start = chrono::high_resolution_clock::now();
        RabinKarp rk;
        vector<int> rkResults = rk.search(text, pattern);
        auto end = chrono::high_resolution_clock::now();
        auto rkTime = chrono::duration_cast<chrono::microseconds>(end - start);
        
        // KMP (비교용)
        start = chrono::high_resolution_clock::now();
        // KMP 구현 호출 (이전 파일에서 구현됨)
        end = chrono::high_resolution_clock::now();
        auto kmpTime = chrono::duration_cast<chrono::microseconds>(end - start);
        
        // 단순 매칭
        start = chrono::high_resolution_clock::now();
        vector<int> naiveResults;
        for (int i = 0; i <= (int)text.length() - (int)pattern.length(); i++) {
            if (text.substr(i, pattern.length()) == pattern) {
                naiveResults.push_back(i);
            }
        }
        end = chrono::high_resolution_clock::now();
        auto naiveTime = chrono::duration_cast<chrono::microseconds>(end - start);
        
        cout << "성능 비교 결과:" << endl;
        cout << "Rabin-Karp: " << rkTime.count() << " μs" << endl;
        cout << "KMP: " << kmpTime.count() << " μs" << endl;
        cout << "Naive: " << naiveTime.count() << " μs" << endl;
        cout << "매치 개수: " << rkResults.size() << endl;
    }
};
```

## 주의사항과 팁

### 1. 해시 함수 선택
```cpp
// 좋은 해시 파라미터 선택
class HashParameters {
public:
    // 소수 베이스와 큰 모듈러 값 사용
    static const int GOOD_BASES[] = {31, 37, 41, 43, 47};
    static const int GOOD_MODS[] = {1000000007, 1000000009, 998244353};
    
    // 문자열 특성에 따른 베이스 선택
    static int chooseBestBase(const string& s) {
        set<char> uniqueChars(s.begin(), s.end());
        int charCount = uniqueChars.size();
        
        // 문자 종류가 많으면 큰 베이스 사용
        if (charCount > 20) return 31;
        else if (charCount > 10) return 37;
        else return 41;
    }
};
```

### 2. 오버플로우 방지
```cpp
// 안전한 모듈러 연산
long long safeMultiply(long long a, long long b, long long mod) {
    return ((a % mod) * (b % mod)) % mod;
}

long long safeAdd(long long a, long long b, long long mod) {
    return ((a % mod) + (b % mod)) % mod;
}
```

### 3. 디버깅 도구
```cpp
void debugRabinKarp(const string& text, const string& pattern) {
    cout << "=== Rabin-Karp 디버그 ===" << endl;
    cout << "텍스트: " << text << endl;
    cout << "패턴: " << pattern << endl;
    
    RabinKarp rk;
    vector<int> matches = rk.search(text, pattern);
    
    cout << "매치 결과:" << endl;
    if (matches.empty()) {
        cout << "매치 없음" << endl;
    } else {
        for (int pos : matches) {
            cout << "위치 " << pos << ": " << text.substr(pos, pattern.length()) << endl;
        }
    }
    
    // 해시값 비교
    StringHashComparator::StringHasher hasher(text);
    cout << "\n해시값 분석:" << endl;
    for (int i = 0; i <= (int)text.length() - (int)pattern.length(); i++) {
        long long hash = hasher.getHash(i, i + pattern.length());
        cout << "위치 " << i << ": " << hash << endl;
    }
}
```

## 연관 알고리즘
- **[KMP 알고리즘](/post/algorithms/kmp)**: 결정적 패턴 매칭
- **[Z-알고리즘](/post/algorithms/z-algorithm)**: 접두사 기반 매칭
- **[해시 테이블](/post/algorithms/hash-table)**: 해싱 기법 활용

## 마무리

라빈-카프 알고리즘은 해싱의 강력함을 보여주는 대표적인 예제로, 특히 다중 패턴 검색이나 대용량 텍스트 처리에서 유용합니다. 해시 충돌에 대한 이해와 적절한 해시 함수 선택이 성능의 핵심입니다.

**학습 순서**: 기본 해싱 → 롤링 해시 → 다중 패턴 → 해시 충돌 처리