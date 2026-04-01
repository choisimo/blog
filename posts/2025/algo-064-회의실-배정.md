---
title: "[알고리즘] 회의실 배정"
date: "2025-09-01"
category: "Algorithm"
tags: ["Algorithm", "이벤트 정렬", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - 회의실 배정 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

회의실 배정은 간격 배열 문제라기보다, 시간이 흐르면서 재사용 가능한 자원 중 가장 빨리 풀리는 자원을 추적하는 스케줄링 문제입니다. end time min-heap이 왜 "가장 먼저 반환될 자원 집합"을 표현하는지 설명해 보세요.

1. 시작 시간이 증가하는 순서로 회의를 읽을 때, 힙에 어떤 종료 시간이 남아 있고 언제 재사용/신규 할당이 결정되는지 추적하세요.
2. 모든 회의실 상태를 매번 다시 스캔하는 방식과 min-heap 방식을 자원 수가 커질 때 비교하세요.
3. 회의실 수 최소화가 아니라 회의실 번호 배정, 우선순위, cleaning time이 들어오면 상태가 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- 힙이 표현하는 자원 상태를 적을 것
- 재사용 조건을 명시할 것
- 단순 개수 문제와 실제 스케줄링 문제 차이를 적을 것

## 🐍 Python 구현

```python
"""
문제 064: 회의실 배정 (Meeting Rooms II)
[문제] 회의 시간표 intervals[i]=[start, end]가 주어질 때
       동시에 필요한 최소 회의실 수를 구하라.
[아키텍트의 시선] 자원 할당 최적화.
이벤트 포인트 기법: 시작(+1), 종료(-1)로 변환 후 정렬 → 최대 동시 수.
또는 min-heap으로 가장 빨리 끝나는 회의 추적.
실무: 서버 동시 접속 수, 쿠버네티스 파드 스케줄링, 리소스 풀 관리.
[시간 복잡도] O(n log n) [공간 복잡도] O(n)
"""
from typing import List
import heapq

def min_meeting_rooms_heap(intervals: List[List[int]]) -> int:
    """힙 기반: 가장 빨리 끝나는 회의실 재사용"""
    if not intervals:
        return 0
    intervals.sort(key=lambda x: x[0])
    heap = []  # 종료 시간 min-heap
    for start, end in intervals:
        if heap and heap[0] <= start:
            heapq.heappop(heap)  # 회의실 재사용
        heapq.heappush(heap, end)
    return len(heap)

def min_meeting_rooms_sweep(intervals: List[List[int]]) -> int:
    """스위프 라인: 이벤트 포인트"""
    events = []
    for start, end in intervals:
        events.append((start, 1))   # 시작: +1
        events.append((end, -1))    # 종료: -1
    events.sort()
    max_rooms = current = 0
    for _, delta in events:
        current += delta
        max_rooms = max(max_rooms, current)
    return max_rooms

if __name__ == "__main__":
    assert min_meeting_rooms_heap([[0,30],[5,10],[15,20]]) == 2
    assert min_meeting_rooms_sweep([[0,30],[5,10],[15,20]]) == 2
    assert min_meeting_rooms_heap([[7,10],[2,4]]) == 1
    assert min_meeting_rooms_sweep([[7,10],[2,4]]) == 1
    assert min_meeting_rooms_heap([[1,5],[2,6],[3,7],[4,8]]) == 4
    assert min_meeting_rooms_heap([]) == 0
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 064: 회의실 배정 (Meeting Rooms II)
 *
 * [문제] 회의 시간표가 주어질 때, 필요한 최소 회의실 수를 구하라.
 *
 * [아키텍트의 시선]
 * 동시 리소스 사용량의 최대치를 구하는 것은 서버 용량 계획,
 * 커넥션 풀 크기 결정, 스레드 풀 최적화와 동일한 문제다.
 * 이벤트 정렬 + 스위핑 기법은 시계열 이벤트 처리의 기본이다.
 *
 * [시간 복잡도] O(n log n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P064MeetingRooms {
    public static int minMeetingRooms(int[][] intervals) {
        if (intervals.length == 0) return 0;

        // 이벤트 기반 풀이: 시작 +1, 끝 -1
        int[] starts = new int[intervals.length];
        int[] ends = new int[intervals.length];
        for (int i = 0; i < intervals.length; i++) {
            starts[i] = intervals[i][0];
            ends[i] = intervals[i][1];
        }
        Arrays.sort(starts);
        Arrays.sort(ends);

        int rooms = 0, maxRooms = 0, endPtr = 0;
        for (int i = 0; i < starts.length; i++) {
            if (starts[i] < ends[endPtr]) {
                rooms++;
            } else {
                endPtr++;
            }
            maxRooms = Math.max(maxRooms, rooms);
        }
        return maxRooms;
    }

    public static void main(String[] args) {
        assert minMeetingRooms(new int[][]{{0,30},{5,10},{15,20}}) == 2;
        assert minMeetingRooms(new int[][]{{7,10},{2,4}}) == 1;
        assert minMeetingRooms(new int[][]{}) == 0;
        assert minMeetingRooms(new int[][]{{1,5},{2,6},{3,7},{4,8}}) == 4;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
