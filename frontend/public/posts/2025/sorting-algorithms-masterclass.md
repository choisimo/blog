---
title: "정렬 알고리즘 완전 정복: 버블 정렬부터 힙 정렬까지"
date: "2025-11-01"
category: "알고리즘"
tags: ['정렬', '알고리즘', 'Java']
excerpt: "버블 정렬부터 힙 정렬까지, 핵심 비유와 수도 코드, Java 구현으로 정렬 알고리즘을 완전 정복합니다."
readTime: "14분"
---

# 정렬 알고리즘 완전 정복: 개념부터 자바 코드까지

## 1. 도입: 왜 정렬을 배워야 할까?

정렬(Sorting)은 **데이터를 다루는 거의 모든 순간에 등장하는 기본기**다. 스마트폰 주소록을 이름순으로 정리하거나, 온라인 쇼핑몰에서 가격순으로 상품을 나열하거나, 데이터베이스 인덱스를 만드는 일까지 정렬이 뒷받침한다. 정렬을 이해하면 데이터를 "보기 좋게" 만들 뿐 아니라, **검색・탐색 알고리즘의 효율까지 개선**할 수 있다.

이 글에서는 다음 6가지 대표 정렬 알고리즘을 다룬다.

- 버블 정렬 (Bubble Sort)
- 선택 정렬 (Selection Sort)
- 삽입 정렬 (Insertion Sort)
- 병합 정렬 (Merge Sort)
- 퀵 정렬 (Quick Sort)
- 힙 정렬 (Heap Sort)

각 알고리즘을 다음 5가지 관점으로 파헤친다.

1. **직관적인 비유**로 핵심 아이디어 이해하기
2. **동작 원리**를 단계별로 따라가기
3. **수도 코드(Pseudo Code)**로 논리 구조 확인하기
4. **Java 코드**로 실제 구현 보기
5. **성능 분석 및 활용 팁** 정리하기

정렬 알고리즘의 흐름과 차이를 한 번에 정리하고, 상황에 맞는 최적의 정렬을 고르는 감각을 길러보자.

## 2. 기본 정렬 알고리즘: $O(n^2)$의 세계

데이터 개수가 많지 않을 때, 혹은 정렬 로직을 처음 학습할 때 가장 자주 소개되는 세 가지 알고리즘이다. 구현은 쉽지만, 데이터가 커질수록 성능이 급격히 떨어진다.

### 2-1. 버블 정렬 (Bubble Sort) — 거품이 위로 올라오는 모습

#### 버블 정렬 핵심 비유

물속의 거품이 위로 올라오는 것처럼, **가장 큰 데이터가 매 회전마다 배열의 끝으로 밀려난다.** 두 사람씩 짝을 지어 키를 비교하고, 키가 더 큰 사람이 뒤로 가도록 자리를 바꾸는 교실 풍경을 떠올리면 된다.

#### 버블 정렬 동작 원리

1. 배열의 첫 번째 원소부터 시작해 바로 다음 원소와 비교한다.
2. 앞의 값이 더 크면 서로 교환한다.
3. 배열 끝까지 반복하면 가장 큰 값이 마지막 자리에 확정된다 (1 라운드).
4. 확정된 마지막 항목을 제외하고 나머지 구간에서 다시 라운드를 반복한다.

#### 버블 정렬 수도 코드

```text
Bubble_Sort(A[], n):
    for i from n-1 down to 1:
        for j from 0 to i-1:
            if (A[j] > A[j+1])
                swap A[j] and A[j+1]
```

#### 버블 정렬 Java 코드

```java
void bubbleSort(int[] arr) {
    int n = arr.length;
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}
```

#### 버블 정렬 성능 분석 및 활용

- 시간 복잡도: 최선 $O(n)$ (조기 종료 최적화 적용 시), 평균/최악 $O(n^2)$
- 공간 복잡도: $O(1)$ (제자리 정렬)
- 장점: 구현이 매우 직관적이며 교육용으로 적합
- 단점: 대부분의 상황에서 너무 느림
- 활용: 학습 목적의 데모, 데이터가 매우 작을 때만 고려

### 2-2. 선택 정렬 (Selection Sort) — 매 라운드 1등만 뽑기

#### 선택 정렬 핵심 비유

여러 명이 줄을 서 있을 때, 전체를 훑어 **가장 키가 작은 사람(1등)을 앞으로 보내고** 다음 라운드에서 남은 사람 중 1등을 다시 찾는 방식이다.

#### 선택 정렬 동작 원리

1. 전체 구간에서 최솟값을 찾아 첫 번째 위치와 교환한다.
2. 두 번째 위치 이후 구간에서 다시 최솟값을 찾고 두 번째 위치와 교환한다.
3. 배열이 정렬될 때까지 이 과정을 반복한다.

#### 선택 정렬 수도 코드

```text
Selection_Sort(A[], n):
    for i from 0 to n-2:
        minIndex ← i
        for j from i+1 to n-1:
            if (A[j] < A[minIndex])
                minIndex ← j
        swap A[i] and A[minIndex]
```

#### 선택 정렬 Java 코드

```java
void selectionSort(int[] arr) {
    int n = arr.length;
    for (int i = 0; i < n - 1; i++) {
        int minIndex = i;
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIndex]) {
                minIndex = j;
            }
        }
        int temp = arr[i];
        arr[i] = arr[minIndex];
        arr[minIndex] = temp;
    }
}
```

#### 선택 정렬 성능 분석 및 활용

- 시간 복잡도: 최선/평균/최악 모두 $O(n^2)$
- 공간 복잡도: $O(1)$
- 장점: 교환 횟수가 최대 $n-1$로 제한되고, 불필요한 교환이 적다.
- 단점: 비교 횟수가 항상 많다. 안정 정렬이 아니다.
- 활용: 메모리 쓰기가 비싼 환경(플래시 메모리 등)에서 드물게 사용

### 2-3. 삽입 정렬 (Insertion Sort) — 카드 뭉치를 손으로 정리하기

#### 삽입 정렬 핵심 비유

손에 쥔 카드를 정리하는 모습을 떠올리자. 새로 뽑은 카드를 이미 정렬된 카드들 사이에서 맞는 위치에 "삽입"한다.

#### 삽입 정렬 동작 원리

1. 두 번째 원소부터 시작해, 그 앞쪽(이미 정렬된 부분)에 삽입 위치를 찾는다.
2. 삽입 위치까지 원소를 한 칸씩 뒤로 밀고, 빈 자리에 새 원소를 넣는다.
3. 배열이 끝날 때까지 반복한다.

#### 삽입 정렬 수도 코드

```text
Insertion_Sort(A[], n):
    for i from 1 to n-1:
        key ← A[i]
        j ← i - 1
        while (j ≥ 0 and A[j] > key):
            A[j + 1] ← A[j]
            j ← j - 1
        A[j + 1] ← key
```

#### 삽입 정렬 Java 코드

```java
void insertionSort(int[] arr) {
    for (int i = 1; i < arr.length; i++) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}
```

#### 삽입 정렬 성능 분석 및 활용

- 시간 복잡도: 최선 $O(n)$ (이미 거의 정렬된 경우), 평균/최악 $O(n^2)$
- 공간 복잡도: $O(1)$
- 장점: 데이터가 거의 정렬된 경우 매우 빠르며 안정 정렬이다.
- 단점: 역순 데이터에 취약하다.
- 활용: 작은 구간 정렬, 하이브리드 정렬 알고리즘(TimSort 등)의 기본 블록

## 3. 고급 정렬 알고리즘: $O(n \log n)$의 세계

데이터가 커질수록 효율적인 알고리즘이 필요하다. 분할 정복과 힙 자료구조를 활용한 대표적인 세 가지를 살펴보자.

### 3-1. 병합 정렬 (Merge Sort) — 나눠서 정복하기

#### 병합 정렬 핵심 비유

책상이 책으로 가득 차 있다면, 혼자 정리하기보다 **반으로 나눠서** 각각 정리한 다음 다시 합치는 편이 낫다. 병합 정렬은 데이터를 최소 단위까지 나눈 뒤, **정렬된 작은 조각을 merge 함수로 합쳐 전체를 정렬**한다.

#### 병합 정렬 동작 원리

1. 배열을 절반으로 나눈다 (Divide).
2. 각 절반을 재귀적으로 정렬한다.
3. 두 정렬된 배열을 merge 함수로 합쳐 최종 정렬된 배열을 만든다 (Conquer).

#### 병합 정렬 수도 코드 (Merge 함수)

```text
Merge(A[], p, q, r):
    i ← p; j ← q + 1; t ← 0
    while (i ≤ q and j ≤ r):
        if (A[i] < A[j]) tmp[t++] ← A[i++]
        else tmp[t++] ← A[j++]
    while (i ≤ q): tmp[t++] ← A[i++]
    while (j ≤ r): tmp[t++] ← A[j++]
    i ← p; t ← 0
    while (i ≤ r): A[i++] ← tmp[t++]
```

#### 병합 정렬 Java 코드

```java
void mergeSort(int[] arr) {
    if (arr.length < 2) {
        return;
    }
    mergeSort(arr, 0, arr.length - 1, new int[arr.length]);
}

private void mergeSort(int[] arr, int left, int right, int[] temp) {
    if (left >= right) {
        return;
    }
    int mid = left + (right - left) / 2;
    mergeSort(arr, left, mid, temp);
    mergeSort(arr, mid + 1, right, temp);
    merge(arr, left, mid, right, temp);
}

private void merge(int[] arr, int left, int mid, int right, int[] temp) {
    int i = left;
    int j = mid + 1;
    int t = 0;

    while (i <= mid && j <= right) {
        if (arr[i] <= arr[j]) {
            temp[t++] = arr[i++];
        } else {
            temp[t++] = arr[j++];
        }
    }
    while (i <= mid) {
        temp[t++] = arr[i++];
    }
    while (j <= right) {
        temp[t++] = arr[j++];
    }
    i = left;
    t = 0;
    while (i <= right) {
        arr[i++] = temp[t++];
    }
}
```

#### 병합 정렬 성능 분석 및 활용

- 시간 복잡도: 모든 경우 $O(n \log n)$
- 공간 복잡도: $O(n)$ (보조 배열 필요)
- 장점: 비교 기반 정렬 중 안정성이 뛰어나며, 예측 가능한 수행 시간
- 단점: 추가 메모리 사용, 작은 데이터에서는 재귀 비용이 부담
- 활용: 안정 정렬이 필요한 경우, 외부 정렬(external sort)

### 3-2. 퀵 정렬 (Quick Sort) — 기준으로 좌우를 나누기

#### 퀵 정렬 핵심 비유

단체 사진을 찍을 때, 기준이 될 사람을 뽑고 **그 사람보다 키가 작은 사람은 왼쪽, 큰 사람은 오른쪽으로 보내** 두 줄로 나눈다. 이후 각 줄에서 다시 같은 작업을 반복한다.

#### 퀵 정렬 동작 원리

1. 피벗(Pivot)을 하나 선택한다.
2. 피벗보다 작은 값은 왼쪽, 큰 값은 오른쪽으로 분할한다 (Partition).
3. 분할된 두 구간에서 재귀적으로 퀵 정렬을 수행한다.

#### 퀵 정렬 수도 코드 (Partition 포함)

```text
Quick_Sort(A[], p, r):
    if (p < r):
        q ← partition(A, p, r)
        Quick_Sort(A, p, q - 1)
        Quick_Sort(A, q + 1, r)

partition(A, p, r):
    pivot ← A[r]
    i ← p - 1
    for j from p to r - 1:
        if (A[j] ≤ pivot):
            i ← i + 1
            swap A[i] and A[j]
    swap A[i + 1] and A[r]
    return i + 1
```

#### 퀵 정렬 Java 코드

```java
void quickSort(int[] arr) {
    quickSort(arr, 0, arr.length - 1);
}

private void quickSort(int[] arr, int left, int right) {
    if (left >= right) {
        return;
    }
    int pivotIndex = partition(arr, left, right);
    quickSort(arr, left, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, right);
}

private int partition(int[] arr, int left, int right) {
    int pivot = arr[right];
    int i = left - 1;
    for (int j = left; j < right; j++) {
        if (arr[j] <= pivot) {
            i++;
            swap(arr, i, j);
        }
    }
    swap(arr, i + 1, right);
    return i + 1;
}

private void swap(int[] arr, int i, int j) {
    int temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}
```

#### 퀵 정렬 성능 분석 및 활용

- 시간 복잡도: 평균 $O(n \log n)$, 최악 $O(n^2)$ (불균형 피벗 선택 시)
- 공간 복잡도: 평균 $O(\log n)$ (재귀 호출 스택)
- 장점: 평균적으로 매우 빠르고 제자리 정렬이다.
- 단점: 최악의 경우 성능이 떨어지며 안정 정렬이 아니다.
- 활용: 대부분의 언어에서 기본 정렬의 핵심 아이디어. 랜덤 피벗, median-of-three 같은 최적화와 함께 사용

### 3-3. 힙 정렬 (Heap Sort) — 토너먼트로 승자 가려내기

#### 힙 정렬 핵심 비유

모든 데이터를 **최대 힙(Max Heap)**이라는 토너먼트 대진표로 구성한다. 루트에는 항상 우승자(최댓값)가 있고, 우승자를 뽑아 정렬된 배열의 맨 뒤에 붙인다. 마지막 원소를 루트로 올린 뒤 **percolateDown**을 실행해 새로운 우승자를 만들기를 반복한다.

#### 힙 정렬 동작 원리

1. 배열을 최대 힙 구조로 만든다 (Heapify).
2. 루트(최댓값)와 배열의 마지막 값을 교환한다.
3. 힙 크기를 하나 줄이고, 루트에 대해 percolateDown을 실행해 힙 속성을 복구한다.
4. 모든 원소가 정렬될 때까지 2-3단계를 반복한다.

#### 힙 정렬 수도 코드 (percolateDown & deleteMax)

```text
percolateDown(A[], k, n):
    child ← 2k + 1
    while (child ≤ n - 1):
        right ← 2k + 2
        if (right ≤ n - 1 and A[child] < A[right])
            child ← right
        if (A[k] < A[child]):
            swap A[k] and A[child]
            k ← child
            child ← 2k + 1
        else:
            break

deleteMax(A[], n):
    max ← A[0]
    A[0] ← A[n - 1]
    percolateDown(A, 0, n - 1)
    return max
```

**Java 코드**

```java
void heapSort(int[] arr) {
    int n = arr.length;

    for (int i = n / 2 - 1; i >= 0; i--) {
        heapify(arr, n, i);
    }

    for (int end = n - 1; end > 0; end--) {
        swap(arr, 0, end);
        heapify(arr, end, 0);
    }
}

private void heapify(int[] arr, int heapSize, int root) {
    int largest = root;
    int left = 2 * root + 1;
    int right = 2 * root + 2;

    if (left < heapSize && arr[left] > arr[largest]) {
        largest = left;
    }
    if (right < heapSize && arr[right] > arr[largest]) {
        largest = right;
    }
    if (largest != root) {
        swap(arr, root, largest);
        heapify(arr, heapSize, largest);
    }
}

private void swap(int[] arr, int i, int j) {
    int temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}
```

**성능 분석 및 활용**

- 시간 복잡도: 항상 $O(n \log n)$
- 공간 복잡도: $O(1)$
- 장점: 최악의 경우에도 일정한 속도를 보장, 추가 메모리가 필요 없음
- 단점: 안정 정렬이 아니며, 실제로는 캐시 효율이 다소 떨어질 수 있다.
- 활용: 우선순위 큐, 실시간 시스템 등에서 안정적인 수행 시간이 필요할 때

## 4. 총정리 & 비교 분석

### 4-1. 정렬 알고리즘 한눈에 보기

| 알고리즘 | 평균 시간 복잡도 | 최악 시간 복잡도 | 공간 복잡도 | 안정성 |
| :--- | :---: | :---: | :---: | :---: |
| 버블 정렬 | $O(n^2)$ | $O(n^2)$ | $O(1)$ | O |
| 선택 정렬 | $O(n^2)$ | $O(n^2)$ | $O(1)$ | X |
| 삽입 정렬 | $O(n^2)$ | $O(n^2)$ | $O(1)$ | O |
| 병합 정렬 | $O(n \log n)$ | $O(n \log n)$ | $O(n)$ | O |
| 퀵 정렬 | $O(n \log n)$ | $O(n^2)$ | $O(\log n)$ | X |
| 힙 정렬 | $O(n \log n)$ | $O(n \log n)$ | $O(1)$ | X |

### 4-2. 상황별 추천 가이드

1. **데이터가 매우 적거나 거의 정렬되어 있다면?** 삽입 정렬이 가장 빠르게 끝난다.
2. **정렬 후에도 원래의 상대적 순서를 지켜야 한다면?** 안정 정렬인 병합 정렬을 선택하자.
3. **평균적으로 가장 빠른 정렬이 필요하다면?** 퀵 정렬이 현실적인 선택이다.
4. **추가 메모리가 거의 없고 최악의 경우에도 성능 보장이 필요하다면?** 힙 정렬이 안전하다.
5. **정렬을 처음 배우는 중이라면?** 버블 정렬과 선택 정렬로 기본 개념을 익힌 뒤, 삽입 정렬로 성능 차이를 느껴보자.

## 5. 결론: 상황에 맞는 최적의 선택이 답이다

정렬 알고리즘은 "어떤 것이 절대적으로 최고"가 아니라, **상황과 요구 조건에 따라 최선의 선택이 달라지는 도구 상자**다. 오늘 살펴본 6가지 알고리즘은 모두 Java로 쉽게 구현할 수 있으며, 실제 언어가 제공하는 `Arrays.sort()`나 `Collections.sort()` 역시 내부에서 이러한 아이디어를 변형해 사용한다.

내장 함수만 쓰더라도 정렬의 내부 작동 방식을 이해하면, 성능 이슈를 진단하거나 문제 상황에 맞는 대체 로직을 설계할 때 큰 도움이 된다. 이번 정리를 발판 삼아, 더 다양한 자료구조와 알고리즘으로 학습 범위를 넓혀보자.
