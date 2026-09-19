# W4 CRUX — is there a path from F4-1 to RCE?  Assessment as of 2026-07-31

All addresses disassembled by the lead from the shipped `NPL.dll` / `WickrPro.exe` in this pass.
CONFIRMED = I read the bytes or measured it. INFERRED = reasoned from confirmed facts.

**Answer up front: no RCE path is established, and there is now a structural reason why the direct one
does not work.** What exists is a remote, repeatable, attacker-length-controlled **zero**-fill that
reliably lands on a specific neighbour class. Both routes off it are now characterised.

---

## 1. What the zero-fill actually hits — CONFIRMED, and reproducible

Three live crashes at C=4096 and C=1024. **Two of the three are the identical fault**, at
`NPL RVA 0xe2074`, reading address `0xa6`:

```
0x1800e2060  mov  r9,  [rax+0x10]        ; queued node -> packet object
0x1800e2064  mov  edx, [rax+0x18]
0x1800e2067  mov  ecx, [r9+0xd8]
0x1800e206e  sub  rdx, rcx
0x1800e2071  mov  rcx, [r9]              ; <== the packet's DATA POINTER, at offset 0
0x1800e2074  cmp  r11d, [rdx+rcx+0x26]   ; <== FAULT: rcx was ZEROED, 0x80+0+0x26 = 0xa6
```

The owning class, resolved through MSVC RTTI (vtable `0x180437cb0`, COL `0x1804d8000`,
TypeDescriptor `0x18053c400`):

> **`.?AVXorFecDecoder@Net@NPL@Musigy@@`** — `Musigy::NPL::Net::XorFecDecoder`

So the overrun reliably lands on the **FEC decoder's queue of retained packets**, and the field it
nulls is the packet's data pointer at **offset 0**.

## 2. Why that neighbour is reproducible — the packet allocator, CONFIRMED

`NPL 0x1800e0490` (the packet pool):

```
0x1800e04a5  shl ebx, 6 / not / and ebx,0x40   ; headroom = 0x40 unless the flag is set
0x1800e04ad  lea esi, [rbx+rdx]                ; esi = size + headroom
0x1800e04b0  lea edx, [rsi+0x120]              ; total = 0x120 header + headroom + size
0x1800e04b6  call 0x180114580                  ; the real allocator
0x1800e0501  add rax, 0x120
0x1800e050a  mov [rdx], rax                    ; packet.data = base + 0x120
0x1800e0527  add [rdx], rax                    ;            += headroom   -> base + 0x160
```

**One allocation holds both the object and its payload:** `[0x120 header][0x40 headroom][payload]`, and
the pointer at offset 0 points *into itself*, at `base+0x160`. Every media packet is shaped this way, so
the buffer the `memset` overruns is immediately followed on the heap by more objects of the same class.
That is why the same crash reproduces: the neighbour class is structurally fixed, not luck.

## 3. Route B — F4-2 (content-controlled UAF): CLOSED for a single peer

See `FINAL-REPORT-wave4.md` §F4-2. Measured unconstrained: a 16383×16383 keyframe — the maximum a
14-bit field permits — **succeeds** (+1999.8 MB, `mip`/`mi` both non-NULL). Arithmetic: 19.03 GiB
headroom ÷ 1.95 GiB per context, 2 contexts per publisher (CONFIRMED, selector = bit 14 of `Frame+0x90`)
⇒ **~5 malicious publishers needed; 2 accounts exist.** No gate, no UAF, no content control.

## 4. Route A — partial pointer overwrite: the primitive exists but yields a READ, not a WRITE

`n` is byte-granular, so the `memset` can be made to stop *inside* the neighbour's data pointer, zeroing
only its low k bytes and leaving the high bytes intact. Because that pointer points into its own
allocation (`base+0x160`), a partial zero redirects it to a lower address **in the same region** — the
classic type-confusion shape, and the same shape Wave 3's `pcdemo_partial.exe` rode to PC control (in a
harness).

**But what consumes it only ever reads through it.** I audited the FEC decoder's use of that pointer:

* `0x1800e2074` — `cmp r11d, [rdx+rcx+0x26]`: **read**.
* `0x1800e3850` — `memcpy(dst, src, r8d)` where `dst = [rbx]` is the *freshly allocated* recovery buffer
  and `r8d = r14d` is that buffer's own allocation size. Source is the queued packet. **Read from the
  corruptible pointer, write to a fresh buffer.**
* `0x1800e3935`..`0x1800e39ef` — the XOR recovery loop
  (`movdqu xmm0,[rcx+r8] / movdqu xmm1,[rcx+r11] / xorps / movdqu [rcx+r8],xmm1`, unrolled ×4, plus a
  bytewise tail `xor byte [rcx+rdx-1], al`). Destination again the fresh buffer; the queued packet is the
  source.

**And the write length is correctly clamped** — this was the most promising RCE candidate in the whole
engagement and it is REFUTED by two instructions:

```
0x1800e38ce  cmp   r14d, r10d
0x1800e38d1  cmovb r10d, r14d          ; len = MIN(source_len, allocation_size)
```

`r14d` is the value passed to the allocator at `0x1800e3807` and is **never rewritten** between the
allocation and the clamp (verified: only `mov r8d,r14d` reads it). So the XOR/memcpy cannot exceed the
destination.

**Consequence:** corrupting a queued packet's data pointer redirects a *read source*. Fully zeroing it
gives a NULL dereference (the crash we see). Neither is a write primitive.

**And there is no vtable to hijack in that object:** offset 0 *is* the data pointer, and the constructor
at `0x1800e04cc`..`0x1800e0527` stores only scalars and zeroes — no code pointer is installed. The object
is effectively POD.

## 5. Where the peer-controlled lengths in the FEC path come from — CONFIRMED

Recorded because they are peer-controlled and mostly unexamined:

* `0x1800e2c0e` — `esi = (peer_byte[3] >> 5) + 2`, drives an `n*8` allocation. Bounded 2..9.
* `0x1800e37dd` — `r14d = ((peer_byte[6] & 7) << 8) | peer_byte[7]` — an **11-bit peer length**
  (0..2047) that sizes the recovery allocation at `0x1800e3807`.
* `0x1800e3d27` region — a 13-bit sequence `[r8+rcx+0x26] & 0x1fff` used for packet matching.

**One candidate noticed and NOT chased:** the `memcpy` at `0x1800e3850` copies `alloc_size` bytes from a
source packet whose real length may be smaller. That is a bounded **over-read** (≤2047 B) into the
recovered packet. It is not a write and the recovered packet is consumed locally, so it is not obviously
an information leak to the attacker — but the length relationship was never audited and is peer-driven.

## 5b. NEW — `PacketBundleDecoder` accepts the inflated length and parses adjacent heap. CONFIRMED.

The live logs handed this over: at C=4096 the NPL log shows `Illegal size (4067 bytes), skipping` ×3,
but at **C=1024 that message does not appear at all** — the length was *accepted*. The check, at the
function entry `NPL 0x1801650b0`:

```
0x1801650ba  mov  edi, [rdx+0x18]      ; edi = the PEER-DECLARED length, already minus cryptoPadding
0x1801650c3  lea  eax, [rdi-2]
0x1801650c6  cmp  eax, 0x3fe
0x1801650cb  ja   0x18016522e          ; -> "Illegal size (%d bytes), skipping"
```

⇒ accepted iff **2 ≤ len ≤ 1024**. That is exactly why 4067 was rejected and **995 (= 1024 − 29) was
not.** The real buffer held ~300 bytes, so ~700 bytes of **adjacent heap were parsed as bundle
structure**.

What the parser then does (`0x1801650d1`..`0x180165209`):

```
0x1801650d6  mov   r12, [rdx+0x10]            ; the payload pointer
0x1801650df  movzx eax, byte ptr [r12]        ; count  := buffer[0]        (<= 31, checked)
0x1801650e9  add   r15, rax                   ; payloads start after the length table
0x1801650f8  sub   edi, r8d                   ; remaining budget := PEER length - (count+1)
loop:
0x180165190  movzx esi, byte ptr [r12+rbp+1]  ; sub-packet length := a table byte
0x180165196  inc   esi
0x180165198  sub   edi, esi                   ; spend the budget
0x1801651af  mov   r8, r15                    ; ptr  = walking pointer
0x1801651ac  mov   r9d, esi                   ; len  = the table byte + 1
0x1801651bc  call  qword ptr [rax+8]          ; VIRTUAL sink (the Opus feed)
0x1801651ce  add   r15, rax                   ; advance by the sub-packet length
```

**The loop's budget comes from the peer-declared length, not from the bytes actually received.** So once
the walk passes the real payload, `count`, the length table and the payload bytes are all read out of
adjacent heap, and each resulting `(ptr, len)` pair is handed to the audio decoder through a virtual
call.

**Class: peer-controlled heap over-READ (bounded to ≤1024 B by the size check) whose contents become
`(ptr,len)` arguments to the Opus decoder.** It is a genuine second-order surface — it lets a peer feed
adjacent heap contents into a codec — but it is still **not a write primitive**, so it does not by itself
reach RCE. It is filed as a finding in its own right and as a fuzzing surface.

Note the interaction with F4-1: the size check bounds the *bundle* length to 1024, but F4-1's `memset`
uses the **unbounded** `n`. So C=1024 is the sweet spot where the same packet both (a) overwrites ~700
bytes of adjacent heap and (b) gets its inflated length accepted by the bundle parser.

## 5c. Non-pointer escalations on the same neighbour — both checked, both closed

I had fixated on zeroing *pointers*. A zero-fill can also neutralise counters and bounds, so I mapped the
packet object's fields from the allocator `0x1800e0490` and chased the two classic escalations.

Field map (from the constructor stores):

```
+0x00 data pointer (-> base+0x160, i.e. into itself)   +0x08 length (size)
+0xcc = 1   <-- the ONLY field initialised non-zero    +0xd0 pool   +0xd8 headroom
```

**(a) Refcount → premature free? NO.** `+0xcc` is indeed an atomic refcount; the release idiom
(e.g. `0x1800e1dd4`, and the same shape ~80 times across NPL.dll) is:

```
0x1800e1dda  mov  eax, 0xffffffff
0x1800e1ddf  lock xadd [rdi+0xcc], eax     ; eax = OLD value
0x1800e1de7  cmp  eax, 1
0x1800e1dea  jne  skip                     ; destroy ONLY when old == 1
```

Zeroing 1 → 0 makes the next release read `old == 0`, take the `jne`, and **skip destruction** (the field
goes to −1). That is a **leak, not a UAF** — the opposite of an escalation. Synthesising the value `1`
from a larger count by partial zeroing would require a refcount like `0x0201`; observed counts are 1–3.
**REFUTED.**

**(b) Length field → downstream overflow? NO on the audited consumer.** `+0x08` is the length, and the
FEC path reads it (`mov r10d,[r8+8]`, `sub r10d,edx`) — zeroing it underflows `r10d` — but the very next
instructions are the clamp from §4 (`cmovb r10d, r14d`), so it is bounded to the allocation size anyway.
**REFUTED for this consumer.** Other consumers of `+0x08` were not enumerated.

## 5d. GROOMING MAP, first real data — 2026-07-31, C = 640

`oobprobe2.exe <pid> 304 336 368 400 432 464 496 528`, sender pinned to C=640. **43 paired packets,
344 samples.** (The two earlier attempts captured nothing; that was a logging flaw in my own tool — it
only wrote a line when a pointer was zeroed, and only printed the map on Ctrl+C, which never runs when
the victim dies. Fixed: every pair is logged and victim death is detected.)

| offset from payload ptr | live bytes ZEROED | already zero | pointer-shaped |
|---|---|---|---|
| +304 | 25 | 18 | **none** |
| +336 | 20 | 23 | **none** |
| +368 | 21 | 22 | **none** |
| +400 | 17 | 26 | **none** |
| +432 | 15 | 28 | **none** |
| +464 | 12 | 31 | **none** |
| +496 | 10 | 33 | **none** |
| +528 | 10 | 33 | **none** |

**130 of 344 samples were live non-zero bytes that the `memset` zeroed** — the OOB write reconfirmed at
scale and byte-precisely, on a third independent run.

**Zero pointer-shaped qwords anywhere in +304..+528.** So the band immediately past the payload holds
only non-pointer data and free space. The decreasing `live` / increasing `already zero` gradient with
distance is consistent with running off the tail of live data into free space.

### The survivability cliff localises the lethal structure — INFERRED, but from three measurements

| C | overrun past our block (~300 B payload) | memset events before death |
|---|---|---|
| 640 | ~340 B | **43+, victim SURVIVED** |
| 1024 | ~724 B | 4, died |
| 4096 | ~3796 B | 3, died |

Combined with "no pointers in +304..+528", this brackets the pointer-bearing structure that actually
kills the process to roughly **+640..+1024** — which is also consistent with the two FEC crashes
(`XorFecDecoder` packet data pointer), both of which occurred at C≥1024.

### The bisection, run — CONFIRMED

One probe session spanned both C values (43 pairs at n=640, then 11 at n=768):

* **C = 640 → 43 pairs, victim SURVIVED** the whole call.
* **C = 768 → 11 pairs, victim DIED, `0xc0000005`.**

⇒ the lethal structure sits in **+640..+768**.

### Mapping that band — and the number that decides route A

`oobprobe2 ... 640 656 672 688 704 720 736 752`, C=768, **33 pairs / 66 samples per offset**:

| offset | live bytes zeroed | pointer-valued |
|---|---|---|
| +640 | 3 | 0 |
| +656 | 6 | 0 |
| +672 | 13 | 0 |
| **+688** | 12 | **1 — and it was zeroed** |
| +704 | 8 | 0 |
| +720 | 6 | 0 |
| +736 | 7 | 0 |
| +752 | 6 | 0 |

(The one hit's raw value was lost: the detail logger was capped at `pairs<=8`. Fixed — pointer adjacency
is rare, so it will nearly always fall outside any early window.)

### VERDICT ON ROUTE A — pointer density makes grooming unviable with this primitive

Totals across the entire reachable adjacency, **+304..+752, three independent runs**:

| | |
|---|---|
| samples | **1392** |
| live bytes zeroed by the `memset` | **402 (28.9 %)** — the OOB write, massively reconfirmed |
| **pointer-valued qwords** | **1 (0.07 %)** |

The zero-fill lands, overwhelmingly, in **non-pointer data and free space**. That is also why C=640 is
survivable and C=768 is not: the lethal adjacency is *rare*, not systematic — roughly 1.5 % of packets at
+688, consistent with 11–33 packets being enough to hit it once.

For a grooming exploit you must reliably place an object bearing a code pointer or a write-destination
pointer at a known offset. Two things are missing, and both are now measured rather than assumed:

1. **Natural pointer density in the reachable band is ~0.07 %.**
2. **There is no heap-shaping primitive.** The only allocation an attacker can drive here is more media
   packets, which are a fixed size class — they cannot be used to place a *chosen* object at a *chosen*
   distance.

**⇒ Route A does not reach RCE with the primitive as it stands.** Not "unproven" — measured.

### CORRECTION to the above, and the blocker that actually decides it

I wrote that "the only allocation a peer can drive is a fixed size class". **That was wrong.** The pool
allocator takes the size as an argument:

```
0x1800e049f  mov ebx, r8d        ; flag
0x1800e04ad  lea esi, [rbx+rdx]  ; rdx = the CALLER'S SIZE
0x1800e04b0  lea edx, [rsi+0x120]
```

On the receive path that size is the actually-received payload length, which a peer chooses by how many
bytes it puts on the wire — and FEC *retains* those packets. **So a placement primitive does partly
exist.** A peer can allocate and retain blocks of chosen size in the same heap.

There is also a plausible trigger for allocating *polymorphic* objects: a mid-call `kind==1` FORMAT whose
geometry differs from the current one drives the change path — the equality gate is
`call [rax+0x20] / test al,al / jne` at `0x180132ec4`..`0x180132ec9`, so a peer that varies the geometry
re-enters it at will.

**But none of that gets to RCE, because of a blocker that is independent of all of it:**

> **There is no information-disclosure path back to the attacker.**

Every over-read this engagement found is consumed *locally* and never returns to the wire:
* `QByteArray(ptr, n)` @ `0x14013f401` → decrypt fails → discarded.
* `PacketBundleDecoder`'s over-read → `(ptr,len)` → Opus → the victim's speakers.
* FEC recovery → a recovered packet → decoded locally.
The send graph is `NPLSource->Muter->NoiseGate->OpusEncoder->...`, i.e. it encodes the **microphone** —
nothing derived from received packets is transmitted back. (Audited consumers only; not an exhaustive
sweep of every NPL send path.)

**Consequence.** To convert the zero-fill into control you need a *partial* pointer overwrite that leaves
a valid-but-wrong pointer — zeroing a vtable pointer outright just yields a NULL dereference, which is
the crash we already have. A partial overwrite has to land byte-precisely on a specific field of a
specific object. Without a leak the attacker cannot learn the heap layout, so every attempt is **blind**,
against a **measured 0.07 % pointer density**. That is not an exploit; it is a crash generator.

**⇒ The missing ingredient is not a placement primitive — it is an information leak.**

### The info-leak search — run, and it came up empty

**(a) Feedback channels.** NPL has `Musigy::AV::PacketQueue::FeedbackSender` (RTTI @ `0x1805403e1`) and a
`PacketHeader_Latency` protobuf carrying exactly 5 ints. Every latency symbol is a **timing statistic**
(`OneWayLatencyMin/Max/Avr_fromST`, `..._lastMP`, `downLatency`, `min/maxLatency`) — counters and clocks,
not buffer contents. `nack_*` / `Echo*` symbols belong to the bundled WebRTC audio processing (AEC,
NetEQ), not to a Wickr retransmit path. **No channel carrying received bytes back was found.**

**(b) The all-zeros scan as an oracle — self-defeating. REFUTED.** `CryptProxy` contains a loop that
walks the buffer and branches on whether every byte is zero (it produces
`"All bytes set to zero, decryption failed most likely"`):

```
0x18011b70b  mov edx, [r14+0x18]      ; scan LENGTH = the peer-declared n
0x18011b718  mov rcx, [r14+0x10]      ; scan BASE   = the payload pointer
0x18011b740  cmp byte ptr [rcx], 0
0x18011b743  jne  0x18011b80d         ; first non-zero -> other path
0x18011b74e  cmp eax, edx / jb loop
```

A length-controlled "is this whole region zero?" test is exactly the shape of a heap oracle. But it runs
**after** the decrypt callback, and that callback's `memset` zeroes **the same `n` bytes from the same
pointer**. The scan therefore always reports all-zero on a failed decrypt, by construction — which is
what was observed live (the log line fired on every failed-decrypt packet across four runs, never
varying). **It leaks nothing about pre-existing heap content.**

### Conclusion on RCE

Every ingredient was checked against the bytes or measured:

| ingredient | status |
|---|---|
| remote, repeatable heap write | **have it** (1392 samples, 402 live bytes zeroed) |
| attacker-controlled length | **have it** (`n == C`, 43/43) |
| attacker-controlled placement | **have it** — pool size is the caller's arg; FEC retains packets |
| attacker-controlled **content** | **NO** — zero-fill only; F4-2's content route closed on normal hosts |
| **information leak / layout knowledge** | **NO** — feedback is timing only; the zero-scan is self-defeating |
| useful target adjacency | **0.07 %** natural pointer density, uncontrollable |

**Two independent, necessary ingredients are absent: content control and information disclosure.**
Without a leak, any partial-pointer overwrite is blind; without content control, a successful write
writes zeros. **No RCE path exists on this evidence, and none should be claimed.**

### The one avenue deliberately NOT completed, and why

`Musigy::AV::OpusDecoder` (RTTI `0x18053ddc9`; implementation cluster `0x180148810`–`0x180149240`,
logger tag `0x1804444f0`) is reachable with attacker-influenced `(ptr,len)` via the
`PacketBundleDecoder` over-read of §5b. A memory-safety defect *there* would supply the content control
this chain lacks, so it is the only remaining RCE-relevant lead.

It was started and stopped deliberately. Two passes over the 1108-byte `0x180148dd0` reached container
bookkeeping (`mov ecx,0x28` red-black-tree nodes) rather than the decode buffer. Completing it means
auditing the wrapper *and* libopus. **That is not a bounded step — it is "find a 0-day in one of the most
continuously fuzzed codecs in existence"**, with a correspondingly low prior. It should be scoped as its
own research task if anyone wants it, not tacked onto this assessment.

**Recording this so the negative is honest:** the RCE conclusion above rests on the two missing
ingredients, which are established independently of Opus. Opus could in principle supply content control,
but nothing observed suggests it does, and no claim either way is being made.

## 6. Honest status of the RCE question

| | |
|---|---|
| Remote, repeatable heap corruption | **YES — demonstrated** (F4-1, byte-for-byte, 3/3) |
| Attacker controls the *length* | **YES — demonstrated** (`n == C`, 43/43) |
| Attacker controls the *content* | **NO** — the reachable arm writes zeros by construction |
| Reliable corruption target identified | **YES** — `XorFecDecoder` queued packets, data pointer at +0 |
| Corrupted pointer usable for a write | **NO** — every consumer reads through it; writes go to fresh, correctly-clamped buffers |
| Vtable / code pointer in that object | **NO** — offset 0 is the data pointer; object is POD |
| Content-controlled primitive via F4-2 | **NO** for one peer on this host class |

**So: no RCE path is established.** Calling this RCE would be unsupported.

## 7. What would still have to be true, in priority order

1. **A write through a corrupted pointer.** The zero-fill must reach an object that is later used as a
   *write destination* or holds a *code pointer*. `XorFecDecoder` packets are neither. Nothing has
   surveyed what *else* lands adjacent — the survey is the work, and it needs the victim to live longer
   than ~200 ms (see below).
2. **Victim survivability.** At both C=1024 and C=4096 the victim dies within ~200 ms of the first
   inflated packet (4 and 3 memset events respectively). Grooming cannot be iterated at that rate. The
   lever is a C only slightly above the real payload (real is 181–319 B, so C≈340–400 gives a 20–200 B
   overrun) — enough to corrupt one neighbour field without shredding the whole region.
3. **Small-RAM host for route B.** A 4 GiB VM inverts the F4-2 arithmetic and may need only one peer.
   Cheapest way to revive the content-controlled route; needs no new tooling.
4. **The audio leg's other consumers.** F4-1's carrier is audio; only the FEC decoder's use of the
   corrupted region has been audited. `OpusDecoder` and `PacketBundleDecoder` (which already rejects our
   inflated length with `Illegal size (4067 bytes)`) sit on the same path and were not examined.
