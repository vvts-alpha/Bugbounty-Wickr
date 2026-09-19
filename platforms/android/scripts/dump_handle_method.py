from __future__ import annotations

import re
import zipfile
from pathlib import Path

from androguard.core.dex import DEX
from loguru import logger

logger.remove()

ROOT = Path(r"F:\Android-App-Analyze\Wickr")
APK = ROOT / "base.apk"
OUTPUT = ROOT / "handle-method-disassembly.txt"

TARGETS = {
    "Lcom/amazon/wickr/filepreview/webclient/FilePreviewWebViewClient$assetLoader$1;": None,  # all methods
    "Lcom/amazon/wickr/filepreview/webclient/FilePreviewWebViewClient$Companion;": None,
}


def main() -> None:
    output: list[str] = []
    found = 0

    with zipfile.ZipFile(APK) as archive:
        dex_names = sorted(
            name
            for name in archive.namelist()
            if re.fullmatch(r"classes(?:\d+)?\.dex", name)
        )
        for dex_name in dex_names:
            vm = DEX(archive.read(dex_name))
            for cls in vm.get_classes():
                class_name = cls.get_name()
                if class_name not in TARGETS:
                    continue
                output.append(f"\n\n## {class_name} [{dex_name}]")
                output.append(f"super={cls.get_superclassname()} interfaces={cls.get_interfaces()}")
                for field in cls.get_fields():
                    output.append(
                        f"FIELD {field.get_name()} {field.get_descriptor()} access=0x{field.get_access_flags():x}"
                    )
                for method in cls.get_methods():
                    found += 1
                    output.append(
                        f"\n### {method.get_name()}{method.get_descriptor()}"
                    )
                    output.append(f"access=0x{method.get_access_flags():x}")
                    code = method.get_code()
                    if code is None:
                        output.append("<no code>")
                        continue
                    offset = 0
                    for instruction in method.get_instructions():
                        output.append(
                            f"{offset:04x}: {instruction.get_name():<25} "
                            f"{instruction.get_output()}"
                        )
                        offset += instruction.get_length()

    OUTPUT.write_text("\n".join(output), encoding="utf-8")
    print(f"methods={found}")
    print(f"output={OUTPUT}")


if __name__ == "__main__":
    main()
