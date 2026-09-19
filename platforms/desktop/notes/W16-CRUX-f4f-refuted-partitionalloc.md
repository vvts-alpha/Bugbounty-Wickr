# W16 — F4f IS NOT AN OUT-OF-BOUNDS WRITE, AND Qt6Pdf DOES NOT USE THE PROCESS HEAP

**Two results, both executed against the shipped `Qt6Pdf.dll`, both load-bearing for the
message-peer (メッセージ相手起点) half of the goal.**

1. **✗✗ F4f / CVE-2026-2648 is REFUTED as an out-of-bounds write.** All 512 stores land *inside* the
   `tp_index` allocation. The earlier "256 out-of-bounds stores, up to 6,104 bytes past a 24-byte
   heap allocation" counted **failures of the upstream guard**, which is not the same thing.
2. **★ `Qt6Pdf.dll` allocates from PDFium's PartitionAlloc, not the Windows heap.** Every grooming or
   adjacency plan for this surface that assumed LFH/NT-heap is invalid.

Tools: `scratch/w16/jpxsurvey.c` (heap-neighbourhood survey), `scratch/w16/jpxwatch.c` (per-store
watcher with the bound check), `scratch/w16/d16.py` (`.pdata`-bounded disassembler).
Nothing was sent anywhere; every PDF was read from disk.

---

## 1. What was claimed

`DISCLOSURE-2026-08.md` §4.5 and the W13 addendum state, as CONFIRMED-executed:

> `tp_index` allocation : 1 entry = 24 bytes
> unguarded stores executed: 256 / 256
> write offsets : +8, +32, +56, +80, ... +6128
> **Every offset from +32 upward is outside the allocation** — up to **6,104 bytes past a 24-byte
> heap block**

and `jpxprobe.c`'s own header states the premise the whole finding rests on:

> `tp_index` is `calloc(TNsot, 24)`. TPsot and TNsot are **independent** 1-byte fields of the same
> SOT marker, so TNsot=1 (a 24-byte allocation) with TPsot=255 aims the write 255*24+8 = 6128 bytes
> past it.

**Both the 24-byte figure and the independence premise are wrong for this build.**

## 2. The measurement — `scratch/w16/jpxwatch.c`, shipped DLLs, WickrPro's own decode call

The watcher breakpoints **both** stores and, at store A, reads the `opj_tile_index_t` that `r8` still
points at (`+0` tileno, `+4` nb_tps, `+8` current_nb_tps, `+0xc` current_tpsno, `+0x10` tp_index):

```
[=] read_sod=256  storeA=256  storeB=256
[=] store-A bound check: in-bounds=0  OUT-OF-BOUNDS=512      <- vs the UPSTREAM GUARD (nb_tps)
writes past current_nb_tps*24 (the real allocation): 0       <- vs the ACTUAL ALLOCATION
distinct (TPsot - (cur_nb_tps-1)) : {0: 494, -1..-9: 18}
max TPsot: 255   max cur_nb_tps: 256
```

`cur_nb_tps == TPsot + 1` at **494 of 512** stores and greater at the other 18. The write at index
`TPsot` is the *last* entry of a correctly sized array, every time. The array base **moves during the
run** (`0x…6BC000 → 0x…94500 → 0x…649200 → 0x…6FD000`, 34 distinct 256-byte slots touched) because it
is being reallocated — which the earlier write-up did not account for.

Destroyed values across all 512 stores: `zero=423 scalar=89 module-ptr=0 heap-ptr=0 inverted=0`.
**Nothing but the array's own previous contents was ever overwritten.**

## 3. Why — the two branches, from the shipped bytes

`opj_j2k_read_sot` is **`0x1802570b0`** (1520 B), found via the marker-handler table at `0x1803fb490`
(`id=0xff90 → 0x1802570b0`). *(The function at `0x18025bfe0` that a marker-constant search finds first
is `opj_j2k_read_header_procedure`, not read_sot — it loops until it sees SOT.)*

`current_tpsno` is set unconditionally once `cstr_index != NULL`:

```
0x1802573af  test rax, rax              ; cstr_index
0x1802573b2  je   0x18025767a           ; no index -> skip the whole section
0x1802573e5  mov  dword [rdx+rcx+0xc], eax   ; current_tpsno = TPsot
0x180257406  test r9d, r9d              ; TNsot
0x180257409  je   0x18025752f           ; ==0 -> grow-to-fit branch
```

**Branch A — `TNsot != 0`.** `nb_tps = current_nb_tps = TNsot(+corr)`, and the array is sized to match
(`calloc(TNsot,24)` @ `0x180257474`, or `realloc(tp_index, TNsot*24)` @ `0x1802574c7`). `TPsot >= TNsot`
never reaches this point — it is rejected earlier and `read_sot` returns FALSE, so **no SOD write at
all**:

```
0x1802572ed  cmp  edx, ecx              ; TPsot vs TNsot+corr
0x1802572ef  jb   0x180257319           ; ok
0x1802572f5  lea  r8, "In SOT marker, TPSot (%d) is not valid regards to the current number of
                       tile-part (header)"
0x18025730e  mov  dword [rbx], 1
0x180257314  jmp  <return 0>
```
*(and a second, earlier copy of the same check against `tcp->m_nb_tile_parts` at `0x18025729f`.)*

**Branch B — `TNsot == 0`** (the recipe the PoC actually uses). First SOT allocates **ten** entries,
not one, and every later SOT grows the array to cover the index:

```
0x18025753a  mov  dword [rcx+rax+8], 0xa      ; current_nb_tps = 10
0x180257570  mov  edx, 0x18 ; call 0x180260fb0 ; opj_calloc(10, 24) = 240 B
0x1802575cb  cmp  eax, dword [rdx+8]          ; TPsot < current_nb_tps ?
0x1802575ce  jb   0x18025767a                 ; yes -> done
0x1802575d6  mov  dword [rdx+8], eax          ; current_nb_tps = TPsot+1
0x1802575f8  lea  rdx,[rax+rax*2]; shl rdx,3  ; (TPsot+1)*24
0x180257600  call 0x180260fe0                 ; opj_realloc  -> array now covers the index
```

`nb_tps` (`+4`) is only written on branch A, so on branch B it stays **0** — which is why the upstream
guard `current_tpsno < nb_tps` rejects all 512 stores while none of them is out of bounds. The
upstream commit is titled "**Redo:** Fix indexing in opj_j2k_read_sod()"; against branch B its effect
is to *stop writing the index record at all*, i.e. defensive hardening.

**⇒ Both branches keep `index < allocation`. The two unguarded stores cannot leave the allocation in
this build.**

**Residual, stated honestly.** The one case the upstream guard also covers and I did **not** construct
is `tp_index == NULL` at SOD (`0x18025c6d2 mov rcx,[r8+0x10]` has no NULL test while `cstr_index` at
`0x18025c6a7` does). `current_tpsno` is only ever written by the same code that ensures `tp_index != NULL`,
so I could not reach it; and if it is reachable it is a **near-NULL write** (`[0 + tpsno*24 + 8]`) —
a crash, not a useful primitive.

**Also corrected:** the four `scratch/w13/jpx/*.pdf` files reach `opj_j2k_read_sod` **zero** times
(measured) — including the "benign" one. Only `scratch/w13/jpx3/*` exercises the path. Any earlier
statement resting on the `jpx/` family is unsupported.

## 4. ★ The positive result — this surface runs on PartitionAlloc

`scratch/w16/jpxsurvey.c` builds an allocation ledger by IAT-patching every loaded module's imports of
the UCRT heap functions (47 thunks) and stops at the first store to describe the neighbourhood:

```
tp_index            = 0x00000F68006BC000          (page-aligned)
its own allocation  : NOT IN LEDGER               (never went through a UCRT heap import)
region              : base=0x00000F6800000000 size=4096 private RW
process heaps       : 6 -- HeapValidate: none of them claims tp_index
                          (and reading tp-1 faults: the preceding page is not committed)
qword map: +256 -> 0x00000F68006BC200   +264 -> 0xFFFFF097FF943DFF
           +512 -> 0x00000F68006BC300   +520 -> 0xFFFFF097FF943CFF   ... stride 256 ...
           +3848 -> 0xFFFFFFFFFFFFFFFF  (last entry: next = NULL, shadow = ~0)
           +4096 -> unreadable
```

Each pair is `{next, ~next}` — `0xFFFFF097FF943DFF == ~0x00000F68006BC200` exactly. That is a
**PartitionAlloc freelist with the inverted shadow entry**, in a **256-byte bucket** slot span, one
page provisioned (16 slots), slot 0 holding the `calloc(10,24) = 240 B` array. Confirmed
independently: `Qt6Pdf.dll` contains the strings **`GeneralPartition`** and **`StringPartition`** —
PDFium's partition names — and **zero** `PartitionAlloc`/`FX_Alloc`/`pdfium` symbol strings.

**Consequences that travel:**

* Any heap bug found inside `Qt6Pdf.dll` sits in **PartitionAlloc**: bucket-segregated (only same-bucket
  objects can be neighbours), guard/uncommitted pages between spans, and a freelist whose `next` is
  validated against `~next`. **Freelist poisoning is additionally dead here for any primitive that
  writes zero-extended 32-bit values** — the shadow of a heap pointer has `0xFFFF…` in its high half
  and cannot be written.
* The **other** decoders a sender can select — `qtiff.dll` (libtiff 4.5.1), `qgif`/`qico`/`qicns`/
  `qtga`/`qwbmp`, and libpng/libwebp inside `Qt6Gui.dll` — are **not** PDFium and use the ordinary CRT
  heap (they appear in the ledger). For exploitation they are a materially better substrate than
  PDFium, at the identical attacker position.
* The `jpxsurvey`/`jpxwatch` instrumentation is generic: ledger + module/section classifier + INT3/VEH
  probes over WickrPro's exact `QImage::loadFromData(bytes, format=NULL)` call. Re-usable for any
  format.

## 4a. ✗ THE UNINITIALISED-SLACK LEAK CLASS IS CLOSED — on the right site set this time

W15 kept as an enabling fact that *"the Frame allocator `0x180135ea0` does NOT zero the inline payload —
32 call sites, 4 checked, 28 unexamined"*, and closed the send path by reading the **direct** call sites.
That was the wrong set. Re-run byte-exactly (`E8 rel32` scan, no linear sweep):

* **`0x180135ea0` has 20 direct call sites**, not 32. Read from the shipped bytes, its signature is
  `(rcx = pool, rdx = payload*, r8d = payloadSize, r9 = meta*, [rsp+0x20] = metaSize)`, and the inline
  region is created **only when `payload* == NULL && size != 0`** (`cmovne rbp, rdx` @ `0x180135ec1`,
  `lea eax,[r14+0xdf]` @ `0x180135ee5`). Confirmed: it never memsets that region.
* **17 of the 20 pass a real payload pointer** — no inline region, nothing uninitialised.
* The inline case has one **wrapper**, `0x180135e80` (27 B: `mov r8d, edx / xor edx, edx`), and
  **12 callers.** Those 12 are the whole class. Verdict per site:

| site | what it is | verdict |
|---|---|---|
| `0x18011b5ff` | `CryptProxy` | `memset` of the reserved region @ `0x18011b61f` — already closed in W15 |
| `0x180127a88` | audio frame assembler | two `memcpy`s totalling **exactly** `r12d*2` = the allocation |
| `0x180147e3c` | **`FdkAacDecoder`** (fixed `edx = 0x2000`) | see §4b — bounded by fdk-aac itself |
| `0x180148fa8` | audio decode | `mov [rsi+0x18], eax` / `mov [rsi+0x60], eax` — **trimmed** |
| `0x18014a91d`, `0x18014ab4f` | **`FdkAacEncoder`** (`"aacEncEncode failed"`) | both `mov [frame+0x60], eax` from the codec's real return — **trimmed** |
| `0x18014baf1` | codec | `mov [rsi+0x60], ebx` / `[rsi+0x18], ebx` — **trimmed** |
| `0x180158fb6` | capture-side PCM | `memcpy` of **exactly** `edi` = the allocation |
| `0x1801612bf` | resampler (`"got numSamplesPerChannel"`) | `memcpy` of **exactly** `rsi` = the allocation |
| `0x1803d38d4`, `0x1803e5289` | NPLAV capture / screen-share (`"window"`, `"screen"`) | capture side — never transits verbatim |
| `0x1803dcad5` | NPLAV API | `xor edx, edx` — **no inline payload at all** |

**⇒ NEGATIVE. No inline-payload Frame reaches the wire with untrimmed slack.** *(One honest residual,
and it is not an address leak: a capture-side allocation whose tail were unfilled would be **encoded**
by Opus/AAC before transmission, so it could only leak lossy audio, never a pointer.)*

## 4b. ✗ AND THE ONE THAT LOOKED LIKE A BUG IS BOUNDED BY THE LIBRARY

`0x180147c30` is **`FdkAacDecoder::process`** (its constructor `0x180147020` carries the literal
`"FdkAacDecoder"`; the recursion at `0x180147ce5` is packet-loss concealment). It allocates a **fixed
8192-byte** inline payload and calls `aacDecoder_DecodeFrame(self, pTimeData = [frame+0x10],
timeDataSize = [frame+0x18] >> 1 = 4096 samples, flags)` at `0x1801d87d0`. The sample count is
`bytes/2` with **no channel term**, which is only correct for mono — and `OpusDecoder::canAccept`
(`0x180148cc0`) shows this family validates **only the codec id** (`cmp [rax+0x10], 0xa`), never the
channel count, while the peer supplies the `AudioFormat`. A 5.1 or HE-AAC stream needs
`numChannels × frameSize` > 4096 samples.

**It does not overflow: fdk-aac checks it itself.**

```
0x1801d9f71  mov  r8d, [rbx+0x4a0]        ; numChannels
0x1801d9fa8  imul r8d, [rbx+0x49c]        ; * frameSize
0x1801d9fb0  mov  edx, [rbp-0x4c]         ; timeDataSize (4096)
0x1801d9fb3  cmp  edx, r8d
0x1801d9fb6  jge  0x1801d9fcb             ; enough room
0x1801d9fbe  mov  r13d, 0x200c            ; AAC_DEC_OUTPUT_BUFFER_TOO_SMALL -> returned
```

**NEGATIVE — do not re-chase.** Worst case is a failed decode. Recorded because the call site looks
exactly like the classic fdk-aac overflow and will attract a second pair of eyes.

## 4c. ★ W14's LAST QUALIFIER IS CLOSED — `NetworkSink` CANNOT EXIST IN ANY WickrPro SCENE

W14's receive→send disjointness negative (the basis for "no peer-reachable leak in the AV path") carried
one qualifier, repeated by W15 §5 and listed in the brief as still-open: *"MEASURED over two-party
audio+video only — a group-call scene containing `NetworkSink` would re-open it."* It is now closed
**without** needing a third account or a live group call.

`Musigy::AV::NetworkSink` is real (RTTI `0x18053d780`) and the two NPLAV functions that touch it —
`NPLAVNetSinkGetFormatBlob 0x1803d0760`, `NPLAVNetSinkSetChannel 0x1803d0880` — reach it by **name
lookup** on the scene (`lea rdx, "NetworkSink"` then `call [rax+0x38]`), i.e. they operate on a node
somebody else created. The only creator is **`NPLAVNetSinkCreate 0x1803d0730`**, and:

* **0 internal direct callers** inside NPL (byte-exact `E8 rel32` scan), and its address occurs
  **0 times as a qword** anywhere in the image — so no vtable or table dispatch reaches it either.
  The export is the only entry point.
* **`WickrPro.exe` does not import it.** It imports **96** NPL exports; of the nine
  Network/Sink/Source exports it takes only `NPLAVSourceCreate`, `NPLAVSourcePushPacket`,
  `NPLAVSourceSetFormat` — **none of the `NetSink`/`NetSource` family**.
* No `GetProcAddress` path either: the strings `NPLAVNetSinkCreate`, `NPLAVNetSink`, `NPLAVNetSource`
  and `NetworkSink` occur **0 times** in the 55 MB `WickrPro.exe`.

**⇒ No WickrPro scene — two-party, group, or screen-share — can contain a `NetworkSink`.** Since W14
identified `NetworkSink::ChannelListener 0x180133a20` as the *only* payload-bearing originator on the
upstream feedback bus, that bus carries a NULL payload in **every reachable configuration**, not just
in the seven scene graphs that were observed. The qualifier can be deleted from the brief.

## 4d. ✗ W15 §3.8's "reading task, not a search" IS DONE — and it closes that escape

W15 §3.8 left one item as *"small, concrete, next"*: **"find an object that is (a) virtually dispatched,
(b) has its vtable in window `0x42`, and (c) has `+0x20…+0x40` filled with peer-influenced values
**legitimately**, so no overflow is needed to control them… **Nobody has read what a peer can put in
those fields.**"** The `Command*` objects were the candidates. All **31** instantiations are now read
straight out of the RTTI type descriptors:

| bound signature (abridged) | `[+0x38]` (→ `edx`) | `[+0x40]` (→ `r8`) |
|---|---|---|
| `Command2<ConnectionImpl, void(PacketType, const SocketAddress*)>` | **`PacketType` — an enum off the wire** | `const SocketAddress*` |
| `Command2<ConnectionImpl, void(bool, SocketAddress)>` | `bool` | `SocketAddress` (by value) |
| `Command2<Puller, void(PacketSender::*)(Event::EventID, const Packet*)>` | `Event::EventID` | `const Packet*` |
| `Command2<Listener<Connection>, void(ConnectionImpl*, const ErrorCode&)>` | `ConnectionImpl*` | `ErrorCode` |
| `Command1<ConnectionImpl, void(const SocketAddress&)>` / `<…(ConnectionState)>` | — | — |
| `Command3<PacketReceiver, void(EventID, const Packet*, const Scene*)>` | `EventID` | `const Packet*` |
| …9 × `Command0`, 11 × `Command1`, 6 × `Command2`, 5 × `Command3` | | |

**The favourable half is confirmed:** `Command2::execute`'s `edx` really is a peer-chosen value in the
common case (`PacketType`/`EventID` come straight off the wire) and `r8` is a pointer to peer-filled
data (`SocketAddress`, `Packet`). **The decisive half is negative:** in *every one of the 31*,
`[this+0x28]` — the field `Command2::execute` loads into `rax` and jumps to — is a **compile-time
member-function pointer planted by the binder**. There is no instantiation in which a peer influences
the call target.

**⇒ The §3.8 escape is closed.** Peer-influenced *arguments* do not help while the *target* is fixed,
so the leak-free route still needs a write to `interface+0x28` — which is exactly the §3.14/§3.15
F1-lattice condition set, and that still rests on F1's alloc-failure gate. Recorded so nobody re-reads
the `Command*` layouts hoping for a different answer.

*(Incidental correction to §3.9's vtable inventory: the `ConnectionImpl` interface vtable at
`0x18042d7b8` (this-offset **24**, confirmed from its COL) holds exactly **one** slot —
`0x1800a7cb0` — because the next qword `0x1804d6358` is the following vtable's COL, not a method.
The `+0x10` interface (this-offset **16**) has 6. Anything that assumed a wide slot menu at `+0x18`
should be re-derived.)*

## 4e. ★★★ F1's ALLOC-FAILURE GATE, MEASURED — AND IT IS 9 CHANCES, NOT ONE, WITH THE SIZE PEER-TUNABLE OVER 3 ORDERS OF MAGNITUDE

The engagement records F1's precondition as *"the victim's commit limit cannot grow"*, derived from a
single 2 GiB probe on a 4 GiB host. That is a statement about one host, not about the defect.
`scratch/w16/f1gate.c` drives the **shipped** `vp8_alloc_frame_buffers` (`NPL 0x180186080`) directly,
records every `vpx_calloc`/`vpx_memalign` request it makes, and can force the Nth request to return NULL
(VEH at the allocator entry: set `rax=0`, `rsp+=8`, `rip=[rsp]`).

**(1) The dangling pointer is reproduced deterministically on shipped code.** Prime once, then fail:

```
priming call: rv=0   mip=0x800097C4C0  mi=0x800097D138
[forcing request #5 (vpx_calloc, 96596 bytes) -> NULL]
returned 1
mip == NULL, mi != NULL   => DANGLING POINTER PRESENT
```
`mi` still points **inside the freed `mip` block**. This is F1, independent of the live demonstration.

**(2) It is nine chances, not "six failure exits".** Forcing *each* request in turn — #0, #4, #5, #6,
#7, #8 tested — **every one produces the dangling pointer**. There are **9 allocator requests** per call
(5 × `vpx_memalign` for the yv12 buffers, `vpx_calloc` for `mip`, `vpx_calloc` for the segment map,
2 more `vpx_memalign`). Any single failure is sufficient.

**(3) The demand is peer-tunable across three orders of magnitude** — this is the part that changes the
precondition. Measured totals for one call:

| peer geometry | requests | total demand | largest single |
|---|---|---|---|
| 640 × 480 | 9 | **2.9 MiB** | 0.5 MiB |
| 1920 × 1080 | 9 | 17.2 MiB | 3.3 MiB |
| 4096 × 4096 | 9 | 129.1 MiB | 24.8 MiB |
| 16383 × 16383 (max) | 9 | **2013.1 MiB** | **387.0 MiB** |

⇒ the attacker does not have to deny 2 GiB. They pick the geometry, so they pick the demand, and **any**
crossing of the victim's available commit during the 9-request sequence fires the bug. Because a failed
call is itself the trigger and costs nothing, a peer can simply **sweep geometry upward until a call
fails** — no advance knowledge of the victim's memory state is needed. The honest precondition is
therefore *"at some moment the victim's process cannot satisfy an allocation the attacker sizes"*, which
is materially weaker than *"the commit limit cannot grow"*. **It is still a precondition — this does not
remove the gate**, and none of it was driven over the wire.

**(4) ★ §3.15's band arithmetic is now validated on shipped code, not just derived.** Measured
`mi − mip` = **228 / 304 / 380 / 3192** at 16×16 / 32×32 / 48×48 / 640×480 — exactly
`(mb_cols+2)·76` from the **user** pointer, i.e. `16 + (mb_cols+2)·76` from the raw block once
`vpx_calloc`'s 16-byte user offset is added. That is precisely W15 §3.15's `P`, so **`P = 244` at
`mb_cols = 1` is confirmed, and `K = 0xd8` (216) does land in the first band `216 < 244 ≤ 248`.**
`mb_cols = 1` needs a **16-pixel-wide frame**, which the format permits.

**(5) The F1-producible block-size sequence, measured.** The request is
`76·(mb_rows+1)(mb_cols+1)` (measured 304 / 456 / 608 / 760 at 16×16 / 16×32 / 16×48 / 16×64 — steps of
152 at width 16), and the raw block is that **+23**. So at the `mb_cols = 1` geometry the reclaiming
object must fall in the bucket for `152·m + 23`. **This is the exact arithmetic §3.15's open check (4)
needs**, per class, and it is now a one-line test rather than an estimate.

**What is still missing after this:** §3.15 check (2) — a code pointer at `PacketSender+0x28`
(object `+0x100`) — and check (4) run over the 26 classes. Neither was done here. And §4d above shows
the `Command*` route cannot supply the call target, so `interface+0x28` still has to be *written*.

## 4f. ✗✗ §3.15 CHECK (2) IS NEGATIVE — `PacketSender+0x28` IS A `CRITICAL_SECTION`'s `LockSemaphore`

W15 §3.15's candidate set is dominated by one offset: **`K = 0xd8` = the `Net::NPL::PacketSender`
interface, held by 26 of the 42 qualifying classes** — essentially every AV graph node. Its open check
(2) was: *"Read what actually occupies `PacketSender+0x28` (object `+0x100`) in a live node"*, because
`Command2::execute` loads that field into `rax` and jumps to it.

`PacketSender::PacketSender 0x180131fc0` answers it without needing a live node:

```
0x180132019  lea   rcx, [rbx + 0x10]          ; rcx = &cs
0x180132022  movups [rcx], xmm0               ; cs+0x00..0x0F  = PacketSender+0x10..0x1F
0x180132025  movups [rcx + 0x10], xmm0        ; cs+0x10..0x1F  = PacketSender+0x20..0x2F
0x180132029  mov   [rcx + 0x20], rax          ; cs+0x20        = PacketSender+0x30
0x18013202d  mov   edx, 0xfa0
0x180132032  call  qword [rip+0x2f22b0]       ; KERNEL32!InitializeCriticalSectionAndSpinCount
```

So `PacketSender+0x10` is a **`RTL_CRITICAL_SECTION`** (40 bytes, spin count 4000), and its fields land:

| CS field | offset in CS | offset in `PacketSender` |
|---|---|---|
| `DebugInfo` (pointer) | +0x00 | **+0x10** |
| `LockCount` / `RecursionCount` | +0x08 | +0x18 |
| `OwningThread` | +0x10 | +0x20 |
| **`LockSemaphore` (HANDLE)** | **+0x18** | **+0x28** ← the call-target slot |
| `SpinCount` (= 0xfa0) | +0x20 | +0x30 |

**⇒ `interface+0x28` for the entire `K=0xd8` family is a kernel HANDLE** — NULL until the lock is
contended, then a small integer. It is neither a code pointer (so there is nothing to partial-overwrite
into an import thunk) nor a heap pointer into sprayable memory (§3.15's fallback). A
`Command2::execute` dispatched through this interface would `jmp` to a small integer.
**NEGATIVE — the modal 26 of the 42 classes cannot supply the call target.**

*(Bonus: `interface+0x20` = `OwningThread` and `+0x38`/`+0x40` are the ctor-zeroed fields at
`0x180132039`/`0x18013203d` — so the argument slots are equally inert.)*

### 4f.1 ✗ THE NEXT FAMILY (`K = 0x138`, 5 classes) IS ALSO NEGATIVE — AND THE SCREEN IS NOW ONE LINE

`FdkAacDecoder`'s constructor (`0x180147020`, identified by its own `"FdkAacDecoder"` literal) stores
at object `+0x160` — which is `interface+0x28` for `K = 0x138`:

```
0x18014716d  lea  rax, [rip + 0x2fce7c]        ; -> 0x180443ff0
0x180147174  mov  qword ptr [rsi + 0x160], rax
```

`0x180443ff0` is **`.rdata`, non-executable, RVA `0x443ff0` ⇒ window `0x44`**. A 2-byte
(ASLR-invariant) partial overwrite can only move a pointer **within its own 64 KB window**, and window
`0x44` lies entirely inside `.rdata` — every address in it is non-executable, so
`Command2::execute`'s `jmp rax` faults on NX. Reaching `.text` would need bits 16+ changed, i.e. a
4-byte write, i.e. **an information leak**. ✗

**⇒ The screen for condition (2) is sharper than §3.15 stated, and it is now a one-liner.** Measured
section layout of the shipped `NPL.dll`:

```
.text    RVA 0x001000-0x4235fe   exec   windows 0x00-0x42
.rdata   RVA 0x424000-0x52d7c2   ---    windows 0x42-0x52     (IAT at 0x424000-0x4250f8)
```

**Window `0x42` is the only 64 KB window that contains both executable code and the IAT.** So for the
leak-free route, `interface+0x28` must *already hold a pointer whose RVA is in `0x420000-0x42FFFF`* —
otherwise a 2-byte write cannot reach anything executable, and anything wider needs the leak the route
exists to avoid.

Against that screen: **`K=0xd8` (26 classes) holds a `CRITICAL_SECTION` HANDLE — not a pointer at all;
`K=0x138` (5 classes) holds a window-`0x44` `.rdata` pointer. That is 31 of the 42 dead.**

### 4f.2 ✗✗✗ THE SCREEN WAS RUN OVER ALL 42 — EVERY ONE FAILS. §3.15 IS CLOSED.

`scratch/w16/slot28.py` disassembles **all 13,498 `.pdata`-bounded functions** (per-record, so it cannot
desync the way a linear sweep does) and reports every statically planted pointer at
`object + K + 0x28` for each candidate `K`:

| K | classes | slot | planted pointers found | window(s) | executable? |
|---|---|---|---|---|---|
| **0xd8** | **26** | +0x100 | 0 static — it is the `CRITICAL_SECTION`'s `LockSemaphore` (§4f) | — | no |
| 0xe0 | 1 | +0x108 | 0 | — | — |
| 0x120 | 1 | +0x148 | 2 | 0x4d, 0x4c | no |
| 0x130 | 1 | +0x158 | 1 | 0x49 | no |
| 0x138 | 5 | +0x160 | 2 | 0x44, 0x49 | no |
| 0x170 | 1 | +0x198 | 0 | — | — |
| 0x180 | 3 | +0x1a8 | 4 | 0x44, 0x49, 0x4c ×2 | no |
| 0x188 | 1 | +0x1b0 | 1 | 0x44 | no |
| 0x258 / 0x340 / 0x560 | 3 | +0x280/+0x368/+0x588 | 0 | — | — |

**Not one planted pointer lands in window `0x42`** — the only 64 KB window containing both executable
code and the IAT. Every one is non-executable `.rdata`.

**⇒ ALL 42 CANDIDATES FAIL CONDITION (2). W15 §3.15 — rated ★★★★★ and called "the main line" — is
CLOSED for the leak-free route.** The conclusion is robust against the "maybe it is runtime-filled"
escape: for the modal `K=0xd8` family the field is a `CRITICAL_SECTION` member whose runtime value is a
kernel HANDLE; and a runtime-filled **heap** pointer fails the same screen anyway, because a 2-byte
overwrite cannot leave its own 64 KB window and no heap window contains NPL code.

**What survives:** the route works if the attacker can write a *full* pointer, i.e. **with an
information leak** — which is exactly the constraint §3.14 claimed to have removed.

**Residual, stated precisely:** the other 11 qualifying classes sit at `K = 0x180, 0xe0, 0x120,
0x130, 0x170, 0x188, 0x258, 0x340, 0x560` (`ProxyVideoOutput`, `ProxyAudioOutput`, `FdkAacDecoder`,
`OpusDecoder`, `AudioEncoder`, `StatisticNode`, `Puller`, `Splitter`, `PacketQueue`, `JitterBuffer`,
`AudioSource`, `ColorspaceConverter`, and `NetworkSink` — the last now known unreachable, §4c). Each
needs the same one-line read of its own `+0x28`. **Not done.** But the headline candidate set — the one
that made §3.15 "★★★★★" — is dead, and §4d already showed the `Command*` objects cannot supply the
target either.

## 4g. The messaging surface — first look, and the `QByteArray::resize` census

W15 §7.3(b) lists the **messaging** path as the one peer-reachable surface never swept for a leak.
Started here; not finished. Two results worth keeping:

**Egress is small and enumerable.** `WickrMlsSdkCpp.dll` reaches the network directly:
`WSASend` ×1 (`0x180a8041b`), `send` ×7, `sendto` ×3 — **11 call sites** across
`0x180a80030`, `0x180d95820/0x180d95950`, `0x180f01230/0x180f01400`, `0x180f0eb48/0x180f0eee0`,
`0x180f0eb7e/0x180f0ef4f/0x180f0f7b9`. Note this is the **transport** (TLS to the server), so
uninitialised bytes there leak to the *server*, not to the message peer; the peer-visible surface is the
message payload built above it. Also: the MLS core is **Rust (`mls_rs`, `X:\vendor\…`)**, so the classic
uninitialised-buffer bug class is unlikely inside it — the C++ wrapper is where to look.
*(Dead end recorded: the string `"+recv_data; auto-releasing padded length of "` is **not** Wickr
message padding — it is the Rust `h2` crate's HTTP/2 flow control.)*

**★ `QByteArray::resize(qsizetype)` leaves the new bytes uninitialised in Qt 6 — and WickrPro calls it
exactly 5 times** (byte-exact IAT xref over the whole 55 MB image, `scratch/w16/iatx.py`):

| site | function | what it is |
|---|---|---|
| `0x140af5ab7`, `0x140af5bad` | `0x140af5860` | Qt's bundled **QZip writer** (`"QZip: Z_MEM_ERROR…"`, zlib `1.2.13`) |
| `0x140af69a7`, `0x140af6a87` | `0x140af65b0` | Qt's bundled **QZip reader** |
| **`0x14095658a`** | **`0x1409562e0`** (`"mask_hash"`, `"sync_mask"`, `"verify"`) | **Wickr's own** |

The Wickr one resizes to **1** (`movzx r14d, al` from a success flag at `0x140956529`, then
`mov rdx, r14`), so it discloses **a single uninitialised heap byte** per call. Real, but it is one byte
at an uncontrolled offset in a fresh allocation — **not an address leak**, and not usable against ASLR.
The QZip pair is the standard resize-to-bound-then-shrink pattern.

**⇒ the sharpest known Qt leak primitive is not present on this surface.** The messaging sweep is
otherwise **unfinished** and remains the best-value unexplored area.

## 4h. ★★★★ THE LIVE HEAP REGIME AND GROOMING ARE NOW MEASURED — AND BOTH ARE FAVOURABLE

W15 §4 listed as **NOT ESTABLISHED**: *"Adjacency is not demonstrated … on Win11 the Segment Heap may
back these sizes instead — not observed on the live target."* Both halves are now settled.
Tools: `scratch/w16/groom.c`, `groom2.c` — allocations go through the **same `ucrtbase`** the shipped
DLLs use (resolved by `GetProcAddress` after loading `NPL.dll`), not the harness's static CRT.

**(1) Regime: classic NT heap with the LFH on — the Segment Heap question is closed.**
`WickrPro.exe`'s manifest (RT_MANIFEST 24/1, read in full) contains **no `<heapType>SegmentHeap</heapType>`**;
Win32 desktop apps get the Segment Heap only by that opt-in. Measured directly: **one heap
(`0x80004A0000`) serves every peer-relevant size class, and `HeapQueryInformation` returns
`HeapCompatibilityInformation = 2` (LFH) for all of them.**

**(2) Adjacency: demonstrated, >93%, at a fixed stride.** 512 allocations per class, address-sorted:

| class | size | modal stride | exactly-adjacent pairs |
|---|---|---|---|
| `SerializerFormat` | 0xe8 | 240 | **478/511 (93.5 %)** |
| `AudioFormat` | 0x100 | 272 | **484/511 (94.7 %)** |
| `VideoFormat` | 0x140 | 336 | **481/511 (94.1 %)** |
| F1 block `mb_cols=1,mb_rows=1` | 327 | 336 | **489/511 (95.7 %)** |
| F1 block `mb_cols=1,mb_rows=2` | 479 | 496 | **482/511 (94.3 %)** |

⇒ W1's prefix-contiguous overflow onto *the neighbour's offset 0* has a >93 % chance of a neighbour
being exactly one stride away, per attempt, and the peer can repeat without limit.

**(3) ★ Reclaim is COUNTED, not probabilistic — this is the one that matters for F1's link (a).**
Immediate reuse is ~0 (`free(p)` then `malloc(same)` returned `p` 0/100 times; the W15 FORMAT cycle
alloc-new-then-free-old landed on the freed block **0/200**) — but that is the wrong question. Freeing a
block and then allocating *repeatedly*, recording the index at which the freed address reappears
(200 trials × up to 512 allocations):

| class | reclaimed | index min / max / mean | distribution |
|---|---|---|---|
| `VideoFormat` 0x140 | **200/200** | 11 / 43 / 42.8 | 199 of 200 in [32,63] |
| F1 327 B | **200/200** | **43 / 43 / 43.0** | **200 of 200 at exactly 43** |
| F1 479 B | **200/200** | 8 / 25 / 8.1 | 199 of 200 in [8,15] |

**The LFH hands the freed block back at a fixed count.** For the 327-byte F1 class it is the **43rd**
allocation, in **every one of 200 trials**. So placing a reclaiming object on the freed mode-info block
is not a spray-and-pray — it is *free the array, then drive the target class exactly N times*, and the
peer has an unbounded on-demand driver for exactly these classes (W15's FORMAT primitive).

**(4) And it survives contention.** Repeating the 327-byte test with a second thread continuously
churning **the same bucket**: still **200/200 reclaimed**, index min 8 / max 43, **192 of 200 inside an
8-slot window**. The counted groom is robust to concurrent same-bucket traffic.

> **Honest qualifiers.** This is a harness process, so the absolute index (43) reflects that heap's
> subsegment state and will differ in a live client — what transfers is the *mechanism* and the
> *reliability* (200/200, tight window, contention-robust), not the constant. Nothing was driven over
> the wire, and none of this supplies a call target or an address — §4f.2 and the missing leak are
> untouched by it.

**⇒ Two of the four items the goal lists as missing — "live heap regime" and "grooming" — are now
measured, and both came out favourable.** What remains missing is unchanged: **a peer-reachable leak**,
and F1's alloc-failure gate (weakened but real, §4e).

## 4i. ★★★★ NEW — F7: A PEER-DECLARED LENGTH IS USED AS A FRAME'S PAYLOAD SIZE OVER THE RECEIVED BUFFER, WITH NO CHECK

The first peer-triggerable **out-of-bounds READ** in this engagement, found by comparing sibling call
sites of the `Frame` allocator rather than by looking for it directly.

**The dispatch.** `Parser`'s packet handler `0x18011fce0` parses the peer's bytes into a protobuf message
and switches on one of its fields:

```
0x18011fd4c  mov  r8d, [rsi+0x88]        ; the received payload size
0x18011fd53  mov  rdx, [rsi+0x80]        ; the received payload bytes
0x18011fd61  call 0x1801090d0            ; ParseFromArray  -> [Parser+0xe8]
0x18011fdca  mov  rdx, [rdi+0xe8]        ; the PARSED PEER MESSAGE
0x18011fdd1  mov  ecx, [rdx+0x64]        ; peer-chosen kind
0x18011fdd7  je   -> 0x18011ed00         ; kind 1 = the FORMAT handler (W15's E3)
0x18011fde0  je   -> 0x18011ef70         ; kind 2 = THIS ONE
0x18011fde9  je   -> 0x18011ea60         ; kind 3
```

All three receive `rcx = Parser`, `rdx = the parsed peer message`, `r8 = the received Packet`.

**The sibling does it correctly.** `0x18011ea60` (kind 3) keeps `r15 = r8` (the Packet) and builds its
Frame from **one** object — so `Packet+0x10` is the payload pointer and `Packet+0x18` its length:

```
0x18011ec70  mov r8d, dword ptr [r15 + 0x18]      ; length  <- the Packet
0x18011ec74  mov rdx, qword ptr [r15 + 0x10]      ; pointer <- the Packet
0x18011ec7b  call 0x180135ea0                     ; Frame(pool, ptr, len, ...)
```

**`0x18011ef70` (kind 2) does not.** It takes the pointer from the Packet and the length from a
**sub-message of the peer's own protobuf**:

```
0x18011efac  test byte ptr [rdx + 0x10], 1        ; has-bit for the optional sub-message
0x18011efb6  mov  rax, qword ptr [rdx + 0x30]     ; the peer's sub-message
0x18011efba  lea  r14, [rip + 0x411b97]           ; protobuf default instance (0x180530b58)
0x18011efc4  cmovne r14, rax
0x18011efef  mov  r8d, dword ptr [r14 + 0x18]     ; *** LENGTH from the PEER'S MESSAGE ***
0x18011eff3  mov  rdx, qword ptr [rsi + 0x10]     ; *** POINTER from the received Packet ***
0x18011effa  call 0x180135ea0
```

**`[rsi + 0x18]` — the Packet's own length, the value the sibling uses — is never read anywhere in the
2,343-byte function.** (Grep of the full disassembly: the only `rsi+0x1?` references are `+0x10` at
`0x18011eff3`.) **There is no bound check.** The protobuf default instance at `0x180530b58` has
`[+0x18] = 0`, so an *absent* field is safe; a *present* one supplies the length directly.

**Where it goes.** The Frame is populated with peer metadata (`[rdi+0x40]`, `+0x44`, `+0x58`, `+0x5c`,
`+0x60`, `+0x38`) and then pushed to **both downstream sinks** through the `PacketSender` interface:

```
0x18011f800  lea rdi, [r13 + 0xd8]       ; the PacketSender interface  (K = 0xd8 -- see 4f)
0x18011f807  lea rbx, [rdi + 0x10]       ; its CRITICAL_SECTION        (confirms 4f independently)
0x18011f813  call EnterCriticalSection
0x18011f82c  mov r8, r14 / call [rax]    ; sink 1 = [PacketSender+0x38]
0x18011f846  mov r8, r14 / call [rax+8]  ; sink 2 = [PacketSender+0x40]
```

> ### What this is, and what it is not
> **CONFIRMED (disassembled):** a peer-chosen 32-bit length becomes a `Frame`'s payload size over a
> buffer whose real length is a *different* field that the code never consults, on the receive path, with
> the sibling handler proving the correct pairing. **⇒ a remotely triggerable out-of-bounds READ of
> attacker-chosen length.** At minimum a remote DoS (the read walks off the heap block and will cross an
> unmapped page for a large enough declared length).
> **NOT ESTABLISHED — and this is the difference between a DoS and the leak this engagement needs:**
> **(1)** that `[sub-message + 0x18]` maps to a wire field the peer sets *without a clamp* — the has-bit
> gate proves it is peer-*provided*, but `Format::parse 0x18013da20` was not read for a bound;
> **(2)** that any consumer of the Frame emits bytes derived from the over-read region back to the
> network. The two sinks are downstream AV-graph nodes, and W14's receive→send disjointness (now
> unconditional, §4c) says the decoder's output does not return to the wire. **So this is an OOB read,
> not a demonstrated information leak.** Nothing was sent; nothing executed.
>
### 4i.1 Both open items answered — (1) POSITIVE, (2) NEGATIVE ⇒ F7 is a remote DoS, not the leak

**(1) The length IS peer-controlled — RESOLVED POSITIVE.** The sub-message's vtable `0x180442358`
resolves through its COL (`0x1804dc740`) to **`Musigy::AV::Proto::PacketHeader_Buffer`** — a protobuf
nested message of the `PacketHeader` the peer sends. In protobuf C++ gencode the object layout is
`+0x00` vptr, `+0x08` internal metadata, `+0x10` has-bits, `+0x14` cached size, **`+0x18` = the first
declared field** — which is exactly the offset loaded at `0x18011efef`. The has-bit test at
`0x18011efac` confirms the field is peer-*provided* (the default instance `0x180530b58` carries
`[+0x18] = 0`), and **nothing between `ParseFromArray` and the `Frame` construction clamps it**: the
only operation on the path is that has-bit test. Generated protobuf parsing applies no application-level
range check, so the declared length is an arbitrary **32-bit** value. *(The `Frame` allocator does not
copy when a payload pointer is supplied — it stores `[frame+0x40]=ptr`, `[frame+0x60]=size` — so a huge
declared size costs no allocation; it simply produces a descriptor spanning up to 4 GiB of the received
buffer.)*

**(2) The over-read does NOT reach the network — RESOLVED NEGATIVE.** The two sinks
(`[PacketSender+0x38]`, `[PacketSender+0x40]`) are downstream **AV-graph receivers**, and two
independent results already bound where such a Frame can go: W15 §3.6's BFS from all 499 reachable
callees to the complete egress set (`sendto`/`send`/`SSL_write`/`BIO_write`) returned **0 at depth 3, 5
and 7**; and W14's receive→send disjointness, which §4c above made **unconditional** by proving
`NetworkSink` cannot exist in any WickrPro scene. So the bytes the descriptor over-spans are consumed by
the local decode chain, not re-emitted.

> **⇒ F7's final classification: a remotely triggerable out-of-bounds READ with an attacker-chosen
> 32-bit length, reachable by any call peer, consumed locally. Remote DoS (the descriptor will span
> unmapped memory long before 4 GiB). NOT an information leak — no peer-visible channel carries the
> over-read bytes.** Worth reporting on its own; it does **not** supply the address the RCE chain needs.

## 4j. ★ TOOLING DEFECT THAT TRAVELS — `NPL.dll`'s LOG LITERALS ARE UTF-16LE, SO ANY ASCII-ONLY STRING CENSUS OVER NPL IS A FALSE NEGATIVE

Caught in this session, in my own work. An ASCII search of the shipped `NPL.dll` for
`"Sending feedback packet"`, `"feedback packet"`, `"event id is"`, `"Sending EVENT"` and
`"Sending FORMAT"` returns **0 hits for every one of them** — and all five strings are present. They are
**UTF-16LE**:

```
0x18043f2a0: 53 00 65 00 6e 00 64 00 69 00 6e 00 67 00 20 00 66 00 65 00 65 00 64 ...
             "S  e  n  d  i  n  g     f  e  e  d  b  a  c  k     p  a  c  k  e  t , …"
```

Counted over the whole image: `"Sending"` ASCII **0** / UTF-16 **3**; `"feedback"` ASCII **0** / UTF-16
**4**; `"event id"` ASCII **0** / UTF-16 **2**. The binary is **mixed** — third-party code (libopus,
fdk-aac, WebRTC) logs in ASCII while Musigy's own `LOG()` macros are wide — which is exactly what makes
this trap silent: an ASCII census *does* return plausible hits, just not the Wickr ones.

**Consequences.** W14's `0x18043f2a0` literal and W15 §5's `"Sending FORMAT/EVENT packet"` sites are
**correct** — I briefly suspected otherwise and was wrong. What *is* wrong is any ASCII-only census:
my own earlier result in §4g that `NPL.dll` contains **0** padding-related strings is a false negative
and should not be relied on. `scratch/w16/ref16.py` searches ASCII only — **fix or work around it before
using it on NPL**, and re-run any earlier census that used a plain ASCII string scan over this DLL.

**Re-run under the fix, §4a's identifications all survive** — and are now confirmed *by name* rather than
by inference:

| site | function | UTF-16 literals recovered | §4a verdict |
|---|---|---|---|
| `0x18011b5ff` | `0x18011b3b0` | `"Padding/packet size mismatch"`, `"All bytes set to zero, "` | **CryptProxy** — memsets ✓ |
| `0x180147e3c` | `0x180147c30` | `"Failed to decode audio frame (aacDecoder_DecodeFrame), code: "` | **FdkAacDecoder** ✓ (§4b) |
| `0x180148fa8` | `0x180148dd0` | `"opus_decode failed"`, `"opus_decode returned empty buffer"` | **OpusDecoder** — trims ✓ |
| `0x18014baf1` | `0x18014b9a0` | `"opus_encode failed"`, `"Input buffer overflow"` | **OpusEncoder** — trims ✓ |
| `0x180158fb6`, `0x1801612bf` | `0x180158de0`, `0x1801610b0` | `"webrtc::AudioProcessing::ProcessStream failed"` | capture side ✓ |
| `0x1803e5289` | `0x1803e5180` | `"window"`, `"screen"`, `"Capture failed"` | screen capture ✓ |

**No conclusion in §4a/§4b changes.** Recorded because the defect would silently produce false negatives
for anyone repeating a string-driven census here.

## 4k. ★★★★★ THE RENDERER SURFACE — REACHABILITY ANSWERED, AND IT IS THE LARGEST LIVE SURFACE IN THE PRODUCT

W8/W11 tried to settle the renderer by **version archaeology** ("did Qt's backports land?") and failed
for lack of a baseline. That was the wrong first question. The right one — **does peer-controlled
content reach Chromium, and in what confinement?** — is answerable from shipped bytes alone, and it is
now answered.

**(1) Peer content DOES reach Blink.** A8 recovered the architecture from embedded sourcemaps: a
received file is previewed by `FilePreviewModal` → a same-origin `qrc:` **child iframe** whose
`FILE_PREVIEW_COMPONENT_MAP` is `{pdf, docx, xls/xlsx/csv, pptx, xml/rss, txt/log/md, rtf}`, fed
`fileUrl = wickrweb://…` bytes the native side decrypts. **The attacker controls the file bytes and the
extension** (the extension selects the renderer). Libraries: SheetJS/xlsx, JSZip 3.10.1, docx-preview,
mammoth, DOMPurify, a **pptx2html Web Worker**, PDF.

**(2) Script execution from that content is blocked — and that is NOT the same as the surface being
closed.** A8 proved by harness that CSP `script-src 'self' qrc://*` (no `unsafe-inline`, no
`unsafe-eval`) plus universal escaping/DOMPurify stop attacker *JS*. **But CSP does not constrain
memory safety.** The converted document still drives Blink's HTML/CSS parsing and layout, V8's
execution of the *app's own* conversion JS over attacker data, and Chromium's image decoders on images
embedded in the docx/pptx/xlsx. A layout or decoder bug needs no script at all, and once it fires the
CSP is irrelevant — the attacker is executing native code, not JS.

**⇒ The renderer memory-safety surface is reachable by any message peer, and no wave has assessed it.**
A8 explicitly scopes itself to "attacker JS execution in the renderer"; W8/W11 only tried to date the
Chromium patch level. Nobody has asked whether a renderer memory-safety n-day lands here.

**(3) Confinement, measured this wave — the shipped posture is the *good* one, which raises the bar:**

| property | measured | evidence |
|---|---|---|
| separate renderer process | **yes** | `QtWebEngineProcess.exe` ships (743,848 B) |
| `--no-sandbox` passed by the app | **no** | string absent from `WickrPro.exe` (ASCII **and** UTF-16) |
| `QTWEBENGINE_DISABLE_SANDBOX` set by the app | **no** | string exists only inside `Qt6WebEngineCore.dll`, which *reads* it |
| DevTools remote debugging | **OFF** | see below |

**DevTools, settled.** `0x1408d3ba0` sets the WebEngine environment. `QTWEBENGINE_REMOTE_DEBUGGING` is
driven by the global at **`0x143498F70`**: `==3` → `qunsetenv` (explicitly disabled); `==0/1/2` →
`qputenv` port **3001/3002/3003**; a non-zero override at `0x1434F7A08` → that port instead. **The
shipped static initialiser is `4`** (`.data`, present in the file; the override is `0` in `.bss`), which
matches none of the port branches and not the unset branch — so the variable is **never set**.
**Remote debugging is off in the shipped configuration.** *(Minor hardening note: only the `==3` path
calls `qunsetenv`, so a pre-existing environment value would survive on other channels. A local attacker
who can set your environment already has better options; recorded, not escalated.)*

**⇒ The realistic RCE path for this product is the standard two-stage Chromium chain:** a renderer
memory-safety n-day reachable from a previewed document, **plus** a sandbox escape from
`QtWebEngineProcess` (the `CVE-2025-2783` Mojo class W11 examined). That is a higher bar than the native
peer-originated path — but it is the *only* path in this product that is both peer-reachable and
un-assessed, and it is gated entirely on the **UNDETERMINED** Chromium patch state (base
**130.0.6723.192**, Oct 2024; claimed level `139.0.7258.67` neither substantiated nor refuted).

**The gating artefact is unchanged from W11 and is now the single highest-value acquisition in the
engagement:** a **stock Qt 6.9.2 QtWebEngine reference build** (W11: "unblocks every code-only CVE at
once"), or failing that a Chromium in `[130.0, 134.0)`. Secondary, and cheap: **confirm where
`CVE-2025-2783`'s remediation actually is upstream** — W11 flags the `TransferHandle` identification as
*recall, not diff*, and load-bearing.

### 4k.1 ★★★★★ THE REACHABLE NATIVE SUBSYSTEM, NAMED — peer PDF → PDF.js → `new FontFace(…)` → Chromium's font stack

"Chromium 130 is unpatched" only matters if the **reachable** subsystem carries the bug. That set is now
identified, from the shipped resources, with no download required.

**Re-carved the embedded qrc resources** (`scratch/w16/qrccarve.py` — Qt stores a compressed entry as a
4-byte big-endian length then a raw zlib stream): **4,001 zlib streams, 3,881 text resources**, matching
A8's carve identities exactly (`blob_00e46f48.html` = `file-preview/index.html`,
`blob_00e568b7.html` = main `index.html`).

**★ A complete SBOM of the web app fell out of it** — `blob_00e4886f.txt` is the bundled-dependency
licence manifest: **209 JS dependencies with exact versions**. The attacker-facing subset (the peer
controls the file bytes *and* the extension that selects the renderer):

| library | version | attacker input |
|---|---|---|
| `@e965/xlsx` (SheetJS fork) | **0.20.3** | xls / xlsx / csv |
| `docx-preview` | **0.3.5** | docx |
| `jszip` | **3.10.1** | every OOXML container |
| `pdfjs-dist` | **4.10.38** | pdf |
| `dompurify` | **3.2.5** | the sanitiser boundary itself |
| `highlight.js` / `markdown-it` | **11.8.0** / **14.1.0** | md / txt / log |

*(Architectural correction worth carrying: previewed PDFs go through **PDF.js**, not the native
`Qt6Pdf`/PDFium of §1–§4. F4f's path — `QImage::loadFromData` via `qpdf.dll` — is a **different**
surface from the file-preview modal.)*

**The native destination, confirmed in the PDF.js chunk** (`blob_01970d15.js`, 367 KB —
`FontFace` ×33, `@font-face` ×3, `pdfjs` ×46, `OffscreenCanvas` ×13, `ImageData` ×20, `putImageData` ×7):

```js
createNativeFontFace(){
  if(!this.data || this.disableFontFace) return null;
  if(!this.cssFontInfo) t = new FontFace(this.loadedName, this.data, {});
  else                  t = new FontFace(this.cssFontInfo.fontFamily, this.data, s);
  ...
}
createFontFaceRule(){ ... `url(data:${this.mimetype};base64,${…})` ... }
```

`this.data` is the font program **PDF.js extracts and rebuilds from the attacker's PDF**, handed to the
**native** `FontFace` API — i.e. Chromium's OTS (OpenType Sanitiser) → Skia / FreeType / DirectWrite.
The `createFontFaceRule` variant reaches the same place through CSS `@font-face`.

> **⇒ The chain, stated exactly:** *a message peer sends a PDF → it is auto-previewed → PDF.js parses it
> in JS → rebuilds the embedded font program → `new FontFace(name, attacker-derived bytes)` → **Chromium
> 130's native font parsing**.* It needs **no script execution**, so A8's CSP result does not touch it;
> it is peer-reachable by A8's own preview flow; and it lands in one of the most bug-dense native
> subsystems a browser has.
>
> **This names the CVE class that matters: Chromium font-stack (OTS / Skia / FreeType) bugs in the
> `130 → present` window.** Alongside it, second tier: embedded images from docx/pptx/xlsx reaching the
> image decoders via `<img>`/canvas, and PDF.js's canvas rasterisation.
>
> **Honest constraint:** PDF.js *rebuilds* fonts through its own OpenType builder, so what reaches
> `FontFace` is PDF.js's reconstruction, not raw attacker bytes. That narrows attacker control (tables,
> glyph counts, cmap, CFF charstrings are derived from the PDF) — it does not remove it, and this path
> has historically been used to reach font-engine bugs. **Nothing was exploited; no CVE has been matched
> to this build.**

## 4l. THE BACKPORT QUESTION — METHOD BUILT AND VALIDATED, FIRST PROBE NEGATIVE

Reference builds acquired (operator-approved, Google's public Chrome-for-Testing, no auth):
`ref/chrome130.dll` (from **130.0.6723.116**, the closest public build to Qt's **130.0.6723.192** base)
and `ref/chrome139.dll` (from **139.0.7258.68**, one patch past Qt's claimed **139.0.7258.67**).
*(The stock Qt 6.9.2 MSVC build W11 asked for is behind a Qt Account and was **not** obtained — account
creation/authentication is out of scope. These bracket the window instead.)*

**★ Finding 1 — the string-anchor method does not transfer, and that explains W11's results.**
`Qt6WebEngineCore.dll` retains Chromium source-path strings
(`third_party/blink/renderer/platform/fonts/font_custom_platform_data.cc`,
`skia/src/ports/SkFontMgr_win_dw.cpp`, 22 × `skia/src/core/*.cpp`); **official `chrome.dll` retains
ZERO of them** — official builds strip them. So any Qt-vs-Chrome comparison built on source-path or
`LOG(FATAL)`-line anchors is structurally unable to produce a verdict. **This is the concrete
explanation for W11 thread A's five "NOT TESTABLE / UNDETERMINED" outcomes**, and it means that line of
attack should not be retried as-is.

**★ Finding 2 — structural comparison DOES transfer, and the method is now validated.** Locate the same
function across builds by its distinctive constant immediates, then bound it with `.pdata`:

* `GetFontPlatformData` is uniquely identified by the `SkFourByteTag` immediates `'wght'` `0x77676874`,
  `'wdth'` `0x77647468`, `'slnt'` `0x736c6e74` appearing within a few hundred bytes.
* Found in all three: Qt `0x187183765`–`0x187183b47` (994 B), chrome130 `0x18111abae`,
  chrome139 `0x180de36d1`.

**★ Finding 3 — the first probe is NEGATIVE, and honestly so.** The real upstream diff was obtained
(gitiles blocks anonymous *history* with 403, but **raw file content at a tag works** — W13's method),
`font_custom_platform_data.cc` at both tags. The security-relevant change is a guard added around each
variation coordinate:

```c
-  weight_coordinate = {kWghtTag, SkFloatToScalar(wght_range.clampToRange(...))};
+  if (wght_range.IsValid()) { weight_coordinate = {kWghtTag, ...}; }     (also wdth, slnt)
```

The ranges come from the font's own `fvar` axes — attacker-controlled for a web font. **But the emitted
code is byte-structurally identical in chrome130 and chrome139** (`cmp cx,ax` / `jl` → `ud2` in both):
the compiler already emitted the range check, so **this fix is not a discriminator.** No verdict on the
backports from it.

**Incidental, and worth recording because it looks alarming and is not:** at that site the **shipped Qt
build has no trap at all** — `cmp cx,dx / jl` jumps *forward over the clamp* and continues with the
unclamped value, and the whole 994-byte function contains **0 `ud2`**, where both Chrome builds trap.
That is a **build-configuration difference** (Chrome's official `CHECK` compiles to `ud2`; Qt's build
does not), not a missing backport. The value used is still a valid 16-bit `FontSelectionValue`, so there
is **no memory-safety consequence** — Qt degrades where Chrome crashes.

> **⇒ Status: the capability W11 lacked now exists** — same-function structural comparison across Qt and
> official Chrome, with both bracket builds on disk (`scratch/w16/ref/`). **What remains is iteration:**
> find fixes in `(130.0.6723, 139.0.7258]` whose *codegen* genuinely differs between the two references,
> then test the shipped build against them. The first candidate tried does not differ. **No conclusion
> about Qt's backports is claimed, in either direction.**

### 4l.1 ✗ THE BACKPORT QUESTION CANNOT BE SETTLED BY ANY METHOD AVAILABLE HERE — four independent reasons

Iterated the probe set. Every candidate came back negative, and the reasons compose into a structural
conclusion that is more useful than more sampling.

**Probes run** (real upstream diffs, `130.0.6723.116` → `139.0.7258.68`, fetched via gitiles raw-file-at-tag):

| file | change | verdict |
|---|---|---|
| `font_custom_platform_data.cc` | `IsValid()` guards added around wght/wdth/slnt coordinates | **codegen identical in both refs** (`cmp`/`jl`→`ud2` already emitted) — non-discriminating |
| `web_font_decoder.cc` (the OTS bridge) | error-string accumulation + `UNSAFE_TODO()` | refactor, no bounds change |
| `variable_axes_names.cc` | `base::span` refactor | no behavioural change |
| `open_type_vertical_data.cc` | `UNSAFE_TODO()` annotations + 3 × *"indexed the wrong way … overrunning the stated length"* comments | **analysed in full — bounds are correct** (see below) |
| `open_type_caps_support.cc`, `font_format_check.cc`, `open_type_math_support.cc` | 0–2 lines | nothing |

**The `open_type_vertical_data.cc` scare, resolved.** Chromium's own 139 source carries, three times,
`// TODO(crbug.com/406666714): this is indexed "the wrong way" below, overrunning the stated length of
the array` — on `hmtx`, `vmtx` and `VORG` entry arrays, i.e. attacker-controlled font tables on the
reachable path, annotated rather than fixed. It is **not** a memory-safety bug:
`ValidateTable<T>(buffer,count)` is `buffer.size() >= sizeof(T)*count`, and `sizeof(HmtxTable)` =
`sizeof(VmtxTable)` = 4 = one entry, so the loops reading `4*count` bytes are exactly guarded; VORG's
`RequiredSize() = 12 + 4*(n-1)` exactly covers the bytes `[8, 8+4n)` the loop reads, and `n == 0` (which
would wrap `RequiredSize()` to 8) is handled by an explicit early branch. The comment is **C++ UB
pedantry** about indexing `entries[1]` past index 0 — a spanification blocker, not a defect.

> ### ⇒ WHY THE QUESTION IS NOT ANSWERABLE HERE — state this instead of sampling further
> 1. **String anchors do not transfer.** Qt's build keeps Chromium source-path strings; official
>    `chrome.dll` strips them (measured, §4l). Every anchor-based Qt↔Chrome comparison is dead on
>    arrival — the concrete cause of W11 thread A's five NOT TESTABLE results.
> 2. **Version banners are absent from both binaries.** No FreeType / HarfBuzz / libpng / zlib version
>    string in the shipped `Qt6WebEngineCore.dll` (checked; the `ots-*` hits are CSS artefacts like
>    `dots-`). So component-version comparison is unavailable.
> 3. **The window's `chromium/src` font changes are refactors, not security fixes.** Across every file
>    fetched, the diffs are Chromium's spanification migration. There is nothing security-shaped to test.
> 4. **The real font security fixes are in DEPS'd repositories** — FreeType, HarfBuzz, OTS, Skia — which
>    are *not* in `chromium/src` and therefore not reachable by raw-file-at-tag, while (2) means their
>    shipped versions cannot be recovered from the binary either.
>
> **⇒ Settling Qt's backport claim requires the artefact W11 named — a stock Qt 6.9.2 QtWebEngine build
> — and that is behind a Qt Account, so it was not obtained.** Everything short of it has now been tried
> and the failure modes are understood rather than guessed. **No conclusion about Qt's backports is
> claimed in either direction; `139.0.7258.67` remains self-reported and unverified.**
>
> *(What was gained: the same-function structural comparison method is built and validated, and both
> bracket references are on disk at `scratch/w16/ref/` for any future attempt.)*

## 4m. ★★★★★ F8 — CVE-2025-10728 (Qt SVG) IS PRESENT AND REACHABLE. EXECUTED: A 94-BYTE FILE CRASHES THE SHIPPED DECODER.

The operator pointed at `https://download.qt.io/archive/qt/6.9/`, which turns out to need **no
authentication** and to host something nobody in this engagement had looked at: **Qt's own published
CVE patches for the 6.9 series**.

```
CVE-2025-10728-qtsvg-6.9.diff          01-Oct-2025
CVE-2025-10729-qtsvg-6.9.diff          01-Oct-2025
CVE-2025-12385-qtdeclarative-6.9-0001.diff / -0002.diff   24-Nov-2025
CVE-2025-14575-qtbase-6.9.diff         19-May-2026
```

**The timeline is the finding.** The shipped Qt DLLs are dated **2025-09-17** (Qt 6.9.2);
`CVE-2025-10728-qtsvg-6.9.diff` was published **2025-10-01**, two weeks later; and **`WickrPro.exe` is
dated 2026-07-13** — roughly nine months after the patch was public.

**CVE-2025-10728** fixes a stack overflow where an SVG element references itself through `url()`
(QTBUG-137553, found by OSS-Fuzz). Its patch adds a recursion guard to `QSvgPattern::renderPattern()`
and, with it, a distinctive warning string.

**Binary check — the fix is absent.** The string
`"The pattern is trying to render itself recursively. Returning a transparent QImage of the right size."`
occurs **0 times** in the shipped `Qt6Svg.dll` (ASCII and UTF-16), while the logging category
`qt.svg.draw` (`lcSvgDraw`) **is** present and 24 other diagnostic strings survive
(`"Invalid path data; path truncated."`, `"Error while inflating gzip file: SVG format check failed"`,
…). **So this is a missing fix, not stripped strings.**

**★ EXECUTED — through WickrPro's exact decode call.** The patch adds the previously-unfixed OSS-Fuzz
reproducer as a regression test; fed to `QImage::loadFromData(bytes, format = NULL)` against the shipped
DLLs (`scratch/w13/imgfuzz.exe`, `scratch/w16/svgpoc/`):

```
input: <svg stroke="url(#c)"><pattern height="2" width="4" id="c"/><path stroke="#F00" d="v2"/></svg>
       (94 bytes, OSS-Fuzz id 390467765)

*** CRASH  code=0xC00000FD (EXCEPTION_STACK_OVERFLOW)   3 of 3 runs
    gzip-wrapped .svgz variant (100 bytes): CRASH, same code
```

*(The patch's **other** reproducer, id 42532991, returns `loadFromData=false` — caught by the old
quadratic cycle check that 6.9.2 does have. That matches the patch text exactly: it describes the second
case as "another, **still unfixed** stack overflow". The two behaving differently is positive evidence
that the shipped build is at the pre-patch state.)*

> **Attacker position: anyone who can send the user content.** `qsvg.dll` declares `image/svg+xml` **and
> `image/svg+xml-compressed`**, and the decode is `format = NULL`, so the **sender selects the parser by
> content sniffing** — the same delivery chain §4.3 of the disclosure already establishes for F4c/F4f.
> **Impact: remote denial of service** (stack exhaustion → process crash). **Not RCE, and not claimed as
> such.** Crash addresses vary run to run, as expected for stack exhaustion.

### 4m.1 ★★★★★ F9 — CVE-2025-10729 IS ALSO PRESENT. THE USE-AFTER-FREE REPRODUCER HARD-ABORTS THE SHIPPED BUILD.

Qt's patch for CVE-2025-10729 (QTBUG-139961, same component, same publication date) adds a regression
test whose comment states the defect exactly:

> *"This input caused a **QSvgPattern node to be created with a QSvgPatternStyle referencing to it**. The
> code then detected that the `<pattern>` element is misplaced in the `<text>` element and **deleted it**.
> That left behind the **QSvgPatternStyle pointing to the deleted QSvgPattern**. That was reported when
> running the test with ASAN or UBSAN."*

The pre-patch code creates the node **before** validating the parent type
(`node = method(m_doc ? m_nodes.top() : 0, …)`) and `delete`s it on the `default:` branch, after the
factory has already registered it with a style. The fix inverts the order. **No new string is added, so
the string test used for §4m does not apply here** — it was verified by execution instead.

**★ EXECUTED, on the shipped DLLs, through `QImage::loadFromData(bytes, format = NULL)`:**

```
input (90 bytes, scratch/w16/svgpoc/uaf10729.svg):
    <svg>
    <text><pattern id="ptn" width="4" height="4"/></text>
    <g fill="url(#ptn) "/>
    </svg>

process exit code: 0xC0000409   (__fastfail -- security-mitigation hard abort)
```

Measured side by side, the three inputs separate cleanly — which is itself the evidence that these are
three distinct code paths and not one generic failure:

| input | exit code | meaning |
|---|---|---|
| `uaf10729.svg` (CVE-2025-10729) | **`0xC0000409`** | `__fastfail` — mitigation-detected corruption |
| `oss390467765.svg` (CVE-2025-10728) | **`0xC00000FD`** | `EXCEPTION_STACK_OVERFLOW` |
| `oss42532991.svg` (already-fixed case) | `0x00000000` | clean — caught by the old cycle check present in 6.9.2 |

> **Honest limit on the 10729 result.** `0xC0000409` is `__fastfail`'s generic status; it is used for
> several mitigation categories (GS cookie, heap metadata, CFG). **Which category fired was not
> determined**, so the correct statement is *"the reproducer causes mitigation-detected memory
> corruption and a hard abort"*, **not** a specific claim about the corruption primitive. Upstream calls
> it a dangling pointer; ASAN/UBSAN were not run here. **No exploitability is claimed — this is a remote
> DoS like §4m.**

**Remaining on this seam:**
* **CVE-2025-12385 (qtdeclarative ×2)** — see §4m.2. **Reachability is PLAUSIBLE and now concrete**, with
  one gate left.
* **CVE-2025-14575 (qtbase)** — `QSslCertificate::fromPath()` empty-path check. The argument is supplied
  by the **application**, not the peer. **Assessed as not peer-reachable; deprioritised.**

### 4m.2 ★★ CVE-2025-12385 REACHABILITY — PLAUSIBLE, and an inconsistency that stands on its own

The gating question is not the patch state but whether peer-controlled text reaches a QML `Text` that
renders rich text. **QML `Text` defaults to `Text.AutoText`**, which calls `Qt::mightBeRichText()` on the
content and switches to the rich-text engine if it looks like markup — so *omitting* `textFormat` on an
attacker-controlled string is what opens the path.

Measured over the carved qrc QML (53 carves contain `textFormat`; 120 UTF-16 `textFormat` references in
`WickrPro.exe`, plus `AutoText` ×34 and `onLinkActivated` ×18): **94 `Text` blocks set `textFormat`, of
which 50 bind a literal/`qsTr()` and 44 bind something dynamic.** Tracing the dynamic ones to
peer-controlled sources — a user's **display name** is set by that user — gives:

| carve | binding | `textFormat` |
|---|---|---|
| `blob_0307c59e.js` | `displayName` | `Text.PlainText` ✓ |
| `blob_0308355b.js` | `displayName + (isGuest…)` | `Text.PlainText` ✓ |
| `blob_0307658e.js` | `_displayName + (_isGuest…)` | `Text.PlainText` ✓ |
| **`blob_0306f6df.js`** | **`modelData.displayName`** (list/combo delegate) | **not set ⇒ `AutoText`** |
| **`blob_030ad960.js`** | **`_callDisplayName` / `_callDisplayNameShort`** (call UI) | **not set ⇒ `AutoText`** |
| `blob_0309a298.js` | `bodyText` (generic dialog property) | not set ⇒ `AutoText` |

**The inconsistency is the point:** the developers evidently know display names must be `PlainText` — they
set it in three places — and **miss it in at least two, one of which is the call UI**. That is a
hardening defect on attacker-controlled strings **independent of any CVE**, and worth reporting as such.

**★ And the app's own escaping proves it understands the hazard — which sharpens the inconsistency.**
`QString::toHtmlEscaped()` is imported by `WickrPro.exe` and called from exactly two functions:

* **`0x140a9e740`** — the **typing-indicator** formatter. It deliberately builds rich text
  (`"%1 is typing"`, `"%1 and %2 are typing"`, `"%1 is recording audio"`, with `</b>` markup) and
  **escapes the peer-controlled username before interpolating it.** Correct.
* **`0x1400c1470`** — `populateBotTable()`. Same pattern.

So where the app *intends* rich text it escapes peer names; the two `AutoText` sites in the table above
bypass that formatter entirely and bind the **raw** display name with neither `PlainText` nor escaping.
**The defect is the inconsistency, and the app's own correct handling elsewhere is the evidence that
these two are oversights rather than design.**

> **Gate that remains, stated honestly:** `Qt::mightBeRichText()` only switches to the rich-text engine
> if the string opens with a recognised tag (or contains `<html>`). **Whether a Wickr display name may
> contain `<…>` markup — client- or server-side validation, length and charset limits — was NOT
> determined**, and it is the single thing between "AutoText on peer data" and "CVE-2025-12385 reachable".
> Until that is settled: **reachability PLAUSIBLE, not established; no crash was produced for
> CVE-2025-12385** (unlike §4m/§4m.1, which are executed).

## 5. What this does to the engagement's standing claims

| claim | status |
|---|---|
| F4f: "256 out-of-bounds stores, up to 6,104 bytes past a 24-byte heap allocation" | **RETRACTED.** 0 of 512 stores leave the allocation; the allocation is 240 B growing to `(TPsot+1)*24`, not 24 B |
| F4f: "TPsot and TNsot are independent, so TNsot=1/TPsot=255 aims 6128 bytes past" | **REFUTED** — `TPsot >= TNsot` is rejected at `0x1802572ed` and `read_sot` returns FALSE |
| F4f: "what remains is a length/capacity overwrite; what lies at those offsets was never surveyed" | **surveyed — and moot.** Nothing outside the array is reached |
| "Six write primitives exist across the engagement (… F4f demonstrated …)" | **five.** F4f is not a write primitive |
| CVE-2026-2648 is present in this build | **the missing guard is real** (disassembled) — but in this build it is defensive: unreachable except, at most, as a near-NULL crash |
| Severity of the F4f row in the disclosure summary table | must be **withdrawn** before the report goes out |

**Unchanged and still true:** the delivery chain (a received file reaches `QImage::loadFromData` with
`format = NULL`), the shipped PDFium build date (2025-09-17) being ten months behind the application,
the absence of V8/XFA/form-fill, and recommendation 21 (remove `qpdf.dll` from `imageformats\`, or pass
an explicit format) — that recommendation now rests on the stale-parser argument alone, not on F4f.
