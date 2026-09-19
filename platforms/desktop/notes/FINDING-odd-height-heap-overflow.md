# FINDING — heap out-of-bounds WRITE in WickrPro.exe video path (odd frame height)

**Status: W1 ACHIEVED — reproducible heap OOB WRITE, executed and independently re-run by the lead.**
Repro: `E:\tmp\wickr\scratch\w3\n2\repro.exe` (source `repro.c`, build `buildrepro.bat`).
Read §0 for the executed result and §5 for the caveats that bound the claim.

## 0. Executed repro — verified twice (N2, then re-run by the lead)

```
[+] WickrPro.exe mapped at 00007FF76C4E0000 (preferred 0x140000000, RELOCATED)
[+] prologue at +0x6e95d0 verified (48 8b c4 4c 89 48 20)

---- CONTROL even height : strideY/U/V=320 width=320 height=240 ----
    [memcpy] alloc=76800 copy=76800 / alloc=38400 copy=38400 / alloc=38400 copy=38400
  -> returned, no fault                                   <-- gate passes first

---- TEST    odd  height : strideY/U/V=320 width=320 height=241 ----
    plane0 alloc=77120 copy=77120 ok
    plane1 alloc=38400 copy=38560 OVERFLOW by 160
    plane2 alloc=38400 copy=38560 OVERFLOW by 160
    [memcpy] dst=0000024FF1910A00 alloc=38400 copy=38560   <<<< COPY EXCEEDS ALLOCATION

================ ACCESS VIOLATION ================
  code 0xc0000005   rip 00007FFBE2750D7B   type WRITE
  addr 0x0000024FF191A000
  rdi=0000024ff191a000   (= block + 38400, first byte past the end)
  r8 =00000000000096a0   (38560 = copy size)
  r14=00000000000000f1   (241   = height)
  r15=0000024ff1910a00   (the 38400-byte block)
```

**Triage:** `ExceptionInformation[0] == 1` → **WRITE**. Fault address `0x24FF191A000` is far above
`0x10000`, so **not a null-deref**. `0xC0000005`, not `0xE06D7363` (C++ EH), not an assert, not an
`_RTC_Check` abort. Caught by an in-process vectored handler — **no debugger attached**.
Scales exactly as predicted: overrun `= stride >> 1`, on **odd heights only**; every even height is
clean across four stride/height combinations.

**Refinement vs the original analysis:** plane 0 is correct (`alloc == copy == stride0*height`);
**planes 1 and 2 are both defective**, each overflowing by `stride/2`.

Attacker position: **P2** (attacker places/joins a call with the victim) — or P1 if the same
descriptor path is reachable from a media message.

---

## 0b. ESCALATION — write-what-where + PC control demonstrated (W3)

The overflow was escalated from "heap OOB write" to **control of the instruction pointer**, driven
by the **real** vulnerable function. Repro: `E:\tmp\wickr\scratch\w3\lead\pcdemo.exe`
(source `pcdemo.c`, build `buildpc.bat`). Executed output:

```
[*] invoking the REAL vulnerable function WickrPro+0x6e95d0 with height=241 (odd)
    [malloc #2] U-plane size=38400 -> ...140000 ; victim placed at ...149600 (block end)
    [memcpy] dst=...140000 (U buffer) alloc=38400 copy=38560  <<<< OVERFLOWS U BUFFER INTO victim
  -> function returned
[*] post-overflow victim->vtable = 00007FF743609810  (was 0xDEAD11111111DEAD)
    => vtable pointer OVERWRITTEN with the attacker-chosen value. write-what-where.
[*] simulating the app's next virtual call on the victim object:
  ##  ARBITRARY CODE EXECUTION: pwned() reached at 00007FF7436034A0
  ##  RIP was redirected through the overwritten vtable.
process exit code = 123 (0x7B)   <-- producible ONLY from pwned(); deterministic proof RIP ran
```

**What is real (unmodified WickrPro code):** the arithmetic `alloc=(h>>1)*stride=38400`,
`copy=(stride*h)>>1=38560`, and the `memcpy` that writes 160 attacker-sourced bytes past the
buffer. The first 8 of those bytes land on the adjacent object's vtable pointer and overwrite it
with an attacker-chosen value; a virtual dispatch through it transfers control to attacker-chosen
code. This satisfies W3 as specified in the brief ("control of PC **or** a write-what-where
primitive") — **both** are shown.

**What the harness supplies stands in for the attacker's real-world control:**
| Exploit ingredient | In the PoC | In a live call |
|---|---|---|
| overflow length | `stride/2` = 160 B | attacker picks `stride` on the wire |
| allocation size | `(h>>1)*stride` = 38400 | attacker picks `stride`/`height` → **LFH bucket selection = grooming** |
| adjacency (victim after buffer) | harness allocator places it | heap grooming — feasible, **not demonstrated on the live heap** |
| overflow content | source U-plane tail set to `&fake_vtable` | the received chroma-plane payload — attacker bytes |
| the virtual call | performed by the PoC | WickrPro's own dispatch on the media object |

**Amplifier — CFG is OFF** on these modules (separately filed hardening finding). The overwritten
vtable/function pointer is therefore **not validated** at the indirect call, so a redirected
pointer executes without a CFG fault. This materially lowers the bar for real-world exploitation.

**Honest boundary:** this is a *primitive demonstration*, not an end-to-end exploit against the
live process. The Wickr install and all Qt6 runtime DLLs were deleted from this machine mid-session,
so the real app cannot be launched here to (a) groom the real heap or (b) reach WickrPro's own
virtual dispatch. The two control-flow stubs (`0x128740→0`, `0x6e8e10→ret`) force the
fresh-allocation branch, which occurs naturally on a stream's first frame / after a format change.
Closing the last gap requires a live install: groom so a vtable-bearing object follows the U-plane
allocation, then let the app dispatch. Everything up to that point is demonstrated.

## 0c. ASLR — pcdemo's absolute-address write does NOT defeat ASLR; the partial-overwrite variant does (bounded)

**Correction to 0b.** `pcdemo.c` writes `&fake_vtable` / `pwned`, absolute addresses known only
inside the harness process. Under ASLR a remote attacker knows no such address, so **pcdemo proves
the hijack *mechanics* (vtable overwrite → RIP redirect) but assumes ASLR is already defeated.** All
7 core binaries are full high-entropy ASLR (`DllCharacteristics` HIGH_ENTROPY_VA + DYNAMIC_BASE,
relocations present — measured), so this assumption is not free.

**But this bug has an ASLR-independent variant, demonstrated with the real function**
(`pcdemo_partial.c` / `.exe`, exit `0x7C`):

```
WickrPro.exe base            = 0x00007FF76C4E0000   (base & 0xFFFF = 0x0000 → 64KB-aligned)
victim->modptr BEFORE        = 0x00007FF76CBC95D0   (real module ptr; high bits ASLR-randomized)
attacker overflow content    = 2 bytes only: 0x1234 (NO absolute address supplied)
strideU=4, height=241        → overflow = stride/2 = exactly 2 bytes
victim->modptr AFTER         = 0x00007FF76CBC1234
   high 48 bits: PRESERVED (0x00007ff76cbc unchanged)
   low  16 bits: 0x95d0 → 0x1234  == attacker's chosen offset
```

Because every Windows x64 module base is 64 KB-aligned, the **low 16 bits of any module pointer are
ASLR-invariant**. The overflow length is byte-tunable via `stride` (`stride=4`→2 bytes,
`6`→3, `8`→4) and the content is fully attacker-controlled, so a **2-byte partial overwrite is fully
deterministic** and needs no info leak.

**Bound, stated precisely so this is not over-sold:** a deterministic 2-byte overwrite retargets the
pointer only **within its original 64 KB-aligned block** (bits ≥16 come from the randomized base and
are preserved, not chosen). It is useful iff a gadget / alternate vtable sits in that same 64 KB
window. Reaching an *arbitrary* module offset needs ≥3 bytes, whose bits [16:24) depend on the
randomized base — i.e., that step **does** require an info leak. So:
- **ASLR-independent (proven):** redirect an adjacent object's module pointer within its own 64 KB
  block, byte-exact, no leak. With **CFG OFF** (measured) the redirected pointer is not validated at
  the indirect call.
- **Arbitrary control:** still wants an info leak, OR a non-ASLR module — see the live-process
  check below.

### Live-process ASLR sweep — the "non-ASLR module" bypass is CLOSED (measured on the running client)

After the user reinstalled and logged in, the running `WickrPro.exe` (PID 17368) was found to be
**byte-identical** to the analyzed build (`WickrPro.exe` sha256 `eccafde8…41dbd`, `NPL.dll` sha256
`a031e7aa…d78d5`; `+0x6e95d0` prologue matches), so every offset here is valid against the live
client. Enumerating **all 214 loaded modules** and decoding each `DllCharacteristics`:

```
total modules checked : 214
NON-ASLR (DYNAMIC_BASE off) : 0
ASLR-on but NOT high-entropy : 0
```

Every module — including all 75 bundled ones (Qt6*, NPL, Sock5, WinSparkle, sentry.dll, the image
plugins qjpeg/qgif/qwebp/…, crypto/ssl, VCRUNTIME/MSVCP) — is `DYNAMIC_BASE | HIGH_ENTROPY_VA`.
**There is no fixed island.** This removes the easiest ASLR bypass and confirms, on the real
process, that arbitrary control requires an **information leak**. The bounded 64 KB partial-overwrite
(§0c) remains available without one.

See `ASLR-ASSESSMENT.md` for the full posture and bypass analysis.

## 0d. Live end-to-end trigger kit (network path) — built and validated read-only

To demonstrate the crash over a real call, the **sender** must emit an odd video plane height on the
wire. NPL.dll is Authenticode-signed and WickrPro imports `WinVerifyTrust`, so rather than modify
NPL on disk, `oddheight_inject.exe` (source `oddheight_inject.c`) patches the sender's NPL **in
memory** after it loads the genuine signed DLL — CFG-off + no runtime code-integrity make the
in-memory detour succeed, it sidesteps any signature check, and it touches only the attacker side.

The patch is a detour on `NPL!PacketHeader_Plane::_InternalSerialize`:
```
RVA 0x13a6cf  movsxd rax,[rsi+0x1c] ; lea rdx,[rbx+1]  →  jmp cave + nops
cave (RVA 0x25806)  movsxd rax,[rsi+0x1c] ; OR rax,1 ; lea rdx,[rbx+1] ; jmp back
```
`or rax,1` sets bit 0 of the serialized height varint → **odd height on the wire**, for every
outgoing plane. rel32s are position-independent, so it works at any ASLR base.

**Validated against the live client (read-only):** `oddheight_inject.exe 17368 check` located
NPL.dll at `0x7FFB4EDA0000` in the running WickrPro and confirmed the target bytes
(`48 63 46 1c 48 8d 53 01`) match — without patching. The tooling is proven against the real
process; the actual crash is gated only on a two-endpoint call the operator drives (see the runbook
in the session log). One residual unknown to be resolved empirically at call time: whether odd wire
height reaches the sink for the negotiated video format (it is confirmed to flow through the
descriptor path; VP8 vs raw/MJPG framing determines whether the sink runs per event).

## 0e. Live reachability investigation — normal calls NEGATIVE; raw-I420 path is the open door

Tested against the live logged-in client (build byte-identical to analysis). Findings:

**Normal VP8 video call — NOT reachable (confirmed live).** The vulnerable sink runs on real calls
(instrumented: 700 hits), but the plane geometry it receives is **decoder-derived** and therefore
**even** (measured `h=360`; codecs require even dims for chroma subsampling). The 9 callers of the
geometry setter `0x136080` split into decoder/converter paths (`VpxDecoder`, `ColorspaceConverter`,
`VideoResizer`, `DShowCamCapture` — all even) and one **wire path** (`Musigy::AV::Serializer`).
A sender-side patch forcing `PacketHeader_Plane` height odd had **no effect** on the sink height,
because a VP8 sender never populates that wire message. So decoded video cannot supply odd geometry.

**The raw-I420 path is the real exploitable route.** The video-format ctor `0x180145d70` +
subtype mapper `0x180146230` accept **raw pixel subtypes** (`I420`/`NV12`/`YUV420P`), distinct from
the codec factory `0x180121430` (`"vp8"`/`"h264"`). Raw I420 carries plane geometry straight off the
wire (no decoder → no even constraint), through `Musigy::AV::Serializer` → geometry setter → sink.
This is the path N2's harness exercised via a direct `AV::Parser::onPacket` call.

**Patchability (step ① answer): the codec/format selection is a STRING dispatch (`"vp8"` vs `"I420"`),
so forcing the sender to raw I420 is patch-achievable in principle — a from-scratch custom client is
NOT strictly required.** The exploit would be a two-part sender patch: (1) force the send subtype to
raw `I420`, (2) force plane height odd (the existing `PacketHeader_Plane` patch, which fires on this
path).

**Three unconfirmed blockers, each potentially fatal:**
1. Exact send-side subtype-selection point not yet located (WickrPro vs NPL; whether negotiated).
2. Whether forcing raw I420 makes the sender's graph actually transmit raw planes (vs. failing with
   no encoder in the graph).
3. Whether the victim accepts a **peer-forced** raw-I420 VideoFormat mid-call and routes it to the
   sink **unclamped** — the code supports the format, but peer-negotiability over a real call is
   unverified.

**Honest status: remote reachability is PLAUSIBLE and patch-achievable, but UNCONFIRMED.** Normal
calls are a confirmed dead end; the raw-I420 path is real in the receiver but its peer-triggerability
has not been demonstrated end-to-end.

## 0f. Step-② verdict (multi-agent RE, `RAW-I420-PATCH-PLAN.md`) — receiver reachable, stock-sender patch NO-GO

Three facts, each with quoted disasm (verified by the synthesizer):

1. **Receiver is UNCLAMPED and endpoint-agnostic (CONFIRMED).** On the raw-I420 receive path, wire
   plane height flows verbatim `proto+0x1c → heights[] → geom setter 0x180136080 → packet+0x70 →
   descriptor+0x10 → sink 0x1406e95d0`. **No odd/even test, no round-to-even, no dimension cap, no
   format-negotiation rejection** — format apply is unconditional and dispatches purely off the
   peer-announced `format.type`/`subtype` (`subtype2code 0x180146230`: `I420`/`YUV420P`→raw). So the
   victim overflows for **any endpoint that puts `Format(subtype=I420)` + odd-height
   `PacketHeader_Plane(stride>0)` protobuf on the wire.** This is the important elevation: the remote
   attack surface is real and unmitigated on the receive side.

2. **A stock-WickrPro sender patch CANNOT deliver it (CONFIRMED — decisive blocker).** The legitimate
   send video graph is **encoder-only**. The NetSink send serializer emits a **single coded buffer**
   (`[rdi+0x80]` ptr, `[rdi+0x18]` size, `[rdi+0x98/0x9c]` w/h) with **no plane iteration and no
   `PacketHeader_Plane` population** — that message is a receive-side construct. The codec string is
   a hardcoded `"vp8"` (`WickrPro 0x14014d59f`, single xref, patchable) but flipping it to `"I420"`
   makes the codec factory (`NPL 0x180121430`, len==3 gate + strcmp vp8/vp9) return NULL → encoder
   aborts → `NPLHubVideoPublish` fails → **nothing transmitted**. Hence the existing
   `PacketHeader_Plane` height-OR injector is **inert on send** — exactly matching the live VP8
   null-result. No flip/repoint patch on a stock sender can emit odd-height plane protobuf.

3. **What WOULD reach it: a crafting endpoint (malicious call peer / MITM).** Emit
   `Format(subtype="I420")` + odd-height `PacketHeader_Plane` protobuf directly, below the encoder
   graph, using the real call's keys/transport (a legitimate participant has them). Options: a
   new-code send-path payload-substitution patch, or a custom protocol client. Both are substantial
   builds; neither is "flip a stock sender."

**DEFINITIVE REACHABILITY CONCLUSION:** the bug is a **remotely reachable, unclamped heap overflow
triggerable by a malicious call participant** (attacker position P2 — a peer in the call running a
modified/custom client). It is **NOT** triggerable via a stock client, patched or not, because the
stock send graph never emits raw plane protobuf. End-to-end PoC delivery (building the crafting
endpoint) was not performed; everything up to it — the receiver accepting and overflowing on
attacker wire geometry, unclamped — is confirmed by RE + N2's `onPacket` harness.

## 1. The bug

`WickrPro.exe` `0x1406e95d0` sizes a plane buffer one way and copies into it another way:

```
; ALLOCATION  -- rounds the height DOWN first
0x1406e977e  mov   ebx, r14d              ; ebx = height          (r14d = [rbp+0x97])
0x1406e9781  mov   ecx, dword [rbp+0x7f]  ; ecx = stride1
0x1406e9784  shr   ebx, 1                 ; ebx = height >> 1
0x1406e97a6  mov   eax, ebx
0x1406e97a8  imul  eax, ecx               ; eax = (height>>1) * stride     <-- ALLOC SIZE
0x1406e97cd  call  0x14071625c            ; allocate eax bytes
0x1406e97d2  mov   r15, rax               ; r15 = destination buffer

; COPY  -- multiplies FIRST, then halves
0x1406e981a  mov   ebx, dword [rbp+0x7f]  ; ebx = stride1 (reloaded)
0x1406e9838  imul  ebx, r14d              ; ebx = stride * height
0x1406e983c  mov   r8d, ebx
0x1406e983f  shr   r8, 1                  ; r8  = (stride * height) >> 1   <-- COPY SIZE
0x1406e9842  mov   rdx, qword [rbp+0x67]  ; source = plane pointer
0x1406e9846  mov   rcx, r15               ; dest   = the buffer sized above
0x1406e9849  call  0x140718e5d            ; memcpy
```

`0x140718e5d` is **CONFIRMED `memcpy`** — it is `jmp qword ptr [rip+0x63f185]` → IAT `0x140d57fe8`
= `VCRUNTIME140.dll!memcpy`.

For height `H = 2k+1` (odd) and stride `S`:
```
alloc = (H>>1) * S = k*S
copy  = (S*H)>>1  = (2kS + S)>>1 = k*S + (S>>1)
overflow = floor(S / 2) bytes
```
**Heap overflow of `stride/2` bytes whenever the frame height is odd.** The overflow length is
attacker-influenced, because the stride is attacker-supplied.

**The same mismatch occurs twice more**, for the other chroma plane:
```
alloc  0x1406e97e0  imul ebx, dword [rbp+0x87]   ; (height>>1) * stride2
copy   0x1406e9855  imul r8d, r14d ; shr r8,1     ; (stride2 * height) >> 1
```

## 2. The inputs are attacker-controlled — chain CONFIRMED end to end

| Step | Evidence |
|---|---|
| Wire → NPL | `AV::Parser::onPacket` @ NPL `0x18011FCE0` → protobuf `ParseFromArray` → `PacketHeader.type==1` → `AV::Format::Deserialize` @ `0x18013DA20` |
| Geometry fields are protobuf | `PacketHeader_Plane.field1/field2` at `[rcx+0x18]`/`[rcx+0x1c]`; `_InternalSerialize` @ `0x18013a630` maps field 1→`+0x18`, field 2→`+0x1c`; a **captured live packet** contains `12 06 08 c0 02 10 f0 01` = 320 and 240 |
| NPL → app | exported `NPLAVPacketGetDescriptor`, imported by `WickrPro.exe` (IAT `0x140d53930`) |
| Descriptor read | `WickrPro` `0x14013e4f9`; reads `desc+0x28/+0x2c/+0x30` (strides) and **`desc+0x38` (height)** |
| Forwarded verbatim | `0x14011b6b0` copies incoming stack args `[rsp+0xc8..0xf0]` → `[rsp+0x28..0x50]` with no transformation, then `call 0x1406e95d0` |
| Arrives as the multiplicands | `[rbp+0x77]`=strideY(arg6), `[rbp+0x7f]`=strideU(arg7), `[rbp+0x87]`=strideV(arg8), `[rbp+0x8f]`=width(arg9), **`[rbp+0x97]`=height(arg10)**; args 3/4/5 are the three source planes |

**Arg-slot arithmetic (this is the load-bearing join — LEAD-DERIVED, SINGLE SOURCE).**
Intermediate `0x14011b6b0` frame = `0x18` (home stores) + 3 pushes + `sub rsp,0x80` = `0x98` below
entry, so its incoming stack args land at `[rsp+0xc0..0xf0]`; it copies `[rsp+0xc8..0xf0]` →
`[rsp+0x28..0x50]` with no transformation. Site-1 loaded and pushed:
```
0x14013e50c mov ebx, [rbp+0x98]   ; desc+0x38 = heights[0]
0x14013e512 mov r13d,[rbp+0x88]   ; desc+0x28 = strides[0]
0x14013e519 mov edi, [rbp+0x90]   ; desc+0x30 = strides[2]
0x14013e51f mov esi, [rbp+0x8c]   ; desc+0x2c = strides[1]
...
0x14013e547 mov [rsp+0x48], ebx   ; -> arg10 -> sink [rbp+0x97] = HEIGHT
```
so **sink arg10 (height) == descriptor+0x38 == heights[0]**, which
`NPLAVPacketGetDescriptor` copies verbatim from packet+0x70, which the packet ctor copies verbatim
from the Parser's height array, which is protobuf `PacketHeader_Plane.field2`.

### ✅ JOIN INDEPENDENTLY CORROBORATED — two methods, both deliberately different from the original

**(A) Descriptor layout — measured, not read.** `NPLAVPacketGetDescriptor` is a pure memory-copy
leaf (no calls, no imports), so it can be invoked directly even though the Wickr install directory
and all Qt6 DLLs are gone from this machine. Loaded NPL.dll with
`LoadLibraryExW(DONT_RESOLVE_DLL_REFERENCES)`, verified the prologue bytes
(`48 83 ec 08 4c 8b d1`), built a synthetic packet with a distinct sentinel in every field, and
called it for real (`verify_join.py`). Measured result:

```
desc+0x00 <- packet+0x18
desc+0x08..0x20 <- packet+0x40+i*8   (plane pointers)
desc+0x28..0x34 <- packet+0x60+i*4   (STRIDES)   desc+0x28 == 0xc0000060  CONFIRMED
desc+0x38..0x44 <- packet+0x70+i*4   (HEIGHTS)   desc+0x38 == 0xd0000070  CONFIRMED
```
This is an executed measurement and does not depend on reading the disassembly correctly.

**(B) Arg-slot arithmetic — from UNWIND_INFO, not hand-counted.** `RUNTIME_FUNCTION` for
`0x14011b6b0` → unwind RVA `0x3331a0c`: **3 pushes (0x18) + alloc 0x80 = frame 0x98**, so incoming
arg5 sits at `[rsp+0xc0]` and **arg10 at `[rsp+0xe8]`**. The intermediate's forwarding code reads
exactly `[rsp+0xe8]` and writes `[rsp+0x48]` — i.e. **arg10 in, arg10 out**, unmodified. Agrees
with the original hand-count.

> **Method note, recorded because it nearly produced a false result:** my first UNWIND_CODE walker
> reported "5 pushes → frame 0xa8", contradicting the hand-count. That was a bug in *my parser* —
> MSVC encodes `mov [rsp+X], reg` as `UWOP_SAVE_NONVOL` (2 nodes) and my walker consumed 1, then
> misread the following code as a push. Fixed node counts for opcodes 3/4/5/8/9/10; it then agreed.
> The disagreement was an artefact, not a finding.

**Severity consequence:** the height reaching the defective multiply is
`descriptor+0x38` = `packet+0x70` = the Parser's unclamped copy of peer-supplied protobuf
`PacketHeader_Plane.field2`. **The overflow is remote-triggerable by the calling peer.**

Still lead-derived (single source): the identification of site-1 `0x14013e430` as the VV CM video
event handler rests on its string table. That names the *caller*, not the data flow, and the data
flow above no longer depends on it.

## 3. No even-height clamp exists in the chain — NEGATIVE search, commands stated

Scanned all three functions (`0x14013e430..0x14013ef34`, `0x14011b6b0..0x14011b7d8`,
`0x1406e95d0..0x1406e98b0`) for `and reg, ~1` / `test reg,1` / `bt reg,0` / round-up patterns:
- geometry sink `0x1406e95d0`: **0 guards**
- intermediate `0x14011b6b0`: **0 guards**
- site-1 consumer: one `test bl, 1` @ `0x14013e6b7`, on an unrelated byte flag, different branch

**Nothing forces the height even before it reaches the multiplies.**

## 4. Relationship to the other NPL bug

This is **distinct from, and stronger than**, the NPL-side 32-bit `imul` wrap at `0x18011f1ac`.
That one is self-consistent — NPL and WickrPro both compute the same wrapped product, which is why
fuzzing NPL produced no fault. **This one is an alloc/copy asymmetry inside WickrPro.exe and does
not depend on any wrap at all** — it triggers at ordinary small resolutions, simply with an odd
height.

## 5. What is still MISSING before this can be called proven

1. ~~**No executed repro.**~~ **DONE — see §0.** Predicted 160 bytes, observed 160 bytes.

   **Caveats that bound the claim, stated plainly:**
   - The harness stubs two functions to steer control flow to the **fresh-allocation** branch:
     `0x140128740 -> return 0` (cache miss) and `0x1406e8e10 -> ret`. This emulates a state that
     occurs naturally — the first frame of a stream, or the frame after a format change, must
     allocate — but it *is* a patched control path. **The size mismatch itself is computed entirely
     by unmodified WickrPro code**; the stubs do not touch the arithmetic.
   - The **guard page is the detector, not the cause**. Without it the 160 bytes silently corrupt
     adjacent CRT heap, which is the real-world behaviour.
   - `LoadLibraryW` was impossible because **the Wickr install directory no longer exists on this
     machine** and no `Qt6*.dll` is present. N2 used
     `LoadLibraryExW(DONT_RESOLVE_DLL_REFERENCES)` + hand-bound only the reached thunks, verifying
     the prologue bytes at `+0x6e95d0` before trusting the mapping. The staged binaries in
     `E:\tmp\wickr\desktop\binaries\` are intact, so the repro remains reproducible.
2. ~~**Does NPL clamp height to even before publishing the descriptor?**~~ **CHECKED — NO CLAMP
   EXISTS. This killer is dead.** The entire NPL-side path is verbatim, with zero masking:
   - Parser reads the protobuf fields and stores them unmodified:
     `0x18011f196 mov eax,[rcx+0x18]` → `0x18011f199 mov [rbp+rbx+0x3e0],eax` (stride);
     `0x18011f1a0 mov r10d,[rcx+0x1c]` → `0x18011f1a4 mov [rbp+rbx+0x3d0],r10d` (height).
   - `0x180136080` is only an allocator + forwarder (allocates 0xd8, calls `0x180135a40`).
   - Packet constructor `0x180135a40` stores them verbatim — **`and` instruction count = 0**:
     ```
     0x180135ae1  mov r8d, dword ptr [rsi]     ; stride0
     0x180135ae4  mov dword ptr [r15+0x60], r8d ; packet+0x60
     0x180135ae8  mov r9d, dword ptr [r14]     ; height0
     0x180135aeb  mov dword ptr [r15+0x70], r9d ; packet+0x70
     ```
     and identically for indices 1–3 (`+0x64/+0x74`, `+0x68/+0x78`, `+0x6c/+0x7c`).
   - `NPLAVPacketGetDescriptor` (`0x1803d0e50`) is a **pure copy loop** — packet`+0x60`→desc`+0x28`
     (strides), packet`+0x70`→desc`+0x38` (heights). No arithmetic, no masking, no clamping.

   Incidentally the same function contains **another** 32-bit geometry multiply:
   `0x180135b8e imul r8d, r9d` → `mov [r15+0x18], r8d`, i.e. `packet+0x18 = stride0*height0`
   computed in 32 bits.

   **Net: an odd height supplied on the wire reaches the WickrPro multiplies unmodified.**
3. ~~**Allocator slack.**~~ **CHECKED — plain `malloc`. No meaningful slack.**
   `0x14071625c` → `0x140716218` → `0x140716232 call 0x140718ef9` →
   `jmp qword [rip+0x63f541]` = **`api-ms-win-crt-heap-l1-1-0.dll!malloc`**, wrapped in the standard
   `operator new` retry-on-NULL loop. The matching release is
   `0x14071606c` → `0x140718ec3` = **`free`**. The Windows CRT heap rounds to 16-byte granularity,
   so an overrun of `floor(stride/2)` is far outside any slack for realistic strides
   (`stride=320` → **160 bytes**; even `stride=64` → 32 bytes).

4. ~~**Is this the live video render path?**~~ **CHECKED — YES, it is the call video receive path.**
   Site 1 (`0x14013e430`) contains these strings:
   ```
   "[VV CM] Video event NPLAVEventStart received, stream: "
   "[VV CM] Video event NPLAVEventStop received, stream: "
   "[VV CM] Video event NPLAVEventPause / NPLAVEventUnpause received, stream: "
   "[VV CM] Video format change received, stream: "  ", resolution: "  ", angle: "
   "[VV CM] Error! Illegal video event received"
   "NPLAVEventSenderCongestion" / "NPLAVEventReceiverCongestion"
   ```
   **"VV CM" = Video/Voice Call Manager.** This is the handler for video events *received from the
   remote peer*, explicitly including remote resolution changes. It has 0 direct callers and 0
   vtable references, consistent with being registered as an NPL event-queue callback — exactly how
   `NPLAVEvent*` delivery works.

## 6. Why this is worth finishing

It is the only lead in the engagement where an attacker-controlled value reaches a `memcpy` length
that provably exceeds its own allocation, with no wrap required and no feature flag, on the media
receive path. Items 1–4 above are all bounded, cheap checks.
