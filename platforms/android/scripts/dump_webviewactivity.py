import re
import zipfile

from androguard.core.dex import DEX
from loguru import logger

logger.remove()

APK = "base.apk"
TARGETS = {
    "Lcom/wickr/enterprise/web/WebViewActivity;": {"onCreate", "clearCache"},
    "Lcom/wickr/enterprise/web/WickrWebViewClient;": None,  # whole class
}

with zipfile.ZipFile(APK) as z:
    for dex_name in sorted(n for n in z.namelist() if re.fullmatch(r"classes(\d+)?\.dex", n)):
        vm = DEX(z.read(dex_name))
        for cls in vm.get_classes():
            cname = cls.get_name()
            if cname not in TARGETS:
                continue
            wanted = TARGETS[cname]
            print(f"\n\n## {cname} [{dex_name}] super={cls.get_superclassname()}")
            for method in cls.get_methods():
                if wanted is not None and method.get_name() not in wanted:
                    continue
                print(f"\n### {method.get_name()}{method.get_descriptor()}")
                if method.get_code() is None:
                    print("<no code>")
                    continue
                off = 0
                for ins in method.get_instructions():
                    print(f"{off:04x}: {ins.get_name():<24} {ins.get_output()}")
                    off += ins.get_length()
print("DONE")
