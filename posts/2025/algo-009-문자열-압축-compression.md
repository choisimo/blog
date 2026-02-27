---
title: "[알고리즘] 문자열 압축 (Compression)"
date: "2025-04-20"
category: "Algorithm"
tags: ["Algorithm", "RLE", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 문자열 압축 (Compression) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**문자열 압축 (Compression)**
* 파트: Array & String Fundamentals
* 관련 알고리즘: RLE

> **Architect's View**
> 데이터 직렬화 패턴

이 글에서는 문자열 압축 (Compression) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 009: 문자열 압축 (String Compression / Run-Length Encoding)
==========================================================

[문제 설명]
문자 배열을 Run-Length Encoding으로 in-place 압축.
연속 반복 문자를 [문자][횟수]로 변환. 횟수가 1이면 숫자 생략.

[아키텍트의 시선 - 데이터 직렬화(Serialization) 패턴]
RLE는 가장 단순한 직렬화 프로토콜.
실무: Protocol Buffers, MessagePack 등 직렬화 형식의 기초.
핵심: 읽기 포인터와 쓰기 포인터의 분리 + 상태 누적.

[시간 복잡도] O(n) [공간 복잡도] O(1)
"""

from typing import List


def compress(chars: List[str]) -> int:
    write = 0
    read = 0
    n = len(chars)

    while read < n:
        current_char = chars[read]
        count = 0

        while read < n and chars[read] == current_char:
            read += 1
            count += 1

        chars[write] = current_char
        write += 1

        if count > 1:
            for digit in str(count):
                chars[write] = digit
                write += 1

    return write


if __name__ == "__main__":
    c1 = ["a", "a", "b", "b", "c", "c", "c"]
    length1 = compress(c1)
    assert length1 == 6 and c1[:length1] == ["a", "2", "b", "2", "c", "3"]

    c2 = ["a"]
    length2 = compress(c2)
    assert length2 == 1 and c2[:length2] == ["a"]

    c3 = ["a", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b"]
    length3 = compress(c3)
    assert length3 == 4 and c3[:length3] == ["a", "b", "1", "2"]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 009: 문자열 압축 (String Compression / RLE)
 * [문제] 연속 반복 문자를 "문자+횟수"로 압축하라.
 * [아키텍트의 시선] Run-Length Encoding과 데이터 직렬화.
 * 데이터 압축의 가장 기본적인 형태. 이미지/팩스에서 사용.
 * 실무: 데이터 직렬화, 로그 압축, 네트워크 패킷 압축.
 * [시간 복잡도] O(n) [공간 복잡도] O(n)
 */
public class P009StringCompression {
    public static String compress(String s) {
        if (s == null || s.isEmpty()) return s;
        StringBuilder sb = new StringBuilder();
        int count = 1;
        for (int i = 1; i <= s.length(); i++) {
            if (i < s.length() && s.charAt(i) == s.charAt(i - 1)) {
                count++;
            } else {
                sb.append(s.charAt(i - 1));
                if (count > 1) sb.append(count);
                count = 1;
            }
        }
        return sb.length() < s.length() ? sb.toString() : s;
    }

    public static void main(String[] args) {
        assert compress("aabcccccaaa").equals("a2bc5a3");
        assert compress("abc").equals("abc");
        assert compress("aaa").equals("a3");
        assert compress("").equals("");
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
