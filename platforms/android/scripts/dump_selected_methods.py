from __future__ import annotations

import re
import zipfile
from pathlib import Path

from androguard.core.dex import DEX
from loguru import logger


logger.remove()

ROOT = Path(r"F:\Android-App-Analyze\Wickr")
APK = ROOT / "base.apk"
OUTPUT = ROOT / "preview-route-selected-methods.txt"

TARGETS = {
    "Lcom/wickr/enterprise/DaggerApp_HiltComponents_SingletonC$SingletonCImpl;": {
        "mapOfStringAndFilePreviewDestinationProvider",
    },
    "Lcom/mywickr/WickrCore;": {
        "getEnableFilePreview",
    },
    "Lcom/mywickr/config/WickrConfig;": {
        "loadConfig",
        "setConfigValue",
        "getValueForField",
    },
    "Lcom/wickr/session/WickrSessionManager;": {
        "performPostLoginInitialization",
        "updateNetworkPermissions",
    },
    "Lcom/wickr/enterprise/messages/adapter/delegates/FileMessageAdapter;": {
        "bindClickListeners$lambda$0",
    },
    "Lcom/wickr/enterprise/chat/rooms/SavedFileAdapter;": {
        "bindClickListeners$lambda$0",
    },
    "Lcom/wickr/enterprise/chat/rooms/FileDirectoryPresenter;": {
        "viewFile",
        "isOpenFilePossible",
    },
    "Lcom/wickr/enterprise/chat/rooms/FileDirectoryFragment;": {
        "showFileOptionSelectDialog",
    },
    "Lcom/wickr/enterprise/messages/adapter/delegates/BaseAttachmentAdapter$startFileDecryption$observable$2;": {
        "accept",
    },
    "Lcom/wickr/enterprise/util/FileExtensionsKt$startFileDecryption$observable$2;": {
        "accept",
    },
}


def main() -> None:
    output: list[str] = []
    found: set[tuple[str, str, str]] = set()

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
                method_names = TARGETS.get(class_name)
                if method_names is None:
                    continue
                for method in cls.get_methods():
                    if method.get_name() not in method_names:
                        continue
                    descriptor = method.get_descriptor()
                    found.add((class_name, method.get_name(), descriptor))
                    output.append(
                        f"\n\n## {class_name}->{method.get_name()}"
                        f"{descriptor} [{dex_name}]"
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

    OUTPUT.write_text("\n".join(output), encoding="utf-8")
    print(f"methods={len(found)}")
    print(f"output={OUTPUT}")


if __name__ == "__main__":
    main()
