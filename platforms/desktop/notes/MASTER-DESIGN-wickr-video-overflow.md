# Master design — AWS Wickr Desktop video heap overflow: vulnerability, exploitation & end-to-end delivery

**Target:** AWS Wickr Desktop (WickrPro) 6.72.20.0, Windows x64.
**Build pinned:** `WickrPro.exe` sha256 `eccafde8…41dbd`, `NPL.dll` sha256 `a031e7aa…d78d5`
(the analyzed staged binaries are byte-identical to the live installed client).
**ImageBases:** `WickrPro.exe = 0x140000000`, `NPL.dll = 0x180000000` (both ASLR/high-entropy →
resolve from the runtime module base). **CFG = OFF** on all modules (separately filed).
**Status:** vulnerability + PC-control primitive PROVEN; receiver remote-reachability CONFIRMED;
end-to-end delivery hook PINNED; injector + live 2-endpoint test remain.
Every claim is labelled **CONFIRMED** (offset + quoted bytes/disasm, or executed) or
**INFERRED / TO-CONFIRM**.

This document consolidates: `FINDING-odd-height-heap-overflow.md`, `DESIGN-crafting-endpoint-poc.md`,
`HOOK-SPEC.md`, `RAW-I420-PATCH-PLAN.md`, `ASLR-ASSESSMENT.md`, `IMPLEMENTATION-STATUS.md`.

---

## 1. Executive summary

`WickrPro.exe` contains a heap out-of-bounds **write** in its video-frame plane handler
`0x1406e95d0` (the "VV CM" Video/Voice Call Manager receive path). For the two chroma planes it
allocates `(height>>1)*stride` bytes but copies `(stride*height)>>1` bytes — off by `floor(stride/2)`
whenever the frame **height is odd** and the chroma stride is non-zero. The height and stride are
attacker-controlled fields of the received video wire format, delivered with **no clamp, no
round-to-even, and no format-negotiation rejection** on the receive path.

- **W1 (crash):** reproduced — a heap OOB WRITE, executed and re-run, access-violation with an
  attacker-influenced length, on the media path (`repro.exe`).
- **W3 (PC control):** the same overflow was escalated to overwrite an adjacent object's vtable
  pointer and redirect a virtual call to attacker-chosen code, driven by the real vulnerable
  function (`pcdemo.exe`, deterministic). An ASLR-surviving partial-overwrite variant redirects a
  module pointer with no info leak (`pcdemo_partial.exe`).
- **Reachability:** normal VP8 video calls **cannot** trigger it (the decoder emits even heights);
  the **raw-I420 path** can — the receiver is unclamped and accepts wire geometry verbatim. Delivery
  requires a **malicious call participant** emitting raw I420 + odd-height plane protobuf (a stock
  client, patched or not, cannot — its send graph is encoder-only). The plaintext-before-encryption
  substitution hook for such an endpoint has been located.

Severity: remotely-reachable memory corruption with a demonstrated control-flow-hijack primitive,
triggerable by a malicious peer in a call (attacker position P2), amplified by CFG-OFF.

---

## 2. The vulnerability (CONFIRMED)

### 2.1 Root cause

`WickrPro.exe 0x1406e95d0`, per chroma plane (planes 1 and 2; the luma plane 0 is correct):

```
alloc = (height >> 1) * stride     ; api-ms-win-crt-heap!malloc
copy  = (stride * height) >> 1     ; VCRUNTIME140!memcpy
```

For odd `height = 2k+1`:  `alloc = k*stride`,  `copy = k*stride + floor(stride/2)`  →
**`floor(stride/2)`-byte heap over-write.** Both quantities use the **frame (luma) height**
(`r14d = [rbp+0x97]`) for the chroma planes; the chroma stride is `[rbp+0x7f]`/`[rbp+0x87]`.
Overflow content = the received plane bytes. Overflow length = `stride/2`, byte-tunable because the
attacker supplies the stride.

Key disasm (alloc rounds height down; copy multiplies first):
```
0x1406e97a6  mov  eax,ebx           ; ebx = height>>1
0x1406e97a8  imul eax,ecx           ; (height>>1)*strideU     -> ALLOC size
0x1406e97cd  call 0x14071625c       ; -> malloc
0x1406e981a  mov  ebx,[rbp+0x7f]    ; strideU reloaded
0x1406e9838  imul ebx,r14d          ; strideU*height
0x1406e983f  shr  r8,1              ; (strideU*height)>>1     -> COPY size
0x1406e9849  call 0x140718e5d       ; -> memcpy  (= VCRUNTIME140!memcpy, IAT 0x140d57fe8)
```
Allocator `0x14071625c` → plain CRT `malloc` (16-byte granularity → cannot absorb `stride/2`).

### 2.2 Data path — wire to sink (CONFIRMED end-to-end)

```
peer protobuf PacketHeader_Plane.field2 (height, +0x1c, wire tag 0x10)
  -> AV::Parser::onPacket  NPL 0x18011fce0  (no clamp)
  -> Musigy::AV::Serializer NPL 0x18011d240 -> geometry setter NPL 0x180136080
  -> packet+0x70 (heights) / packet+0x60 (strides)   [ctor NPL 0x180135a40, stores VERBATIM]
  -> NPLAVPacketGetDescriptor NPL 0x1803d0e50  (pure copy: packet+0x70 -> desc+0x38)
  -> WickrPro VV CM handler 0x14013e430 (GetDescriptor call 0x14013e4f9)
  -> arg10 (frame height) = desc+0x38   [via 0x14011b6b0, verbatim forward]
  -> sink 0x1406e95d0
```
Two independent proofs of the descriptor mapping: N2's `_InternalSerialize` field-offset mapping,
and an **empirical** call to `NPLAVPacketGetDescriptor` with sentinel fields (measured
`desc+0x38 ← packet+0x70`, `desc+0x28 ← packet+0x60`). The arg-slot arithmetic was corroborated by
UNWIND_INFO (frame `0x98` → arg10 at `[rsp+0xe8]`), not just hand-counting.

### 2.3 W1 — executed crash

`scratch/w3/lead/repro.c` / `repro.exe` maps `WickrPro.exe` (`LoadLibraryEx DONT_RESOLVE`),
hand-binds the reached Qt6 thunks, and calls `0x1406e95d0` directly:
```
CONTROL height=240 (even): alloc==copy on all planes -> no fault (gate passes first)
TEST    height=241 (odd):  plane1/2 alloc=38400 copy=38560 -> ACCESS VIOLATION, type WRITE,
                           fault addr = block+38400 (first byte past a 38400 alloc), r8=copy, r14=241
```
Not a null-deref (addr ≫ 0x10000), not `_RTC_Check`, not a C++ EH; overrun scales exactly as
`stride/2`, odd heights only. Re-run by the lead — deterministic.

### 2.4 W3 — PC control

`pcdemo.c`/`pcdemo.exe`: the real function's overflow overwrites an adjacent object's vtable pointer
with an attacker-chosen value; a subsequent virtual call lands on `pwned()`; deterministic exit
`0x7B`. `pcdemo_partial.c`: a 2-byte (stride=4) partial overwrite rewrites only the low 16 bits of an
adjacent **module** pointer, preserving the ASLR-randomized high bits (Windows module bases are
64 KB-aligned → low-16 invariant) — control-flow redirection **without an info leak**, exit `0x7C`.

---

## 3. Exploitation-primitive analysis

### 3.1 ASLR / CFG posture (CONFIRMED, live process)

All **214** modules in the running client are `DYNAMIC_BASE | HIGH_ENTROPY_VA` (measured) — **no
non-ASLR island**. CFG is OFF on every bundled module (`GUARD_CF` clear). So ASLR is the only
address-secrecy mitigation, and the redirected indirect call is **not** CFI-validated.

### 3.2 What the primitive gives (from `ASLR-ASSESSMENT.md`)

- **Two independent knobs:** overflow length = `stride/2` (chroma stride) and allocation size =
  `(height>>1)*stride` (height). Grooming-bucket selection is **decoupled** from overflow distance.
- **Heap-backend, not LFH:** ~38 KB+ allocations exceed the 16 KB LFH cap → placed by the more
  deterministic backend free-lists → Feng-Shui groomable. Relative adjacency is ASLR-independent;
  absolute address needs a leak.
- **ASLR-surviving partial overwrite (proven):** 2-byte overwrite deterministically retargets an
  adjacent module pointer within its 64 KB block, no leak. Broader/arbitrary control needs an info
  leak; the **data-only → OOB-read → leak** route (overwrite an adjacent length/size field) is fully
  ASLR-immune and is the natural second stage.
- **Content control:** the overflow bytes are the attacker's plane payload (when sized ≥ `copy`).

---

## 4. Reachability analysis (the decisive narrowing)

### 4.1 Normal VP8 video call — CONFIRMED dead end

Live instrumentation: the sink runs on real calls (700 hits) but is fed **decoder-derived even**
geometry (measured `h=360`). The 9 callers of the geometry setter split into decoder/converter paths
(`VpxDecoder`, `ColorspaceConverter`, `VideoResizer`, `DShowCamCapture` — all even) and one wire path
(`Serializer`). A sender-side height-flip patch on `PacketHeader_Plane` had **no effect** on a VP8
call (that message is never populated for VP8). Codecs require even dimensions → decoded video can
never carry odd height. **Not exploitable via a normal call.**

### 4.2 Raw-I420 path — the open door (CONFIRMED receiver-side)

Subtype dispatch `NPL 0x180146230` maps raw pixel names (`I420`/`YUV420P`/`NV12`) to a raw format
with **no decoder**; wire plane geometry flows verbatim to the sink. On this path the receiver has
**no clamp and no negotiation rejection** — format apply is unconditional, keyed purely off the
peer-announced `subtype`. N2's `onPacket` harness reached the overflow via exactly this path.
**Any endpoint that puts `Format(subtype=I420)` + odd-height `PacketHeader_Plane(stride>0)` protobuf
on the wire overflows the victim.**

### 4.3 Stock sender cannot deliver (CONFIRMED) → malicious peer required

The legitimate send video graph is **encoder-only**: the NetSink send serializer emits a single
coded buffer with no plane iteration and never populates `PacketHeader_Plane`; the send codec is a
hardcoded `"vp8"` (`WickrPro 0x14014d59f`) and flipping it to `"I420"` makes the codec factory
(`NPL 0x180121430`, len==3 gate) return NULL → send aborts. So a stock client — patched or not —
cannot emit the trigger. **Delivery requires a crafting endpoint (a malicious call participant
running a modified client / an in-client payload-substitution patch).**

---

## 5. Threat model & delivery constraint

- **Attacker (P2):** a legitimate participant in a call with the victim — has the negotiated media
  keys and an established encrypted transport — running a modified client that emits crafted media
  protobuf. **Victim:** stock, unmodified. One user action ceiling (answering the call).
- **Delivery approach (Option A):** patch the attacker's own NPL **in memory** at the
  plaintext-before-encryption boundary to substitute crafted bytes; the real session crypto/transport
  then carries them. CFG-OFF + no runtime code-integrity make the in-memory detour execute; only the
  attacker's process is modified.

---

## 6. End-to-end delivery design

### 6.1 Payload (DONE — frozen in `scratch/w3/lead/payload/`)

Decoded from a live `n2fuzz --self` capture (NPL's own Serializer emitting I420 320×240):

| Packet | Bytes | Meaning |
|---|---|---|
| Format announce (type-1) | `08 01 20 b2 01 28 00 30 00` + `08 02 12 14 08 01 10 c0 02 18 f0 01 …` | VideoFormat{subtype=1 **I420**, w=320, h=240} |
| Data (type-2) | `08 02 12 06 08 c0 02 **10 e9 02** 12 05 08 a0 01 10 78 12 05 08 a0 01 10 78 …` | 3× `PacketHeader_Plane`; **plane-0 height = 361 (odd)** |

**The craft:** flip the plane-0 height varint `10 f0 01` (240) → `10 e9 02` (361); submessage length
`12 06` unchanged. Correctness follows by composition of proven links (N2: field2→descriptor
heights; `repro.c`: odd descriptor→sink overflow). For a controlled (not incidental) overflow the
chroma plane payload should be ≥ `copy = (stride*height)>>1`; for a mere crash, the dest over-write
happens regardless (the memcpy writes `copy` bytes into a smaller alloc). Regenerate arbitrary
geometry with `n2fuzz.c --self` (adjust W/H).

### 6.2 Hook (DONE — pinned, `HOOK-SPEC.md`)

Media encryption is a raw C `encryptCallback` invoked **inline** (no thread handoff) from a generic
callback media-sink node (class 0x1a8). **Primary hook `NPL+0x3d134b`** (data-packet `call rax`,
inside slot1 method `0x1803d12b0`):
- **Plaintext serialized-protobuf pointer** at `desc+0x18` (`[rsp+0x38]`), loaded from `frame+0x48`
  (the same field the send node `0x180107870` fills post-serialize). **No separate length arg** —
  the buffer self-sizes.
- **Format(I420) announce** = tag=1 site `0x1803d130f`, gated by `sinkobj+0xe8 != 0` +
  `[frame+0x90] & 0x48`; arm by writing `sinkobj+0xe8 = 1` → the announce descriptor emits before the
  data packet.
- Callback fn ptr `sinkobj+0xd8`, userData `+0xe0` (set once in ctor `0x1803d1370`).
- **Detour:** overwrite the 6 bytes `48 8B 43 68 FF D0` at `0x1803d1347` (`mov rax,[rbx+0x68];
  call rax`) → `E9 <rel32> 90` to a VirtualAlloc'd trampoline (the one in-module cave `0x180025806`
  is 26 B — too small; use an allocated page, optionally two-stage via the cave).
- **Fallback hook:** serialize-output substitution at `0x180107870` (`[rbx+0x48]`), earlier and less
  selective, and cannot synthesize the announce.

### 6.3 Injector logic (design)

A shared trampoline reached from both `call rax` sites reads `tag` at `[rcx+0x08]`:
`tag==1` → write the I420-Format buffer to `[rcx+0x18]`; `tag==0` → write the crafted-video buffer to
`[rcx+0x18]`; then execute the displaced `mov rax,[reg+0x68]; call rax` and return. The injector arms
`sinkobj+0xe8=1` so the announce fires, and selects the **encrypt** instance at runtime (the class is
generic — same code encrypts on send / decrypts on receive).

---

## 7. Implementation status & remaining work

| Component | Status |
|---|---|
| Vulnerability (W1) | **DONE** — executed crash (`repro.exe`) |
| PC-control primitive (W3) | **DONE** — `pcdemo.exe` (+ ASLR-surviving `pcdemo_partial.exe`) |
| Reachability (receiver unclamped, raw-I420) | **DONE** — RE + live instrumentation |
| Payload (crafted wire bytes) | **DONE** — frozen, correctness by composition |
| Delivery hook (R1) | **DONE** — pinned `NPL+0x3d134b` (`HOOK-SPEC.md`) |
| **R1a** buffer object layout at `frame+0x48` | **TODO** — needed for different-length pointer-swap; best resolved by runtime recon (attach to sender, dump the object) |
| **R1b** send-vs-receive instance selection | **TODO** — runtime: match `sinkobj+0xd8` against `encryptCallback` |
| **R1c** announce frame-gate `[frame+0x90]&0x48` | **TODO** — runtime confirm, or drive tag=1 descriptor directly |
| Injector build | **TODO** — recommend a **recon injector** first (hook + dump desc/buffer/instance), then the substitution injector |
| Live 2-endpoint crash test | **TODO** — needs two own accounts/devices; passive `sxe av` catcher only (no hot-path breakpoints) |

**Recommended next step:** a *recon injector* that installs the `0x1803d1347` detour and dumps, at
runtime on the sender during a call, the descriptor, the `frame+0x48` buffer layout, and
`sinkobj+0xd8` — resolving R1a/R1b/R1c empirically. Then the substitution injector, then the live
test.

---

## 8. Verification / triage methodology

- **Victim-side: passive AV catcher only** (`probe_passive_av.txt`) — attach `cdb -pd`, `sxe av`,
  no code breakpoints (breakpoints on the real-time media path hang the client — observed twice).
  Fires only on a real access violation, then `.detach; qd`.
- **Triage bar:** count only OOB read/write, UAF, type-confusion, int-overflow→bad-alloc; fault addr
  ≥ `0x10000` (else null-deref, discard); not `0xE06D7363` / assert / `_RTC_Check`; reproduces with
  no debugger attached. Expected signature: WRITE AV or delayed `STATUS_HEAP_CORRUPTION 0xC0000374`
  on the media thread; for the partial-overwrite variant, a redirected indirect call.
- **Honesty:** do not fabricate a positive. A crash from debugger over-instrumentation or a
  harness-forced source over-read does **not** count. Distinguish an executed result from an inferred
  one.

---

## 9. Rules of engagement

Own accounts and own machines only; a single consenting call between two own endpoints; benign
crash/diagnostic PoC — no persistence, no exfiltration, no third parties, no production-server abuse
beyond one normal call's signalling. This is authorized security research on the operator's own
target (task WIN condition W3 / attacker position P2).

---

## Appendix A — confirmed offset reference

| Symbol / site | Module + RVA |
|---|---|
| **Sink (overflow)** | WickrPro `0x6e95d0` |
| VV CM video-event handler / GetDescriptor call | WickrPro `0x13e430` / `0x13e4f9` |
| Frame-height forward (arg10) | WickrPro `0x11b6b0` |
| memcpy IAT / malloc thunk | WickrPro `0xd57fe8` / `0x14071625c` |
| `NPLAVPacketGetDescriptor` (verbatim copy) | NPL `0x3d0e50` |
| Geometry setter (9 callers) | NPL `0x136080` |
| Packet ctor (stride@+0x60, height@+0x70) | NPL `0x135a40` |
| `Musigy::AV::Serializer` (RX raw path) | NPL `0x11d240` |
| `AV::Parser::onPacket` | NPL `0x11fce0` |
| `AV::Format::Deserialize` (type dispatch) | NPL `0x13da20` |
| subtype→raw map (`I420`/`YUV420P`→1) | NPL `0x146230` |
| codec factory (`vp8`/`vp9`, len==3 gate) | NPL `0x121430` |
| Format / VideoFormat / PacketHeader_Plane serializers | NPL `0x138270` / `0x139470` / `0x13a630` |
| PacketHeader_Plane height-OR hook (fallback craft) | NPL `0x13a6cf` |
| Send node process fn / serialize dispatcher / call site | NPL `0x107870` / `0x133990` / `0x1079e5` |
| `NPLAVNetSinkGetFormatBlob` / `NPLHubVideoPublish` | NPL `0x3d0760` / `0x3e9150` |
| Hardcoded send codec `"vp8"` | WickrPro `0x14d59f` |
| **encrypt hook (data / announce / slot3)** | NPL `0x3d134b` / `0x3d130f` / `0x3d129a` |
| encrypt slot1 method / slot2 arm / ctor | NPL `0x3d12b0` / `0x3d1220` / `0x3d1370` |
| sink obj fields: callback / userData / announce-flag | `+0xd8` / `+0xe0` / `+0xe8` |
| plaintext source / desc plaintext / desc tag | `frame+0x48` / `desc+0x18` / `desc+0x08` |
| media-sink vtable / primary vtable | NPL `0x4cdc90` / `0x4cdc38` |
| Detour splice bytes @ `0x1803d1347` | `48 8B 43 68 FF D0` → `E9 <rel32> 90` |
| In-module code cave (26 B) | NPL `0x025806` |

## Appendix B — artifact index (`scratch/w3/`)

| File | Role |
|---|---|
| `lead/repro.c` / `repro.exe` | W1 — executed sink overflow (odd height) |
| `lead/pcdemo.c` / `pcdemo.exe` | W3 — vtable overwrite → PC control |
| `lead/pcdemo_partial.c` | W3 — ASLR-surviving 2-byte partial overwrite |
| `lead/oddheight_inject.c` | in-memory detour template (validated on live process) |
| `lead/probe_passive_av.txt` | victim passive AV catcher (no hot-path BPs) |
| `lead/payload/` | frozen crafted wire bytes (format announce + odd-height data hdr) |
| `n2/n2fuzz.c` | Serializer byte generator + receive-path pusher |
| `notes/HOOK-SPEC.md` | full encrypt-callback hook spec |
| `notes/ASLR-ASSESSMENT.md` | ASLR/CFG posture + bypass analysis |
| `notes/RAW-I420-PATCH-PLAN.md` | reachability verdict (stock sender NO-GO) |
| `notes/FINDING-odd-height-heap-overflow.md` | the finding (W1/W3, reachability, ASLR) |
| `notes/IMPLEMENTATION-STATUS.md` | live implementation tracker |
