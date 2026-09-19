# AWS Wickr Desktop (WickrPro) 6.72.20.0 — Wave 3 native assessment, final report

**Target:** AWS Wickr Desktop / WickrPro 6.72.20.0, Windows x64. Analysed binaries byte-identical to
the installed client. **Date:** 2026-07-30.
**Scope / RoE:** operator's own machines and own accounts only; no calls to unwitting parties; no
fuzzing against Wickr production servers; benign PoCs; no fabricated positives.
**Objective:** a memory-corruption vulnerability reachable from attacker position P1
(message/attachment parsing), P2 (call peer, 0–1 click) or P3 (network/update).

---

## 0. Bottom line

**No attacker-reachable memory-corruption vulnerability was demonstrated.**

Two genuine memory-safety defects were found and characterised, one of them measured overflowing in
shipped code. Neither is remotely triggerable. Alongside them this report delivers a set of
**well-evidenced negatives** that materially narrow the client's remote attack surface, and one
hardening observation of real consequence (§F1: a single hardcoded immediate is the only thing
standing between a call peer and a confirmed heap overflow).

This is a hardening deliverable, and it is stated as one. Where earlier working hypotheses were
wrong, they are listed as refuted (§4) rather than quietly dropped.

---

## 1. Findings

### F1 — Heap out-of-bounds write in `WickrPro!VideoModel::storeFrame` (CWE-787). Not remotely reachable.

**Severity: Low as shipped** (latent / defence-in-depth). Would be **High** if the receive path ever
delivered planar chroma.

`WickrPro.exe 0x1406e95d0` allocates each chroma plane with **floor** division but copies with a
different rounding:

```
0x1406e9784: shr  ebx, 1              ; floor(height/2)
0x1406e97a8: imul eax, ecx            ; ALLOC_U = (height>>1) * u_stride
0x1406e97e0: imul ebx, [rbp+0x87]     ; ALLOC_V = (height>>1) * v_stride
0x1406e9838: imul ebx, r14d           ; u_stride * height
0x1406e983f: shr  r8, 1               ; COPY_U  = (u_stride*height)>>1
0x1406e9849: call memcpy              ; unconditional
0x1406e9859: shr  r8, 1               ; COPY_V
0x1406e9863: call memcpy              ; unconditional
```

For odd `height = 2k+1`: allocation `k·stride`, copy `k·stride + floor(stride/2)` ⇒ **overflow of
`floor(stride/2)` bytes, twice per frame**. The Y plane is symmetric and unaffected. The buffer-reuse
guards compare the cached capacity against the same wrong expression, so reuse does not rescue it.
Verified at the instruction level by three independent analysts.

**Reachability — measured, not assumed.** On the receiving client during a normal 2-way video call,
the sink is called ~4/s with (43/43 captured frames identical):

| arg | value | meaning |
|---|---|---|
| a3 / a4 / a5 | ptr / **0** / **0** | Y plane only; **U and V pointers NULL** |
| a6 / a7 / a8 | 1440 / **0** / **0** | strideY = 4×360; **chroma strides zero** |
| a10 | 360 | height |

`strideU = strideV = 0` makes both the vulnerable allocation and the vulnerable copy evaluate to
zero **for any height, odd or even**. The chroma arithmetic cannot overflow on the receive path.

**Why the strides are zero — and the hardening point.** WickrPro's sole video-subscribe function
requests a packed 32-bit destination colourspace:

```
0x1401514d9: mov qword ptr [rbp+0x5b8], 8     ; "destColorSpace" = 8  (BGR32)
```

`destColorSpace` has exactly **one** cross-reference in the whole executable. NPL's plane-layout
table (`NPL 0x180125290`) yields 3 planes only for colourspace values {1,2,3,6}; value 8 yields one
plane with `stride = 4·W`. NPL's own default when the key is absent is **0 — no colourspace
converter at all**, i.e. native 3-plane I420 delivered straight to this function.

> **A single hardcoded immediate is the only thing preventing a call peer from reaching a confirmed
> heap overflow.** Anyone changing that value, adding a second subscribe path, or supporting a planar
> destination format re-opens F1 as a remotely-triggerable bug.

**The attacker already controls the other operand — measured.** A camera feed is limited to standard
modes (every sample was height 360), but a **remote peer's SCREEN SHARE delivers arbitrary,
peer-chosen dimensions straight to this function**, odd ones included. Captured live at the sink
while the peer shared a window (lower 32 bits of each stack slot):

| strideY (a6) | implied width | height (a10) |
|---|---|---|
| 6376 | 1594 | **611 (odd)**, **595 (odd)**, **501 (odd)** |
| 7968 | 1992 | **661**, **701**, **801**, **975**, **1011**, **1111**, **1121**, **1109** (all odd) |
| 5044 / 3364 / 2692 | 1261 / 841 / 673 (odd widths) | 626 |

The peer simply resizes the window they share. No modified client, no crafted packets. Chroma
strides (a7/a8) remained `0` throughout, so the vulnerable arithmetic still evaluates to zero — but
the correct statement of the risk is therefore:

> **A call peer can already drive the odd-height operand of the vulnerable expression at will. The
> only thing standing between that and a heap overflow is `destColorSpace = 8` forcing the chroma
> strides to zero.** Were the destination ever planar (e.g. `destColorSpace = 1`, I420), a peer
> sharing an odd-height window would corrupt the heap on **every frame** — at the observed
> geometries roughly `stride/2 ≈ 315` bytes per chroma plane, twice per frame, at screen-share
> frame rates — with no crafting whatsoever.

This raises F1 from "latent arithmetic bug" to "one constant away from a trivially-triggered remote
heap overflow", and it is the strongest argument for fixing the arithmetic itself rather than relying
on a caller's constant.

**The chroma path is not dead code.** It executes on **every local self-preview frame** (~24–30/s for
the duration of every video call) via the camera pipeline
`InitCameraCapture 0x1406ed9d0 → PacketMonitor tap 0x1406ee760 → 0x140140ad0 → 0x14011b6b0`, with
real 3-plane I420 and non-zero chroma strides. It does not overflow only because that path's height
is even (square crop, 360/710). The one unaudited corner is the `Crop` node: if any camera mode and
crop combination ever yields an odd height, every local video call overflows.

**Remediation:** compute the allocation and the copy from one expression, using `ceil` consistently
(`ceil(h/2)·stride`), or reject odd heights at the boundary.

---

### F2 — Heap out-of-bounds write in `NPL!VpxEncoder::initEncoder` (CWE-787). Locally triggered; measured.

**Severity: Low–Medium** (memory corruption in shipped code; no remote trigger found).

`NPL.dll 0x180140690` sizes the `I420Scale` destination buffer as `(w·h·3)/2` and sets
`stride_u = stride_v = floor(W/2)` (`0x180140c87: sar eax,1`), while libyuv writes `ceil(h/2)` chroma
rows. For odd `h` the V plane runs past the allocation.

**Measured** against the *installed* `NPL.dll` with a guard-page harness:

| encode geometry | overflow |
|---|---|
| 177 × 177 | **1 byte** |
| 240 × 135 | **60 bytes** (= W/4) |
| even heights | 0 |

Odd geometries are reachable in principle because the resolution ladder `NPL 0x180164e80` is a
**truncating halve with no even alignment**: `710×710 → 177×177`, `1920×1080 → 240×135` (the
operator's own logs show `2402×999 → 1201×499`).

**No remote trigger was found.** Screen share — the one source of arbitrary odd heights — *disables*
the ladder (`screenSharing=1` zeroes the gate at `0x180140419`), so no scale buffer is allocated. The
capture-property setter `0x180142990` exposes no geometry key, and the inbound SFU/"popcorn" command
set carries only upload/download health, no resolution or quality knob. `hd_video` is a local
`QSettings` toggle.

**Remediation:** size as `W·H + 2·ceil(W/2)·ceil(H/2)` and set `stride_u/v = ceil(W/2)`.

---

### F3 — Observation: image-format plugins are resident in the unsandboxed main process

**Severity: Informational** (initial concern **not** borne out by measurement).

All twelve Qt image-format plugins are loaded in `WickrPro.exe`, the unsandboxed main process —
`qtiff` (libtiff), `qwebp` (libwebp), `qsvg` + `Qt6Svg`, **`qpdf` + `Qt6Pdf` (PDFium)**, `qjpeg`,
`qgif`, `qico`, `qtga`, `qwbmp`, `qicns` — while the sandboxed `QtWebEngineProcess` has none. Two
native call sites decode with an explicit `format = NULL` (`WickrPro 0x1400c2d41` and `0x1409f753e`,
both `xor r8d,r8d`), which would make Qt content-sniff across every plugin, letting a sender choose
which decoder parses their bytes.

**However, three successive live experiments found no decode of remote content in this process:**

| probe | scope | result |
|---|---|---|
| `imgprobe` | the two `format=NULL` call sites | 0 hits on a received link |
| `imgprobe2` | WickrPro's *imports* of `QImage::loadFromData`, `QImage(QString,fmt)`, `QPixmap::load` | 0 hits on a received photo |
| `imgprobe3` | **inside Qt6Gui**: `QImageReader::read` (any decode) + `QImageReader::imageFormat` (content sniff) | **0 hits** |

Corroborating static evidence: `WickrPro.exe` imports **no** `bits()/constBits()/scanLine()/
sizeInBytes()/bytesPerLine()/depth()` from Qt6Gui — it never touches decoded pixel memory.

**Conclusion:** attacker-supplied images are not decoded by Qt in the unsandboxed process; the
plugins are resident because Qt builds its format registry at start-up. Remote image rendering
appears to occur in the sandboxed QtWebEngine renderer, which is the correct design. The residual
recommendation is hygiene only: **drop the unused `format = NULL` call sites or pass an explicit
format**, and consider not shipping `qpdf`/`Qt6Pdf` in the imageformats directory if PDF-as-image is
not a product feature.

---

### F4 — Stale third-party inventory

Shipped versions (pinned in earlier waves; not re-verified this wave except where noted):
libvpx 1.9.0 (2020) · libjpeg-turbo 2.1.0–2.1.2 · Opus 1.3.1 · **mbedTLS 2.1.5 (2016)** + **SQLite
3.19.2** in `Sock5.dll` · expat 2.2.1–2.3.0 + **OpenSSL 1.0.x (EOL)** in `WinSparkle.dll` ·
FDK-AAC 2.0.0/2.0.1 · AWS-LC FIPS.

Two points deserve follow-up rather than assertion:
* The **codec factory `NPL 0x180122040` accepts both `vp8` and `vp9`** (3-char match). The product
  appears only ever to *send* VP8, so a peer can select a decoder the product itself never exercises.
  This is the largest remaining unexamined remote parser surface.
* Earlier waves "set libvpx aside" with **no recorded justification**. That should not be carried
  forward as a settled question.

---

### F5 — Exploit mitigations

Measured on the shipped binaries and the live process: **Control Flow Guard is absent from both
`NPL.dll` and `WickrPro.exe`** (no `IMAGE_DLLCHARACTERISTICS_GUARD_CF`); no CET/shadow stack; default
NT heap via plain `operator new`; the media and UI code runs unsandboxed in the main process.
High-entropy ASLR and `/GS` are enabled. Enabling CFG is a cheap, high-value hardening step for a
process that parses remote media.

---

## 2. What was executed and proven

1. **F1's arithmetic**, at the instruction level (three independent derivations).
2. **A harness that calls `0x1406e95d0` directly with an odd height produces an access violation
   (type WRITE), and a variant that places a controlled object adjacently overwrites its vtable
   pointer and redirects a virtual call to attacker-chosen code.**
   ⚠ **This must always be reported with the qualifier attached: the harness supplied arguments that
   the live receive path does not and cannot supply.** It demonstrates that the arithmetic is
   exploitable *if* those arguments ever become reachable — it is not a demonstration of a reachable
   vulnerability. An ASLR-surviving 2-byte partial-pointer variant was also demonstrated in the same
   harness (Windows 64 KB-aligned module bases leave the low 16 bits invariant).
3. **F2's overflow**, measured with a guard-page harness against the installed `NPL.dll`.
4. **Live receive geometry** (43/43 frames, single-plane BGR32, chroma strides zero).
5. **Live sender experiment:** the wire *can* be made to carry `kind=2` media with three
   attacker-chosen plane strides/heights (verified 3 plane entries per packet on the operator's own
   patched sender); the receiving client refuses the stream because video subscribe requires a codec
   name (`[E VideoHub(dec)] Unsupported codec (<null>)` → `Video subscribe failed. err: 1`).
6. **Mitigation posture** (F5) and the **resident-plugin inventory** (F3).
7. **Three negative image-decode probes** (F3 table).

## 3. Inferred, not measured

* That remote image rendering happens in the sandboxed QtWebEngine renderer (strongly implied by
  three negative probes plus the missing pixel-access imports, but not directly observed).
* Third-party version pins inherited from earlier waves (F4).
* That no camera/crop combination produces an odd height on the local preview path (the `Crop` node
  was not exhaustively audited).

## 4. Refuted — hypotheses that did **not** survive

| Hypothesis | Outcome |
|---|---|
| `0x1406e95d0` is reachable from a call peer | **No.** Sealed by `destColorSpace = 8`; measured chroma strides are zero. |
| The chroma path is dead code / never executes | **No.** It runs on every local self-preview frame with real 3-plane I420. |
| A peer can announce a raw I420 format and bypass the decoder | **No.** Subscribe requires a `vp8`/`vp9` codec name; a codec-less raw stream is rejected before any media flows. |
| The other two `storeFrame` call sites are an independent geometry source | **No.** Qt moc boilerplate, zero callers. |
| Screen share supplies an odd height to the encoder scaler | **No.** Screen share disables the resolution ladder. |
| A peer can steer the encoder's resolution rung | **No.** No geometry or quality knob in the inbound command set. |
| Attacker images are decoded by content-sniffing in the unsandboxed process | **No.** Three probes, zero hits. |
| An app-side `w·h·bpp` image-sizing bug exists in WickrPro | **No.** The app never touches decoded pixels. |
| CVE-2023-5217 applies (carried from an earlier wave) | **Withdrawn.** It is a VP8 *encoder* bug on the send path, and the sole `vpx_codec_enc_config_set` call never changes `g_threads`. |

Also closed with evidence: a second `destColorSpace` chooser (does not exist); colourspace-converter
bypasses yielding 3 planes (both require `in.cs == 8`, which is single-plane); the same
floor/ceil allocation defect elsewhere (two independent detectors over every `.pdata` function in
both binaries found exactly one true positive — F1); NPL on the P1 message path (all 96 imported
exports are AV/transport); QZXing3 (encode-only).

## 5. Recommended next steps for the vendor

1. Fix F1 and F2 as described; both are one-line size expressions.
2. **Enable CFG** on `NPL.dll` and `WickrPro.exe`.
3. Treat `destColorSpace = 8` as a security-relevant invariant: add a bounds/parity check inside
   `storeFrame` so the guarantee does not rest on a caller's constant.
4. Refresh the vendored third-party bundles (F4), starting with `Sock5.dll` (mbedTLS 2.1.5, SQLite
   3.19.2) and `WinSparkle.dll` (OpenSSL 1.0.x, expat 2.2.x).
5. Consider rejecting `vp9` at the subscribe codec gate if the product never publishes VP9, removing
   a peer-selectable decoder that is otherwise never exercised.
6. Remove or pin the `format = NULL` image decode call sites (F3).

## 6. Suggested next steps for a follow-on assessment

Ranked by evidence-per-effort:
1. **libvpx VP8/VP9 decoder** — the only surface where an unmodified peer feeds fully
   attacker-controlled bytes into a large C parser in an unsandboxed, CFG-less process. Pin the exact
   revision, diff against upstream for decoder fixes since 1.9.0, then fuzz the decoder entry.
2. **The `Crop` node** on the local capture path — does any camera mode yield an odd height (F1)?
3. **WinSparkle update transport** — is the appcast fetched over pinned HTTPS? The XML is parsed
   before any signature check.

---

## Artifacts

`E:\tmp\wickr\scratch\w3\lead\` — `repro.c` (F1 harness crash), `pcdemo.c` / `pcdemo_partial.c`
(harness PC-control, ASLR-surviving variant), `probe_sites_loader.c` / `probe_sites2_loader.c`
(passive hit counters), `recon3..6_loader.c` (send-path argument capture), `rawpub2_inject.c`
(sender-side raw-I420 + forged geometry experiment), `victim_recon.c` (receive-sink argument
capture — produced the F1 reachability measurement), `imgprobe.c` / `imgprobe2.c` / `imgprobe3.c`
(the three negative image-decode probes), `disfunc.py` / `disfunc_pro.py` (per-function
disassemblers). Supporting analysis in `E:\tmp\wickr\desktop\notes\`.

All instrumentation is external (`WriteProcessMemory`), verifies target bytes before patching,
refuses on mismatch, and restores on exit.
