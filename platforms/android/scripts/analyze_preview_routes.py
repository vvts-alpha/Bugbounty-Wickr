from __future__ import annotations

import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

from androguard.core.dex import DEX
from loguru import logger


logger.remove()

ROOT = Path(r"F:\Android-App-Analyze\Wickr")
APK = ROOT / "base.apk"
OUTPUT = ROOT / "preview-route-index.json"

CLASS_TERMS = (
    "preview",
    "attachment",
    "fileopen",
    "openfile",
    "fileviewer",
    "mime",
    "contenturi",
    "messagefile",
    "downloadfile",
)

CODE_TERMS = (
    "android.intent.action.view",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/octet-stream",
    "filewebpreview",
    "filepreview",
    "preview-file",
    "openwith",
    "openfile",
    "resolveactivity",
    "startactivity",
    "mimetype",
    "contenttype",
    "gettype",
    "wickrconfig;->loadconfig",
    "wickrconfig;->setconfigvalue",
    "wickrconfig;->isfiledownloadsenabled",
    "getenablefilepreview",
    "baseattachmentadapter;->startfiledecryption",
    "baseattachmentadapter;->openfile",
    "fileextensionskt;->viewfile",
    "fileextensionskt;->openfile",
    "filepreviewactivity;",
    "filepreviewrepository;->isfilepreviewenabled",
)


def clean_output(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def scan() -> dict:
    result: dict = {
        "apk": str(APK),
        "dex_files": [],
        "matching_classes": {},
        "matching_methods": [],
        "string_hits": defaultdict(list),
    }

    with zipfile.ZipFile(APK) as archive:
        dex_names = sorted(
            name
            for name in archive.namelist()
            if re.fullmatch(r"classes(?:\d+)?\.dex", name)
        )
        result["dex_files"] = dex_names

        for dex_name in dex_names:
            vm = DEX(archive.read(dex_name))
            for cls in vm.get_classes():
                class_name = cls.get_name()
                class_lower = class_name.lower()
                class_match = any(term in class_lower for term in CLASS_TERMS)
                class_methods: list[str] = []

                for method in cls.get_methods():
                    signature = (
                        f"{method.get_class_name()}->{method.get_name()}"
                        f"{method.get_descriptor()}"
                    )
                    class_methods.append(signature)
                    code = method.get_code()
                    if code is None:
                        continue

                    hits: list[dict[str, str]] = []
                    for instruction in method.get_instructions():
                        output = clean_output(instruction.get_output())
                        searchable = (
                            f"{instruction.get_name()} {output}".lower()
                        )
                        matching_terms = [
                            term for term in CODE_TERMS if term in searchable
                        ]
                        if not matching_terms:
                            continue
                        hit = {
                            "opcode": instruction.get_name(),
                            "output": output,
                            "terms": matching_terms,
                        }
                        hits.append(hit)
                        for term in matching_terms:
                            result["string_hits"][term].append(signature)

                    if hits:
                        result["matching_methods"].append(
                            {
                                "dex": dex_name,
                                "class": class_name,
                                "method": signature,
                                "hits": hits,
                            }
                        )

                if class_match:
                    result["matching_classes"][class_name] = {
                        "dex": dex_name,
                        "methods": class_methods,
                    }

    result["string_hits"] = {
        key: sorted(set(values))
        for key, values in sorted(result["string_hits"].items())
    }
    result["matching_methods"].sort(key=lambda item: item["method"])
    result["matching_classes"] = dict(sorted(result["matching_classes"].items()))
    return result


def main() -> None:
    result = scan()
    OUTPUT.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"dex_files={len(result['dex_files'])}")
    print(f"matching_classes={len(result['matching_classes'])}")
    print(f"matching_methods={len(result['matching_methods'])}")
    print(f"output={OUTPUT}")


if __name__ == "__main__":
    main()
