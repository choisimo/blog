---
title: "소수 판별과 소인수분해 알고리즘"
date: "2024-12-17"
category: "Algorithm"
tags: ['소수', '에라토스테네스의체', '소인수분해', '밀러라빈']
excerpt: "효율적인 소수 판별과 소인수분해를 위한 다양한 수학 알고리즘들을 학습합니다."
readTime: "13분"
---

## 개요

**소수(Prime Number)**는 1과 자기 자신만을 약수로 가지는 자연수입니다. 소수 판별과 소인수분해는 암호학, 해시 함수, 수학적 계산에서 핵심적인 역할을 합니다.

### 주요 알고리즘
- **에라토스테네스의 체**: 범위 내 모든 소수 찾기
- **밀러-라빈 테스트**: 확률적 소수 판별
- **폴라드 로**: 빠른 소인수분해
- **페르마 소수 정리**: 소수 성질 활용

### 시간 복잡도
- **단순 판별**: O(√N)
- **에라토스테네스의 체**: O(N log log N)
- **밀러-라빈**: O(k log³ N) - k번 테스트

## 기본 소수 판별

### 1. 단순한 소수 판별

```cpp
#include <iostream>
#include <vector>
#include <cmath>
#include <random>
using namespace std;

class PrimalityTest {
public:
    // 기본적인 소수 판별 O(√N)
    static bool isPrimeSimple(long long n) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 == 0 || n % 3 == 0) return false;
        
        // 6k ± 1 형태만 확인
        for (long long i = 5; i * i <= n; i += 6) {
            if (n % i == 0 || n % (i + 2) == 0) {
                return false;
            }
        }
        
        return true;
    }
    
    // 최적화된 단순 판별
    static bool isPrimeOptimized(long long n) {
        if (n <= 1) return false;
        if (n == 2) return true;
        if (n % 2 == 0) return false;
        
        long long sqrtN = sqrt(n);
        
        // 홀수만 확인
        for (long long i = 3; i <= sqrtN; i += 2) {
            if (n % i == 0) return false;
        }
        
        return true;
    }
    
    // 작은 소수들로만 나누어보기
    static bool isPrimeWithSmallPrimes(long long n) {
        static vector<int> smallPrimes = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47};
        
        if (n <= 1) return false;
        
        for (int p : smallPrimes) {
            if (n == p) return true;
            if (n % p == 0) return false;
        }
        
        // 작은 소수들로 나누어떨어지지 않으면 더 확인
        long long sqrtN = sqrt(n);
        for (long long i = 49; i <= sqrtN; i += 2) {
            if (n % i == 0) return false;
        }
        
        return true;
    }
};
```

### 2. 에라토스테네스의 체

```cpp
class SieveOfEratosthenes {
private:
    vector<bool> isPrime;
    vector<int> primes;
    int maxN;
    
public:
    SieveOfEratosthenes(int n) : maxN(n) {
        sieve();
    }
    
    void sieve() {
        isPrime.assign(maxN + 1, true);
        isPrime[0] = isPrime[1] = false;
        
        for (int i = 2; i * i <= maxN; i++) {
            if (isPrime[i]) {
                // i의 배수들을 모두 제거
                for (int j = i * i; j <= maxN; j += i) {
                    isPrime[j] = false;
                }
            }
        }
        
        // 소수 리스트 생성
        for (int i = 2; i <= maxN; i++) {
            if (isPrime[i]) {
                primes.push_back(i);
            }
        }
    }
    
    bool checkPrime(int n) const {
        return n <= maxN && isPrime[n];
    }
    
    const vector<int>& getPrimes() const {
        return primes;
    }
    
    // 구간 [L, R]의 소수 개수
    int countPrimesInRange(int L, int R) const {
        if (R > maxN) R = maxN;
        if (L < 2) L = 2;
        
        int count = 0;
        for (int i = L; i <= R; i++) {
            if (isPrime[i]) count++;
        }
        return count;
    }
    
    // n번째 소수 반환
    int getNthPrime(int n) const {
        return n <= primes.size() ? primes[n - 1] : -1;
    }
};
```

### 3. 선형 체 (Linear Sieve)

```cpp
class LinearSieve {
private:
    vector<int> spf;  // smallest prime factor
    vector<int> primes;
    int maxN;
    
public:
    LinearSieve(int n) : maxN(n) {
        spf.resize(n + 1);
        linearSieve();
    }
    
    void linearSieve() {
        for (int i = 2; i <= maxN; i++) {
            if (spf[i] == 0) {  // i는 소수
                spf[i] = i;
                primes.push_back(i);
            }
            
            for (int j = 0; j < primes.size() && i * primes[j] <= maxN; j++) {
                spf[i * primes[j]] = primes[j];
                
                // 핵심: i가 primes[j]로 나누어떨어지면 중단
                if (i % primes[j] == 0) break;
            }
        }
    }
    
    bool isPrime(int n) const {
        return n > 1 && spf[n] == n;
    }
    
    // 소인수분해 O(log N)
    vector<pair<int, int>> factorize(int n) const {
        vector<pair<int, int>> factors;
        
        while (n > 1) {
            int p = spf[n];
            int count = 0;
            
            while (n % p == 0) {
                n /= p;
                count++;
            }
            
            factors.push_back({p, count});
        }
        
        return factors;
    }
    
    const vector<int>& getPrimes() const {
        return primes;
    }
};
```

## 고급 소수 판별

### 1. 밀러-라빈 소수 판별

```cpp
class MillerRabin {
private:
    // a^b mod m을 빠르게 계산
    static long long modPow(long long a, long long b, long long m) {
        long long result = 1;
        a %= m;
        
        while (b > 0) {
            if (b & 1) {
                result = (__int128)result * a % m;
            }
            a = (__int128)a * a % m;
            b >>= 1;
        }
        
        return result;
    }
    
    // 밀러-라빈 테스트 한 번 수행
    static bool millerTest(long long n, long long a) {
        if (n <= 1 || a <= 1 || a >= n - 1) return false;
        
        // n-1 = d * 2^r 형태로 분해
        long long d = n - 1;
        int r = 0;
        
        while (d % 2 == 0) {
            d /= 2;
            r++;
        }
        
        // a^d mod n 계산
        long long x = modPow(a, d, n);
        
        if (x == 1 || x == n - 1) return true;
        
        // r-1번 제곱하면서 확인
        for (int i = 0; i < r - 1; i++) {
            x = (__int128)x * x % n;
            if (x == n - 1) return true;
        }
        
        return false;
    }
    
public:
    // 확률적 소수 판별
    static bool isProbablePrime(long long n, int k = 10) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 == 0) return false;
        
        // 작은 소수들과 확인
        vector<int> smallPrimes = {3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37};
        for (int p : smallPrimes) {
            if (n == p) return true;
            if (n % p == 0) return false;
        }
        
        // k번의 밀러-라빈 테스트
        random_device rd;
        mt19937 gen(rd());
        uniform_int_distribution<long long> dis(2, n - 2);
        
        for (int i = 0; i < k; i++) {
            long long a = dis(gen);
            if (!millerTest(n, a)) return false;
        }
        
        return true;
    }
    
    // 결정적 밀러-라빈 (작은 수용)
    static bool isDeterministicPrime(long long n) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 == 0) return false;
        
        // 2^64 미만의 수에 대해 확실한 witnesses
        vector<long long> witnesses;
        if (n < 2047) witnesses = {2};
        else if (n < 1373653) witnesses = {2, 3};
        else if (n < 9080191) witnesses = {31, 73};
        else if (n < 25326001) witnesses = {2, 3, 5};
        else if (n < 3215031751) witnesses = {2, 3, 5, 7};
        else witnesses = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37};
        
        for (long long a : witnesses) {
            if (a >= n) continue;
            if (!millerTest(n, a)) return false;
        }
        
        return true;
    }
};
```

### 2. 소인수분해 알고리즘

```cpp
class Factorization {
public:
    // 단순한 소인수분해 O(√N)
    static vector<pair<long long, int>> factorizeSimple(long long n) {
        vector<pair<long long, int>> factors;
        
        // 2로 나누기
        if (n % 2 == 0) {
            int count = 0;
            while (n % 2 == 0) {
                n /= 2;
                count++;
            }
            factors.push_back({2, count});
        }
        
        // 홀수 소인수들
        for (long long i = 3; i * i <= n; i += 2) {
            if (n % i == 0) {
                int count = 0;
                while (n % i == 0) {
                    n /= i;
                    count++;
                }
                factors.push_back({i, count});
            }
        }
        
        // 남은 소수
        if (n > 1) {
            factors.push_back({n, 1});
        }
        
        return factors;
    }
    
    // 폴라드 로 알고리즘
    static long long pollardRho(long long n) {
        if (n % 2 == 0) return 2;
        
        auto f = [n](long long x) { return ((__int128)x * x + 1) % n; };
        
        long long x = 2, y = 2, d = 1;
        
        while (d == 1) {
            x = f(x);
            y = f(f(y));
            d = __gcd(abs(x - y), n);
        }
        
        return d == n ? -1 : d;
    }
    
    // 고급 소인수분해 (폴라드 로 + 밀러-라빈)
    static vector<long long> factorizePollard(long long n) {
        vector<long long> factors;
        
        function<void(long long)> factorize = [&](long long num) {
            if (num <= 1) return;
            
            if (MillerRabin::isDeterministicPrime(num)) {
                factors.push_back(num);
                return;
            }
            
            long long factor = pollardRho(num);
            if (factor == -1) {
                // 폴라드 로 실패시 단순 분해
                auto simpleFactors = factorizeSimple(num);
                for (auto& p : simpleFactors) {
                    for (int i = 0; i < p.second; i++) {
                        factors.push_back(p.first);
                    }
                }
            } else {
                factorize(factor);
                factorize(num / factor);
            }
        };
        
        factorize(n);
        sort(factors.begin(), factors.end());
        
        return factors;
    }
};
```

## 수론 함수들

### 1. 오일러 파이 함수

```cpp
class EulerTotient {
public:
    // 단일 수의 오일러 파이 함수 O(√N)
    static long long phi(long long n) {
        long long result = n;
        
        for (long long i = 2; i * i <= n; i++) {
            if (n % i == 0) {
                // 소인수 i 발견
                while (n % i == 0) n /= i;
                result -= result / i;
            }
        }
        
        // 남은 소인수 처리
        if (n > 1) {
            result -= result / n;
        }
        
        return result;
    }
    
    // 범위 [1, n]의 모든 φ(i) 계산 O(N log log N)
    static vector<long long> phiRange(int n) {
        vector<long long> phi(n + 1);
        
        // 초기화: φ(i) = i
        for (int i = 1; i <= n; i++) {
            phi[i] = i;
        }
        
        // 에라토스테네스의 체 방식으로 계산
        for (int i = 2; i <= n; i++) {
            if (phi[i] == i) {  // i는 소수
                for (int j = i; j <= n; j += i) {
                    phi[j] -= phi[j] / i;
                }
            }
        }
        
        return phi;
    }
    
    // 소인수분해 결과로부터 φ(n) 계산
    static long long phiFromFactors(const vector<pair<long long, int>>& factors) {
        long long result = 1;
        
        for (const auto& factor : factors) {
            long long p = factor.first;
            int k = factor.second;
            
            // φ(p^k) = p^(k-1) * (p-1)
            long long contribution = 1;
            for (int i = 0; i < k - 1; i++) {
                contribution *= p;
            }
            contribution *= (p - 1);
            
            result *= contribution;
        }
        
        return result;
    }
};
```

### 2. 최대공약수와 최소공배수

```cpp
class GCDandLCM {
public:
    // 확장 유클리드 호제법
    static long long extendedGCD(long long a, long long b, long long& x, long long& y) {
        if (b == 0) {
            x = 1;
            y = 0;
            return a;
        }
        
        long long x1, y1;
        long long gcd = extendedGCD(b, a % b, x1, y1);
        
        x = y1;
        y = x1 - (a / b) * y1;
        
        return gcd;
    }
    
    // 모듈러 역원 계산
    static long long modInverse(long long a, long long m) {
        long long x, y;
        long long gcd = extendedGCD(a, m, x, y);
        
        if (gcd != 1) return -1;  // 역원이 존재하지 않음
        
        return (x % m + m) % m;
    }
    
    // 여러 수의 GCD
    static long long multiGCD(const vector<long long>& numbers) {
        if (numbers.empty()) return 0;
        
        long long result = numbers[0];
        for (int i = 1; i < numbers.size(); i++) {
            result = __gcd(result, numbers[i]);
            if (result == 1) break;  // 더 이상 계산할 필요 없음
        }
        
        return result;
    }
    
    // 여러 수의 LCM
    static long long multiLCM(const vector<long long>& numbers) {
        if (numbers.empty()) return 0;
        
        long long result = numbers[0];
        for (int i = 1; i < numbers.size(); i++) {
            result = result / __gcd(result, numbers[i]) * numbers[i];
        }
        
        return result;
    }
    
    // 범위 [a, b]에서 gcd(i, n) = 1인 수의 개수
    static long long countCoprimesInRange(long long a, long long b, long long n) {
        if (b < a) return 0;
        
        auto countCoprimes = [n](long long x) -> long long {
            if (x <= 0) return 0;
            
            // 포함-배제 원리 사용
            vector<long long> primeFactors;
            long long temp = n;
            
            for (long long i = 2; i * i <= temp; i++) {
                if (temp % i == 0) {
                    primeFactors.push_back(i);
                    while (temp % i == 0) temp /= i;
                }
            }
            if (temp > 1) primeFactors.push_back(temp);
            
            long long result = x;
            int m = primeFactors.size();
            
            // 포함-배제 원리
            for (int mask = 1; mask < (1 << m); mask++) {
                long long product = 1;
                int bits = __builtin_popcount(mask);
                
                for (int i = 0; i < m; i++) {
                    if (mask & (1 << i)) {
                        product *= primeFactors[i];
                    }
                }
                
                if (bits % 2 == 1) {
                    result -= x / product;
                } else {
                    result += x / product;
                }
            }
            
            return result;
        };
        
        return countCoprimes(b) - countCoprimes(a - 1);
    }
};
```

## 실전 문제 해결

### 백준 예제 문제들

#### 1. 소수 구하기 (1929)
```cpp
int main() {
    int M, N;
    cin >> M >> N;
    
    SieveOfEratosthenes sieve(N);
    
    for (int i = M; i <= N; i++) {
        if (sieve.checkPrime(i)) {
            cout << i << "\n";
        }
    }
    
    return 0;
}
```

#### 2. 소인수분해 (11653)
```cpp
int main() {
    int N;
    cin >> N;
    
    if (N == 1) return 0;
    
    auto factors = Factorization::factorizeSimple(N);
    
    for (const auto& factor : factors) {
        for (int i = 0; i < factor.second; i++) {
            cout << factor.first << "\n";
        }
    }
    
    return 0;
}
```

#### 3. 최대공약수와 최소공배수 (2609)
```cpp
int main() {
    int a, b;
    cin >> a >> b;
    
    int gcd = __gcd(a, b);
    int lcm = a / gcd * b;
    
    cout << gcd << "\n" << lcm << "\n";
    
    return 0;
}
```

## 최적화 기법

### 1. 메모리 최적화된 체

```cpp
class SegmentedSieve {
public:
    // 구간 [L, R]의 소수들 찾기
    static vector<long long> segmentedSieve(long long L, long long R) {
        // √R까지의 소수들 먼저 구하기
        long long sqrtR = sqrt(R) + 1;
        SieveOfEratosthenes baseSieve(sqrtR);
        const vector<int>& basePrimes = baseSieve.getPrimes();
        
        // 구간 [L, R]을 위한 배열
        vector<bool> isPrime(R - L + 1, true);
        
        // 기본 소수들로 구간의 합성수들 제거
        for (int p : basePrimes) {
            long long start = max(p * p, (L + p - 1) / p * p);
            
            for (long long j = start; j <= R; j += p) {
                isPrime[j - L] = false;
            }
        }
        
        // 1은 소수가 아님
        if (L == 1) isPrime[0] = false;
        
        // 결과 수집
        vector<long long> primes;
        for (long long i = L; i <= R; i++) {
            if (isPrime[i - L]) {
                primes.push_back(i);
            }
        }
        
        return primes;
    }
};
```

### 2. 빠른 거듭제곱

```cpp
class FastExponentiation {
public:
    // a^b mod m 계산
    static long long modPow(long long a, long long b, long long m) {
        long long result = 1;
        a %= m;
        
        while (b > 0) {
            if (b & 1) {
                result = (__int128)result * a % m;
            }
            a = (__int128)a * a % m;
            b >>= 1;
        }
        
        return result;
    }
    
    // 행렬 거듭제곱 (피보나치 등에 활용)
    static vector<vector<long long>> matrixPow(vector<vector<long long>> A, long long n, long long mod) {
        int size = A.size();
        vector<vector<long long>> result(size, vector<long long>(size, 0));
        
        // 단위 행렬로 초기화
        for (int i = 0; i < size; i++) {
            result[i][i] = 1;
        }
        
        while (n > 0) {
            if (n & 1) {
                result = multiplyMatrix(result, A, mod);
            }
            A = multiplyMatrix(A, A, mod);
            n >>= 1;
        }
        
        return result;
    }
    
private:
    static vector<vector<long long>> multiplyMatrix(const vector<vector<long long>>& A, 
                                                  const vector<vector<long long>>& B, 
                                                  long long mod) {
        int n = A.size();
        vector<vector<long long>> C(n, vector<long long>(n, 0));
        
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                for (int k = 0; k < n; k++) {
                    C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % mod;
                }
            }
        }
        
        return C;
    }
};
```

## 주의사항과 팁

### 1. 오버플로우 방지
```cpp
// 안전한 곱셈 (오버플로우 체크)
bool safeMul(long long a, long long b, long long& result) {
    if (a == 0 || b == 0) {
        result = 0;
        return true;
    }
    
    if (a > LLONG_MAX / b) return false;  // 오버플로우
    
    result = a * b;
    return true;
}
```

### 2. 성능 최적화
```cpp
// 컴파일 타임 소수 생성 (C++14 이상)
constexpr bool isPrimeConstexpr(int n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    
    for (int i = 5; i * i <= n; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0) {
            return false;
        }
    }
    
    return true;
}
```

### 3. 디버깅 도구
```cpp
void debugPrimeFactors(long long n) {
    cout << n << " = ";
    auto factors = Factorization::factorizeSimple(n);
    
    bool first = true;
    for (const auto& factor : factors) {
        if (!first) cout << " × ";
        
        if (factor.second == 1) {
            cout << factor.first;
        } else {
            cout << factor.first << "^" << factor.second;
        }
        
        first = false;
    }
    cout << endl;
}
```

## 연관 알고리즘
- **[modular arithmetic](/post/algorithms/modular-arithmetic)**: 모듈러 연산
- **[number theory](/post/algorithms/number-theory)**: 수론 심화
- **[cryptography](/post/algorithms/cryptography)**: 암호화 응용

## 마무리

소수와 소인수분해는 수학적 계산과 암호학의 기초가 되는 중요한 알고리즘입니다. 단순한 방법부터 고급 확률적 알고리즘까지 다양한 접근법을 상황에 맞게 선택하여 사용하세요.

**학습 순서**: 기본 소수 판별 → 에라토스테네스의 체 → 밀러-라빈 테스트 → 소인수분해 → 수론 함수