"""Scan bundled preview web assets for DOM sinks, message listeners, sanitizers."""
import glob
import os
import re

PATTERNS = [
    ("msg-listener", re.compile(r'addEventListener\(["\']message["\']')),
    ("onmessage", re.compile(r'onmessage')),
    ("postMessage", re.compile(r'\.postMessage\(')),
    ("innerHTML", re.compile(r'innerHTML')),
    ("outerHTML", re.compile(r'outerHTML')),
    ("document.write", re.compile(r'document\.write')),
    ("insertAdjacentHTML", re.compile(r'insertAdjacentHTML')),
    ("DOMPurify-use", re.compile(r'DOMPurify\.sanitize|\.sanitize\(')),
    ("srcdoc", re.compile(r'srcdoc')),
    ("eval/new Function", re.compile(r'\beval\(|new Function')),
    ("getElementById", re.compile(r'getElementById')),
    ("location.hash/search", re.compile(r'location\.(hash|search)')),
    ("open(", re.compile(r'window\.open|\.open\("')),
]

for f in sorted(glob.glob("webassets/*.js") + glob.glob("webassets/*.html")):
    data = open(f, encoding="utf-8", errors="ignore").read()
    hits = []
    for label, pat in PATTERNS:
        n = len(pat.findall(data))
        if n:
            hits.append(f"{label}={n}")
    print(os.path.basename(f), "->", ", ".join(hits) if hits else "(none)")
