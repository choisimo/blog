---
title: "[알고리즘] 구간 병합 (Merge Intervals)"
date: "2025-07-02"
category: "Algorithm"
tags: ["Algorithm", "정렬+스캔", "Problem Solving", "Python", "Java"]
excerpt: "Sorting & Binary Search - 구간 병합 (Merge Intervals) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

구간 병합은 간단한 배열 정리가 아니라, 시간축 자원 사용 구간들을 정렬된 이벤트 흐름으로 재구성하는 문제입니다. 구간이 start 기준으로 정렬되면 왜 한 번의 스캔만으로 겹침 관계를 복원할 수 있는지 설명해 보세요.

1. 현재 병합 중인 구간과 다음 구간의 `start/end`를 비교하며 어떤 순간에 extend가 되고, 어떤 순간에 flush가 되는지 추적하세요.
2. 정렬 없이 모든 구간 쌍을 비교하는 방식과 정렬+스캔 방식을 시간 복잡도, 캐시 패턴, 병렬성 관점에서 비교하세요.
3. 닫힌 구간/반열린 구간, 실수 좌표, 분산 로그 윈도우처럼 정의가 바뀌면 merge 조건이 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- 병합 중인 현재 구간 상태를 적을 것
- flush 조건과 extend 조건을 분리할 것
- 구간 정의가 바뀌면 비교식이 어떻게 달라지는지 적을 것

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
