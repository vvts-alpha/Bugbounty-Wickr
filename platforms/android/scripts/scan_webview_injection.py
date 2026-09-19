"""Find every place a Wickr class injects data into a WebView or builds a URL."""
import re
import zipfile

from androguard.core.dex import DEX
from loguru import logger

logger.remove()

APP = ("Lcom/wickr/", "Lcom/amazon/wickr/", "Lcom/mywickr/")
NEEDLES = (
    "evaluateJavascript",
    'javascript:',
    "loadUrl",
    "buildFilePreviewURL",
    "setCookie",
    "putExtra",
    "window.",
    "postMessage",
    "document.",
)

with zipfile.ZipFile("base.apk") as z:
    dex_names = sorted(n for n in z.namelist()
                       if re.fullmatch(r"classes(\d+)?\.dex", n))
    for dex_name in dex_names:
        vm = DEX(z.read(dex_name))
        for cls in vm.get_classes():
            if not cls.get_name().startswith(APP):
                continue
            for method in cls.get_methods():
                code = method.get_code()
                if code is None:
                    continue
                try:
                    text = "\n".join(f"{i.get_name()} {i.get_output()}"
                                     for i in method.get_instructions())
                except Exception:
                    continue
                hits = [n for n in NEEDLES if n in text]
                if not hits:
                    continue
                # only print if it looks WebView/data related
                sig = f"{cls.get_name()}->{method.get_name()}{method.get_descriptor()}"
                if any(h in ("evaluateJavascript", "javascript:", "loadUrl",
                             "buildFilePreviewURL", "setCookie", "postMessage")
                       for h in hits) or "WebView" in sig or "Preview" in sig:
                    print(f"[{dex_name}] {sig}  hits={hits}")
                    for h in hits:
                        for line in text.splitlines():
                            if h in line:
                                print("    " + line.strip()[:200])
print("DONE")
