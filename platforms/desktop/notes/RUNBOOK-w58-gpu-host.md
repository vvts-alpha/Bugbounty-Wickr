# RUNBOOK — CVE-2026-10897 GPU-host verification (handoff from this VM)

**Date:** 2026-08-06 **Scope:** what the GPU-enabled host must establish, and exactly how.
**Analysis base (done HERE, no GPU needed):** `desktop/notes/W58-CRUX-cve-2026-10897-desync.md`,
artifacts in `scratch/w58/`.

---

## 0. Already established on this VM — do not re-do

| item | result | evidence |
|---|---|---|
| Fix identity | CL 7853657 "[gpu] Fix state desync in DoCopyTexImage2D" (M149 pick 7870453, M148 pick 7870072) | Gerrit `bug:513543143` |
| Root cause | cube-FACE target passed to `glTexParameteri` in the base/max-level clamp workaround → driver `GL_INVALID_ENUM` → decoder skips `SetLevelInfo` while driver reallocates → decoder-big/driver-small `LevelInfo` desync | `scratch/w58/cve-2026-10897-fix.diff` |
| G1 (fix absent from Wickr build) | PASS — fix upstreamed 2026-05-18; engine pin 2025-08-12; Qt ledger ends 139.0.7258.67. Airtight by date | W58 §4 |
| G2 (vulnerable code present) | PASS — byte-level at 130.0.6723.192, lines 13632–13650 & 13727–13739 | `scratch/w58/dec_up130.cc` |
| Trigger = pure WebGL1, no flags/extensions | cube chain + FBO(attach face, non-base level) + `copyTexImage2D(face, level, …)` | PoC §5 |
| Oracle logic + negative control | Chrome 150 (fixed): control `NO_ERROR`, fbo `COMPLETE`, trigger `NO_ERROR` → `FIXED` | `scratch/w58/run-chrome150.txt` |
| **Decoder-type finding (session 2)** | **validating decoder is compiled ONLY on Android** (`enable_validating_command_decoder = is_android`, `ui/gl/features.gni:24`). Shipped Win chrome.dll lacks the validating decoder's own strings ("source and destination textures are the same" ABSENT). WebGL runs on the **passthrough** decoder everywhere → the validating-only workaround is dead code on desktop | W58 §B; `scratch/w58/run-chromium130*.txt` ×4 |
| Process model (Android) | GPU/command decoder runs **in-process in the WebView/app** — no GPU sandbox | W17j [M] |
| Decoder-side stale-LevelInfo consumers (census @130) — **Android-WebView-only relevance** | `DoCompressedTexSubImage` 13423 · `DoCopyTexSubImage2D` 13810 · `DoCopyTextureCHROMIUM` 15840/15874 · `CopySubTextureHelper` 15965/16039 · FBO attachment sizes ← LevelInfo (`framebuffer_manager.cc:164/172/266`) | this file, §3 |

> **Headline change (session 2):** the **Desktop leg is REFUTED at build level** (the vulnerable
> function is not in Windows binaries). The **Android WebView leg is the only live surface** and
> the whole point of the on-device work below. Steps 1–2 below now serve to confirm/refute Android
> only; the Desktop column is closed.

## 1. Step 1 (Android device): confirm the decoder + the bug fire

The PoC oracle doubles as the validating-vs-passthrough discriminator. Load
`scratch/w58/poc-cve-2026-10897-desync.html` **inside an Android WebView** (a tiny test WebView
app, or the confirmed Wickr preview-WebView path) on a device whose
`com.google.android.webview` < 149.0.7827.53. Expected:

```
control(2D, same-texture, non-base attachment) error: NO_ERROR
fbo status: COMPLETE
TRIGGER copyTexImage2D error: INVALID_ENUM     <- the desync marker
VERDICT[webgl2]: VULNERABLE
```

Decision table:

| trigger error | meaning | next |
|---|---|---|
| `INVALID_ENUM` | validating decoder + bug fire ⇒ **CVE live in this WebView** | step 2 |
| `NO_ERROR` | either fixed (WebView ≥ 149.0.7827.53) OR this WebView uses passthrough | check `versionName`; if unfixed yet NO_ERROR → passthrough, dead here too |
| `INVALID_OPERATION` | Blink-side feedback validation blocked the sequence | record as reachability finding; re-check Blink copy-feedback rules |
| `ENV`/`SKIP` | harness/env, not the bug | follow the log line |

Why on-device and not on the desktop GPU host: four desktop runs (SwiftShader + D3D11, with and
without `--use-cmd-decoder=validating` / `--disable-features=DefaultPassthroughCommandDecoder`)
all returned `NO_ERROR` — WebGL on a non-Android build cannot reach the validating decoder at all
(build flag `is_android`). A desktop positive control is impossible; the build-level refutation
of the desktop leg stands regardless (`scratch/w58/run-chromium130-*.txt`).

## 2. Step 2 (Android device): delivery + impact

- **Delivery already confirmed** (your H1 Android report): polyglot docx → same-origin script
  execution inside the Wickr preview WebView (no `nosniff`). WebGL is ungated in that WebView.
- So if step 1 fires `INVALID_ENUM`, the full chain on an exposed device is: **send docx → victim
  previews → attacker JS in the WebView → desync (`INVALID_ENUM`) → Phase-2 consumer hunt.**
- Capture (w57 convention): fault module+offset (expect a Qualcomm/Mali/PowerVR user-mode driver,
  or `libwebviewchromium.so` / `libEGL_*`), exception type, whether the fault address correlates
  with TRACKED×TRACKED×4 (bump `?base=4096` for a louder signal).

## 3. Step 3 (Android device): weaponization — consumer hunt

`?p2=1`, debugger on the **app process** (decoder is in-process). Priority order (census in §0):

1. `texSubImage2D` at stale size (PoC p2a/p2e) — decoder validates vs stale LevelInfo; does the
   driver accept/execute, or does ANGLE/driver re-reject?
2. FBO-attach the desynced level + `readPixels` (p2b) — OOB-*read*/leak flavor.
3. `generateMipmap` over the inconsistent chain (p2c) — cube-face size mismatch inside the
   driver's mip generator is a prime OOB-write candidate.
4. Compressed variants (`WEBGL_compressed_texture_*` → `DoCompressedTexSubImage`, 13423).
5. If all silent: trace `TextureManager::GetLevelSize`/`ValidateTexSubImage2D` consumers
   (`texture_manager.cc`) for a path that sizes a memcpy/map from LevelInfo without re-delegating
   to ANGLE (the fix proves one exists; the CL does not name it).

## 4. Version boundary (host-independent)

```
adb shell dumpsys package com.google.android.webview | findstr versionName
```

- `< 149.0.7827.53` ⇒ vulnerable code present (same decoder). M148 also received the fix
  (cherry-pick 7870072, merged 2026-05-30), so a `148.0.7778.x` respin built ≥ 2026-06 may be
  fixed — check the package **build date**, not just the version string.
- **Desktop is out of scope of this check** — refuted at build level (§1 / W58 §B). The shipped
  `Qt6WebEngineCore.dll` belt-and-braces check: `python -c "d=open(r'…\Qt6WebEngineCore.dll','rb').read(); print(d.find(b'source and destination textures are the same'))"`
  → `-1` ⇒ validating decoder absent ⇒ desktop confirmed unaffected.

## 5. Claims discipline (revised post-pivot)

- **Allowed now (and quotable):** "CVE-2026-10897 does not affect Wickr Desktop — the vulnerable
  validating-decoder function is not compiled into non-Android builds (`enable_validating_command_decoder = is_android`); WebGL on Windows/macOS/Linux runs on the
  passthrough decoder, which lacks the workaround. Verified by source-level build flag + absence
  of the validating decoder's error string in shipped chrome.dll, and by four desktop PoC runs
  returning `NO_ERROR`."
- **Allowed now:** "Android is the only platform whose build contains the validating decoder;
  the candidate surface is Android WebView embedders, of which Wickr is one. Delivery into
  Wickr's preview WebView is already confirmed (prior H1). The open question is purely whether
  WebView's WebGL contexts run validating — settled empirically by the PoC on-device."
- **Not allowed until step 1 on a device:** "Wickr Android is vulnerable" (the on-device oracle
  must return `INVALID_ENUM`).
- **Not allowed without step 3:** OOB write / RCE / code execution. Google's Critical rating is
  *their* assessment of a validating-decoder chain, not our demonstration.
