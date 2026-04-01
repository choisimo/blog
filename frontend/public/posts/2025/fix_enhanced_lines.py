#!/usr/bin/env python3
"""
fix_enhanced_lines.py
Fixes `line: 1` in ENHANCED files (081–100) by using a line-by-line approach.
Each states.push() call in ENHANCED files is on a single line — safe to process per-line.
"""

import re
import glob
import sys
import os

sys.path.insert(0, "/home/nodove/workspace/blog/frontend/public/posts/2025")
import importlib
import enrich_states

importlib.reload(enrich_states)

TARGET_DIR = "/home/nodove/workspace/blog/frontend/public/posts/2025"

# All ENHANCED files 081-100
files = sorted(
    glob.glob(f"{TARGET_DIR}/algo-08?-*simulator.html")
    + glob.glob(f"{TARGET_DIR}/algo-09?-*simulator.html")
    + glob.glob(f"{TARGET_DIR}/algo-100-*simulator.html")
)


def patch_line_numbers_linewise(html: str, algo_num: str) -> tuple[str, int]:
    """
    Process line-by-line inside generateStates() function.
    For each line containing states.push(:
      1. Extract msg value (handles both "..." and `...` template literals)
      2. Strip existing `line: N`
      3. Inject correct `line: N` before closing })
    Returns (patched_html, count_of_changes).
    """
    lines = html.split("\n")
    result = []
    in_generate_states = False
    brace_depth = 0
    changes = 0

    for line in lines:
        # Track when we enter generateStates()
        if "function generateStates()" in line:
            in_generate_states = True
            brace_depth = 0

        if in_generate_states:
            # Track brace depth to know when we exit the function
            # (only count braces outside of strings — simplified heuristic for function boundaries)
            # We just need to detect the outer function close, so count { and } on non-string lines
            stripped = line.strip()

            # Check if this line has a states.push(
            if "states.push(" in line:
                # Extract msg — handle both regular strings and template literals
                # Pattern: msg: "..." or msg: `...`  (msg value ends at next unescaped quote/backtick)
                msg = extract_msg_from_push_line(line)
                if msg is not None:
                    line_num = enrich_states.infer_line(msg, algo_num)
                    # Strip any existing line: N (with or without leading comma)
                    new_line = re.sub(r"\s*,\s*line\s*:\s*\d+", "", line)
                    # Inject , line: N before the closing })
                    # The push ends with `})` or `});`
                    replacement = f", line: {line_num}" + "})"
                    new_line = re.sub(r"(\})\s*\)", replacement, new_line, count=1)
                    if new_line != line:
                        changes += 1
                    line = new_line

        result.append(line)

    return "\n".join(result), changes


def extract_msg_from_push_line(line: str) -> str | None:
    """
    Extract the msg value from a states.push({...}) line.
    Handles:
      msg: "plain string"
      msg: `template ${expr} literal`
    Returns the raw string value (template literals returned as-is with ${...}).
    """
    # Try double-quoted string first
    m = re.search(r'msg\s*:\s*"([^"]*)"', line)
    if m:
        return m.group(1)

    # Try backtick template literal
    # Need to handle nested ${...} — find the matching backtick
    bt_start = re.search(r"msg\s*:\s*`", line)
    if bt_start:
        start_pos = bt_start.end()  # position after opening backtick
        # Find matching closing backtick (skip ${...} blocks)
        i = start_pos
        depth = 0  # depth inside ${} expressions
        content = []
        while i < len(line):
            c = line[i]
            if depth > 0:
                if c == "{":
                    depth += 1
                    content.append(c)
                elif c == "}":
                    depth -= 1
                    content.append(c)
                else:
                    content.append(c)
            else:
                if c == "`":
                    # End of template literal
                    return "".join(content)
                elif c == "$" and i + 1 < len(line) and line[i + 1] == "{":
                    content.append("$")
                    content.append("{")
                    depth = 1
                    i += 2
                    continue
                else:
                    content.append(c)
            i += 1
        # Didn't find closing backtick — return what we have
        return "".join(content) if content else None

    # Try single-quoted string
    m = re.search(r"msg\s*:\s*'([^']*)'", line)
    if m:
        return m.group(1)

    return None


total_changes = 0

for fp in files:
    if fp.endswith(".bak"):
        continue
    m = re.search(r"algo-(\d+)-", fp)
    if not m:
        continue
    num = int(m.group(1))
    if not (81 <= num <= 100):
        continue

    algo_num_str = f"{num:03d}"

    with open(fp, "r", encoding="utf-8") as f:
        html = f.read()

    patched, changes = patch_line_numbers_linewise(html, algo_num_str)

    with open(fp, "w", encoding="utf-8") as f:
        f.write(patched)

    total_changes += changes
    print(f"algo-{num:03d}: {changes} lines updated")

print(f"\nDone. Total lines updated: {total_changes}")
print("\nVerifying injected values:")
for fp in sorted(
    glob.glob(f"{TARGET_DIR}/algo-08?-*simulator.html")
    + glob.glob(f"{TARGET_DIR}/algo-09?-*simulator.html")
    + glob.glob(f"{TARGET_DIR}/algo-100-*simulator.html")
):
    if fp.endswith(".bak"):
        continue
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()
    # Find all states.push lines with line: values
    pushes = re.findall(r"states\.push\(.*?line:\s*(\d+).*?\)", content)
    m = re.search(r"algo-(\d+)-", fp)
    num = m.group(1) if m else "?"
    line_vals = [int(v) for v in pushes]
    all_one = all(v == 1 for v in line_vals)
    status = (
        "⚠️  ALL LINE=1!"
        if all_one and line_vals
        else "✓"
        if line_vals
        else "❌ no pushes"
    )
    unique_vals = sorted(set(line_vals))
    print(f"  algo-{num}: lines={unique_vals} {status}")
