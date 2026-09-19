import re
import zipfile

from androguard.core.dex import DEX
from loguru import logger

logger.remove()

APK = "base.apk"
APP_PREFIXES = ("Lcom/wickr/", "Lcom/amazon/wickr/", "Lcom/mywickr/")

RAW_NEEDLES = [b"qrc://", b"wickrweb://", b"intent://", b"file://", b"javascript:"]
XREF_NEEDLES = [
    "qrc://", "wickrweb://", "intent://",
    "shouldOverrideUrlLoading", "parseUri",
    "CookieManager", "getCookie", "setCookie",
    "setAllowFileAccess", "setAllowContentAccess",
    "setAllowUniversalAccessFromFileURLs", "setAllowFileAccessFromFileURLs",
    "setDomStorageEnabled", "setMixedContentMode",
]

with zipfile.ZipFile(APK) as z:
    dex_names = sorted(n for n in z.namelist() if re.fullmatch(r"classes(\d+)?\.dex", n))
    dex_blobs = {n: z.read(n) for n in dex_names}

print("### RAW STRING COUNTS")
for dex, data in dex_blobs.items():
    hits = {n.decode(): data.count(n) for n in RAW_NEEDLES if n in data}
    if hits:
        print(f"  {dex}: {hits}")

print("\n### APP-CLASS METHOD DECLARATIONS NAMED shouldOverrideUrlLoading")
for dex, data in dex_blobs.items():
    vm = DEX(data)
    for cls in vm.get_classes():
        cname = cls.get_name()
        for method in cls.get_methods():
            if method.get_name() == "shouldOverrideUrlLoading":
                tag = "APP" if cname.startswith(APP_PREFIXES) else "lib"
                print(f"  [{dex}] ({tag}) {cname}")

print("\n### APP-PACKAGE INSTRUCTION XREFS")
for dex, data in dex_blobs.items():
    vm = DEX(data)
    for cls in vm.get_classes():
        cname = cls.get_name()
        if not cname.startswith(APP_PREFIXES):
            continue
        for method in cls.get_methods():
            if method.get_code() is None:
                continue
            try:
                text = "\n".join(f"{i.get_name()} {i.get_output()}" for i in method.get_instructions())
            except Exception:
                continue
            hits = [n for n in XREF_NEEDLES if n in text]
            if hits:
                print(f"  [{dex}] {cname}->{method.get_name()}{method.get_descriptor()}  hits={hits}")
print("DONE")
