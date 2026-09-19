#!/usr/bin/env python3
"""Local HTTPS stand-in for main.d4zeeqgazhley.amplifyapp.com — no upstream AWS."""

from __future__ import annotations

import ssl
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DIR = Path(__file__).resolve().parent
HOST = "main.d4zeeqgazhley.amplifyapp.com"
# Prefer 443 so frame-src host match has no :port (may need Admin on Windows).
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 443
CERT = DIR / "cert.pem"
KEY = DIR / "key.pem"


def ensure_cert() -> None:
    if CERT.exists() and KEY.exists():
        return
    print("Generating self-signed cert…")
    subprocess.check_call(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            str(KEY),
            "-out",
            str(CERT),
            "-days",
            "3",
            "-nodes",
            "-subj",
            f"/CN={HOST}",
        ],
        cwd=DIR,
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def do_GET(self):  # noqa: N802
        # Map any path to probe.html so CheckSpeedModal `/` works.
        if self.path in ("/", "/index.html", "/probe.html") or self.path.startswith("/?"):
            self.path = "/probe.html"
        return super().do_GET()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[probe] " + (fmt % args) + "\n")


def main() -> None:
    ensure_cert()
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(CERT), str(KEY))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"listening https://{HOST}:{PORT}/  (bound 127.0.0.1)")
    print("hosts must map that name -> 127.0.0.1")
    print("Wickr accepts bad certs; use CheckSpeed custom test or DOCX iframe")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
