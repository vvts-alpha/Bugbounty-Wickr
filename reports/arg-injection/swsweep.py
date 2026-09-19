#!/usr/bin/env python3
"""W37 Q2 first pass: does the switch string exist at all in the binary?

A Chromium switch is a NUL-terminated ASCII literal in .rdata.  We require an
exact match: the needle followed by NUL, and preceded by a byte that cannot be
part of a switch name (so "log-file" does not match inside "xyz-log-file").
"""
import sys, mmap, os

NEEDLES = [
    # --- primary: process-spawning ---
    b"browser-subprocess-path",
    b"gpu-launcher",
    b"renderer-cmd-prefix",
    b"utility-cmd-prefix",
    b"ppapi-plugin-launcher",
    b"nacl-loader-cmd-prefix",
    b"zygote-cmd-prefix",
    # --- file write ---
    b"enable-logging",
    b"log-file",
    b"log-net-log",
    b"net-log-capture-mode",
    b"trace-startup-file",
    b"disk-cache-dir",
    b"user-data-dir",
    b"crash-dumps-dir",
    # --- code exec in-process ---
    b"proxy-pac-url",
    b"proxy-server",
    b"winhttp-proxy-resolver",
    b"single-process",
    b"in-process-gpu",
    b"utility-startup-dialog",
    # --- secondary objective: security-model switches ---
    b"js-flags",
    b"no-sandbox",
    b"disable-web-security",
    b"disable-site-isolation-trials",
    b"disable-features",
    b"enable-features",
    b"use-angle",
    b"allow-file-access-from-files",
    b"remote-debugging-port",
    b"remote-allow-origins",
    b"host-resolver-rules",
    b"ignore-certificate-errors",
    b"allow-running-insecure-content",
    b"unsafely-treat-insecure-origin-as-secure",
    # --- Qt / app plumbing ---
    b"QTWEBENGINE_CHROMIUM_FLAGS",
    b"QTWEBENGINEPROCESS_PATH",
    b"QTWEBENGINE_DISABLE_SANDBOX",
    b"QTWEBENGINE_REMOTE_DEBUGGING",
    b"noinstancecheck",
    b"webEngineArgs",
]

# bytes that may legitimately precede a switch literal (i.e. NOT part of a name)
BAD_PREV = set(b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")


def sweep(path, needles):
    out = {}
    with open(path, "rb") as f:
        mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        for n in needles:
            hits = []
            start = 0
            while True:
                i = mm.find(n, start)
                if i < 0:
                    break
                start = i + 1
                nxt = mm[i + len(n): i + len(n) + 1]
                prv = mm[i - 1: i] if i else b"\x00"
                if nxt == b"\x00" and (not prv or prv[0] not in BAD_PREV):
                    hits.append(i)
                if len(hits) > 8:
                    break
            out[n] = hits
        mm.close()
    return out


if __name__ == "__main__":
    for path in sys.argv[1:]:
        print("=" * 72)
        print(f"{path}  ({os.path.getsize(path):,} bytes)")
        print("=" * 72)
        res = sweep(path, NEEDLES)
        for n in NEEDLES:
            h = res[n]
            mark = "PRESENT" if h else "absent "
            locs = " ".join(f"0x{x:x}" for x in h[:4])
            print(f"  [{mark}] {n.decode():<44} {locs}")
