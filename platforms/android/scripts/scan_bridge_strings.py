import re
import zipfile

APK = "base.apk"

NEEDLES = [
    b"addJavascriptInterface",
    b"JavascriptInterface",
    b"addWebMessageListener",
    b"WebMessageListener",
    b"WebMessagePort",
    b"postWebMessage",
    b"evaluateJavascript",
    b"javascript:",
    b"setAllowUniversalAccessFromFileURLs",
    b"setAllowFileAccessFromFileURLs",
    b"setAllowFileAccess",
    b"setAllowContentAccess",
    b"setJavaScriptEnabled",
    b"setMixedContentMode",
    b"onReceivedMessage",
    b"ScriptHandler",
]

with zipfile.ZipFile(APK) as z:
    dex_names = sorted(n for n in z.namelist() if re.fullmatch(r"classes(\d+)?\.dex", n))
    for dex in dex_names:
        data = z.read(dex)
        hits = {n.decode(): data.count(n) for n in NEEDLES if n in data}
        if hits:
            print(f"=== {dex} ===")
            for k, v in sorted(hits.items()):
                print(f"  {k}: {v}")
