#!/usr/bin/env python3
"""
enrich_states.py
Adds `line` and `vars` fields to every state in all 100 algo-*-simulator.html files.

Strategy:
- BASIC files (70 files, inline let states=[...]): parse JSON, add line via msg-keyword heuristics
- ENHANCED files with line already (031-040): skip
- ENHANCED files without line (081-100): patch generateStates() pushes via JS-regex + per-algo line maps

Run from the same directory as the HTML files:
    python3 enrich_states.py
"""

import re
import os
import sys
import glob
import json

# ---------------------------------------------------------------------------
# Per-algorithm line mapping rules
# Format: algo_num -> list of (keyword_fragments, line_number)
# The first matching rule wins. Fragments are lowercased for matching.
# ---------------------------------------------------------------------------
# 1-indexed line numbers matching CODE_LINES in refactor_simulators_v2.py

LINE_MAPS = {
    "001": [
        (["result:"], 6),
        (["in map!"], 6),
        (["not in map"], 7),
        (["i=0"], 3),
        (["i=1"], 5),
        (["초기"], 2),
    ],
    "002": [
        (["완료"], 3),
        (["뒤 n-k", "뒤 k", "step 3"], 3),
        (["앞 k", "step 2"], 3),
        (["전체 뒤집기", "step 1"], 2),
        (["초기"], 1),
    ],
    "003": [
        (["완료:"], 7),
        (["copy"], 6),
        (["slow="], 5),
        (["skip"], 3),
        (["fast="], 3),
        (["초기"], 2),
    ],
    "004": [
        (["결과:"], 6),
        (["i=6"], 5),
        (["i=3"], 4),
        (["i=1"], 4),
        (["i=0"], 3),
        (["초기"], 2),
    ],
    "005": [
        (["완료", "result", "return"], 6),
        (["right -=", "right-="], 6),
        (["left +=", "left+="], 5),
        (["swap"], 4),
        (["while", "left < right"], 3),
        (["left, right", "초기"], 2),
        (["def "], 1),
    ],
    "006": [
        (["anagram"], 8),
        (["차감 완료"], 7),
        (["차감 시작"], 5),
        (["카운트 완료"], 4),
        (["초기"], 3),
    ],
    "007": [
        (["결과:"], 6),
        (["불일치"], 4),
        (["공통"], 3),
        (["초기"], 2),
    ],
    "008": [
        (["완료"], 6),
        (["배치"], 4),
        (["초기"], 2),
    ],
    "009": [
        (["완료"], 8),
        (["run"], 7),
        (["초기"], 2),
    ],
    "010": [
        (["row 5"], 8),
        (["row 4"], 7),
        (["row 3"], 6),
        (["row 2"], 4),
        (["row 1"], 2),
    ],
    "011": [
        (["완료"], 9),
        (["4 reverse"], 8),
        (["2 reverse"], 6),
        (["1 reverse"], 5),
        (["초기"], 2),
    ],
    "012": [
        (["만남!"], 6),
        (["사이클 내"], 5),
        (["slow=4"], 5),
        (["slow=3"], 5),
        (["slow=2"], 5),
        (["slow=1"], 4),
        (["초기:"], 2),
    ],
    "013": [
        (["완료"], 11),
        (["선택"], 6),
        (["초기"], 2),
    ],
    "014": [
        (["중간은"], 6),
        (["이동"], 4),
        (["초기"], 2),
    ],
    "015": [
        (["valid"], 2),
        (["pop"], 2),
        (["push"], 2),
        (["초기"], 2),
    ],
    "016": [
        (["getmin"], 3),
        (["pop"], 2),
        (["push"], 2),
        (["초기"], 1),
    ],
    "017": [
        (["pop()"], 3),
        (["rotate"], 3),
        (["push(1)"], 2),
        (["초기"], 2),
    ],
    "018": [
        (["완료"], 7),
        (["i=6"], 5),
        (["i=5"], 5),
        (["i=2"], 4),
        (["i=1"], 4),
        (["i=0"], 3),
        (["초기"], 2),
    ],
    "019": [
        (["i=7"], 8),
        (["i=6"], 8),
        (["i=5"], 8),
        (["i=4"], 8),
        (["i=3"], 8),
        (["i=0,1,2"], 4),
        (["초기"], 2),
    ],
    "020": [
        (["get(1)"], 4),
        (["evict"], 4),
        (["move front"], 4),
        (["put(3,3)"], 4),
        (["put(2,2)"], 4),
        (["put(1,1)"], 4),
        (["초기"], 3),
    ],
    "021": [
        (["완료"], 14),
        (["left++, right--"], 11),
        (["i=1"], 6),
        (["초기(정렬됨)"], 2),
    ],
    "022": [
        (["탐색 종료"], 9),
        (["right 이동"], 8),
        (["left 이동"], 7),
        (["초기"], 3),
    ],
    "023": [
        (["완료 best="], 1),
        (["중복 b"], 3),
        (["중복 a"], 3),
        (["abc 확장"], 3),
        (["초기"], 2),
    ],
    "024": [
        (["count=3"], 4),
        (["count=2"], 4),
        (["count=1"], 4),
        (["prefix=1"], 3),
        (["초기"], 2),
    ],
    "025": [
        (["bat"], 3),
        (["tan, nat"], 3),
        (["tea, ate"], 3),
        (["eat"], 3),
        (["초기"], 3),
    ],
    "026": [
        (["완료 best="], 9),
        (["sequence"], 7),
        (["start=200"], 5),
        (["start=100"], 5),
        (["초기 set"], 2),
    ],
    "027": [
        (["결과: candidate="], 6),
        (["count=1"], 4),
        (["count=2"], 4),
        (["count=0"], 4),
        (["초기"], 2),
    ],
    "028": [
        (["완료"], 6),
        (["skip"], 4),
        (["추가"], 4),
        (["set(nums1)"], 2),
    ],
    "029": [
        (["결과: banc"], 9),
        (["banc 발견"], 8),
        (["수축/확장"], 7),
        (["확장:"], 6),
        (["초기"], 2),
    ],
    "030": [
        (["결과: true"], 8),
        (["16==16!"], 4),
        (["64>16"], 4),
        (["초기:"], 3),
    ],
    # 031-040: ENHANCED files already have line field, skip
    "041": [
        (["완료: 8개"], 9),
        (["backtrack"], 5),
        (["add [1,2,3]"], 6),
        (["add [1,2]"], 6),
        (["add [1]"], 6),
        (["add []"], 3),
        (["초기"], 2),
    ],
    "042": [
        (["완료"], 9),
        (["완성"], 5),
        (["초기"], 2),
    ],
    "043": [
        (["완료"], 9),
        (["[2,3]"], 6),
        (["[1,4]"], 6),
        (["[1,3]"], 6),
        (["[1,2]"], 5),
        (["초기"], 2),
    ],
    "044": [
        (["완료: 9개"], 13),
        (["try 'b'"], 9),
        (["try 'a'"], 9),
        (["digit=3"], 8),
        (["digit=2"], 8),
        (["초기:"], 4),
    ],
    "045": [
        (["해 2"], 3),
        (["해 1"], 3),
        (["배치"], 3),
        (["초기"], 1),
    ],
    "046": [
        (["완료"], 7),
        (["여러 칸"], 5),
        (["통과"], 5),
        (["실패"], 5),
        (["초기"], 2),
    ],
    "047": [
        (["word 완성"], 5),
        (["->"], 3),
        (["시작"], 3),
        (["초기"], 2),
    ],
    "048": [
        (["pow(2,10)=1024"], 6),
        (["pow(2,5)=32"], 5),
        (["pow(2,4)=16"], 5),
        (["pow(2,2)=4"], 5),
        (["n=1:"], 4),
        (["n 홀수:"], 5),
        (["n 짝수:"], 5),
        (["pow(2, 10)"], 3),
    ],
    "049": [
        (["완료"], 5),
        (["(()())"], 5),
        (["((()))"], 5),
        (["(()"], 4),
        (["("], 4),
        (["초기"], 2),
    ],
    "050": [
        (["셋째"], 7),
        (["둘째"], 7),
        (["첫 섬"], 6),
        (["초기"], 3),
    ],
    "051": [
        (["postorder"], 7),
        (["inorder"], 6),
        (["visit 2,4,5,3"], 5),
        (["visit 1"], 5),
        (["초기 트리"], 2),
    ],
    "052": [
        (["max depth"], 12),
        (["right subtree"], 11),
        (["left subtree"], 11),
        (["초기"], 4),
    ],
    "053": [
        (["symmetric"], 14),
        (["비교 통과"], 10),
        (["초기"], 4),
    ],
    "054": [
        (["결과: true"], 11),
        (["remain=0"], 10),
        (["remain=-5"], 9),
        (["5->4->11"], 6),
        (["초기"], 4),
    ],
    "055": [
        (["valid bst"], 7),
        (["통과"], 6),
        (["validate(3"], 6),
        (["validate(1"], 6),
        (["초기:"], 2),
    ],
    "056": [
        (["결과: 1"], 6),
        (["visit 3,4"], 5),
        (["visit 2"], 5),
        (["visit 1"], 5),
        (["초기"], 2),
    ],
    "057": [
        (["lca=6"], 14),
        (["분기점"], 11),
        (["현재 노드=6"], 5),
    ],
    "058": [
        (["복원 완료"], 14),
        (["deserialize"], 13),
        (["serialize 결과"], 12),
        (["serialize 시작"], 8),
        (["초기 트리"], 5),
    ],
    "059": [
        (["완료"], 13),
        (["level2"], 8),
        (["level1"], 7),
        (["level0"], 6),
    ],
    "060": [
        (["left 모두 null"], 7),
        (["right에 기존"], 10),
        (["이식"], 6),
        (["초기"], 1),
    ],
    "061": [
        (["sift up"], 4),
        (["insert"], 3),
        (["초기"], 1),
    ],
    "062": [
        (["result"], 6),
        (["pop min"], 6),
        (["push"], 5),
        (["count"], 4),
        (["초기"], 1),
    ],
    "063": [
        (["insert"], 6),
        (["초기"], 1),
    ],
    "064": [
        (["reuse room"], 7),
        (["need new room"], 9),
        (["process"], 5),
        (["sort by start"], 3),
        (["초기"], 1),
    ],
    "065": [
        (["add edge"], 4),
        (["초기"], 3),
    ],
    "066": [
        (["dequeue", "enqueue"], 10),
        (["dequeue"], 6),
        (["초기"], 1),
    ],
    "067": [
        (["pop", "push"], 6),
        (["pop"], 4),
        (["초기"], 1),
    ],
    "068": [
        (["result: bipartite"], 15),
        (["result: not bipartite"], 14),
        (["valid"], 10),
        (["color neighbor"], 11),
        (["color node", "color neighbors"], 6),
        (["초기"], 1),
    ],
    "069": [
        (["link clones"], 9),
        (["clone node"], 6),
        (["초기"], 1),
    ],
    "070": [
        (["found"], 11),
        (["->"], 14),
        (["초기"], 1),
    ],
    "071": [
        (["done"], 14),
        (["pop", "relax"], 13),
        (["pop"], 8),
        (["초기"], 1),
    ],
    "072": [
        (["check negative cycle"], 10),
        (["iteration"], 7),
        (["초기"], 1),
    ],
    "073": [
        (["k="], 3),
        (["초기"], 1),
    ],
    "074": [
        (["dequeue"], 11),
        (["초기"], 1),
    ],
    "075": [
        (["done"], 16),
        (["skip"], 12),
        (["add"], 10),
        (["초기"], 1),
    ],
    "076": [
        (["done"], 14),
        (["skip"], 8),
        (["pop"], 7),
        (["초기"], 1),
    ],
    "077": [
        (["dfs from"], 18),
        (["pass 2"], 22),
        (["pass 1"], 9),
        (["초기"], 1),
    ],
    "078": [
        (["result"], 18),
        (["pop", "relax"], 15),
        (["pop"], 11),
        (["초기"], 1),
    ],
    "079": [
        (["find(0) == find", "yes", "no"], 12),
        (["union("], 8),
        (["초기"], 1),
    ],
    "080": [
        (["result: 700"], 16),
        (["iteration 2"], 15),
        (["iteration 1"], 9),
        (["초기 상태"], 7),
    ],
    # 081-100: ENHANCED files — single-fragment entries (OR via separate tuples)
    "081": [
        (["dp[${i}] = dp[${i-1}] + dp[${i-2}]"], 5),
        (["계산 준비"], 4),
        (["초기 상태: dp[0]=0"], 3),
        (["초기"], 1),
    ],
    "082": [
        (["dp[${i}] = dp[${i-1}] + dp[${i-2}]"], 5),
        (["도달 방법"], 4),
        (["초기 상태: dp[0]=1"], 3),
        (["초기"], 1),
    ],
    "083": [
        (["최종 결과:"], 7),
        (["dp[${i}] 갱신:"], 6),
        (["원 사용 고려"], 4),
        (["초기화: dp[0]=0"], 2),
        (["초기"], 1),
    ],
    "084": [
        (["최종 최대 가치:"], 9),
        (["아이템 ${i}"], 8),
        (["초기 2D DP 테이블"], 3),
        (["초기"], 1),
    ],
    "085": [
        (["최종 LIS 길이:"], 11),
        (["교체 (더 작은 끝값)"], 10),
        (["추가 (새로운 길이 LIS)"], 9),
        (["초기 tails 배열"], 2),
        (["초기"], 1),
    ],
    "086": [
        (["최종 LCS 길이:"], 8),
        (["불일치: max(위, 왼쪽)"], 7),
        (["대각선 + 1 ="], 6),
        (["초기 2D DP 테이블"], 3),
        (["초기"], 1),
    ],
    "087": [
        (["최종 편집 거리:"], 10),
        (["불일치: min(교체, 삭제, 삽입)"], 8),
        (["비용 0 추가"], 7),
        (["초기화: 빈 문자열"], 3),
        (["초기"], 1),
    ],
    "088": [
        (["최종 최대 금액:"], 5),
        (["max(스킵"], 4),
        (["초기화: dp[0]="], 2),
        (["초기"], 1),
    ],
    "089": [
        (["최종 경로 수:"], 6),
        (["+ 왼쪽(${dp[i][j-1]})"], 5),
        (["초기화: 모든 테두리 1"], 2),
        (["초기"], 1),
    ],
    "090": [
        (["최종 결과: ${dp[s.length]}"], 8),
        (["발견! dp[${i}]=true"], 6),
        (["초기화: dp[0]=true"], 3),
        (["초기"], 1),
    ],
    "091": [
        (["삽입 완료"], 12),
        (["공유, 't' 추가"], 10),
        (["삽입: 'p' 추가"], 10),
        (["삽입: 'a' 추가"], 9),
        (["초기 트라이"], 1),
        (["초기"], 1),
    ],
    "092": [
        (["경로 압축"], 7),
        (["각자 자기 자신이 부모"], 3),
        (["Union("], 14),
        (["초기"], 1),
    ],
    "093": [
        (["Update("], 13),
        (["Query("], 15),
        (["빌드 완료"], 5),
        (["초기"], 1),
    ],
    "094": [
        ([">= 이전 종료"], 7),
        (["< 이전 종료"], 6),
        (["(1,4) 선택 (첫 활동)"], 3),
        (["종료 시간 기준 정렬 완료"], 2),
        (["초기"], 1),
    ],
    "095": [
        (["최종 루트 노드 완성"], 11),
        (["다시 정렬"], 10),
        (["병합 ->"], 8),
        (["초기 노드 (빈도순 정렬)"], 4),
        (["초기"], 1),
    ],
    "096": [
        (["OR 연산:"], 11),
        (["n & (n-1):"], 5),
        (["XOR 연산:"], 10),
        (["초기 값 n ="], 3),
        (["초기"], 1),
    ],
    "097": [
        (["dp[${i>>1}] + ${i&1}"], 4),
        (["초기화: dp[0]=0"], 2),
        (["초기"], 1),
    ],
    "098": [
        (["길이 3 구간 계산:"], 10),
        (["길이 2 구간 계산:"], 9),
        (["초기 DP 테이블"], 3),
        (["초기"], 1),
    ],
    "099": [
        (["dp[2][2] ="], 14),
        (["dp[2][1] ="], 12),
        (["dp[1][2] ="], 12),
        (["dp[1][1] ="], 10),
        (["초기 상태 (첫 행/열"], 4),
        (["초기"], 1),
    ],
    "100": [
        (["LRU [2:B] 퇴출"], 20),
        (["MRU로 이동"], 13),
        (["put(3,C)"], 17),
        (["put(2,B)"], 17),
        (["put(1,A)"], 17),
        (["초기 캐시 비어있음"], 6),
        (["초기"], 1),
    ],
}

# Keys that should NOT go into vars (structural / UI fields)
SKIP_KEYS = {
    "msg",
    "arr",
    "grid",
    "arrs",
    "active",
    "result",
    "activeIndices",
    "mergedIndices",
    "path",
    "swapPair",
    "line",
    "conditions",
    "dp",  # skip dp arrays (too large)
}

# ---------------------------------------------------------------------------
# Line inference
# ---------------------------------------------------------------------------


def infer_line(msg: str, algo_num: str) -> int:
    """Return 1-indexed line number based on msg keywords."""
    rules = LINE_MAPS.get(algo_num, [])
    msg_lower = msg.lower()
    for fragments, line in rules:
        if all(frag.lower() in msg_lower for frag in fragments):
            return line
    # Default fallback: if msg contains "완료"/"결과"/"return"/"result" → last rule line
    for fragments, line in reversed(rules):
        return line  # last defined rule's line as default
    return 1


def build_vars(state: dict) -> dict:
    """Extract scalar/short variables from state for the vars panel."""
    vars_out = {}
    for k, v in state.items():
        if k in SKIP_KEYS:
            continue
        # Include scalars and short lists
        if isinstance(v, (int, float, bool, str)):
            vars_out[k] = v
        elif (
            isinstance(v, list)
            and len(v) <= 6
            and all(isinstance(x, (int, float, bool, str)) for x in v)
        ):
            vars_out[k] = v
    return vars_out


# ---------------------------------------------------------------------------
# BASIC file patching (inline let states = [...])
# ---------------------------------------------------------------------------


def js_obj_to_json(s: str) -> str:
    """Convert JS object literal syntax to valid JSON (best-effort)."""
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == '"':
            j = i + 1
            while j < n:
                if s[j] == "\\":
                    j += 2
                    continue
                if s[j] == '"':
                    j += 1
                    break
                j += 1
            out.append(s[i:j])
            i = j
        elif c == "'":
            j = i + 1
            while j < n and s[j] != "'":
                j += 1
            out.append('"' + s[i + 1 : j] + '"')
            i = j + 1
        elif c in ("{", ","):
            key_m = re.match(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*|\d+)(\s*:)", s[i:])
            if key_m:
                out.append(key_m.group(1) + '"' + key_m.group(2) + '"' + key_m.group(3))
                i += len(key_m.group(0))
            else:
                out.append(c)
                i += 1
        else:
            out.append(c)
            i += 1

    joined = "".join(out)
    joined = re.sub(r",\s*([\]}])", r"\1", joined)
    return joined


def patch_basic_states(html: str, algo_num: str) -> str:
    """Find `let states = [...];` and add line/vars to each state object."""
    m = re.search(r"(let states\s*=\s*)(\[.*?\])(\s*;)", html, re.DOTALL)
    if not m:
        return html

    prefix = m.group(1)
    json_str = m.group(2)
    suffix = m.group(3)

    try:
        states = json.loads(json_str)
    except json.JSONDecodeError:
        # Try JS object literal → JSON conversion (for files 061-080 style)
        try:
            states = json.loads(js_obj_to_json(json_str))
        except json.JSONDecodeError:
            print(
                f"    [WARN] JSON parse failed for algo-{algo_num}, skipping states enrichment"
            )
            return html

    for state in states:
        if "line" not in state:
            state["line"] = infer_line(state.get("msg", ""), algo_num)
        # Add vars if not present (vars panel shows extra variables)
        if "vars" not in state:
            v = build_vars(state)
            if v:
                state["vars"] = v

    new_json = json.dumps(states, ensure_ascii=False, separators=(",", ":"))
    new_block = prefix + new_json + suffix
    return html[: m.start()] + new_block + html[m.end() :]


# ---------------------------------------------------------------------------
# ENHANCED file patching (generateStates function)
# ---------------------------------------------------------------------------


def _find_push_object_end(body: str, push_start: int) -> int:
    """
    Given position of '{' that starts a states.push({ object,
    return the position just after the matching '}'.
    Counts brace depth, skips string literals and template literals.
    """
    i = push_start
    depth = 0
    in_str = None  # None, '"', "'", or '`'
    while i < len(body):
        c = body[i]
        if in_str:
            if c == "\\" and in_str != "`":
                i += 2
                continue
            if c == in_str:
                in_str = None
        else:
            if c in ('"', "'", "`"):
                in_str = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return i + 1
        i += 1
    return -1


def patch_enhanced_states(html: str, algo_num: str) -> str:
    fn_start_m = re.search(r"function generateStates\(\)\s*\{", html)
    if not fn_start_m:
        return html

    start = fn_start_m.end() - 1
    fn_end = _find_push_object_end(html, start)
    if fn_end == -1:
        return html

    fn_body = html[start:fn_end]
    fn_body_patched = _patch_pushes_in_body(fn_body, algo_num)
    return html[:start] + fn_body_patched + html[fn_end:]


def _patch_pushes_in_body(body: str, algo_num: str) -> str:
    """
    Text-injection approach: find each states.push({ ... }) by brace-counting,
    extract msg via regex, infer line, inject `line: N,` before the closing '}'.
    Handles JS spread syntax and template literals (not valid JSON).
    """
    result = []
    search_from = 0

    PUSH_OPEN = "states.push({"

    while True:
        idx = body.find(PUSH_OPEN, search_from)
        if idx == -1:
            break

        obj_start = idx + len("states.push(")
        obj_end = _find_push_object_end(body, obj_start)
        if obj_end == -1:
            break

        obj_text = body[obj_start:obj_end]

        if "line:" in obj_text:
            result.append(body[search_from : obj_end + 1])
            search_from = obj_end + 1
            continue

        msg_m = re.search(r'msg\s*:\s*["`]([^"`]*)["`]', obj_text)
        msg = msg_m.group(1) if msg_m else ""
        line_num = infer_line(msg, algo_num)

        closing_brace = obj_text.rfind("}")
        injected = (
            obj_text[:closing_brace] + f", line: {line_num}" + obj_text[closing_brace:]
        )

        result.append(body[search_from:idx])
        result.append("states.push(" + injected + ")")
        search_from = obj_end + 1

    result.append(body[search_from:])
    return "".join(result)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

ENHANCED_WITH_LINE = {
    "031",
    "032",
    "033",
    "034",
    "035",
    "036",
    "037",
    "038",
    "039",
    "040",
}


def process_file(filepath: str) -> bool:
    algo_num_m = re.match(r"algo-(\d+)-", os.path.basename(filepath))
    if not algo_num_m:
        return False
    algo_num = algo_num_m.group(1).zfill(3)

    # Skip enhanced files that already have line fields
    if algo_num in ENHANCED_WITH_LINE:
        print(f"  ⏭  {os.path.basename(filepath)} (already has line fields, skipping)")
        return True

    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()

    is_enhanced = bool(re.search(r"function generateStates\(\)", html))

    if is_enhanced:
        new_html = patch_enhanced_states(html, algo_num)
    else:
        new_html = patch_basic_states(html, algo_num)

    if new_html == html:
        print(f"  ⚠  {os.path.basename(filepath)} — no changes made")
        return True

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_html)

    return True


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pattern = os.path.join(script_dir, "algo-*-simulator.html")
    files = sorted(glob.glob(pattern))

    if not files:
        print("No algo-*-simulator.html files found in", script_dir)
        sys.exit(1)

    print(f"Found {len(files)} files. Enriching states with line + vars fields...")
    ok = errors = skipped = 0

    for fp in files:
        try:
            result = process_file(fp)
            if result:
                ok += 1
            else:
                skipped += 1
        except Exception as e:
            import traceback

            print(f"  ✗ {os.path.basename(fp)}: {e}")
            traceback.print_exc()
            errors += 1

    print(f"\nDone: {ok} processed, {skipped} skipped, {errors} errors.")


if __name__ == "__main__":
    main()
