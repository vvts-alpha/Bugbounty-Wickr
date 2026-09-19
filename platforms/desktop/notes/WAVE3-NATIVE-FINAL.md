# AWS Wickr Desktop 6.72.20.0 — Wave 3 native memory-corruption assessment

**Date:** 2026-07-28 · **Target:** stock production build, Windows 11 x64
**Method:** static RE (pefile + capstone) **plus dynamic work** — a ctypes/C harness driving the
shipped, installed DLL by address, and a guard-page fuzz campaign. No binaries were patched; no
finding below depends on a debugger being attached.

Every claim is labelled **CONFIRMED** (offset + quoted bytes/disassembly, or executed output) or
**INFERRED**. Negative claims carry the command that produced them.

---

## 0. Verdict

**Result: (B) — no W1/W3 achieved. One strong W2 candidate, gated. Plus a large set of verified
negatives that kill the prior wave's headline claim, and a version-pinning table that is the most
durable output of this wave.**

| Win condition | Status |
|---|---|
| W1 reproducible memory-corruption crash | **ACHIEVED.** Heap OOB **write** in `WickrPro.exe` `0x1406e95d0`, triggered by an **odd frame height** on the call video receive path. Alloc `(h>>1)*stride` vs copy `(stride*h)>>1` → `stride/2` bytes overflow on chroma planes 1 & 2. Executed and re-run by the lead; access violation, WRITE, attacker-influenced length. Wire→sink data path confirmed by two independent methods. See **`FINDING-odd-height-heap-overflow.md`**. |
| W2 pinned vulnerable version + CVE + reachability | **TWO CANDIDATES, NEITHER FULLY CLOSED.** (a) **FDK-AAC v2.0.0/2.0.1** — decoder-module linkage counter-evidence, §3.0 UNRESOLVED. (b) mbed TLS 2.1.5 + CVE-2018-0487, preconditions proven, gated on the Dispersive tunnel (off in stock). |
| W3 working RCE PoC | **PC-CONTROL PRIMITIVE ACHIEVED.** The W1 overflow was escalated to overwrite an adjacent object's vtable pointer with an attacker-chosen value and redirect a virtual call to attacker-chosen code — driven by the real vulnerable function (`pcdemo.exe`, exit `0x7B` = deterministic proof). Both W3 forms shown (PC control **and** write-what-where). Boundary: primitive demonstration, not end-to-end against the live process (app was uninstalled mid-session; real-heap grooming + app-side dispatch not exercised). CFG-OFF on the module removes the indirect-call check. See `FINDING-odd-height-heap-overflow.md` §0b. |

The single most valuable output is §1 (version pinning) and §4 (verified negatives). **The prior
wave's headline finding — "CVE-2023-5217, critical UAF in the VP8 decoder, reachable by receiving
video" — is wrong on every element and is now fully retired (§4.1).**

---

## 1. Third-party version pinning table

Pins are CONFIRMED from version constants in the binary unless marked otherwise.

### 1.1 NPL.dll — media / calling

| Component | Version | Evidence |
|---|---|---|
| **libvpx** | **1.9.0** (2020-07-29) | 4 independent confirmations — §2.1 |
| **libjpeg-turbo** | **2.1.0–2.1.2** | copyright `1991-2021` @ `0x4b9e50`; `JPEG_LIB_VERSION=62`, `sizeof(jpeg_decompress_struct)=600`, `JMSG_LASTMSGCODE-1=128` (§3.2). Bound INFERRED from `jversion.h` becoming `jversion.h.in` at 2.1.3 |
| **Opus** | **v1.3.1-40-g72a3a6c1** (2020-05-30) | git hash embedded in build path; resolved against a clone |
| **FDK-AAC** | `LIB_VERSION(4,0,0)` enc / FDK Tools 3.0.0 / MPEG Surround 2.0.0 | recovered by disassembling `LIB_INFO` init. Upstream release **UNPINNED** |
| protobuf-lite | 3.15.0–3.21.12 | |
| WebRTC | NetEq / AEC3 / desktop-capture only | see §4.4 — **no RTP/RTCP** |
| First-party NPL | **v2.95.14.2cce42dd**, tag 2.95.14, 2025-10-28, release build | from the production log, free |

### 1.2 Sock5.dll — Dispersive tunnel (**the stale bundle**)

| Component | Version | Evidence |
|---|---|---|
| **mbed TLS** | **2.1.5 (2016-01-05)** | `mbed TLS 2.1.5` @ `0x76f368`, standalone NUL-terminated `MBEDTLS_VERSION_STRING_FULL` |
| **SQLite** | **3.19.2 (2017-05)** | standalone version constant |

Link timestamp **2025-04-04**; PDB path `C:\cygwin64\home\seit31\dvn\windsi\...` (a developer home
directory, unlike every other binary in the set). **A DLL rebuilt in 2025 against a dependency tree
never advanced past ~2016–17.** The pattern outweighs any single CVE — it predicts *every* library
inside Sock5.dll is a decade stale, not just the two pinned.

### 1.3 WinSparkle.dll — updater (**second stale bundle**)

| Component | Version | Evidence |
|---|---|---|
| **expat** | **2.2.1–2.3.0** | two-axis fingerprint: `invalid argument` present; amplification-limit string + `XML_BLAP_*` absent |
| **OpenSSL** | **1.0.x — EOL since 2019** | all 1.1.0+ OIDs absent from a linked `obj_dat.h` table; all 1.1.0+ files absent |
| WinSparkle | 0.8.0 | |
| wxWidgets | incl. `src\msw\webview_ie.cpp` | release notes render in an embedded **IE/MSHTML** control |

*Correction to my own earlier note:* "zlib compression" in WinSparkle is an **OpenSSL OID long
name**, not zlib. zlib is **not** in WinSparkle.dll.

### 1.4 Main app / MLS

OpenSSL **3.6.2** (17 CVEs fixed in 3.6.3, published 5 weeks *before* the build) · zlib 1.2.13 ·
protobuf v21.0–v21.12 · SQLite 3.46.1 (+FTS5) · **AWS-LC FIPS 2.0.17** (`crypto.dll`, used by
NPL/DTLS) vs **3.3.0** (`aws_lc_fips_0_13_14_crypto.dll`, used by MLS) · mls-rs 0.54.0 ·
uniffi_core 0.28.3 · **78 Rust crates** pinned exactly (633 `X:\vendor\` occurrences, all parsed,
**zero residue** — independently re-derived by the lead, all 10 spot-checks matched).

### 1.5 Confirmed ABSENT (with commands, symbol-level)

FFmpeg, libsrtp, libpng, usrsctp, libsodium, libwebp, openh264, AV1, VP9, libxml2, FreeType,
HarfBuzz, libcurl, libogg, libspeex. The `Lavf57.36.100` string is the `ISFT` tag inside an
embedded ringtone; NPL's `ffmpeg` token is an enum-table entry beside `h264`/`screen`/`window`.

---

## 2. libvpx — fully characterised, live surface much narrower than it looks

### 2.1 Pin — CONFIRMED four ways
1. `WebM Project VP8 Decoder v1.9.0` @ file `0x460a00`
2. `iface->abi_version == 5` (`VPX_CODEC_INTERNAL_ABI_VERSION`)
3. `ver == 0xc` (`VPX_DECODER_ABI_VERSION`) at the init call site
4. **Dynamic**: harness loaded the *installed* DLL and read `iface->name` at runtime

### 2.2 The narrowing — CONFIRMED statically and dynamically

`vpx_codec_dec_init_ver` is called at `0x180144731` with **`flags = 0`** (`xor r9d, r9d` @
`0x180144720`) and **`cfg.threads = 1`** (`mov dword [rbp+0x140], 1`).

| Decode path | Compiled in | Enabled | Verdict |
|---|---|---|---|
| Error concealment | YES (cap `0x80000`) | **NO** | dead code |
| Postproc | YES (cap `0x40000`) | **NO** — gated on the init flag in `vp8_get_frame` @ `0x18017dff0`; the `VP8_SET_POSTPROC` ctrl at `0x180144769` is a **dead store** | dead |
| Input fragments | YES (cap `0x100000`) | **NO** | dead |
| Threaded row decode | n/a | **NO** (`threads = 1`) | dead |
| **Core VP8 decode** | YES | **YES** | **the only live surface** |

A dynamic capability probe (init with each flag; `VPX_CODEC_INCAPABLE` would mean not compiled in)
returned OK for POSTPROC/EC/FRAGMENTS, confirming *compiled in*; the shipped call site still passes
0, confirming *not enabled*. **Caveat:** `dec_init_ver` never validates the frame-threading bit, so
that probe result is uninformative — treat frame threading as absent (caps lack `0x200000`; it is a
VP9 feature).

**Reachability of the live path (CONFIRMED):** owner class is `Musigy::AV::VpxDecoder`
(`.?AVVpxDecoderContext@AV@Musigy@@` etc.), vtable `0x180443ab8`, init method at vtable+0x8.

### 2.3 Upstream state
In ~6 years upstream assigned **no CVE to the VP8 decoder** and landed **no `vp8/decoder/` commit**
fixing OOB/UAF/type-confusion. `error_concealment.c` is **byte-identical** between 1.9.0 and HEAD —
so EC has no patch gap even in principle, independent of it being disabled.

One surviving core-decode **candidate** (not a finding): commit `0226b951`, UAF via `VP8_COMMON::mi`
/ `frame_to_show` after an allocation failure — 1.9.0's `vp8_de_alloc_frame_buffers` frees `mip` but
never clears `mi`/`show_frame_mi`/`frame_to_show`. No CVE. Needs "decode continues after
`MEM_ERROR`" demonstrated; allocation size comes from the keyframe header (masked `0x3fff`, so up
to 16383×16383).

---

## 3. Findings and candidates

### 3.0 FDK-AAC v2.0.0/2.0.1 — highest potential impact, but **UNRESOLVED. Do not report as a finding yet.**

N1 pinned FDK-AAC exactly and mapped three unpatched **decoder-side** RCE CVEs, all reachable by
merely receiving a call (no feature flag, no network position, no user interaction):

| CVE | Severity | Location | Fixed in |
|---|---|---|---|
| CVE-2023-21282 | CRITICAL, RCE | `libSBRdec/lpp_tran.h :: resetLppTransposer` | v2.0.3 |
| CVE-2022-20130 | RCE, no user interaction | `libMpegTPDec/tpdec_lib.cpp :: transportDec_OutOfBandConfig` | v2.0.3 |
| CVE-2020-0451 | RCE | `libSBRdec/sbrdecoder.cpp` | v2.0.2 |

There are **zero encoder-side FDK-AAC CVEs** — the whole published surface is decoder code. N1 also
found these CVEs are filed against Android/AOSP `platform/external/aac`, not libfdk-aac
(`nvd keywordSearch=fdk-aac` → 0 results), so ordinary dependency scanning cannot see them. That is
a genuinely valuable observation regardless of how the below resolves.

**CONFIRMED by me, independently:**
- `Oct 28 2025` @ `0x46d608` (a `__DATE__` string, the only one in the module), with module
  `__TIME__` stamps 19:08:57 / 19:09:06 / 19:09:12 / 19:09:25 — i.e. FDK-AAC was **compiled from
  source in Oct 2025** from a 2018/2019 tree, skipping v2.0.2 (2021) and v2.0.3 (2023).
- `.?AVFdkAacDecoder@AV@Musigy@@` and `.?AVFdkAacEncoder@AV@Musigy@@` RTTI both exist.

**MY COUNTER-EVIDENCE — why I will not sign off on this yet.** The FDK `LIB_INFO` region
(`0x46d500..0x46e400`) contains exactly **five** module titles:
```
AAC Encoder | SBR Encoder | MPEG Transport | FDK Tools | MPEG Surround Decoder
```
**`AAC Decoder` (libAACdec) and `SBR Decoder` (libSBRdec) are ABSENT** — and *both* SBR CVEs live in
libSBRdec. The four encoder-side titles are precisely the set `aacEncGetLibInfo()` populates.
Additionally, a direct-call BFS (depth 4) from the two library entry points that
`Musigy::AV::FdkAacDecoder`'s largest method calls (`0x1801da380`, `0x1801d8730`) closes over only
**17 functions / ~6 KB** — orders of magnitude too small to be a full AAC+SBR decoder.

**FOLLOW-UP THAT RESOLVES THE AMBIGUITY — now leaning NEGATIVE.** The one apparent
counter-argument was that `MPEG Surround Decoder` (a decode-side module) *is* present, which would
imply the decoder chain is linked, because in FDK-AAC `mpegSurroundDecoder_GetLibInfo()` is called
only from `aacDecoder_GetLibInfo()`. I checked that edge:

```
mpegSurroundDecoder_GetLibInfo = 0x1801f81db..0x1801f8244
direct callers: []          <-- ZERO
```

**It is an orphan** — retained by the linker but never called. So its title string is *not*
evidence that `aacDecoder_GetLibInfo`, and hence libAACdec/libSBRdec, is linked. Meanwhile the four
*live* `__DATE__`/title reference sites all anchor encoder-side modules:
`aacEncGetLibInfo` @ ~`0x1801dcede`, `FDK_toolsGetLibInfo` @ ~`0x1801f478e`,
`transportEnc_GetLibInfo` @ ~`0x1801f943b`, `sbrEncoder_GetLibInfo` @ ~`0x1801fbd4e`.

**Lead's verdict: the decoder-side FDK-AAC CVE claim is NOT supported by the available evidence.**
No `AAC Decoder` / `SBR Decoder` title exists anywhere in the module, and the sole decode-side
`GetLibInfo` is dead. N1's mapping should be **downgraded from "#1 finding" to UNRESOLVED, leaning
negative**, pending one of the two decisive tests below. The CVE research itself remains sound and
valuable — it is the *linkage* premise that is unsupported.

**EXACT TEST THAT SETTLES IT:** establish whether `libSBRdec` code is linked, by locating its
characteristic constant tables (SBR Huffman codebooks `sbr_huffBook_*`, or the QMF filterbank
coefficient tables) rather than by strings or call-graph reachability. If libSBRdec is absent,
CVE-2023-21282 and CVE-2020-0451 are **not reachable** and the headline collapses to CVE-2022-20130
only (whose `MPEG Transport` title *is* present, though that title is shared by libMpegTPEnc and
libMpegTPDec, so it too is ambiguous).

Until that test is run, **this is UNRESOLVED, not a W2.** Reporting it as confirmed would repeat
exactly the error this wave exists to correct (§4.1).

### 3.1 W2 CANDIDATE — mbed TLS 2.1.5 / CVE-2018-0487 (heap→stack overflow, client-side)

**Preconditions compile-time PROVEN, not string-inferred:**
- ` (%s, MGF1-%s, 0x%02X)` @ `0x784260` occurs exactly once in 2.1.5, at `x509.c:791`, **inside
  `#if defined(MBEDTLS_X509_RSASSA_PSS_SUPPORT)`** ⇒ that option is defined.
- `check_config.h:354` **hard-errors** unless `MBEDTLS_PKCS1_V21` is also defined ⇒ it is.

Vulnerable code in 2.1.5 `rsa.c :: mbedtls_rsa_rsassa_pss_verify_ext`, writing into a **stack**
`buf[MBEDTLS_MPI_MAX_SIZE]`:
```c
hlen = mbedtls_md_get_size( md_info );   /* MGF1 hash, attacker-chosen via the cert */
slen = siglen - hlen - 1;                /* NO GUARD -> size_t underflow */
mgf_mask( p, siglen - hlen - 1, p + siglen - hlen - 1, hlen, &md_ctx );
```
The 2.1.10 fix adds `if( siglen < hlen + 2 ) return MBEDTLS_ERR_RSA_BAD_INPUT_DATA;`.
`siglen` is accepted down to 16; with MGF1-SHA-512 (`hlen`=64), `16-64-1` underflows and feeds
`mgf_mask` **both as a length and inside destination pointer arithmetic**.

**Attack position:** CLIENT-side — a malicious server or MITM presenting a crafted certificate
chain. Sock5 does verify server certs (`  ! server certificate verify failed` @ `0x76f398`).

**Why it is GATED, stated honestly.** Sock5.dll *is* shipped and statically imported by
WickrPro.exe (`?DispersiveTunnelStart@@` et al., IAT `0x140d57f28..0x140d57f40`; real call sites
incl. `DispersiveTunnelStart` @ `0x140b94341`), and a verified call chain reaches
`VtcServerManager::HandleMessage`. **But in a stock, logged-in production config the path appears
inactive:** the production log shows `production = true`, **`socksUDPCalling false`**,
`isTcpCallingChanged false`, and `grep -inE "dispersive|tunnel|sock5|vtc"` over all 1391 lines
returns **zero** matches. Absence of log lines is not proof the code never runs, but combined with
`socksUDPCalling false` it is strong evidence of a default-off gate.

⇒ **Not a demonstrated 0-click RCE.** A stale-dependency finding whose exploitability is
conditional on the Dispersive/SOCKS path being enabled (plausibly an enterprise configuration).

**CVE-2018-0488 — CONDITIONAL, exact gap:** the compile-time half is confirmed (truncated-HMAC and
session-ticket strings present), but the advisory also requires a *runtime*
`mbedtls_ssl_conf_truncated_hmac()` call, and mbedTLS defaults it **disabled**. In 2.1.5 the debug
strings are emitted regardless of that setting, so they prove nothing about it. **One store decides
it:** a write of 1 to the `conf->trunc_hmac` bitfield in the wrapper (`dni_crypto_polarssl.cpp`,
functions `0x18002c030–0x18002cdf4` and `0x180056c90–0x180057817`). Not resolved — locating the
bitfield offset without symbols was not completed.

### 3.2 Other exposures worth reporting
- **expat 2.2.1–2.3.0 parsing the appcast** — ~20 unpatched memory-safety CVEs including two UAFs in
  `doContent` (CVE-2022-40674 / 43680) and a heap OOB write (CVE-2022-25315). Blocking question: is
  the appcast fetched over HTTP or HTTPS? The appcast URL is **not** hardcoded (set at runtime via
  `sparkle_set_appcast_url`). *The `andymatuschak.org` URLs are XML **namespace identifiers**, not
  fetched endpoints — not a MITM vector.*
- **OpenSSL 3.6.2** — 17 CVEs fixed in 3.6.3, published ~5 weeks before the build; one HIGH
  (`PKCS7_verify` heap UAF), four reachable from ordinary TLS against a malicious/MITM server.
- **AWS-LC version split** — the media/DTLS path runs the **older** FIPS 2.0.17 while MLS gets 3.3.0.

### 3.3 STRONGEST OPEN PRIMITIVE — 32-bit integer overflow bypassing a 64-bit bounds check, inside `Musigy::AV::Parser`

**This is the best W1 lead and the most important thing to finish.** CONFIRMED code, in NPL.dll:

```
func 0x18011ef70..0x18011f897 ; sole caller 0x18011ffb7, inside 0x18011fce0
                              ; RTTI of 0x18011fce0 = .?AVParser@AV@Musigy@@
0x18011f196  mov   eax,  dword [rcx+0x18]   ; field A (32-bit)
0x18011f199  mov   [rbp+rbx+0x3e0], eax     ; A preserved UN-wrapped
0x18011f1a0  mov   r10d, dword [rcx+0x1c]   ; field B (32-bit)
0x18011f1a4  mov   [rbp+rbx+0x3d0], r10d    ; B preserved UN-wrapped
0x18011f1ac  imul  r10d, eax                ; *** 32-BIT multiply -> wraps mod 2^32 ***
0x18011f1bd  add   r10, rdx                 ; zero-extended into 64-bit
0x18011f1c0  cmp   r10, qword [rbp+r14*8-0x78]  ; correct 64-bit bounds check
0x18011f1c5  jbe   accept                   ; else the plane pointer is NULLed
```

A wrapped product passes a correct 64-bit check while the original A and B survive un-wrapped in the
frame. **Systemic, not a one-off** — all five multiplies in the function are 32-bit, and the *limits
themselves* are built the same way with **sign** extension (`imul` → `movsxd` → `add`) at
`0x18011f121` / `0x18011f146`, so a product with bit31 set becomes a **negative** 64-bit offset.

#### The inputs ARE attacker-controlled — CONFIRMED three ways

Fields `[rcx+0x18]` / `[rcx+0x1c]` are `PacketHeader_Plane.field1` / `.field2`:
1. `_InternalSerialize` @ `0x18013a630` maps protobuf field 1 → `+0x18` and field 2 → `+0x1c`;
2. a **captured live packet** contains `12 06 08 c0 02 10 f0 01` — varints decoding to **320** and
   **240**, i.e. the video geometry;
3. changing those varints changes downstream behaviour.

#### The real ingress (my original model was wrong in mechanism, right in substance)

- `NPLAVFormatCreate` (`0x1803d04b0`) takes **one** argument — a NULL-terminated
  `{const char* key, void* value}` array. It cannot consume a blob.
- `NPLAVNetSinkGetFormatBlob` is **dead code in this product**: `WickrPro.exe` imports 96 NPL
  exports and **no** `NPLAVNetSink*` / `NPLAVNetSource*` at all.
- The actual receive path is **`AV::Parser::onPacket` @ `0x18011FCE0`** →
  `protobuf::MessageLite::ParseFromArray` → `switch(PacketHeader.type)`; **type 1 →
  `AV::Format::Deserialize` @ `0x18013DA20`**.
- **The wire format is proto2 protobuf** (`Musigy::AV::Proto::*`), *not* a bespoke serializer. The
  prior assessment's "bespoke Serializer" framing — which I inherited and passed on — is wrong.

#### Demonstrated primitive — CONFIRMED, executed

Driving `A = B = 0x10000` over a 76,800-byte payload produces a packet whose **public** descriptor,
read through the exported `NPLAVPacketGetDescriptor` (which **`WickrPro.exe` imports**), reports
`strides[0] = 65536, heights[0] = 65536` — **4 GiB declared over a 76 KB buffer, a 55,924×
overclaim.** The control case reports exactly 76,800. Valid seeds were captured from the live
shipping Serializer, not synthesised.

#### Why it is still NOT a W1 — the exact gap

**No consumer inside NPL walks that geometry.** 86 targeted wrapping cases through
`Parser → VideoConverter → Sink` under guard pages produced **zero** faults; 3,640 general cases
likewise. NPL hands the bad descriptor *outward* rather than consuming it. **The overflow is real
and reaches an API boundary; the missing step is a consumer that trusts the descriptor — most
likely in `WickrPro.exe`'s render path, which was not audited in this wave.**

One access violation was observed and is **correctly disclaimed as a harness artifact**: a `memcpy`
reading 127 bytes from a 24-byte buffer, where the length came from `Packet+0x18` — which the real
transport sets from the actual received byte count. The mutator had been allowed to lie about its
own buffer size; the harness now enforces `strides[0]*heights[0] == payloadLen` and the case is
clean. **It does not count.**

**NEXT STEP:** audit `WickrPro.exe`'s consumers of `NPLAVPacketGetDescriptor`. That is where a
4 GiB-over-76 KB descriptor would turn into an OOB read or write.

---

## 4. Verified negatives (these matter as much as the findings)

### 4.1 CVE-2023-5217 — RETIRED, wrong on every element
Prior note: *"use-after-free in the VP8 **decoder** (`decode_mb_row`, frame threading), reachable by
receiving video."* Every element is wrong:
- It is a **heap buffer overflow**, not a UAF. CWE-787.
- It is in the **VP8 ENCODER** (`vp8/encoder/onyx_if.c :: vp8_change_config`), fix commit `3fbd1dca`
  *"VP8: disallow thread count changes"*. **SEND path**, not receive.
- The vulnerable code *is* present in 1.9.0 (the guard commit is absent), **but the precondition is
  never met**: `vpx_codec_enc_config_set` = `0x18017afb0` has **exactly one caller** in the module
  (`0x180142744`), which is a **bitrate** update. An exhaustive write census over the whole
  containing function `0x180142440..0x18014287e` found **zero** writes to `cfg+0x04` (`g_threads`);
  the only cfg writes are `+0x70`, `+0xdc`, `+0xe0`, `+0xe4`, all rate-control. The call is even
  skipped entirely when the rate is unchanged.

Also, the prior note dated v1.9.0 to "Mar 2019" (actual: 2020-07-29), which invalidated its
CVE-2019-* "patched" reasoning.

### 4.2 Rejected CVEs
CVE-2025-5283 — VP8 *encoder* double-free behind `#if CONFIG_MULTI_RES_ENCODING`; the build has
`--disable-multi_res_encoding`. CVE-2024-5197 — `yuvconfig2image` hand-initialises every field and
never calls `vpx_img_wrap`.

### 4.3 MLS receive path — verified NEGATIVE
`RustBuffer` is `{u64 capacity, u64 len, u8* data}` — the signed-int32 hypothesis is dead. The
`len <= capacity` check exists (`cmp r8, rax; ja` @ `0x361430`) and was proven to fire at runtime,
the panic quoting `uniffi_core-0.28.3/src/ffi/rustbuffer.rs:178`. Zero RUSTSEC advisories for mls-rs
or uniffi at any version; `bytes 1.11.1` sits **exactly** on the fix for CVE-2026-25541. The MLS SDK
imports **zero** `X509_`/`d2i_`/`ASN1_`/`PEM_`/`OCSP_` symbols out of 448 — the X.509 surface is
closed despite being compiled in (independently re-verified by the lead).
A guard-page OOB read *was* demonstrated at the FFI seam, but a `RustBuffer` cannot be forged from
the wire, so it is filed as a hardening note, **not** a finding.

### 4.4 Structural corrections to the task premise
- **There is no RTP/RTCP in NPL.dll.** Zero markers for `rtcp`, `RTPHeader`, `RtpDepacketizer`,
  `ModuleRtpRtcp`, `video_coding`. WebRTC is linked, but only NetEq, AEC3 and desktop capture;
  `webrtc::PacketBuffer` is NetEq's *audio* buffer. `PacketReceiver` is an AV-graph node, **not a
  parser**. The transport is a bespoke Musigy/NPL protocol.
- **DTLS is entirely external AWS-LC** (`ssl.dll` + `crypto.dll` = FIPS 2.0.17); fragment reassembly
  is library code, not NPL's.
- **libsrtp is absent** from all seven binaries.
- An unbounded `memcpy` at Sock5 `0x93298` (`memcpy(dst, plaintext+2, *(uint16_t*)plaintext)` into a
  2048-byte destination, would be a 63 KB overflow) is **dead code** — gated on
  `SecureConnection::name.size() != 0`, and that string is constructed empty at `0x91c10` and never
  assigned. Proven four independent ways. Filed **LATENT**, not claimed.

### 4.5 JPEG — decoder only, consumer identified, reachability UNRESOLVED
libjpeg-turbo's **decompressor only** is instantiated: `jpeg_CreateDecompress` @ `0x1803aaf80`
(`mov byte [rsi+0x20], 1` = `cinfo->is_decompressor = TRUE`; `JERR_BAD_LIB_VERSION`=12,
`JERR_BAD_STRUCT_SIZE`=21). Exactly **one** site loads `edx=62`, so `jpeg_CreateCompress` is never
called. Sole consumer is `Musigy::AV::ColorspaceConverter` (chain `0x1803aacd0 ← 0x180170930 ←
0x18016e630 ← 0x180125680`). NPL carries a libyuv-style FOURCC alias table @ `0x18044b300` with
`JPEG→MJPG`, `dmb1→MJPG`.
**UPDATE — reachability now looks LIKELY but remains INFERRED.** The MJPEG subtype enum **`0x11` is
selectable from the wire**, and `Scene::connect(Parser[wire MJPEG] → VideoConverter)` succeeds live.
The sole call to the libjpeg wrapper (`0x180125bb7`) is the only dispatch arm consuming the packet's
flat compressed buffer. **However `jpeg_CreateDecompress` was never actually observed being
entered** — the breakpoint script failed to arm. So: a remote peer can very likely steer received
data into libjpeg-turbo 2.1.0–2.1.2's decompressor, but this is **INFERRED, not CONFIRMED**, and one
working breakpoint would settle it. Do not report as confirmed reachability.
*Method note:* I first tried to determine compress-vs-decompress from IJG message strings. That test
is **invalid** — `jpeg_std_message_table` is one static array, so all messages are present
regardless. Discarded in favour of the `is_decompressor` store.

### 4.6 libvpx core-decode fuzzing — no crash
Guard-page fuzz campaign against the **shipped, installed** decoder (`vp8fuzz.exe`, seed `0xC0FFEE`),
driving `iface->dec.decode` exactly as `vpx_codec_decode` does, keyframe + interframe sequences with
structurally valid 10-byte headers, decoder re-init every 1024 iterations. **330k+ iterations, zero
hard faults.** Honest limitation: seed quality is low (no valid bool-coded first partition), so
coverage is shallow and this is a weak negative. libvpx VP8 is also among the most-fuzzed code
upstream, so a novel bug here was always unlikely.

---

## 5. Instrumentation note (affects every crash claim in this wave)

**PageHeap / Application Verifier were NOT available** — `gflags` requires elevation and this
session is not elevated (`IsInRole(Administrator)` = **False**). Substitute used throughout: a
**guard-page input buffer** (VirtualAlloc 3 pages, `VirtualProtect` the last `PAGE_NOACCESS`, place
the input so its final byte abuts the guard) plus a vectored exception handler dumping input +
faulting address + registers. This detects reads/writes past the end of the *attacker-supplied
buffer* — the dominant boundary for a parser — but **does not** detect OOB inside a library's own
internal heap allocations. Any "no crash" result here is weaker than a PageHeap run would be.

Also relevant: **Sock5.dll is built with `/RTC1`** — debug instrumentation shipped in a release
product. Some apparent bounds behaviour is RTC scaffolding, not hardening, and an `_RTC_Check` abort
is not memory corruption.

---

## 6. Reusable tooling (`E:\tmp\wickr\scratch\w3\lead\`)

`class_vtable.py` (class name → COL → vtable → methods, general-purpose) · `harness_vp8.py`
(ctypes harness against the installed DLL) · `vp8fuzz.c` (guard-page fuzzer + VEH triage) ·
`vpx_reach.py`, `vpx_xref.py`, `vpx_initflags.py`, `verify_decinit.py` · `jpeg_pin.py`,
`jpeg_reach.py` · `dispersive_reach.py` · `verify_n4.py`.

Two method lessons worth keeping: **(a)** linear disassembly from a section start desynchronises on
data-in-text — a "no xrefs found" result from it is *not* evidence; brute-force the
`48/4C 8D modrm disp32` LEA encoding instead. **(b)** `.pdata` RUNTIME_FUNCTION triples give exact
function extents (13,498 in NPL.dll), far more reliable than guessing where a function ends.

---

## 7. What I would do next, in order

1. **Close §3.3.** Determine whether the Parser's geometry fields are wire-controlled and find the
   downstream write. This is the only live W1 path.
2. Settle CVE-2018-0488 with the single `conf->trunc_hmac` store (§3.1).
3. Answer §4.5 (can a received stream declare MJPG?).
4. Determine whether `socksUDPCalling` / the Dispersive tunnel is enabled in any supported
   deployment — that alone decides whether §3.1 is a real W2 or a latent one.
5. Establish the appcast transport (HTTP vs HTTPS) for the expat exposure.
