import re
import zipfile

from androguard.core.dex import DEX
from loguru import logger

logger.remove()

APK = "base.apk"
NEEDLES = ["addWebMessageListener", "WebMessageListener", "postWebMessage", "ScriptHandler"]

with zipfile.ZipFile(APK) as z:
    for dex_name in ("classes.dex", "classes7.dex"):
        vm = DEX(z.read(dex_name))
        for cls in vm.get_classes():
            cname = cls.get_name()
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
                    print(f"[{dex_name}] {cname}->{method.get_name()}  hits={hits}")
print("DONE")
