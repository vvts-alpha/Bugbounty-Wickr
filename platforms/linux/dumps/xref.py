#!/usr/bin/env python3
"""Find direct `call rel32` sites to a target address, WITHOUT linear disassembly.

Scans .text for E8 <rel32> whose computed target matches, then maps each hit to
the containing FUNC symbol from .symtab. Byte-level candidates are only reported
when they land inside a known function, so results can be verified by
function-scoped disassembly afterwards.

usage: xref.py <elf> <0xTARGET> [0xTARGET...]
"""
import subprocess, sys, re, bisect, struct

elf = sys.argv[1]
targets = {int(t, 16) for t in sys.argv[2:]}

# --- section table: find .text vaddr/offset/size
secs = subprocess.run(["readelf", "-SW", elf], capture_output=True, text=True).stdout
text = None
for line in secs.splitlines():
    m = re.search(r'\]\s+(\.\S+)\s+\S+\s+([0-9a-f]+)\s+([0-9a-f]+)\s+([0-9a-f]+)', line)
    if m and m.group(1) == ".text":
        text = (int(m.group(2), 16), int(m.group(3), 16), int(m.group(4), 16))
if text is None:
    sys.exit("no .text")
tva, toff, tsize = text

# --- FUNC symbols (mangled names; demangle later for display)
syms = []
out = subprocess.run(["readelf", "-sW", elf], capture_output=True, text=True).stdout
for line in out.splitlines():
    f = line.split()
    if len(f) >= 8 and f[3] == "FUNC":
        try:
            va = int(f[1], 16); sz = int(f[2])
        except ValueError:
            continue
        if sz > 0:
            syms.append((va, sz, f[7]))
syms = sorted(set(syms))
starts = [s[0] for s in syms]

def owner(addr):
    i = bisect.bisect_right(starts, addr) - 1
    while i >= 0:
        va, sz, nm = syms[i]
        if va <= addr < va + sz:
            return (va, sz, nm)
        # overlapping/alias symbols: step back a little
        if starts[i] < addr - 0x20000:
            break
        i -= 1
    return None

data = open(elf, 'rb').read()[toff:toff + tsize]
hits = {}
for i in range(len(data) - 5):
    if data[i] != 0xE8:
        continue
    rel = struct.unpack_from('<i', data, i + 1)[0]
    site = tva + i
    tgt = site + 5 + rel
    if tgt in targets:
        o = owner(site)
        if o:
            hits.setdefault((o[0], o[1], o[2]), []).append((site, tgt))

for (va, sz, nm), lst in sorted(hits.items()):
    dem = subprocess.run(["c++filt", nm], capture_output=True, text=True).stdout.strip()
    print(f"0x{va:x} +{sz:<6d} {dem}")
    for site, tgt in lst:
        print(f"      call site 0x{site:x} -> 0x{tgt:x}")
print(f"\n[{sum(len(v) for v in hits.values())} call sites in {len(hits)} functions]")
