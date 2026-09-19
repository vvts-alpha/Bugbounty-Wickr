from __future__ import annotations

from pathlib import Path

from androguard.misc import AnalyzeAPK


APK = Path(r"F:\Android-App-Analyze\Wickr\base.apk")
NEEDLES = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "No application available to handle request",
    "FileWebPreviewFragment",
    "FilePreview",
)


def method_dump(method) -> str:
    lines = [
        f"{method.get_class_name()}->{method.get_name()}{method.get_descriptor()}"
    ]
    code = method.get_code()
    if code is None:
        return "\n".join(lines)
    for instruction in method.get_instructions():
        lines.append(
            f"  {instruction.get_name():<24} {instruction.get_output()}"
        )
    return "\n".join(lines)


_, dex_files, analysis = AnalyzeAPK(str(APK))

print("## Matching strings and xrefs")
for string_analysis in analysis.get_strings():
    value = string_analysis.get_value()
    if not any(needle.lower() in value.lower() for needle in NEEDLES):
        continue
    print(f"\nSTRING: {value}")
    for class_analysis, method_analysis in string_analysis.get_xref_from():
        method = method_analysis.get_method()
        print(method_dump(method))

print("\n## Matching classes")
for dex in dex_files:
    for cls in dex.get_classes():
        class_name = cls.get_name()
        if not any(
            needle.lower() in class_name.lower()
            for needle in ("FileWebPreview", "FilePreview")
        ):
            continue
        print(f"\nCLASS: {class_name}")
        for method in cls.get_methods():
            print(method_dump(method))
