---
title: "[알고리즘] 파스칼의 삼각형 (Pascal's)"
date: "2025-04-23"
category: "Algorithm"
tags: ["Algorithm", "점화식", "Problem Solving", "Python", "Java"]
excerpt: "Array & String Fundamentals - 파스칼의 삼각형 (Pascal's) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

파스칼의 삼각형은 숫자 나열 문제가 아니라, 이전 상태가 다음 상태의 생성 규칙을 완전히 결정하는 DP 테이블 생성 문제입니다. `numRows=5`일 때 각 셀이 어느 두 부모에서 왔는지, 그리고 왜 가장자리 값은 항상 1인지 설명해 보세요.

1. 행이 하나씩 생성될 때 각 내부 셀 `row[i][j]`가 어떤 이전 행 데이터를 읽는지 추적하고, 데이터 의존성 때문에 어떤 채우기 순서가 강제되는지 설명하세요.
2. 전체 2D 테이블 보관, 직전 행만 보관, 조합식 직접 계산 방식을 메모리 사용량, 오버플로우 위험, 재사용성 관점에서 비교하세요.
3. 이 구조를 네트워크 경로 수 계산, 격자 DP, 이항계수 캐시로 일반화하면 어떤 공통 불변식이 유지되는지 설명하세요.

## 답변할 때 포함할 것

- 최소 5행까지 생성 과정을 적을 것
- 가장자리와 내부 셀의 규칙을 분리할 것
- 저장 전략에 따른 메모리 trade-off를 설명할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 010: 파스칼의 삼각형 (Pascal's Triangle)
==========================================================

[문제 설명]
양의 정수 numRows가 주어질 때, 파스칼의 삼각형의 처음 numRows개 행을 생성.

[아키텍트의 시선 - 메모이제이션과 점화식 기반 데이터 생성]
점화식: T[i][j] = T[i-1][j-1] + T[i-1][j]
이전 행의 결과로 현재 행을 계산 → Bottom-up DP의 기초.
실무: 캐시 워밍업, 조합론 기반 확률 계산, 이항 계수.

[시간 복잡도] O(n²) [공간 복잡도] O(n²)
"""

from typing import List


def generate(num_rows: int) -> List[List[int]]:
    triangle = []

    for i in range(num_rows):
        row = [1] * (i + 1)
        for j in range(1, i):
            row[j] = triangle[i - 1][j - 1] + triangle[i - 1][j]
        triangle.append(row)

    return triangle


if __name__ == "__main__":
    assert generate(5) == [
        [1],
        [1, 1],
        [1, 2, 1],
        [1, 3, 3, 1],
        [1, 4, 6, 4, 1],
    ]
    assert generate(1) == [[1]]
    assert generate(2) == [[1], [1, 1]]

    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 010: 파스칼의 삼각형 (Pascal's Triangle)
 * [문제] n개 행의 파스칼 삼각형을 생성하라.
 * [아키텍트의 시선] 메모이제이션과 데이터 생성 패턴.
 * row[j] = prev[j-1] + prev[j]. 이전 결과로 다음을 생성.
 * 실무: 조합론, 확률 계산, 다항 계수.
 * [시간 복잡도] O(n^2) [공간 복잡도] O(n^2)
 */
import java.util.*;

public class P010PascalsTriangle {
    public static List<List<Integer>> generate(int numRows) {
        List<List<Integer>> triangle = new ArrayList<>();
        for (int i = 0; i < numRows; i++) {
            List<Integer> row = new ArrayList<>();
            for (int j = 0; j <= i; j++) {
                if (j == 0 || j == i) {
                    row.add(1);
                } else {
                    row.add(triangle.get(i-1).get(j-1) + triangle.get(i-1).get(j));
                }
            }
            triangle.add(row);
        }
        return triangle;
    }

    public static void main(String[] args) {
        List<List<Integer>> result = generate(5);
        assert result.get(0).equals(Arrays.asList(1));
        assert result.get(1).equals(Arrays.asList(1, 1));
        assert result.get(2).equals(Arrays.asList(1, 2, 1));
        assert result.get(3).equals(Arrays.asList(1, 3, 3, 1));
        assert result.get(4).equals(Arrays.asList(1, 4, 6, 4, 1));
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
