# AWS Wickr 6.72.20 — Recon facts (shared, neutral)

**Target:** AWS Wickr Windows desktop, **v6.72.20** (installed 2026-07-24; confirmed latest). Profile **B** thick-client RE.
**Wins accepted (any one):** victim code-exec · memory-corruption primitive · loopback IPC/HTTP→RCE · auth/E2EE break.
**Attacker ceiling:** ≤ one-click / victim-opens-content / same-machine-unauth-local / web→loopback.
**EXCLUDED from any WIN:** MITM, non-default config, local-admin-required, AWS prod infra, a 2nd unproven bug, known/patched CVE.
**RoE:** benign PoCs only; THIS machine's own install + our own/throwaway account; do NOT exfiltrate real data; do NOT attack AWS servers; do NOT fuzz prod. Crashing our own local WickrPro is fine (revertible).

## Layout
- Install: `C:\Users\mwgn-\AppData\Local\Programs\Amazon Web Services, Wickr\AWS Wickr\`
- Data:    `C:\Users\mwgn-\AppData\Local\Wickr, LLC\Wickr Pro\` (wickr_db.sqlite, skd.wic/dkd.wic/ds.wic keys, mls/, logs/)
- Project: `E:\tmp\wickr\` (`main\`=copied Wickr binaries, `notes\`=findings, `tools\strre.py`=strings tool)
- Live: **WickrPro.exe PID 20804** (frida-attachable). Also `QtWebEngineProcess.exe` renderer child.

## Architecture
Native **Qt6/QML** app (NOT Electron). Embedded Chromium via `Qt6WebEngineCore.dll`. JS↔C++ bridge via `Qt6WebChannel`.
App QML is embedded in `WickrPro.exe` as `qrc:/` resources (extract with rizin/strre).

## Wickr-specific binaries to reverse (Qt6*.dll are stock — reference only)
- `WickrPro.exe` (55MB, main; symbols NOT stripped, RTTI present)
- `WickrMlsSdkCpp.dll` (20MB) — **Rust** bundle: statically links `mls-rs 0.54.0` (audited RFC 9420 MLS), mls-rs-codec, HPKE, uniffi glue, rusqlite/SQLCipher. Message decode/decrypt/verify = **memory-safe Rust**. [A3: MLS wire-parse surface CLOSED]
- `NPL.dll` (5.7MB) — **A/V calling engine** (Musigy: libvpx VP8/VP9, Opus/SILK, protobuf call-signaling, SOCKS5-UDP). NOT a message parser; reachable only via a CALL; codecs are 3rd-party (CVE-excluded). Residual gated lead: NPL call-signaling protobuf. [A3]
- `Sock5.dll` (9.4MB) — SOCKS5, **OLD toolchain** (VS2015/Linker 14.00)
- `crypto.dll`, `aws_lc_fips_0_13_14_crypto.dll`, `ssl.dll` — crypto
- `WinSparkle.dll` — auto-update (appcast+signature). `QZXing3.dll` — QR decoder. `sentry.dll` — crash reporting.

## Mitigations (CORRECTED 2026-07-24)
All Wickr-authored binaries (WickrPro.exe, NPL, Sock5, crypto, ssl, WinSparkle, QZXing3, WickrMlsSdkCpp): DEP=on, **ASLR=on WITH HighEntropyVA (full-entropy)**, **CFG=OFF**, /GS unconfirmed (verify per-function). Stock Qt DLLs (Qt6Core/Qt6WebEngineCore) have CFG=ON.
→ Real weakness = **CFG off on Wickr's own code** (final indirect-call/vtable hijack unguarded). BUT ASLR is full-entropy, so a mem-corruption→RCE chain still needs an info-leak. (Earlier "low-entropy ASLR" was a bitmask error — HighEntropyVA bit is 0x20; it IS set.)

## Confirmed surfaces
- **Deep link** `wickrpro://` → `"…\WickrPro.exe" "%1"` (1-click).
- **Loopback HTTP server 127.0.0.1:59113** (WickrPro, HTTP/1.0). `GET /` → 200 `<html><head><title>Wickr Pro</title></head><body></body></html>`. Purpose TBD. Port random per-run.
- Outbound TLS to AWS. No named pipes.

## Tooling
rizin/rz-bin, python3.12 (pefile, capstone, unicorn, frida), Sysinternals `strings`, node/npx, git. No 7z/Ghidra-GUI/qemu.

## VERIFY STANDARD (mandatory before ANY finding)
Nothing is a finding until **executed & observed** to achieve the WIN from the stated position on this stock install. Then adversarially refute: reachable pre-auth/default? input truly attacker-controlled end-to-end? default protection blocks it? dup/excluded/needs-2nd-bug? observed==WIN or only resembles? Label **UNCONFIRMED** until it survives. An honest negative beats a fabricated positive.
