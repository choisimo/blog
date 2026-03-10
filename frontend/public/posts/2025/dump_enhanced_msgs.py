#!/usr/bin/env python3
"""Dump msg values and current line assignments from ENHANCED files 081-100.
Also dump _codeLines so we can audit LINE_MAP correctness."""

import re, glob, sys

files = sorted(
    glob.glob(
        "/home/nodove/workspace/blog/frontend/public/posts/2025/algo-0[89]?-*simulator.html"
    )
    + glob.glob(
        "/home/nodove/workspace/blog/frontend/public/posts/2025/algo-100-*simulator.html"
    )
)

for fp in files:
    if fp.endswith(".bak"):
        continue
    m = re.search(r"algo-(\d+)-", fp)
    if not m:
        continue
    num = int(m.group(1))
    if not (81 <= num <= 100):
        continue

    with open(fp, "r", encoding="utf-8") as f:
        html = f.read()

    print(f"\n{'=' * 60}")
    print(f"=== algo-{num:03d} ===")

    # Dump _codeLines
    cl_m = re.search(r"const _codeLines\s*=\s*\[(.*?)\];", html, re.DOTALL)
    if cl_m:
        lines_raw = cl_m.group(1)
        # Extract each line string
        line_strs = re.findall(r'["`](.*?)["`]', lines_raw)
        print(f"  _codeLines ({len(line_strs)} lines):")
        for i, l in enumerate(line_strs, 1):
            print(f"    {i:2d}: {l}")
    else:
        print("  _codeLines: NOT FOUND")

    # Find generateStates function body
    fn_m = re.search(r"function generateStates\(\)\s*\{", html)
    if not fn_m:
        print("  generateStates: NOT FOUND")
        continue

    fn_body = html[fn_m.start() :]
    # Count braces to find end of function
    depth = 0
    end = 0
    for i, c in enumerate(fn_body):
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    fn_body = fn_body[:end]

    # Extract (msg, line) pairs from states.push calls
    # Find all states.push({ ... }) blocks
    push_pattern = re.compile(r"states\.push\(\s*\{", re.DOTALL)
    pairs = []
    for push_m in push_pattern.finditer(fn_body):
        # Extract the push block
        start = push_m.end() - 1  # points to opening {
        depth2 = 0
        end2 = start
        for i in range(start, len(fn_body)):
            if fn_body[i] == "{":
                depth2 += 1
            elif fn_body[i] == "}":
                depth2 -= 1
                if depth2 == 0:
                    end2 = i + 1
                    break
        block = fn_body[start:end2]
        msg_m = re.search(r'msg\s*:\s*["`]([^"`]*)["`]', block)
        line_m = re.search(r"\bline\s*:\s*(\d+)", block)
        msg_val = msg_m.group(1) if msg_m else "(no msg)"
        line_val = line_m.group(1) if line_m else "MISSING"
        pairs.append((msg_val, line_val))

    print(f"  states.push calls ({len(pairs)} total):")
    for msg_val, line_val in pairs:
        flag = "" if line_val != "MISSING" else " *** MISSING ***"
        print(f"    line={line_val:>3}  msg={repr(msg_val[:70])}{flag}")
