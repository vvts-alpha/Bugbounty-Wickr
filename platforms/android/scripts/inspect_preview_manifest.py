from __future__ import annotations

from pathlib import Path

from androguard.core.apk import APK
from loguru import logger


logger.remove()

APK_PATH = Path(r"F:\Android-App-Analyze\Wickr\base.apk")
ANDROID_NS = "http://schemas.android.com/apk/res/android"

apk = APK(str(APK_PATH))
root = apk.get_android_manifest_xml()

for tag in ("activity", "activity-alias"):
    for element in root.findall(f".//{tag}"):
        name = element.get(f"{{{ANDROID_NS}}}name", "")
        if "FilePreview" not in name:
            continue
        print(f"tag={tag}")
        for key, value in sorted(element.attrib.items()):
            print(f"{key}={value}")
        for intent_filter in element.findall("intent-filter"):
            print("intent-filter:")
            for child in intent_filter:
                print(f"  {child.tag}: {dict(child.attrib)}")
