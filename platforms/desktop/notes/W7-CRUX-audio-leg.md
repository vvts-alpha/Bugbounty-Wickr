# W7 CRUX — the AUDIO receive leg: `Parser → CryptProxy → PacketMonitor → OpusDecoder → AudioOutputStream`

Date 2026-07-31. Target: **AWS Wickr Desktop 6.72.20.0 (Windows)**, `NPL.dll` ImageBase `0x180000000`.

Everything below was produced by disassembling the shipped image or by measuring against the
**installed, unmodified** `NPL.dll`
(`%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr\NPL.dll`).
No patched binary, no debugger, no allocator hooks, no live call.

**CONFIRMED** = I read the bytes or measured it (stated which). **INFERRED** = reasoned from
confirmed facts. **REFUTED** = disproved, with the instructions that disprove it.

Tools written this session: `scratch/w7/{harness_opus.py, fmap.py, disr.py, storescan.py}`.
Evidence: `scratch/w7/W7-opus-harness.log`.

---

## VERDICT

> **The Opus wrapper is clean. H1 and H2 are REFUTED — by disassembly and by measurement.
> There is no content-controlled write anywhere on the audio receive leg.**
>
> The one peer-controlled defect on this surface is the **`PacketBundleDecoder` heap over-READ**
> already recorded as W4 §5b. This session identifies its consumer end to end and shows the
> consumer is safe: the over-read bytes become `(ptr, len)` arguments to `opus_decode`, which
> reads them and writes only into a buffer with a **measured 2× margin**.
>
> **This closes the last surface the engagement named as RCE-relevant.** The engagement's
> conclusion — *no RCE path on the available evidence* — is unchanged, and now rests on a
> completed audit rather than on a deliberately unfinished one.

---

## 0. The three things the brief asked for first

**(1) Where is `OpusDecoder` constructed, and who owns its buffers? — CONFIRMED**

`NPLNodeCreate`'s 17-name table genuinely has no audio nodes, but that was a red herring: the
audio nodes are not built by name at all.

* ctor `Musigy::AV::OpusDecoder::OpusDecoder` = **`0x180148810`**, and it has exactly **one**
  direct caller, `0x180128b80` inside `0x180128b30` (`callers.py`). It is a codec-registry /
  factory site, not the string-matched node table.
* `PacketBundleDecoder` is **not a node either** — the receive audio scene printed by the app is
  `NetworkSource->Parser->CryptProxy->PacketMonitor->OpusDecoder->AudioOutputStream`, with no
  bundle node in it. It is an **embedded member of `OpusDecoder`**, at `this+0x168` (§3).
* **Buffer ownership: `OpusDecoder` owns no PCM buffer at all.** It allocates one fresh `Frame`
  per sub-packet from the frame pool and hands `Frame+0x10` to `opus_decode` as the output.
  Lifetime is the frame's, not the decoder's. The only long-lived state is the libopus
  `OpusDecoder *st` at `this+0x150`.

**(2) The `opus_decode` call site with all five arguments, and the PCM allocation — CONFIRMED**

`NPL 0x180148fa0`..`0x180148fd6`, inside `OpusDecoder::decodeSubPacket 0x180148dd0`:

```
0x180148f77  mov  r12, qword ptr [rdi + 0x150]   ; arg1 st        = the libopus decoder
0x180148f9d  xor  r8d, r8d
0x180148fa0  mov  edx, 0x5a00                    ; <== PCM ALLOCATION SIZE, a CONSTANT 23040
0x180148fa5  mov  rcx, rsi
0x180148fa8  call 0x180135e80                    ;     Frame::create(pool, 0, 0x5a00, 0, 0)
0x180148fad  mov  rsi, rax
0x180148fb4  test r13, r13
0x180148fb7  sete dl
0x180148fba  mov  dword ptr [rsp + 0x28], edx    ; arg6 decode_fec = (data == NULL)
0x180148fbe  mov  edx, dword ptr [rdi + 0x144]
0x180148fc4  mov  dword ptr [rsp + 0x20], edx    ; arg5 frame_size = [this+0x144]
0x180148fc8  mov  r9,  qword ptr [rax + 0x10]    ; arg4 pcm       = Frame+0x10
0x180148fcc  mov  r8d, dword ptr [rbp - 0x51]    ; arg3 len       = the sub-packet length
0x180148fd0  mov  rdx, r13                       ; arg2 data      = the sub-packet pointer
0x180148fd3  mov  rcx, r12
0x180148fd6  call 0x1802c5740                    ;     opus_decode(...)
0x180148fdb  test eax, eax
0x180148fdd  jns  0x18014903d                    ; negative -> error path, frame discarded
```

`[this+0x144]` is written **exactly once in the whole DLL**, as a compile-time immediate in the
constructor (`storescan.py` over all 13,498 `.pdata` functions, filtered to this class):

```
0x180148956  mov dword ptr [rsi + 0x144], 0xb40    ; frame_size = 2880 samples/channel = 60 ms
0x180148960  mov dword ptr [rsi + 0x148], 1        ; channels   (overwritten from the peer format)
0x18014896a  mov dword ptr [rsi + 0x14c], 0xbb80   ; 48000      (overwritten from the peer format)
0x180148974  mov qword ptr [rsi + 0x150], rbp      ; st = NULL
```

**Nothing in `Musigy::AV::OpusDecoder` ever recomputes `frame_size`.** It is 2880, always.

`Frame::create 0x180135ea0` allocates `size + 0xe7` and places the data pointer at
`align16(base+0xdf)`, storing capacity at `Frame+0x60` and size at `Frame+0x18`
(`0x180135ffd`, `0x180136049`), so the usable PCM region is exactly **23040 bytes**.

**(3) Which observation distinguishes "sizes the buffer from the packet" from "assumes a fixed
duration" — stated before measuring**

> Both hypotheses predict identical behaviour on a 20 ms packet, so a normal call is not the
> experiment (§0.4 of the brief, again). The discriminator is a **long** packet.
> An Opus packet's duration is chosen by the sender: 2.5/5/10/20/40/60 ms, and up to 120 ms via
> code-3 framing. So:
>
> * If the wrapper **sizes from the packet**, it would call `opus_packet_get_nb_samples` (or
>   `opus_decoder_ctl`) before allocating, and the allocation size would vary with the packet.
> * If the wrapper **assumes a fixed duration**, the allocation is a constant and `frame_size` is
>   a constant — and the *only* question left is whether that constant covers the maximum a peer
>   can send.
>
> The distinguishing observation is therefore: **feed packets of every legal duration through
> `opus_decode` with the live `frame_size` and a PCM block that ends flush against a
> `PAGE_NOACCESS` guard page, and record `ret` and the bytes written.**
> H1 is true iff some duration writes past 23040 bytes.
> H1 is false iff every duration either fits or is rejected.

Answered statically *before* measuring — the constants `0xb40` and `0x5a00` settle the "fixed
duration" half — and then measured anyway, because a constant that happens to be big enough is
still worth proving big enough. §2 is the measurement.

---

## 1. H1 — the frame-size mismatch. **REFUTED, two independent ways.**

### 1a. `0x1802c5740` is `opus_decode`, and it clamps `frame_size` itself — CONFIRMED

Per method rule 1, I disassembled the callee rather than assuming its identity. libopus is
**statically linked** (source paths embedded: `…\3rdparty\opus\opus-72a3a6c13329869000b34a12ba27d8bfdfbc22b3\src\opus\src\opus_decoder.c`
@ `0x18049c980`), and this is the **float** build. `0x1802c5740` matches `opus_decode()` line for line:

```
0x1802c5793  test r15d, r15d          ; frame_size
0x1802c5796  jg   0x1802c57a2
0x1802c5798  mov  eax, 0xffffffff     ;   frame_size <= 0 -> OPUS_BAD_ARG
0x1802c57a2  test r12, r12            ; data != NULL
0x1802c57a7  test r13d, r13d          ; && len > 0
0x1802c57ac  cmp  dword ptr [rbp+0x98], 0   ; && !decode_fec
      ...    <opus_decoder_get_nb_samples INLINED: TOC parse for nb_frames,
             opus_packet_get_samples_per_frame @0x1802d1310, imul, then the
             `samples*25 > Fs*3` sanity check `imul edx,eax,0x19 / cmp edx,ecx / jg`>
0x1802c5807  cmp  r15d, eax
0x1802c580a  cmovl eax, r15d
0x1802c580e  mov  r15d, eax           ; <== frame_size = IMIN(frame_size, nb_samples)
0x1802c5811  mov  eax, dword ptr [r14+8]   ; st->channels
0x1802c5815  dec  eax
0x1802c5817  cmp  eax, 1
0x1802c581a  jbe  0x1802c5835         ; celt_assert(channels==1||channels==2), else celt_fatal
0x1802c5835  mov  eax, r15d
0x1802c5838  imul eax, dword ptr [r14+8]
0x1802c5840  shl  rcx, 2              ; ALLOC(out, frame_size*channels, float)  -- on the STACK
0x1802c5860  sub  rsp, rax
0x1802c5896  call 0x1802c6690         ; opus_decode_native(...)
0x1802c58d0  movss xmm0, dword ptr [rdi]    ; float -> int16 conversion loop
0x1802c58e6  mov  word ptr [rsi], ax        ; <== THE ONLY WRITE TO pcm
0x1802c58f0  lea  rsi, [rsi + 2]
0x1802c58f4  imul eax, dword ptr [r14+8]    ; loop bound = ret * st->channels
0x1802c58fb  jl   0x1802c58d0
```

Three bounds, all read out of the image:

1. **`frame_size` can only be reduced**, never raised (`cmovl` at `0x1802c580a`).
2. **`st->channels ∈ {1,2}`**, enforced at creation (§2b) and asserted here.
3. The only `pcm` write is `mov word ptr [rsi], ax`, executed `ret * st->channels` times,
   and `ret ≤ frame_size ≤ 2880`.

⇒ **max bytes written = 2880 × 2 × 2 = 11520, into a 23040-byte allocation.**

**"Does anything call `opus_packet_get_nb_samples` before the decode?"** — the brief's exact
question. Answer, with the evidence: the *wrapper* does not (its only libopus call from
`0x180148dd0` is the one at `0x180148fd6`; `fmap.py` over the whole cluster confirms it). It does
not need to, because **libopus's own `opus_decode` inlines `opus_decoder_get_nb_samples` and does
the clamp for it**, and then `opus_decode_native` returns `OPUS_BUFFER_TOO_SMALL` when the packet
needs more room than `frame_size` allows. The integrator's classic mistake is *passing a
`frame_size` larger than the buffer*; here `frame_size` (2880) is half the buffer (5760
samples/channel at stereo). The margin is structural, not accidental.

### 1b. Measured, argument-identical to the live call site — CONFIRMED

`scratch/w7/harness_opus.py` calls the **installed** DLL's `opus_decode` at `0x2c5740` with
`frame_size = 2880` and `pcm` = a 23040-byte block placed **flush against a `PAGE_NOACCESS`
guard page**, over every legal Opus duration and both channel counts. Because the arguments are
the live ones, the "a harness supplies arguments the live path does not" qualifier does **not**
apply.

`scratch/w7/W7-opus-harness.log`, stereo (the worst case):

| packet | duration | `ret` | bytes written |
|---|---|---|---|
| CELT 20 ms ×1 | 20 ms | 960 | 3840 |
| CELT 20 ms ×3 | 60 ms | 2880 | **11520** |
| CELT 20 ms ×4 | **80 ms** | **−2 (OPUS_BUFFER_TOO_SMALL)** | **0** |
| CELT 20 ms ×6 | **120 ms** | **−2** | **0** |
| hybrid 20 ms ×6 | **120 ms** | **−2** | **0** |
| SILK 40 ms ×2 | **80 ms** | **−2** | **0** |
| PLC (`data=NULL`, `fec=1`) | — | 2880 | 11520 |

> **worst-case bytes written = 11520 of 23040 (50.0 %). No access violation in any case.**
> Mono worst case: 5760 of 23040 (25.0 %).

Every duration above 60 ms is **rejected outright** and writes nothing; the wrapper then takes
its `jns`-false arm at `0x180148fdd` and discards the frame. **H1 is REFUTED.**

*(Caveat on the log's own labels: my `SILK_WB` dict mislabels configs 12/13 as "SILK 40ms/60ms"
when they are hybrid 10/20 ms. The `dur` column is computed correctly and the `ret`/bytes columns
are direct observations, so the measurement is unaffected — only two row captions are wrong.)*

---

## 2. H2 — peer channel count and sample rate. **REFUTED at `opus_decoder_create`.**

### 2a. The peer fields really are unclamped on the wire — CONFIRMED

`Musigy::AV::AudioFormat::deserialize 0x180164100` (vtable `0x1804426f0` slot `+0x10`) parses the
protobuf and then does five **straight stores with no comparison of any kind**:

```
0x1801641f1  mov eax, dword ptr [rbp-0x19] / mov dword ptr [rdi+0x10], eax   ; field 1  (codec id)
0x1801641f7  mov eax, dword ptr [rbp-0x15] / mov dword ptr [rdi+0x14], eax   ; field 2  CHANNELS
0x1801641fd  mov eax, dword ptr [rbp-0x11] / mov dword ptr [rdi+0x18], eax   ; field 3  SAMPLE RATE
0x180164203  mov eax, dword ptr [rbp-0x0d] / mov dword ptr [rdi+0x1c], eax   ; field 4
0x180164209  mov eax, dword ptr [rbp-0x09] / mov dword ptr [rdi+0x20], eax   ; field 5
```

Field identity is pinned by the default constructor at `0x18013dcda`..`0x18013dcf6`
(`[+0x10]=1, [+0x14]=1, [+0x18]=0xbb80, [+0x1c]=0x10, [+0x20]=0x10`) — i.e. the documented
defaults `1, 1, 48000, 16, 16`, so **`+0x14` is channels and `+0x18` is the sample rate**.
The corpus's "AudioFormat fields 1..6 peer-controlled with no clamp" is **confirmed at
instruction level**. That premise is what makes the next paragraph load-bearing.

### 2b. …and libopus rejects them, and the wrapper checks — CONFIRMED

`OpusDecoder::setFormat 0x180149240`:

```
0x18014927c  mov  rcx, qword ptr [rcx + 0x150]
0x180149286  je   0x180149294
0x180149288  call 0x1802c6e70                 ; opus_decoder_destroy(old st)
0x18014928d  mov  qword ptr [r14+0x150], 0    ; st = NULL   <-- happens BEFORE validation (§5)
0x180149294  mov  edx, dword ptr [rdi + 0x14] ; arg2 channels  (PEER)
0x180149297  mov  dword ptr [r14+0x148], edx
0x18014929e  mov  ecx, dword ptr [rdi + 0x18] ; arg1 Fs        (PEER)
0x1801492a1  mov  dword ptr [r14+0x14c], ecx
0x1801492ad  lea  r8, [rsp + 0x20]            ; arg3 &error
0x1801492b2  call 0x1802c6c50                 ; opus_decoder_create(Fs, channels, &error)
0x1801492b7  mov  edx, dword ptr [rsp + 0x20]
0x1801492be  test edx, edx
0x1801492c0  jns  0x180149337                 ; <== THE RETURN VALUE IS CHECKED
0x180149332  jmp  ... (xor al,al -> setFormat returns FALSE, st stays NULL)
0x180149337  mov  qword ptr [r14+0x150], rax  ; only on success
```

`0x1802c6c50` **is** `opus_decoder_create`, disassembled rather than assumed:

```
0x1802c6c69  cmp ecx, 0xbb80 / je ok      ; 48000
0x1802c6c71  cmp ecx, 0x5dc0 / je ok      ; 24000
0x1802c6c79  cmp ecx, 0x3e80 / je ok      ; 16000
0x1802c6c81  cmp ecx, 0x2ee0 / je ok      ; 12000
0x1802c6c89  cmp ecx, 0x1f40 / jne fail   ;  8000
0x1802c6c91  lea eax, [rdx-1] / cmp eax,1 / jbe ok     ; channels in {1,2}
0x1802c6c9e  mov dword ptr [r8], 0xffffffff             ; *error = OPUS_BAD_ARG
0x1802c6ca5  xor eax, eax                               ; return NULL
```

Measured against the installed DLL (`W7-opus-harness.log` leg 1): `Fs ∈ {8000,12000,16000,24000,48000}`
accepted; `44100, 96000, 0, 1, −1, 0x7fffffff` all rejected with `err = −1`;
`channels ∈ {1,2}` accepted; `0, 3, 4, 8, 255, 65536, −1` all rejected.

**And the failure state is safe, because the packet path is gated on `st`:**

```
OpusDecoder::onPacket 0x1801494e0
  0x1801494e0  test r8, r8                       ; frame != NULL
  0x1801494e5  cmp  qword ptr [r8+0x10], 0       ; frame->data != NULL
  0x1801494ec  cmp  dword ptr [r8+0x18], 1 / jb  ; frame->size >= 1
  0x1801494f3  cmp  qword ptr [rcx+0xe0], 0      ; == this+0x150 == st
  0x1801494fb  je   0x18014950c                  ; <== st == NULL -> RETURN, decode nothing
  0x1801494fd  add  rcx, 0xf8                    ; -> the embedded bundle decoder
  0x180149507  jmp  0x1801650b0
```

`rcx` here is the interface sub-object at `OpusDecoder+0x70`, so `[rcx+0xe0]` is `this+0x150`
(`st`) and `rcx+0xf8` is `this+0x168`. **I specifically looked for the missing-check sibling
(rule 5) and it is not missing.** A rejected format therefore yields *silence*, not a NULL
dereference.

**⇒ Neither shape of H2 exists.** The decoder is never created with peer values libopus would
refuse, the PCM buffer is never sized with one channel count and written with another (both come
from `st->channels`), and the format republished downstream carries only already-validated values.

---

## 3. H3 — the bundle walk's `(ptr, len)`. **Resolved: the sink is `OpusDecoder`, and `len` is a read length only.**

The full function is five `.pdata` chunks (`0x1801650b0`, `0x1801650d1`, `0x18016510d`,
`0x18016521a`, `0x18016522e`) — a linear sweep desyncs here; `fmap.py` gives the extents.
`0x18016510d` contains **two** `call qword ptr [rax+8]` sites, not one: the loop body at
`0x1801651bc` and a **tail call at `0x180165206`** that hands over the entire remaining budget
`edi` as the last sub-packet's length. The tail call had not been recorded before.

**Sink resolution — CONFIRMED end to end, by the adjustor thunk rather than by an RTTI name:**

| step | evidence |
|---|---|
| the walk's `this` is `OpusDecoder+0x168` | `add rcx, 0xf8` @ `0x1801494fd` on the `+0x70` sub-object |
| its listener pointer is `[this+8]` = `OpusDecoder+0x170` | `mov rcx, qword ptr [r13+8]` @ `0x1801651a8` |
| the ctor stores `OpusDecoder+0x138` there | `lea r8,[rsi+0x138]` @ `0x1801488f6`; `mov [rsi+0x170], r8` @ `0x180148996` |
| the vtable installed at `+0x138` is `0x180444480` | `lea rax,[rip+0x2fbb59]` @ `0x180148920`; `= 0x1804443c0 + 0xc0`, the sub-vtable at primary `+0x0c0` |
| slot `+8` of that vtable is an **adjustor thunk** | `0x1801494d0: add rcx, -0x138 / jmp 0x180148dd0` |

```
0x180165190  movzx esi, byte ptr [r12 + rbp + 1]   ; table byte
0x180165196  inc   esi                             ; len = table byte + 1  (1..256)
0x180165198  sub   edi, esi                        ; budget -= len
0x18016519a  test  edi, edi
0x18016519c  jle   0x18016520b                     ; budget exhausted -> stop
0x1801651a8  mov   rcx, qword ptr [r13 + 8]        ; the listener  (OpusDecoder+0x138)
0x1801651ac  mov   r9d, esi                        ; arg4 len
0x1801651af  mov   r8,  r15                        ; arg3 ptr
0x1801651b2  mov   dword ptr [rsp+0x20], ebx       ; arg5 sequence
0x1801651b6  mov   rdx, r14                        ; arg2 the input Frame
0x1801651bc  call  qword ptr [rax + 8]             ; -> 0x1801494d0 -> 0x180148dd0
0x1801651ca  mov   eax, esi
0x1801651ce  add   r15, rax                        ; advance by len (NOT by the return value)
```

The `add r15, rax` is preceded by `mov eax, esi`, so the walk advances by the **sub-packet
length**, not by the callee's return — one earlier note in the corpus reads this the other way.

**Is `len` ever compared against anything before it reaches a copy or a decode? — No.**
`len ∈ [1, 256]` per table entry, and the tail call passes the remaining budget (≤ ~1022).
Both go straight into `arg3` of `opus_decode`.

**But `len` is a READ length, not a write length**, and §1 shows every downstream write is bounded
by `frame_size × channels`, which `len` does not influence. So the confirmed over-read stands
exactly as W4 §5b described it — **peer-controlled, ≤1024 B, into an audio codec** — and it does
**not** become a write. The asymmetry rule was applied and found nothing: there is no
bounds-checked sibling branch here whose check the vulnerable one omits; the length check is at
the *function entry* (`cmp eax, 0x3fe / ja`) and it is the budget's only source.

---

## 4. H4 — jitter buffer, resampler, WASAPI sizing. **No defect found; the arithmetic is consistent.**

The chain after the decoder, all CONFIRMED by disassembly:

```
OpusDecoder 0x180148dd0            -> Frame{data=PCM, size = ret*2, seq = peer}   (0x18014909e..0x1801490a3)
AudioOutputStream::onPacket 0x180129bc0
   nframes = Frame.size / (2 * [this+0x68])                      ; div r9  @ 0x180129bf3
   AudioResampler::process 0x180150750(state, &out, data, nframes)
   CircularBufferAudioInt<short>::write(out.ptr, out.len, seq)   ; call [rax+0x10] @ 0x180129c1f
```

* **`AudioOutputStream::setFormat 0x1801293b0`** copies the incoming format's channels/rate to
  `this+0x68`/`this+0x6c` (`0x180129644`, `0x18012964a`) and builds an `AudioResampler` with
  `0x180150100(this, srcCh, dstRate, srcRate, dstCh)` @ `0x180129751`.
* **`AudioResampler::init 0x180150100` validates both sides** — this is the clamp H2 asked for,
  and it exists independently of libopus:
  ```
  0x18015015c  lea eax,[rsi-1] / cmp eax,7 / ja fail     ; srcChannels in [1,8]
  0x180150168  lea eax,[rdi-1] / cmp eax,7 / ja fail     ; dstChannels in [1,8]
  0x180150174  lea eax,[r14-0x1f40] / cmp eax,0x2cec0 / ja fail   ; srcRate in [8000,191999]
  0x18015018a  lea eax,[rbp-0x1f40] / cmp eax,0x2cec0 / ja fail   ; dstRate in [8000,191999]
  0x1801502c6  mov byte ptr [rbx+8], 1                   ; "enabled" set ONLY on success
  ```
  On failure the enabled byte stays 0, `0x180150750` returns `{NULL, 0}` at its first branch, and
  `setFormat` returns false (`cmp byte ptr [rax+8],0 / je` @ `0x180129767`). **No divide-by-zero
  is reachable**: `idiv dword ptr [rbp+0x14]` @ `0x18015080b` divides by a rate proven ≥ 8000, and
  `div r9` @ `0x180129bf3` divides by `2 × channels` with channels proven ≥ 1 by *both* the
  libopus whitelist and this range check.
* **`ensureCapacity 0x1801506f0`** is a correct grow-realloc (`cmp ebx,[rdx] / jle skip`, then
  `delete[]`, `*cap = needed`, `mul rbx` with `cmovb rax,-1` on 64-bit overflow, `new`).
* **The size and the write length come from the same expression.** Downmix/equal path:
  capacity `= (nframes·dstRate/srcRate + 64)·dstChannels` @ `0x180150802`..`0x18015081b`, source
  length `= nframes·dstChannels` @ `0x180150820`, and the capacity is **passed to the kernel** as
  arg5 (`mov qword ptr [rsp+0x20], rax` @ `0x180150834`). Upmix path (`0x180150843`) recomputes
  the capacity from the kernel's actual return before the upmix. The `+64` slop makes the
  same-rate fast path (`0x18030c83c: add r8,r8 / memcpy`) — which ignores arg5 — safe by
  construction, since at equal rates capacity `= (nframes+64)·ch > nframes·ch`.
  **This is exactly the F1 / F4-1 shape the brief told me to look for, and here the two
  expressions agree.**
* **The ring buffer** is a `CircularBufferAudioInt<short>` of `0x400000` elements = **8 MiB**
  (`mov edx, 0x400000` @ `0x18014db5a`). Its `write` does *not* clamp the sample count against the
  capacity (the wrap-around split at `0x18014d2ae`..`0x18014d2e0` would run off the end if
  `n > capacity`), so **the bound is entirely the caller's** — but the caller's `n` is at most
  `(2880 · 191999/8000 + 64) · 8 ≈ 553,000` samples against 4,194,304. **~7.6× margin. INFERRED**
  (arithmetic from confirmed bounds), not measured. Worth one line in remediation as a missing
  defence in depth, not as a defect.
* **`JitterBuffer` is not on this scene.** The app's own printed receive audio graph has five
  nodes and none of them is a jitter buffer; the reordering that exists is the sequence gate in
  `OpusDecoder` (§5b) and the ring buffer. `Musigy::AV::JitterBuffer` exists as a class but is not
  instantiated on the receive audio path in the printed scene. **INFERRED** from the scene log +
  the absence of any construction site reached from this chain; not exhaustively proved.

---

## 5. What the audio leg *does* contribute — three real observations, none of them a write

### 5a. The bundle over-read's consumer is now known, and it is not a leak channel — CONFIRMED + INFERRED

The `(ptr,len)` pairs that fall off the end of the real payload are read by `opus_decode` and
turned into PCM that goes to the **victim's speakers**. That is the only place adjacent heap
content goes.

I considered and reject the one channel this creates that the engagement had not yet
considered — *heap bytes → Opus decode → speakers → victim's microphone → OpusEncoder → back to
the attacker*. The send scene is `AudioSource->Muter->NoiseGate->OpusEncoder->…`, WebRTC's
acoustic echo canceller is present and linked (`AudioProcessingImpl`, `RenderDelayBuffer`,
`RenderDelayController` all have RTTI in this image) and is designed to remove exactly this
signal, and a lossy-codec → speaker → room → microphone → lossy-codec round trip preserves
essentially no bits. **This is not an information-disclosure path.** Wave 4's blocker —
*"there is no information-disclosure path back to the attacker"* — survives this surface.

### 5b. A peer-driven PLC amplifier — INFERRED, ~11× CPU and ~230 KB of allocator churn per packet

`0x180148dd0` conceals gaps by **calling itself with `data = NULL`**, once per missing sequence
number, capped at 10:

```
0x180148e17  mov  eax, dword ptr [rdi + 0x140]   ; last sequence
0x180148e26  sub  edx, eax                       ; gap
0x180148e2a  jle  return                         ; non-advancing -> drop
0x180148e37  lea  ecx, [rdx - 1]                 ; missing = gap - 1
0x180148e3e  mov  ebx, 0xa
0x180148e45  cmovl ebx, ecx                      ; ebx = min(missing, 10)
0x180148e50  ...  xor r8d,r8d / xor r9d,r9d      ; data = NULL, len = 0
0x180148e65  call 0x180148dd0                    ; recurse  (depth 1: NULL data skips this block)
```

The sequence is derived from `[Frame+0x98]`, peer metadata off the wire (the bundle walk seeds it
at `mov ebx, dword ptr [rdx+0x98]` @ `0x180165117`). A peer that advances its declared sequence by
≥ 11 per bundle forces **10 extra full 60 ms concealment decodes and 10 extra 23040-byte `Frame`
allocations for every packet it sends** — measured cost per PLC call: `ret = 2880`, 11520 bytes
written (§1b). At a 20 ms packet cadence that is ≈30× real-time decode work and ≈11.5 MB/s of
allocator traffic on the media thread, per stream. Bounded and survivable — a resource-exhaustion
lead, **not** a memory-safety defect. Not measured live.

### 5c. A stream-kill state-machine wart — CONFIRMED, self-inflicted only

`0x180149288` destroys the existing libopus decoder and nulls `this+0x150` **before** validating
the new format. If validation then fails, `st` stays NULL and the `0x1801494f3` gate silently
drops every subsequent packet for that stream — permanently, until a valid format arrives.
**CONFIRMED** as code shape. **INFERRED**, and worth checking if anyone revives this: that the
format *blob* is inside the E2E envelope — the receive scene is `…Parser->CryptProxy->…` and
`OpusDecoder::setFormat` runs downstream of `CryptProxy`, so the payload it parses should be
post-decryption, which would mean only a key-holding call peer can send it and a peer can
therefore only kill *its own* stream. I did not trace the blob back to a wire offset to prove
it is not carried in the (unauthenticated, hub-visible) `PacketHeader`. Near-zero value either
way; recorded for completeness.

---

## 6. H5 — `NPLHubAudioReadData 0x1803e7510`. **Read, and it is not attacker-facing.**

```
0x1803e7529  cmp qword ptr [rip+0x1600a7], 0 / je -> return 0    ; hub initialised
0x1803e753d  test rdx, rdx / je -> return 0                      ; buf != NULL
0x1803e7546  test r8d, r8d / je -> return 0                      ; len != 0
0x1803e7598  call 0x1800ebe90(hub, &streamName, buf, len)
```
and in `0x1800ebe90`:
```
0x1800ebf5b  shr  r14d, 1                    ; samples = len/2
0x1800ebf5e  mov  dword ptr [rsp+0x70], r14d ; an IN/OUT count
0x1800ebf84  lea  r8, [rsp+0x70]             ; &count
0x1800ebf89  mov  rdx, r13                   ; the CALLER's buffer
0x1800ebf8c  call qword ptr [rax+0x18]       ; ring->read(dst, &count)
0x1800ebf9d  mov  eax, dword ptr [rsp+0x70]
0x1800ebfa1  lea  ebx, [rax + rax]           ; return count*2 bytes
```

**The length is supplied by the host, not by the peer**, and it is passed to the ring read as an
in/out capacity. Moreover **`WickrPro.exe` does not import `NPLHubAudioReadData` at all** — 96 NPL
imports, and the audio ones are `NPLAVAudio*` / `NPLHubAudio{Publish,Subscribe,Unpublish,Unsubscribe}`
only. On this build playback runs entirely through `AudioOutputStream → CircularBufferAudio →
WASAPI`. Same category as Wave 4's `NPLPacketSetSize`: **an exported API with no caller in the
shipped client.** CONFIRMED (PE import table + disassembly).

---

## 7. Corrections to the corpus

1. **`W4-CRUX-rce-path-assessment.md`'s closing pricing is wrong, and this file is the proof.**
   *"Completing it means auditing the wrapper and libopus. That is not a bounded step."* The
   wrapper audit is bounded and took one session: five functions
   (`0x180148810`, `0x180148bc0`, `0x1801494e0`, `0x180148dd0`, `0x180149240`) plus the bundle walk
   and the output stream. libopus was **never** entered as a search target — it was only used as an
   oracle for two bounds that the wrapper depends on, both read directly out of the shipped image.
2. **`NEXT-HUNT-BRIEF.md` §1 #6** says *"`OpusDecoder` uses the same `AV::Parser`, so `Buffer.size`
   lands in the audio Frame the same way and nobody finished the trace."* The trace is now
   finished: `Buffer.size` becomes `[Frame+0x18]`, which is the bundle walk's **budget**
   (`mov edi, dword ptr [rdx+0x18]` @ `0x1801650ba`) — the confirmed over-read — and it never
   reaches `opus_decode` as anything but a *read* length.
3. **`W4-CRUX-rce-path-assessment.md` §5b's loop listing** shows one virtual call. There are two
   (`0x1801651bc` and `0x180165206`), and it annotates `add r15, rax` as "advance by the return
   value"; `mov eax, esi` at `0x1801651ca` makes it the sub-packet length.
4. **`W4-COMPLETENESS-CRITIC.md` §E1's first bullet is REFUTED.**
   *"whether the audio leg reaches the same `decryptCallback` — audio uses the identical kind==2
   path, so the same primitive is probably reachable without the victim ever enabling video."*
   The *conclusion* was right but for a reason that had already been established elsewhere:
   Wave 4 §2 measured F4-1's live carrier to be **audio**, so that precondition question was
   already answered. What §E1 actually left open — whether the audio *decoder* adds a primitive of
   its own — is answered here, and the answer is no.

---

## 8. Where this leaves the engagement

| surface | status |
|---|---|
| F4-1 route A (length-controlled zero-fill) | closed — no content control, no info leak (W4) |
| F4-2 / F5-1 link (a) (the reclaiming object) | narrowed hard, one residual: computed-size allocations (W6 §9 line 1) |
| the mip-calloc "sweep" escape | closed — reach **or** content control, never both (W6 §7) |
| **the audio leg / Opus wrapper** | **closed by this file — no write primitive** |

**The audio leg does not supply the missing ingredient.** The engagement's remaining open item is
unchanged and is the one W6 §9 names: enumerate the **computed-size / array-like** allocation
corpus that W6 §6's constant-size sweep structurally cannot see, via the local running-graph walk
that `NPLNodeCreate`'s corrected calling convention has now unblocked.

**Remediation worth reporting from this surface** (all hardening, no severity of its own):

1. **Bound the bundle walk by the bytes actually received, not by the peer-declared length.**
   `0x1801650ba` reads `[Frame+0x18]`; the walk should additionally clamp against the real
   allocation length. This is the same root cause as F4-1 and the same one-line class of fix.
2. **Clamp `CircularBufferAudio::write`'s sample count against the buffer capacity** (`0x18014d080`
   / `0x18014d1f0`). Currently correct only because every caller happens to be correct.
3. **Validate the new `AudioFormat` before destroying the existing decoder** (`0x180149288` before
   `0x1801492b2`), so a rejected format leaves the stream working.
4. **Cap the PLC recursion by wall-clock or by a per-second budget**, not only by the fixed 10
   (`0x180148e3e`), so a peer cannot buy 10 synthesised 60 ms frames per packet.

---

## Provenance

Every address above was disassembled from the shipped `NPL.dll` by the lead in this pass; class
identities were resolved through MSVC RTTI and, for the decisive `OpusDecoder` sink, through the
**adjustor thunk** rather than through a name match (rule 3). The two measurements
(`opus_decoder_create` acceptance, and the guard-page decode bound) were taken against the
**installed** DLL with arguments identical to the live call site. No subagent contributed to this
file.
