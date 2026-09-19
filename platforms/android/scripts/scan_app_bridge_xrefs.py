import re
import zipfile

from androguard.core.dex import DEX
from loguru import logger

logger.remove()

APK = "base.apk"
APP_PREFIXES = ("Lcom/wickr/", "Lcom/amazon/wickr/", "Lcom/mywickr/")
NEEDLES = [
    "addWebMessageListener",
    "WebMessageListener",
    "postWebMessage",
    "WebMessagePort",
    "evaluateJavascript",
    "addJavascriptInterface",
    "JavascriptInterface",
    "javascript:",
    "setAllowUniversalAccessFromFileURLs",
    "setAllowFileAccessFromFileURLs",
    "setMixedContentMode",
]

with zipfile.ZipFile(APK) as z:
    dex_names = sorted(n for n in z.namelist() if re.fullmatch(r"classes(\d+)?\.dex", n))
    for dex_name in dex_names:
        vm = DEX(z.read(dex_name))
        for cls in vm.get_classes():
            cname = cls.get_name()
            if not cname.startswith(APP_PREFIXES):
                continue
            for method in cls.get_methods():
                if method.get_code() is None:
                    continue
                try:
                    text = "\n".join(
                        f"{i.get_name()} {i.get_output()}" for i in method.get_instructions()
                    )
                except Exception:
                    continue
                hits = [n for n in NEEDLES if n in text]
                if hits:
                    print(f"[{dex_name}] {cname}->{method.get_name()}{method.get_descriptor()}")
                    for h in hits:
                        for line in text.splitlines():
                            if h in line:
                                print(f"    {line.strip()[:180]}")
print("DONE")
