# A3 — WickrMlsSdkCpp.dll + NPL.dll (wire/message parsers)

**Agent:** A3 (MLS/NPL surface). **Date:** 2026-07-24. **Verdict: NEGATIVE (no win) on the assigned "send-the-victim-a-message" surface.** Honest negative, evidence below. No fabricated/UNCONFIRMED positive claimed.

---

## TL;DR
- **WickrMlsSdkCpp.dll is a Rust bundle**, not C++ logic. It statically links `mls-rs 0.54.0` (AWS's audited RFC 9420 MLS), `mls-rs-codec 0.7.0` (TLS-style wire codec), `mls-rs-crypto-hpke 0.20.0`, `wickr-client-sdk`/`-uniffi`, `uniffi_core 0.28.3`, `hyper 1.9.0`, `rusqlite`/SQLCipher, `serde_json`, `ciborium`, `tokio`. The **entire attacker-reachable message ingest → MLS decode/decrypt/verify path is memory-safe Rust.** The only C++ in the DLL is the uniffi FFI glue (`FfiConverter*`), which bounds-checks and only deserializes **Rust-produced** buffers — not attacker wire.
- **NPL.dll is the A/V real-time calling engine** ("libnpl"/Musigy: libvpx VP8/VP9, Opus/SILK, protobuf *signaling*, SOCKS5 UDP relay). **It is NOT on the 0-click message path.** The task premise that NPL does "attachment/message envelope parsing" is **refuted** — there is no attachment/message/envelope parser in NPL; it is a media/calling pipeline (`NPLHub/Scene/Node/Renderer/Port/Reactor`). Its parsers are reachable only via a **call**, and are dominated by **3rd-party codecs (libvpx/opus/silk) = known-CVE-excluded**.
- Net: on my surface, a malformed **message** at worst causes a Rust **panic → caught error or clean process abort = DoS**, which is **not in the accepted win list**. No OOB write/read, UAF, type confusion, or int-overflow→overflow primitive is reachable from an attacker-sent message on this surface. No evidence of an E2EE/auth break (all mandatory MLS checks are present in the binary).

## Corrections to shared RECON (please propagate)
1. **HighEntropyVA is ON**, not OFF, for `WickrMlsSdkCpp.dll` and `NPL.dll` — both have `DllCharacteristics=0x0160` (DYNAMIC_BASE|HIGH_ENTROPY_VA|NX_COMPAT). **CFG is confirmed OFF** on both. So the "low-entropy ASLR makes a primitive easy" framing does **not** hold for these two modules (may still hold for `WickrPro.exe`/`Sock5.dll` — verify per-module).
2. **NPL = calling/media stack**, not a message/attachment/envelope parser. The message-envelope hypothesis for NPL is wrong.
3. **WickrMlsSdkCpp.dll = Rust**, not hand-written C++ crypto. Memory-corruption hunting via C-style bugs does not apply to its message path.

---

## Evidence

### 1. WickrMlsSdkCpp.dll is Rust (mls-rs)
Strings (via `tools/strre.py`):
- `X:\vendor\mls-rs-0.54.0\src\group\mod.rs`, `...\tree_kem\*.rs`, `...\group\proposal_filter\*.rs`
- `X:\vendor\mls-rs-codec-0.7.0\src\varint.rs` — "Such a large VarInt cannot be instantiated", "Integer out of range for VarInt", "VarInt does not use the min-length encoding"
- `X:\vendor\mls-rs-crypto-hpke-0.20.0\src\dhkem.rs`, `X:\vendor\uniffi_core-0.28.3\...`, `X:\vendor\hyper-1.9.0\src\error.rs`, `X:\vendor\rusqlite-0.37.0\...`
- `wickr-client-sdk\src\client\outbox_handler\*.rs`, `wickr-client-sdk-uniffi\src\lib.rs`
- Exports are dominated by `WickrMlsSdk::uniffi::FfiConverter*::{read,lift,lower,allocation_size}` over `RustBuffer`/`RustStream` and `rust_call<...RustCallStatus>` wrappers — the uniffi C++↔Rust binding.

### 2. Attacker message-ingest entry points (all land in Rust)
`WickrSdkClient` methods called by the C++ host with raw received bytes:
`handle_switchboard_message[_until]`, `handle_download_message[_until]`, `post_process_message`, `post_process_private_message`, plus internal `handle_mls_protocol_message`. Reachability chain: network bytes → C++ host (`WickrPro.exe`) → uniffi C-ABI (`rust_call`, RustCallStatus) → **Rust** `amzn_wickr_client_sdk` → **Rust** `mls-rs` decode/decrypt/verify. No C/C++ wire parser is interposed (confirmed: **no protobuf/CodedInputStream/nanopb/flatbuffers** strings in the MLS DLL).

### 3. Rust safety / panic discipline = DoS ceiling, not corruption
- `mls-rs-codec` varint/vector decode is bounds-checked; oversized/over-range varints error out (strings above). Length-prefixed vectors decode into `Vec` with element-wise bounds checks — an integer wrap yields a Rust panic on access, **not** an OOB (defeats the "int-overflow→undersized-alloc→overflow" thesis).
- Panics are caught at the FFI boundary: exported `??$rust_call@...RustCallStatus...` = uniffi `catch_unwind`, converting panic→error status. Unhandled tokio task panics → "a spawned task panicked and the runtime is configured to shut down" → **clean process abort**. Both outcomes = **DoS**, which is **not** an accepted win per RECON.

### 4. C++ uniffi glue bounds-checks (and isn't attacker-controlled anyway)
Disassembled `WickrMlsSdk::uniffi::FfiConverterBytes::read(RustStream&)` @ `0x180bf3600`:
reads a 4-byte length, `movsxd` sign-extends it, then `cmp len, remaining ; jbe ok` **and** `cmp len, 0x7fffffffffffffff ; ja error` — negative or oversized lengths take the error path; only `len <= bytes_remaining` proceeds. This parses **Rust-emitted** RustBuffers (well-formed by construction), so even this check is belt-and-suspenders; the attacker does not control this buffer's framing.

### 5. NPL.dll is A/V calling, off the message path
- Strings: `Musigy.AV.Proto.PacketHeader`, libvpx (`g_w/g_h out of range`, `rc_max_quantizer`, `cpu_used out of range [-16..16]`, "Corrupt frame detected", "Truncated key frame header"), SILK/Opus (`prevSignalType`, `TYPE_VOICED`), "Signaling connection packet received from", "Not enough space to insert UDP SOCKS header".
- Imports: `WSARecvFrom/recvfrom` (UDP media), `SSL_read` (TLS signaling). Exports: `NPLHub*/NPLScene*/NPLNode*/NPLRenderer*/NPLPort*/NPLReactor*/NPLConnection*/NPLPacket*` — a media-pipeline graph, no message/attachment API.
- Toolchain: MSVC, Linker 14.43, canary=false. `NPLPacketFromData` @ `0x1803cbc90` rejects negative length (`test edx,edx ; js error`) and just wraps a pointer in a pooled 0x198-byte packet struct — no wire-length-driven memcpy/OOB in the always-on path.

---

## Adversarial refutation (why this is a real negative, not a missed bug)
- **Is the input really attacker-controlled end-to-end?** Yes for the *message* path — but it lands in memory-safe Rust (mls-rs). The only C++ (uniffi glue) parses Rust output, not attacker bytes.
- **Post-decrypt attacker-authored?** The decrypted MLS application plaintext is attacker-authored (sender = attacker) and would be in scope — but it is still handled in Rust (`post_process_message`) and marshaled to C++ via bounds-checked uniffi converters; no length/type-confusion sink in C++ that the attacker drives.
- **Is length bounded before the sink?** Yes — mls-rs-codec varint bounds + Rust slice/Vec checks; C++ `FfiConverterBytes::read` bounds len vs remaining and vs INT64_MAX.
- **NPL in scope?** Only via a **call** (not a message). Its in-scope-looking parsers are 3rd-party (libvpx/opus/silk) = **known-CVE-excluded**; Wickr's own protobuf signaling is reachable only over transport-protected channels, so delivering attacker bytes to the raw parser needs a **transport break = 2nd bug (excluded)** or is the peer-decrypted-during-call surface (calling, not the assigned messaging surface).
- **DoS = win?** No — not in RECON's accepted list; excluded from a WIN.

## Blockers (what stops each thesis)
- **Memory-corruption from a sent message:** entire attacker-reachable parse/decrypt path is **memory-safe Rust**; worst case DoS (excluded). No C/C++ parser on the path.
- **E2EE/auth break:** `mls-rs 0.54.0` is AWS's audited RFC 9420 impl; all mandatory checks present in-binary ("invalid signature found", "invalid confirmation tag", "invalid membership tag", "tree hash mismatch", "membership tag on MlsPlaintext for non-member sender", epoch/sender-type/cipher-suite checks, "Unencrypted application message" rejected). No static indicator of a missing/bypassable check. A definitive auth-break assessment needs **dynamic testing with a malicious MLS peer** (2nd throwaway account + crafted-message injection to observe forgery/decryption acceptance) — beyond static RE and not evidenced here.

## Residual avenues (not pursued; lower value / out-of-scope-ish)
1. **NPL call-signaling protobuf** (Wickr's own field handling, not the protobuf lib) — reachable by *calling* the victim (≤1-click during ring), post transport-decrypt. This is the **calling** surface, needs a call, and likely needs a transport break to deliver attacker-controlled bytes. Candidate for a call-focused agent, not the message surface.
2. **Rust `unsafe` in HPKE/crypto FFI glue** — operates on fixed-size crypto buffers, not attacker-length-driven copies; no indicator found. Would require Rust-level audit/source to pursue.

## Why no fuzz harness was run
The only attacker-reachable parser on the assigned surface is memory-safe Rust reached through an initialized `WickrSdkClient` (needs full client/storage/key state ~= the whole app). Harnessing it could at most reproduce a **panic/DoS**, which is not a win, so building that rig is not justified. Executed/observed evidence here is the **disassembly of the actual bounds checks** (`FfiConverterBytes::read`, `NPLPacketFromData`) plus verified toolchain/version/mitigation facts. Nothing rises to the VERIFY STANDARD as a WIN, so none is claimed.
