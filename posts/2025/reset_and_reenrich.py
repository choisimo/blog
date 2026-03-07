#!/usr/bin/env python3
"""
reset_and_reenrich.py
1. Strips "line" and "vars" fields from states in algo-060 through algo-080.
2. Calls enrich_states.patch_basic_states() to re-inject correct line numbers
   using the updated LINE_MAPS in enrich_states.py.

Run from the directory containing the HTML files:
    python3 reset_and_reenrich.py
"""

import re
import os
import sys
import glob
import json

# Import the enrichment helpers from enrich_states
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)
import enrich_states

TARGET_RANGE = range(60, 81)  # 060-080 inclusive


def js_obj_to_json_safe(json_str: str, algo_num: str):
    """Try JSON parse, fallback to JS-to-JSON conversion."""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        try:
            return json.loads(enrich_states.js_obj_to_json(json_str))
        except json.JSONDecodeError:
            print(f"    [WARN] JSON parse failed for algo-{algo_num}, cannot reset")
            return None


def reset_states_in_file(filepath: str, algo_num: str) -> bool:
    """Remove 'line' and 'vars' from each state object in a BASIC file."""
    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()

    m = re.search(r"(let states\s*=\s*)(\[.*?\])(\s*;)", html, re.DOTALL)
    if not m:
        print(f"  [SKIP] No 'let states=' found in {os.path.basename(filepath)}")
        return True

    prefix = m.group(1)
    json_str = m.group(2)
    suffix = m.group(3)

    states = js_obj_to_json_safe(json_str, algo_num)
    if states is None:
        return False

    changed = False
    for state in states:
        if "line" in state:
            del state["line"]
            changed = True
        if "vars" in state:
            del state["vars"]
            changed = True

    if not changed:
        print(f"  [INFO] No line/vars to remove in {os.path.basename(filepath)}")
        return True

    new_json = json.dumps(states, ensure_ascii=False, separators=(",", ":"))
    new_html = html[: m.start()] + prefix + new_json + suffix + html[m.end() :]

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_html)

    print(f"  ✓  Reset {os.path.basename(filepath)} ({len(states)} states stripped)")
    return True


def reenrich_file(filepath: str, algo_num: str) -> bool:
    """Re-run line+vars enrichment on a single file."""
    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()

    new_html = enrich_states.patch_basic_states(html, algo_num)

    if new_html == html:
        print(f"  ⚠  No changes after enrichment: {os.path.basename(filepath)}")
        return False

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_html)

    # Count how many states got a line field
    m = re.search(r"let states\s*=\s*(\[.*?\])\s*;", new_html, re.DOTALL)
    if m:
        try:
            states = json.loads(m.group(1))
            n_line = sum(1 for s in states if "line" in s)
            print(
                f"  ✓  Enriched {os.path.basename(filepath)} — {n_line}/{len(states)} states have line"
            )
        except Exception:
            print(f"  ✓  Enriched {os.path.basename(filepath)}")
    return True


def main():
    pattern = os.path.join(script_dir, "algo-*-simulator.html")
    all_files = sorted(glob.glob(pattern))

    target_files = []
    for fp in all_files:
        if fp.endswith(".bak"):
            continue
        bname = os.path.basename(fp)
        m = re.match(r"algo-(\d+)-", bname)
        if m:
            n = int(m.group(1))
            if n in TARGET_RANGE:
                target_files.append((fp, str(n).zfill(3)))

    if not target_files:
        print("No target files found.")
        sys.exit(1)

    print(f"=== STEP 1: Reset line/vars from {len(target_files)} files (060-080) ===")
    for fp, num in target_files:
        reset_states_in_file(fp, num)

    print(f"\n=== STEP 2: Re-enrich with correct LINE_MAPS ===")
    ok = 0
    for fp, num in target_files:
        if reenrich_file(fp, num):
            ok += 1

    print(f"\nDone: {ok}/{len(target_files)} files re-enriched.")


if __name__ == "__main__":
    main()
