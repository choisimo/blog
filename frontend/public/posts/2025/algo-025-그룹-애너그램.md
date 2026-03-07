---
title: "[알고리즘] 그룹 애너그램"
date: "2025-05-27"
category: "Algorithm"
tags: ["Algorithm", "정규화 키", "Problem Solving", "Python", "Java"]
excerpt: "Hash Map & Two Pointer & Sliding Window - 그룹 애너그램 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**그룹 애너그램**
* 파트: Hash Map & Two Pointer & Sliding Window
* 관련 알고리즘: 정규화 키

> **Architect's View**
> Canonical Key Classification

이 글에서는 그룹 애너그램 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
==========================================================
문제 025: 그룹 애너그램 (Group Anagrams)
==========================================================

[문제 설명]
문자열 배열에서 애너그램끼리 그룹핑하라.

[아키텍트의 시선 - 정규화 키 기반 분류(Canonical Key Classification)]
각 문자열을 "정렬된 형태"로 변환 → 동일 키 = 같은 그룹.
실무: 데이터 분류, 중복 탐지, 클러스터링의 기초.

[시간 복잡도] O(n * k log k) k=최대 문자열 길이 [공간 복잡도] O(n*k)
"""
from typing import List
from collections import defaultdict


def group_anagrams(strs: List[str]) -> List[List[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = "".join(sorted(s))
        groups[key].append(s)
    return list(groups.values())


if __name__ == "__main__":
    result = group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"])
    result_sorted = sorted([sorted(g) for g in result])
    expected = sorted([sorted(g) for g in [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]]])
    assert result_sorted == expected
    assert group_anagrams([""]) == [[""]]
    assert group_anagrams(["a"]) == [["a"]]
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 025: 애너그램 그룹화 (Group Anagrams)
 *
 * [문제] 문자열 배열에서 애너그램끼리 그룹화하라.
 *
 * [아키텍트의 시선]
 * 정규화(Canonicalization) 후 해시 그룹화는 데이터 중복 제거,
 * 콘텐츠 기반 라우팅, 인덱스 구축의 핵심 패턴이다.
 * "동일성의 기준을 정의"하는 것이 아키텍처의 시작이다.
 *
 * [시간 복잡도] O(n * k log k) k=문자열 최대 길이 [공간 복잡도] O(n * k)
 */
import java.util.*;

public class P025GroupAnagrams {
    public static List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();
        for (String s : strs) {
            char[] chars = s.toCharArray();
            Arrays.sort(chars);
            String key = new String(chars); // 정렬된 문자열 = 정규화 키
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }

    public static void main(String[] args) {
        List<List<String>> result = groupAnagrams(
            new String[]{"eat", "tea", "tan", "ate", "nat", "bat"});
        assert result.size() == 3;

        // 각 그룹 내용 확인
        Set<Set<String>> groups = new HashSet<>();
        for (List<String> g : result) groups.add(new HashSet<>(g));
        assert groups.contains(new HashSet<>(Arrays.asList("eat", "tea", "ate")));
        assert groups.contains(new HashSet<>(Arrays.asList("tan", "nat")));
        assert groups.contains(new HashSet<>(Arrays.asList("bat")));

        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
