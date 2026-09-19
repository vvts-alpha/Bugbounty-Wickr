#!/usr/bin/env python3
"""Dump the UTF-16 option-name/description table out of WickrPro.exe .rdata.

The QStringLiteral option names cluster together; walk the region and print every
UTF-16LE run so we get the authoritative list (names AND help text) rather than
guessing option names one at a time.
"""
import sys, mmap, re

path = sys.argv[1]
lo = int(sys.argv[2], 0)
hi = int(sys.argv[3], 0)

with open(path, "rb") as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    blob = mm[lo:hi]
    mm.close()

# UTF-16LE printable runs of length >= 3
out = []
i = 0
n = len(blob)
while i + 1 < n:
    if blob[i + 1] == 0 and 0x20 <= blob[i] <= 0x7E:
        j = i
        chars = []
        while j + 1 < n and blob[j + 1] == 0 and 0x20 <= blob[j] <= 0x7E:
            chars.append(chr(blob[j]))
            j += 2
        if len(chars) >= 3:
            out.append((lo + i, "".join(chars)))
        i = j
    else:
        i += 2

for off, s in out:
    print(f"0x{off:08x}  {s}")
print(f"\n[{len(out)} strings]")
