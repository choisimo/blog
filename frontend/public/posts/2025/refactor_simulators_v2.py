#!/usr/bin/env python3
"""
refactor_simulators_v2.py
Adds Code Trace Panel, Condition Bar, Pointer Row, and Swap Animation to all
algo-NNN-*-simulator.html files in the same directory.

Two input patterns handled:
  BASIC   — inline `let states = [...]` + generic renderState()
  ENHANCED — `let states = []; function generateStates() {...} generateStates();`
            + custom render() — these files also have a .code-panel stub to remove.

Output: files are rewritten in-place (backups written as .bak).
"""

import re
import os
import sys
import glob
import json

# ---------------------------------------------------------------------------
# Python code lines per algorithm (1-indexed; key = algo number as 3-digit str)
# ---------------------------------------------------------------------------
CODE_LINES = {
    "001": [
        "def two_sum(nums, target):",
        "    seen = {}",
        "    for i, num in enumerate(nums):",
        "        comp = target - num",
        "        if comp in seen:",
        "            return [seen[comp], i]",
        "        seen[num] = i",
    ],
    "002": [
        "def rotate(nums, k):",
        "    k %= len(nums)",
        "    nums[:] = nums[-k:] + nums[:-k]",
    ],
    "003": [
        "def remove_duplicates(nums):",
        "    slow = 0",
        "    for fast in range(1, len(nums)):",
        "        if nums[fast] != nums[slow]:",
        "            slow += 1",
        "            nums[slow] = nums[fast]",
        "    return slow + 1",
    ],
    "004": [
        "def max_subarray(nums):",
        "    cur = best = nums[0]",
        "    for n in nums[1:]:",
        "        cur = max(n, cur + n)",
        "        best = max(best, cur)",
        "    return best",
    ],
    "005": [
        "def reverse_string(s):",
        "    left, right = 0, len(s) - 1",
        "    while left < right:",
        "        s[left], s[right] = s[right], s[left]",
        "        left += 1",
        "        right -= 1",
    ],
    "006": [
        "def is_anagram(s, t):",
        "    if len(s) != len(t): return False",
        "    count = {}",
        "    for c in s: count[c] = count.get(c, 0) + 1",
        "    for c in t:",
        "        if c not in count: return False",
        "        count[c] -= 1",
        "    return all(v == 0 for v in count.values())",
    ],
    "007": [
        "def longest_common_prefix(strs):",
        "    prefix = strs[0]",
        "    for s in strs[1:]:",
        "        while not s.startswith(prefix):",
        "            prefix = prefix[:-1]",
        "    return prefix",
    ],
    "008": [
        "def merge_sorted(a, b):",
        "    res, i, j = [], 0, 0",
        "    while i < len(a) and j < len(b):",
        "        if a[i] <= b[j]: res.append(a[i]); i += 1",
        "        else: res.append(b[j]); j += 1",
        "    return res + a[i:] + b[j:]",
    ],
    "009": [
        "def compress(s):",
        "    res, i = '', 0",
        "    while i < len(s):",
        "        ch, cnt = s[i], 0",
        "        while i < len(s) and s[i] == ch:",
        "            i += 1; cnt += 1",
        "        res += ch + (str(cnt) if cnt > 1 else '')",
        "    return res",
    ],
    "010": [
        "def pascal(numRows):",
        "    tri = [[1]]",
        "    for i in range(1, numRows):",
        "        row = [1]",
        "        for j in range(1, i):",
        "            row.append(tri[i-1][j-1] + tri[i-1][j])",
        "        row.append(1); tri.append(row)",
        "    return tri",
    ],
    "011": [
        "def reverse_list(head):",
        "    prev = None",
        "    curr = head",
        "    while curr:",
        "        nxt = curr.next",
        "        curr.next = prev",
        "        prev = curr",
        "        curr = nxt",
        "    return prev",
    ],
    "012": [
        "def has_cycle(head):",
        "    slow = fast = head",
        "    while fast and fast.next:",
        "        slow = slow.next",
        "        fast = fast.next.next",
        "        if slow == fast: return True",
        "    return False",
    ],
    "013": [
        "def merge_lists(l1, l2):",
        "    dummy = ListNode(0)",
        "    cur = dummy",
        "    while l1 and l2:",
        "        if l1.val <= l2.val:",
        "            cur.next = l1; l1 = l1.next",
        "        else:",
        "            cur.next = l2; l2 = l2.next",
        "        cur = cur.next",
        "    cur.next = l1 or l2",
        "    return dummy.next",
    ],
    "014": [
        "def middle_node(head):",
        "    slow = fast = head",
        "    while fast and fast.next:",
        "        slow = slow.next",
        "        fast = fast.next.next",
        "    return slow",
    ],
    "015": [
        "def is_valid(s):",
        "    stack = []",
        "    pairs = {')':'(', ']':'[', '}':'{'}",
        "    for c in s:",
        "        if c in '([{':",
        "            stack.append(c)",
        "        elif not stack or stack[-1] != pairs[c]:",
        "            return False",
        "        else: stack.pop()",
        "    return not stack",
    ],
    "016": [
        "def min_stack_push(val):",
        "    stack.append(val)",
        "    min_stack.append(min(val, min_stack[-1] if min_stack else val))",
    ],
    "017": [
        "def eval_rpn(tokens):",
        "    stack = []",
        "    for t in tokens:",
        "        if t in '+-*/':",
        "            b, a = stack.pop(), stack.pop()",
        "            stack.append(int(a/b) if t=='/' else eval(f'{a}{t}{b}'))",
        "        else: stack.append(int(t))",
        "    return stack[0]",
    ],
    "018": [
        "def generate_parentheses(n):",
        "    res = []",
        "    def bt(s, o, c):",
        "        if len(s) == 2*n: res.append(s); return",
        "        if o < n: bt(s+'(', o+1, c)",
        "        if c < o: bt(s+')', o, c+1)",
        "    bt('', 0, 0)",
        "    return res",
    ],
    "019": [
        "def daily_temperatures(t):",
        "    stack, res = [], [0]*len(t)",
        "    for i, v in enumerate(t):",
        "        while stack and t[stack[-1]] < v:",
        "            j = stack.pop(); res[j] = i - j",
        "        stack.append(i)",
        "    return res",
    ],
    "020": [
        "def trap(height):",
        "    left, right = 0, len(height)-1",
        "    lmax = rmax = water = 0",
        "    while left < right:",
        "        if height[left] < height[right]:",
        "            lmax = max(lmax, height[left])",
        "            water += lmax - height[left]; left += 1",
        "        else:",
        "            rmax = max(rmax, height[right])",
        "            water += rmax - height[right]; right -= 1",
        "    return water",
    ],
    "021": [
        "def three_sum(nums):",
        "    nums.sort()",
        "    res = []",
        "    for i in range(len(nums) - 2):",
        "        if i > 0 and nums[i] == nums[i-1]: continue",
        "        left, right = i + 1, len(nums) - 1",
        "        while left < right:",
        "            s = nums[i] + nums[left] + nums[right]",
        "            if s == 0:",
        "                res.append([nums[i], nums[left], nums[right]])",
        "                left += 1; right -= 1",
        "            elif s < 0: left += 1",
        "            else: right -= 1",
        "    return res",
    ],
    "022": [
        "def max_area(height):",
        "    left, right = 0, len(height) - 1",
        "    best = 0",
        "    while left < right:",
        "        area = min(height[left], height[right]) * (right - left)",
        "        best = max(best, area)",
        "        if height[left] < height[right]: left += 1",
        "        else: right -= 1",
        "    return best",
    ],
    "023": [
        "def sort_colors(nums):",
        "    low = mid = 0; high = len(nums) - 1",
        "    while mid <= high:",
        "        if nums[mid] == 0:",
        "            nums[low], nums[mid] = nums[mid], nums[low]",
        "            low += 1; mid += 1",
        "        elif nums[mid] == 1: mid += 1",
        "        else:",
        "            nums[mid], nums[high] = nums[high], nums[mid]",
        "            high -= 1",
    ],
    "024": [
        "def remove_nth_from_end(head, n):",
        "    dummy = ListNode(0, head)",
        "    fast = slow = dummy",
        "    for _ in range(n+1): fast = fast.next",
        "    while fast:",
        "        fast = fast.next; slow = slow.next",
        "    slow.next = slow.next.next",
        "    return dummy.next",
    ],
    "025": [
        "def copy_list(head):",
        "    if not head: return None",
        "    mp = {}",
        "    cur = head",
        "    while cur:",
        "        mp[cur] = Node(cur.val)",
        "        cur = cur.next",
        "    cur = head",
        "    while cur:",
        "        if cur.next: mp[cur].next = mp[cur.next]",
        "        if cur.random: mp[cur].random = mp[cur.random]",
        "        cur = cur.next",
        "    return mp[head]",
    ],
    "026": [
        "def max_sliding_window(nums, k):",
        "    from collections import deque",
        "    dq, res = deque(), []",
        "    for i, v in enumerate(nums):",
        "        while dq and nums[dq[-1]] < v: dq.pop()",
        "        dq.append(i)",
        "        if dq[0] == i - k: dq.popleft()",
        "        if i >= k-1: res.append(nums[dq[0]])",
        "    return res",
    ],
    "027": [
        "def first_missing_positive(nums):",
        "    n = len(nums)",
        "    for i in range(n):",
        "        while 1 <= nums[i] <= n and nums[nums[i]-1] != nums[i]:",
        "            nums[nums[i]-1], nums[i] = nums[i], nums[nums[i]-1]",
        "    for i in range(n):",
        "        if nums[i] != i+1: return i+1",
        "    return n+1",
    ],
    "028": [
        "def find_duplicate(nums):",
        "    slow = fast = nums[0]",
        "    while True:",
        "        slow = nums[slow]; fast = nums[nums[fast]]",
        "        if slow == fast: break",
        "    slow = nums[0]",
        "    while slow != fast:",
        "        slow = nums[slow]; fast = nums[fast]",
        "    return slow",
    ],
    "029": [
        "def longest_consecutive(nums):",
        "    s = set(nums)",
        "    best = 0",
        "    for n in s:",
        "        if n-1 not in s:",
        "            cur = n; length = 1",
        "            while cur+1 in s: cur += 1; length += 1",
        "            best = max(best, length)",
        "    return best",
    ],
    "030": [
        "def product_except_self(nums):",
        "    n = len(nums)",
        "    res = [1]*n",
        "    for i in range(1, n): res[i] = res[i-1] * nums[i-1]",
        "    right = 1",
        "    for i in range(n-1, -1, -1):",
        "        res[i] *= right; right *= nums[i]",
        "    return res",
    ],
    "031": [
        "def merge_sort(arr):",
        "    if len(arr) <= 1: return arr",
        "    mid = len(arr) // 2",
        "    left = merge_sort(arr[:mid])",
        "    right = merge_sort(arr[mid:])",
        "    return merge(left, right)",
        "def merge(a, b):",
        "    res, i, j = [], 0, 0",
        "    while i<len(a) and j<len(b):",
        "        if a[i]<=b[j]: res.append(a[i]); i+=1",
        "        else: res.append(b[j]); j+=1",
        "    return res+a[i:]+b[j:]",
    ],
    "032": [
        "def quick_sort(arr, lo, hi):",
        "    if lo < hi:",
        "        p = partition(arr, lo, hi)",
        "        quick_sort(arr, lo, p-1)",
        "        quick_sort(arr, p+1, hi)",
        "def partition(arr, lo, hi):",
        "    pivot = arr[hi]; i = lo - 1",
        "    for j in range(lo, hi):",
        "        if arr[j] <= pivot:",
        "            i += 1",
        "            arr[i], arr[j] = arr[j], arr[i]",
        "    arr[i+1], arr[hi] = arr[hi], arr[i+1]",
        "    return i+1",
    ],
    "033": [
        "def bubble_sort(arr):",
        "    n = len(arr)",
        "    for i in range(n):",
        "        for j in range(n-i-1):",
        "            if arr[j] > arr[j+1]:",
        "                arr[j], arr[j+1] = arr[j+1], arr[j]",
        "    return arr",
    ],
    "034": [
        "def binary_search(arr, target):",
        "    left, right = 0, len(arr) - 1",
        "    while left <= right:",
        "        mid = (left + right) // 2",
        "        if arr[mid] == target: return mid",
        "        elif arr[mid] < target: left = mid + 1",
        "        else: right = mid - 1",
        "    return -1",
    ],
    "035": [
        "def insertion_sort(arr):",
        "    for i in range(1, len(arr)):",
        "        key = arr[i]; j = i - 1",
        "        while j >= 0 and arr[j] > key:",
        "            arr[j+1] = arr[j]; j -= 1",
        "        arr[j+1] = key",
        "    return arr",
    ],
    "036": [
        "def selection_sort(arr):",
        "    n = len(arr)",
        "    for i in range(n):",
        "        min_idx = i",
        "        for j in range(i+1, n):",
        "            if arr[j] < arr[min_idx]: min_idx = j",
        "        arr[i], arr[min_idx] = arr[min_idx], arr[i]",
        "    return arr",
    ],
    "037": [
        "def counting_sort(arr):",
        "    if not arr: return arr",
        "    max_v = max(arr)",
        "    count = [0] * (max_v + 1)",
        "    for v in arr: count[v] += 1",
        "    res = []",
        "    for v, c in enumerate(count):",
        "        res.extend([v] * c)",
        "    return res",
    ],
    "038": [
        "def top_k_frequent(nums, k):",
        "    count = {}",
        "    for n in nums: count[n] = count.get(n, 0) + 1",
        "    return sorted(count, key=count.get, reverse=True)[:k]",
    ],
    "039": [
        "def find_kth_largest(nums, k):",
        "    import heapq",
        "    return heapq.nlargest(k, nums)[-1]",
    ],
    "040": [
        "def merge_k_lists(lists):",
        "    import heapq",
        "    heap = []",
        "    for i, node in enumerate(lists):",
        "        if node: heapq.heappush(heap, (node.val, i, node))",
        "    dummy = cur = ListNode(0)",
        "    while heap:",
        "        val, i, node = heapq.heappop(heap)",
        "        cur.next = node; cur = cur.next",
        "        if node.next: heapq.heappush(heap, (node.next.val, i, node.next))",
        "    return dummy.next",
    ],
    "041": [
        "def inorder(root):",
        "    res = []",
        "    def dfs(node):",
        "        if not node: return",
        "        dfs(node.left)",
        "        res.append(node.val)",
        "        dfs(node.right)",
        "    dfs(root)",
        "    return res",
    ],
    "042": [
        "def preorder(root):",
        "    res = []",
        "    def dfs(node):",
        "        if not node: return",
        "        res.append(node.val)",
        "        dfs(node.left)",
        "        dfs(node.right)",
        "    dfs(root)",
        "    return res",
    ],
    "043": [
        "def postorder(root):",
        "    res = []",
        "    def dfs(node):",
        "        if not node: return",
        "        dfs(node.left)",
        "        dfs(node.right)",
        "        res.append(node.val)",
        "    dfs(root)",
        "    return res",
    ],
    "044": [
        "def level_order(root):",
        "    from collections import deque",
        "    if not root: return []",
        "    res, q = [], deque([root])",
        "    while q:",
        "        level = []",
        "        for _ in range(len(q)):",
        "            node = q.popleft()",
        "            level.append(node.val)",
        "            if node.left: q.append(node.left)",
        "            if node.right: q.append(node.right)",
        "        res.append(level)",
        "    return res",
    ],
    "045": [
        "def max_depth(root):",
        "    if not root: return 0",
        "    return 1 + max(max_depth(root.left), max_depth(root.right))",
    ],
    "046": [
        "def is_balanced(root):",
        "    def height(node):",
        "        if not node: return 0",
        "        l, r = height(node.left), height(node.right)",
        "        if l<0 or r<0 or abs(l-r)>1: return -1",
        "        return 1 + max(l, r)",
        "    return height(root) >= 0",
    ],
    "047": [
        "def lowest_common_ancestor(root, p, q):",
        "    if not root or root==p or root==q: return root",
        "    left = lowest_common_ancestor(root.left, p, q)",
        "    right = lowest_common_ancestor(root.right, p, q)",
        "    return root if left and right else left or right",
    ],
    "048": [
        "def is_valid_bst(root):",
        "    def check(node, lo, hi):",
        "        if not node: return True",
        "        if not (lo < node.val < hi): return False",
        "        return check(node.left, lo, node.val) and check(node.right, node.val, hi)",
        "    return check(root, float('-inf'), float('inf'))",
    ],
    "049": [
        "def path_sum(root, target):",
        "    if not root: return False",
        "    if not root.left and not root.right:",
        "        return target == root.val",
        "    return path_sum(root.left, target-root.val) or path_sum(root.right, target-root.val)",
    ],
    "050": [
        "def num_islands(grid):",
        "    count = 0",
        "    for r in range(len(grid)):",
        "        for c in range(len(grid[0])):",
        "            if grid[r][c] == '1':",
        "                bfs(grid, r, c)",
        "                count += 1",
        "    return count",
    ],
    "051": [
        "def inorder(root):",
        "    res = []",
        "    def dfs(node):",
        "        if not node: return",
        "        dfs(node.left)",
        "        res.append(node.val)",
        "        dfs(node.right)",
        "    dfs(root)",
        "    return res",
    ],
    "052": [
        "def can_finish(n, prereqs):",
        "    graph = [[] for _ in range(n)]",
        "    for a, b in prereqs: graph[b].append(a)",
        "    state = [0] * n",
        "    def dfs(v):",
        "        if state[v] == 1: return False",
        "        if state[v] == 2: return True",
        "        state[v] = 1",
        "        for nei in graph[v]:",
        "            if not dfs(nei): return False",
        "        state[v] = 2; return True",
        "    return all(dfs(i) for i in range(n))",
    ],
    "053": [
        "def topo_sort(n, edges):",
        "    from collections import deque",
        "    graph = [[] for _ in range(n)]",
        "    indegree = [0]*n",
        "    for u, v in edges:",
        "        graph[u].append(v); indegree[v] += 1",
        "    q = deque(i for i in range(n) if indegree[i]==0)",
        "    order = []",
        "    while q:",
        "        v = q.popleft(); order.append(v)",
        "        for nei in graph[v]:",
        "            indegree[nei] -= 1",
        "            if indegree[nei]==0: q.append(nei)",
        "    return order if len(order)==n else []",
    ],
    "054": [
        "def dijkstra(graph, src):",
        "    import heapq",
        "    dist = {v: float('inf') for v in graph}",
        "    dist[src] = 0; heap = [(0, src)]",
        "    while heap:",
        "        d, u = heapq.heappop(heap)",
        "        if d > dist[u]: continue",
        "        for v, w in graph[u]:",
        "            if dist[u]+w < dist[v]:",
        "                dist[v] = dist[u]+w",
        "                heapq.heappush(heap, (dist[v], v))",
    ],
    "055": [
        "def union_find_union(x, y):",
        "    px, py = find(x), find(y)",
        "    if px == py: return False",
        "    parent[px] = py; return True",
        "def find(x):",
        "    if parent[x] != x: parent[x] = find(parent[x])",
        "    return parent[x]",
    ],
    "056": [
        "def num_components(n, edges):",
        "    parent = list(range(n))",
        "    def find(x): return x if parent[x]==x else find(parent[x])",
        "    def union(a, b): parent[find(a)] = find(b)",
        "    for a, b in edges: union(a, b)",
        "    return len(set(find(i) for i in range(n)))",
    ],
    "057": [
        "def word_ladder(begin, end, word_list):",
        "    from collections import deque",
        "    bank = set(word_list)",
        "    if end not in bank: return 0",
        "    q = deque([(begin, 1)])",
        "    while q:",
        "        word, steps = q.popleft()",
        "        for i in range(len(word)):",
        "            for c in 'abcdefghijklmnopqrstuvwxyz':",
        "                nw = word[:i]+c+word[i+1:]",
        "                if nw == end: return steps+1",
        "                if nw in bank:",
        "                    bank.remove(nw); q.append((nw, steps+1))",
        "    return 0",
    ],
    "058": [
        "def walls_and_gates(rooms):",
        "    from collections import deque",
        "    INF = float('inf')",
        "    q = deque()",
        "    for r in range(len(rooms)):",
        "        for c in range(len(rooms[0])):",
        "            if rooms[r][c] == 0: q.append((r,c))",
        "    while q:",
        "        r, c = q.popleft()",
        "        for dr, dc in [(1,0),(-1,0),(0,1),(0,-1)]:",
        "            nr, nc = r+dr, c+dc",
        "            if 0<=nr<len(rooms) and 0<=nc<len(rooms[0]) and rooms[nr][nc]==INF:",
        "                rooms[nr][nc] = rooms[r][c]+1",
        "                q.append((nr,nc))",
    ],
    "059": [
        "def pacific_atlantic(heights):",
        "    from collections import deque",
        "    m, n = len(heights), len(heights[0])",
        "    def bfs(starts):",
        "        visited = set(starts)",
        "        q = deque(starts)",
        "        while q:",
        "            r, c = q.popleft()",
        "            for dr, dc in [(1,0),(-1,0),(0,1),(0,-1)]:",
        "                nr, nc = r+dr, c+dc",
        "                if 0<=nr<m and 0<=nc<n and (nr,nc) not in visited and heights[nr][nc]>=heights[r][c]:",
        "                    visited.add((nr,nc)); q.append((nr,nc))",
        "        return visited",
    ],
    "060": [
        "def rotate_image(matrix):",
        "    n = len(matrix)",
        "    for i in range(n):",
        "        for j in range(i+1, n):",
        "            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]",
        "    for row in matrix: row.reverse()",
    ],
    "061": [
        "class MinHeap:",
        "    def push(self, val):",
        "        self.heap.append(val)",
        "        self._sift_up(len(self.heap)-1)",
        "    def pop(self):",
        "        self.heap[0], self.heap[-1] = self.heap[-1], self.heap[0]",
        "        val = self.heap.pop()",
        "        self._sift_down(0)",
        "        return val",
    ],
    "062": [
        "def find_median(nums):",
        "    import heapq",
        "    lo, hi = [], []",
        "    for n in nums:",
        "        heapq.heappush(lo, -n)",
        "        heapq.heappush(hi, -heapq.heappop(lo))",
        "        if len(lo) < len(hi):",
        "            heapq.heappush(lo, -heapq.heappop(hi))",
        "    if len(lo)==len(hi): return (-lo[0]+hi[0])/2",
        "    return -lo[0]",
    ],
    "063": [
        "def climb_stairs(n):",
        "    if n <= 2: return n",
        "    a, b = 1, 2",
        "    for _ in range(3, n+1):",
        "        a, b = b, a+b",
        "    return b",
    ],
    "064": [
        "def rob(nums):",
        "    prev2 = prev1 = 0",
        "    for n in nums:",
        "        prev2, prev1 = prev1, max(prev1, prev2+n)",
        "    return prev1",
    ],
    "065": [
        "def longest_increasing_subsequence(nums):",
        "    dp = []",
        "    for n in nums:",
        "        lo, hi = 0, len(dp)",
        "        while lo < hi:",
        "            mid = (lo+hi)//2",
        "            if dp[mid] < n: lo = mid+1",
        "            else: hi = mid",
        "        if lo == len(dp): dp.append(n)",
        "        else: dp[lo] = n",
        "    return len(dp)",
    ],
    "066": [
        "def bfs(graph, start):",
        "    from collections import deque",
        "    visited = set([start])",
        "    queue = deque([start])",
        "    while queue:",
        "        node = queue.popleft()",
        "        for nei in graph[node]:",
        "            if nei not in visited:",
        "                visited.add(nei)",
        "                queue.append(nei)",
    ],
    "067": [
        "def dfs(graph, node, visited=None):",
        "    if visited is None: visited = set()",
        "    visited.add(node)",
        "    for nei in graph[node]:",
        "        if nei not in visited:",
        "            dfs(graph, nei, visited)",
        "    return visited",
    ],
    "068": [
        "def fibonacci(n):",
        "    if n <= 1: return n",
        "    dp = [0] * (n+1)",
        "    dp[1] = 1",
        "    for i in range(2, n+1):",
        "        dp[i] = dp[i-1] + dp[i-2]",
        "    return dp[n]",
    ],
    "069": [
        "def min_cost_climbing(cost):",
        "    n = len(cost)",
        "    dp = [0] * (n+1)",
        "    for i in range(2, n+1):",
        "        dp[i] = min(dp[i-1]+cost[i-1], dp[i-2]+cost[i-2])",
        "    return dp[n]",
    ],
    "070": [
        "def unique_paths(m, n):",
        "    dp = [[1]*n for _ in range(m)]",
        "    for i in range(1, m):",
        "        for j in range(1, n):",
        "            dp[i][j] = dp[i-1][j] + dp[i][j-1]",
        "    return dp[m-1][n-1]",
    ],
    "071": [
        "def longest_common_subsequence(s, t):",
        "    m, n = len(s), len(t)",
        "    dp = [[0]*(n+1) for _ in range(m+1)]",
        "    for i in range(1, m+1):",
        "        for j in range(1, n+1):",
        "            if s[i-1]==t[j-1]: dp[i][j] = dp[i-1][j-1]+1",
        "            else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])",
        "    return dp[m][n]",
    ],
    "072": [
        "def knapsack(weights, values, W):",
        "    n = len(weights)",
        "    dp = [[0]*(W+1) for _ in range(n+1)]",
        "    for i in range(1, n+1):",
        "        for w in range(W+1):",
        "            dp[i][w] = dp[i-1][w]",
        "            if weights[i-1] <= w:",
        "                dp[i][w] = max(dp[i][w], dp[i-1][w-weights[i-1]]+values[i-1])",
        "    return dp[n][W]",
    ],
    "073": [
        "def edit_distance(s, t):",
        "    m, n = len(s), len(t)",
        "    dp = list(range(n+1))",
        "    for i in range(1, m+1):",
        "        ndp = [i] + [0]*n",
        "        for j in range(1, n+1):",
        "            if s[i-1]==t[j-1]: ndp[j] = dp[j-1]",
        "            else: ndp[j] = 1 + min(dp[j], ndp[j-1], dp[j-1])",
        "        dp = ndp",
        "    return dp[n]",
    ],
    "074": [
        "def word_break(s, word_dict):",
        "    n = len(s)",
        "    dp = [False]*(n+1); dp[0] = True",
        "    for i in range(1, n+1):",
        "        for w in word_dict:",
        "            if dp[i-len(w)] and s[i-len(w):i]==w:",
        "                dp[i] = True; break",
        "    return dp[n]",
    ],
    "075": [
        "def max_profit(prices):",
        "    min_p = float('inf'); max_p = 0",
        "    for p in prices:",
        "        min_p = min(min_p, p)",
        "        max_p = max(max_p, p - min_p)",
        "    return max_p",
    ],
    "076": [
        "def max_product_subarray(nums):",
        "    best = cur_max = cur_min = nums[0]",
        "    for n in nums[1:]:",
        "        cur_max, cur_min = max(n, cur_max*n, cur_min*n), min(n, cur_max*n, cur_min*n)",
        "        best = max(best, cur_max)",
        "    return best",
    ],
    "077": [
        "def palindrome_substrings(s):",
        "    n = len(s); count = 0",
        "    dp = [[False]*n for _ in range(n)]",
        "    for i in range(n): dp[i][i] = True; count += 1",
        "    for i in range(n-1):",
        "        if s[i]==s[i+1]: dp[i][i+1] = True; count += 1",
        "    for length in range(3, n+1):",
        "        for i in range(n-length+1):",
        "            j = i+length-1",
        "            if s[i]==s[j] and dp[i+1][j-1]: dp[i][j] = True; count += 1",
        "    return count",
    ],
    "078": [
        "def decode_ways(s):",
        "    if not s or s[0]=='0': return 0",
        "    n = len(s)",
        "    dp = [0]*(n+1); dp[0] = 1; dp[1] = 1",
        "    for i in range(2, n+1):",
        "        one = int(s[i-1:i])",
        "        two = int(s[i-2:i])",
        "        if one >= 1: dp[i] += dp[i-1]",
        "        if 10 <= two <= 26: dp[i] += dp[i-2]",
        "    return dp[n]",
    ],
    "079": [
        "def partition_equal(nums):",
        "    total = sum(nums)",
        "    if total % 2: return False",
        "    target = total // 2",
        "    dp = {0}",
        "    for n in nums:",
        "        dp = {s+n for s in dp} | dp",
        "    return target in dp",
    ],
    "080": [
        "def num_squares(n):",
        "    dp = [float('inf')]*(n+1); dp[0] = 0",
        "    for i in range(1, n+1):",
        "        j = 1",
        "        while j*j <= i:",
        "            dp[i] = min(dp[i], dp[i-j*j]+1)",
        "            j += 1",
        "    return dp[n]",
    ],
    "081": [
        "def jump_game(nums):",
        "    reach = 0",
        "    for i, v in enumerate(nums):",
        "        if i > reach: return False",
        "        reach = max(reach, i+v)",
        "    return True",
    ],
    "082": [
        "def jump_game2(nums):",
        "    jumps = cur_end = cur_far = 0",
        "    for i in range(len(nums)-1):",
        "        cur_far = max(cur_far, i+nums[i])",
        "        if i == cur_end:",
        "            jumps += 1; cur_end = cur_far",
        "    return jumps",
    ],
    "083": [
        "def coin_change(coins, amount):",
        "    dp = [float('inf')] * (amount + 1)",
        "    dp[0] = 0",
        "    for i in range(1, amount + 1):",
        "        for c in coins:",
        "            if c <= i:",
        "                dp[i] = min(dp[i], dp[i - c] + 1)",
        "    return dp[amount] if dp[amount] != float('inf') else -1",
    ],
    "084": [
        "def rob_circle(nums):",
        "    def rob_line(arr):",
        "        prev2 = prev1 = 0",
        "        for n in arr:",
        "            prev2, prev1 = prev1, max(prev1, prev2+n)",
        "        return prev1",
        "    if len(nums)==1: return nums[0]",
        "    return max(rob_line(nums[:-1]), rob_line(nums[1:]))",
    ],
    "085": [
        "def permutations(nums):",
        "    res = []",
        "    def bt(path, used):",
        "        if len(path)==len(nums): res.append(path[:]); return",
        "        for i, n in enumerate(nums):",
        "            if not used[i]:",
        "                used[i] = True; path.append(n)",
        "                bt(path, used)",
        "                path.pop(); used[i] = False",
        "    bt([], [False]*len(nums))",
        "    return res",
    ],
    "086": [
        "def subsets(nums):",
        "    res = [[]]",
        "    for n in nums:",
        "        res += [s+[n] for s in res]",
        "    return res",
    ],
    "087": [
        "def combination_sum(candidates, target):",
        "    res = []",
        "    def bt(start, path, rem):",
        "        if rem == 0: res.append(path[:]); return",
        "        for i in range(start, len(candidates)):",
        "            if candidates[i] <= rem:",
        "                path.append(candidates[i])",
        "                bt(i, path, rem-candidates[i])",
        "                path.pop()",
        "    bt(0, [], target)",
        "    return res",
    ],
    "088": [
        "def letter_combinations(digits):",
        "    if not digits: return []",
        "    phone = {'2':'abc','3':'def','4':'ghi','5':'jkl','6':'mno','7':'pqrs','8':'tuv','9':'wxyz'}",
        "    res = []",
        "    def bt(idx, path):",
        "        if idx==len(digits): res.append(path); return",
        "        for c in phone[digits[idx]]: bt(idx+1, path+c)",
        "    bt(0, '')",
        "    return res",
    ],
    "089": [
        "def n_queens(n):",
        "    res = []; cols = set(); diag1 = set(); diag2 = set()",
        "    board = ['.'*n for _ in range(n)]",
        "    def bt(r):",
        "        if r==n: res.append(board[:]); return",
        "        for c in range(n):",
        "            if c not in cols and r-c not in diag1 and r+c not in diag2:",
        "                cols.add(c); diag1.add(r-c); diag2.add(r+c)",
        "                board[r] = '.'*c+'Q'+'.'*(n-c-1)",
        "                bt(r+1)",
        "                cols.discard(c); diag1.discard(r-c); diag2.discard(r+c)",
        "    bt(0); return res",
    ],
    "090": [
        "def sudoku_solver(board):",
        "    def is_valid(r, c, n):",
        "        if n in board[r]: return False",
        "        if n in [board[i][c] for i in range(9)]: return False",
        "        br, bc = 3*(r//3), 3*(c//3)",
        "        for i in range(br, br+3):",
        "            for j in range(bc, bc+3):",
        "                if board[i][j]==n: return False",
        "        return True",
        "    def solve():",
        "        for r in range(9):",
        "            for c in range(9):",
        "                if board[r][c]=='.':",
        "                    for n in '123456789':",
        "                        if is_valid(r,c,n):",
        "                            board[r][c]=n",
        "                            if solve(): return True",
        "                            board[r][c]='.'",
        "                    return False",
        "        return True",
    ],
    "091": [
        "def kmp_search(text, pattern):",
        "    def build_lps(p):",
        "        lps = [0]*len(p); j = 0",
        "        for i in range(1, len(p)):",
        "            while j and p[i]!=p[j]: j = lps[j-1]",
        "            if p[i]==p[j]: j += 1",
        "            lps[i] = j",
        "        return lps",
        "    lps = build_lps(pattern); j = 0",
        "    matches = []",
        "    for i, c in enumerate(text):",
        "        while j and c!=pattern[j]: j = lps[j-1]",
        "        if c==pattern[j]: j += 1",
        "        if j==len(pattern): matches.append(i-j+1); j=lps[j-1]",
        "    return matches",
    ],
    "092": [
        "def rabin_karp(text, pattern):",
        "    d = 256; q = 101",
        "    m, n = len(pattern), len(text)",
        "    h = pow(d, m-1, q)",
        "    ph = th = 0",
        "    for i in range(m):",
        "        ph = (d*ph + ord(pattern[i])) % q",
        "        th = (d*th + ord(text[i])) % q",
        "    matches = []",
        "    for i in range(n-m+1):",
        "        if ph==th and text[i:i+m]==pattern:",
        "            matches.append(i)",
        "        if i < n-m:",
        "            th = (d*(th-ord(text[i])*h)+ord(text[i+m])) % q",
        "    return matches",
    ],
    "093": [
        "def lru_cache(capacity):",
        "    from collections import OrderedDict",
        "    cache = OrderedDict()",
        "    def get(key):",
        "        if key not in cache: return -1",
        "        cache.move_to_end(key); return cache[key]",
        "    def put(key, value):",
        "        if key in cache: cache.move_to_end(key)",
        "        cache[key] = value",
        "        if len(cache) > capacity: cache.popitem(last=False)",
    ],
    "094": [
        "def trie_insert(root, word):",
        "    node = root",
        "    for c in word:",
        "        if c not in node: node[c] = {}",
        "        node = node[c]",
        "    node['#'] = True",
        "def trie_search(root, word):",
        "    node = root",
        "    for c in word:",
        "        if c not in node: return False",
        "        node = node[c]",
        "    return '#' in node",
    ],
    "095": [
        "class SegmentTree:",
        "    def build(self, arr, node, start, end):",
        "        if start==end: self.tree[node]=arr[start]; return",
        "        mid = (start+end)//2",
        "        self.build(arr, 2*node, start, mid)",
        "        self.build(arr, 2*node+1, mid+1, end)",
        "        self.tree[node] = self.tree[2*node]+self.tree[2*node+1]",
        "    def query(self, node, start, end, l, r):",
        "        if r<start or end<l: return 0",
        "        if l<=start and end<=r: return self.tree[node]",
        "        mid = (start+end)//2",
        "        return self.query(2*node,start,mid,l,r)+self.query(2*node+1,mid+1,end,l,r)",
    ],
    "096": [
        "def bit_update(bit, i, delta, n):",
        "    i += 1",
        "    while i <= n:",
        "        bit[i] += delta; i += i & (-i)",
        "def bit_query(bit, i):",
        "    i += 1; s = 0",
        "    while i > 0:",
        "        s += bit[i]; i -= i & (-i)",
        "    return s",
    ],
    "097": [
        "def sparse_table_build(arr):",
        "    import math",
        "    n = len(arr); LOG = math.floor(math.log2(n))+1",
        "    st = [[0]*n for _ in range(LOG)]",
        "    st[0] = arr[:]",
        "    for j in range(1, LOG):",
        "        for i in range(n-(1<<j)+1):",
        "            st[j][i] = min(st[j-1][i], st[j-1][i+(1<<(j-1))])",
        "    return st",
    ],
    "098": [
        "def mo_algorithm(arr, queries):",
        "    block = int(len(arr)**0.5)",
        "    queries = sorted(queries, key=lambda q: (q[0]//block, q[1] if (q[0]//block)%2==0 else -q[1]))",
        "    cur_l = cur_r = 0; cur_sum = arr[0]",
        "    results = {}",
    ],
    "099": [
        "def median_of_medians(arr, k):",
        "    if len(arr) <= 5: return sorted(arr)[k]",
        "    chunks = [arr[i:i+5] for i in range(0, len(arr), 5)]",
        "    medians = [sorted(c)[len(c)//2] for c in chunks]",
        "    pivot = median_of_medians(medians, len(medians)//2)",
        "    lo = [x for x in arr if x < pivot]",
        "    eq = [x for x in arr if x == pivot]",
        "    hi = [x for x in arr if x > pivot]",
        "    if k < len(lo): return median_of_medians(lo, k)",
        "    elif k < len(lo)+len(eq): return pivot",
        "    else: return median_of_medians(hi, k-len(lo)-len(eq))",
    ],
    "100": [
        "def sqrt_decomposition(arr, queries):",
        "    import math",
        "    block = int(math.sqrt(len(arr)))",
        "    blocks = [sum(arr[i:i+block]) for i in range(0, len(arr), block)]",
        "    results = []",
        "    for l, r in queries:",
        "        total = 0",
        "        while l <= r and l % block != 0: total += arr[l]; l += 1",
        "        while l+block-1 <= r: total += blocks[l//block]; l += block",
        "        while l <= r: total += arr[l]; l += 1",
        "        results.append(total)",
        "    return results",
    ],
}

# ---------------------------------------------------------------------------
# New CSS additions (injected before </style>)
# ---------------------------------------------------------------------------
NEW_CSS = """
/* === v2 Code-Trace additions === */
.card{display:flex;gap:12px;max-width:760px;width:100%;}
.workspace{flex:1;min-width:0;}
.btn-icon{background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;color:#888;cursor:pointer;font-size:.75rem;font-family:monospace;white-space:nowrap;flex-shrink:0;}
.btn-icon:hover,.btn-icon.active{border-color:var(--primary);color:var(--primary);}
.btn-icon.active{background:rgba(0,122,204,.1);}
.code-trace-panel{width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;}
.code-view{background:#1e1e1e;border:1px solid var(--border);border-radius:6px;padding:10px;font-family:monospace;font-size:12px;line-height:1.7;overflow-y:auto;max-height:260px;}
.code-line-t{padding:1px 6px;border-left:3px solid transparent;border-radius:2px;white-space:pre;color:#d4d4d4;}
.code-line-t.hl{background:rgba(0,122,204,.18);border-left-color:var(--primary);color:#fff;}
.code-view-title,.memory-view-title{font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;}
.memory-view{background:#1a1a1a;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:.8rem;}
.mv-row{display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #2a2a2a;}
.mv-row:last-child{border-bottom:none;}
.mv-key{color:#888;min-width:56px;font-family:monospace;}
.mv-val{color:#4fc3f7;font-family:monospace;font-weight:bold;}
.mv-badge{border-radius:3px;padding:1px 6px;font-size:.73rem;font-family:monospace;margin-left:auto;}
.mv-badge.true-badge{background:rgba(76,175,80,.25);color:#4CAF50;}
.mv-badge.false-badge{background:rgba(244,67,54,.25);color:#f44336;}
.condition-bar{min-height:24px;padding:3px 6px;font-size:.77rem;font-family:monospace;color:#bbb;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border:1px solid #2a2a2a;border-radius:4px;margin-bottom:6px;background:#1c1c1c;}
.pointer-row{display:flex;gap:10px;justify-content:center;font-size:.74rem;font-family:monospace;padding:2px 0;color:#888;}
.ptr-item{display:flex;gap:3px;}
.ptr-key{color:#888;}
.ptr-val{color:#4fc3f7;}
@keyframes swapLeft{0%{transform:translateY(0)}40%{transform:translateY(-22px) translateX(-8px)}100%{transform:translateY(0)}}
@keyframes swapRight{0%{transform:translateY(0)}40%{transform:translateY(-22px) translateX(8px)}100%{transform:translateY(0)}}
.swap-left{animation:swapLeft .45s ease;}
.swap-right{animation:swapRight .45s ease;}
@media(max-width:700px){.card{flex-direction:column;}.code-trace-panel{width:100%;}}
"""

# ---------------------------------------------------------------------------
# New JS engine (injected at top of <script> block, replaces render engine)
# ---------------------------------------------------------------------------
NEW_JS_ENGINE = r"""
// === v2 Code-Trace Engine ===
const _codeLines = CODE_LINES_PLACEHOLDER;
let _codePanelOpen = false;

function _makeBox(value, mode, swapDir) {
  const d = document.createElement('div');
  d.className = 'box';
  if (mode === 'active') d.classList.add('active');
  if (mode === 'accent') d.classList.add('accent');
  if (mode === 'merged') d.classList.add('merged');
  if (mode === 'danger') d.classList.add('danger');
  if (swapDir === 'left') d.classList.add('swap-left');
  if (swapDir === 'right') d.classList.add('swap-right');
  d.innerText = String(value);
  return d;
}

function _renderPointerRow(state) {
  const ptrs = {};
  const map = {left:'L',right:'R',mid:'M',i:'i',j:'j',slow:'S',fast:'F',pivot:'P',start:'S',end:'E'};
  for (const [k, label] of Object.entries(map)) {
    if (state[k] !== undefined && state[k] !== null) ptrs[label] = state[k];
  }
  if (Object.keys(ptrs).length === 0) return null;
  const row = document.createElement('div');
  row.className = 'pointer-row';
  for (const [label, val] of Object.entries(ptrs)) {
    const item = document.createElement('span');
    item.className = 'ptr-item';
    item.innerHTML = '<span class="ptr-key">' + label + '→</span><span class="ptr-val">' + val + '</span>';
    row.appendChild(item);
  }
  return row;
}

function _renderVizV2(state, vizEl) {
  vizEl.innerHTML = '';
  const active = new Set((Array.isArray(state.active) ? state.active : []).map(String));
  const result = new Set((Array.isArray(state.result) ? state.result : []).map(String));

  if (Array.isArray(state.arrs)) {
    const row = document.createElement('div');
    row.className = 'array-row';
    let gi = 0;
    state.arrs.forEach(function(subArr) {
      const group = document.createElement('div');
      group.style.cssText = 'display:flex;gap:4px;margin:0 8px;';
      subArr.forEach(function(val) {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = String(val);
        if (state.activeIndices && state.activeIndices.includes(gi)) box.classList.add('active');
        if (state.mergedIndices && state.mergedIndices.includes(gi)) box.classList.add('merged');
        group.appendChild(box);
        gi++;
      });
      row.appendChild(group);
    });
    vizEl.appendChild(row);
    return;
  }

  if (Array.isArray(state.arr)) {
    const row = document.createElement('div');
    row.className = 'array-row';
    const swapPair = state.swapPair || [];
    for (let idx = 0; idx < state.arr.length; idx++) {
      let mode = '';
      if (active.has(String(idx)) || idx === state.fast || idx === state.left ||
          idx === state.right || idx === state.mid || idx === state.pivot) mode = 'active';
      if (result.has(String(idx)) || idx === state.slow) mode = 'accent';
      let swapDir = '';
      if (swapPair.length === 2) {
        if (idx === swapPair[0]) swapDir = 'right';
        if (idx === swapPair[1]) swapDir = 'left';
      }
      row.appendChild(_makeBox(state.arr[idx], mode, swapDir));
    }
    vizEl.appendChild(row);
    const ptrRow = _renderPointerRow(state);
    if (ptrRow) vizEl.appendChild(ptrRow);
    return;
  }

  if (Array.isArray(state.grid)) {
    const wrap = document.createElement('div');
    wrap.className = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(' + (state.grid[0] ? state.grid[0].length : 1) + ', 30px)';
    const pathSet = new Set((Array.isArray(state.path) ? state.path : []).map(function(p){ return p[0]+','+p[1]; }));
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < state.grid[r].length; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (pathSet.has(r+','+c)) cell.style.borderColor = 'var(--primary)';
        cell.innerText = String(state.grid[r][c]);
        wrap.appendChild(cell);
      }
    }
    vizEl.appendChild(wrap);
    const kv = _makeKVPanel(state, ['grid','path','msg','active','result']);
    if (kv) vizEl.appendChild(kv);
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerText = JSON.stringify(state, null, 2);
  vizEl.appendChild(panel);
}

function _makeKVPanel(state, skipKeys) {
  const skip = new Set(skipKeys || []);
  const keys = Object.keys(state).filter(function(k){ return !skip.has(k); });
  if (keys.length === 0) return null;
  const kv = document.createElement('div');
  kv.className = 'kv';
  keys.forEach(function(k) {
    const kd = document.createElement('div'); kd.className = 'k'; kd.innerText = k;
    const vd = document.createElement('div'); vd.className = 'v';
    vd.innerText = typeof state[k] === 'string' ? state[k] : JSON.stringify(state[k]);
    kv.appendChild(kd); kv.appendChild(vd);
  });
  return kv;
}

function _renderConditionBar(state) {
  const bar = document.getElementById('condition-bar');
  if (!bar) return;
  bar.innerHTML = '';
  if (!state.conditions && state.left === undefined && state.right === undefined) return;
  if (state.conditions && Array.isArray(state.conditions)) {
    state.conditions.forEach(function(cond) {
      const span = document.createElement('span');
      const ok = cond.result ? '✓' : '✗';
      const badge = cond.result ? 'true-badge' : 'false-badge';
      span.innerHTML = '<span style="color:#d4d4d4">' + _esc(cond.expr) + '</span> <span class="mv-badge ' + badge + '">' + ok + ' ' + (cond.result ? 'True' : 'False') + '</span>';
      bar.appendChild(span);
    });
    return;
  }
  if (state.left !== undefined && state.right !== undefined) {
    const ok = state.left <= state.right;
    const badge = ok ? 'true-badge' : 'false-badge';
    const expr = 'left ≤ right → ' + state.left + ' ≤ ' + state.right;
    bar.innerHTML = '<span>' + _esc(expr) + ' <span class="mv-badge ' + badge + '">' + (ok ? '✓ True' : '✗ False') + '</span></span>';
  }
}

function _renderCodePanel(state) {
  const codeView = document.getElementById('code-view');
  const memView = document.getElementById('memory-view');
  if (!codeView || !memView) return;
  codeView.innerHTML = '';
  if (_codeLines && _codeLines.length) {
    _codeLines.forEach(function(line, idx) {
      const el = document.createElement('div');
      el.className = 'code-line-t';
      if (state.line && (idx + 1) === state.line) el.classList.add('hl');
      el.textContent = line;
      codeView.appendChild(el);
    });
  }
  memView.innerHTML = '';
  const varKeys = ['left','right','mid','i','j','slow','fast','pivot','count','target','sum','found','cur','prev','lo','hi','k'];
  const shown = [];
  varKeys.forEach(function(k) {
    if (state[k] !== undefined && state[k] !== null) shown.push([k, state[k]]);
  });
  if (state.vars) Object.entries(state.vars).forEach(function(e){ shown.push(e); });
  shown.forEach(function(pair) {
    const row = document.createElement('div');
    row.className = 'mv-row';
    row.innerHTML = '<span class="mv-key">' + _esc(String(pair[0])) + '</span><span class="mv-val">' + _esc(JSON.stringify(pair[1])) + '</span>';
    memView.appendChild(row);
  });
  if (state.conditions && Array.isArray(state.conditions)) {
    state.conditions.forEach(function(cond) {
      const row = document.createElement('div');
      row.className = 'mv-row';
      const badge = cond.result ? 'true-badge' : 'false-badge';
      row.innerHTML = '<span class="mv-key" style="min-width:auto;color:#aaa">' + _esc(cond.expr) + '</span><span class="mv-badge ' + badge + '" style="margin-left:6px">' + (cond.result ? 'True' : 'False') + '</span>';
      memView.appendChild(row);
    });
  }
}

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

"""

# ---------------------------------------------------------------------------
# New render() function body to REPLACE the old one
# ---------------------------------------------------------------------------
NEW_RENDER_BASIC = r"""
function render() {
  if (states.length === 0) return;
  const state = states[currentStep];
  const viz = document.getElementById('viz');
  const log = document.getElementById('log');
  const stepCounter = document.getElementById('step-counter');
  _renderVizV2(state, viz);
  _renderConditionBar(state);
  if (_codePanelOpen) _renderCodePanel(state);
  log.innerText = state.msg;
  stepCounter.innerText = 'Step: ' + (currentStep + 1) + ' / ' + states.length;
  document.getElementById('btn-prev').disabled = currentStep === 0;
  document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""

# ---------------------------------------------------------------------------
# Code panel toggle JS (appended at end)
# ---------------------------------------------------------------------------
CODE_PANEL_JS = r"""
// Code panel toggle
document.getElementById('btn-code').addEventListener('click', function() {
  _codePanelOpen = !_codePanelOpen;
  const panel = document.getElementById('code-panel');
  panel.style.display = _codePanelOpen ? 'flex' : 'none';
  if (_codePanelOpen) { panel.style.flexDirection = 'column'; _renderCodePanel(states[currentStep]); }
  document.getElementById('btn-code').classList.toggle('active', _codePanelOpen);
});
"""

# ---------------------------------------------------------------------------
# HTML structure replacements
# ---------------------------------------------------------------------------


def make_header_html(h2_inner):
    """Replace old header (single ? button) with new header (</> + ? buttons)."""
    return (
        '<div class="header" style="width:100%;max-width:760px;">\n'
        "  <h2>" + h2_inner + "</h2>\n"
        '  <div style="display:flex;gap:6px;align-items:center;">\n'
        '    <button class="btn-icon" id="btn-code" type="button" title="코드 패널 열기/닫기">&lt;/&gt;</button>\n'
        '    <button class="btn-icon btn-info" id="btn-info" type="button" title="설명 보기">?</button>\n'
        "  </div>\n"
        "</div>"
    )


def make_card_html(inner_controls):
    """Wrap workspace in card flex row with code-trace-panel."""
    return (
        '<div class="card" id="card">\n'
        '  <div class="workspace">\n'
        '    <div class="viz" id="viz"></div>\n'
        '    <div class="condition-bar" id="condition-bar"></div>\n'
        '    <div class="log" id="log">Initializing...</div>\n'
        "    " + inner_controls + "\n"
        "  </div>\n"
        '  <div class="code-trace-panel" id="code-panel" style="display:none;">\n'
        "    <div>\n"
        '      <div class="code-view-title">Python 코드</div>\n'
        '      <div class="code-view" id="code-view"></div>\n'
        "    </div>\n"
        "    <div>\n"
        '      <div class="memory-view-title">변수 상태</div>\n'
        '      <div class="memory-view" id="memory-view"></div>\n'
        "    </div>\n"
        "  </div>\n"
        "</div>"
    )


CONTROLS_HTML = (
    '<div class="controls">\n'
    '    <button id="btn-prev">⏮ Prev</button>\n'
    '    <button id="btn-play">▶ Play</button>\n'
    '    <button id="btn-pause" disabled>⏸ Pause</button>\n'
    '    <button id="btn-next">Next ⏭</button>\n'
    '    <button id="btn-reset">Reset</button>\n'
    '    <label class="step-info">Speed: <input type="range" id="speed" min="100" max="2000" value="800" dir="rtl"></label>\n'
    '    <span class="step-info" id="step-counter">Step: 0 / 0</span>\n'
    "  </div>"
)

MODAL_EVENT_JS = r"""
document.getElementById('btn-info').addEventListener('click', function() { document.getElementById('modal').classList.add('open'); });
document.getElementById('modal-close').addEventListener('click', function() { document.getElementById('modal').classList.remove('open'); });
document.getElementById('modal').addEventListener('click', function(e) { if (e.target === document.getElementById('modal')) document.getElementById('modal').classList.remove('open'); });
"""

PLAYBACK_JS = r"""
let currentStep = 0, playing = false, timer;
function next() { if (currentStep < states.length - 1) { currentStep += 1; render(); } else pause(); }
function prev() { if (currentStep > 0) { currentStep -= 1; render(); } }
function play() {
  if (!playing && currentStep < states.length - 1) {
    playing = true;
    document.getElementById('btn-play').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    timer = setInterval(next, parseInt(document.getElementById('speed').value, 10));
  }
}
function pause() {
  playing = false;
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  clearInterval(timer);
}
function reset() { pause(); currentStep = 0; render(); }
document.getElementById('btn-next').addEventListener('click', function() { pause(); next(); });
document.getElementById('btn-prev').addEventListener('click', function() { pause(); prev(); });
document.getElementById('btn-play').addEventListener('click', play);
document.getElementById('btn-pause').addEventListener('click', pause);
document.getElementById('btn-reset').addEventListener('click', reset);
document.getElementById('speed').addEventListener('input', function() { if (playing) { pause(); play(); } });
"""

# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def extract_algo_num(filename):
    m = re.match(r"algo-(\d+)-", os.path.basename(filename))
    return m.group(1).zfill(3) if m else None


def extract_h2_inner(html):
    m = re.search(r"<h2>(.*?)</h2>", html, re.DOTALL)
    return m.group(1) if m else "Algorithm"


def extract_modal_html(html):
    m = re.search(r'(<div class="modal-overlay".*?</div>\s*</div>)', html, re.DOTALL)
    return m.group(1) if m else ""


def is_enhanced_pattern(html):
    """True if file uses generateStates() pattern."""
    return bool(re.search(r"function generateStates\(\)", html))


def extract_states_block(html):
    """
    Returns the raw JS states block as a string.
    For BASIC: 'let states = [...];'
    For ENHANCED: 'let states = [];\nfunction generateStates() {...}\ngenerateStates();'
    """
    if is_enhanced_pattern(html):
        m = re.search(
            r"(let states\s*=\s*\[\];.*?generateStates\(\);)", html, re.DOTALL
        )
        return m.group(1).strip() if m else "let states = [];"
    else:
        m = re.search(r"(let states\s*=\s*\[.*?\]\s*;)", html, re.DOTALL)
        return m.group(1).strip() if m else "let states = [];"


def extract_extra_css(html):
    """
    Extract any CSS that's only present in enhanced files (custom classes beyond baseline).
    We'll keep file-specific CSS between the base style block and </style>.
    """
    # Find the style block content
    m = re.search(r"<style>(.*?)</style>", html, re.DOTALL)
    if not m:
        return ""
    style_content = m.group(1)
    # Remove baseline CSS that we'll always include fresh
    # Return any extra rules that aren't in the baseline (heuristic: lines not in baseline marker set)
    BASELINE_SELECTORS = {
        "*",
        "body",
        ":root",
        ".card",
        ".header",
        ".header h2",
        ".header .sub",
        ".btn-info",
        ".btn-info:hover",
        ".modal-overlay",
        ".modal-overlay.open",
        ".modal",
        ".modal h3",
        ".modal section",
        ".modal h4",
        ".modal p,.modal li",
        ".modal ul",
        ".tag",
        ".modal-close",
        ".modal-close:hover",
        ".controls",
        "button",
        "button:hover",
        "button:disabled",
        ".step-info",
        "input[type=range]",
        ".viz",
        ".log",
        ".array-row",
        ".box",
        ".box.active",
        ".box.accent",
        ".panel",
        ".kv",
        ".kv .k",
        ".kv .v",
        ".grid",
        ".cell",
        ".code-panel",
        ".code-line",
        ".code-line.active",
    }
    # Extract rules not belonging to baseline
    extra = []
    # Find rules that look unique to this file
    rule_pat = re.compile(r"([^{}]+)\{[^{}]*\}", re.DOTALL)
    for rule in rule_pat.finditer(style_content):
        selector = rule.group(1).strip()
        # Keep rules that aren't baseline and aren't empty
        clean_sel = re.sub(r"\s+", " ", selector).strip()
        if clean_sel not in BASELINE_SELECTORS and clean_sel:
            # Skip our new v2 additions too
            if not any(
                x in clean_sel
                for x in [
                    "btn-icon",
                    "code-trace",
                    "code-view",
                    "memory-view",
                    "mv-",
                    "condition-bar",
                    "pointer-row",
                    "ptr-",
                    "swap",
                    "@keyframes",
                    "@media",
                ]
            ):
                extra.append(rule.group(0))
    return "\n".join(extra)


def extract_custom_render_js(html):
    """
    For enhanced files, extract the custom render() function body only (not states block).
    We REPLACE render() with our new version, but preserve any other custom functions
    (like those dealing with grid-cell, DP table rendering, etc.) that render() calls.
    """
    # Find all function definitions in script block that aren't standard
    script_m = re.search(r"<script>(.*?)</script>", html, re.DOTALL)
    if not script_m:
        return ""
    script = script_m.group(1)
    # Find functions other than standard ones
    STANDARD_FNS = {
        "makeBox",
        "asArray",
        "renderGrid",
        "renderState",
        "render",
        "next",
        "prev",
        "play",
        "pause",
        "reset",
        "generateStates",
    }
    custom_fns = []
    fn_pat = re.compile(r"function\s+(\w+)\s*\(", re.DOTALL)
    for m in fn_pat.finditer(script):
        name = m.group(1)
        if name not in STANDARD_FNS:
            # Extract the full function
            start = m.start()
            # Find matching brace
            depth = 0
            i = script.index("{", start)
            fn_start = i
            while i < len(script):
                if script[i] == "{":
                    depth += 1
                elif script[i] == "}":
                    depth -= 1
                    if depth == 0:
                        custom_fns.append(script[start : i + 1])
                        break
                i += 1
    return "\n".join(custom_fns)


# ---------------------------------------------------------------------------
# File transformer
# ---------------------------------------------------------------------------

BASELINE_CSS = """\
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',sans-serif;font-size:14px;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
:root{--bg:#1e1e1e;--panel:#252526;--text:#d4d4d4;--border:#3e3e42;--primary:#007acc;--primary-h:#005999;--accent:#4CAF50;--danger:#f44336;--hl:#264f78}
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;width:100%;}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:0 4px}
.header h2{margin:0;font-size:1.05rem;color:#fff}
.header .sub{color:#888;font-weight:400}
.btn-info{background:none;border:1px solid var(--border);border-radius:50%;width:26px;height:26px;color:#888;cursor:pointer;font-size:.85rem;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
.btn-info:hover{border-color:var(--primary);color:var(--primary)}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:28px 32px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto;position:relative}
.modal h3{margin:0 0 16px;color:#fff;font-size:1.1rem}
.modal section{margin-bottom:16px}
.modal h4{margin:0 0 6px;color:var(--primary);font-size:.85rem;text-transform:uppercase;letter-spacing:.05em}
.modal p,.modal li{font-size:.9rem;line-height:1.6;color:var(--text);margin:0 0 4px}
.modal ul{padding-left:18px;margin:0}
.tag{display:inline-block;background:#2d2d30;border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:.8rem;margin-right:6px;color:#4fc3f7;font-family:monospace}
.modal-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;padding:0;line-height:1}
.modal-close:hover{color:#fff}
.controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px}
button{background:var(--primary);border:none;border-radius:4px;color:#fff;cursor:pointer;padding:5px 12px;font-size:.8rem}
button:hover{background:var(--primary-h)}
button:disabled{opacity:.4;cursor:default}
.step-info{font-size:.82rem;color:#888;margin-left:auto}
input[type=range]{accent-color:var(--primary);width:80px}
.viz{background:#1a1a1a;border:1px solid var(--border);border-radius:6px;padding:12px;min-height:120px;margin-bottom:10px;display:flex;flex-direction:column;gap:10px}
.log{font-size:.8rem;color:#888;min-height:36px;padding:4px 0}
.array-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.box{width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:#333;border:2px solid var(--border);border-radius:6px;font-weight:bold;transition:all .3s;}
.box.active{border-color:var(--primary);box-shadow:0 0 8px var(--primary);transform:translateY(-2px);}
.box.accent{border-color:var(--accent);color:var(--accent);background:rgba(76,175,80,.15)}
.box.merged{border-color:var(--accent);background:rgba(76,175,80,0.2);color:var(--accent);}
.box.danger{border-color:var(--danger);background:rgba(244,67,54,0.2);color:var(--danger);}
.panel{background:#1e1e1e;border:1px solid var(--border);border-radius:6px;padding:10px;font-family:monospace;white-space:pre-wrap}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start}
.kv .k{color:#888}
.kv .v{color:#d4d4d4}
.grid{display:grid;gap:4px;justify-content:center}
.cell{width:30px;height:30px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;border-radius:4px}"""


RENDER_STRIP_PATTERNS = [
    re.compile(
        r"^\s*if\s*\(\s*states\.length\s*===\s*0\s*\)\s*return\s*;\s*$", re.MULTILINE
    ),
    re.compile(
        r"^\s*const\s+state\s*=\s*states\s*\[\s*currentStep\s*\]\s*;\s*$", re.MULTILINE
    ),
    re.compile(
        r"^\s*const\s+viz\s*=\s*document\.getElementById\(['\"]viz['\"]\)\s*;\s*$",
        re.MULTILINE,
    ),
    re.compile(
        r"^\s*const\s+log\s*=\s*document\.getElementById\(['\"]log['\"]\)\s*;\s*$",
        re.MULTILINE,
    ),
    re.compile(
        r"^\s*const\s+stepCounter\s*=\s*document\.getElementById\(['\"]step-counter['\"]\)\s*;\s*$",
        re.MULTILINE,
    ),
    re.compile(r"^\s*viz\.innerHTML\s*=\s*['\"]['\"];\s*$", re.MULTILINE),
    re.compile(r"^\s*log\.innerText\s*=\s*state\.msg\s*;\s*$", re.MULTILINE),
    re.compile(
        r'^\s*stepCounter\.innerText\s*=\s*[`\'"]Step:.*?[`\'"]\s*;\s*$', re.MULTILINE
    ),
    re.compile(
        r"^\s*document\.getElementById\(['\"]btn-prev['\"]\)\.disabled\s*=.*?;\s*$",
        re.MULTILINE,
    ),
    re.compile(
        r"^\s*document\.getElementById\(['\"]btn-next['\"]\)\.disabled\s*=.*?;\s*$",
        re.MULTILINE,
    ),
]


def strip_render_boilerplate(body: str) -> str:
    for pat in RENDER_STRIP_PATTERNS:
        body = pat.sub("", body)
    return body


def transform_file(filepath):
    bak_path = filepath + ".bak"
    source_path = bak_path if os.path.exists(bak_path) else filepath
    with open(source_path, "r", encoding="utf-8") as f:
        html = f.read()

    algo_num = extract_algo_num(filepath) or ""
    code_lines = CODE_LINES.get(
        algo_num, ["# 알고리즘 코드", "# Python implementation"]
    )
    code_lines_json = json.dumps(code_lines, ensure_ascii=False)

    title_m = re.search(r"<title>(.*?)</title>", html)
    title = title_m.group(1) if title_m else "Algorithm"

    h2_inner = extract_h2_inner(html)
    modal_html = extract_modal_html(html)
    states_block = extract_states_block(html)
    extra_css = extract_extra_css(html)
    custom_fns = extract_custom_render_js(html) if is_enhanced_pattern(html) else ""

    # Build CSS
    full_css = BASELINE_CSS
    if extra_css.strip():
        full_css += "\n/* === file-specific === */\n" + extra_css
    full_css += "\n" + NEW_CSS

    # Build JS engine with code lines injected
    engine_js = NEW_JS_ENGINE.replace("CODE_LINES_PLACEHOLDER", code_lines_json)

    # Build new render() — for enhanced files with custom render we keep the custom one
    # and augment it; for basic we use the generic one
    enhanced = is_enhanced_pattern(html)

    if enhanced:
        # Extract original render function body and rebuild with v2 calls inserted
        script_m = re.search(r"<script>(.*?)</script>", html, re.DOTALL)
        orig_script = script_m.group(1) if script_m else ""

        render_fn_m = re.search(
            r"function render\(\)\s*\{(.*?)\n\}", orig_script, re.DOTALL
        )
        if render_fn_m:
            orig_render_body = strip_render_boilerplate(render_fn_m.group(1))
        else:
            orig_render_body = ""

        new_render = (
            "function render() {\n"
            "  if (states.length === 0) return;\n"
            "  const state = states[currentStep];\n"
            "  const viz = document.getElementById('viz');\n"
            "  const log = document.getElementById('log');\n"
            "  const stepCounter = document.getElementById('step-counter');\n"
            "  viz.innerHTML = '';\n" + orig_render_body.rstrip() + "\n"
            "  _renderConditionBar(state);\n"
            "  if (_codePanelOpen) _renderCodePanel(state);\n"
            "  log.innerText = state.msg;\n"
            "  stepCounter.innerText = 'Step: ' + (currentStep + 1) + ' / ' + states.length;\n"
            "  document.getElementById('btn-prev').disabled = currentStep === 0;\n"
            "  document.getElementById('btn-next').disabled = currentStep === states.length - 1;\n"
            "}\n"
        )
    else:
        new_render = NEW_RENDER_BASIC

    # Full script block
    script_parts = [
        engine_js,
        states_block,
        "",
    ]
    if custom_fns:
        script_parts.append(custom_fns)
        script_parts.append("")
    script_parts.append(new_render)
    script_parts.append(PLAYBACK_JS)
    script_parts.append(MODAL_EVENT_JS)
    script_parts.append(CODE_PANEL_JS)
    script_parts.append("render();")
    full_script = "\n".join(script_parts)

    # Build new HTML
    new_html = (
        "<!DOCTYPE html>\n"
        '<html lang="ko">\n'
        "<head>\n"
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "<title>" + title + "</title>\n"
        "<style>\n" + full_css + "\n"
        "</style>\n"
        "</head>\n"
        '<body style="flex-direction:column;">\n'
        + make_header_html(h2_inner)
        + "\n"
        + make_card_html(CONTROLS_HTML)
        + "\n"
        + modal_html
        + "\n"
        "<script>\n" + full_script + "\n"
        "</script>\n"
        "</body>\n"
        "</html>\n"
    )

    # Write backup and new file
    bak_path = filepath + ".bak"
    if not os.path.exists(bak_path):
        with open(bak_path, "w", encoding="utf-8") as f:
            f.write(html)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_html)

    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pattern = os.path.join(script_dir, "algo-*-simulator.html")
    files = sorted(glob.glob(pattern))

    if not files:
        print("No algo-*-simulator.html files found in", script_dir)
        sys.exit(1)

    print(f"Found {len(files)} files. Processing...")
    ok = 0
    errors = []
    for fp in files:
        try:
            transform_file(fp)
            print(f"  ✓ {os.path.basename(fp)}")
            ok += 1
        except Exception as e:
            print(f"  ✗ {os.path.basename(fp)}: {e}")
            errors.append((os.path.basename(fp), str(e)))

    print(f"\nDone: {ok}/{len(files)} files updated.")
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for name, err in errors:
            print(f"  {name}: {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
