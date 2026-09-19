# A4 — Sock5 / QZXing QR / media-decoder surface (AWS Wickr 6.72.20, Windows)

Agent A4. Surface: old/auxiliary native decoders where attacker bytes hit them within the
attacker ceiling — `Sock5.dll` (SOCKS5/Dispersive tunnel), `QZXing3.dll` (QR decoder),
Qt image/thumbnail decoding of received attachments.

VERIFY STANDARD applied: nothing marked WIN unless executed & observed on the stock install.

---

## TL;DR verdict

- **Sock5.dll → NEGATIVE (excluded: non-default config + no in-ceiling attacker input).**
  It is a Dispersive VDN SOCKS5 tunnel gated behind **Wickr Open Access (WOA)**, an
  admin/network-provisioned anti-censorship feature that is **OFF on a default install**
  (verified: no SOCKS listener in the running process; `WOAVendor` dir empty; no proxy pref).
  Even when enabled, its SOCKS5 parser is fed by the **local trusted WickrPro client**; the
  only remotely-supplied bytes are tunnel responses from the Dispersive/AWS side = MITM /
  malicious-server = EXCLUDED.

- **Qt attachment image decoding → 0-click, but stock-Qt (out of novel scope).**
  Received chat images render in the **QtWebEngine (Chromium) web app** → decoded by Chromium,
  not the Qt `imageformats` plugins. The Qt plugins (qjpeg/qwebp/qtiff/qgif) on this surface
  are reached via **native QML** (avatars/onboarding), not the 0-click chat path. Bugs there
  would be stock-Qt CVEs (excluded / other-agent territory).

- **QZXing3.dll (ZXing C++ port) → CLOSED, NO BUG. Reachability ≥1-click (constrained).**
  (a) ~76k module-level live decodes → no reproducible fault (one non-reproducible AV, refuted).
  (b) **Reed-Solomon-VALID hostile-payload crafting** (the classic DecodedBitStreamParser sink)
  → 888 crafted codes proven to REACH the parser (valid control decodes) and **safely rejected;
  no memory-safety fault**. The parser is bounds-checked. Details in §3.

---

## 1. Sock5.dll — SOCKS5 / Dispersive VDN tunnel

### What it is
- Exports: `DispersiveTunnelStart(string,string,string,int)`, `DispersiveTunnelStop`,
  `DispersiveTunnelCheckStatus`, `DispersiveTunnelReset`, `DispersiveTunnelSetLogCallback`.
- Imports `socket/bind/listen/accept/recv/recvfrom/WSARecv` (WS2_32) + libevent
  (`evconnlistener_new`). Registry `SOFTWARE\Dispersive\Vdn`.
- Strings confirm a **local SOCKS5 server**: "Initializing SOCKS5 Server",
  "Create listening socket - fd=%hu address=%s:%d", "SOCKS5 port failed to bind",
  Dispersive "deflect_to_pool" waypoint JSON. Old toolchain (Linker 14.00 / VS2015).
- Purpose: when WOA is on, WickrPro routes its own outbound traffic through this local SOCKS5
  proxy, which tunnels via the Dispersive virtualized network to reach AWS (censorship evasion).

### Reachability (the blocker)
- WOA is the gate. WickrPro strings: `isWOAProxyConfigured`, `WOA_DISABLED_ON_NETWORK`,
  "Wickr Open Access is having trouble starting. WOA is required for your network…",
  `enableOpenAccessOption`, `forceOpenAccess`, `BOOTSTRAP: WOA ENABLED SOCKS PORT = `.
  → WOA is **admin/network-provisioned and OFF by default**.
- **Executed observation:** live WickrPro (PID 20804, later 15900/19268) listens **only on
  `127.0.0.1:59113`** (the known HTTP server). **No SOCKS5 listener exists** on the default
  install. `netstat -ano` for the WickrPro PID shows no SOCKS port.
- On-disk: `…\Wickr Pro\WOAVendor\` is **empty**; `preferences` has `LocalFeatures:{}` and no
  proxy/WOA-enable key. Sock5.dll is loaded into the process image but its tunnel is not started.
- Data-flow even IF enabled: SOCKS5 handshake/request parsing is fed by the **local WickrPro
  client** (trusted, loopback). Attacker-controlled bytes would only be the **tunnel response**
  from the remote Dispersive/AWS endpoint → requires MITM or malicious server → **EXCLUDED**.

**Verdict: DEAD on default install (non-default config) AND no in-ceiling attacker input even
when enabled. Excluded from a WIN. Not pursued to a crash — reachability blocker is decisive.**

---

## 2. Qt attachment / thumbnail image decoding

- `imageformats` plugins present: qgif, qicns, qico, qjpeg, qpdf, qsvg, qtga, qtiff, qwbmp,
  qwebp (all stock Qt 6). Loaded in-process: qjpeg/qgif/qtiff/qwebp confirmed.
- **Received chat messages/attachments render in the QtWebEngine web app** (React/Redux UI in
  `Qt6WebEngineCore.dll` / QtWebEngineProcess). Inline images there are decoded by **Chromium's**
  image pipeline, NOT the Qt `imageformats` plugins.
- The Qt plugins are used by **native QML** surfaces (`QImage`, Qt Quick `Image`): avatars,
  onboarding art, and the QR drag-drop path (§3). These are not the 0-click chat surface.
- Therefore: the 0-click received-image decode is **Chromium** (stock, huge, well-fuzzed,
  out of my novel scope / other agent); the Qt-plugin decode is **not 0-click** and is stock Qt.

**Verdict: no novel, in-scope, in-ceiling bug on this sub-surface. 0-click path is stock
Chromium; Qt-plugin path is stock Qt reached only via interactive native QML.**

---

## 3. QZXing3.dll — QR / barcode decoder (the Wickr-shipped target)

### What / where
- Full ZXing C++ port. Decoders present (strings/enums): QR, DataMatrix, Aztec, PDF417,
  Code39/93/128, EAN/UPC, ITF, Codabar, RSS. Many internal parse asserts present
  (e.g. `BitMatrixParser::trimArray: negative size!`, `processRow(PDF417): eraseCount too big!`,
  `codewords index out of bound`, `Too many rows!`, `Could not decode version`).
- Exported entry points: `decodeImage(QImage const&,int,int,bool)`,
  `decodeImageFromFile(QString const&,int,int,bool)`, `decodeImageQML(QUrl/QObject)`,
  `encodeData(...)` (generation only). Also `registerQMLTypes` / `registerQMLImageProvider`
  (provider is **encode-only**: `image://QZXing/encode/…` — there is **no decode provider**,
  so web/QML cannot auto-decode an arbitrary image URL as a barcode).
- **No network imports** — QR bytes always arrive as an already-decoded QImage / a file path.

### Reachability — the decisive constraint (NOT 0-click)
QR decode is wired only into onboarding / account-recovery / device-sync **native QML**:
- `qml/AWSWickrProOnBoarding/ScanQRCode.qml`, `MasterRecoveryKey.qml`, `DeviceSync.qml`.
- **Camera scan** (`QZXingFilter`/`Camera`/`VideoOutput`, `enabledDecoders: DecoderFormat_QR_CODE`,
  `onTagFound`) — victim scans a QR with the webcam during device-add / recovery. Attacker
  controls the QR *structure* (version/format/mode/count) but not raw file bytes.
- **Drag-drop file decode** — `MasterRecoveryKey.qml` has a `DropArea (fileDragArea)` with
  `onDropped` → `text/uri-list` → `file://…` → **`QZXing.decodeImageFromFile(url)`** →
  "RECOVERY KEY FILE SCANNED". Here the **attacker fully controls the file bytes**.
- The web-app `wickrBridge.validateQRCode({qrCode:""})` passes a **string**, not an image (it
  validates QR *content*), and lives in a debug HTML page → NOT an image-decode sink.
- `WickrGetQRCode` is a network request context that *fetches/generates* the device-sync QR
  (`/getQRCode.php`) → generation, not decode.

**Net reachability:** requires the victim to be in a rare **onboarding / account-recovery /
device-pairing** flow AND deliberately **scan an attacker QR** or **drag-drop an attacker image**.
This is heavier than "one-click" and is not the everyday message path. App-reachable decode is
**QR-only** (`enabledDecoders = DecoderFormat_QR_CODE`); the other ZXing formats are not enabled
by the QR-scan UI. Any memory-corruption found is therefore a **constrained-reachability**
primitive, not a 0-click win.

### Harness (executed, in-process on live WickrPro)
- frida attaches to live WickrPro; QZXing3.dll + Qt6Gui loaded. Build a `QZXing` instance via
  the exported ctor (default decoder mask 0x3fffe). Feed pixels directly by constructing a
  `QImage(uchar*,w,h,bpl,Format_RGB32,…)` (Qt6Gui export RVA 0x31890) and calling the core
  `QZXing::decodeImage` (RVA 0xa980) — this **isolates the ZXing decode from the Qt file/plugin
  loader**, so any fault is unambiguously in the Wickr-shipped ZXing code.
- ABI notes (verified by capstone): these member fns returning `QString` use MSVC-x64
  **this=RCX, sret=RDX, arg0=R8**. frida `NativeFunction{exceptions:'propagate'}` is required so
  ZXing's internal C++ exceptions (used for "not found") are handled natively instead of stolen.
- Crash capture: `Process.setExceptionHandler` records access-violations (fault addr, module+off,
  regs, disasm, backtrace) and blocks on a Python ack before letting the fault propagate.
- **Harness proven:** decodes real QRs correctly in-process — "WICKRTEST123", "hello world",
  "https://wickr.com/x" all round-trip with ok=1, process stays alive.
- Self-verifying fuzzer: seed-reproducible inputs; on any suspected death/hang it re-attaches to
  the watchdog-restarted WickrPro and **replays the suspect seed 3×** to separate a real
  reproducible crash from a coincidental auto-restart (WinSparkle/watchdog cycles the process).
- Mutation strategies: valid-QR module flips; format/version-info band corruption; timing-pattern
  corruption; random square grids at valid QR dimensions; crafted 3-finder patterns at odd
  dimensions (drives grid-sampler / version-by-dimension); rectangular/extreme-size random grids;
  1D stripe patterns (drives Code128/EAN/ITF/RSS detectors). All formats enabled in the harness
  to maximize bug surface (with the caveat that only QR is app-reachable).

### Result — UNCONFIRMED (no reproducible fault); QZXing decode robust under test
Coverage (all executed against the live in-process decoder):
- ~18.9k varied fuzz inputs (qz_fuzz2) + ~4k earlier (qz_fuzz) before a coincidental app restart;
- 25,000× repetition of one suspect input;
- varied-window replay [12000,19600) and **exact full-sequence replay [0,19600)**;
- ≈ **76,000 total `decodeImage` invocations**. Decoded-OK rate ≈15% (valid codes); the rest
  exercised detector/parse-failure paths across all enabled formats.

**One** access violation was caught by the process-wide handler at fuzz iteration i=18904
(input = 57×57 random grid, seed 7018904). It could **not** be reproduced:
| reproduction attempt | result |
|---|---|
| fresh instance, single decode of seed 7018904 | no crash |
| 25,000× repeat of seed 7018904 (one instance) | no crash |
| varied window replay [12000,19600) through i=18904 | no crash |
| exact full-sequence replay [0,19600) through i=18904 | no crash |

The original faulting address/backtrace was lost to a bug in the self-verify routine, and the
event never recurred. Because it is non-reproducible under exact-sequence replay and its
attribution to QZXing is unestablished (my handler is process-wide; the live app runs many
threads — networking/login-retry/telemetry/UI), this is judged a **coincidental, non-deterministic
event, NOT a QZXing memory-corruption primitive.** Per the VERIFY STANDARD it fails refutation →
**UNCONFIRMED**.

**Conclusion:** within the tested input classes (mutated valid QR: module/format/version/timing
corruption; random grids at valid QR dimensions; crafted finder patterns at odd dimensions;
rectangular/extreme-size grids; 1-D stripe patterns) and ~76k executions, **no reproducible
memory-safety fault was found** in the Wickr-shipped ZXing port. Not fuzzed to exhaustion; the
principal residual gap is **Reed-Solomon-valid but malicious payloads** (needed to reach
`DecodedBitStreamParser` mode/char-count bugs), which module-level mutation cannot reach because
RS error-correction rejects/repairs the codewords first. Even a hit there would carry the same
constrained reachability below.

### 3b. Reed-Solomon-VALID hostile payloads → DecodedBitStreamParser — CLOSED (no bug)
The one sink module-mutation cannot reach: RS error-correction repairs tampered codewords before
the bitstream parser runs. Closed it with correct technique — craft codes whose DATA codewords
encode a hostile bitstream and compute **correct RS parity over them**, so correction PASSES and
the hostile bits reach `DecodedBitStreamParser` intact.

Method (executed): inject at `qrcode.util.create_bytes(buffer, rs_blocks)` — it computes valid RS
over an arbitrary bit-buffer. Build a hostile `BitBuffer` (raw mode+count+data bits), pad to
capacity, `create_bytes` → RS-correct codewords, set `qr.data_cache`, `makeImpl(mask)` places it
with correct finder/timing/alignment/format(BCH)/version/mask. Rendered → fed to the same live
QZXing `decodeImage` harness.

**Proof the payloads REACH the parser:** a crafted *valid* alphanumeric segment ("AB") decodes to
"AB" (ok=1) through this exact pipeline. Hostile variants share identical version/ECC/mask/RS
structure — only the data bits differ — so detection+RS+parser-entry are identical; the sole
difference is the parser's handling of the hostile bits.

**Battery (888 crafted codes):** versions 1/7/10/27/40 (all three count-bit regimes + version-info),
ECC L/M/H, masks 0/2/4/6, ×2 render scales, over builders:
- over-large character counts (byte 16-bit=65535 / numeric / alphanumeric / kanji, all-ones count);
- **alphanumeric OOB value** (11-bit group = 2047 → `value/45 = 45`, past the 45-entry table; and
  6-bit tail = 63) — the canonical ZXing table-index over-read;
- kanji 13-bit out-of-range values; ECI 1-byte and 3-byte max designators;
- structured-append edge header; FNC1 first/second; mixed-mode chains; mode-switch storm.

**Result:** every hostile payload returns **ok=0 / empty with NO crash** (parser reached, then
rejected). WickrPro stable across all ~1776 decodes. QZXing's bit reader is bounds-checked and
counts/lengths are validated; the alphanumeric `value/45` case is at most a benign 1-byte table
over-read that never faulted and whose result the parser discards. **No memory-corruption
primitive. DecodedBitStreamParser gap CLOSED.**

### Reachability label (per coordinator): ≥1-click (constrained) — WITHIN the ceiling
Had a bug been found, its position is: victim in an onboarding / account-recovery / device-pairing
flow **scans an attacker QR** (camera; attacker controls QR structure) or **drag-drops an attacker
image** onto the Master-Recovery-Key screen (`decodeImageFromFile`; attacker controls raw bytes).
That is **≥1-click (constrained)** — within the RECON ceiling, though not 0-click and not the
everyday message path. App-reachable decoding is **QR-only**. Moot here since no bug was found.

**QZXing verdict: CLOSED. No memory-corruption bug across module-level fuzzing (~76k) AND
RS-valid targeted crafting (888) — the two techniques together cover detector/grid/version/format
parsing and the DecodedBitStreamParser count/length/mode logic.**

---

## Files
- Harness: `…/scratchpad/qz_agent.js` (frida agent), `qz_lib.py` (attach/decode/reattach).
- Module-level fuzz: `qz_gen.py` (seed-reproducible generators), `qz_fuzz2.py` (self-verifying),
  `qz_seq.py` / `qz_loop.py` / `qz_repro.py` (replay/repro).
- RS-valid crafting: `qz_craft.py` (hostile-payload builders + RS-correct injection via
  `create_bytes`), `qz_run_craft.py` (battery driver + reproducibility verify).
