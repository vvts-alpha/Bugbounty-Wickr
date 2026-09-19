# Final summary — AWS Wickr Desktop video heap overflow (Wave 3 native)

**Target:** AWS Wickr Desktop (WickrPro) 6.72.20.0, Windows x64 (analyzed binaries byte-identical to
the live installed client). **Date:** 2026-07-30.

This is the consolidation. Full technical detail: `MASTER-DESIGN-wickr-video-overflow.md` and the
sub-docs it indexes (`FINDING-…`, `HOOK-SPEC.md`, `ASLR-ASSESSMENT.md`, `RAW-I420-PATCH-PLAN.md`,
`DESIGN-crafting-endpoint-poc.md`, `IMPLEMENTATION-STATUS.md`, `WAVE3-NATIVE-FINAL.md`).

---

## 1. The finding (one paragraph)

`WickrPro.exe 0x1406e95d0`, the received-video plane handler ("VV CM" Video/Voice Call Manager),
allocates `(height>>1)*stride` bytes for each chroma plane but copies `(stride*height)>>1` — a
`floor(stride/2)`-byte **heap out-of-bounds write** whenever the frame **height is odd** and the
chroma stride is non-zero. Height and stride are attacker-controlled fields of the received video
wire format and reach the sink **unclamped** (no even-round, no dimension cap, no format-negotiation
rejection). It is a remotely-reachable memory-corruption bug with a demonstrated control-flow-hijack
primitive, triggerable by a **malicious participant in a call** (attacker position P2), amplified by
**CFG being OFF** on all modules.

## 2. What is PROVEN (executed)

- **W1 — crash.** `repro.exe` calls the real `0x1406e95d0`: even height → clean; odd height (241) →
  ACCESS VIOLATION, type WRITE, fault at `block+alloc` (first byte past the allocation), overrun =
  `stride/2`. Deterministic, re-run by the lead.
- **W3 — PC control.** `pcdemo.exe`: the real overflow overwrites an adjacent object's vtable pointer
  with an attacker-chosen value; a virtual call lands on attacker code (exit `0x7B`).
  `pcdemo_partial.exe`: an ASLR-surviving 2-byte partial overwrite redirects an adjacent module
  pointer with **no info leak** (Windows 64 KB-aligned bases → low-16 invariant), exit `0x7C`.
- **ASLR/CFG posture (measured, live 214 modules):** full high-entropy ASLR, **no non-ASLR island**;
  CFG OFF everywhere. Two independent attacker knobs (overflow length via stride, alloc size via
  height) decouple grooming from overflow distance; ~38 KB+ allocations are heap-backend (groomable);
  data-only → OOB-read → leak is the ASLR-immune second-stage route.

## 3. Reachability — the decisive narrowing (RE-confirmed)

- **Normal VP8 video calls: NOT exploitable.** Live instrumentation showed the sink runs (700 hits)
  but is fed **decoder-derived even** geometry (h=360). Codecs require even dimensions → decoded
  video can never carry an odd height.
- **Raw-I420 path: the receiver is remotely vulnerable and unclamped.** A peer announcing
  `Format(subtype=I420)` + odd-height `PacketHeader_Plane(stride>0)` protobuf overflows the victim.
  Confirmed: no clamp, no negotiation rejection on this path.
- **A stock client (patched or not) cannot deliver it** — its send graph is encoder-only and never
  emits raw plane protobuf. Delivery requires a **crafting endpoint** = a malicious call peer running
  a modified client / an in-client payload-substitution patch.

## 4. End-to-end delivery — designed, hook byte-verified, NOT executed

- **Payload: complete.** Exact crafted wire bytes decoded from a live Serializer capture and frozen
  (`scratch/w3/lead/payload/`): the I420 format announcement + a data packet with plane-0 height
  flipped to odd (`10 f0 01` → `10 e9 02`). Correctness follows by composition of proven links.
- **Delivery hook: pinned and byte-verified.** Media encryption is a raw `encryptCallback` invoked
  inline from a callback media-sink node. Hook = `NPL+0x3d134b`; plaintext serialized-protobuf
  pointer at `desc+0x18` (from `frame+0x48`); Format(I420) announce = tag=1 site `0x3d130f`, armed
  via `sinkobj+0xe8=1`; detour splices `48 8B 43 68 FF D0` at `0x1803d1347`. The bytes were verified
  against the shipped binary.
- **NOT executed:** the injector build (2-stage native detour + one-shot dump/substitution) and the
  live 2-endpoint crash. **Blocker: tooling, not analysis.** cdb-based runtime recon proved
  impractical — invasive attach suspends the process and **drops the real-time call before it can be
  observed** (a stack sample during a call showed zero active media threads). The reliable path is a
  **native recon/substitution injector** (no thread suspension) — substantial additional exploit-dev
  engineering, and it still requires the peer to be actively viewing the sender's video so the send
  path executes.

## 5. Also settled this wave (verified negatives / corrections)

- **CVE-2023-5217 (prior wave headline): WITHDRAWN.** It is a VP8 **encoder** heap overflow
  (`vp8_change_config`, send path), not a decoder UAF; and even on the send path the app's sole
  `vpx_codec_enc_config_set` call never changes `g_threads`, so the precondition is never met.
- **libvpx 1.9.0** pinned four ways; error-concealment / postproc / input-fragments / frame-threading
  all compiled-in but **disabled** (init flags 0, threads 1) → dead code; core VP8 decode is the only
  live surface, and upstream assigned no decoder CVE in ~6 years.
- **Third-party pins:** libjpeg-turbo 2.1.0–2.1.2 (decoder only, consumer = ColorspaceConverter; wire
  reachability inconclusive), Opus 1.3.1, expat 2.2.1–2.3.0 + OpenSSL 1.0.x (EOL) in WinSparkle,
  **mbedTLS 2.1.5 (2016) + SQLite 3.19.2** in Sock5 (a decade-stale bundle; CVE-2018-0487
  preconditions compile-time proven but gated on the Dispersive tunnel, off by default),
  **FDK-AAC v2.0.0/2.0.1** (decoder-side RCE CVEs — but `libSBRdec`/`libAACdec` linkage unconfirmed,
  `mpegSurroundDecoder_GetLibInfo` is an orphan → likely NOT linked), AWS-LC FIPS 2.0.17 / 3.3.0.
- **MLS (Rust/mls-rs) path:** verified negative — RustBuffer len≤cap check fires; 78 crates pinned;
  no reachable RUSTSEC. NPL has **no RTP/RTCP**; libsrtp absent.

## 6. Bottom line

A genuine, remotely-reachable, unclamped heap-corruption vulnerability in the video-call receive
path, with an **executed crash (W1)** and an **executed PC-control primitive (W3)**, reachable by a
malicious call participant. The end-to-end remote PoC (crafting-endpoint delivery over a live call)
is **fully designed with the hook byte-verified**, but not executed — blocked by the practical
difficulty of instrumenting/delivering into a live real-time call, which needs a native injector
rather than a debugger. Severity: high — remote memory corruption with a control-flow-hijack
primitive, CFG-OFF; the missing piece is exploit-delivery engineering, not the vulnerability.

## 7. Remediation (for the vendor)

Clamp/validate received video plane geometry on the receive path: reject or round odd heights, cap
dimensions, and compute chroma allocations consistently with the copy (`ceil` vs `floor` mismatch is
the bug — size alloc and copy from the same expression). Reject peer-announced raw pixel formats
where a coded format was negotiated. Ship CFG ON. Refresh the Sock5 (mbedTLS 2.1.5 / SQLite 3.19.2)
and WinSparkle (OpenSSL 1.0.x / expat 2.2.x) vendored bundles.

---

### Artifact index (`E:\tmp\wickr\scratch\w3\`)
`lead/repro.c`·`repro.exe` (W1) · `lead/pcdemo.c`·`pcdemo.exe` (W3) · `lead/pcdemo_partial.c`
(ASLR-surviving) · `lead/oddheight_inject.c` (detour template, validated live) · `lead/payload/`
(crafted wire bytes) · `lead/probe_passive_av.txt` (victim AV catcher) · `n2/n2fuzz.c` (Serializer
byte generator). Docs in `E:\tmp\wickr\desktop\notes\`.
