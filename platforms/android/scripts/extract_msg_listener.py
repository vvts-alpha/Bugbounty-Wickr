"""Extract context around interesting patterns in the preview bundles."""
import re
import sys

FILE = sys.argv[1] if len(sys.argv) > 1 else "webassets/assets_dist-file-preview_assets_file-preview-ee8ec7f1.js"
PAT = sys.argv[2] if len(sys.argv) > 2 else r'addEventListener\(["\']message["\']'
SPAN = int(sys.argv[3]) if len(sys.argv) > 3 else 900

data = open(FILE, encoding="utf-8", errors="ignore").read()
for i, m in enumerate(re.finditer(PAT, data)):
    s = max(0, m.start() - SPAN)
    e = min(len(data), m.end() + SPAN)
    print(f"===== match {i} at {m.start()} =====")
    print(data[s:e])
    print()
