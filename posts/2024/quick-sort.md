---
title: "퀵 정렬(Quick Sort) 완전 정복"
date: "2024-10-27"
category: "Algorithm"
tags: ['퀵정렬', '정렬', '분할정복', '알고리즘']
excerpt: "분할 정복을 이용한 최고 성능의 정렬 알고리즘, 퀵 정렬의 모든 것"
readTime: "9분"
published: false
---

#  퀵 정렬(Quick Sort) 완전 정복

##  핵심 개념

퀵 정렬은 **분할 정복(Divide and Conquer)** 기법을 사용하는 정렬 알고리즘으로, **평균적으로 가장 빠른 성능**을 보여주는 정렬 방법입니다. 피벗(Pivot)을 선택하여 배열을 분할하고, 각 부분을 재귀적으로 정렬하는 방식입니다.

### 알고리즘 동작 과정
1. **피벗 선택**: 배열에서 하나의 원소를 피벗으로 선택
2. **분할(Partition)**: 피벗보다 작은 원소들은 왼쪽, 큰 원소들은 오른쪽으로 배치
3. **재귀 호출**: 왼쪽과 오른쪽 부분배열을 각각 퀵 정렬로 정렬
4. **결합**: 분할된 배열들이 이미 정렬되어 있으므로 추가 작업 불필요

##  시간복잡도

| 케이스 | 시간복잡도 | 설명 |
|--------|------------|------|
| **최선** | O(n log n) | 피벗이 항상 중앙값인 경우 |
| **평균** | O(n log n) | 일반적인 경우 |
| **최악** | O(n²) | 피벗이 항상 최솟값 또는 최댓값인 경우 |
| **공간복잡도** | O(log n) | 재귀 호출 스택 |

##  완전한 구현 코드

### 1. 기본 퀘 정렬 (호어 분할)
```python
def quicksort_hoare(arr, low, high):
    """호어 분할 방식의 퀵 정렬"""
    if low < high:
        # 분할 수행
        pivot_index = hoare_partition(arr, low, high)
        
        # 피벗을 기준으로 좌우 부분배열 재귀 정렬
        quicksort_hoare(arr, low, pivot_index)
        quicksort_hoare(arr, pivot_index + 1, high)

def hoare_partition(arr, low, high):
    """호어 분할 방식"""
    pivot = arr[low]  # 첫 번째 원소를 피벗으로 선택
    i = low - 1
    j = high + 1
    
    while True:
        # 피벗보다 큰 원소를 왼쪽에서 찾기
        i += 1
        while i < high and arr[i] < pivot:
            i += 1
        
        # 피벗보다 작은 원소를 오른쪽에서 찾기
        j -= 1
        while j > low and arr[j] > pivot:
            j -= 1
        
        # 교차되면 분할 완료
        if i >= j:
            return j
        
        # 원소 교환
        arr[i], arr[j] = arr[j], arr[i]

# 사용 예제
def quicksort(arr):
    """퀵 정렬 메인 함수"""
    if len(arr) <= 1:
        return arr
    
    arr_copy = arr.copy()
    quicksort_hoare(arr_copy, 0, len(arr_copy) - 1)
    return arr_copy

# 테스트
test_array = [64, 34, 25, 12, 22, 11, 90]
print(f"Original: {test_array}")
sorted_array = quicksort(test_array)
print(f"Sorted: {sorted_array}")
```

### 2. 로무토 분할 방식
```python
def quicksort_lomuto(arr, low, high):
    """로무토 분할 방식의 퀵 정렬"""
    if low < high:
        # 분할 수행
        pivot_index = lomuto_partition(arr, low, high)
        
        # 피벗을 기준으로 좌우 부분배열 재귀 정렬
        quicksort_lomuto(arr, low, pivot_index - 1)
        quicksort_lomuto(arr, pivot_index + 1, high)

def lomuto_partition(arr, low, high):
    """로무토 분할 방식 (이해하기 쉬운 방식)"""
    pivot = arr[high]  # 마지막 원소를 피벗으로 선택
    i = low - 1  # 작은 원소들의 끝 인덱스
    
    for j in range(low, high):
        # 현재 원소가 피벗보다 작거나 같으면
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    
    # 피벗을 올바른 위치에 배치
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

# 시각화를 위한 상세한 구현
def quicksort_detailed(arr, low, high, depth=0):
    """과정을 출력하는 퀵 정렬"""
    indent = "  " * depth
    print(f"{indent}Sorting {arr[low:high+1]} (indices {low}-{high})")
    
    if low < high:
        pivot_index = lomuto_partition_detailed(arr, low, high, depth)
        print(f"{indent}Pivot: {arr[pivot_index]} at index {pivot_index}")
        print(f"{indent}After partition: {arr[low:high+1]}")
        
        # 좌측 부분배열 정렬
        if pivot_index - 1 > low:
            print(f"{indent}Left subarray:")
            quicksort_detailed(arr, low, pivot_index - 1, depth + 1)
        
        # 우측 부분배열 정렬
        if pivot_index + 1 < high:
            print(f"{indent}Right subarray:")
            quicksort_detailed(arr, pivot_index + 1, high, depth + 1)

def lomuto_partition_detailed(arr, low, high, depth):
    """상세한 과정을 출력하는 로무토 분할"""
    indent = "  " * depth
    pivot = arr[high]
    print(f"{indent}Pivot chosen: {pivot}")
    
    i = low - 1
    
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            if i != j:
                arr[i], arr[j] = arr[j], arr[i]
                print(f"{indent}Swap {arr[j]} and {arr[i]}: {arr[low:high+1]}")
    
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1

# 상세한 과정 확인
print("=== Detailed Quick Sort Process ===")
detailed_array = [64, 34, 25, 12, 22, 11, 90]
print(f"Original: {detailed_array}")
quicksort_detailed(detailed_array, 0, len(detailed_array) - 1)
print(f"Final result: {detailed_array}")
```

### 3. 3-Way 퀵 정렬 (중복 원소 최적화)
```python
def quicksort_3way(arr, low, high):
    """3-way 퀵 정렬 (중복 원소가 많을 때 효율적)"""
    if low >= high:
        return
    
    # 3-way partition 수행
    lt, gt = partition_3way(arr, low, high)
    
    # 3개 구간으로 나누어 재귀 호출
    quicksort_3way(arr, low, lt - 1)    # arr[low...lt-1] < pivot
    # arr[lt...gt] == pivot (정렬 완료)
    quicksort_3way(arr, gt + 1, high)   # arr[gt+1...high] > pivot

def partition_3way(arr, low, high):
    """3-way 분할: <pivot, ==pivot, >pivot"""
    pivot = arr[low]
    lt = low      # arr[low...lt-1] < pivot
    i = low + 1   # arr[lt...i-1] == pivot
    gt = high     # arr[gt+1...high] > pivot
    
    while i <= gt:
        if arr[i] < pivot:
            arr[lt], arr[i] = arr[i], arr[lt]
            lt += 1
            i += 1
        elif arr[i] > pivot:
            arr[i], arr[gt] = arr[gt], arr[i]
            gt -= 1
            # i는 증가시키지 않음 (교환된 원소 확인 필요)
        else:  # arr[i] == pivot
            i += 1
    
    return lt, gt

# 중복이 많은 배열 테스트
duplicate_array = [3, 7, 3, 3, 5, 7, 3, 5, 5, 5, 3]
print(f"Original (with duplicates): {duplicate_array}")
quicksort_3way(duplicate_array, 0, len(duplicate_array) - 1)
print(f"Sorted: {duplicate_array}")
```

### 4. 반복적(Iterative) 퀵 정렬
```python
def quicksort_iterative(arr):
    """반복문을 사용한 퀵 정렬 (스택 오버플로우 방지)"""
    if len(arr) <= 1:
        return arr
    
    arr = arr.copy()
    stack = [(0, len(arr) - 1)]
    
    while stack:
        low, high = stack.pop()
        
        if low < high:
            pivot_index = lomuto_partition(arr, low, high)
            
            # 더 작은 부분배열을 먼저 스택에 푸시 (메모리 최적화)
            if pivot_index - low < high - pivot_index:
                stack.append((pivot_index + 1, high))
                stack.append((low, pivot_index - 1))
            else:
                stack.append((low, pivot_index - 1))
                stack.append((pivot_index + 1, high))
    
    return arr

# 반복적 퀵 정렬 테스트
iterative_array = [64, 34, 25, 12, 22, 11, 90]
print(f"Iterative Quick Sort: {quicksort_iterative(iterative_array)}")
```

##  최적화 기법

### 1. 피벗 선택 최적화
```python
import random

def median_of_three(arr, low, high):
    """세 원소의 중간값을 피벗으로 선택"""
    mid = (low + high) // 2
    
    # 세 원소를 정렬하여 중간값을 arr[mid]에 배치
    if arr[mid] < arr[low]:
        arr[low], arr[mid] = arr[mid], arr[low]
    if arr[high] < arr[low]:
        arr[low], arr[high] = arr[high], arr[low]
    if arr[high] < arr[mid]:
        arr[mid], arr[high] = arr[high], arr[mid]
    
    # 중간값을 끝으로 이동
    arr[mid], arr[high] = arr[high], arr[mid]
    return arr[high]

def quicksort_optimized(arr, low, high):
    """최적화된 퀵 정렬"""
    # 작은 배열은 삽입 정렬 사용
    if high - low + 1 < 10:
        insertion_sort_range(arr, low, high)
        return
    
    if low < high:
        # 최적화된 피벗 선택
        pivot = median_of_three(arr, low, high)
        pivot_index = lomuto_partition(arr, low, high)
        
        # 꼬리 재귀 최적화
        while low < high:
            pivot_index = lomuto_partition(arr, low, high)
            
            # 더 작은 부분을 재귀로, 큰 부분을 반복으로
            if pivot_index - low < high - pivot_index:
                quicksort_optimized(arr, low, pivot_index - 1)
                low = pivot_index + 1
            else:
                quicksort_optimized(arr, pivot_index + 1, high)
                high = pivot_index - 1

def insertion_sort_range(arr, low, high):
    """특정 범위에 대한 삽입 정렬"""
    for i in range(low + 1, high + 1):
        key = arr[i]
        j = i - 1
        
        while j >= low and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        
        arr[j + 1] = key

# 랜덤 피벗 선택
def randomized_quicksort(arr, low, high):
    """랜덤 피벗을 사용한 퀵 정렬"""
    if low < high:
        # 랜덤 인덱스 선택하여 마지막과 교환
        random_index = random.randint(low, high)
        arr[random_index], arr[high] = arr[high], arr[random_index]
        
        pivot_index = lomuto_partition(arr, low, high)
        randomized_quicksort(arr, low, pivot_index - 1)
        randomized_quicksort(arr, pivot_index + 1, high)

# 최적화된 퀵 정렬 테스트
large_array = [random.randint(1, 1000) for _ in range(100)]
print("Testing optimized quick sort on large array...")
optimized_copy = large_array.copy()
quicksort_optimized(optimized_copy, 0, len(optimized_copy) - 1)
print(f"Is sorted: {optimized_copy == sorted(large_array)}")
```

### 2. 성능 비교
```python
import time
import random

def performance_comparison():
    """다양한 퀵 정렬 구현의 성능 비교"""
    
    # 테스트 데이터 생성
    sizes = [1000, 5000, 10000]
    
    for size in sizes:
        print(f"\n=== Array size: {size} ===")
        
        # 랜덤 데이터
        random_data = [random.randint(1, size) for _ in range(size)]
        
        # 정렬된 데이터 (최악의 경우)
        sorted_data = list(range(size))
        
        # 역순 데이터
        reverse_data = list(range(size, 0, -1))
        
        test_cases = [
            ("Random", random_data),
            ("Sorted", sorted_data),
            ("Reverse", reverse_data)
        ]
        
        for case_name, data in test_cases:
            print(f"\n{case_name} data:")
            
            # 기본 퀵 정렬
            test_data = data.copy()
            start_time = time.time()
            quicksort_lomuto(test_data, 0, len(test_data) - 1)
            basic_time = time.time() - start_time
            
            # 랜덤 피벗 퀵 정렬
            test_data = data.copy()
            start_time = time.time()
            randomized_quicksort(test_data, 0, len(test_data) - 1)
            random_time = time.time() - start_time
            
            # 3-way 퀵 정렬
            test_data = data.copy()
            start_time = time.time()
            quicksort_3way(test_data, 0, len(test_data) - 1)
            threeway_time = time.time() - start_time
            
            print(f"  Basic Quick Sort: {basic_time:.4f}s")
            print(f"  Random Pivot: {random_time:.4f}s")
            print(f"  3-Way Quick Sort: {threeway_time:.4f}s")

# 성능 비교 실행 (주의: 시간이 걸릴 수 있음)
# performance_comparison()
```

##  실전 예제

### 1. K번째 큰 원소 찾기 (QuickSelect)
```python
def quickselect(arr, k):
    """K번째 큰 원소를 O(n) 평균 시간에 찾기"""
    if not arr or k < 1 or k > len(arr):
        return None
    
    return quickselect_helper(arr, 0, len(arr) - 1, len(arr) - k)

def quickselect_helper(arr, low, high, k):
    """QuickSelect 알고리즘 헬퍼 함수"""
    if low == high:
        return arr[low]
    
    # 랜덤 피벗 선택
    random_index = random.randint(low, high)
    arr[random_index], arr[high] = arr[high], arr[random_index]
    
    pivot_index = lomuto_partition(arr, low, high)
    
    if k == pivot_index:
        return arr[k]
    elif k < pivot_index:
        return quickselect_helper(arr, low, pivot_index - 1, k)
    else:
        return quickselect_helper(arr, pivot_index + 1, high, k)

# K번째 원소 찾기 테스트
test_array = [3, 6, 8, 10, 1, 2, 1]
for k in range(1, len(test_array) + 1):
    kth_largest = quickselect(test_array.copy(), k)
    print(f"{k}번째 큰 원소: {kth_largest}")

# 검증
sorted_test = sorted(test_array, reverse=True)
print(f"실제 정렬: {sorted_test}")
```

### 2. 네덜란드 국기 문제 (Dutch National Flag)
```python
def dutch_flag_sort(arr, pivot_value):
    """네덜란드 국기 문제: 피벗값 기준으로 3색 정렬"""
    low = 0
    mid = 0
    high = len(arr) - 1
    
    while mid <= high:
        if arr[mid] < pivot_value:
            arr[low], arr[mid] = arr[mid], arr[low]
            low += 1
            mid += 1
        elif arr[mid] > pivot_value:
            arr[mid], arr[high] = arr[high], arr[mid]
            high -= 1
            # mid는 증가시키지 않음
        else:  # arr[mid] == pivot_value
            mid += 1
    
    return arr

# 네덜란드 국기 문제 테스트
flag_array = [2, 0, 2, 1, 1, 0, 2, 1, 0]
print(f"Original: {flag_array}")
dutch_flag_sort(flag_array, 1)  # 1을 피벗으로
print(f"After Dutch flag sort: {flag_array}")
```

### 3. 퀵 정렬을 이용한 역순 쌍 개수 구하기
```python
def count_inversions_quicksort(arr):
    """퀵 정렬을 이용한 역순 쌍 개수 계산"""
    if len(arr) <= 1:
        return 0, arr
    
    return quicksort_count_inversions(arr, 0, len(arr) - 1)

def quicksort_count_inversions(arr, low, high):
    """역순 쌍을 세면서 퀵 정렬 수행"""
    inv_count = 0
    
    if low < high:
        pivot_index, partition_inv = partition_count_inversions(arr, low, high)
        inv_count += partition_inv
        
        left_inv, _ = quicksort_count_inversions(arr, low, pivot_index - 1)
        right_inv, _ = quicksort_count_inversions(arr, pivot_index + 1, high)
        
        inv_count += left_inv + right_inv
    
    return inv_count, arr

def partition_count_inversions(arr, low, high):
    """분할하면서 역순 쌍 개수 계산"""
    pivot = arr[high]
    i = low - 1
    inv_count = 0
    
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            if i != j:
                arr[i], arr[j] = arr[j], arr[i]
        else:
            # arr[j] > pivot이므로 역순 쌍 존재
            inv_count += (high - j)
    
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1, inv_count

# 역순 쌍 개수 계산 테스트
inversion_array = [2, 3, 8, 6, 1]
inv_count, sorted_arr = count_inversions_quicksort(inversion_array.copy())
print(f"Original: {inversion_array}")
print(f"Inversions count: {inv_count}")
print(f"Sorted: {sorted_arr}")
```

##  퀵 정렬의 장단점

### ✅ 장점
- **평균 성능 우수**: O(n log n) 평균 시간복잡도
- **In-place 정렬**: 추가 메모리 사용량이 적음 (O(log n))
- **캐시 효율성**: 지역성이 좋아 실제 성능이 우수
- **분할 정복**: 병렬화가 용이

### ❌ 단점
- **최악 시간복잡도**: O(n²) - 이미 정렬된 배열
- **불안정 정렬**: 동일한 값의 순서가 보장되지 않음
- **재귀 호출**: 깊은 재귀로 인한 스택 오버플로우 가능성

###  언제 사용하나?
- **일반적인 정렬**: 대부분의 경우에 최고 성능
- **메모리 제약**: In-place 정렬이 필요한 경우
- **K번째 원소**: QuickSelect 알고리즘
- **분할 정복 학습**: 알고리즘 교육용

## 🎖️ 레벨별 연습 문제

### 🥉 초급
- BOJ 2750: 수 정렬하기
- BOJ 2751: 수 정렬하기 2
- BOJ 10989: 수 정렬하기 3

### 🥈 중급
- BOJ 11004: K번째 수
- BOJ 1427: 소트인사이드
- LeetCode 215: Kth Largest Element

### 🥇 고급
- BOJ 1517: 버블 소트 (역순 쌍)
- LeetCode 324: Wiggle Sort II
- LeetCode 75: Sort Colors (Dutch Flag)

---

**다음 학습**: [병합 정렬(Merge Sort) 완전 정복](../merge-sort/) 

퀵 정렬은 **실전에서 가장 많이 사용되는 정렬 알고리즘**입니다. 분할 정복의 핵심 개념과 함께 완벽하게 마스터하세요!