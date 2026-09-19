#!/usr/bin/env python3
"""strre.py - extract ASCII + UTF-16LE strings from a binary, optional regex filter.
Usage: python strre.py <file> [--min N] [--regex PATTERN] [--limit N]
Prints: <hex_offset>  <string>
"""
import sys, re

def strings(path, ml=5):
    data = open(path, 'rb').read()
    for m in re.finditer(rb'[\x20-\x7e]{%d,}' % ml, data):
        yield m.start(), m.group().decode('latin1')
    for m in re.finditer(rb'(?:[\x20-\x7e]\x00){%d,}' % ml, data):
        yield m.start(), m.group().decode('utf-16le', 'ignore')

def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    path = sys.argv[1]
    rx = None; ml = 5; limit = 0
    a = sys.argv[2:]; i = 0
    while i < len(a):
        if a[i] == '--regex': rx = re.compile(a[i+1]); i += 2
        elif a[i] == '--min': ml = int(a[i+1]); i += 2
        elif a[i] == '--limit': limit = int(a[i+1]); i += 2
        else: i += 1
    seen = set(); n = 0
    for off, s in strings(path, ml):
        if rx and not rx.search(s): continue
        if s in seen: continue
        seen.add(s)
        print(f"{off:#010x}  {s}")
        n += 1
        if limit and n >= limit: break

if __name__ == '__main__':
    main()
