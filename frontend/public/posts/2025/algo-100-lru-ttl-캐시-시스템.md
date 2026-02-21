---
title: "[알고리즘] LRU+TTL 캐시 시스템"
date: "2025-11-30"
category: "Algorithm"
tags: ["Algorithm", "복합 자료구조", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - LRU+TTL 캐시 시스템 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**LRU+TTL 캐시 시스템**
* 파트: Advanced Topics
* 관련 알고리즘: 복합 자료구조

> **Architect's View**
> 실무 시스템 설계 종합

이 글에서는 LRU+TTL 캐시 시스템 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 100: LRU + TTL 캐시 시스템 (LRU Cache with TTL)
[문제] LRU 캐시에 TTL(만료 시간)을 추가한 캐시를 설계하라.
       get(key): 만료 안 된 값 반환, 만료면 삭제 후 -1.
       put(key, value, ttl): TTL초 동안 유효한 캐시 저장.
[아키텍트의 시선] 실무 시스템 설계 종합.
LRU(최근 사용 순서) + TTL(시간 기반 만료) = Redis의 핵심 동작.
OrderedDict + 시간 추적. 실무에서 가장 많이 사용되는 캐시 전략.
실무: Redis, Memcached, CDN 캐시, 세션 관리, DNS 캐시.
[시간 복잡도] O(1) per operation [공간 복잡도] O(capacity)
"""
import time
from collections import OrderedDict
from typing import Optional

class LRUTTLCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()  # key → (value, expire_time)

    def get(self, key: str) -> Optional[int]:
        if key not in self.cache:
            return -1
        value, expire_time = self.cache[key]
        if time.time() > expire_time:
            del self.cache[key]
            return -1
        self.cache.move_to_end(key)
        return value

    def put(self, key: str, value: int, ttl: float = 60.0) -> None:
        if key in self.cache:
            del self.cache[key]
        elif len(self.cache) >= self.capacity:
            self.cache.popitem(last=False)  # LRU 제거
        self.cache[key] = (value, time.time() + ttl)

    def cleanup(self) -> int:
        """만료된 항목 일괄 정리"""
        now = time.time()
        expired = [k for k, (_, exp) in self.cache.items() if now > exp]
        for k in expired:
            del self.cache[k]
        return len(expired)

    def size(self) -> int:
        return len(self.cache)

if __name__ == "__main__":
    cache = LRUTTLCache(3)
    cache.put("a", 1, ttl=10)
    cache.put("b", 2, ttl=10)
    cache.put("c", 3, ttl=10)
    assert cache.get("a") == 1
    assert cache.size() == 3
    # 용량 초과 → LRU(b) 제거
    cache.put("d", 4, ttl=10)
    assert cache.get("b") == -1
    assert cache.get("d") == 4
    assert cache.size() == 3
    # TTL 만료 테스트
    cache2 = LRUTTLCache(2)
    cache2.put("x", 10, ttl=0.1)  # 0.1초 후 만료
    assert cache2.get("x") == 10
    import time as t
    t.sleep(0.15)
    assert cache2.get("x") == -1  # 만료됨
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 100: LRU + TTL 캐시 시스템 (LRU Cache with TTL)
 *
 * [문제] LRU 캐시에 TTL(만료 시간)을 추가한 캐시를 설계하라.
 *        get(key): 만료 안 된 값 반환, 만료면 삭제 후 -1.
 *        put(key, value, ttl): TTL 밀리초 동안 유효한 캐시 저장.
 *
 * [아키텍트의 시선]
 * 실무 시스템 설계 종합.
 * LRU(최근 사용 순서) + TTL(시간 기반 만료) = Redis의 핵심 동작.
 * LinkedHashMap + 시간 추적. 실무에서 가장 많이 사용되는 캐시 전략.
 * 실무: Redis, Memcached, CDN 캐시, 세션 관리, DNS 캐시.
 *
 * [시간 복잡도] O(1) per operation [공간 복잡도] O(capacity)
 */
import java.util.*;

public class P100LRUTTLCache {
    private final int capacity;
    private final LinkedHashMap<String, long[]> cache; // key -> {value, expireTimeMs}

    public P100LRUTTLCache(int capacity) {
        this.capacity = capacity;
        this.cache = new LinkedHashMap<>(capacity, 0.75f, true); // accessOrder=true
    }

    public int get(String key) {
        if (!cache.containsKey(key)) return -1;
        long[] entry = cache.get(key);
        if (System.currentTimeMillis() > entry[1]) {
            cache.remove(key);
            return -1;
        }
        return (int) entry[0];
    }

    public void put(String key, int value, long ttlMs) {
        if (cache.containsKey(key)) {
            cache.remove(key);
        } else if (cache.size() >= capacity) {
            // LRU 제거 (가장 오래 안 쓴 항목 = 첫 번째)
            String eldest = cache.keySet().iterator().next();
            cache.remove(eldest);
        }
        cache.put(key, new long[]{value, System.currentTimeMillis() + ttlMs});
    }

    public int size() { return cache.size(); }

    public static void main(String[] args) throws InterruptedException {
        P100LRUTTLCache c = new P100LRUTTLCache(3);
        c.put("a", 1, 10000);
        c.put("b", 2, 10000);
        c.put("c", 3, 10000);
        assert c.get("a") == 1;
        assert c.size() == 3;
        // 용량 초과 -> LRU(b) 제거
        c.put("d", 4, 10000);
        assert c.get("b") == -1;
        assert c.get("d") == 4;
        assert c.size() == 3;
        // TTL 만료 테스트
        P100LRUTTLCache c2 = new P100LRUTTLCache(2);
        c2.put("x", 10, 100); // 100ms 후 만료
        assert c2.get("x") == 10;
        Thread.sleep(150);
        assert c2.get("x") == -1; // 만료됨
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
