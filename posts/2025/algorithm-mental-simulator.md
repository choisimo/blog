---
title: "알고리즘을 메모리 영화관에서 돌려보는 밤"
date: "2025-10-18"
category: "Computer Science"
tags: ['알고리즘', '시간복잡도', '정렬', '탐색트리', '해시', 'DP', 'Greedy']
excerpt: "Big-O는 교통수단, 병합 정렬은 지도 조각, 해시는 주소 직통. 시뮬레이터형 두뇌로 재생한 알고리즘 18편의 심화 문제와 비유"
readTime: "20분"
---

알고리즘을 배울 때마다 저는 머릿속에서 작은 영화관을 엽니다. 각 알고리즘이 주인공이 되고, 데이터는 배우가 되어 움직입니다. 자전거 속도로 달리는 $O(N)$, 거북이걸음 같은 $O(N^2)$, KTX처럼 질주하는 $O(N \log N)$… 이 영화관에서 본 장면들을 잊지 않기 위해, 이번엔 스스로 던진 심화 문제와 설명들을 기록해 두려 합니다. 모든 비유와 문제는 "시뮬레이터형 두뇌"에 맞춰, 알고리즘이 어떻게 움직이고 비용을 쓰는지 장면처럼 그려 볼 수 있도록 구성했습니다.

---

## I. 기초 분석 – 시간 복잡도와 재귀의 성장 패턴

### 🎬 장면 1: 시간 복잡도는 서로 다른 교통수단이다

- $O(N)$: 자전거 – 입력이 두 배가 되면 시간이 딱 두 배.
- $O(N^2)$: 거북이걸음 – 입력이 늘어나면 길이도 제곱으로 늘어납니다. 1,000,000개면 $10^{12}$번.
- $O(N \log N)$: KTX – 빨리 달리지만, 역마다 한 번씩 멈춰서 승객을 태웁니다.

**문제 – 성능 업그레이드 정당화**

"$N=1,000,000$" 데이터가 들어오는 시스템에 $O(N^2)$ 알고리즘을 그대로 쓴다면, 1조 번의 연산을 감당할 CPU와 전기를 찾아야 합니다. KTX처럼 바꾸면 $N \log N \approx 20,000,000$에 불과합니다. 이 차이는 50배, 아니 수만 배의 시간 절약입니다. "왜 최적화해야 하죠?"라고 묻는 사람에게 "자전거로 부산까지 갈 건가요?"라고 되묻는 장면을 떠올려 보세요.

### 🎬 장면 2: 재귀는 작은 나사 조립 공정

- 큰 문제 $T(n)$은 작은 문제 두 개 $T(n/2)$에게 작업을 맡기고, 완성된 두 조각을 합칠 때 비용 $+n$을 씁니다.
- 마스터 정리는 이를 보고 즉시 "이거 $O(N \log N)$이네요"라고 알려주는 공정 감독관입니다.

**문제 – 병합 정렬 점화식 설명**

- 왼쪽 나사 조립 라인과 오른쪽 라인이 각각 $T(n/2)$만큼의 비용을 쓰고, 마지막에 두 조각을 합칠 때 다시 $n$만큼의 손이 한 번 더 갑니다.
- 이 공정은 층층이 쌓인 공장처럼 $\log N$의 층을 가진 빌딩입니다. 각 층에서 $N$만큼의 손이 동시에 움직이니, 전체 비용은 $N$ × 층 수 = $N \log N$입니다.

---

## II. 정렬 알고리즘 – 데이터가 춤추는 장면들

### 🎬 삽입 정렬: 카드 정렬

- 이미 정렬된 손에 카드를 한 장씩 끼워 넣습니다.
- 거의 정렬된 상태라면, 카드는 자신의 자리 바로 옆에서 멈춥니다.

**문제 – 온라인 스트림 최적화**

실시간으로 카드가 들어오는 상황이라면, 이미 정렬된 손을 가진 삽입 정렬이 카드를 최소한으로 움직여 정렬을 유지합니다. 퀵 정렬이 모든 덱을 다시 섞을 때, 삽입 정렬은 "카드 한 장 딱 미끄러뜨리면 끝"이죠.

```java
static void insertionSort(int[] arr) {
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

### 🎬 선택 정렬: 최대값 사냥꾼

- 정렬되지 않은 구역에서 가장 큰 친구를 찾아 맨 끝으로 보냅니다.
- $N/2$까지 왔다면, 아직 남은 구역에서 최대값을 찾기 위해 여전히 $N/2$번의 비교가 필요합니다.
- 이 작업이 매 단계 반복되니, 총 비교 횟수 $\sim N^2/2$ → $O(N^2)$입니다.

```java
static void selectionSort(int[] arr) {
    for (int end = arr.length - 1; end > 0; end--) {
        int maxIdx = 0;
        for (int i = 1; i <= end; i++) {
            if (arr[i] > arr[maxIdx]) maxIdx = i;
        }
        swap(arr, maxIdx, end);
    }
}
```

### 🎬 병합 정렬: 지도 조각 합치기

- 큰 지도를 계속 반으로 찢어 한 칸짜리 조각까지 만듭니다.
- 작은 조각 두 개를 작업대($O(N)$ 메모리)에 올려놓고 비교하며 다시 붙입니다.
- 외부 정렬(External Sort)에서, 메모리에 못 올리는 조각을 디스크에 저장하고 합치는 작업대 역할을 하므로 병합 정렬이 최적입니다.

```java
static void mergeSort(int[] arr, int left, int right, int[] temp) {
    if (left >= right) return;
    int mid = (left + right) >>> 1;
    mergeSort(arr, left, mid, temp);
    mergeSort(arr, mid + 1, right, temp);
    merge(arr, left, mid, right, temp);
}
```

### 🎬 퀵 정렬: 피벗으로 벽 세우기

- 피벗은 파티의 기준 손님입니다. 이 손님보다 작은 사람은 왼쪽 VIP 룸으로, 큰 사람은 오른쪽 룸으로 이동합니다.
- 만약 배열이 이미 정렬되어 있다면, 피벗이 항상 끝값이 되어 한쪽 룸이 텅 비고 다른 쪽이 꽉 차는 일이 반복됩니다 → $O(N^2)$.

```java
static void quickSort(int[] arr, int left, int right) {
    if (left >= right) return;
    int pivotIndex = partition(arr, left, right);
    quickSort(arr, left, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, right);
}
```

### 🎬 힙 정렬: 최대값 선발 대회

- 완전 이진 트리로 만든 힙은 항상 루트가 최대값입니다.
- 힙을 추출할 때마다 부모와 자식을 왕복하며 비교해야 하므로, 캐시 친화적이지 않습니다.
- 상수 계수가 커서 퀵 정렬보다 느린 이유가 바로 이 메모리 점프 때문입니다.

```java
static void heapSort(int[] arr) {
    buildMaxHeap(arr);
    for (int end = arr.length - 1; end > 0; end--) {
        swap(arr, 0, end);
        heapify(arr, 0, end);
    }
}
```

### 🎬 기수 정렬: 자릿수 분류작업

- 각 자릿수를 기준으로 버킷(큐)을 돌리며 분류합니다.
- 비교가 아니라 분류이므로, 자릿수 $k$와 요소 수 $N$만큼만 시간이 듭니다 → $O(kN)$.
- 우편물을 우편번호 자리별로 분류하는 작업과 같습니다.

```java
static void radixSort(int[] arr) {
    int max = Arrays.stream(arr).max().orElse(0);
    for (int exp = 1; max / exp > 0; exp *= 10) {
        countingSortByDigit(arr, exp);
    }
}
```

---

## III. 선택 알고리즘 – 원하는 순위만 콕 집어내기

### 🎬 퀵 셀렉트: 승자 그룹만 재귀 호출

- 퀵 정렬과 같은 파티션을 사용하지만, 원하는 순위가 포함된 구역만 재귀 호출합니다.
- 한쪽 파티션만 재귀하므로 평균 $O(N)$에 원하는 $k$번째 원소를 찾습니다.

```java
static int quickSelect(int[] arr, int left, int right, int k) {
    if (left == right) return arr[left];
    int pivotIndex = partition(arr, left, right);
    int rank = pivotIndex - left + 1;
    if (k == rank) return arr[pivotIndex];
    if (k < rank) return quickSelect(arr, left, pivotIndex - 1, k);
    return quickSelect(arr, pivotIndex + 1, right, k - rank);
}
```

### 🎬 리니어 셀렉트: 중앙값의 중앙값이 균형을 강제한다

- 배열을 다섯 개씩 묶어 각 그룹의 중앙값을 찾고, 그 중앙값들의 중앙값을 피벗으로 삼습니다.
- 한쪽이 최대 $7N/10$ 이하로 줄어들도록 **강제 균형**을 만들기 때문에 최악의 경우에도 $O(N)$입니다.

```java
static int select(int[] arr, int left, int right, int k) {
    if (right - left + 1 <= 5) {
        Arrays.sort(arr, left, right + 1);
        return arr[left + k - 1];
    }
    int numMedians = 0;
    for (int i = left; i <= right; i += 5) {
        int subRight = Math.min(i + 4, right);
        Arrays.sort(arr, i, subRight + 1);
        swap(arr, left + numMedians, i + (subRight - i) / 2);
        numMedians++;
    }
    int medianOfMedians = select(arr, left, left + numMedians - 1, (numMedians + 1) / 2);
    int pivotIndex = partitionAroundPivot(arr, left, right, medianOfMedians);
    int rank = pivotIndex - left + 1;
    if (k == rank) return arr[pivotIndex];
    if (k < rank) return select(arr, left, pivotIndex - 1, k);
    return select(arr, pivotIndex + 1, right, k - rank);
}
```

---

## IV. 검색 트리 – 균형을 잡는 나무들

### 🎬 이진 검색 트리: 절반씩 줄이는 탐색

- 정상 상태에서는 한 단계를 내려갈 때마다 후보가 절반으로 줄어듭니다 → $O(\log N)$.
- 하지만 정렬된 데이터가 들어오면, 트리는 오른쪽으로만 쭉 뻗는 사다리가 됩니다 → $O(N)$.

```java
class BST {
    static class Node {
        int key;
        Node left, right;
        Node(int key) { this.key = key; }
    }
    Node root;
    void insert(int key) { root = insertRec(root, key); }
    Node insertRec(Node node, int key) {
        if (node == null) return new Node(key);
        if (key < node.key) node.left = insertRec(node.left, key);
        else node.right = insertRec(node.right, key);
        return node;
    }
    boolean search(int key) {
        Node cur = root;
        while (cur != null) {
            if (key == cur.key) return true;
            cur = key < cur.key ? cur.left : cur.right;
        }
        return false;
    }
}
```

### 🎬 레드 블랙 트리: 빨강과 검정으로 세운 균형 잡힌 건축물

- 규칙: 루트는 검정, 모든 리프는 검정, 빨강 노드의 자녀는 꼭 검정.
- 빨강이 연속되면 한쪽으로 기울어져 균형이 무너지므로 회전과 재색칠로 즉시 교정합니다.

```java
class RedBlackTree {
    private static final boolean RED = true;
    private static final boolean BLACK = false;
    private static class Node {
        int key; boolean color;
        Node left, right, parent;
        Node(int key, boolean color) { this.key = key; this.color = color; }
    }
    private Node root;

    public void insert(int key) {
        Node node = new Node(key, RED);
        root = bstInsert(root, node);
        fixInsert(node);
    }

    private Node bstInsert(Node root, Node node) {
        if (root == null) return node;
        if (node.key < root.key) {
            root.left = bstInsert(root.left, node);
            root.left.parent = root;
        } else {
            root.right = bstInsert(root.right, node);
            root.right.parent = root;
        }
        return root;
    }

    private void fixInsert(Node node) {
        while (node != root && node.parent.color == RED) {
            if (node.parent == node.parent.parent.left) {
                Node uncle = node.parent.parent.right;
                if (uncle != null && uncle.color == RED) { // Case 1: recolor
                    node.parent.color = BLACK;
                    uncle.color = BLACK;
                    node.parent.parent.color = RED;
                    node = node.parent.parent;
                } else {
                    if (node == node.parent.right) { // Case 2: rotate left
                        node = node.parent;
                        leftRotate(node);
                    }
                    node.parent.color = BLACK;       // Case 3: rotate right
                    node.parent.parent.color = RED;
                    rightRotate(node.parent.parent);
                }
            } else {
                // mirror case omitted for brevity
            }
        }
        root.color = BLACK;
    }

    private void leftRotate(Node x) {
        Node y = x.right;
        x.right = y.left;
        if (y.left != null) y.left.parent = x;
        y.parent = x.parent;
        if (x.parent == null) root = y;
        else if (x == x.parent.left) x.parent.left = y;
        else x.parent.right = y;
        y.left = x;
        x.parent = y;
    }

    private void rightRotate(Node y) {
        Node x = y.left;
        y.left = x.right;
        if (x.right != null) x.right.parent = y;
        x.parent = y.parent;
        if (y.parent == null) root = x;
        else if (y == y.parent.left) y.parent.left = x;
        else y.parent.right = x;
        x.right = y;
        y.parent = x;
    }
}
```

### 🎬 B-트리: 디스크 블록에 맞춘 대형 도서관

- 노드 하나가 디스크 블록 하나입니다. 한 번 읽을 때 최대한 많은 키를 메모리로 불러옵니다.
- 자식 포인터가 여러 개이므로 트리 높이가 낮아지고, 디스크 접근 횟수 $O(\log N)$가 아주 작아집니다.

```java
class BTree {
    static class Node {
        int t; // 최소 차수
        int n; // 현재 키 수
        boolean leaf;
        int[] keys;
        Node[] children;
        Node(int t, boolean leaf) {
            this.t = t;
            this.leaf = leaf;
            this.keys = new int[2 * t - 1];
            this.children = new Node[2 * t];
            this.n = 0;
        }
    }
    Node root;

    public void search(int key) {
        search(root, key);
    }

    private void search(Node node, int key) {
        if (node == null) return;
        int i = 0;
        while (i < node.n && key > node.keys[i]) i++;
        if (i < node.n && node.keys[i] == key) {
            System.out.println("Found key: " + key);
            return;
        }
        if (node.leaf) {
            System.out.println("Key not found: " + key);
            return;
        }
        search(node.children[i], key);
    }
}
```

### 🎬 KD-트리: 다차원 공간의 분할

- 레벨마다 다른 축(필드)을 기준으로 공간을 분할합니다.
- 삭제할 때는 해당 레벨의 축 기준으로 가장 작은 노드를 오른쪽 서브트리에서 찾아서 대체해야 합니다. 그래야 분할 규칙이 유지됩니다.

```java
class KDTree {
    static class Node {
        int[] point;
        Node left, right;
        Node(int[] point) { this.point = point; }
    }
    Node root;
    static final int K = 2; // 2D example

    public void insert(int[] point) { root = insertRec(root, point, 0); }

    private Node insertRec(Node node, int[] point, int depth) {
        if (node == null) return new Node(point);
        int axis = depth % K;
        if (point[axis] < node.point[axis]) node.left = insertRec(node.left, point, depth + 1);
        else node.right = insertRec(node.right, point, depth + 1);
        return node;
    }

    public boolean search(int[] point) { return searchRec(root, point, 0); }

    private boolean searchRec(Node node, int[] point, int depth) {
        if (node == null) return false;
        if (Arrays.equals(node.point, point)) return true;
        int axis = depth % K;
        if (point[axis] < node.point[axis]) return searchRec(node.left, point, depth + 1);
        return searchRec(node.right, point, depth + 1);
    }
}
```

---

## V. 해시 테이블 – 상수 시간의 비밀

### 🎬 해시 테이블: 주소 직통으로 연결되는 전화번호부

- 키를 해시 함수로 계산하여 바로 주소를 찾습니다.
- 테이블 크기 $m$이 짝수거나 10의 거듭제곱이면, 특정 패턴(예: 짝수 키)이 모두 같은 버킷에 몰릴 가능성이 커집니다.
- 소수 $m$을 사용하면 충돌이 고르게 분산됩니다.

```java
class HashTable<K, V> {
    static class Entry<K, V> {
        final K key;
        V value;
        Entry<K, V> next;
        Entry(K key, V value) { this.key = key; this.value = value; }
    }
    private Entry<K, V>[] buckets;

    @SuppressWarnings("unchecked")
    public HashTable(int capacity) {
        buckets = (Entry<K, V>[]) new Entry[capacity];
    }

    private int hash(K key) {
        return (key.hashCode() & 0x7fffffff) % buckets.length;
    }

    public void put(K key, V value) {
        int index = hash(key);
        Entry<K, V> head = buckets[index];
        for (Entry<K, V> e = head; e != null; e = e.next) {
            if (e.key.equals(key)) {
                e.value = value;
                return;
            }
        }
        Entry<K, V> entry = new Entry<>(key, value);
        entry.next = head;
        buckets[index] = entry;
    }

    public V get(K key) {
        int index = hash(key);
        for (Entry<K, V> e = buckets[index]; e != null; e = e.next) {
            if (e.key.equals(key)) return e.value;
        }
        return null;
    }
}
```

### 🎬 개방 주소법과 삭제 마커

- 선형 조사(Linear Probing)에서 삭제한 자리를 그냥 비워 두면, 그 뒤에 있던 키를 찾을 때 탐색이 중단되어 검색 실패가 납니다.
- 대신 "DELETED" 마커를 남겨야 탐색 흐름이 유지됩니다.

```java
class OpenAddressHashTable<K, V> {
    static final Object DELETED = new Object();

    static class Entry<K, V> {
        K key;
        V value;
        Entry(K key, V value) { this.key = key; this.value = value; }
    }

    private Entry<K, V>[] table;
    private int size;

    @SuppressWarnings("unchecked")
    public OpenAddressHashTable(int capacity) {
        table = (Entry<K, V>[]) new Entry[capacity];
    }

    private int hash(K key) {
        return (key.hashCode() & 0x7fffffff) % table.length;
    }

    public void put(K key, V value) {
        int idx = hash(key);
        for (int i = 0; i < table.length; i++) {
            int probe = (idx + i) % table.length;
            Entry<K, V> entry = table[probe];
            if (entry == null || entry.key == DELETED || entry.key.equals(key)) {
                table[probe] = new Entry<>(key, value);
                size++;
                return;
            }
        }
        throw new IllegalStateException("Hash table is full");
    }

    public V get(K key) {
        int idx = hash(key);
        for (int i = 0; i < table.length; i++) {
            int probe = (idx + i) % table.length;
            Entry<K, V> entry = table[probe];
            if (entry == null) return null;
            if (entry.key != DELETED && entry.key.equals(key)) return entry.value;
        }
        return null;
    }

    public void remove(K key) {
        int idx = hash(key);
        for (int i = 0; i < table.length; i++) {
            int probe = (idx + i) % table.length;
            Entry<K, V> entry = table[probe];
            if (entry == null) return;
            if (entry.key != DELETED && entry.key.equals(key)) {
                table[probe].key = (K) DELETED;
                table[probe].value = null;
                size--;
                return;
            }
        }
    }
}
```

---

## VI. 기본 자료구조 & 전략 – 흐름 제어의 예술

### 🎬 스택: Undo/Redo 이중 스택

- 최근 작업은 mainStack에 push.
- Undo 시 mainStack에서 pop하여 redoStack에 push.
- Redo 시 redoStack에서 pop하여 mainStack으로 다시 push.

```java
class UndoRedoManager {
    Deque<String> undoStack = new ArrayDeque<>();
    Deque<String> redoStack = new ArrayDeque<>();

    public void perform(String action) {
        undoStack.push(action);
        redoStack.clear();
    }

    public void undo() {
        if (!undoStack.isEmpty()) {
            String action = undoStack.pop();
            redoStack.push(action);
        }
    }

    public void redo() {
        if (!redoStack.isEmpty()) {
            String action = redoStack.pop();
            undoStack.push(action);
        }
    }
}
```

### 🎬 큐와 BFS: 물결처럼 확산되는 탐색

- 시작점을 큐에 넣고, 한 단계씩 Dequeue하면서 이웃을 Enqueue합니다.
- FIFO 구조 덕분에 같은 거리의 노드를 한 번에 탐색합니다.

```java
static int bfsShortestPath(int[][] maze, int sr, int sc, int tr, int tc) {
    int rows = maze.length, cols = maze[0].length;
    boolean[][] visited = new boolean[rows][cols];
    Queue<int[]> queue = new ArrayDeque<>();
    queue.offer(new int[]{sr, sc, 0});
    visited[sr][sc] = true;
    int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};

    while (!queue.isEmpty()) {
        int[] cur = queue.poll();
        int r = cur[0], c = cur[1], dist = cur[2];
        if (r == tr && c == tc) return dist;
        for (int[] d : dirs) {
            int nr = r + d[0], nc = c + d[1];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (maze[nr][nc] == 1 || visited[nr][nc]) continue;
            visited[nr][nc] = true;
            queue.offer(new int[]{nr, nc, dist + 1});
        }
    }
    return -1;
}
```

### 🎬 Two Pointers: 합이 목표보다 크거나 작을 때

- 합이 목표보다 크면 오른쪽 포인터를 왼쪽으로 → 값이 줄어듭니다.
- 합이 목표보다 작으면 왼쪽 포인터를 오른쪽으로 → 값이 커집니다.

```java
static List<int[]> twoSumSorted(int[] arr, int target) {
    List<int[]> result = new ArrayList<>();
    int left = 0, right = arr.length - 1;
    while (left < right) {
        int sum = arr[left] + arr[right];
        if (sum == target) {
            result.add(new int[]{arr[left], arr[right]});
            left++;
            right--;
        } else if (sum > target) {
            right--;
        } else {
            left++;
        }
    }
    return result;
}
```

### 🎬 이진 탐색과 매개 변수 탐색

- 정수 $x$의 제곱근을 찾거나, 공유기를 설치해서 최소 거리를 최대화하는 문제는 모두 "답 자체가 범위"인 결정 문제입니다.
- 조건에 따라 왼쪽/오른쪽 범위를 줄여나갑니다.

```java
static double sqrtBinarySearch(double x) {
    double low = 0, high = Math.max(1.0, x);
    double eps = 1e-9;
    while (high - low > eps) {
        double mid = (low + high) / 2.0;
        if (mid * mid < x) low = mid; else high = mid;
    }
    return low;
}

static int maximizeDistance(int[] houses, int routers) {
    Arrays.sort(houses);
    int low = 1, high = houses[houses.length - 1] - houses[0];
    int answer = 0;
    while (low <= high) {
        int mid = (low + high) / 2;
        if (canPlace(houses, routers, mid)) {
            answer = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return answer;
}
```

### 🎬 동적 프로그래밍: 메모하는 건축가

- $DP[i]$는 $i$번째 계단에 오르는 방법의 수.
- $DP[i] = DP[i-1] + DP[i-2]$ – 이전 한 칸, 두 칸에서 오는 길을 합칩니다.
- 메모이제이션 덕분에 $O(N)$ 안에 끝납니다.

```java
static int climbStairs(int n) {
    if (n <= 2) return n;
    int[] dp = new int[n + 1];
    dp[1] = 1;
    dp[2] = 2;
    for (int i = 3; i <= n; i++) {
        dp[i] = dp[i-1] + dp[i-2];
    }
    return dp[n];
}
```

### 🎬 Greedy: 동전 거스름돈의 함정과 회의실 배정의 승리

- 동전 단위가 1, 4, 5라면 8원을 거슬러 줄 때 탐욕은 5+1+1+1=4개를 줍니다. 최적은 4+4=2개인데도요.
- 그래서 탐욕 알고리즘이 성공하려면, "언제나 현재 선택이 전체 최적해를 망치지 않는다"는 구조가 보장되어야 합니다.
- 회의실 배정은 종료 시간이 빠른 회의를 선택하면 항상 최적해가 나옵니다.

```java
static int minCoinsGreedy(int[] coins, int amount) {
    Arrays.sort(coins);
    int count = 0;
    for (int i = coins.length - 1; i >= 0; i--) {
        int coin = coins[i];
        while (amount >= coin) {
            amount -= coin;
            count++;
        }
    }
    return (amount == 0) ? count : -1;
}
```

---

## 마무리 – 메모리 영화관에서 다시 떠올린 장면들

이 모든 문제를 풀면서, 제 머릿속 영화관에는 알고리즘이 서로 다른 교통수단, 공정, 춤으로 나타났습니다. 정렬은 카드와 지도, 해시는 우편번호 분류, DP는 건축 설계. 이런 메모리 영화관이 있다면, 여러분은 알고리즘의 내부 작동을 외워서가 아니라, 장면처럼 떠올리며 다시 구현할 수 있을 겁니다.

마지막으로 제 스스로에게 적어 둔 메모입니다.

> "시간 복잡도는 교통수단, 재귀는 공장. 정렬은 데이터의 춤, 트리는 균형 잡힌 건축.
> 해시는 주소 직통, DP는 메모하는 건축가, 탐욕은 순간의 선택.
> 이 모든 장면이 머릿속에서 자연스럽게 재생될 때, 알고리즘은 외워서 쓰는 게 아니라 직접 만들어내는 도구가 된다."

이제 머릿속 영화관의 막을 내리고, 다음 알고리즘을 위한 새로운 장면을 준비해 보겠습니다.
