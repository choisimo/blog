---
title: "[알고리즘] 활동 선택 (Greedy)"
date: "2025-11-15"
category: "Algorithm"
tags: ["Algorithm", "탐욕 선택", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 활동 선택 (Greedy) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

활동 선택은 일정 문제라기보다, 미래 선택 가능성을 최대화하는 로컬 선택이 전체 최적을 보장하는지 묻는 탐욕 증명 문제입니다. 왜 가장 빨리 끝나는 활동을 먼저 고르는 것이 핵심인지 설명해 보세요.

1. 종료 시간 기준 정렬 뒤 어떤 활동이 선택되고 어떤 활동이 버려지는지 추적하세요.
2. 시작 시간이 빠른 활동, 길이가 짧은 활동, 끝나는 시간이 빠른 활동 기준을 반례와 함께 비교하세요.
3. 가중치가 붙거나 여러 자원이 있을 때 왜 단순 탐욕이 깨지고 DP/매칭으로 넘어가야 하는지 설명하세요.

## 답변할 때 포함할 것

- 교환 논증(exchange argument)을 설명할 것
- 반례를 하나 제시할 것
- 무가중치/가중치 문제를 구분할 것

## 🐍 Python 구현

```python
"""
문제 094: 활동 선택 문제 (Activity Selection - Greedy)
[문제] 시작/종료 시간이 주어진 활동들 중 겹치지 않는 최대 활동 수를 구하라.
[아키텍트의 시선] 탐욕 선택 속성과 최적성 증명.
종료 시간 기준 정렬 → 가장 빨리 끝나는 활동 선택 → 남은 시간 최대화.
탐욕이 최적인 이유: 교환 논증(Exchange Argument)으로 증명 가능.
실무: 회의실 최대 활용, CPU 스케줄링(SJF), 자원 할당.
[시간 복잡도] O(n log n) [공간 복잡도] O(n)
"""
from typing import List, Tuple

def activity_selection(activities: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    """종료 시간 기준 탐욕 선택"""
    sorted_acts = sorted(activities, key=lambda x: x[1])
    selected = [sorted_acts[0]]
    for start, end in sorted_acts[1:]:
        if start >= selected[-1][1]:
            selected.append((start, end))
    return selected

def max_activities_count(activities: List[Tuple[int, int]]) -> int:
    return len(activity_selection(activities))

if __name__ == "__main__":
    acts = [(1,4), (3,5), (0,6), (5,7), (3,9), (5,9), (6,10), (8,11), (8,12), (2,14), (12,16)]
    selected = activity_selection(acts)
    assert len(selected) == 4  # (1,4), (5,7), (8,11), (12,16)
    # 겹침 없는지 검증
    for i in range(1, len(selected)):
        assert selected[i][0] >= selected[i-1][1]
    acts2 = [(1,2), (2,3), (3,4)]
    assert max_activities_count(acts2) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 094: 활동 선택 문제 (Activity Selection - Greedy)
 *
 * [문제] 시작/종료 시간이 주어진 활동들 중 겹치지 않는 최대 활동 수를 구하라.
 *
 * [아키텍트의 시선]
 * 탐욕 선택 속성과 최적성 증명.
 * 종료 시간 기준 정렬 -> 가장 빨리 끝나는 활동 선택 -> 남은 시간 최대화.
 * 탐욕이 최적인 이유: 교환 논증(Exchange Argument)으로 증명 가능.
 * 실무: 회의실 최대 활용, CPU 스케줄링(SJF), 자원 할당.
 *
 * [시간 복잡도] O(n log n) [공간 복잡도] O(n)
 */
import java.util.*;

public class P094ActivitySelection {
    // 종료 시간 기준 탐욕 선택
    public static List<int[]> activitySelection(int[][] activities) {
        int[][] sorted = activities.clone();
        Arrays.sort(sorted, (a, b) -> a[1] - b[1]);
        List<int[]> selected = new ArrayList<>();
        selected.add(sorted[0]);
        for (int i = 1; i < sorted.length; i++) {
            if (sorted[i][0] >= selected.get(selected.size() - 1)[1]) {
                selected.add(sorted[i]);
            }
        }
        return selected;
    }

    public static int maxActivitiesCount(int[][] activities) {
        return activitySelection(activities).size();
    }

    public static void main(String[] args) {
        int[][] acts = {{1,4},{3,5},{0,6},{5,7},{3,9},{5,9},{6,10},{8,11},{8,12},{2,14},{12,16}};
        List<int[]> selected = activitySelection(acts);
        assert selected.size() == 4; // (1,4), (5,7), (8,11), (12,16)
        // 겹침 없는지 검증
        for (int i = 1; i < selected.size(); i++) {
            assert selected.get(i)[0] >= selected.get(i - 1)[1];
        }
        int[][] acts2 = {{1,2},{2,3},{3,4}};
        assert maxActivitiesCount(acts2) == 3;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
