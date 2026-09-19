#!/usr/bin/env python3
"""Qt stores QCommandLineOption names as UTF-16 (QStringLiteral in .rdata).
Sweep WickrPro.exe for its own option names + single-instance machinery."""
import sys, mmap, os

ASCII_NEEDLES = [
    b"QTWEBENGINE_CHROMIUM_FLAGS", b"QTWEBENGINEPROCESS_PATH",
    b"QTWEBENGINE_DISABLE_SANDBOX", b"QTWEBENGINE_REMOTE_DEBUGGING",
    b"qputenv", b"CreateMutexW", b"CreateMutexA", b"OpenMutexW",
    b"CreateSemaphoreW", b"FindWindowW", b"SetEnvironmentVariableW",
    b"QLocalServer", b"QLocalSocket", b"QSharedMemory", b"QSystemSemaphore",
]

U16_NEEDLES = [
    "noinstancecheck", "baseURL", "clientType", "datalocation", "configfile",
    "disablekeychain", "nocrypt", "logging", "headless", "headlessport",
    "ignorepath", "filePath", "environment",
    # single-instance candidates
    "wickr_instance", "WickrPro", "instance", "singleInstance", "SingleInstance",
    "Local\\", "Global\\", "wickrLock", "-instance",
    # webengine plumbing on the app side
    "QTWEBENGINE_CHROMIUM_FLAGS", "--single-process", "--no-sandbox",
    "--disable-gpu", "--use-angle", "--js-flags",
]

BAD_PREV = set(b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")


def find_all(mm, needle, exact_term=None, limit=6):
    hits, start = [], 0
    while len(hits) < limit:
        i = mm.find(needle, start)
        if i < 0:
            break
        start = i + 1
        if exact_term is not None:
            nxt = mm[i + len(needle): i + len(needle) + len(exact_term)]
            prv = mm[i - 1: i] if i else b"\x00"
            if nxt != exact_term:
                continue
            if prv and prv[0] in BAD_PREV:
                continue
        hits.append(i)
    return hits


path = sys.argv[1]
with open(path, "rb") as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    print(f"### ASCII (exact, NUL-terminated) in {os.path.basename(path)}")
    for n in ASCII_NEEDLES:
        h = find_all(mm, n, b"\x00")
        print(f"  [{'PRESENT' if h else 'absent '}] {n.decode():<30} "
              + " ".join(f"0x{x:x}" for x in h[:3]))
    print(f"\n### UTF-16LE (exact, NUL-terminated) in {os.path.basename(path)}")
    for s in U16_NEEDLES:
        n = s.encode("utf-16-le")
        h = find_all(mm, n, b"\x00\x00")
        print(f"  [{'PRESENT' if h else 'absent '}] {s:<30} "
              + " ".join(f"0x{x:x}" for x in h[:3]))
    print(f"\n### UTF-16LE (loose substring) in {os.path.basename(path)}")
    for s in ["instance", "Mutex", "mutex"]:
        n = s.encode("utf-16-le")
        h = find_all(mm, n, None, limit=12)
        print(f"  {s:<12} {len(h)} hit(s): " + " ".join(f"0x{x:x}" for x in h[:12]))
    mm.close()
