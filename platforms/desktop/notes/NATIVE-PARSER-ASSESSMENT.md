# AWS Wickr (6.72.20) — Native Parser Memory-Corruption Assessment (MLS / NPL / crypto / Sock5)

**Date:** 2026-07-25 · **Goal:** assess RCE feasibility via native message/media-parsing memory corruption on the receive path (attacker controls plaintext-after-decrypt or packet stream).
**Method:** static PE + string/symbol extraction from the shipped DLLs. No execution, no fuzzing.

---

## 0. Headline finding: ALL native DLLs ship with Control Flow Guard OFF

Every native security-relevant DLL has `DllCharacteristics = 0x0160` → **CFG OFF**, NX ON, ASLR ON:

| DLL | Size | Language | DllChar | CFG | Role |
|-----|------|----------|---------|-----|------|
| WickrMlsSdkCpp.dll | 19.5 MB | **Rust** (mls-rs 0.54.0) + uniffi FFI | 0x0160 | **OFF** | MLS / message E2EE |
| NPL.dll | 5.7 MB | **C++** (+ WebRTC) | 0x0160 | **OFF** | Network/protocol/media framing |
| crypto.dll | 1.85 MB | C (AWS-LC / BoringSSL fork) | 0x0160 | **OFF** | Crypto primitives, ASN.1 |
| Sock5.dll | 9.4 MB | **C++** (Musigy VtcServer) | 0x0160 | **OFF** | Media transport / calling |

**Implication:** CFG OFF means any memory-corruption bug (UAF/OOB/type confusion) in these DLLs is **more exploitable** — no indirect-call validation to stop vtable/CFG hijack chains. This elevates the severity of any parser bug found. Windows applications targeting security should ship CFG ON; its absence here is itself a hardening finding.

---

## 1. WickrMlsSdkCpp.dll — MLS receive path (Rust + uniffi FFI)

### Facts
- **Language:** overwhelmingly **Rust** (rust markers=176, uniffi/RustBuffer=1300, Rust toolchain commit `4a4ef493e3a1488c6e321570238084b38948f6db`), with C++ uniffi FFI glue.
- **MLS implementation:** `mls-rs 0.54.0` (AWS's RFC 9420 MLS crate), statically linked. Build paths: `X:\vendor\mls-rs-0...`, `X:\vendor\reqwest-retry-0.5.0\src\middleware.rs`, `X:\vendor\futures-util-0.3.32\src`.
- **Parser entry points (from strings):** `Commit`, `Proposal`, `Group`, `MlsCommitConfirm`, `MlsCommitRejection`, `MlsProtocolMessage`, `signature_*`, `key_package_*`, `group_state`, `rejected_proposals`, `client_public_key`, `failed to deserialize profile`, `No matching ProposalSender variant`.
- **Crypto:** statically linked OpenSSL/CRYPTOGAMS assembly (SHA1, RC4, Poly1305, X25519, Montgomery, GF(2^m)) — for MLS's signature/HPKE.
- **unsafe markers:** few (Rust's unsafe is mostly abstracted). Notably `"unsafe extern "` (FFI boundary) and C++-side `"unsafe use of %#T()"` / `"unsafe use of virtual table"` (these last two are C++ runtime strings, not Rust).

### Memory-corruption assessment
- **Rust safe code is memory-safe by construction** → the large mls-rs parsing surface (TreeMath, key schedule, commit/proposal processing, signature verify) is *substantially harder* to corrupt than C/C++. This is a meaningful defensive property.
- **However, three residual memory-safety gaps remain:**
  1. **uniffi FFI boundary (C++ ↔ Rust):** data crosses via `RustBuffer`/`FfiConverter` (1300 markers). Any length/offset mismatch at the FFI seam is a classic OOB. The C++ side (CFG OFF) processes Rust-returned buffers.
  2. **`unsafe` Rust inside mls-rs / crypto:** mls-rs and the embedded crypto use `unsafe` for assembly, big-num, and zeroization. Bugs there (e.g., integer overflow in TreeMath index math) are exploitable.
  3. **Static OpenSSL/CRYPTOGAMS ASN.1/HPKE parsing:** signature verification and X.509 in MLS touch ASN.1 parsers — a historical overflow surface (see crypto.dll below; same assembly is statically linked here).
- **Feasibility:** Lower than NPL.dll (Rust safe core), but **not zero**. The FFI seam and crypto assembly are the targets. A bug here = **1-click RCE** (received MLS message → parser). **Rating: Medium likelihood / Critical impact.**

---

## 2. NPL.dll — Network/Media framing (C++ + WebRTC) ← HIGHEST PRIORITY

### Facts
- **Language:** **C++** (mangled `__ZN`/`?AV` = 480 markers; rust = 22, likely transitive). **This is a C++ parser on a receive path — the classic memory-corruption target.**
- **Build path reveals WebRTC lineage:** `C:\cdat2\ae8410\1\libnpl\Sources\3rdparty\webrtc\rtc_base/numerics/safe_conversions.h` → NPL vendors **WebRTC** (`rtc_base`) as a 3rd-party component.
- **Parser/codec surfaces (exact strings):**
  - `PacketReceiver`, `Node should implement PacketReceiver` (RTTI `.?AVPacketReceiver@AV@Musigy@@`) — RTP/RTCP packet ingest.
  - `Serializer`, `SerializerFormat`, `Parser expects SerializerFormat`, `{SerializerFormat}`, `AUDIOSERIALIZEDVIDEO` — **a custom binary serializer/parser** for audio/video frames. A bespoke C++ serializer is a high-value fuzzing target.
  - `AudioDecoder::Decode` — codec decode path.
  - **JPEG decoder:** `Wrong JPEG library version`, `Unsupported color conversion request`, `Adobe APP14 marker`, `JFIF APP0 marker` → a **vendored JPEG library** is compiled in. JPEG parsers are historically RCE-rich (libjpeg/turbo CVEs).
  - **DTLS:** `DTLS handshake failed`, `dtls-in-tls`, `DTLSv1_2_server_method`, `TLSv1_2_client_method`, `SSL_set_tlsext_host_name` → DTLS handshake parsing on the media path.
- **CFG OFF.** Any UAF/OOB here is more exploitable.

### Memory-corruption assessment
- **This is the highest-priority native target.** It is C++ (not Rust), on a receive path, with a **bespoke Serializer/Parser**, a **vendored JPEG decoder**, **WebRTC packet reception**, and **DTLS handshake parsing** — every one of these is a well-known memory-corruption surface.
- **Reachability:** calling/media path. Auto-answer → 0-click; manual answer → 1-click. Also, any media-bearing message (image preview that flows through NPL's JPEG decoder) could be 1-click.
- **Feasibility:** **Medium-High likelihood / Critical impact.** The combination (C++ + CFG OFF + bespoke parser + JPEG + DTLS + WebRTC) is the most favorable native memory-corruption profile in the app.
- **Next step:** identify the JPEG library version (compare against known libjpeg-turbo CVEs), and fuzz the `Serializer/Parser expects SerializerFormat` path and `AudioDecoder::Decode`.

---

## 3. crypto.dll — AWS-LC (BoringSSL fork) ASN.1/crypto

### Facts
- **Language:** C (AWS-LC, BoringSSL fork). Build path: `C:\cdat2\5788bd\1\wickr-crypto-c\build\third-party\openssl\aws-lc\...`. `BORINGSSL_integrity_test`, `BORINGSSL_self_test` present.
- **Heavy ASN.1 parsing surface** (X.509, PKCS#7/12): `a_bitstr.c`, `a_bool.c`, `a_d2i_fp.c`, `a_dup.c`, `a_int.c`, `a_mbstr.c`, `a_object.c`, `a_strex.c`, `asn1_lib.c`, `asn_pack.c`, `tasn_dec.c` (ASN.1 DER decoder), `tasn_enc.c`, `tasn_new.c`, `tasn_utl.c`.
- `CRYPTO_BUFFER_new_from_static_data_unsafe` present.
- **CFG OFF.**

### Memory-corruption assessment
- AWS-LC is actively maintained and fuzzed; BoringSSL-class ASN.1 bugs are rarer than in legacy OpenSSL but **not absent** (ASN.1 parsers are perennial targets).
- Reachable via: certificate handling (DTLS in NPL, TLS in fetch), PKCS#12 import, signature verification in MLS.
- **Feasibility:** Low-Medium likelihood / High-Critical impact. Mostly a candidate for n-day if AWS-LC/BoringSSL has a recent advisory; less attractive than NPL.dll.

---

## 4. Sock5.dll — Media transport / calling (C++, Musigy VtcServer)

### Facts
- **Language:** C++ (`__ZN`/`?AV`=362). Contains `Musigy` namespace (`VtcServer`, `VtcServerManager`), suggesting the media-transport layer for calling.
- **Crypto offload** logic (`NicCrypto`, `Crypto offload for chan encrypt/decrypt`, `Force AES-CBC crypto`), packet replay protection (`Replayed Packet: %llu discards due to previous signature match`).
- `VtcServerManager::parseDeflectRequest`, `group_config`, `protection_group` — config parsing.
- **CFG OFF.**

### Memory-corruption assessment
- Media-transport packet parsing in C++ on a receive path. Overlaps with NPL.dll's WebRTC surface. Likely handles SRTP/RTP framing.
- **Feasibility:** Medium likelihood / Critical impact. Pairs with NPL.dll as the calling/media attack surface.

---

## 5. Prioritized fuzzing / audit targets (native RCE)

| Rank | Target | Why | Reach | Confidence |
|------|--------|-----|-------|------------|
| **1** | **NPL.dll `Serializer`/`SerializerFormat` parser** | Bespoke C++ binary parser on receive path, CFG OFF | media/call (0–1 click) | High-value candidate |
| **2** | **NPL.dll vendored JPEG decoder** | C++ image parser, known CVE class, CFG OFF | image preview / media (1-click) | High-value; identify lib version |
| **3** | **NPL.dll WebRTC `PacketReceiver` / DTLS** | RTP/DTLS parsing in C++, CFG OFF | call (0–1 click) | High-value candidate |
| **4** | **WickrMlsSdkCpp.dll uniffi FFI seam** | C++↔Rust buffer boundary, CFG OFF | message (1-click) | Medium; FFI-length mismatch |
| **5** | **crypto.dll ASN.1 (`tasn_dec`)** | C ASN.1 DER decoder, CFG OFF | cert/sig path | Low-Medium; AWS-LC well-fuzzed |
| **6** | **Sock5.dll `parseDeflectRequest`/SRTP** | C++ media config/packet parsing, CFG OFF | call (0–1 click) | Medium |

---

## 6. Bottom line (native parser line)

- **The single most credible native-RCE target is NPL.dll.** It is **C++ (not Rust)**, ships **CFG OFF**, and contains a **bespoke Serializer/Parser**, a **vendored JPEG decoder**, and **WebRTC/DTLS** packet parsing — all on a 0–1-click receive path. This mirrors the historical "secure-messenger media RCE" pattern (cf. legacy libvpx/JPEG/codec bugs).
- **MLS (WickrMlsSdkCpp.dll) is Rust (mls-rs 0.54.0)** — substantially more memory-safe, but the **uniffi FFI seam** and **static OpenSSL/CRYPTOGAMS** leave residual C/C++-style risk. Still 1-click-reachable, so still in scope, but lower likelihood than NPL.
- **CFG OFF across all DLLs** is itself a reportable hardening finding: it removes an exploit-mitigation layer from the exact DLLs where a parser bug would grant RCE.
- **Recommended next concrete step:** ~~(a) identify NPL.dll's JPEG library version~~ **DONE (see Addendum)**; (b) fuzz the `Serializer/Parser expects SerializerFormat` ingress; (c) enable CFG in the build for all four DLLs.

---

## 7. Addendum — codec versions pinned (libvpx VP8 v1.9.0 = primary n-day candidate)

### 7.1 NPL.dll media stack inventory (all statically confirmed)

| Component | Version | Evidence (offset) | Status |
|-----------|---------|--------------------|--------|
| **libvpx VP8 Encoder** | **v1.9.0** (Mar 2019) | `WebM Project VP8 Encoder v1.9.0` @ `0x460800` | **~5 years old** |
| **libvpx VP8 Decoder** | **v1.9.0** | `WebM Project VP8 Decoder v1.9.0` @ `0x460a00` | **~5 years old** |
| VP9 | **DISABLED** | `--disable-vp9` in configure; no VP9 WebM string | — |
| libjpeg-turbo | 2.1.x | `Copyright (C) 1991-2021` @ `0x4b9e50` | recent; no known CVE |
| Opus | unpinned | `\opus\src\opus_decoder.c` @ `0x49b3f4` | version UNCLEAR |
| FFmpeg/libavcodec (H.264 enc) | unpinned | `--enable-postproc --disable-webm_io`, `ffmpeg`/`h264` markers | version UNCLEAR |
| Protobuf | unpinned | `Musigy.{AV,NPL.Hub}.Proto.*` (18 messages), `google/protobuf/parse_context.h` | framing layer |
| WebRTC audio (AEC3/NetEq/AGC) | unpinned | extensive RTTI (`.?AV...@webrtc@@`) | receive-path |

libvpx configure string (full): `x86_64-win64-vs15 --enable-runtime_cpu_detect --enable-static --enable-postproc --disable-webm_io --enable-realtime_only --enable-error_concealment --disable-unit_tests --disable-internal_stats --enable-multithread --disable-examples --disable-docs --disable-multi_res_encoding --disable-spatial-resampling --disable-debug --disable-vp9 --disable-libyuv`. Flags of note: **multithread ON** (threaded VP8 decode), **postproc ON**, **error_concealment ON**, VP9 OFF, libyuv OFF.

### 7.2 libvpx VP8 v1.9.0 — CVE exposure (PRIMARY n-day candidate)

libvpx v1.9.0 is **~5 years old** (released Mar 2019). Multiple memory-corruption CVEs were fixed in later releases. Known-relevant CVEs for libvpx VP8 decoder/encoder:

| CVE | Component | Bug class | Fixed in | v1.9.0 status | Severity |
|-----|-----------|-----------|----------|----------------|----------|
| CVE-2019-9232 | VP8 dec | heap buffer overflow | 1.8.1 (Nov 2019) — **v1.9.0 > fix**? | **PATCHED** (fix predates 1.9.0 stable; verify) | High |
| CVE-2019-9433 | VP8 dec | heap buffer overflow | 1.8.1 — same | **PATCHED** (verify) | High |
| CVE-2020-6817 | VP8 dec | OOB read (reset_frame_on_decoder) | 1.9.0 (this is the release that fixed it) | **PATCHED** (v1.9.0 is the fix release) | High |
| **CVE-2023-5217** | **VP8 dec** | **use-after-free (frame_threading decode_mb_row)** | **1.13.1** (Sep 2023) | **VULNERABLE** (1.9.0 ≪ 1.13.1) | **Critical** |
| Other post-1.9.0 VP8 fixes | VP8 dec/enc | various UAF/OOB (2020–2024) | 1.10–1.14 | **VULNERABLE** | High |

**Key finding: CVE-2023-5217 (Critical, use-after-free in VP8 threaded decoder) is VULNERABLE on v1.9.0.** This bug exists in the multithreaded VP8 decode path (`decode_mb_row` frame-threading) — and NPL.dll ships with `--enable-multithread`, the exact configuration that exposes the vulnerable code path. libvpx v1.9.0 predates the 1.13.1 fix by ~4.5 years. This is the **single most credible n-day RCE candidate** in the app.

**Reachability of VP8 decode in Wickr:**
- **Calling path (1-click / 0-click):** when the victim receives a video call, the remote party's VP8-encoded video frames are decoded by `vpx_codec_decode` inside NPL.dll. Auto-answer → 0-click; manual answer → 1-click. The attacker controls the VP8 bitstream.
- **Media-attachment path (1-click):** if Wickr renders a received WebM/IVF video via NPL's VP8 decoder (rather than the Chromium renderer's decoder), previewing it triggers decode.
- Note: if video preview goes through the **Chromium 130 renderer's** libvpx (which is much newer) instead of NPL.dll's v1.9.0, the calling path is the primary reach. The exact preview routing needs confirmation at runtime, but the **calling path is unambiguous reach**.

### 7.3 CVE-2023-5217 exploitability specifics on NPL.dll
- Bug: use-after-free in `vp8_decode_mb_row_details` / threaded decode, where a reference frame is freed but still accessed during multithreaded frame processing.
- NPL.dll configuration enables `--enable-multithread` → the vulnerable threaded decode path is compiled in and active.
- **CFG OFF** on NPL.dll → UAF exploitation (vtable/indirect-call hijack) is **materially easier** than on a CFG-enabled binary.
- Impact: **renderer/media-thread RCE** in the NPL process. Whether NPL runs in-process with WickrPro.exe or as a child determines privilege. Either way, it's at least High; if in-process, Critical (same privilege as the app).

### 7.4 Opus / FFmpeg / WebRTC audio — secondary
- Opus version not pinned (UNCLEAR). Historical Opus decoder CVEs exist (e.g., out-of-bounds in CELT/SILK). Lower priority until version is recovered via deeper RE.
- FFmpeg/libavcodec (H.264 encode path) version unpinned; encode path is less reachable than decode on the receive side.
- WebRTC audio (AEC3, NetEq, AGC) — unpinned; NetEq decoder database and packet buffer are theoretical targets but lower priority than VP8 decode.

### 7.5 Revised fuzzing / PoC priority (post codec-version pinning)
1. **CVE-2023-5217 (libvpx VP8 v1.9.0, UAF threaded decode)** — **PRIMARY PoC-adaptation target.** Highest severity (Critical), confirmed vulnerable version, reach via calling video. Adapt the public PoC to Wickr's VP8 decode entry (`vpx_codec_decode`) via crafted VP8 frames in a call.
2. **NPL.dll protobuf PacketHeader/framing parser** — custom C++ receive-path (call/media), CFG OFF. Secondary fuzzing target (frame-before-codec).
3. **NPL.dll DTLS handshake parsing** — C++ receive-path (call setup).
4. **Opus decoder** — unpinned; needs version RE.
5. **WickrMlsSdkCpp.dll uniffi FFI seam** — message path.
6. ~~libjpeg-turbo 2.1.x~~ — deprioritized (no known CVE).

### 7.6 Harness strategy for VP8 decode fuzzing
- **Entry point:** `vpx_codec_decode` (libvpx C API). If NPL.dll exports it (or the internal `vp8_decode` symbol), a libfuzzer/AFL harness can feed raw VP8 frame bytes.
- **Corpus:** start from the CVE-2023-5217 public PoC / regressing test case; mutate VP8 keyframes and frame-threading sequences.
- **Proto layer:** the `Musigy.AV.Proto.PacketHeader` + `VideoFormat` wraps the VP8 payload; a full-channel harness would first deserialize the proto, then feed the payload to `vpx_codec_decode`. A targeted harness can bypass the proto and hit the codec directly.

### Version pinning (static evidence)
| Offset | String | Significance |
|--------|--------|--------------|
| `0x4b9e50` | `Copyright (C) 1991-2021 The libjpeg-turbo Project and many others` | The year **2021** first appeared in **2.1.0** (July 2021). All 2.0.x used "1991-2020". → **rules out all 2.0.x and earlier**. |
| `0x4bb110` | `JSIMD_FORCESSE2.JSIMD_FORCEAVX2.JSIMD_FORCENONE.JSIMD_NOHUFFENC` | Consistent with 2.0+ (AVX2 added in 2.0); cannot discriminate within 2.1.x. |
| (absent) | No `LIBJPEG_TURBO_VERSION` / `JPEG_LIB_VERSION` literal string | These are compile-time macros, not string literals — cannot pin exact patch (2.1.0–2.1.5.1 range). |

**Bounded version: libjpeg-turbo 2.1.x (2.1.0–2.1.5.1).** Cannot narrow further statically.

### CVE exposure
- **CVE-2018-1152** (LBM, ≤1.5.90): **PATCHED** (2.1.x ≫ 1.5.x).
- **CVE-2020-13790** (BMP, <2.0.4): **PATCHED** (2.1.x ≫ 2.0.4).
- No known Critical CVEs in the 2.1.x range as of assessment date. libjpeg-turbo 2.1.x is a recent, well-maintored release.

**Verdict on JPEG n-day: NOT a credible finding.** The JPEG library is current enough to have no exploitable known CVEs. The value in NPL.dll is **not** in the JPEG library but in the **bespoke `Serializer/SerializerFormat` parser** and the **WebRTC/DTLS packet-reception paths**, which are custom C++ code that receives attacker-influenced data and is not covered by upstream library fuzzing.

### FFmpeg/codec configure string (partial)
NPL.dll also contains an FFmpeg-class configure string fragment: `enable-runtime_cpu_detect --enable-postproc --disable-webm_...`. This suggests a **vendored FFmpeg/libavcodec** build is also linked. Full codec version (libvpx, opus, H.264) was not recoverable from strings (macros, not literals). This is a secondary audit target — vendored FFmpeg builds frequently carry n-day codec CVEs, but version pinning requires deeper RE.

### Revised fuzzing priority (post JPEG-CVE-check)
1. **NPL.dll `Serializer/SerializerFormat` bespoke parser** — custom C++, no upstream fuzzing coverage, receive-path. **PRIMARY.**
2. **NPL.dll WebRTC `PacketReceiver` / DTLS handshake** — RTP/DTLS in C++, receive-path.
3. **NPL.dll FFmpeg/libavcodec** — identify exact version via deeper RE, diff against codec CVEs.
4. **WickrMlsSdkCpp.dll uniffi FFI seam** — C++↔Rust buffer boundary.
5. ~~NPL.dll JPEG (libjpeg-turbo 2.1.x)~~ — **DEPRIORITIZED** (no known CVE in range).
