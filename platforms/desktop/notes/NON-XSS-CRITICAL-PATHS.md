# AWS Wickr (6.72.20) — Non-XSS Critical/High Path Candidates

**Date:** 2026-07-25 · **Scope:** RCE-reachable paths OTHER than the (CSP-blocked) docx/pptx XSS.
**Engine:** QtWebEngine 6.9.2 = Chromium 130.0.6723.192 · **Binary:** WickrPro.exe (55.9 MB, Qt6 + WinSparkle)

This document records CONFIRMED and CANDIDATE non-XSS findings. One is **CONFIRMED** (WinSparkle signature disabled); the rest are ranked candidates requiring further work.

---

## 1. CONFIRMED — WinSparkle update signature verification DISABLED (High → potentially Critical)

### Evidence (verified, static)
WinSparkle.dll ships with DSA signature verification capability (strings present: `"Missing DSA signature!"`, `"Using unsigned updates!"`, `"Cannot read DSA public key from PEM"`, `"Invalid update signature"`, full OpenSSL DSA stack at `D:\a\winsparkle\winsparkle\3rdparty\openssl\crypto\dsa\*`). It exports `win_sparkle_set_dsa_pub_pem`.

**Decisive check:** `WickrPro.exe` does **NOT** import or reference `win_sparkle_set_dsa_pub_pem`:
```
Import check in WickrPro.exe:
  NOT FOUND: win_sparkle_set_dsa_pub_pem   ← the DSA-pubkey setter is never called
  FOUND: win_sparkle_set_appcast_url @ 0x34401b4
  FOUND: win_sparkle_check_update_with_ui @ 0x3440368
```
The appcast URL is `https://s3.amazonaws.com/wickr-desktop-clients/` (`0x328a5d8`) + `Windows/WickrPro` + `/Latest/Latest.xml` (`0x328a540/0x328a5c0`), logged via `": Appcast Endpoint = "` (`0x32b8a70`) and `"SPARKLE FEED URL REGISTRATION: "` (`0xe38950`). No DSA PEM key blob exists anywhere in `WickrPro.exe` (only RSA `BEGIN PUBLIC KEY` blobs at `0x3254ef5`/`0x329f195`, unrelated to WinSparkle).

### WinSparkle behavior with no DSA key set
Per WinSparkle design: if `win_sparkle_set_dsa_pub_pem` is never called, the downloader logs `"Using unsigned updates!"` and **skips signature verification entirely** — the downloaded installer is executed without any code-signing check by WinSparkle. (Authenticode on the installer is a separate OS-level check, but WinSparkle itself applies no update-signature gate.)

### Impact
- **Appcast-source trust is total.** There is no defense-in-depth signature layer. Anyone who can influence the content of `https://s3.amazonaws.com/wickr-desktop-clients/.../Latest.xml` or the referenced update binary gets **arbitrary code execution as the user** (WinSparkle launches the downloaded installer).
- **RCE paths that do NOT require classic network MITM:**
  1. **S3 bucket write compromise** (misconfigured permissions, leaked credentials, supply-chain) → malicious appcast + binary → silent RCE via auto-update. No DSA check to stop it.
  2. **S3 bucket takeover** (subdomain/bucket claim if the `wickr-desktop-clients` bucket ever lapses).
  3. **Local attacker / malicious insider** who can drop a fake appcast via hosts-file + a self-signed cert is partly blocked by HTTPS, BUT WinSparkle also has WebView2 fallback paths (strings: `COREWEBVIEW2_WEB_ERROR_STATUS_*`) whose cert handling must be verified.
- **Even under MITM (out of stated scope but worth noting):** the lack of a signature gate means a TLS compromise alone (no separate crypto defeat) yields RCE — there is no second hurdle.

### Severity
- **As a hardening/defense-in-depth finding: HIGH.** It removes the code-signing safety net from a privileged auto-updater. Even if the S3 bucket is currently well-secured, the absence of signature verification is a latent Critical that activates on any appcast-source compromise.
- **If S3 bucket write exposure is found: CRITICAL (RCE).** The appcast source posture is the swing factor and should be checked next (bucket policy, write credentials, CI/CD pipeline).

### Recommendation
Call `win_sparkle_set_dsa_pub_pem()` with the vendor DSA public key at startup, and require `sparkle:dsaSignature` on every enclosure. Additionally verify the WebView2 fallback cert handling and pin the S3 bucket.

### Residual to confirm
- Whether the WebView2 download fallback (if S3/TLS path fails) validates certificates (strings suggest WebView2 usage; the `onCertificateError: error.ignoreCertificateError()` posture elsewhere in the app is concerning).
- Whether `installerArguments` (`sparkle#installerArguments` namespace string present in WinSparkle.dll) is honored and could enable argument injection to a (signed) installer — secondary, since signature is already absent.

---

## 2. CANDIDATE — Chromium 130 renderer n-day memory corruption (High, possibly Critical)

The renderer is pinned to **Chromium 130.0.6723.192** (~Nov 2024), ~7 major versions behind current (~137+ as of mid-2026). All memory-corruption CVEs fixed in Chromium 131–135+ are, by construction, **n-day** against this build.

### Renderer-reachable attack surface (confirmed)
- File previews (docx/pptx/pdf/xlsx/xml/images) parsed by Chromium renderers (1-click, via received file).
- `WebEngineView` renders received links/rich-text; `ignoreCertificateError()` + `grantFeaturePermission(...,true)` widen reach.
- A renderer memory-corruption bug (V8/Blink/Skia/WebRTC/PDFium) reached via any of these = **High**; escalation to the browser process (which hosts the QWebChannel bridge) = **Critical**.

### Candidate classes (knowledge-based; requires PoC to confirm)
- **V8 type confusion / OOB** (the classic renderer RCE source; fixed roughly every stable cycle) — high severity, JS-reachable.
- **Blink use-after-free / OOB** (layout, editing, media) — high severity, HTML/CSS/JS-reachable.
- **Skia / SwiftShader** (image/SVG/WebGL) — reachable via image preview.
- **PDFium** (pdfjs-dist is JS, but the native PDF plugin if enabled) — reachable via PDF preview.
- **WebRTC / media stack** (libvpx, opus, H.264) — reachable via calling/media.

**Important:** QtWebEngine renderer is sandboxed by default. To convert renderer code-exec → bridge/RCE requires a **sandbox escape** (Mojo/validation UAF). Such bugs exist in this window but are rarer.

### Severity
- **Renderer memory corruption (no escape): High.**
- **Renderer → browser (bridge) escape: Critical.**
- This is a *credible finding class*, not a confirmed exploit. Each candidate needs (a) confirming the fix landed post-130, (b) a PoC adapted to QtWebEngine.

### Recommendation
Diff the QtWebEngine 6.9.2 chromium branch against upstream 131–135 for V8/Blink/security-bug patches; prioritize Critical CVEs in V8 and Blink with public reports. Even a single confirmed renderer UAF that is reachable from a previewed file is a High/Critical reportable.

---

## 3. CANDIDATE — Native message protocol parsers (MLS / NPL) — 1-click, Critical ceiling

The most "classic secure-messenger Critical" path. Received messages are decrypted then parsed by native C++ code (`WickrMlsSdkCpp.dll` = MLS E2EE; `NPL.dll` = Network Protocol Layer). Any memory-corruption in the post-decrypt parser = **1-click RCE** (encryption does not protect the parser; the attacker controls the plaintext-after-decrypt).

- MLS (RFC 9420) is new and complex (TreeMath, key schedule, signature verification, proposal/commit processing) → high bug surface.
- NPL framing/length-prefixed parsing is a classic overflow site.
- Reachable by sending a message; victim need only receive/sync (often 1-click to open the conversation, sometimes 0-click on auto-fetch).

**Status:** flagged in `notes/A3-mls-npl.md`; needs targeted fuzzing / invariant audit of the recovered native binaries. **This is the highest-ceiling non-XSS path.**

---

## 4. CANDIDATE — Calling / media (WebRTC, codecs, RTP) — 0–1 click, High→Critical

Voice/video path (`notes/A6-calling.md`, `A9-calling-audio-reliability.md`) and `Sock5.dll`. Codec/RTP parsing is historically RCE-rich (libvpx, opus, H.264 SPS/PPS). Auto-answer → 0-click; manual answer → 1-click. Native parsing surface, distinct from MLS.

---

## 5. CANDIDATE — Loopback HTTP server + deeplink/WebChannel argument injection — High

`notes/A1-loopback.md` (loopback server) + `A2-deeplink-webchannel.md` (deeplink → QWebChannel). If deeplink parameters flow into bridge slots like `openFile`/`saveFile`/`uploadFile` without strict validation → path traversal / signed-binary launch / argument injection → High. Loopback server + DNS rebinding could reach the bridge without XSS.

---

## 6. CANDIDATE — Attachment decrypt-then-parse chain — High

`notes/A5-content-attachment.md`. Attachments are AES-GCM-decrypted then handed to native/image parsers. "Malicious ciphertext → malformed plaintext → parser corruption" crosses the crypto boundary cleanly. Qt Image decoders especially worth auditing.

---

## Ranking (ROI = impact × reachability × verifiability)

| # | Path | Impact | Reach | Confidence | Next action |
|---|------|--------|-------|-----------|-------------|
| 1 | **WinSparkle signature disabled** | High→Critical | auto-update | **CONFIRMED (static)** | Verify S3 bucket posture + WebView2 cert handling; report as High hardening / latent Critical |
| 2 | MLS/NPL native parser memory corruption | Critical | 1-click msg | Candidate | Targeted fuzz/invariant audit of WickrMlsSdkCpp.dll/NPL.dll |
| 3 | Chromium 130 renderer n-day | High→Critical | 1-click preview | Candidate | Diff V8/Blink fixes 131-135 vs QtWebEngine branch; adapt PoC |
| 4 | Calling/media codec parsing | High→Critical | 0–1 click | Candidate | Audit WebRTC/codec native paths |
| 5 | Deeplink/WebChannel argument injection | High | deeplink | Candidate | Trace deeplink params → bridge slot args |
| 6 | Attachment decrypt→parse | High | 1-click file | Candidate | Fuzz native image/file parsers post-decrypt |

---

## Bottom line
- **One confirmed non-XSS High (latent Critical): WinSparkle code-signature verification is disabled** (`win_sparkle_set_dsa_pub_pem` never called; `"Using unsigned updates!"` path active). Report immediately; the appcast S3 source is the sole trust gate.
- **Highest-ceiling candidates:** native protocol parsers (MLS/NPL) and Chromium 130 renderer n-days — both 1-click, both Critical-capable. These are the most worthwhile next research targets if moving beyond the CSP/XSS line.