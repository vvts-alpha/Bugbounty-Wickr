#!/usr/bin/env python3
"""W37b — does decrypted attachment/preview material ever land in the profile's temp/ ?

Read-only. Polls the tree and records, for each file that appears: path, size and
the first 8 bytes ONLY, mapped to a format magic. File CONTENT is never stored —
we only need to know whether what lands there is recognisable plaintext (PNG/PDF/…)
or opaque ciphertext.
"""
import os, sys, time, binascii

ROOT = sys.argv[1]
SECS = int(sys.argv[2]) if len(sys.argv) > 2 else 300
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tempwatch.log")

MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "PNG (PLAINTEXT IMAGE)"),
    (b"\xff\xd8\xff", "JPEG (PLAINTEXT IMAGE)"),
    (b"GIF87a", "GIF (PLAINTEXT)"), (b"GIF89a", "GIF (PLAINTEXT)"),
    (b"%PDF-", "PDF (PLAINTEXT DOC)"),
    (b"PK\x03\x04", "ZIP/OOXML (PLAINTEXT DOC)"),
    (b"RIFF", "RIFF/WAV (PLAINTEXT AUDIO)"),
    (b"OggS", "OGG (PLAINTEXT AUDIO)"),
    (b"\x1aE\xdf\xa3", "Matroska/WebM (PLAINTEXT VIDEO)"),
    (b"\x00\x00\x00", "possible MP4/ISO-BMFF"),
    (b"SQLite format 3", "UNENCRYPTED SQLITE"),
]


def sniff(p):
    try:
        with open(p, "rb") as f:
            head = f.read(16)
    except Exception as e:
        return "(unreadable: %s)" % e, ""
    for m, name in MAGIC:
        if head.startswith(m):
            return name, binascii.hexlify(head[:8]).decode()
    return "opaque / no known magic", binascii.hexlify(head[:8]).decode()


def snap():
    out = {}
    for dp, _, fs in os.walk(ROOT):
        for fn in fs:
            p = os.path.join(dp, fn)
            try:
                out[p] = os.path.getsize(p)
            except OSError:
                pass
    return out


def note(s):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(s + "\n")
    print(s, flush=True)


note(f"--- watching {ROOT} for {SECS}s ---")
base = snap()
note(f"baseline: {len(base)} file(s)")
end = time.time() + SECS
hits = 0
while time.time() < end:
    cur = snap()
    for p, sz in cur.items():
        if p not in base or base[p] != sz:
            kind, head = sniff(p)
            rel = os.path.relpath(p, ROOT)
            note(f"[{time.strftime('%H:%M:%S')}] {'NEW' if p not in base else 'CHANGED'}  {rel}  "
                 f"{sz} bytes  ->  {kind}  (head {head})")
            hits += 1
            base[p] = sz
    time.sleep(0.4)
note(f"--- done: {hits} event(s) ---")
