#!/usr/bin/env python3
"""W37 Q1 static: which single-instance mechanism does WickrPro use?

Loose substring search (mangled C++ import names are NOT NUL-terminated right
after the class name, so the earlier exact search missed them), plus a scan for
direct callers of the CreateMutexW import thunk.
"""
import sys, mmap
import numpy as np
import pefile

EXE = sys.argv[1]

LOOSE = [
    # Qt IPC-based singletons
    b"QLocalServer", b"QLocalSocket", b"QSharedMemory", b"QSystemSemaphore",
    b"QtSingleApplication", b"SingleApplication",
    # Chromium process singleton
    b"ProcessSingleton", b"SingletonLock", b"SingletonCookie", b"SingletonSocket",
    b"user-data-dir", b"user_data_dir",
    # Win32 primitives / names
    b"CreateMutex", b"OpenMutex", b"CreateSemaphore", b"FindWindow",
    b"RegisterWindowMessage", b"WM_COPYDATA",
    # DDE (the registry has a ddeexec key)
    b"DdeInitialize", b"DdeNameService", b"DdeConnect", b"DdeClientTransaction",
    b"DdeCreateStringHandle", b"ddeexec",
    # app-level markers
    b"instance", b"Instance",
]


def sections(pe):
    base = pe.OPTIONAL_HEADER.ImageBase
    return base, [(s.Name.rstrip(b"\x00").decode(errors="replace"),
                   s.PointerToRawData, s.SizeOfRawData,
                   base + s.VirtualAddress, s.Misc_VirtualSize) for s in pe.sections]


pe = pefile.PE(EXE, fast_load=True)
base, secs = sections(pe)

print("### loose substring presence in WickrPro.exe")
with open(EXE, "rb") as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    for n in LOOSE:
        hits, start = [], 0
        while len(hits) < 4:
            i = mm.find(n, start)
            if i < 0:
                break
            start = i + 1
            hits.append(i)
        tag = "PRESENT" if hits else "absent "
        print(f"  [{tag}] {n.decode():<26} " + " ".join(f"0x{x:x}" for x in hits))

    # ---- direct callers (E8 rel32) of the CreateMutexW import thunk ----
    THUNK = 0x1408D310F
    print(f"\n### direct callers of the CreateMutexW thunk 0x{THUNK:x}")
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
        for j in np.nonzero(targ == THUNK)[0]:
            print(f"   call from 0x{sva + int(idx[j]):x}")
    mm.close()
