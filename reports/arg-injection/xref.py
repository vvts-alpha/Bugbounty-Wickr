#!/usr/bin/env python3
"""Fast rip-relative xref finder for large PE files.

Scans .text for x86-64 instructions with a rip-relative ModRM (mod=00,rm=101)
and reports those whose computed target equals a wanted VA.  Covers the common
data-reference encodings: lea / mov r64 / mov r32 / cmp / push / call [rip] /
jmp [rip].  No full disassembly, so it is fast on 50-200 MB binaries.
"""
import sys, mmap
import numpy as np
import pefile

# (opcode bytes before modrm, total insn length excluding disp32 tail handling)
# We model: [REX?] OP MODRM DISP32  -> target = insn_end + disp32
PATTERNS = [
    # REX.W lea r64, [rip+d]
    (b"\x48\x8d", 3), (b"\x4c\x8d", 3),
    # REX.W mov r64, [rip+d]
    (b"\x48\x8b", 3), (b"\x4c\x8b", 3),
    # mov r32, [rip+d]  /  mov [rip+d], r32
    (b"\x8b", 2), (b"\x89", 2),
    # REX.W mov [rip+d], r64
    (b"\x48\x89", 3),
    # call/jmp qword [rip+d]  (FF /2, FF /4)
    (b"\xff", 2),
    # cmp r64,[rip+d]
    (b"\x48\x3b", 3), (b"\x48\x39", 3),
    # movups/movdqu xmm,[rip+d]
    (b"\x0f\x10", 3), (b"\xf3\x0f\x6f", 4), (b"\x66\x0f\x6f", 4),
]


def load(path):
    pe = pefile.PE(path, fast_load=True)
    base = pe.OPTIONAL_HEADER.ImageBase
    secs = []
    for s in pe.sections:
        nm = s.Name.rstrip(b"\x00").decode(errors="replace")
        secs.append((nm, s.PointerToRawData, s.SizeOfRawData,
                     base + s.VirtualAddress, s.Misc_VirtualSize))
    return base, secs


def off2va(secs, off):
    for nm, praw, sraw, va, vsz in secs:
        if praw <= off < praw + sraw:
            return va + (off - praw)
    return None


def va2off(secs, va):
    for nm, praw, sraw, sva, vsz in secs:
        if sva <= va < sva + max(sraw, vsz):
            return praw + (va - sva)
    return None


def scan(path, wanted_vas, secname=".text"):
    base, secs = load(path)
    tgt = set(wanted_vas)
    lo, hi = min(tgt), max(tgt)
    out = {v: [] for v in tgt}
    with open(path, "rb") as f:
        mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        for nm, praw, sraw, sva, vsz in secs:
            if nm != secname:
                continue
            buf = np.frombuffer(mm[praw:praw + sraw], dtype=np.uint8)
            n = len(buf)
            for pat, plen in PATTERNS:
                pl = len(pat)
                m = np.ones(n - plen - 4, dtype=bool)
                for k, bch in enumerate(pat):
                    m &= buf[k:k + len(m)] == bch
                modrm = buf[pl:pl + len(m)]
                m &= (modrm & 0xC7) == 0x05
                idx = np.nonzero(m)[0]
                if idx.size == 0:
                    continue
                # vectorised little-endian signed disp32
                d = (buf[idx + plen].astype(np.uint32)
                     | (buf[idx + plen + 1].astype(np.uint32) << 8)
                     | (buf[idx + plen + 2].astype(np.uint32) << 16)
                     | (buf[idx + plen + 3].astype(np.uint32) << 24))
                d = d.view(np.int32).astype(np.int64)
                targ = (sva + idx.astype(np.int64) + plen + 4) + d
                sel = np.nonzero((targ >= lo) & (targ <= hi))[0]
                for j in sel:
                    t = int(targ[j])
                    if t in tgt:
                        out[t].append((int(sva + idx[j]), pat.hex()))
        mm.close()
    return base, secs, out


if __name__ == "__main__":
    path = sys.argv[1]
    base, secs = load(path)
    print(f"imagebase 0x{base:x}")
    for s in secs:
        print(f"  {s[0]:<10} raw 0x{s[1]:08x}+0x{s[2]:08x}  va 0x{s[3]:x} vsz 0x{s[4]:x}")
    offs = [int(x, 0) for x in sys.argv[2:]]
    vas = []
    for o in offs:
        v = off2va(secs, o)
        print(f"file 0x{o:x} -> VA 0x{v:x}" if v else f"file 0x{o:x} -> (no section)")
        if v:
            vas.append(v)
    if not vas:
        sys.exit(0)
    _, _, res = scan(path, vas)
    for v in vas:
        print(f"\n== xrefs to VA 0x{v:x} ==")
        if not res[v]:
            print("   (none found in .text)")
        for a, p in res[v]:
            print(f"   0x{a:x}   [{p}]")
