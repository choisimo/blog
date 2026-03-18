---
title: "[알고리즘] 문자열 압축 (Compression)"
date: "2025-04-20"
category: "Algorithm"
tags: ["Algorithm", "RLE", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 문자열 압축 (Compression) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

문자열 압축은 "문자를 줄인다"가 아니라, 연속 구간을 다른 표현으로 직렬화하면서도 디코더가 경계를 복원할 수 있게 만드는 문제입니다. `['a','a','b','b','c','c','c']`를 예로 들어, run-length encoding이 실제로 어떤 메모리 변환을 수행하는지 설명해 보세요.

1. `read`와 `write` 포인터가 각 run의 시작과 끝을 어떻게 식별하는지 추적하고, 왜 압축 결과가 원본보다 길어질 수도 있는지 설명하세요.
2. RLE, 해시 기반 중복 제거, 사전 기반 압축(LZ 계열)을 데이터 분포, CPU 분기 수, 직렬화/역직렬화 복잡도 관점에서 비교하세요.
3. 로그 스트림처럼 chunk 단위로 입력이 끊겨 도착할 때, run 경계가 chunk를 가로지르면 어떤 상태를 다음 chunk로 넘겨야 하는지 설명하세요.

## 답변할 때 포함할 것

- 각 run의 길이와 write 위치를 적을 것
- 압축률이 입력 분포에 따라 달라지는 이유를 설명할 것
- 복원 가능성 조건을 명시할 것

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
