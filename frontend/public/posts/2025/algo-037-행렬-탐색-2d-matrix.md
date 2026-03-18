---
title: "[알고리즘] 행렬 탐색 (2D Matrix)"
date: "2025-06-26"
category: "Algorithm"
tags: ["Algorithm", "2D 이진탐색", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 행렬 탐색 (2D Matrix) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

2D 행렬 탐색은 2차원 구조를 1차원 정렬 공간으로 재해석할 수 있을 때만 가능한 좌표 변환 문제입니다. 왜 `row * n + col` 같은 선형화가 의미를 가지는지, 그리고 그 전제 조건이 무엇인지 설명해 보세요.

1. 중간 인덱스를 2D 좌표로 환산하는 과정을 추적하고, 행렬의 정렬 조건이 어떻게 1D 단조성과 연결되는지 설명하세요.
2. 행별 이진 탐색, 계단식 탐색, 완전 1D 선형화 탐색을 메모리 접근 패턴과 구현 복잡도 관점에서 비교하세요.
3. 행과 열이 각각 정렬되었지만 전체 선형화 정렬은 보장되지 않는 경우 왜 같은 방법을 그대로 쓸 수 없는지 설명하세요.

## 답변할 때 포함할 것

- 1D 인덱스와 2D 좌표 대응을 적을 것
- 선형화가 성립하는 조건을 명시할 것
- 다른 행렬 정렬 모델과 구분해서 설명할 것

## 🐍 Python 구현

```python
"""
==========================================================
문제 037: 행렬 탐색 (Search a 2D Matrix)
==========================================================
[문제] 각 행이 정렬되고, 다음 행의 시작이 이전 행 끝보다 큰 2D 행렬에서 탐색.
[아키텍트의 시선 - 다차원 매핑과 좌표 변환]
m×n 행렬을 1D 배열로 간주: index → (row, col) = (i//n, i%n).
실무: 다차원 데이터의 선형 인덱싱 (이미지, 텐서).
[시간 복잡도] O(log(m*n)) [공간 복잡도] O(1)
"""
from typing import List

def search_matrix(matrix: List[List[int]], target: int) -> bool:
    if not matrix:
        return False
    m, n = len(matrix), len(matrix[0])
    left, right = 0, m * n - 1
    while left <= right:
        mid = (left + right) // 2
        val = matrix[mid // n][mid % n]
        if val == target:
            return True
        elif val < target:
            left = mid + 1
        else:
            right = mid - 1
    return False

if __name__ == "__main__":
    mat = [[1,3,5,7],[10,11,16,20],[23,30,34,60]]
    assert search_matrix(mat, 3) is True
    assert search_matrix(mat, 13) is False
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 037: 2D 행렬 탐색 (Search a 2D Matrix)
 *
 * [문제] 행과 열이 정렬된 m x n 행렬에서 타겟 값을 찾아라.
 * 각 행의 첫 번째 값은 이전 행의 마지막 값보다 크다.
 *
 * [아키텍트의 시선]
 * 2D 행렬을 1D로 매핑한 이진 탐색은 다차원 인덱스를
 * 선형 주소 공간으로 변환하는 것이다.
 * 가상 메모리의 페이지 테이블, 분산 해시의 일관된 해싱과 동일한 원리다.
 *
 * [시간 복잡도] O(log(m*n)) [공간 복잡도] O(1)
 */
public class P037Search2DMatrix {
    public static boolean searchMatrix(int[][] matrix, int target) {
        if (matrix.length == 0 || matrix[0].length == 0) return false;
        int m = matrix.length, n = matrix[0].length;
        int left = 0, right = m * n - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;
            int val = matrix[mid / n][mid % n]; // 1D→2D 좌표 변환
            if (val == target) return true;
            else if (val < target) left = mid + 1;
            else right = mid - 1;
        }
        return false;
    }

    public static void main(String[] args) {
        int[][] m1 = {{1,3,5,7},{10,11,16,20},{23,30,34,60}};
        assert searchMatrix(m1, 3);
        assert !searchMatrix(m1, 13);
        assert searchMatrix(new int[][]{{1}}, 1);
        assert !searchMatrix(new int[][]{{1}}, 2);
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
