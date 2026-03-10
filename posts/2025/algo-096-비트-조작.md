---
title: "[알고리즘] 비트 조작"
date: "2025-11-20"
category: "Algorithm"
tags: ["Algorithm", "XOR/AND/OR", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 비트 조작 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**비트 조작**
* 파트: Advanced Topics
* 관련 알고리즘: XOR/AND/OR

> **Architect's View**
> 공간 효율적 상태 표현

이 글에서는 비트 조작 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 096: 비트 조작 (Bit Manipulation)
[문제] 비트 연산으로 다양한 문제를 풀어라.
  1) 배열에서 하나만 존재하는 수 찾기 (XOR)
  2) 2의 거듭제곱 판별 (AND)
  3) 비트 뒤집기
  4) 두 정수의 비트 차이 (해밍 거리)
[아키텍트의 시선] 공간 효율적 상태 표현.
XOR: a^a=0, a^0=a → 중복 상쇄. AND: 마스킹, 특정 비트 추출.
실무: 해시 함수, 암호화, 플래그 관리, 네트워크 서브넷 마스킹.
[시간 복잡도] O(n) / O(1) [공간 복잡도] O(1)
"""
from typing import List

def single_number(nums: List[int]) -> int:
    """XOR: 하나만 존재하는 수"""
    result = 0
    for n in nums:
        result ^= n
    return result

def is_power_of_two(n: int) -> bool:
    """n & (n-1) == 0 이면 2의 거듭제곱"""
    return n > 0 and (n & (n - 1)) == 0

def reverse_bits(n: int) -> int:
    """32비트 정수 비트 뒤집기"""
    result = 0
    for _ in range(32):
        result = (result << 1) | (n & 1)
        n >>= 1
    return result

def hamming_distance(x: int, y: int) -> int:
    """두 정수의 해밍 거리"""
    xor = x ^ y
    count = 0
    while xor:
        count += xor & 1
        xor >>= 1
    return count

if __name__ == "__main__":
    assert single_number([2,2,1]) == 1
    assert single_number([4,1,2,1,2]) == 4
    assert is_power_of_two(1) == True
    assert is_power_of_two(16) == True
    assert is_power_of_two(6) == False
    assert is_power_of_two(0) == False
    assert reverse_bits(0b00000000000000000000000000001011) == 0b11010000000000000000000000000000
    assert hamming_distance(1, 4) == 2  # 001 vs 100
    assert hamming_distance(3, 1) == 1  # 11 vs 01
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 096: 비트 조작 (Bit Manipulation)
 *
 * [문제] 비트 연산으로 다양한 문제를 풀어라.
 *   1) 배열에서 하나만 존재하는 수 찾기 (XOR)
 *   2) 2의 거듭제곱 판별 (AND)
 *   3) 비트 뒤집기
 *   4) 두 정수의 비트 차이 (해밍 거리)
 *
 * [아키텍트의 시선]
 * 공간 효율적 상태 표현.
 * XOR: a^a=0, a^0=a -> 중복 상쇄. AND: 마스킹, 특정 비트 추출.
 * 실무: 해시 함수, 암호화, 플래그 관리, 네트워크 서브넷 마스킹.
 *
 * [시간 복잡도] O(n) / O(1) [공간 복잡도] O(1)
 */

public class P096BitManipulation {
    // XOR: 하나만 존재하는 수
    public static int singleNumber(int[] nums) {
        int result = 0;
        for (int n : nums) result ^= n;
        return result;
    }

    // n & (n-1) == 0 이면 2의 거듭제곱
    public static boolean isPowerOfTwo(int n) {
        return n > 0 && (n & (n - 1)) == 0;
    }

    // 32비트 정수 비트 뒤집기
    public static int reverseBits(int n) {
        int result = 0;
        for (int i = 0; i < 32; i++) {
            result = (result << 1) | (n & 1);
            n >>= 1;
        }
        return result;
    }

    // 두 정수의 해밍 거리
    public static int hammingDistance(int x, int y) {
        int xor = x ^ y;
        int count = 0;
        while (xor != 0) {
            count += xor & 1;
            xor >>= 1;
        }
        return count;
    }

    public static void main(String[] args) {
        assert singleNumber(new int[]{2,2,1}) == 1;
        assert singleNumber(new int[]{4,1,2,1,2}) == 4;
        assert isPowerOfTwo(1) == true;
        assert isPowerOfTwo(16) == true;
        assert isPowerOfTwo(6) == false;
        assert isPowerOfTwo(0) == false;
        assert reverseBits(0b00000000000000000000000000001011) == 0b11010000000000000000000000000000;
        assert hammingDistance(1, 4) == 2;  // 001 vs 100
        assert hammingDistance(3, 1) == 1;  // 11 vs 01
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
