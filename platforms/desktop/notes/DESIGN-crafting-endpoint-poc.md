# Design — Crafting-Endpoint PoC for the WickrPro odd-height heap overflow

**Status:** design only (no code). Target: AWS Wickr Desktop 6.72.20.0 (build byte-identical to the
analyzed binaries). All offsets below are CONFIRMED against the shipped binaries unless marked
`TO-CONFIRM`. ImageBases: `NPL.dll = 0x180000000`, `WickrPro.exe = 0x140000000` (both ASLR /
high-entropy — resolve at runtime from the loaded module base).

---

## 1. Purpose & scope

Deliver, end-to-end over a real Wickr video call, the wire input that triggers the confirmed heap
overflow at `WickrPro.exe 0x1406e95d0` in an **unmodified victim** client, and observe the resulting
memory corruption.

This document specifies **how a malicious call participant (attacker position P2) delivers the
trigger**, given the proven constraint that a stock WickrPro sender — patched or not — cannot emit
the required protobuf (its send graph is encoder-only; see §4). The deliverable is a benign
crash/diagnostic PoC on own accounts and own machines only.

Out of scope: weaponization beyond a controlled crash / write-what-where demonstration; anything
against non-consenting parties or production infrastructure beyond a single normal call.

## 2. Threat model

- Attacker is a **legitimate participant in a call** with the victim (has the negotiated media
  session keys and an established encrypted transport to the victim).
- Attacker runs a **modified/instrumented client** (their own machine) that emits crafted media
  protobuf instead of, or in addition to, the encoder's output.
- Victim runs a **stock, unmodified** client.
- One user action ceiling consistent with normal use: the victim answers / is in the call.

## 3. Root cause & overflow parameters (CONFIRMED)

Sink `WickrPro.exe 0x1406e95d0`, chroma planes 1 & 2:

```
alloc = (height >> 1) * stride          ; via malloc (api-ms-win-crt-heap!malloc)
copy  = (stride * height) >> 1          ; via VCRUNTIME140!memcpy
overflow = floor(stride/2) bytes   when height is ODD and chroma stride > 0
```

Overflow content = the received plane bytes (attacker-controlled). Overflow length = `stride/2`
(attacker-tunable to the byte, since stride is attacker-supplied → supports the ASLR-surviving
2-byte partial-overwrite variant, §9). Luma plane 0 is correct; the defect is on the two chroma
planes. Reference PoC of the arithmetic + PC-control: `scratch/w3/lead/pcdemo.c`,
`pcdemo_partial.c`.

## 4. Wire requirements & why a stock sender can't produce them

To reach the sink on the raw path, the wire must carry **both**:

1. **`Format(subtype = "I420")`** (or `YUV420P`/`NV12`) — a raw pixel format. The receiver then
   builds **no decoder** and routes packets through `Musigy::AV::Serializer`
   (`NPL 0x18011d240`) → geometry setter `NPL 0x180136080` → `packet+0x70` (heights) →
   `NPLAVPacketGetDescriptor 0x1803d0e50` → sink. (Subtype→raw map: `NPL 0x180146230`,
   `I420/YUV420P → 1`.)
2. **`PacketHeader_Plane`** data with **odd `height`** (field 2, member `+0x1c`, wire tag `0x10`) and
   **chroma `stride` > 0** (field 1, member `+0x18`, wire tag `0x08`), plus plane bytes (field 3).

**Constraint (CONFIRMED, step-② RE):** the stock send video graph is **encoder-only**. The NetSink
send serializer emits a **single coded buffer** (`[rdi+0x80]` ptr, `[rdi+0x18]` size,
`[rdi+0x98/0x9c]` w/h) with **no plane iteration and no `PacketHeader_Plane` population**. Flipping
the hardcoded codec string `"vp8"` (`WickrPro 0x14014d59f`) to `"I420"` makes the codec factory
(`NPL 0x180121430`, len==3 gate + strcmp vp8/vp9) return NULL → send aborts. Therefore the trigger
**must be crafted by the attacker's endpoint**, not produced by the legitimate graph.

**Receiver is unmitigated (CONFIRMED):** no odd/even test, no round-to-even, no dimension cap, no
format-negotiation rejection anywhere on the raw receive path. Any endpoint that places the two
requirements on the wire overflows the victim.

## 5. Delivery designs (two options)

### Option A — In-client payload-substitution patch (RECOMMENDED)

Reuse the attacker client's own established call (its media keys + transport). Patch the attacker's
NPL **in memory** so that, at the point a serialized outgoing AV packet is handed to the
crypto/transport layer, the plaintext protobuf is **replaced** with attacker-crafted bytes:
first a `Format(subtype=I420, width=W, height=ODD)` announcement, then `PacketHeader_Plane` data
packets. The real crypto/transport then delivers them to the victim exactly like normal media.

Pros: reuses real MLS/call crypto + transport + signalling — no need to reimplement any of it.
Cons: requires locating the serialize→encrypt boundary hook (§8, `TO-CONFIRM`) and producing valid
crafted bytes (§7).

### Option B — Standalone protocol sender

A from-scratch client that performs call signalling + key agreement and emits the crafted media.
Pros: clean separation. Cons: must reimplement Wickr's call setup / MLS / media key negotiation —
very large. **Not recommended** unless Option A's hook proves infeasible.

**Recommendation: Option A.** The rest of this document details Option A.

## 6. Producing valid crafted bytes without hand-writing protobuf

Do **not** hand-encode the protobuf from scratch (error-prone across nested messages). Instead reuse
**NPL's own Serializer** to emit correct wire bytes, then mutate one field:

- N2's harness `scratch/w3/n2/n2fuzz.c` already builds `Source(VideoFormat I420 320x240) → Serializer
  → Sink` and dumps the exact bytes the Serializer emits (verbatim capture in N2-REPORT §223).
  Reuse this to generate:
  1. a **type-1 Format announcement** for `I420 W×H`, and
  2. one or more **type-2 data packets** carrying `PacketHeader_Plane` for a synthetic frame.
- Set the height to an **odd** value at generation time (either pass an odd height to the Source, or
  apply the existing height-OR at `NPL PacketHeader_Plane::_InternalSerialize 0x18013a6cf` while the
  generator runs). This yields a byte-accurate, odd-height packet stream.
- Freeze those byte blobs as the injection payload for Option A.

This decouples "generate correct wire bytes" (offline, using NPL's Serializer) from "deliver them"
(Option A hook), and sidesteps protobuf hand-encoding bugs.

## 7. Crafted payload specification

From N2's confirmed captures (proto2; PacketHeader is the outer envelope):

- **Type-1 (format announcement)** envelope example (verbatim from a live Serializer):
  `08 01 | 20 b2 01 | 28 00 | 30 00` = `PacketHeader{type=1, f4=178, f5=0, f6=0}`; payload =
  `Proto::Format`: `08 02`(Format.type=2 video) `12 14`(nested VideoFormat, 20 bytes):
  `08 01`(subtype=1 = I420) `10 c0 02`(width=320) `18 f0 01`(height=240) + trailing zeros.
  → For the trigger, set **subtype=1 (I420)**, **width=even W**, **height=ODD** (e.g. 361 →
  `18 e9 02`). Regenerate via §6 rather than editing by hand.
- **Type-2 (data)** packet: carries the plane descriptors/bytes deserialized by `NPL 0x18011d240`
  into `packet+0x60` (strides) / `packet+0x70` (heights). Exact repeated-`PacketHeader_Plane`
  framing: `TO-CONFIRM` — capture a real type-2 I420 data packet from the §6 generator (or read the
  type-2 handler reached from `AV::Parser::onPacket 0x18011fce0`) and mirror its structure. Ensure
  **3 planes**, **chroma stride > 0** (I420 → chroma stride = W/2), **height = odd**, and plane-3
  byte length ≥ `copy = (stride*height)>>1` so the memcpy actually overruns.

Geometry choice for a first, unambiguous crash: `W=320, height=361, I420` → chroma stride 160,
`alloc=(360/2)*160=28800`, `copy=(160*361)>>1=28880` → **80-byte** chroma overflow ×2 planes.
(Tune stride upward for a larger overflow, or use `W=4, height=241` for the ASLR-surviving 2-byte
partial-overwrite variant per §9.)

## 8. Option-A injection/hook design

**Hook goal:** intercept the outgoing **plaintext** serialized AV packet just before it enters the
crypto/transport, and substitute the crafted bytes; let the real crypto/transport carry it.

**R1 finding — media encryption is a CALLBACK (this largely retires the "no clean hook" risk).**
`NPLHubVideoPublish 0x1803e9150` receives, in its kv config, `encryptCallback` (a WickrPro fn ptr,
`WickrPro 0x140147170`) + `encryptUserData` (validated in `NPL 0x1803e69f0` / config parser
`0x1803e7f20`). NPL serializes each outgoing packet to plaintext protobuf, then invokes this callback
to encrypt before transmit. **Substituting the plaintext at (or just before) the callback input
therefore yields crafted bytes encrypted with the real session keys and transmitted normally** — no
need to reimplement crypto/transport/signalling.

**Located serialize points (plaintext protobuf producers — substitution-hook candidates):**
- **Video data:** graph-node process fn `NPL 0x180107870` (called from `0x180107fb0`) →
  serialize dispatcher `0x180133990` @ call `0x1801079e5`; the serialized plaintext buffer is then
  forwarded downstream via virtual calls `[rax+0x10]` toward the network node → encryptCallback →
  transmit.
- **Format announcement:** `NPLAVNetSinkGetFormatBlob 0x1803d0760` → serialize @ `0x1803d07ce`.

**Preferred hook = the `encryptCallback` invocation input — PINNED (see `HOOK-SPEC.md`).** The
callback is invoked **inline** (no thread handoff) from a generic callback media-sink node
(class 0x1a8, vtable `NPL+0x4cdc90`). Confirmed facts:
- **Primary hook `NPL+0x3d134b`** = the `call rax` (data packet, tag=0), inside slot1 method
  `0x1803d12b0`. Splice the 6 bytes `48 8B 43 68 FF D0` at `0x1803d1347` (`mov rax,[rbx+0x68];
  call rax`) → `E9 <rel32> 90` to a VirtualAlloc'd trampoline.
- **Plaintext serialized-protobuf pointer** at `[rsp+0x38]` = `desc+0x18`, from `frame+0x48`
  (the same field `0x180107870` fills post-serialize). **No separate length arg** — the buffer
  self-sizes, so a *same-length* in-place edit is the zero-unknown default; a *different-length*
  substitution needs the buffer object's internal size-field offset (residual, §R below).
- **Format(I420) announce** = tag=1 site `0x1803d130f` in the same method, gated by
  `sinkobj+0xe8 != 0` (announce flag) and `[frame+0x90] & 0x48` (frame-type). Arm by writing
  `sinkobj+0xe8 = 1` (or call slot2 `0x1803d1220`); the tag=1 descriptor emits before the tag=0
  data packet — exactly "announce I420, then video packet."
- Callback fn ptr at `sinkobj+0xd8`, userData `+0xe0` (set once in ctor `0x1803d1370`).
- **Runtime instance selection:** the class is generic (same code encrypts on send / decrypts on
  receive). The injector must pick the *encrypt* instance at runtime — match `sinkobj+0xd8` against
  WickrPro's `encryptCallback`, or select the sink on the publish/encode graph.

**Fallback hook = serialize-output substitution at `0x180107870`** (`[rbx+0x48]`, post-serialize,
pre-forward) — same plaintext, earlier; less selective, and cannot synthesize the announce (that
lives at the sink, §3b).

**Two-part substitution:**
- On stream (re)start, emit the crafted **Format(subtype=I420)** announcement (via the format-blob
  path `0x1803d0760`, or as a synthetic first packet through the same hook) so the receiver switches
  to the raw path.
- Then substitute outgoing video **data** packets with the crafted odd-height `PacketHeader_Plane`
  packets (payload from §6/§7; ensure chroma plane bytes ≥ `copy` so it is a real dest over-write).

**Mechanics (mirror `oddheight_inject.exe`):**
1. Attach to the attacker's own WickrPro process; locate NPL base (Toolhelp module enum).
2. Verify the hook site's prologue bytes match the analyzed build before patching (abort on
   mismatch — as `oddheight_inject.exe` does).
3. Install an in-memory detour at the hook site to a code cave (NPL has ≥26-byte `int3` caves, e.g.
   `0x180025806`) that:
   - on the **first** outgoing video packet after the call is up, emits the crafted **type-1
     Format(I420, odd height)** announcement, then
   - substitutes subsequent outgoing video data packets with the crafted **type-2**
     `PacketHeader_Plane` packets (or injects a bounded burst — a handful of frames is enough).
   - CFG is OFF and there is no runtime code-integrity, so in-memory detours execute (proven by the
     existing injector). Only the attacker's process is modified.
4. The real crypto/transport encrypts+sends the substituted plaintext to the victim.

**Payload delivery buffer:** the crafted blobs from §6 are embedded in the injected code cave or a
`VirtualAlloc`'d region in the attacker process; the detour `memcpy`s them into the outgoing packet
buffer (respecting the send API's length parameter, which must be updated to the crafted length).

## 9. Overflow tuning & optional PC-control

- **Simple crash:** `W=320, height=361` → 80-byte ×2 chroma overflow → heap corruption → crash
  (observed later on alloc/free or corrupted-pointer deref).
- **ASLR-surviving partial overwrite (per `pcdemo_partial.c`):** choose chroma `stride = 4`
  (overflow = 2 bytes = 16-bit) to overwrite only the low 16 bits of an adjacent heap object's
  module pointer, deterministically (module base is 64 KB-aligned). Requires heap grooming so a
  vtable-bearing object follows the plane allocation; allocation size is independently tunable via
  `height` (§3) to land the LFH/backend bucket. CFG-OFF means the redirected indirect call is not
  validated.
- **Content control:** the overflow bytes are the plane-3 payload → fully attacker-chosen.

## 10. Instrumentation & verification (victim side)

- **Passive AV catcher only** (no code breakpoints — breakpoints on the media path hang the client;
  learned the hard way). Use `scratch/w3/lead/probe_passive_av.txt`: attach with `-pd`, `sxe av`
  with a command that logs `code/addr/type`, registers, `kb`, `!address @rdi/@r15`, then
  `.detach; qd`. This only fires on a real access violation → no per-frame stall.
- **Triage bar:** count only OOB read/write, UAF, type-confusion, or int-overflow→bad-alloc. Fault
  address must be ≥ `0x10000` (else null-deref, does not count); not `0xE06D7363` (C++ EH), not an
  assert, not an `_RTC_Check` abort. Confirm reproduction with no debugger attached (the AV catcher
  is a detector, not a dependency).
- **Expected signature:** WRITE AV or delayed heap-corruption (`STATUS_HEAP_CORRUPTION 0xC0000374`)
  on the media thread; for the partial-overwrite variant, a redirected indirect call.

## 11. Open problems, risks, fallbacks (honest)

| # | Risk | Mitigation / fallback |
|---|---|---|
| R1 | Serialize→encrypt hook site (§8) not yet pinned | Implementation step 0: trace `NPLHubVideoPublish` send path / `NPLConnectionSend` to the plaintext-before-crypto point; §6 generator confirms the exact byte layout to substitute. |
| R2 | Type-2 data-packet framing (§7) not fully specified | Capture a real I420 type-2 packet from the §6 generator and mirror it; do not hand-encode. |
| R3 | Receiver may require the announced format to precede data on the same channel/stream id | Send the type-1 announcement first on the same stream; mirror the stream-id/sequence fields the generator emits. |
| R4 | Mid-call format switch VP8→I420 may be ignored if a stream is already established | Trigger at stream (re)start, or open a fresh video stream announced as I420 from the first frame (the receiver's fresh-alloc branch is where the sink runs — matches the live finding). |
| R5 | Bandwidth/keyframe pacing of raw I420 | A short burst of a few frames suffices; no sustained raw stream needed. |
| R6 | Client hang from over-instrumentation | Passive AV catcher only (§10); never breakpoint the media path. |

If R1 (the hook) proves infeasible, fall back to Option B (standalone sender) — larger, but the
receiver-side vulnerability is unchanged and endpoint-agnostic.

## 12. Success criteria

1. **Minimum:** the victim's stock client crashes with a triaged **memory-corruption** AV (WRITE or
   heap-corruption) on the media thread, from a call in which the attacker sent the crafted I420
   odd-height stream — with no debugger required for the crash. This closes the last gap (end-to-end
   remote reachability), upgrading the finding from "receiver confirmed vulnerable + unclamped" to a
   demonstrated 0/1-click remote memory-corruption via a malicious call peer.
2. **Stretch:** the ASLR-surviving partial-overwrite variant redirects a virtual call in the victim
   (real-heap PC control), combining §9 with the `pcdemo`-proven hijack mechanics.

## 13. Rules of engagement

Own accounts and own machines only; one consenting call between two own endpoints. Benign crash /
diagnostic PoC — no persistence, no exfiltration, no third parties, no production-server abuse
beyond a single normal call's signalling. Do not fabricate a positive: a crash counts only if
triaged as memory corruption per §10 and reproducible without a debugger.

---

### Appendix — confirmed offset reference (build 6.72.20.0)

| Symbol / site | Module+RVA |
|---|---|
| Sink (overflow) | WickrPro `0x6e95d0` |
| VV CM video-event handler / GetDescriptor call | WickrPro `0x13e430` / `0x13e4f9` |
| `NPLAVPacketGetDescriptor` (verbatim copy) | NPL `0x3d0e50` |
| Geometry setter (9 callers) | NPL `0x136080` |
| Packet ctor (stores stride@+0x60, height@+0x70) | NPL `0x135a40` |
| `Musigy::AV::Serializer` (RX raw path) | NPL `0x11d240` |
| `AV::Parser::onPacket` | NPL `0x11fce0` |
| `AV::Format::Deserialize` (type dispatch) | NPL `0x13da20` |
| subtype→raw map (`I420`/`YUV420P`→1) | NPL `0x146230` |
| codec factory (`vp8`/`vp9`, len==3 gate) | NPL `0x121430` |
| `Format::_InternalSerialize` | NPL `0x138270` |
| `VideoFormat::_InternalSerialize` (w@+0x34 f2, h@+0x38 f3) | NPL `0x139470` |
| `PacketHeader_Plane::_InternalSerialize` (stride@+0x18 f1, height@+0x1c f2) | NPL `0x13a630` |
| Existing height-OR hook site | NPL `0x13a6cf` |
| NetSink serialize dispatcher / `GetFormatBlob` | NPL `0x133990` / `0x3d0760` |
| `NPLHubVideoPublish` | NPL `0x3e9150` |
| Hardcoded send codec `"vp8"` | WickrPro `0x14d59f` |
| Code cave (≥26 bytes int3) | NPL `0x025806` |

Reference PoCs/tools: `scratch/w3/lead/pcdemo.c` (PC control), `pcdemo_partial.c` (ASLR-surviving
partial overwrite), `oddheight_inject.c` (in-memory detour template), `probe_passive_av.txt`
(victim AV catcher), `scratch/w3/n2/n2fuzz.c` (Serializer byte generator).
