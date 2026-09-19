#!/usr/bin/env python3
"""Find the function containing a VA using the PE exception directory (.pdata),
then locate its direct callers (E8 rel32) in .text."""
import sys, mmap, struct
import numpy as np
import pefile

exe = sys.argv[1]
target = int(sys.argv[2], 0)

pe = pefile.PE(exe, fast_load=True)
pe.parse_data_directories(directories=[
    pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_EXCEPTION']])
base = pe.OPTIONAL_HEADER.ImageBase
secs = [(s.Name.rstrip(b"\x00").decode(errors="replace"), s.PointerToRawData,
         s.SizeOfRawData, base + s.VirtualAddress, s.Misc_VirtualSize)
        for s in pe.sections]

pdata = next(s for s in secs if s[0] == ".pdata")
with open(exe, "rb") as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    raw = mm[pdata[1]:pdata[1] + pdata[2]]
    best = None
    for off in range(0, len(raw) - 12, 12):
        beg, end, unw = struct.unpack_from("<III", raw, off)
        if beg == 0 and end == 0:
            continue
        bva, eva = base + beg, base + end
        if bva <= target < eva:
            best = (bva, eva)
            break
    if not best:
        print("no RUNTIME_FUNCTION covers that VA")
        sys.exit(1)
    fn_start, fn_end = best
    print(f"function containing 0x{target:x}: 0x{fn_start:x} .. 0x{fn_end:x} "
          f"({fn_end - fn_start} bytes)")

    print(f"\ndirect callers (E8 rel32) of 0x{fn_start:x}:")
    found = 0
    for nm, praw, sraw, sva, vsz in secs:
        if nm != ".text":
            continue
        buf = np.frombuffer(mm[praw:praw + sraw], dtype=np.uint8)
        idx = np.nonzero(buf[:-5] == 0xE8)[0]
        d = (buf[idx + 1].astype(np.uint32)
             | (buf[idx + 2].astype(np.uint32) << 8)
             | (buf[idx + 3].astype(np.uint32) << 16)
             | (buf[idx + 4].astype(np.uint32) << 24))
        d = d.view(np.int32).astype(np.int64)
        targ = (sva + idx.astype(np.int64) + 5) + d
        for j in np.nonzero(targ == fn_start)[0]:
            print(f"   call from 0x{sva + int(idx[j]):x}")
            found += 1
    if not found:
        print("   (none — likely called indirectly or is a thunk target)")
    mm.close()
