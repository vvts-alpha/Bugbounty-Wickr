# AWS Wickr (6.72.20) Security Engagement — Executive Summary

**Date:** 2026-07-25/26 · **Target:** AWS Wickr desktop (QtWebEngine 6.9.2 / Chromium 130.0.6723.192)
**Scope:** (1) CSP-bypass on the docx/pptx renderer→bridge XSS; (2) non-XSS Critical/High paths.

---

## Confirmed & candidate findings (ranked)

| # | Finding | Class | Status | Severity | Reach |
|---|---------|-------|--------|----------|-------|
| 1 | **libvpx VP8 v1.9.0 — CVE-2023-5217 (UAF, threaded decode)** | Native n-day RCE | **CONFIRMED vulnerable** (version pinned; multithread ON; CFG OFF) | **Critical** | Video call (0–1 click) |
| 2 | **WinSparkle update signature verification disabled** | Missing control | **CONFIRMED** (`win_sparkle_set_dsa_pub_pem` never imported; "Using unsigned updates!") | High → Critical* | Auto-update |
| 3 | **Control Flow Guard OFF on all native DLLs** | Hardening gap | **CONFIRMED** (all 4 DLLs `0x0160`) | Medium (amplifies #1/#4) | — |
| 4 | **docx-preview `renderSymbol`/`renderAltChunk` HTML injection** | CWE-79/80 | **CONFIRMED bug**; exec blocked by CSP | High (latent RCE) | 1-click file preview |
| 5 | Chromium 130 renderer n-day (V8/Blink/Mojo) | n-day RCE | Candidate (~7 versions stale) | High→Critical | 1-click preview/link |
| 6 | MLS/NPL/Opus/FFmpeg native parsers | Native RCE | Candidate | High→Critical | 1-click msg/call |

\* Critical if the S3 appcast source is compromisable (out of scope to verify).

## Line 1 — CSP/XSS (HARD NEGATIVE, well-defended)
On the shipped build, arbitrary JS execution from the docx/pptx XSS is **not achievable**. The single barrier is `script-src 'self' qrc://*` (no inline/eval/nonce/data/blob) + meta-CSP inheritance into `iframe.srcdoc` on Chromium 130. The closest-to-RCE primitive is **`altChunk → iframe.srcdoc`** — blocked *only* by CSP inheritance; any future CSP weakening or QtWebEngine downgrade = clean 1-click RCE via the `uiBridge` bridge. Declarative `wickrweb://` GET impact is LOW (mutation routes are header-gated). Full detail: `WAVE2-A-CSP-BYPASS-FINAL.md`.

## Line 2 — Non-XSS Critical paths (where the real wins are)
- **#1 (CVE-2023-5217)** is the strongest single finding: version-pinned vulnerable VP8 decoder, multithreaded path active, CFG OFF, reachable by placing a video call. This is the highest-value next research target.
- **#2 (WinSparkle)** is a confirmed control gap that converts to Critical on any appcast-source compromise.
- **#3 (CFG OFF)** is a confirmed hardening deficiency that materially lowers the bar for exploiting #1 and any future native parser bug.

## Deliverables
- `notes/WAVE2-A-CSP-BYPASS-FINAL.md` — exhaustive CSP-bypass analysis (6 phases, top-10 hypotheses, 3 deep dives).
- `notes/NON-XSS-CRITICAL-PATHS.md` — WinSparkle CONFIRMED + 5 ranked candidate paths.
- `notes/NATIVE-PARSER-ASSESSMENT.md` — per-DLL memory-corruption assessment + codec version pinning + CVE mapping + fuzzing strategy.
- `wave2-harness/` — validated CSP test harness + altChunk PoC scaffold.
- `_scan_*.py` — reproducible static analysis scripts (Sparkle, native DLLs, JPEG, serializer, proto/vpx).

## Recommended next actions (if engagement continues)
1. Adapt the CVE-2023-5217 public PoC to NPL.dll's `vpx_codec_decode` entry (RE the symbol; build a libfuzzer/AFL harness on crafted VP8 frames delivered via a call).
2. Pin Opus/FFmpeg versions via deeper RE; diff against codec CVEs.
3. Report WinSparkle signature-disabled + CFG-OFF as hardening findings.
4. Report the docx altChunk latent-RCE primitive as a defense-in-depth High.

## Net assessment
The web/XSS surface is **well-defended** (CSP holds). The **native media-parsing surface is the critical exposure**: libvpx VP8 v1.9.0 carries a known Critical UAF (CVE-2023-5217), is reachable via video calls, and runs in a CFG-disabled binary. This is the most credible path to a Critical finding in this engagement.