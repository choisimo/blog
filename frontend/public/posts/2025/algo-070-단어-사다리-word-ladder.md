---
title: "[알고리즘] 단어 사다리 (Word Ladder)"
date: "2025-09-16"
category: "Algorithm"
tags: ["Algorithm", "BFS", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - 단어 사다리 (Word Ladder) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**단어 사다리 (Word Ladder)**
* 파트: Heap & Graph Basics
* 관련 알고리즘: BFS

> **Architect's View**
> 암묵적 그래프와 상태 공간

이 글에서는 단어 사다리 (Word Ladder) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 070: 단어 사다리 (Word Ladder)
[문제] beginWord에서 endWord로 한 글자씩 바꿔가며 도달하는 최단 변환 횟수를 구하라.
       각 변환 단어는 wordList에 있어야 한다.
[아키텍트의 시선] 암묵적 그래프와 상태 공간 탐색.
단어가 노드, 한 글자 차이 = 간선. 명시적 그래프 구성 없이 BFS.
와일드카드 패턴(h*t → hat, hot, hit)으로 간선 생성 최적화.
실무: DNA 서열 변환, 상태 머신 최단 경로, 구성 변경 최소 단계.
[시간 복잡도] O(M^2 * N) M=단어길이, N=단어수 [공간 복잡도] O(M^2 * N)
"""
from typing import List
from collections import deque, defaultdict

def ladder_length(begin_word: str, end_word: str, word_list: List[str]) -> int:
    """BFS + 와일드카드 패턴"""
    word_set = set(word_list)
    if end_word not in word_set:
        return 0

    # 와일드카드 패턴 → 단어 매핑
    patterns = defaultdict(list)
    for word in word_set:
        for i in range(len(word)):
            pattern = word[:i] + "*" + word[i+1:]
            patterns[pattern].append(word)

    queue = deque([(begin_word, 1)])
    visited = {begin_word}

    while queue:
        word, length = queue.popleft()
        for i in range(len(word)):
            pattern = word[:i] + "*" + word[i+1:]
            for neighbor in patterns[pattern]:
                if neighbor == end_word:
                    return length + 1
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, length + 1))

    return 0

if __name__ == "__main__":
    assert ladder_length("hit", "cog",
        ["hot","dot","dog","lot","log","cog"]) == 5
    assert ladder_length("hit", "cog",
        ["hot","dot","dog","lot","log"]) == 0  # cog 없음
    assert ladder_length("a", "c", ["a","b","c"]) == 2
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 070: 단어 사다리 (Word Ladder)
 *
 * [문제] 한 번에 한 글자만 바꿔서 beginWord에서 endWord까지의 최단 변환 길이를 구하라.
 * 모든 중간 단어는 wordList에 있어야 한다.
 *
 * [아키텍트의 시선]
 * 단어 사다리는 상태 공간 탐색의 전형이다.
 * 설정 변경의 최소 단계 수, 데이터베이스 마이그레이션 경로,
 * API 버전 업그레이드의 최소 변경 경로와 동일한 패턴이다.
 * BFS = 최단 경로 보장.
 *
 * [시간 복잡도] O(M^2 * N) M=단어길이, N=단어수 [공간 복잡도] O(M * N)
 */
import java.util.*;

public class P070WordLadder {
    public static int ladderLength(String beginWord, String endWord, List<String> wordList) {
        Set<String> wordSet = new HashSet<>(wordList);
        if (!wordSet.contains(endWord)) return 0;

        Queue<String> queue = new LinkedList<>();
        queue.offer(beginWord);
        Set<String> visited = new HashSet<>();
        visited.add(beginWord);
        int level = 1;

        while (!queue.isEmpty()) {
            int size = queue.size();
            for (int i = 0; i < size; i++) {
                String word = queue.poll();
                char[] chars = word.toCharArray();
                for (int j = 0; j < chars.length; j++) {
                    char original = chars[j];
                    for (char c = 'a'; c <= 'z'; c++) {
                        if (c == original) continue;
                        chars[j] = c;
                        String newWord = new String(chars);
                        if (newWord.equals(endWord)) return level + 1;
                        if (wordSet.contains(newWord) && !visited.contains(newWord)) {
                            visited.add(newWord);
                            queue.offer(newWord);
                        }
                    }
                    chars[j] = original;
                }
            }
            level++;
        }
        return 0;
    }

    public static void main(String[] args) {
        assert ladderLength("hit", "cog",
            Arrays.asList("hot","dot","dog","lot","log","cog")) == 5;
        assert ladderLength("hit", "cog",
            Arrays.asList("hot","dot","dog","lot","log")) == 0;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
