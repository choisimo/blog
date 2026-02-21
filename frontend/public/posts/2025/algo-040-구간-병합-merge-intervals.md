---
title: "[알고리즘] 구간 병합 (Merge Intervals)"
date: "2025-07-02"
category: "Algorithm"
tags: ["Algorithm", "정렬+스캔", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 구간 병합 (Merge Intervals) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**구간 병합 (Merge Intervals)**
* 파트: Sorting & Binary Search
* 관련 알고리즘: 정렬+스캔

> **Architect's View**
> 이벤트 기반 구간 관리

이 글에서는 구간 병합 (Merge Intervals) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 040: 구간 병합 (Merge Intervals)
==========================================================
[문제] 겹치는 구간들을 병합하라.
[아키텍트의 시선 - 이벤트 기반 정렬과 구간 관리]
시작점으로 정렬 → 순회하며 겹침 판단 후 병합.
실무: 일정 관리, IP 범위 병합, 시계열 데이터 구간 합치기.
[시간 복잡도] O(n log n) [공간 복잡도] O(n)
"""
from typing import List

def merge_intervals(intervals: List[List[int]]) -> List[List[int]]:
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged

if __name__ == "__main__":
    assert merge_intervals([[1,3],[2,6],[8,10],[15,18]]) == [[1,6],[8,10],[15,18]]
    assert merge_intervals([[1,4],[4,5]]) == [[1,5]]
    assert merge_intervals([[1,4],[0,4]]) == [[0,4]]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 040: 구간 병합 (Merge Intervals)
 *
 * [문제] 겹치는 구간들을 병합하라.
 *
 * [아키텍트의 시선]
 * 구간 병합은 캘린더 시스템의 일정 충돌 감지,
 * 메모리 할당기의 프리 블록 병합, IP 대역 통합,
 * 시계열 데이터의 중복 기간 제거에 직접 활용된다.
 * 정렬 후 순차 병합은 스트림 처리의 기본 패턴이다.
 *
 * [시간 복잡도] O(n log n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P040MergeIntervals {
    public static int[][] merge(int[][] intervals) {
        if (intervals.length <= 1) return intervals;
        Arrays.sort(intervals, (a, b) -> a[0] - b[0]); // 시작점 기준 정렬

        List<int[]> merged = new ArrayList<>();
        int[] current = intervals[0];
        merged.add(current);

        for (int i = 1; i < intervals.length; i++) {
            if (intervals[i][0] <= current[1]) {
                // 겹침 → 끝점을 확장
                current[1] = Math.max(current[1], intervals[i][1]);
            } else {
                // 겹치지 않음 → 새 구간 추가
                current = intervals[i];
                merged.add(current);
            }
        }
        return merged.toArray(new int[0][]);
    }

    public static void main(String[] args) {
        int[][] r1 = merge(new int[][]{{1,3},{2,6},{8,10},{15,18}});
        assert Arrays.deepEquals(r1, new int[][]{{1,6},{8,10},{15,18}});

        int[][] r2 = merge(new int[][]{{1,4},{4,5}});
        assert Arrays.deepEquals(r2, new int[][]{{1,5}});

        int[][] r3 = merge(new int[][]{{1,4},{0,4}});
        assert Arrays.deepEquals(r3, new int[][]{{0,4}});
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
