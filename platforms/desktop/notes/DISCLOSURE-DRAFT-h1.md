# Disclosure drafts — AWS Wickr Desktop 6.72.20.0 (Windows)

Two separate reports. They are deliberately **not** bundled: they have different evidence profiles and
different fixes, and bundling would let the one with open links drag down the one that is fully
demonstrated.

Artifacts, both reports:
`NPL.dll` sha256 `a031e7aae15fb2a80b51522c0dd211bca393d9ba98cc267e65ff6e938a1d78d5`
`WickrPro.exe` sha256 `eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`
(shipped installer and installed copy are byte-identical)

Testing was done on operator-owned machines and two operator-owned accounts. No traffic was directed at
any third party, no fuzzing was run against Wickr production servers, and no destructive proof-of-concept
was executed.

---
---

# REPORT 1 — A call participant can drive a remote heap out-of-bounds write in another participant

**Class:** CWE-787 (out-of-bounds write), with a CWE-125 out-of-bounds read on the same packet
**Attacker:** any authenticated participant in a call with the victim
**Victim interaction:** none beyond being in the call
**Status:** demonstrated end to end over the wire, byte-for-byte

## Summary

`Musigy::AV::Parser`'s `kind==2` handler binds a **peer-declared length** onto the **actually received,
shorter** payload buffer and never compares the two. That length reaches WickrPro's media decrypt
callback and drives `memset(realPtr, 0, peerLength)`, writing an attacker-chosen number of zero bytes past
the end of a heap allocation in the unsandboxed main process.

The same function's **sibling branch performs exactly the bounds check the vulnerable branch omits**,
which is the clearest evidence that this is a defect and not a design decision.

## Technical detail

### The substitution — `NPL.dll`

`Musigy::AV::Parser`, `kind==2` handler at `0x18011ef70`. When `PacketHeader.buffer` is present (the
stock serializer sets it for encoded audio), the handler takes the peer's declared size and the real
payload pointer and passes both to the Frame constructor with no comparison:

```
0x18011efac  test  byte ptr [rdx+0x10], 1    ; has-bit: is PacketHeader.buffer present?
0x18011efb0  je    0x18011f0a8               ;   absent -> the PLANE branch (bounds-checked!)
0x18011efc4  cmovne r14, rax                 ; protobuf _internal_buffer()
0x18011efef  mov   r8d, dword ptr [r14+0x18] ; arg3 size := PEER-DECLARED
0x18011eff3  mov   rdx, qword ptr [rsi+0x10] ; arg2 data := the REAL payload
0x18011effa  call  0x180135ea0               ; Frame ctor
```

`Buffer.size` is protobuf field 1 of `Musigy::AV::Proto::PacketHeader_Buffer`, an `optional int32` stored
with no clamp (`mov [rbp+0x18], edx` at `0x18013aa2c`). Range 1..0x7FFFFFFF.

The Frame constructor `0x180135ea0` neither copies nor clamps — with a pointer supplied the object stays
`0xd0` bytes and simply stores the pair:

```
0x180135eb4  mov  r14d, r8d                    ; the PEER-DECLARED size
0x180135ff9  mov  qword ptr [rsi+0x40], rbp    ; plane[0] base = the real payload pointer
0x18013603e  mov  qword ptr [rsi+0x10], rbp
0x180136049  mov  dword ptr [rsi+0x18], r14d   ; +0x18 = the PEER-DECLARED size
```

### Why this is a defect — the sibling branch does the check

When `buffer` is absent, control reaches `0x18011f0a8`, which precomputes each received buffer's real end
and rejects any declared extent that does not fit:

```
0x18011f1ac  imul r10d, eax                        ; declared extent
0x18011f1bd  add  r10, rdx                         ; base + declared extent
0x18011f1c0  cmp  r10, qword ptr [rbp+r14*8-0x78]  ; vs the REAL buffer end
0x18011f1c5  jbe  0x18011f1cf                      ; fits -> keep
0x18011f1c7  mov  rdx, r12                         ; does not fit -> NULL the pointer
```

Twenty instructions apart, in one function: one branch validates, the other does not.

### Where it lands — `WickrPro.exe`

The consumer is the media decrypt callback at `0x14013f390`:

```
0x14013f3df  call [0x140d53928]      ; NPL!NPLAVPacketGetBuffer -> ptr, n
0x14013f3f2  mov  r8d, [rsp+0x30]    ; n   = PEER-DECLARED size
0x14013f3f7  mov  rdx, [rsp+0x38]    ; src = the REAL (shorter) payload
0x14013f401  call [0x140d54098]      ; QByteArray(const char*, qsizetype)  <== heap OOB READ
0x14013f44e  call 0x140b250f0        ; decrypt
0x14013f458  call [0x140d54100]      ; QByteArray::length()
0x14013f461  jle  0x14013f48e        ; empty plaintext -> memset path
0x14013f48e  mov  r8d, [rsp+0x30]    ; n   = PEER-DECLARED size
0x14013f493  xor  edx, edx           ; c   = 0
0x14013f495  mov  rcx, [rsp+0x38]    ; dst = the REAL payload
0x14013f49a  call 0x140718e87        ; VCRUNTIME140!memset  <== heap OOB WRITE
```

`NPLAVPacketGetBuffer` (`NPL 0x1803d0de0`) returns `n = [Packet+0x18]` verbatim — `mov eax,[rcx+0x18]`
at `0x1803d0e10`, no arithmetic.

### The over-write is the guaranteed outcome, not an edge case

The media AEAD is **AES-256-GCM** with the tag verified and the result checked
(`EVP_DecryptFinal_ex` at `0x140cb8bb6`, `cmp eax,1 / jne` at `0x140cb8bbb`; failure frees the output and
returns NULL, so `QByteArray::length()` is 0 and the `memset` arm is taken). The wire framing is
`algo(1) || IV(12) || TAG(16) || ciphertext`, so **the tag sits inside the payload the attacker really
sent** — inflating the declared length cannot damage it, it only extends the authenticated ciphertext
with adjacent heap bytes the attacker does not control. Authentication therefore fails by construction,
and the zero-fill is the default result of the attack.

## Reproduction

Two owned accounts, two machines. Sender is patched; the victim is unmodified and only passively
instrumented.

**1. Sender — 11 bytes at `NPL` RVA `0x11d592`** (inside `Musigy::AV::Serializer::onPacket`), so the
declared size becomes a constant `C` instead of the real length:

```
original: 41 8b 4e 18   mov ecx,[r14+0x18]      ; real payload length
          83 48 10 01   or  dword [rax+0x10],1  ; Buffer field-1 has-bit
          89 48 18      mov [rax+0x18],ecx      ; Buffer.size = real
patched : 83 48 10 01   or  dword [rax+0x10],1  ; keep the has-bit
          c7 40 18 <imm32>                      ; mov dword [rax+0x18], C
```

Apply with **no call active** — the send graph is built once per call. Then place a fresh call.

**2. Victim — two 5-byte passive detours** bracketing the `memset`, snapshotting adjacent heap before and
after, in-process:

```
0x14013f495  48 8b 4c 24 38  mov rcx,[rsp+0x38]   <- snapshot BEFORE
0x14013f49a  e8 e8 99 5d 00  call memset
0x14013f49f  48 8d 4c 24 48  lea rcx,[rsp+0x48]   <- snapshot AFTER
```

## Evidence

**The peer controls the length — measured.** Sender pinned to `C = 300`; victim unmodified:

| | baseline (unpatched) | patched, C = 300 |
|---|---|---|
| `Buffer`-branch packets | 69 | 44 |
| **distinct `n` values** | **21** | **2** |
| `n == 300` | **0** | **43** |
| `n == 301` (baseline's dominant value) | 43 | **0** |

`n == C` exactly, 43/43, with no offset. A value that never occurred in 243 benign records becomes the
entire class. No benign sender can produce a constant `n` across frames whose real sizes vary.

**The write goes out of bounds — measured byte-for-byte.** Benign payloads measure 181–319 bytes, so any
offset ≥ 384 is certainly outside the allocation. Across three runs at `C` = 640 / 768 / 4096, sampling
offsets +304 … +752, **1392 samples: 402 (28.9 %) were live non-zero bytes that the `memset` zeroed.**
Example pair (C = 4096, offset +1024, 64 bytes):

```
before: 5a e5 b1 ac d1 18 cc f2 35 e5 49 49 08 ca 56 c9 3d fb 0f 18 7d 8b 3b c1 ...
after : 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...
zero bytes: before 0/64   after 64/64
```

**The corruption reaches live objects and crashes the client.** Two distinct faults, both minidumps
captured by the app's own Crashpad (`%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\crashpaddb\reports\`):

* `d3d11!CResource<ID3D11Resource>::Map+0x50`, reading `0x473`, on the Qt Quick render thread. The
  faulting field is at `rdx+0xA0 = 0x801128bc10`, which is **3140 bytes past** the payload pointer
  `0x801128afcc` whose 4096-byte `memset` was measured on the same run — inside the zeroed range.
* `NPL.dll+0xe2074`, reading `0xa6`, on the media thread: a queued
  `Musigy::NPL::Net::XorFecDecoder` packet whose data pointer (offset 0) had been zeroed.

The client's own log confirms the failure arm was taken:
`[W AV.CryptProxy] All bytes set to zero, decryption failed most likely`.

## Impact

Remote, repeatable, attacker-length-controlled zero-fill of adjacent heap in a process that hosts both
media and UI, with **CFG absent in both modules, no CET, and the default NT heap**. Demonstrated effect
is memory corruption reaching live objects and crashing the client.

**We did not achieve code execution through this defect and do not claim it.** We attempted it and
established the limits by measurement: the reachable arm writes zeros only, and there is no
information-disclosure path back to the attacker (measured pointer density in the reachable adjacency was
1 in 1392 samples). Those limits are properties of *this* sink, not guarantees — see Report 2 for a
second defect in the same product where content control **is** present.

## Suggested remediation

1. **In the `kind==2` handler at `NPL 0x18011ef70`, apply the bound the sibling plane branch already
   applies:** compare `PacketHeader.Buffer.size` against the actual received payload length before
   constructing the Frame, and reject on mismatch.
2. Defence in depth: have the decrypt callback take its length from the buffer it was given rather than
   from the header.
3. **Structural:** authenticate `PacketHeader` — carry it as AAD in the E2E layer. It is currently parsed
   and acted on *before* decryption and is not covered by the AEAD, so header parsing is a
   pre-authentication attack surface. This one change removes an entire class of header-driven defects.

## Appendix — impact scope beyond the calling peer

Reported separately from the main claim because it rests on one inference, and the report above does not
depend on it.

`PacketHeader` is written by the `Serializer` *after* `CryptProxy` encrypts (send scene
`…->VpxEncoder->CryptProxy->Serializer`) and parsed *before* `CryptProxy` decrypts (receive scene
`NetworkSource->Muter->Parser->CryptProxy->…`), so it is outside the end-to-end envelope and is not
authenticated. Separately, the client's media transport terminates at a hub, not at the peer:

* the client opens **one** media port to **one** hub — its own log shows `Hub::Port::BindToUDP` then
  `PortImpl: Connection option (1/2) udp://… (2/2) tls://…`, two transport options to the same hub rather
  than one connection per participant;
* `NPL.dll` exposes **no peer-connect API** — every export is hub publish/subscribe (`NPLHubInitialize`,
  `NPLHubGetPort`, `NPLHubAudioPublish/Subscribe`, `NPLHubVideoPublish/Subscribe`, …);
* the transport authenticates a **server**: `NPLSetServerCertificates` (`0x1803cdcc0`) parses PEM into a
  trust set and `NPL` carries `SSL_CTX_set_verify` / `X509_STORE_add_cert`;
* there is **no SRTP** anywhere in the image.

It follows that the hub can read and rewrite the plaintext `PacketHeader` of every participant while
holding no key material — i.e. the same defect is reachable from the infrastructure, not only from a
calling peer. This is not the generic "if the server is compromised you lose": the end-to-end layer is
working (the hub cannot read the media), and the gap is specifically that the header sits outside that
envelope. Remediation item 3 closes it without changing the server's trust model.

*We did not capture hub-side traffic — that is outside our rules of engagement — so this is a
consequence of the four client-side observations above, not a direct observation of a server-side packet.*

---
---

# REPORT 2 — Use-after-free in the bundled libvpx VP8 decoder, with attacker-controlled write content

**Class:** CWE-416 (use-after-free write) escalating to CWE-787
**Component:** libvpx VP8 decoder statically linked into `NPL.dll` (iface string reports v1.9.0)
**Attacker:** a single call peer
**Status:** primitive fully characterised and measured; **RCE not demonstrated and not claimed**

## Summary

`vp8_de_alloc_frame_buffers` frees the mode-info block and clears `mip`, `prev_mip` and `above_context`,
but **never clears `mi` or `prev_mi`**. `vp8_alloc_frame_buffers` calls de-alloc on entry *and* on its
failure label, so **every** allocation failure leaves `pc->mi` pointing into freed memory. The decoder
context is never torn down (`vpx_codec_destroy` is not linked in), so the next inter frame writes
`mb_rows*mb_cols` MODE_INFO records straight through the dangling pointer.

**The bytes written are chosen by the peer**, and a single peer can arm the allocation failure itself.

## Technical detail

* `vp8_de_alloc_frame_buffers` (`NPL 0x180186320`, 210 bytes, read complete) — frees `mip` and stores 0
  to `+0xc58` (`mip`), `+0xc68` (`prev_mip`), `above_context` and two others; `disfunc | grep -c 0xc60`
  returns 0, i.e. **no store to `mi` (+0xc60)**.
* `vp8_alloc_frame_buffers` (`0x180186080`) calls de-alloc at entry (`0x1801860a4`) and again on its
  failure label (`0x180186293`). Six distinct failure exits all converge there. The only store to
  `+0xc60` in the whole DLL is `0x1801861f6`, on the success path only.
* `vp8_decode`'s setjmp landing pad (`0x18017db24`) zeroes only `ctx->si.w/h` and returns.

Five upstream fixes are absent from the shipped bytes; `44a5eaa3b` and `0226b9516` were each verified
against the shipped disassembly (`0226b9516` is precisely the commit that adds `oci->mi = NULL`).

## Evidence

All results against the **unmodified installed `NPL.dll`** through the public `vpx_codec_decode` wrapper,
with argument-identical values to the live call site — no patched binary, no debugger, no allocator hooks.

**1. The gate is armable by ONE peer — measured.** A 16383×16383 keyframe (34 wire bytes) parks
~2017 MiB of commit. There are **two decoder contexts per publisher**, selected by **bit 14 of
`Frame+0x90`**, which is peer metadata outside the VP8 bitstream:

```
0x180144685  mov r14d, 0x518        ; loop init
0x180144777  cmp r14, 0x528         ; step 8 -> exactly TWO contexts
0x1801447b2  shr eax, 0xe / and al,1 ; selector = bit 14 of Frame+0x90
0x180144b53  mov rbx, [r12 + idx*8 + 0x4a8]
```

So the peer supplies its own memory pressure: park ~2017 MiB in context 0, then aim context 1.
Measured with `gate2ctx.py`: **gate closed at 4100 MiB of free commit, ARMED at 4000 MiB**
(threshold = 2 × 2017 = 4034 MiB), with the dangling state verified. The precondition is therefore
**any victim whose free commit is below ~4 GiB**, not "a 4 GiB machine".

**2. Write content is attacker-chosen — measured 4/4.** VP8 modes and motion vectors are
arithmetic-coded, so a crafted partition 0 is required to select them. With the mode section properly
encoded (all probability tables extracted from the shipped DLL), chosen motion vectors were written
**through the dangling `pc->mi`** into a block the allocator had already handed to a different owner —
4/4 across four separate runs, with a control run using an arbitrary byte payload changing 0 of 1923
bytes. In a healthy decoder, 64/64 macroblocks each carried a different requested vector.

**3. Write density and aim — measured.** SPLITMV yields **68 chosen bytes per 76-byte record**. The
alphabet is constrained: each motion-vector component is an even `int16` in ±2046, so chosen bytes have an
even low byte and a high byte in `0x00..0x07 ∪ 0xF8..0xFF`. `vp8_decode_mode_mvs` performs an extra `mi++`
at the end of every row, leaving one clean, unflanked slot per row.

**4. ASLR-surviving partial pointer overwrite — measured.**
`0x00007ffabcde1234 → 0x00007ffa02460468`: the low 32 bits set to a chosen value with the ASLR-bearing
high 32 bits bit-for-bit intact. **No information leak is required.**

**5. PC control from the primitive — measured, with a qualifier that travels with it.**
One crafted 108-byte inter frame partially overwrote a planted object pointer
(`…0002000000 → …0001000000`, high 32 bits preserved); the vtable was loaded from the redirected object
and slot 0 was called, running the planted function.

> **QUALIFIER: the reclaiming object was supplied by our harness.** This demonstrates that *the primitive
> is sufficient for PC control given a reclaiming object holding a pointer at a reachable offset*. It does
> **not** show that such an object reclaims the freed block in the live WickrPro process.

## What is NOT established

* **A real reclaiming object in the live process** that holds a pointer at one of the reachable offsets.
* **Live over-the-wire delivery.** An offline payload set exists and every frame was verified to decode
  through the installed DLL (the whole single-publisher sequence is 183 bytes of VP8 across five
  packets), but it has not been delivered over a call.

**Consequently RCE is not demonstrated and is not claimed.** What has changed relative to a naive reading
is that the *primitive* questions are closed — gate, content control, density, aim, ASLR-surviving partial
overwrite — and what remains is target selection and live fire.

## Suggested remediation

1. **Update the bundled libvpx.** At minimum cherry-pick `44a5eaa3b` and `0226b9516`.
2. **Tear down and re-create the decoder context on any `vpx_codec_decode` failure.** The context is
   currently never destroyed, which is what lets the dangling pointer survive into the next frame.
3. **Clamp accepted frame dimensions to the negotiated video geometry** before handing the frame to
   libvpx, so a 14-bit header field cannot drive a ~2 GiB allocation (this also removes the arming
   primitive, and is a remote memory-exhaustion fix in its own right — 34 wire bytes → 2017 MiB).
