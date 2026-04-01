#!/usr/bin/env python3
import re, glob, sys

sys.path.insert(0, "/home/nodove/workspace/blog/frontend/public/posts/2025")
import importlib
import enrich_states

importlib.reload(enrich_states)

TARGET_DIR = "/home/nodove/workspace/blog/frontend/public/posts/2025"
files = sorted(
    glob.glob(f"{TARGET_DIR}/algo-0[89]?-*simulator.html")
    + glob.glob(f"{TARGET_DIR}/algo-100-*simulator.html")
)


def strip_line_from_enhanced(html):
    fn_m = re.search(r"function generateStates\(\)\s*\{", html)
    if not fn_m:
        return html, 0
    before = html[: fn_m.start()]
    fn_section = html[fn_m.start() :]
    stripped, count = re.subn(r",\s*line\s*:\s*\d+", "", fn_section)
    return before + stripped, count


total_stripped = 0
total_injected = 0

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

    html_stripped, strip_count = strip_line_from_enhanced(html)
    total_stripped += strip_count

    html_enriched = enrich_states.patch_enhanced_states(html_stripped, str(num))

    with open(fp, "w", encoding="utf-8") as f:
        f.write(html_enriched)

    injected = html_enriched.count("line:") - html_stripped.count("line:")
    total_injected += injected
    print(f"algo-{num:03d}: stripped={strip_count}, injected={injected}")

print(f"\nDone. Total stripped={total_stripped}, injected={total_injected}")
