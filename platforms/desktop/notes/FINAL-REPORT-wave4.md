# AWS Wickr Desktop 6.72.20.0 (Windows) — Wave 4 final report

Engagement: authorised assessment, operator-owned machines and accounts.
Artifacts: `NPL.dll` / `WickrPro.exe` from the shipped installer, plus the installed copy
(`NPL.dll` sha256 `a031e7aae15fb2a80b51522c0dd211bca393d9ba98cc267e65ff6e938a1d78d5`).
Method rules from `W3-GROUND-TRUTH.md` §5 apply: every claim is labelled **CONFIRMED** (disassembled or
measured, with the offset or the pasted output), **INFERRED**, or **REFUTED**.

---

## Verdict

**Wave 4 overturns Wave 3's headline.** Wave 3 closed with "no attacker-reachable memory corruption
demonstrated". That is no longer true.

There is a **peer-reachable heap out-of-bounds write** on the video/audio receive path, reachable from
an ordinary call participant with one crafted packet. It does not involve libvpx at all — it is a
length-substitution defect in the app's own packet plumbing: the peer's declared `PacketHeader.Buffer.size`
is bound onto the *actually received, shorter* payload buffer and never compared against it. The
decisive instructions were re-read by the lead, not taken from a subagent.

Separately, the shipped libvpx 1.9.0 VP8 decoder carries a **use-after-free write** that was reproduced
3/3 against the unmodified installed DLL on the real NT heap, with no debugger, no patched binary and no
allocator hooks, through the public `vpx_codec_decode` wrapper with argument-identical values to the live
call site. Its precondition is an allocation failure — and the same attacker can arm that with a
111-byte keyframe that forces ~2 GiB of commit.

The "stale libvpx" thesis that ranked #1 going into this wave is otherwise **REFUTED**, with the
justification earlier waves never attached: the core VP8 bitstream-to-pixel path received **zero**
upstream memory-safety fixes between v1.9.0 and HEAD.

| # | Finding | Class | Peer-reachable |
|---|---|---|---|
| **F4-1** | `PacketHeader.Buffer.size` substitution → heap OOB write (and OOB read) | CWE-787 / CWE-125 | **YES — DEMONSTRATED LIVE** (peer control of `n` measured end-to-end, 43/43; see F4-1) |
| **F4-2** | libvpx VP8 dangling `pc->mi` after allocation failure → UAF write | CWE-416 | gated on F4-3 |
| **F4-3** | 111-byte keyframe → 2017 MiB commit | resource exhaustion | **YES — CONFIRMED** |
| **F4-4** | `decoded_key_frame` not reset on resize → uninitialised heap use | CWE-908 | **YES — CONFIRMED** |
| F4-5 | plane bound check defeated by 32-bit `imul` truncation | CWE-197 | YES (impact refuted) |
| F4-6 | WinSparkle expat 2.2.9 behind unpinned HTTPS | various | NO (origin/CA only) |
| F4-7 | `Sock5.dll` mapped by default, mbedTLS 2.1.5 dormant | none as shipped | NO |

---

## F4-1 — peer-declared length substituted onto a shorter buffer (CRITICAL)

**Class:** heap out-of-bounds write (zero-fill, attacker-chosen length) plus heap out-of-bounds read.
**Position:** any participant in a call. **Status: CONFIRMED — every link disassembled by the lead.**

### The substitution

`Musigy::AV::Parser`, kind==2 handler, `NPL 0x18011ef70`. When `PacketHeader.buffer` is present — which
the stock serializer sets for *every* encoded-media frame — the handler takes the peer's declared size
and the real payload pointer and hands both to the Frame constructor with no comparison:

```
0x18011efac: f6421001     test  byte ptr [rdx+0x10], 1   ; has-bit: is PacketHeader.buffer present?
0x18011efb0: 0f84f2000000 je    0x18011f0a8              ;   absent -> PLANE branch (bounds-checked!)
0x18011efb6: 488b4230     mov   rax, qword ptr [rdx+0x30]
0x18011efc4: 4c0f45f0     cmovne r14, rax                ; protobuf _internal_buffer()
0x18011efef: 458b4618     mov   r8d, dword ptr [r14+0x18]; arg3 size := PEER-DECLARED
0x18011eff3: 488b5610     mov   rdx, qword ptr [rsi+0x10]; arg2 data := the REAL payload
0x18011effa: e8a16e0100   call  0x180135ea0              ; Frame ctor
```

`Buffer.size` is protobuf field 1 of `Musigy::AV::Proto::PacketHeader_Buffer` (RTTI-confirmed via the
default instance at `0x180530b58`), an `optional int32` stored with **no clamp** by the parser at
`0x18013aa2c` (`mov [rbp+0x18], edx`). Range 1..0x7FFFFFFF.

The Frame constructor `0x180135ea0` neither copies nor clamps: `test r8d,r8d / cmovne rbp,rdx` at
`0x180135ebe`, then `test rbp,rbp / jne` at `0x180135edb` skips the inline-allocation arm, so with a
pointer supplied the object stays `0xd0` bytes and merely stores the `(pointer, length)` pair:

```
0x180135eb4: 458bf0       mov  r14d, r8d              ; r14d = arg3 = the PEER-DECLARED size
0x180135ff9: 48896e40     mov  qword ptr [rsi+0x40], rbp   ; plane[0] base = the real payload pointer
0x18013603e: 48896e10     mov  qword ptr [rsi+0x10], rbp   ; and again at +0x10
0x180136049: 44897618     mov  dword ptr [rsi+0x18], r14d  ; +0x18 = the PEER-DECLARED size
```

`+0x10`/`+0x18` is the pair `VpxDecoder::process` reads; `+0x40`/`+0x18` is the pair
`NPLAVPacketGetBuffer` (`0x1803d0de0`) returns to WickrPro's decrypt callback. One object, one length
field, and that field's value came off the wire.

### Why this is a defect and not a design

**The sibling branch of the same function performs exactly the missing check.** When `buffer` is absent
(raw multi-plane frames), control reaches `0x18011f0a8`, which precomputes the real end of each received
buffer as `base + w*h` (`0x18011f0c4`..`0x18011f156`) and then, per peer-declared plane, refuses the
pointer if the declared extent does not fit:

```
0x18011f1ac: 440fafd0     imul r10d, eax                        ; declared extent
0x18011f1bd: 4c03d2       add  r10, rdx                         ; base + declared extent
0x18011f1c0: 4e3b54f588   cmp  r10, qword ptr [rbp+r14*8-0x78]  ; vs the REAL buffer end
0x18011f1c5: 7608         jbe  0x18011f1cf                      ; fits -> keep
0x18011f1c7: 498bd4       mov  rdx, r12                         ; does not fit -> NULL the pointer
```

Twenty instructions apart, in one function: one branch validates, the other does not.

### Where it lands — the out-of-bounds write

Not in NPL.dll. The consumer is **WickrPro's decrypt callback**:

```
0x14013f3f2: 448b442430   mov  r8d, dword ptr [rsp+0x30]  ; n   = PEER-DECLARED size
0x14013f3f7: 488b542438   mov  rdx, qword ptr [rsp+0x38]  ; src = the REAL (shorter) payload
0x14013f401: ff15914cc100 call [rip+0xc14c91]             ; QByteArray(const char*, qsizetype)
                                                           ;   <== heap OOB READ, deep-copies n bytes
0x14013f44e: e89d5c9e00   call 0x140b250f0                ; decrypt
0x14013f458: ff15a24cc100 call [rip+0xc14ca2]             ; QByteArray::length()
0x14013f461: 7e2b         jle  0x14013f48e                ; empty plaintext -> memset path
0x14013f482: 488b4c2438   mov  rcx, qword ptr [rsp+0x38]  ; dst = the REAL payload
0x14013f487: e8d1995d00   call 0x140718e5d                ; memcpy(real, plaintext, plaintext_len)
0x14013f48e: 448b442430   mov  r8d, dword ptr [rsp+0x30]  ; n   = PEER-DECLARED size
0x14013f493: 33d2         xor  edx, edx                   ; c   = 0
0x14013f495: 488b4c2438   mov  rcx, qword ptr [rsp+0x38]  ; dst = the REAL payload
0x14013f49a: e8e8995d00   call 0x140718e87                ; memset   <== heap OOB WRITE
```

Thunks resolved through WickrPro's IAT by the lead rather than assumed:
`0x140718e5d -> VCRUNTIME140!memcpy`, `0x140718e87 -> VCRUNTIME140!memset`.

The practical primitive is the `memset` arm: over-declaring the length makes the ciphertext garbage, so
the decrypt yields nothing and **N zero bytes are written past the end of the received payload
allocation**, N chosen by the peer. A zero-fill of controlled length in an unsandboxed process with CFG
absent, no CET and the default NT heap is a serious corruption primitive even without controlled content.

The same declared size also reaches libvpx — `VpxDecoder::process` at `0x180144ba7`/`0x180144bab` loads
Frame`+0x18`/`+0x10` and calls `vpx_codec_decode` (`0x18017d5c0`) with them, and that wrapper rejects only
a null ctx or a null/zero data pair. No clamp anywhere in between: `PacketMonitor::onPacket` reads the
length for statistics only.

### Amplifier — the header is parsed before decryption and is not authenticated

**CONFIRMED** (re-derived from `Scene::append 0x180116140` interface queries, not from the log line):
the receive graph is `NetworkSource -> Muter -> Parser -> CryptProxy -> PacketMonitor -> VpxDecoder`,
so `PacketHeader` is parsed and acted on **before** the E2E decrypt, and it is **not** carried as AAD.

**Attacker position — narrower than "any network attacker".** NPL.dll carries DTLS
(`DTLSv1_2_client_method` / `DTLSv1_2_server_method` / `'DTLS handshake failed'` at `0x5284c2`,
`0x5284dc`, `0x429bb8`) and **no SRTP whatsoever** (`SRTP` and `srtp_*` regexes: zero matches). Media
therefore rides inside DTLS and an off-path attacker cannot inject. That leaves:

* **a legitimate call participant** — CONFIRMED reachable; they author the protobuf directly;
* **the SFU / hub** — **CONFIRMED 2026-07-31. The transport terminates at the hub.** Settled
  client-side, four independent legs:
  1. The client opens **one** media port to **one** hub — its own log shows `Hub::Port::BindToUDP`
     followed by `PortImpl: Connection option (1/2) udp://…` and `(2/2) tls://…`, i.e. two transport
     options to the *same* hub, not one connection per participant.
  2. NPL exposes **no peer-connect API at all** — every export is hub publish/subscribe
     (`NPLHubInitialize`, `NPLHubGetPort`, `NPLHubAudioPublish/Subscribe`, `NPLHubVideoPublish/Subscribe`,
     `NPLHubGetStreamCount`, `NPLHubPinStream`, …).
  3. The media transport authenticates a **server**: `NPLSetServerCertificates` (`0x1803cdcc0`) parses
     PEM into a trust set (`-----BEGIN CERTIFICATE-----` @ `0x1804cd9a0`), and NPL carries
     `SSL_CTX_set_verify` / `X509_STORE_add_cert`. Peer-to-peer DTLS would pin a per-participant
     fingerprint from signalling instead.
  4. **No SRTP anywhere**, so nothing else protects media below the application layer.

  Combined with the already-confirmed ordering — send is `…->VpxEncoder->CryptProxy->Serializer`, so the
  `Serializer` writes `PacketHeader` *after* E2E encryption, and receive parses it *before* decryption —
  **the hub sees and can rewrite `PacketHeader` for every participant, holding no key material.**

  **⇒ F4-1 is reachable from the server.** The attacker set becomes *the infrastructure, anyone who
  compromises it, and a malicious insider*; the victim set becomes *every participant of every call*;
  the required key material becomes *none*. This breaks the property an end-to-end-encrypted product is
  sold on, and it applies equally to F4-3 and to F4-5's reachability.

  *Residual, stated honestly:* hub-side traffic was never captured (out of scope under the RoE), so this
  is a consequence of the four legs plus the confirmed scene ordering rather than a direct observation of
  a server-side packet. No alternative topology is consistent with a single `Hub::Port` plus
  server-certificate validation.

### A challenge to this finding, and why it fails

F4-1 was challenged by a live-instrumented counter-analysis (`scratch/w3/lead/lenprobe.c`, built
2026-07-31 00:43) which concluded "premise not supported — measured". The lead examined it. **The
challenge fails on all three of its legs, and the finding stands.** Recorded here in full because the
failure mode is instructive.

1. **Its ordering premise is backwards.** The challenge asserts the receive graph is
   `network → CryptProxy(decrypt) → Parser`, and concludes the kind-2 handler "runs AFTER this callback
   and cannot be the source of `n`". The application prints its own scene graphs at call start, and the
   receive scenes are:
   ```
   NetworkSource->Muter->Parser->CryptProxy->PacketMonitor->VpxDecoder->ColorspaceConverter->ProxyVideoOutput
   NetworkSource->Parser->CryptProxy->PacketMonitor->OpusDecoder->AudioOutputStream
   ```
   Parser runs **before** CryptProxy. That the printed order is source→sink rather than sink→source is
   settled independently by the *send* scenes, which end with `...->VpxEncoder->CryptProxy->Serializer`
   — encrypt, then write the wire. So the kind-2 handler is on the correct side of decrypt.
2. **Its field-identity premise is contradicted by the Frame constructor's own stores**, quoted above:
   `Frame+0x18` is written from ctor arg3, which the kind-2 handler loaded from the peer's protobuf at
   `0x18011efef`. `NPLAVPacketGetBuffer` returns exactly `(ptr=[Packet+0x40], n=[Packet+0x18])` — the
   same object and the same field.
3. **Its measurement cannot discriminate between the hypotheses.** `n == payload_len + 29` in 65/65
   samples was captured **on a normal call with a benign sender**. A benign peer declares the truthful
   size, so that observation is produced identically whether or not the field is peer-controlled. The
   probe's stated success criterion — "pointers pair up and `n == len` every time → `n` is the real
   received length" — is an invalid inference.

Leg 3 is this engagement's method rule "check that you are testing the right invariant" failing in the
wild, and it is the reason F4-1's settle is the *sender-side patch*, not a benign packet capture. The
challenge did contribute one correct and useful negative: it independently re-confirmed the code shape
at instruction level and IAT-resolved the same two thunks.

### LIVE END-TO-END DEMONSTRATION — done 2026-07-31. The peer controls `n`. **MEASURED.**

Two machines, two operator-owned accounts, one patched sender and one unmodified victim. Tooling:
`scratch/w3/lead/sizepatch_inject.c` (sender) and the existing `lenprobe.c` (victim). Raw data:
`scratch/w3/lead/lenprobe-baseline.log`, `lenprobe-patched-C300.log`, `E2E-F4-1-RESULT.txt`.

**The experiment, stated before it was run.** A benign capture cannot settle F4-1 (§0.4 of the brief), so
the sender was made malicious. `Musigy::AV::Serializer::onPacket` writes `Buffer.size` from the real
payload length at `NPL 0x18011d59a`. The 11-byte window at `0x18011d592` was replaced so the field
becomes a **constant C**, decoupled from the real length:

```
orig: 41 8b 4e 18  mov ecx,[r14+0x18]     ; ecx = Packet+0x18 = REAL payload length
      83 48 10 01  or  dword [rax+0x10],1 ; Buffer field-1 has-bit
      89 48 18     mov [rax+0x18],ecx     ; Buffer.size = real
new:  83 48 10 01  or  dword [rax+0x10],1 ; has-bit preserved (protobuf-lite emits only set fields)
      c7 40 18 2c 01 00 00                ; mov dword [rax+0x18], 300
```

Checked by the lead before writing: `ecx` is dead after the window (next reference is a fresh write at
`0x18011d5b2`); a capstone scan of **every** `.pdata` function in NPL.dll found no branch landing inside
`[0x18011d593,0x18011d59d)`; `rax`/`r14`/`rdi`/`rsi` untouched; flag state at the join point identical
(both old and new end with flags from the same `or`). Shipped and installed images are byte-identical
(`NPL.dll` sha256 `a031e7aa…1d78d5`, `WickrPro.exe` sha256
`eccafde833d34386c859d6548e922649c2f58cd15f82998c8bd2966219341dbd`).

**Predicted discriminator, fixed in advance:** H1 → the victim's `n` collapses onto C; H0 → `n` keeps
varying per frame. A constant `n` across frames of differing real size is not producible by any benign
sender.

**Result.**

| | baseline (unpatched) | patched, C = 300 |
|---|---|---|
| decrypt-callback records | 243 | 1530 |
| **`Buffer`-branch packets** | **69** | **44** |
| distinct `n` among those | **21** | **2** |
| `n == 300` (= C) | **0** | **43** |
| `n == 301` (baseline dominant) | 43 | **0** |
| plane-branch packets | 174 (165 distinct) | 1486 (836 distinct) |

Baseline `Buffer`-branch values: `181,183,184,185,186,187,188,192,195,198,207,214,228,243,281,293,294,301,303,309,319`.
Patched: `{300, 230}` — 43 of 44 are **exactly 300**.

**`n == C` exactly — 43/43.** A value that never occurred in 243 benign records becomes the whole class,
and the previously dominant value disappears. **The peer-declared `PacketHeader.Buffer.size` reaches the
victim's decrypt callback verbatim, with no clamp and no comparison against the real received length.
F4-1 is no longer an inference from disassembly; the length operand is demonstrated to be under remote
control.**

### Two corrections this measurement forces on the text above

1. **"the stock serializer sets [`buffer`] for *every* encoded-media frame" is WRONG.** The site is gated
   by `test al,1` on `[Packet+0x90]>>1` (`0x18011d557`..`0x18011d562`), and only packets carrying a
   `Buffer` submessage reach it. Measured: pinning C moved **only** the small-packet class; the
   large-packet class was untouched in 1486 records. Encoded **video** is emitted by the VpxEncoder as a
   single plane (`stride=len, height=1`, per `SEND-PATH-GROUND-TRUTH.md`) and therefore takes the
   **plane** branch — the bounds-checked sibling at `0x18011f0a8`. So the live carrier of F4-1 is the
   **audio (Opus) leg**, not video.

   This is `W4-COMPLETENESS-CRITIC.md` §E1 turned into a measured fact, and it *raises* severity: **the
   victim does not need to enable or receive video at all** — being in a call is enough. It also shows
   the branch asymmetry that is the heart of the finding operating live: the forged constant flowed down
   the unchecked branch and left the checked branch alone.

2. **There is no `+29` in this chain.** `NPLAVPacketGetBuffer` (`0x1803d0de0`) returns
   `n = [Packet+0x18]` verbatim — `mov eax,[rcx+0x18] / mov [r9],eax` at `0x1803d0e10`, with plane
   index != 0 returning 0; no arithmetic anywhere in the accessor. End-to-end, `n == C` with **no**
   offset, which confirms it by measurement as well. The historical `n == payload_len + 29` (65/65) did
   **not** reproduce: across 1773 records lenprobe paired the transport length **zero** times
   (`n==len:0 n>len:0 unpaired:1773`), so that relationship rests on data this engagement can no longer
   reproduce. `W4-COMPLETENESS-CRITIC.md` §C3 is closed accordingly: `Frame+0x18` really is the peer
   field, carried verbatim.

   (One trap recorded so nobody repeats it: lenprobe's per-record dump of the `Packet` dwords *looks*
   like it shows `+0x18 = 272` against `n = 301`. It is a race — the loader reads those dwords
   asynchronously after the hook fired and the `Packet` object is recycled between frames, which is
   visible in the log as consecutive records sharing one `packet=` address with different `ptr=`. Do not
   read the dump as a field comparison.)

### THE OUT-OF-BOUNDS WRITE, OBSERVED BYTE-FOR-BYTE — 2026-07-31, C = 4096

**Status: CONFIRMED by direct measurement, then independently corroborated by a crash whose faulting
address lands inside the measured overwrite.**

**Why the obvious experiment is impossible, and what was done instead.** The over-read
`QByteArray(ptr, n)` at `0x14013f401` and the `memset(ptr, 0, n)` at `0x14013f49a` cover the *same*
byte range and **the read runs first**. So any `n` large enough to leave mapped memory faults on the
read — an access violation *inside the memset is unobservable by range extension*, and Full Page Heap
does not help either (the guard page is hit by the read). Instead: keep the whole range mapped, and read
the adjacent heap **before and after** the memset, in-process, on the same packet.

Tool: `scratch/w3/lead/oobprobe.c`. Two 5-byte detours in the victim, both disassembled and
branch-scanned by the lead first:

```
0x14013f495  48 8b 4c 24 38  mov rcx,[rsp+0x38]   <- SITE A, immediately BEFORE the memset
0x14013f49a  e8 e8 99 5d 00  call 0x140718e87     ;  memset(ptr, 0, n)
0x14013f49f  48 8d 4c 24 48  lea rcx,[rsp+0x48]   <- SITE B, immediately AFTER
```

Branch-into-range scan over **every** `.pdata` function in `WickrPro.exe`: window A has **no** branch
targets; window B has exactly one, to its **first** byte (`jmp` @ `0x14013f48c`, the memcpy arm). Nothing
lands strictly inside either. Stubs touch only `rax`/`r10`/`r11`, push nothing (so `rsp` and the shadow
space are untouched), and leave memset's `rcx`/`rdx`/`r8` alone; `rax` is dead at both sites. Site B is
also reached from the memcpy arm, so B records count only when paired with an immediately preceding A
record carrying the same `ptr`.

Each stub snapshots 64 bytes at **`ptr + 1024`**. Benign payloads measure 181–319 bytes, so that window
is **certainly outside the real allocation** and inside the 4096-byte memset range.

**Result — 3 of 3 conclusive samples confirm the write:**

```
packet ptr=0x801128afcc  n=4096   window=ptr+1024..+1087   *** CONFIRMED OOB WRITE ***
   before: 5a e5 b1 ac d1 18 cc f2 35 e5 49 49 08 ca 56 c9 3d fb 0f 18 7d 8b 3b c1 ...
   after : 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ...
   zero bytes: before=0/64   after=64/64
packet ptr=0x801128976c  n=4096   ...  before=21/64 zero   after=64/64 zero
packet ptr=0x801128cc3c  n=4096   ...  before=0/64  zero   after=64/64 zero
```

Three further samples were logged `INCONCLUSIVE (window was already zero before)` and are **not** scored
as confirmations. One of them is `ptr=0x801128976c` seen a second time — already zeroed by its own
earlier memset, which is a pleasing internal consistency check.

`n == 4096 == C` again, confirming the length control at the new constant.

**The application's own log corroborates the failure arm** (`*_npl.txt`, and this string had never
appeared in any capture before):

```
[W AV.CryptProxy.Aank6] All bytes set to zero, decryption failed most likely      x3
[E PacketBundleDecoder] Illegal size (4067 bytes), skipping                       x3
```

The decrypt failed exactly as the GCM analysis predicts (`W4-CRUX-aead-settled.md` §4 — the tag lies
inside the payload the attacker really sent, so inflation extends the authenticated ciphertext and
authentication cannot succeed), so the `memset` arm was taken. `4067 = 4096 − 29`: a downstream consumer
subtracts `cryptoPadding` from the peer-declared size. **That is where the long-disputed `29` actually
lives** — a downstream subtraction, not an addition to `n`, consistent with `NPLAVPacketGetBuffer`
returning `[Packet+0x18]` verbatim.

### The delayed crash, and why it is attributable

The victim died ~seconds later. **Not in `memset`, and not on the media path at all** — which is the
predicted *success* signature, since a crash at the memset itself is impossible (see above).

No WER record exists because WickrPro ships Crashpad/Sentry, which captures and terminates. The minidump
is at `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\crashpaddb\reports\`. Analysed with cdb:

```
ExceptionCode : c0000005 (Access violation), reading 0x0000000000000473
d3d11!CResource<ID3D11Resource>::Map+0x50
  00007ff823b73491  mov rax, qword ptr [rdx+0A0h]     ; rax := *(rdx+0xA0)
  00007ff823b73498  mov dl,  byte ptr [rax+473h]      ; <== FAULT, rax = 0
rdx = 0x801128bb70
thread: Qt6Quick!QSGBatchRenderer::Renderer::render -> Qt6Gui RHI -> d3d11 Map   (render thread)
```

So the pointer field at `rdx+0xA0 = 0x801128bc10` had been zeroed. Placing that address against the
overwrite measured minutes earlier on the same run:

| | |
|---|---|
| memset range for `ptr=0x801128afcc` | `[0x801128afcc, 0x801128bfcc)` |
| faulting pointer field | `0x801128bb70 + 0xA0` = **`0x801128bc10`** |
| offset past `ptr` | `0xc44` = **3140 bytes** |
| inside the memset range? | **YES** |
| beyond the end of the real allocation (≤319 B) | ~2821 bytes |

**CONFIRMED:** the zero-fill of `[ptr, ptr+4096)` happened (measured at `ptr+1024`); the faulting field
lies 3140 bytes past that same `ptr`, inside the same range; it read as 0; the fault is a classic
zeroed-object-pointer dereference in an unrelated subsystem.
**INFERRED (strongly):** that this particular NULL was written by this particular `memset`. The heap
pages are absent from the minidump, so that specific qword was not observed before and after — the
inference rests on the address arithmetic, the timing, and the register state. It is not a separate
measurement, and is labelled accordingly.

Attribution of the *write* itself needs no such inference: the probe only ever **reads**, the over-read
allocates but does not corrupt, and the before/after pair brackets the `memset` call directly. The
`memset` is the only writer in the window.

### What this establishes

F4-1 is now demonstrated end to end: **a peer-chosen 32-bit length drives a zero-fill of arbitrary
length past the end of a heap allocation in the victim's unsandboxed main process, and that corruption
reaches a crash in an unrelated subsystem.** With CFG absent, no CET and the default NT heap, a
controlled-length zero-fill over adjacent heap is a serious corruption primitive — here it happened to
NULL a D3D11 resource pointer; what it zeroes is a function of heap layout, which an attacker can groom.

Still not demonstrated: content control (the write is zeros by construction on this arm), and the
over-read as a *separate* primitive at large `C` — see the open questions.

---

## F4-2 — libvpx VP8 use-after-free write via dangling `pc->mi` (HIGH, gated)

**Class:** UAF write (CWE-416), escalating to a linear heap OOB write. **Status: CONFIRMED mechanism,
reproduced live. Peer-reachability UNKNOWN — gated on an allocation failure.**

`vp8_de_alloc_frame_buffers` (`NPL 0x180186320`, 210 bytes, read complete) frees the mode-info block and
stores 0 to `mip` (+0xc58), `prev_mip` (+0xc68), `above_context`, and two others — but contains **no
store to `mi` (+0xc60) or `prev_mi` (+0xc70)**. `vp8_alloc_frame_buffers` (`0x180186080`) calls de_alloc
at entry (`0x1801860a4`) *and* again on its failure label (`0x180186293`), so **every** failure exit
leaves `pc->mi` pointing into freed memory. `vp8_decode`'s setjmp landing pad (`0x18017db24`) only zeroes
`ctx->si.w/h` and returns; the decoder object is never torn down — `vpx_codec_destroy` is not linked into
either binary and the iface `destroy` entry `0x18017d710` has no callers. The next inter frame then runs
`vp8_decode_mode_mvs`, writing `mb_rows*mb_cols` MODE_INFO records straight through the dangling pointer.

Five upstream fixes are **absent** from the shipped bytes, each checked individually: `44a5eaa3b`
(keyframe-resync guard — the instruction after the `!decoder_init && !si.is_kf` fixup at `0x18017d916`
is the resolution compare at `0x18017d91d`; nothing is there), `0226b9516`, `a5e2e6528`, `263ddc9e3`,
`572f663c8`.

**Reproduced 3/3** against the unmodified installed DLL: after a 16383×16383 keyframe, `mip == 0` while
`mi` is unchanged; a fresh same-size allocation that reclaimed the address had 144 bytes overwritten
starting exactly at `mi`. No allocator hooks, no debugger, no patched binary, and the public wrapper was
used with argument-identical values to the live call site — so the usual harness qualifier does **not**
apply to the decode call itself.

**The gate, stated honestly.** The precondition is `malloc` returning NULL inside
`vp8_alloc_frame_buffers`. The repro used a Job Object commit cap. Whether a peer can drive a real,
unconstrained victim into that state is **not established**, and the VP8 path cannot do it alone
(de_alloc runs *before* alloc, so the attacker's own frame first releases memory).

### 2026-07-31 — the gate does NOT open for a single peer on this host class. MEASURED.

**Leg 1 — direct, unconstrained host-class measurement** (`mi_state.py`, no job cap, installed NPL.dll,
no debugger, no patched binary):

```
decode(keyframe 16383x16383, 74 B) -> 0 (VPX_CODEC_OK)   private 26.0 -> 2025.8 MB (+1999.8)
pc.mip=0x1d479042050   pc.mi=0x1d4790550e8      <- both non-NULL: the allocation SUCCEEDED
```

The maximum allocation a peer can request is bounded by the 14-bit dimension cap, and at that maximum it
still succeeds. **No failure, so no dangling `mi`, so no UAF.**

**Leg 2 — the arithmetic, from measured values only:**

| | |
|---|---|
| commit limit (this host) | 27.88 GiB |
| committed at rest | 8.85 GiB |
| **headroom** | **19.03 GiB** |
| max retained per decode context (14-bit cap ⇒ hard ceiling) | **1.95 GiB** |
| decode contexts per publisher | **2 — CONFIRMED, see below** |
| ⇒ publishers needed to exhaust headroom | **≈ 5** |
| operator accounts available | **2** |

**The "two contexts" factor was an open question in the critique (§E5); it is now CONFIRMED by
disassembly, and so is the fact that one peer can address both:**

```
0x180144685  mov  r14d, 0x518          ; loop init
0x180144777  cmp  r14, 0x528           ; step 8 -> exactly TWO iterations
0x180144731  call 0x18017d4a0          ;   vpx_codec_dec_init_ver, once per iteration
0x18014476e  mov  [r14+r12-0x70], rbx  ;   stored at r12+0x4a8 and r12+0x4b0
...
0x1801447ac  mov  eax, [rbx+0x90]      ; rbx = the Frame
0x1801447b2  shr  eax, 0xe             ; BIT 14
0x1801447b5  and  al, 1
0x180144b4e  movsxd r14, [rsp+0x38]
0x180144b53  mov  rbx, [r12 + r14*8 + 0x4a8]   ; ctx = contexts[ bit14 ]
```

`Frame+0x90` is peer metadata off the wire, so **one publisher can fill both contexts** — worth ~3.9 GiB.
That halves the requirement from ~10 publishers to ~5. It is still 2.5× more than two accounts provide.

**Leg 3 — the live probe, and why its zero is NOT evidence.** `scratch/w3/lead/allocgate.c` hooks the
function entry (`0x186080`) *and* the single failure tail (`0x186298`, where all six failure branches
converge). On the 03:08 call it recorded **0 invocations and 0 failures** — but the entry counter being
zero means `vp8_alloc_frame_buffers` **never ran**, because the victim died ~100 ms after the first
inbound media packet, before the first keyframe was decoded. **That run therefore says nothing about the
gate**, and is reported as no-data rather than as a negative. (This is exactly why the liveness counter
was built in.)

**Conclusion:** on a 24 GiB host, a single malicious peer is bounded to ~3.9 GiB of retained decoder
memory by a 14-bit field, against ~19 GiB of headroom. **F4-2 is not remotely armable by one peer here.**
It remains open for (a) a genuine N-party group call with ~5 malicious publishers, and (b) small-RAM
hosts, where the same arithmetic could invert — a 4 GiB machine needs only one or two.

Observed UAF write content was 9 zero bytes per MODE_INFO in every trial including randomised inter-frame
payloads, so **content steerability is unproven** — which matters, because F4-2 was the candidate route
to a *content-controlled* remote primitive. That route does not open on this evidence.

Observed UAF write content was 9 zero bytes per MODE_INFO in every trial including randomised inter-frame
payloads, so **content steerability is unproven**.

## F4-3 — 111-byte keyframe forces 2017 MiB of commit (MEDIUM; the enabler for F4-2)

**CONFIRMED, peer-reachable.** The VP8 keyframe header carries 14-bit width and height at bytes 6–9.
`vp8_decode` passes them to `vp8_alloc_frame_buffers` (`0x18017dbb7`) behind only two `<= 0` guards
(`0x18017db5b`, `0x18017db81` — identified independently by resolving their rip-relative operands to
`"Invalid frame width"` / `"Invalid frame height"`). A 16383×16383 keyframe allocates four ~387 MiB YV12
buffers plus context arrays: measured private commit 9.0 MiB → 2026.0 MiB for a **111-byte input**.

Nothing upstream of the decoder can clamp this, and that was established rather than assumed: a sweep of
every `.pdata` function in NPL.dll for the VP8 sync-code test (`0x9d` compare followed within 0x60 bytes
by a `0x2a` compare) found exactly two functions in the whole image, both libvpx. Everything upstream
treats the frame as an opaque blob. The decoder is also created with `cfg.w = cfg.h = 0` (`0x1801446fe`),
so the announced `VideoFormat` geometry does not cap it either.

By the engagement's bar this is resource exhaustion, not memory corruption — but against an unsandboxed
process it is a denial of service on its own, and it is the arming primitive for F4-2.

## F4-4 — `decoded_key_frame` not reset on resize → uninitialised heap use (MEDIUM)

**CONFIRMED, peer-reachable.** CWE-908/457. The field at `pbi+0x3a0c` is pinned to `decoded_key_frame`
by a strong argument rather than by inferred struct padding: the set site `0x1801b0056` is immediately
followed at `0x1801b006f` by `lea r8,[rip+0x2b66c2]` → `0x180466738` =
`"A stream must start with a complete key frame"`, the literal argument of the `vpx_internal_error` at
`decodeframe.c:1246`. Neighbour displacements corroborate (`0x3a04` `ec_enabled`, `0x3a08` `ec_active`,
`0x3a10` `independent_partitions`, `0x3a14` `frame_corrupt_residual`).

Not one of the four classes the engagement counts as a headline defect, but it is a real
memory-hygiene defect on a peer-fed path and it is filed.

## F4-5 — plane bound check defeated by 32-bit truncation (LOW — split verdict)

**Arithmetic CONFIRMED, downstream impact REFUTED.** At `0x18011f1ac` the extent multiply is
`imul r10d, eax` (bytes `440fafd0`, REX.W = 0), so the product truncates to 32 bits and zero-extends
before the 64-bit `add`/`cmp` at `0x18011f1bd`/`0x18011f1c0`. A peer can therefore choose a
stride×height pair whose true product exceeds 2^32 and whose truncated value passes the check. The
verifier lifted the four real bytes into an executable stub and ran them to confirm the truncation.

Filed as a latent defect: the security consequence the recon agent attached to it was positively
disproved for the shipped build, and the remaining reachability link is INFERRED.

## F4-6 — WinSparkle: expat 2.2.9 behind unpinned HTTPS (LOW)

**CONFIRMED.** The appcast URL is built entirely from binary literals in `WickrPro!0x140aec040` —
`https://s3.amazonaws.com/wickr-desktop-clients/` + `Windows/WickrPro` + `/Latest/Latest.xml` — passed
once to `win_sparkle_set_appcast_url`, with no registry, ini, resource or command-line override.
WinSparkle 0.8.0 uses **WinINet only**; its single fetch function `WinSparkle!0x180016cec` computes
`dwFlags = 0x84000000 | (nocache?0x100) | (https?0x00800000)` — RELOAD | NO_CACHE_WRITE | PRAGMA_NOCACHE
| SECURE — and **never** sets `INTERNET_FLAG_IGNORE_CERT_CN_INVALID`, `..._DATE_INVALID`, or
`INTERNET_OPTION_SECURITY_FLAGS` (the only `InternetSetOptionW` sets option `0x94`, HTTP/2).

So certificates **are** validated by WinINet defaults and are **not** pinned. expat is pinned to
[2.2.5, 2.3.0) from the `XML_ErrorString` table (CONFIRMED) and to 2.2.9 from WinSparkle v0.8.0's
submodule pin (INFERRED). CVE-2022-25236, CVE-2022-25315 and the 2.4.3-era `doProlog`/`build_model`
integer overflows are reachable from an appcast body because the parser is created with
`XML_ParserCreateNS('#')` and `XML_DTD` — **but only for whoever controls the HTTPS response.** Exposure
is further reduced by `win_sparkle_set_automatic_check_for_updates(0)` before init (registry
`CheckForUpdates` confirmed 0 live), so the fetch happens only on a user-initiated check.

**Net: expat is NOT reachable by a plain network attacker.** Origin/S3 compromise or a rogue CA only.

## F4-7 — `Sock5.dll` is mapped by default but its network code is dormant (INFORMATIONAL)

**CONFIRMED both halves.** `Sock5.dll` is a **static, non-delay** import of `WickrPro.exe`, so the loader
maps it and runs its CRT static initialisers at every process start — verified live in two separate
processes (PID 21080 and a fresh PID 15536 at the login screen). It bundles **mbed TLS 2.1.5 (2016)** and
**SQLite 3.19.2 (2017)**.

But the only entry points WickrPro imports are `DispersiveTunnelSetLogCallback/Start/Stop/CheckStatus`,
all called from `WOA::startProxyPrivate` (`WickrPro!0x140b93c20`) and siblings, which run only when Wickr
Open Access is enabled — off by default (live logs: `enableWOA false`, `forceWOA false`,
`WOA:: Proxy is already stopped.`). `Sock5.dll` has an empty TLS callback array, so nothing beyond
DllMain/CRT init runs at load. SQLite only ever touches a locally written key-value file (`vtc.db`,
table `VtcData`), never network bytes.

So: dormant-but-mapped. A hygiene finding as shipped, and a real TLS-client attack surface the moment an
administrator turns Open Access on. Note also that the mbedTLS **test certificates with their published
private keys** are compiled in — confirmed dead data (no code or referenced pointer table reaches them),
so a hygiene note, not a finding.

---

## Refuted hypotheses — do not re-derive these

| Hypothesis | What killed it |
|---|---|
| "The VP9 decoder is peer-selectable code the product never exercises" (the wave-3 #1 lead) | libvpx built `--disable-vp9`; zero `vp9_*` symbols and no VP9 iface name; factory `0x180122040` builds the **same** `Musigy::AV::VpxDecoder` for `"vp8"` and `"vp9"`, and the distinguishing arg is discarded — first touch of `edx` in ctor `0x1801435a0` is `xor edx,edx` @ `0x18014360e`. Ctor has exactly two callers, both in that factory. Full evidence: `W4-CRUX-vp9-refutation.md` |
| "`h264` exposes an FFmpeg decoder" | The factory rewrites `"h264"` → `"ffmpeg"` (6 chars), which matches neither 3-char compare, so it returns NULL. No ffmpeg/avcodec/openh264 code in NPL.dll or anywhere in the install directory |
| "libvpx 1.9.0 is dangerously stale" | The core VP8 bitstream-to-pixel path received **zero** upstream memory-safety fixes v1.9.0 → HEAD (2026-07). `detokenize.c` and `dboolhuff.c` byte-identical; `decodeframe.c` 46 lines, all cleanup; `decodemv.c` 7 lines of cast annotations. The only live unpatched chain is the alloc-failure family = F4-2 |
| Threaded row decode as a surface | `cfg.threads = 1` (`mov dword [rbp+0x140], 1` @ `0x180144709`) and `vp8_decoder_create_threads` gates on `cmp ecx,1 / jle` @ `0x180189838` — `mt_decode_mb_rows`, the MB-row sync buffers and `thread_decoding_proc` are dead at runtime |
| Postproc / error concealment / input fragments CVEs | All compiled in, all off at runtime (init `flags = 0`, `xor r9d,r9d` @ `0x180144720`). Every postproc/MFQE/add_noise and EC/fragment fix is unreachable |
| CVE-2026-2447 (libvpx heap overflow, Feb 2026) | VP9 **encoder** `write_superframe_index`. Doubly inapplicable: VP9 configure-disabled, and encoder is the send path |
| F1 odd-height (the wave-3 #2 lead) | **REFUTED for every reachable configuration.** The preview height is one of two WickrPro compile-time immediates, `0x2c6` (710) / `0x168` (360), both even; 40 of 40 camera modes on this machine are even; the runtime crop-rect setter is never invoked; screen share has no self-preview tap. There is **no** even-alignment operation anywhere on the path — the safety is accidental, not enforced. Residual: a device advertising an odd height below the request would propagate verbatim. Local trust boundary regardless |
| "The format blob is a bespoke serializer and the best target in the app" (a wave-1 lead, never closed until now) | It is **protobuf-lite** (`Musigy.AV.Proto.Format`; build-path string `…\3rdparty\protobuf\…\message_lite.cc` @ `0x180439d60`). All three deserializers are clean — no length-before-validation, no count×elemsize, no blob-derived loop bound. `NPLAVNetSinkGetFormatBlob` is a red herring: WickrPro never calls it; the blob travels in band as `kind==1` |
| `NPLPacketSetSize` as an unvalidated size setter | It is unvalidated, and it is **dead code**: no callers in NPL.dll and absent from WickrPro's 96 NPL imports |
| `CryptProxy::onPacket 0x18011b637` as the F4-1 consumer | **Not a receive-path consumer** — it sits behind `cmp dword ptr [rsi+0x118], 0 / jle`, false on both receive scenes. The consumer is the WickrPro decrypt callback |
| The three `STATUS_HEAP_CORRUPTION` crashes in the prior fuzz logs | Harness artifact. `vp8fence.c`'s fixed 65536-entry quarantine table saturates and drops records, so a `VirtualAlloc`'d address reaches the real `free()`. Measured: 65541 allocations served at the exact crashing iteration |
| Peer `Format` width/height reaching the converter's allocation arithmetic | `VpxDecoder::process` unconditionally re-publishes the format with the real decoded `d_w/d_h` (`0x1801453db`..`0x180145402`) before any frame is emitted |

---

## Evidence-backed negatives (selected)

Static audit of the shipped VP8 decode path, with the compare and branch quoted for each:

* The key-frame header parse cannot read or advance past the end of the input; the "short key frame" case
  does **not** fall through to `data += 7`.
* `peek_si_internal` and the frame-header parse can never disagree about dimensions, so
  "buffers allocated for the old size, decode driven at the new size" is closed.
* `setup_token_decoder` has no integer underflow and cannot index `fragments.sizes[]`/`ptrs[]` beyond
  `MAX_PARTITIONS`; the 2020-era "Corrupted fragment size" hardening is present.
* `vp8_yv12_realloc_frame_buffer`'s plane arithmetic cannot overflow; the `buffer_alloc_sz` re-check is present.
* The `VP8BORDERINPIXELS` border arithmetic is exact.
* Every bitstream-derived index into a fixed-size table is clamped (QIndex, the six quant helpers, loop-filter levels).
* `vpx_calloc`/`vpx_memalign` have a correct multiplication-overflow guard and a 1 TiB ceiling.
* Frame dimensions are capped at 14 bits each (`and r8d,0x3fff` @ `0x18017e584`, `and ecx,0x3fff` @
  `0x1801ae1f1`), which is what makes every 32-bit product in the allocator provably non-overflowing
  (max frame_size 405,805,056 < 2^31).
* The NPL copy-out of the decoded `vpx_image_t` has **no** floor-alloc/ceil-copy asymmetry (the F1 class).

Fuzzing, ~370,000 decode iterations across two harnesses, corpus built by a real VP8 boolean encoder
(not header-only):

* **No** OOB read or write past the end of the supplied bitstream — the frame's last byte sits at the end
  of a committed page followed by `PAGE_NOACCESS`.
* **No** OOB read or write past the end of any libvpx heap allocation — `vp8fence.exe` rewrote NPL.dll's
  IAT entries for `malloc`/`calloc`/`realloc`/`free` (4/4 patched, verified at start-up) and served
  guard-page-backed blocks.
* The 13 near-NULL access violations that dominate the crash corpus do **not** count: all are writes to
  `0x0`/`0x4`/`0x20` inside VCRUNTIME memset/memcpy, i.e. post-failure NULL derefs.

Receive-path field map:

* The `kind` field is genuinely enum-clamped to 1/2/3; anything else goes to the unknown-field set and
  the packet is dropped (`"Unknown packet payload type:"`).
* Plane count is bounded to 4 in both kind-2 sub-branches; field 5 is overwritten locally with 0;
  `Latency` must carry exactly 5 ints.
* The codec-name length checks in factory `0x180122040` are **sound**, and the caller that matters
  **does** null-check the returned pointer.
* Protobuf **field names** are not recoverable — the AV protos are compiled against protobuf-lite, so
  only message full-names are embedded and there is no `FileDescriptorProto`. All field naming in this
  report is from the generated parsers, not from descriptors.
* **Correction to Wave 3:** `RECV-ROUTING-GROUND-TRUTH.md` records field 9 as a string. It is a nested
  `Buffer` **message**; the allocator identifies it unambiguously.

---

## Open questions, ranked

1. **Where does DTLS terminate?** Decides whether F4-1 is "a malicious call participant" or "the server
   can corrupt every participant's heap". Highest value in the engagement.
2. **Live end-to-end demonstration of F4-1.** One-instruction sender-side patch at `NPL 0x18011d59a`,
   fresh call, watch the victim fault in the decrypt callback. Cheap, and it converts a confirmed defect
   into a demonstrated exploit.
3. **Can a peer drive `malloc` to NULL on an unconstrained victim?** The only gate on F4-2. Cheapest
   probe is a host-class sweep; the group-call lever (one `VpxDecoder` per publisher) is untested.
4. **Is the F4-2 UAF write content steerable?** Observed zeros in every trial. `pc->prev_mi` (+0xc70) is a
   second dangling pointer that was never exercised.
5. **Does the relay re-serialise or forward `PacketHeader` verbatim?** Also gates F4-5's reachability.
6. Is Wickr's own messaging transport pinned? `HKCU\Software\Wickr Pro\TopSecretMessenger` contains
   `certPinningEnabled=false`. That is **not** WinSparkle; it was noticed in passing and never investigated.
7. `Sock5.dll` statically imports 11 `SETUPAPI` functions plus `newdev.dll` — the signature of installing
   a virtual network adapter driver. Whether that runs at load was not determined.
8. `Sock5.dll` builds SQL by string concatenation (`"SELECT VALUE FROM VtcData WHERE KEY = '"` @
   `0x1807724b0`). If any KEY is remotely influenced, that is an injection question nobody asked.

---

## Remediation

**F4-1 (do this first).** In the kind-2 handler at `NPL 0x18011ef70`, apply the same bound the sibling
plane branch already applies: compare the peer-declared `Buffer.size` against the actual received payload
length before constructing the Frame, and reject the packet on mismatch. Defence in depth: have the
WickrPro decrypt callback take its length from the buffer it was given rather than from the header.
Structurally, authenticate `PacketHeader` — carry it as AAD in the E2E layer — so that a relay cannot
rewrite it and so that header parsing is not a pre-decryption attack surface.

**F4-2.** Update libvpx. The five absent commits are the minimum; a version bump is the right fix. If a
bump is not immediate, cherry-pick `44a5eaa3b` and `0226b9516`, and additionally tear down and re-create
the decoder context on any `vpx_codec_decode` failure — currently the context is never destroyed, which
is what lets the dangling pointer survive into the next frame.

**F4-3.** Clamp the accepted frame dimensions to the negotiated video geometry before handing the frame
to libvpx, instead of letting a 14-bit header field drive a 2 GiB allocation.

**F4-4.** Reset `decoded_key_frame` when the frame buffers are reallocated.

**F4-5.** Widen the extent multiply at `0x18011f1ac` to 64 bits.

**F4-6.** Bump the bundled expat; consider pinning the appcast certificate.

**F4-7.** Bump mbedTLS and SQLite in `Sock5.dll`, or stop statically importing it so it is not mapped
when Open Access is off. Remove the compiled-in mbedTLS test certificates and their published private keys.

---

## Provenance and honesty notes

* F4-1's every link was re-read by the lead from the shipped bytes, including the IAT resolution of the
  `memcpy`/`memset` thunks. It is not reported on a subagent's authority.
* F4-2's mechanism was verified by a subagent that re-disassembled each function itself, chased five
  refutation routes, and reproduced the effect on the real NT heap. The lead has **not** independently
  re-read F4-2, F4-4 or F4-6/F4-7; those are reported at the verifier's confidence, which was high and
  which carried its own disassembly.
* The Wave 4 workflow died twice mid-run (process exit). 7 of 7 recon dimensions and 9 verification
  verdicts completed; the automated synthesis and completeness-critic passes never ran. **This report was
  assembled by the lead from the structured results, so it has had no independent completeness review** —
  a gap that should be closed before anything here is sent to a vendor.
