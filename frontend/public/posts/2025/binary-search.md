---
title: "이진 탐색(Binary Search) 완전 정복"
date: "2024-12-05"
category: "Algorithm"
tags: ['이진탐색', '탐색', '분할정복', '알고리즘']
excerpt: "정렬된 배열에서 O(log n) 시간에 원소를 찾는 이진 탐색의 모든 것"
readTime: "11분"
---

# 이진 탐색(Binary Search) 완전 정복

## 핵심 개념

이진 탐색은 **정렬된 배열**에서 특정 값을 찾는 탐색 알고리즘으로, **분할 정복** 기법을 사용하여 **O(log n)** 시간복잡도를 달성합니다. 매번 탐색 범위를 절반으로 줄여나가는 것이 핵심입니다.

### 알고리즘 동작 과정
1. **중간점 계산**: 탐색 범위의 중간 인덱스를 구함
2. **비교**: 중간값과 찾는 값을 비교
3. **범위 축소**: 찾는 값이 더 크면 오른쪽, 작으면 왼쪽 절반만 탐색
4. **반복**: 값을 찾거나 범위가 없어질 때까지 반복

## 시간복잡도

| 연산 | 시간복잡도 | 공간복잡도 |
|------|------------|------------|
| **탐색** | O(log n) | O(1) - 반복문 |
| **탐색** | O(log n) | O(log n) - 재귀 |

## 완전한 구현 코드

### 1. 기본 이진 탐색 (반복문)
```python
def binary_search_iterative(arr, target):
    """반복문을 이용한 이진 탐색"""
    left = 0
    right = len(arr) - 1
    
    while left <= right:
        mid = left + (right - left) // 2  # 오버플로우 방지
        
        if arr[mid] == target:
            return mid  # 찾은 경우 인덱스 반환
        elif arr[mid] < target:
            left = mid + 1  # 오른쪽 절반 탐색
        else:
            right = mid - 1  # 왼쪽 절반 탐색
    
    return -1  # 찾지 못한 경우

# 사용 예제
sorted_array = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
target = 7

result = binary_search_iterative(sorted_array, target)
if result != -1:
    print(f"Element {target} found at index {result}")
else:
    print(f"Element {target} not found")

# 모든 원소에 대해 테스트
print("=== Testing all elements ===")
for i, value in enumerate(sorted_array):
    found_index = binary_search_iterative(sorted_array, value)
    print(f"Value {value}: Expected index {i}, Found index {found_index}")
```

### 2. 재귀적 이진 탐색
```python
def binary_search_recursive(arr, target, left=None, right=None):
    """재귀를 이용한 이진 탐색"""
    if left is None:
        left = 0
    if right is None:
        right = len(arr) - 1
    
    # 기저 조건: 탐색 범위가 없는 경우
    if left > right:
        return -1
    
    mid = left + (right - left) // 2
    
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, right)
    else:
        return binary_search_recursive(arr, target, left, mid - 1)

# 재귀 버전 테스트
print("=== Recursive Binary Search ===")
for target in [5, 12, 1, 19, 20]:
    result = binary_search_recursive(sorted_array, target)
    if result != -1:
        print(f"Found {target} at index {result}")
    else:
        print(f"{target} not found")
```

### 3. 상세한 과정을 보여주는 이진 탐색
```python
def binary_search_detailed(arr, target):
    """이진 탐색 과정을 상세히 출력"""
    left = 0
    right = len(arr) - 1
    step = 1
    
    print(f"Searching for {target} in {arr}")
    print(f"Initial range: left={left}, right={right}")
    
    while left <= right:
        mid = left + (right - left) // 2
        print(f"\nStep {step}:")
        print(f"  Range: [{left}, {right}]")
        print(f"  Mid index: {mid}, Mid value: {arr[mid]}")
        
        if arr[mid] == target:
            print(f"  ✅ Found! {target} is at index {mid}")
            return mid
        elif arr[mid] < target:
            print(f"  {arr[mid]} < {target}, search right half")
            left = mid + 1
        else:
            print(f"  {arr[mid]} > {target}, search left half")
            right = mid - 1
        
        step += 1
    
    print(f"  ❌ Not found! {target} is not in the array")
    return -1

# 상세한 과정 확인
print("=== Detailed Binary Search Process ===")
binary_search_detailed([1, 3, 5, 7, 9, 11, 13, 15, 17, 19], 11)
print("\n" + "="*50)
binary_search_detailed([1, 3, 5, 7, 9, 11, 13, 15, 17, 19], 12)
```

### 4. 첫 번째/마지막 위치 찾기
```python
def find_first_occurrence(arr, target):
    """중복된 값 중 첫 번째 위치 찾기"""
    left, right = 0, len(arr) - 1
    result = -1
    
    while left <= right:
        mid = left + (right - left) // 2
        
        if arr[mid] == target:
            result = mid  # 일단 저장
            right = mid - 1  # 더 왼쪽에 있는지 확인
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return result

def find_last_occurrence(arr, target):
    """중복된 값 중 마지막 위치 찾기"""
    left, right = 0, len(arr) - 1
    result = -1
    
    while left <= right:
        mid = left + (right - left) // 2
        
        if arr[mid] == target:
            result = mid  # 일단 저장
            left = mid + 1  # 더 오른쪽에 있는지 확인
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return result

def find_all_occurrences(arr, target):
    """모든 위치 찾기"""
    first = find_first_occurrence(arr, target)
    if first == -1:
        return []
    
    last = find_last_occurrence(arr, target)
    return list(range(first, last + 1))

# 중복 값이 있는 배열 테스트
duplicate_array = [1, 2, 2, 2, 3, 4, 4, 5, 5, 5, 5, 6]
target = 5

print("=== Finding First/Last Occurrences ===")
print(f"Array: {duplicate_array}")
print(f"Target: {target}")
print(f"First occurrence: {find_first_occurrence(duplicate_array, target)}")
print(f"Last occurrence: {find_last_occurrence(duplicate_array, target)}")
print(f"All occurrences: {find_all_occurrences(duplicate_array, target)}")
```

### 5. Lower Bound / Upper Bound
```python
def lower_bound(arr, target):
    """target보다 크거나 같은 첫 번째 원소의 위치"""
    left, right = 0, len(arr)
    
    while left < right:
        mid = left + (right - left) // 2
        
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid
    
    return left

def upper_bound(arr, target):
    """target보다 큰 첫 번째 원소의 위치"""
    left, right = 0, len(arr)
    
    while left < right:
        mid = left + (right - left) // 2
        
        if arr[mid] <= target:
            left = mid + 1
        else:
            right = mid
    
    return left

def count_occurrences(arr, target):
    """특정 값의 개수 구하기"""
    return upper_bound(arr, target) - lower_bound(arr, target)

# Lower/Upper Bound 테스트
test_array = [1, 2, 2, 3, 3, 3, 4, 5, 5, 6]
print("=== Lower/Upper Bound ===")
print(f"Array: {test_array}")

for target in [2, 3, 4, 7]:
    lb = lower_bound(test_array, target)
    ub = upper_bound(test_array, target)
    count = count_occurrences(test_array, target)
    
    print(f"Target {target}:")
    print(f"  Lower bound: {lb}")
    print(f"  Upper bound: {ub}")
    print(f"  Count: {count}")
```

##  고급 응용

### 1. 매개변수 탐색 (Parametric Search)
```python
def can_cut_wood(woods, cut_height):
    """주어진 높이로 자를 때 얻을 수 있는 나무의 총 길이"""
    total = 0
    for wood in woods:
        if wood > cut_height:
            total += wood - cut_height
    return total

def solve_wood_cutting(woods, target_length):
    """나무 자르기 문제 - 매개변수 탐색"""
    left, right = 0, max(woods)
    result = 0
    
    while left <= right:
        mid = left + (right - left) // 2
        cut_length = can_cut_wood(woods, mid)
        
        if cut_length >= target_length:
            result = mid  # 가능한 높이 저장
            left = mid + 1  # 더 높은 높이 시도
        else:
            right = mid - 1  # 높이를 낮춰야 함
    
    return result

# 나무 자르기 문제 테스트
woods = [20, 15, 10, 17]
target = 7

max_height = solve_wood_cutting(woods, target)
print(f"Woods: {woods}")
print(f"Target length: {target}")
print(f"Maximum cutting height: {max_height}")
print(f"Actual cut length: {can_cut_wood(woods, max_height)}")
```

### 2. 실수 이진 탐색
```python
def binary_search_real(func, target, left, right, epsilon=1e-9):
    """실수 범위에서 이진 탐색"""
    while right - left > epsilon:
        mid = (left + right) / 2
        
        if func(mid) < target:
            left = mid
        else:
            right = mid
    
    return (left + right) / 2

def square_root(x, precision=1e-9):
    """제곱근 구하기"""
    if x < 0:
        return None
    if x == 0:
        return 0
    
    # f(t) = t^2, target = x인 t 찾기
    return binary_search_real(lambda t: t * t, x, 0, max(1, x), precision)

def cube_root(x, precision=1e-9):
    """세제곱근 구하기"""
    # f(t) = t^3, target = x인 t 찾기
    if x >= 0:
        return binary_search_real(lambda t: t * t * t, x, 0, max(1, x), precision)
    else:
        return -binary_search_real(lambda t: t * t * t, -x, 0, max(1, -x), precision)

# 실수 이진 탐색 테스트
print("=== Real Number Binary Search ===")
test_numbers = [4, 9, 16, 25, 8, 27, -8]

for num in test_numbers:
    if num >= 0:
        sqrt_result = square_root(num)
        print(f"√{num} ≈ {sqrt_result:.6f} (verification: {sqrt_result**2:.6f})")
    
    cbrt_result = cube_root(num)
    print(f"∛{num} ≈ {cbrt_result:.6f} (verification: {cbrt_result**3:.6f})")
```

### 3. 2D 배열에서의 이진 탐색
```python
def search_2d_matrix(matrix, target):
    """행과 열이 모두 정렬된 2D 배열에서 탐색"""
    if not matrix or not matrix[0]:
        return False
    
    rows, cols = len(matrix), len(matrix[0])
    
    # 오른쪽 위 모서리부터 시작
    row, col = 0, cols - 1
    
    while row < rows and col >= 0:
        current = matrix[row][col]
        
        if current == target:
            return True
        elif current > target:
            col -= 1  # 왼쪽으로 이동
        else:
            row += 1  # 아래로 이동
    
    return False

def search_sorted_matrix(matrix, target):
    """각 행이 정렬되고, 다음 행의 첫 원소가 이전 행의 마지막 원소보다 큰 경우"""
    if not matrix or not matrix[0]:
        return False
    
    rows, cols = len(matrix), len(matrix[0])
    left, right = 0, rows * cols - 1
    
    while left <= right:
        mid = left + (right - left) // 2
        # 1D 인덱스를 2D 좌표로 변환
        mid_value = matrix[mid // cols][mid % cols]
        
        if mid_value == target:
            return True
        elif mid_value < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return False

# 2D 배열 탐색 테스트
matrix1 = [
    [1,  4,  7,  11],
    [2,  5,  8,  12],
    [3,  6,  9,  16],
    [10, 13, 14, 17]
]

matrix2 = [
    [1,  3,  5,  7],
    [10, 11, 16, 20],
    [23, 30, 34, 60]
]

print("=== 2D Array Binary Search ===")
print("Matrix 1 (sorted in both directions):")
for row in matrix1:
    print(row)

targets = [5, 14, 20]
for target in targets:
    found = search_2d_matrix(matrix1, target)
    print(f"Target {target}: {'Found' if found else 'Not found'}")

print("\nMatrix 2 (row-wise sorted):")
for row in matrix2:
    print(row)

for target in targets:
    found = search_sorted_matrix(matrix2, target)
    print(f"Target {target}: {'Found' if found else 'Not found'}")
```

##  실전 예제

### 1. 회전된 정렬 배열에서 탐색
```python
def search_rotated_array(nums, target):
    """회전된 정렬 배열에서 이진 탐색"""
    left, right = 0, len(nums) - 1
    
    while left <= right:
        mid = left + (right - left) // 2
        
        if nums[mid] == target:
            return mid
        
        # 왼쪽 절반이 정렬되어 있는 경우
        if nums[left] <= nums[mid]:
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        # 오른쪽 절반이 정렬되어 있는 경우
        else:
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
    
    return -1

def find_minimum_rotated(nums):
    """회전된 정렬 배열에서 최솟값 찾기"""
    left, right = 0, len(nums) - 1
    
    while left < right:
        mid = left + (right - left) // 2
        
        if nums[mid] > nums[right]:
            left = mid + 1
        else:
            right = mid
    
    return left

# 회전된 배열 테스트
rotated_arrays = [
    [4, 5, 6, 7, 0, 1, 2],
    [6, 7, 0, 1, 2, 4, 5],
    [1, 3, 5]
]

print("=== Rotated Array Search ===")
for arr in rotated_arrays:
    min_idx = find_minimum_rotated(arr)
    print(f"Array: {arr}")
    print(f"Minimum at index {min_idx}: {arr[min_idx]}")
    
    # 몇 개 값 탐색
    for target in [0, 5, 8]:
        idx = search_rotated_array(arr, target)
        if idx != -1:
            print(f"  {target} found at index {idx}")
        else:
            print(f"  {target} not found")
    print()
```

### 2. 피크 원소 찾기
```python
def find_peak_element(nums):
    """배열에서 피크 원소 찾기 (양쪽 이웃보다 큰 원소)"""
    left, right = 0, len(nums) - 1
    
    while left < right:
        mid = left + (right - left) // 2
        
        # 오른쪽이 더 크면 오른쪽에 피크가 있음
        if nums[mid] < nums[mid + 1]:
            left = mid + 1
        # 왼쪽이 더 크거나 같으면 왼쪽에 피크가 있음
        else:
            right = mid
    
    return left

def find_all_peaks(nums):
    """모든 피크 원소 찾기"""
    peaks = []
    n = len(nums)
    
    for i in range(n):
        is_peak = True
        
        # 왼쪽 확인
        if i > 0 and nums[i] <= nums[i-1]:
            is_peak = False
        
        # 오른쪽 확인
        if i < n-1 and nums[i] <= nums[i+1]:
            is_peak = False
        
        if is_peak:
            peaks.append(i)
    
    return peaks

# 피크 찾기 테스트
peak_arrays = [
    [1, 2, 3, 1],
    [1, 2, 1, 3, 5, 6, 4],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1]
]

print("=== Peak Finding ===")
for arr in peak_arrays:
    peak_idx = find_peak_element(arr)
    all_peaks = find_all_peaks(arr)
    
    print(f"Array: {arr}")
    print(f"A peak at index {peak_idx}: {arr[peak_idx]}")
    print(f"All peaks at indices {all_peaks}")
    print()
```

### 3. 제곱근과 거듭제곱
```python
def integer_square_root(x):
    """정수 제곱근 구하기"""
    if x < 0:
        return -1
    if x < 2:
        return x
    
    left, right = 1, x // 2 + 1
    
    while left <= right:
        mid = left + (right - left) // 2
        square = mid * mid
        
        if square == x:
            return mid
        elif square < x:
            left = mid + 1
        else:
            right = mid - 1
    
    return right  # 가장 가까운 작은 정수

def power_function(base, exponent, mod=None):
    """빠른 거듭제곱 (분할 정복)"""
    if exponent == 0:
        return 1
    
    result = 1
    base = base % mod if mod else base
    
    while exponent > 0:
        # 지수가 홀수인 경우
        if exponent % 2 == 1:
            result = (result * base) % mod if mod else result * base
        
        # 지수를 반으로 줄이고 밑을 제곱
        exponent = exponent >> 1  # exponent // 2
        base = (base * base) % mod if mod else base * base
    
    return result

# 제곱근과 거듭제곱 테스트
print("=== Integer Square Root ===")
for x in [0, 1, 4, 8, 9, 15, 16, 24, 25]:
    sqrt_x = integer_square_root(x)
    print(f"√{x} = {sqrt_x} (verification: {sqrt_x}² = {sqrt_x**2})")

print("\n=== Fast Exponentiation ===")
test_cases = [(2, 10), (3, 4), (5, 100, 1000), (2, 1000, 1000000007)]

for case in test_cases:
    if len(case) == 2:
        base, exp = case
        result = power_function(base, exp)
        print(f"{base}^{exp} = {result}")
    else:
        base, exp, mod = case
        result = power_function(base, exp, mod)
        print(f"{base}^{exp} mod {mod} = {result}")
```

##  이진 탐색 활용 팁

###  적용 조건
1. **정렬된 데이터**: 배열이나 리스트가 정렬되어 있어야 함
2. **단조성**: 찾는 조건이 단조증가 또는 단조감소
3. **랜덤 접근**: 인덱스로 O(1) 접근 가능

###  변형 문제 패턴
- **첫 번째/마지막 위치**: Lower/Upper Bound
- **매개변수 탐색**: 최적값 찾기 문제
- **실수 탐색**: 연속 함수에서의 근 찾기
- **2D 탐색**: 정렬된 행렬에서 탐색

### ⚠️ 주의사항
- **오버플로우**: `mid = (left + right) // 2` 대신 `mid = left + (right - left) // 2`
- **무한루프**: 경계 조건 처리 주의
- **부등호**: `<=`, `<` 조건 정확히 구분

## 🎖️ 레벨별 연습 문제

### 🥉 초급
- BOJ 1920: 수 찾기
- BOJ 10816: 숫자 카드 2
- BOJ 1654: 랜선 자르기

### 🥈 중급
- BOJ 2805: 나무 자르기
- BOJ 2110: 공유기 설치
- BOJ 1300: K번째 수

### 🥇 고급
- BOJ 12015: 가장 긴 증가하는 부분 수열 2
- BOJ 2143: 두 배열의 합
- LeetCode 4: Median of Two Sorted Arrays

---

**이전 학습**: [선형 탐색(Linear Search)](../linear-search/) ⬅️
**다음 학습**: [BFS (너비 우선 탐색)](../bfs/) 

이진 탐색은 **효율성의 대명사**입니다. 정렬된 데이터에서 O(log n)의 마법을 경험해보세요!