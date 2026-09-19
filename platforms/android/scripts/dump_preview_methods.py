from __future__ import annotations

import re
import zipfile
from pathlib import Path

from androguard.core.dex import DEX
from loguru import logger


logger.remove()

ROOT = Path(r"F:\Android-App-Analyze\Wickr")
APK = ROOT / "base.apk"
OUTPUT = ROOT / "preview-route-disassembly.txt"

TARGET_CLASSES = {
    "Lcom/mywickr/config/WickrConfig;",
    "Lcom/mywickr/config/WickrConfig$Field;",
    "Lcom/mywickr/config/WickrConfig$Field$$ExternalSyntheticLambda2;",
    "Lcom/wickr/enterprise/di/modules/FilePreviewModule;",
    "Lcom/wickr/enterprise/files/FilePreviewActivity;",
    "Lcom/wickr/enterprise/files/FilePreviewDestinationProvider;",
    "Lcom/wickr/enterprise/files/FilePreviewRepository;",
    "Lcom/wickr/enterprise/files/web/FilePreviewWebViewClient;",
    "Lcom/wickr/enterprise/files/web/FileWebPreviewFragment;",
    "Lcom/wickr/enterprise/files/web/FileWebPreviewFragment$Companion;",
    "Lcom/wickr/enterprise/messages/adapter/delegates/BaseAttachmentAdapter;",
    "Lcom/wickr/enterprise/messages/adapter/delegates/BaseAttachmentAdapter$startFileDecryption$observable$1;",
    "Lcom/wickr/enterprise/messages/adapter/delegates/BaseAttachmentAdapter$startFileDecryption$observable$2;",
    "Lcom/wickr/enterprise/messages/model/AttachmentMetaData;",
    "Lcom/wickr/enterprise/util/FileExtensionsKt;",
    "Lcom/wickr/enterprise/util/FileExtensionsKt$startFileDecryption$observable$2;",
    "Lcom/wickr/util/FileUtilsKt;",
    "Lcom/amazon/wickr/filepreview/webclient/FilePreviewWebViewClient;",
}


def main() -> None:
    output: list[str] = []
    found: set[str] = set()

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
                if class_name not in TARGET_CLASSES:
                    continue
                found.add(class_name)
                output.append(f"\n\n## {class_name} [{dex_name}]")
                output.append(
                    f"super={cls.get_superclassname()} "
                    f"interfaces={list(cls.get_interfaces())}"
                )
                for field in cls.get_fields():
                    output.append(
                        f"FIELD {field.get_name()} "
                        f"{field.get_descriptor()} "
                        f"access=0x{field.get_access_flags():x}"
                    )
                for method in cls.get_methods():
                    output.append(
                        f"\n### {method.get_name()}{method.get_descriptor()}"
                    )
                    output.append(
                        f"access=0x{method.get_access_flags():x}"
                    )
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

    missing = sorted(TARGET_CLASSES - found)
    if missing:
        output.append("\n\n## Missing target classes")
        output.extend(missing)

    OUTPUT.write_text("\n".join(output), encoding="utf-8")
    print(f"found={len(found)}")
    print(f"missing={len(missing)}")
    print(f"output={OUTPUT}")


if __name__ == "__main__":
    main()
