"""Find WINDOW-scoped message listeners (SOP-relevant), excluding worker RPC."""
import glob
import re

for f in glob.glob("webassets/*.js") + glob.glob("webassets/*.html"):
    data = open(f, encoding="utf-8", errors="ignore").read()
    for m in re.finditer(r'addEventListener\(["\']message["\']', data):
        s = max(0, m.start() - 80)
        ctx = data[s:m.start() + 60].replace("\n", " ")
        scope = "worker?" if re.search(r'(worker|self|port|channel)\.$', data[s:m.start()].strip()[:-len("addEventListener")].strip().split()[-1] + "." if False else "") else ""
        print(f.split("/")[-1], "|", ctx[-150:])
    for m in re.finditer(r'window\.onmessage|(?<![.\w])onmessage\s*=', data):
        s = max(0, m.start() - 80)
        print(f.split("/")[-1], "| onmessage= |", data[s:m.start() + 100].replace("\n", " ")[-160:])
