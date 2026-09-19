# W10 CRUX — link (a): the 32 clean-slot candidates triaged to a verdict, and the decoder stack pinned

Date 2026-08-01. Target: AWS Wickr Desktop 6.72.20.0 (Windows x64), unmodified installed binaries.
Static analysis only; no process launched, no call placed, no third-party traffic.

**Labels.** CONFIRMED = I (or a named agent) disassembled it or measured it, and the bytes are quoted.
INFERRED = reasoned from confirmed facts. REFUTED = shown false. Where a claim is a transcription of
another agent's work that I re-checked, it says so; where I could not check it, it says that too.

Reading order for a fresh session: this file → `W6-CRUX-link-a.md` (the geometry and why link (a) is the
only open link) → `W5-CRUX-f4-2-content-control.md` §18 (the demonstrated write) → `W9-CRUX-residuals.md`
(the retraction that produced this round's candidate list).

**Round shape.** Four triage agents took 8 candidates each (rows 1–32 of
`scratch/w9/W9-candidates32.json`); two adversarial verifiers then attacked the kills independently, one
re-reading every decisive instruction from the file and one re-deriving the candidate list itself; this
pass re-measured the load-bearing arithmetic, triaged the five rows the verifiers rescued, and settled one
open question that decides the best surviving lead.

---

## 1. THE LINK (a) ANSWER

### 1.1 The number

> **32 of 32 assigned candidates reached a definite verdict. 32 KILLED, 0 SURVIVES, 0 UNDETERMINED.**
> Zero verdicts were overturned by either verifier. Five further clean-slot pointer stores that the
> join had excluded *by construction* were rescued and also taken to a definite verdict, so the corrected
> figure is **37 of 37 KILLED**.

The honest label, and the one that should go in the report:

> **No target found by a search that has now taken 37 of 37 reachable clean-slot pointer stores to a
> definite verdict — 32 of them from the published candidate list, 5 more from a tooling defect the
> round exposed.**

**Do not write "structurally excluded" as a statement about link (a).** It is upheld *per class* — for the
1712-byte `Node` class (W6 §4b), for `WASAPIAudioManager` (k=17, prime), for `VP8_COMP` (block 184,208,
no k), for `VP8D_COMP` (block 14,960, no k) and for eleven more — but it is not upheld for the search as a
whole, because two object classes in this round **did** satisfy the geometry (§1.4) and died on other
constraints. The W9 retraction stands: the last agent to write "structurally excluded" was wrong because of
a type bug, and the correct phrase is "no target found".

### 1.2 Why each candidate died — the census

The six constraints are W6's, restated in the task brief: (1) array-like / pointer deep inside;
(2) ≥ 704 B; (3) allocation size in the reachable `76k+23` lattice **and** a geometry whose clean slot is
exactly this displacement; (4) the pointer on a CLEAN 8-aligned slot; (5) the pointer already points into
memory the attacker can spray *in its own 4 GiB window*; (6) allocated inside a millisecond-scale window
on the decode thread. Constraint **A** below means "the base register the join measured from is not an
allocation base"; constraint **D** means "the stored value is provably not a pointer".

| kill reason | rows | count |
|---|---|---|
| **D** — value provably zero, or provably not a pointer | 2,3,5,6,7,8,9,10,11,12,14,15,16,25,26,27,28 | **17 / 32** |
| **A** — base register is not an allocation base (interior `lea`, inline array element, embedded sub-struct, or a *stack frame*) | 1,2,3,4,14,19,20,21,22,23,24,25,28 | 13 / 32 |
| **3** — size class / displacement not in the lattice | **every distinct object class in the round except the two in §1.4** | 12 of 14 sized classes |
| **5** — pointee in the wrong 4 GiB window | 1,4,13,17,18,19,20,21,22,23,24,29,30,31,32 | **15 / 15 real-pointer rows** |
| **6** — wrong thread / wrong lifetime (audio, encoder, start-up singleton) | 1,3,4,7,8,13,17,18,19–24,29–32 | ≥ 18 / 32 (batches stopped early where D or 3 settled it) |

Most rows die two or three independent ways. Two results in that table are worth pulling out, because they
are structural rather than incidental:

* **CONFIRMED — 15 of the 32 rows are real pointer stores, and not one of them points into a decoder frame
  buffer.** The pointees are: NPL's own `.text` (rtcd dispatch slots, rows 31/32), NPL `.rdata` (row 13), a
  PortAudio host-processor callback in a module image (row 18), interior self-pointers inside the same
  allocation (rows 19–24, 29), and generic small-block heap (rows 1, 4, 30, 17). Constraint 5 is the one
  that the corpus fails *most systematically*, and it is the constraint no amount of re-scanning fixes:
  the partial overwrite cannot leave the pointee's own 4 GiB window, and the sprayable memory (≈2 GiB of
  decoder frame buffers, committed with a 34-byte keyframe) gets an independent ASLR draw.
* **CONFIRMED — 17 of 32 die on the stored value.** Zero-stores and non-pointer payload (int16 dequantiser
  tables in row 26, `char[]` error text in row 27) are exactly the false-positive class W5 §12 had to strip
  by hand, and `ptrstore.py` did not strip them here. Two one-line filters — a dominating `xor r32,r32`
  and a dominating `xorps`/`pxor` for the xmm form — would have removed all of them before any manual work.

### 1.3 The full table

`at` = store instruction; `d` = displacement the join measured; "true d" = displacement from the real
allocation base once the base register was bound.

| # | at | d | object (base bound by disassembly) | value | verdict |
|---|---|---|---|---|---|
| 1 | `0x180247f0f` | 696 | FDK-AAC **encoder** scratch, `calloc(1,0x2210)`=8720 B; base = block+0x8f8 → true d 2992 | real ptr → encoder scratch (generic heap) | KILLED A,3,5,6 |
| 2 | `0x18035a4f4` | 696 | **stack frame** of `webrtc::EchoRemoverImpl` capture-processing (`lea rbp,[rsp-0x2ef0]`) | a *count*, not a pointer | KILLED A,D |
| 3 | `0x1803700fd` | 696 | `EchoRemoverImpl+0x260`, 0x2448 B parent → true d 1304 | zero (`xor r13d,r13d`) | KILLED D,A,3 |
| 4 | `0x18037018c` | 696 | same; `std::vector` capacity-end | real ptr → small vector on generic heap | KILLED 3,5,6,A |
| 5 | `0x180391d26` | 696 | 0x1fd8 = 8152 B webrtc context (k=107, prime) | zero (`xor r9d,r9d`) | KILLED D,3 |
| 6 | `0x1803d8d96` | 696 | `Musigy::AV::AspectRatioCrop`, 896 B — genuinely on the video path | 16 B of zero (`xorps`) | KILLED D,3 |
| 7 | `0x18015bc3e` | 1152 | `Musigy::AV::WASAPIAudioManager` ctor, 0x520 = 1312 B (k=17, prime) | zero | KILLED D,3,6 |
| 8 | `0x18015c353` | 1152 | same class, dtor | zero (the null half of a null-then-Release) | KILLED D,3,6 |
| 9 | `0x18015e5af` | 1152 | teardown helper, two callers, class not fully pinned | zero (`xor r15d,r15d`) | KILLED D |
| 10 | `0x1800aff7d` | 2064 | **PacketPacer pooled packet, `operator new(0x900)`** — constraints 1,2,3,6 all hold | zero (`xorps`, then `memset(...,0,0x900)`) | KILLED D |
| 11 | `0x18039201d` | 6168 | same function as 5 | zero (same `xor r9d,r9d`) | KILLED D,3 |
| 12 | `0x180359c53` | 9056 | `EchoRemoverImpl` dtor, 0x2448 B | zero | KILLED D,3 |
| 13 | `0x18017530e` | 18480 | 48 kHz mono audio context, `malloc(0x4850)`=18512 B | real ptr → NPL `.rdata` descriptor table | KILLED 3,5,6 |
| 14 | `0x1800a0120` | 696 | element of an **inline array** of 8 × 0x1320 inside a 0xec90 parent | zero | KILLED A,D,3 |
| 15 | `0x1803d8202` | 696 | `AspectRatioCrop` ctor, 896 B | zero | KILLED D,3 |
| 16 | `0x1803deace` | 696 | 0x6c0 = 1728 B object | zero | KILLED D,3 |
| 17 | `0x18017bf0c` | 1152 | `vpx_codec_alg_priv_t` for the VP8 **encoder** (`vp8e_init`), 10184 B (k=134=2·67) | real ptr → `VP8_COMP` | KILLED 3,5,6 |
| 18 | `0x1801c5875` | 1152 | **PortAudio** `PaWasapiStream`, `GlobalAlloc(GPTR,0x4b8)`=1208 B — *not* libvpx | real **code** ptr (host-processor callback) | KILLED 3,5,6 |
| 19–24 | `0x180180c9b`, `0x1801ac3e7`, `0x1801ac694`, `0x1801ac6bd`, `0x1801ac781`, `0x1801aca32` | 1912 | `VP8_COMMON` **embedded at `VP8_COMP+0x1a920`** — the VP8 **encoder**, 184,160 B → true d 110,744 | interior self-pointers (`frame_to_show`, `&cpi->pick_lf_lvl_frame`) | KILLED A,3,5,6 |
| 25 | `0x1800a3d8b` | 2064 | **stack frame** (`lea rbp,[rsp-0x8c8]`), MSVC empty-`std::wstring` SSO | zero | KILLED A,D |
| 26 | `0x18018a6b4` | 2064 | `pbi->mb_row_di[i].mbd` — **the one genuinely decode-thread row** | 32 B of int16 dequantiser table | KILLED D,3 (and now: the object never exists, §1.5) |
| 27 | `0x180186c56` | 5256 | `VP8D_COMP` (14,912 B, block 14,960 — no k) | 16 B of error-message *text* | KILLED D,3,6 |
| 28 | `0x1801863a9` | 8904 | `VP8_COMMON` embedded at `VP8D_COMP+0x1440` → true d 14,088 | zero (null-out after `vpx_free`) | KILLED D,A,3 |
| 29 | `0x180183e5b` | 83232 | `VP8_COMP`, 184,160 B | interior self-pointer `cpi+0x2a8c4` | KILLED 3,5,6 |
| 30 | `0x1801ab8db` | 147072 | `VP8_COMP` (encoder-thread creation) | real ptr → `(threads-1)*8` B generic-heap block | KILLED 3,5,6 |
| 31 | `0x180183d97` | 147376 | `VP8_COMP` rtcd install run | real **code** ptr → NPL `.text` | KILLED 3,5,6 |
| 32 | `0x180183d6d` | 147528 | same | real **code** ptr → NPL `.text` | KILLED 3,5,6 |

Five rescued rows (see §2.2 for why they were missing), all taken to a verdict this pass:

| at | primary fn | d | object | value | verdict |
|---|---|---|---|---|---|
| `0x1801867e4` | `0x180186650` | 1912 | `cm->frame_to_show` in VP8 `swap_frame_buffers`; base `&pbi->common` → true d 7096 | `&cm->yv12_fb[idx]`, self-pointer | KILLED 3,5 |
| `0x1801a1176` | `0x1801a1030` | 8904 | `VP8_COMMON+0x22c8`, embedded (decode: → 14,088; encode: → 117,736) | real ptr (`vpx_calloc` result) | KILLED A,3 |
| `0x1801a9ae5` | `0x1801a9890` | 6624 | encode path (`encode_frame_to_data_rate` → `0x1801a9890`) | zero (`xor eax,eax`) | KILLED D |
| `0x1801a9fb5` | `0x1801a9890` | 6624 | same | zero (`xor eax,eax`) | KILLED D |
| `0x1801ab320` | `0x1801ab010` | 7992 | element of `cpi->mb_row_ei[]`; `0x1801ab010` is the encoder **row-thread proc** (only reference: `lea` at `0x1801aba41` in `vp8cx_create_encoder_threads`) | interior ptr from `[r8+0x7b8]` | KILLED 5,6 |

`0x1801867e4` deserves a line of its own: **CONFIRMED — it is the only real-pointer clean-slot store on the
video decode path in the entire 3,831-store corpus, and it was never in the candidate list.** Bytes, re-read
by me from the file: `0x1801867e4: 49899078070000 mov qword ptr [r8 + 0x778], rdx`. It dies on constraint 3
(request 14,951 → NT block 14,960/14,976, no `76k+23` lands there under H ∈ {0,8,16}; recomputed with
`w11/lat11.py` this pass) and on constraint 5 (the value is a pointer into the same allocation).

### 1.4 The two classes that satisfied the geometry — and how each was closed

Constraint 3 is the sparse one (only 15.1 % of NT block sizes are reachable at all), so a class that
satisfies it is worth naming loudly. Two did.

**(a) The PacketPacer 0x900 pooled packet block — CONFIRMED satisfied, killed on value.**
Independently recomputed by me with `w11/lat11.py` (selftest: `mi_off(4)=472`, `clean_slots(4,4)=[1152,1912]`,
global minimum clean slot 696, `76·25+23 = 1923`):

```
R = 2304 (operator new 0x900 @ 0x1800aff54: b900090000 mov ecx, 0x900)
nt_block = 2304 (H=0) / 2320 (H=8,16);  k in bucket = {30} only
geometries: (mbc=2, mbr=9) -> clean slots {696, 1152, 1608, 2064}
            (mbc=4, mbr=5) -> clean slots {1152, 1912}
2064 = +0x810 is an EXACT hit, for H in {0,8,16}
```

Constraints 1, 2, 3 and 6 all hold — and 6 holds in the *strong* form: the block comes from a
mutex-protected ring free list (`0x1800c2980`) that mints a fresh `operator new(0x900)` on the media thread
whenever the pool is drained, which is an **engineered** reclaim rather than an awaited one (INFERRED, not
measured). It fails only on constraint D: the store at `+0x810` is a zero
(`0x1800aff7a: 0f57c0 xorps xmm0, xmm0` immediately precedes `0x1800aff7d: 0f118010080000 movups
xmmword ptr [rax + 0x810], xmm0`, and the whole block is `memset` to zero at `0x1800affd4`).

Three further closures on this class, all reproduced or read this pass:
* Of the five clean slots, 696/1152/1608/1912 all fall **inside the 2048-byte payload region**
  `+0x000..+0x7ff` (the length dword at `+0x800` is read by the pool pop:
  `0x1800c29cf: 2b8e00080000 sub ecx, dword ptr [rsi + 0x800]`, re-read by me). **`+0x810` is the only
  offset in this class that could ever hold a pointer** — one testable offset, not five.
* The index-aware re-scan batch 2 asked for was run by the verifier: across all 13,498 `.pdata`
  functions the only indexed stores with displacement in `[0x808,0x898]` are seven **dword** stores. The
  "hidden pointer array at `+0x810` invisible to `ptrstore.json`" hypothesis is **REFUTED** for indexed stores.
* The load side agrees: exactly **one** 8-byte load from displacement 2064 exists in the whole image,
  `0x1800a3e1f mov rcx, qword ptr [rbp + 0x810]`, and that is candidate 25's *stack frame*. No heap object
  in NPL is known to read a pointer at `+0x810`.

Residual, stated: the ring pool `0x1800c2980` has **nine** callers, so 0x900 is not necessarily the only
block class it hands out; and constraint 5 was never reached for this class.

**(b) `MB_ROW_DEC` / `MACROBLOCKD+0xf20` — CONFIRMED satisfied, and now CONFIRMED not to exist.**
This is the round's one genuinely new lead and its closure, and it is mine, so here is the whole chain.

The W11 verifier corrected batch 25-32's re-aim: for `decoding_thread_count = 1` the array request is
`1·0x1420 + 39 = 5191`, NT block 5200, only `k = 68 = 4·17`, only geometry `mbc=16, mbr=3, r=1`, and the
**only** clean slot is 3888 from the raw pointer = element offset `0xf20` at delta 16. I reproduce that:

```
lat11.solve(R=5191, D=0xf20, delta=16) -> S=3888, H=0/8/16 all HIT (k=68, mbc=16, mbr=3)
lat11.solve(R=5191, D=0xfb8, delta=16) -> VIOLATED   (the subpixel_predict pointers are NOT on a clean slot)
```

and the field at `+0xf20` is a real pointer, `xd->mode_info_context`:

```
0x180188781: 486bc84c        imul rcx, rax, 0x4c            ; * sizeof(MODE_INFO)
0x180188785: 49038da0200000  add  rcx, qword ptr [r13+0x20a0]  ; + cm->mi
0x18018878c: 48898b200f0000  mov  qword ptr [rbx+0xf20], rcx
0x180188793: 418b856c200000  mov  eax, dword ptr [r13+0x206c]  ; mode_info_stride
0x18018879a: 8983280f0000    mov  dword ptr [rbx+0xf28], eax
```

So: right thread, right shape, right geometry, real pointer. **The object is never allocated.** The chain,
every instruction re-read from `NPL.dll` this pass:

```
0x180144709: c7854001000001000000  mov dword [rbp+0x140], 1   ; vpx_codec_dec_cfg_t.threads = 1, an IMMEDIATE
0x180144713: e8c89e0300            call 0x18017e5e0           ; vpx_codec_vp8_dx()  (iface 0x180461f70)
0x180144723: 4c8d8540010000        lea  r8, [rbp+0x140]       ; cfg
0x180144731: e86a8d0300            call 0x18017d4a0           ; vpx_codec_dec_init_ver -- ONE caller in the DLL
0x18017d6c5: 488d88d8000000        lea  rcx, [rax+0xd8]       ; vp8_init: priv->cfg = *cfg
0x18017d9ba: 8b83d8000000          mov  eax, [rbx+0xd8]
0x18017d9c0: 898764390000          mov  [rdi+0x3964], eax     ; pbi->max_threads = cfg.threads
0x180189809: 8b8164390000          mov  eax, [rcx+0x3964]     ; vp8_decoder_create_threads
0x180189830: 0f4fc7                cmovg eax, edi             ; core_count = min(max_threads, 8)
0x180189835: 0f4ec8                cmovle ecx, eax            ; core_count = min(core_count, cores)
0x180189838: 83f901                cmp  ecx, 1
0x18018983b: 0f8e84020000          jle  0x180189ac5           ; <= 1  ->  RETURN, b_multithreaded_rd stays 0
```

`pbi->max_threads` (`+0x3964`) has exactly **three** references in all 13,498 `.pdata` functions
(`dispscan.py`, published) and both writers — `0x18017d9c0` and `0x1801868ad` — trace to that same
compile-time `1`. Therefore `decoding_thread_count` is **0**, `vpx_memalign(32, n·0x1420)` at `0x1801898ce`
never runs, and `pbi->mb_row_di` does not exist in this product.

> **CONFIRMED. This settles batch 25-32's open residual ("whether `decoding_thread_count` is ever non-zero
> in the shipped Wickr configuration"), kills candidate 26's object as a reclaimer class, and kills the
> W11 verifier's re-aimed `MACROBLOCKD+0xf20` lead at the source.** It also means the entire libvpx
> multi-threaded decode path (`setup_decoding_thread_data`, `vp8mt_*`) is dead code in this build — worth
> remembering before anyone spends a session there.

### 1.5 The cheapest next step, if anyone continues

Ranked in §5. The short version: **stop looking for the pointer and test the allocator assumption
(§4.1) instead.** Every negative in this round is an *equality* of NT bucket sizes, and that equality is an
LFH property. If the freed `mip` block is served by the NT **backend** (which splits a larger free block
and returns the front), the constraint weakens from "same bucket" to "target ≤ freed block", and roughly
twenty of these kills — plus W6 §4b's `Node` exclusion and W6 §5's "15.1 % of size classes" — weaken with
it. One local experiment, no call, no second machine, settles it.

---

## 2. COVERAGE

### 2.1 Per batch: verdicts reached versus assigned

| batch | rows | definite verdicts | KILLED | SURVIVES | UNDETERMINED | verifier accepted the coverage claim? |
|---|---|---|---|---|---|---|
| 1 | 1–8 | 8 / 8 | 8 | 0 | 0 | YES, with 2 breadth corrections (§2.3) |
| 2 | 9–16 | 8 / 8 | 8 | 0 | 0 | YES — and it flagged the one geometry-satisfying class loudly instead of burying it |
| 3 | 17–24 | 8 / 8 | 8 | 0 | 0 | YES |
| 4 | 25–32 | 8 / 8 | 8 | 0 | 0 | YES, with 1 correction that made a residual unactionable (§2.3) |
| verifier A (adversarial, byte-level) | all 32 | re-read 28 decisive instructions; re-measured 13 zero-store dominance claims; recomputed constraint 3 for every class over H×delta | 0 overturned | — | — | — |
| verifier B (adversarial, coverage) | all 32 | re-read 96 quoted instructions (96/96 exact); recomputed all 25 (size, delta, displacement) triples; re-derived the candidate list | 0 overturned | — | — | — |
| this pass | 5 rescued rows | 5 / 5 | 5 | 0 | 0 | — |

**Both verifiers answered "coverage_honest: YES".** Each batch published per-candidate evidence and
intermediate JSON, named what it could not establish, and none dressed an UNDETERMINED up as a kill. The
four assignments partition rows 1–32 with no gap and no overlap (checked). Nothing in this round resembles
the W9 failure of a confident "structurally excluded" manufactured by a join bug.

### 2.2 …but the round-level coverage claim is narrower than it reads. Four measured gaps.

**(i) The list should have been 37 rows, not 32 — a join bug of the same family as W9's. CONFIRMED, and
re-derived by me** (`W10-LEAD-join.py`, output `W10-LEAD-join.json`):

```
.pdata entries in NPL.dll                                     13,498
   of which CHAINED secondary chunks (UNW_FLAG_CHAININFO)      4,518  (33.47 %)
pointer stores at a constant offset >= 244 (the corpus)         3,831
   of which inside a chained chunk                                662
stores whose displacement is exactly an 8-aligned clean slot       52
   joined against R_all  BY .pdata ENTRY  (the list that was triaged)   32
   joined against R_all  BY PRIMARY FUNCTION (correct)                  37
   joined against R_vtable, either way                                  13
```

`ptrstore.py` keys every store by the `.pdata` entry that contains it. For a chained chunk that
`BeginAddress` is not a function start, so it is never a key in `reach.json` and the store is dropped **by
construction** — the same shape of defect as W9's int-versus-hex-string compare, in a different tool.
Twelve of the 52 clean-slot stores sit in chained chunks; five have primaries in `R_all`. All five are
triaged in §1.3.

**(ii) The search unit was the store instruction; the invariant is the pointer field. CONFIRMED
(verifier B).** A load-side census finds **138** 8-byte loads at clean-slot displacements, 63 dereferenced,
38 in `R_all`, 13 in `R_vtable`, spread over 8 displacements — and 26 of the 38 are in functions with no
corresponding store anywhere in the 32-row list. Displacement 2672 carries **zero** stores in the entire
3,831-entry corpus yet two dereferenced loads in an `R_vtable` function. Worked example that proves the
hole is real and then closes it: `Musigy::NPL::Net::ReliabilityLayerImpl` (`operator new(0x3210)` =
12,816 B, `0x1800bd239: b910320000 mov ecx, 0x3210`, re-read by me) holds a live pointer at clean slot 696
and dereferences it *for a write*:

```
0x1800bed9f: 488b8bb8020000  mov rcx, qword ptr [rbx + 0x2b8]
0x1800beda6: 480181d0000000  add qword ptr [rcx + 0xd0], rax
```

Its installing store is in none of the 52. It is KILLED on constraint 3 (block 12,816/12,832; `76·168=12,768`
and `76·169=12,844` bracket the window with nothing inside — recomputed by me), but the *method* gap stands:
a store-site enumeration cannot see a field whose pointer arrives by `memcpy`, by struct assignment, or from
a chunk the tool mis-keys.

**(iii) NPL.dll's `.pdata` blind spot, measured for the first time: `.text` = 4,335,102 B, covered
3,894,262 B = 89.83 %, blind 10.17 % (325,787 real bytes net of padding). CONFIRMED — and reproduced
independently by me this pass (13,498 `.pdata` entries; WickrPro.exe 13,078,988 / 13,965,056 = 93.66 % on
39,032 entries).**
**Correction to the task brief and to `NEXT-HUNT-BRIEF`:** the "89.8 %" figure the brief calls "never
re-measured and WRONG" is **correct — for NPL.dll**. 93.66 % is *WickrPro.exe* (re-measured: 13,078,988 /
13,965,056 B). They are two different binaries, not two estimates of one quantity. Any NPL sweep in this
engagement that iterated `.pdata` functions inherits a **10.17 %** hole, not 6.34 %. The dominant hole is
one contiguous 228,640-byte region (`0x180001000`–`0x180038d20`) that disassembles as hand-written SIMD and
CRT x87 stubs — pixel kernels, not struct-pointer stores — but it is not empty of relevant code:
`0x180144320`, the decode-failure handler the brief itself names, is inside no `.pdata` entry at all.

**(iv) Two smaller ones.** 162 pointer-width stores at const displacement ≥ 244 exist in forms
`ptrstore.py` never matched (`movsd` 134, `xchg` 25, `movq` 3); exactly 2 land on a clean slot, both indexed
and both outside `R_all`; `rep movs*` = 0. Struct copies through a `memcpy` **call** remain invisible to any
store-form scan. Separately, `ptrstore.py`'s `clean_slots()` caps `mbc,mbr` at 1100, dropping 847 of 5,267
clean-slot offsets (all ≥ 251,496); re-joining with the untruncated lattice returns the **same** 32 rows, so
it cost this round nothing, but any future "no geometry reaches D in block B" computed with that function is
unreliable above ~250 KB.

### 2.3 Corrections the verifiers made to the batches (none moves a verdict)

* **Batch 1's cross-batch hand-off on row 9 was over-broad and dangerous.** It told row 9's owner to skip the
  value analysis because the class is dead on constraint 3. But `0x18015e420` has **two** callers
  (`0x18015c1ce` and `0x18015d3da`), and the class on the second path is not established. Had the advice been
  taken, row 9 would have had no valid kill. It survives only because batch 2 did the value analysis anyway.
* **Batch 1's exhaustiveness method — "zero qword data-references ⇒ the caller set is exhaustive" — is
  insufficient in principle, and demonstrably so on this very list**: `0x18009ffc0` and `0x1801c5080` have
  zero qword refs yet are referenced by `lea`. Re-running the combined qword+`lea` test on batch 1's six
  addresses still returns zero of either kind, so its conclusions survive; the method must not be called a
  proof again.
* **Batch 25-32's residual re-aiming the `MB_ROW_DEC` search at `+0xfb8/0xfc0/0xfc8/0xfd0/0xfd8` used the
  wrong offsets** — none is a clean slot for the only viable `k` (I reproduce: `0xfb8` VIOLATED). The correct
  aim point was `+0xf20`, which is moot now (§1.4b).
* **Batch 9-16's two UNDETERMINED sizes are resolved**: candidate 11's object is `operator new(0x1fd8)` =
  8152 B (block 8160, no k), candidate 14's parent is `operator new(0xec90)` = 60,560 B (block 60,576, no k).
  Candidate 9's class remains genuinely undetermined — and it does not matter, because its kill is on value.
* **Batch 2's claim that `ptrstore.json` "indexes only stores at a constant register offset" is false as
  written** — 124 of the 3,831 carry `idx=true`. The true, weaker claim is that only the constant part of the
  effective address is known.
* Cosmetic: both libvpx batches gloss `0x2cf60` as 183,648; it is **184,160**. They used the correct malloc
  request 184,199, so nothing moves.

### 2.4 The geometry model itself — audited, and a warning for the brief

Verifier A re-derived the "`mbc` EVEN, `r` ODD, `c = mbc−1`" restriction rather than accepting it, because an
over-restrictive rule would have revived ~20 of the 32. It is not over-restrictive. 8-alignment *alone*
admits `record(r,c)+72` for every `c ≡ r (mod 2)`, but `reclaim_scan.py`'s selftest asserts the
**live-measured** clean set for the 4×4 geometry is exactly `[1152, 1912]`. That is only consistent if
MODE_INFO bytes 0..3 **are** written by the sweep, so only the last written column's `+72` has an untouched
successor.

> **Put this in the brief:** the corpus's "writable = `record+4` and `record+12+4k`" list is the
> **content-controlled** set, not the **written** set. Reading it as the written set roughly triples the
> clean-slot lattice and falsely revives most of this round.

---

## 3. DECODER PINNING

Context, from W9 and unchanged: remote bytes **do** reach a `format = NULL` decode in the unsandboxed main
process, PDFium is in the sniffing set (`QPdfIOHandler::canRead` peeks 6 bytes and `strncmp`s `%PDF-` /
`\n%PDF-` at `0x18000152c` / `0x180001548`), and the attacker therefore picks the decoder.

### 3.1 PDFium (Qt6Pdf.dll, and a second copy in Qt6WebEngineCore.dll)

**Provenance — CONFIRMED.** PDFium itself carries no version constant (exhaustive search for
`2.3.x/2.4.x/2.5.x`, `openjpeg`, `LASTCHANGE`, `refs/branch-heads` returns nothing). It is pinned by its
components to a **Chromium 130 (October 2024) snapshot**: ICU 74 (`icudt74l`, 18 `@icu_74@@` RTTI names),
libpng 1.6.43, zlib 1.3.0.1-motley, and an abseil build path under
`qt6/qtwebengine/src/3rdparty/chromium/third_party/`. Build stamps: Qt6Pdf.dll 2025-09-17T13:01:40Z
(TimeDateStamp `0x68cab134`, re-read by me), WickrPro.exe 2026-07-13. **A PDF parser compiled in September
2025 out of an October-2024 Chromium tree, shipped in a July-2026 build.**

**Second copy — CONFIRMED.** Whole-tree sweep of 294 PE files: PDFium fingerprints hit in exactly two,
`Qt6Pdf.dll` and `Qt6WebEngineCore.dll`, both resident in WickrPro.exe, both at the **same** patch level
(byte-identical guards). PDFium is in the main process via `Qt6Pdf.dll` (loaded behind
`imageformats\qpdf.dll` — measured in an earlier wave's live module list) and in both processes via
`Qt6WebEngineCore.dll`.

**Patch state — five structural fingerprints, all PRESENT, all re-read as raw bytes.** I independently
re-disassembled two of them from `Qt6Pdf.dll` this pass:

| fix | anchor | observed | verdict |
|---|---|---|---|
| OpenJPEG `opj_j2k_read_SPCod_SPCoc` cblkw/cblkh validation | error literal at `0x1803fb230`, one xref | `0x18025b915: 83f90a cmp ecx,0xa / 0f8709010000 ja` … `83f80c cmp eax,0xc / ja` | **PRESENT** (positive control) |
| OpenJPEG SIZ component-precision hard reject | `0x1803fb920` | `0x18025841f: 83f81f cmp eax,0x1f / 7722 ja` → `EVT_ERROR` + `xor eax,eax` | **PRESENT** |
| OpenJPEG HTJ2K `Scup` segment-length guard | six `Malformed HT codeblock` literals | `cmp r11d,2 / jb`, `cmp r11d,r14d / jg`, `cmp r11d,0xfef / ja` | **PRESENT** (⇒ libopenjp2 ≥ 2.5.0) |
| PDFium `CJBig2_Image(w,h)` — integer-overflow-free geometry limit | `kMaxImagePixels = 0x7fffffe0` | `0x180210145: 81fae0ffff7f cmp edx,0x7fffffe0 / 7f4c jg` then the **division** form `b8e0ffff7f / 99 / f7f9 idiv ecx / 443bc0 cmp r8d,eax / 7f39 jg` | **PRESENT** |
| PDFium `CJBig2_Image(w,h,stride,buf)` — all five guards incl. `stride*8 ≥ w` | `kMaxImageBytes = 0x0ffffffc` | `0x1802101d5: 4181f9fcffff0f cmp r9d,0xffffffc / 7755 ja`, `lea ecx,[r9*8] / 413bca cmp ecx,r10d / 7c33 jl`, `idiv` height cap | **PRESENT** |

Each guarded function was also shown to be live code (2, 1 and 12+ callers respectively), so none of this is
dead-stripped residue.

**The CVE patch-state answer, stated plainly:**

> **Whether Qt's self-reported `qtwebengine_chromium_security_patch_version = 139.0.7258.67` backport
> reached the PDFium subtree COULD NOT BE ESTABLISHED FROM THE BYTES. UNDETERMINED.**
> All five fingerprints above are **pre-M130** fixes, so they read PRESENT under *both* hypotheses (stock
> M130 / M130 + cherry-picks) and have **zero discriminating power** for the backport question. Five
> PRESENTs are not an answer, and they are not being allowed to stand in for one — that substitution is
> exactly the trap W9 diagnosed when it retracted the ten-component test. Building a post-M130 fingerprint
> requires the upstream patch diff; the rules of engagement are static analysis with no third-party
> traffic, so no CVE or commit data was fetched, and none was reconstructed from memory.

Cheapest way to close it: obtain, offline, the `pdfium` / `libopenjp2` / `freetype` DEPS diffs between
Chromium `130.0.6723.x` and `139.0.7258.67`. The anchoring method is proven (a positive control passed and
four more fingerprints landed), so each additional fix costs ~10 minutes against the tools already in
`scratch/w9/pdfium/`.

**Also CONFIRMED, and it upgrades a standing assumption to a measurement:** `Qt6Pdf.dll` **is**
CFG-instrumented (`DllCharacteristics 0x4160`, GUARD_CF set) but **WickrPro.exe is not**
(`0x8160`, GUARD_CF clear; GuardFlags `0x100`). Re-measured by me this pass. CFG is opt-in at the main
image, so the instrumentation PDFium already carries is **inert for the entire process**. The remediation is
a link flag on `WickrPro.exe`, not a code change — a cheap, high-leverage ask for the disclosure.

**FreeType could not be pinned at all** — `FT_Library_Version` is dead-stripped and no version constant
survives; only the module-name set and `FREETYPE_PROPERTIES` are visible. FreeType is fully reachable from a
`%PDF-` blob through PDFium's font loading. **UNDETERMINED, and a real gap.**

### 3.2 NPL.dll's vendored libjpeg-turbo

**Pinned, as far as the bytes allow — CONFIRMED.** `JPEG_LIB_VERSION 62`,
`sizeof(jpeg_decompress_struct) = 600`, `JMSG_LASTMSGCODE = 129`, message table at `0x1804BA540` (all 129
entries dumped). Upper bound from the table contents: no lossless / 12-bit / 16-bit messages ⇒ **< 3.0.0**.
Lower bound from the libjpeg-turbo-specific tail (`Invalid crop request`, arithmetic-code messages, bad ICC
marker) ⇒ **2.x, not IJG**. Strict upper bound from *inside the same product*: `Qt6WebEngineCore.dll` carries
`libjpeg-turbo version 2.1.5.1` with `Copyright (C) 1991-2022`, while NPL's banner reads
`Copyright (C) 1991-2021` — same macro, different year ⇒ NPL predates 2.1.5.1. I re-read both banners and the
version literal this pass.

> **Verdict: libjpeg-turbo 2.x, ≥ 2.0, < 3.0.0, older than 2.1.5.1. CONFIRMED.
> The exact point release COULD NOT BE ESTABLISHED FROM THE BYTES — UNDETERMINED.** The 2.1.0–2.1.2 narrowing
> is **INFERRED** from the copyright year alone and must be labelled as such. A direct code diff does not
> discriminate: the 160-byte window around `jpeg_CreateDecompress`'s `cmp rbx, 0x258` differs from the
> confirmed-2.1.5.1 copy in only 6 of 160 bytes, every one inside a `call rel32` displacement.

**Reachability — REFUTED for peer-supplied media, and this is the headline.** The only route from a decoded
stream to this copy is `Musigy::AV::ColorspaceConverter` source-format 17 (MJPEG), and the jump table that
selects it is gated on the **destination** format being 1 (YUV420P):

```
0x180125964: 83f801        cmp eax, 1            ; eax = destination pixel format
0x180125967: 0f85b8040000  jne 0x180125e25       ; not YUV420P -> the whole jump table is skipped
```

The receive graph never produces that destination: at construction it **refuses to build a converter at all**
when the requested destination is 1 (`0x1800f0570: 83f801 cmp eax,1 / 0x1800f0573: 0f849c000000 je` →
skip), and otherwise bounds it to `[2,13]` (`0x1800f057c: 83f80b cmp eax,0xb / ja` → skip). Independently,
the receive graph's decoder factory only ever builds a `VpxDecoder`, whose output is I420.
**REFUTED: peer bytes cannot reach NPL's libjpeg-turbo.** What feeds it is the **local DirectShow webcam**
when the camera negotiates `MEDIASUBTYPE_MJPG` (GUID→enum map at `0x1803e4700`, entry 16 → `mov eax,0x11`),
i.e. a malicious or virtual camera driver — residual **local** attack surface, not a remote finding.

**CVE patch-state answers for this copy, stated plainly:**

* **The `jpeg_crop_scanline` / `jpeg_skip_scanlines` family of post-2.1 fixes is INAPPLICABLE — CONFIRMED,
  and by structure rather than by version arithmetic.** Message code 124 (`JERR_BAD_CROP_SPEC`) is never
  *stored* anywhere in the module (ERREXIT census over all 13,498 `.pdata` functions), so that code is not
  linked. Same for code 127 (`JWRN_BOGUS_ICC` ⇒ `jpeg_read_icc_profile` not linked) and code 128
  (`JERR_BAD_DROP_SAMPLING` ⇒ `transupp.c` not linked). All three *strings* are present in the message table
  and none is reachable — a string is not a code path, and here the absence of the **store** is what settles it.
* **What IS linked, and is where the historical defects cluster:** progressive decoding (code 16
  `JERR_BAD_PROGRESSION` at `0x1803b61c2`) and — unusually — **arithmetic-coded** decoding (code 125 at
  `0x1803b772b`, code 126 ×5). 96 of 129 message codes are raised somewhere. If the malicious-camera threat
  model is ever brought in scope, that is the surface to fuzz.
* **No CVE-by-number claim is made for this copy.** The version is bracketed, not pinned, and no CVE data was
  fetched. Anything stronger would be version arithmetic from memory.

### 3.3 Four libjpeg-turbo copies in one product — CONFIRMED, re-measured by me

Anchor: `48 81 fb 58 02 00 00` (`cmp rbx, 600`, the `jpeg_CreateDecompress` struct-size check).

| module | copy | version |
|---|---|---|
| `NPL.dll` | 1 hit | 2.x, `(C) 1991-2021` — **the oldest**, unreachable from peer bytes (§3.2) |
| `Qt6Pdf.dll` | 1 hit | **no banner, no version literal — UNPINNED**, and reachable from peer bytes via `%PDF-` |
| `Qt6WebEngineCore.dll` | 1 hit | `libjpeg-turbo version 2.1.5.1`, `(C) 1991-2022` |
| `Qt/.../imageformats/qjpeg.dll` | 0 hits (struct changed in 3.x) | `libjpeg-turbo version 3.0.3`, `(C) 1991-2024` |

Three of the four are resident in the unsandboxed main process. **The one that matters is Qt6Pdf.dll's** —
it is unpinned *and* peer-reachable, which is the inverse of NPL's. Its `jpeg_CreateDecompress` is
byte-identical to Qt6WebEngineCore's modulo 6 displacement bytes in 160, which is *suggestive* of 2.1.5.1
(consistent with the one-Chromium-snapshot finding) but is one function — **INFERRED, not confirmed.**

### 3.4 Two more unpinned dependencies

* **libyuv is vendored in NPL.dll — CONFIRMED PRESENT (the twelve-argument `MJPGToI420` call at
  `0x180125bb7`, plus libyuv's `kFourCCAliases[]` table at `0x18044b300`), and has NEVER been pinned to a
  revision.** Its sibling converters (NV12, NV21, YUY2, BGR32, BGR24) sit on the same jump table and its row
  functions are used elsewhere in the frame pipeline. This is the last unpinned peer-adjacent library in NPL.
* **WickrPro.exe hosts two libpng builds at different patch levels** — Qt6Gui.dll on 1.6.50 with zlib
  `1.3.1 (Qt)`, Qt6Pdf.dll and Qt6WebEngineCore.dll on 1.6.43 with zlib `1.3.0.1-motley`. Qt's own
  third-party tree is current; the Chromium subtree is frozen at the Oct-2024 snapshot. Measurable inside one
  process image, independent of trusting any vendor version string.
* **REFUTED, and worth recording so nobody burns a session on it:** NPL.dll contains **no** H.264/ffmpeg
  decoder. The `h264` and `ffmpeg` strings are vestigial — the factory rewrites `"h264"` to the 6-character
  `"ffmpeg"` and then only ever compares 3-character names (`cmp rdi,3 / jne`) against `vp8`/`vp9`, so it
  falls through to `NULL` and the caller logs `Unsupported codec (%s)`.

---

## 4. WHAT IS REPORTABLE TO THE VENDOR, REGARDLESS OF CODE EXECUTION

Nothing in this round weakens F5-1/F4-2; it removes one speculative escalation and adds several
independently reportable items. Ranked by what a vendor can act on.

1. **F5-1 / F4-2 — remote, authenticated, content-controlled use-after-free write plus process death.**
   One call peer sends 405 bytes of VP8 (3 frames) and obtains a byte-exact, attacker-content write in the
   victim's unsandboxed process. CONFIRMED live in W5 §18. The correct language remains **remote
   content-controlled heap corruption with process death**, not code execution: no instruction-pointer
   control has been demonstrated from a remotely deliverable input, and after this round there is still no
   reclaiming object.
2. **F5-2 — remote memory-exhaustion DoS.** A 34-byte frame takes +2017 MiB of commit; two decoder contexts
   per publisher ⇒ ~4 GiB from one peer. CONFIRMED live.
3. **The uncontrolled-sweep regime (W6 §7).** Choosing the victim's headroom so the failure lands on the
   `mip` calloc leaves a 1024×1024 geometry committed with `mi` dangling, and the write marches ~290 KB
   through **live** heap with no reclaimer needed (fault reproduced at `mi+293,673`). Content control is lost
   there (0/128), so it is not a step toward code execution — but as *impact* it is strictly worse than the
   small-regime write and belongs in the severity statement.
4. **CFG is switched off at the main image.** `WickrPro.exe` `DllCharacteristics = 0x8160` (no GUARD_CF)
   while the PDF/renderer DLLs it loads are instrumented. CONFIRMED, re-measured this pass. One link flag
   turns on protection the shipped code already carries. Cheapest ask in the whole report.
5. **A September-2025 build shipping an October-2024 Chromium third-party tree**, with the PDF parser
   reachable from remote bytes in the unsandboxed main process, and `139.0.7258.67`'s reach into PDFium
   **unverifiable from the shipped bytes**. Ask the vendor to state the PDFium/OpenJPEG/FreeType DEPS pins
   directly; that is a one-line answer for them and a hard question for anyone outside.
6. **The format allowlist protects nothing.** `func 0x140045870` checks a four-item MIME allowlist and then
   passes `format = NULL` anyway at `0x140045bfd`, so the sniffer picks the decoder among ten resident
   plugins plus PDFium. CONFIRMED (W9).
7. **Four libjpeg-turbo copies, three resident in one unsandboxed process, at four different patch levels**
   (§3.3), plus an unpinned libyuv and an unpinned FreeType. This is a supply-chain hygiene finding
   independent of any exploitable bug.
8. **Non-memory-safety items from W9 that still stand:** crash reporting is enabled and F5-1 kills the
   process on demand, so a peer can force a minidump of an E2E client to be produced and uploaded; and
   `WASAPIAudioManager` writes raw microphone PCM to disk unencrypted by default in a user-writable install
   directory.

---

## 5. WHAT REMAINS OPEN, RANKED, WITH THE CHEAPEST DECISIVE CHECK

**#1 — Is constraint 3 an equality at all? (The single assumption ~20 of this round's kills rest on.)**
Every kill of the form "no `76k+23` lands in this block size" assumes the freed `mip` block is **LFH**-served
(exact-size subsegments, no splitting). The NT **backend** splits a larger free block and returns the front,
so a *smaller* target would land at the same base — and because `mbc=2` geometries have clean slots starting
at 696 for arbitrarily large `k`, that relaxation admits essentially any object ≥ 704 B. The LFH covers
allocations up to 16 KB, and the attacker picks `k`; any `k > 215` puts the freed block above that.
Uncomfortably, the F5-1 gate is opened by a per-process **commit cap**, i.e. exactly the starved-heap
condition that makes the backend more likely. *This is an assumption of the brief, not an error by any agent,
and I am not asserting it is wrong.*
**Cheapest decisive check:** with the existing local harness — no call, no second machine, one afternoon —
free a `mip` block of a chosen size under the cap, then request a **smaller** size in a different bucket and
see whether the returned pointer equals the freed user pointer. Run this **before** anyone re-searches for a
target; it either restores ~20 candidates and a much larger corpus, or it hardens every negative in the file.

**#2 — The load-side corpus (26 dereferenced pointer loads at clean-slot displacements with no matching
store).** The search unit was wrong (§2.2 ii) and the fix is mechanical.
**Cheapest decisive check:** re-run the join on *loads* rather than stores, bind each base to an allocation
size, and apply constraint 3 first — it is value-independent and kills most rows before any manual reading.
Verifier B's `W10-VERIFY-coverage_attack.json` already has the 138 loads enumerated by displacement.

**#3 — The four rescued encoder-region stores are triaged (§1.3), but the chained-chunk defect is not fixed
in the tool.** 662 of 3,831 corpus stores sit in chained chunks and 12 of the 52 clean-slot stores do.
**Cheapest decisive check:** patch `ptrstore.py` to key by primary function (`W10-LEAD-join.py` has the
UNWIND_INFO chain-walk, 20 lines) and re-run; the 7 remaining chained clean-slot stores whose primaries are
*not* in `R_all` then get a reachability answer instead of silence.

**#4 — `R_all` admits the entire VP8 ENCODER, so the candidate list is a loose over-approximation.**
Independently reported by three of the four batches: `vp8e_init`, `vp8_create_compressor`,
`vp8cx_pick_filter_level*` are all in `R_all`, and **11 of the 32 rows (17, 19–24, 29–32) are VP8-encoder-only**;
row 1 is the FDK-AAC *audio* encoder, so 12 of 32 sit on a send-side path a remote peer cannot schedule. That widens the list
rather than narrowing it, so it cannot hide a survivor — but it wasted roughly a third of the round.
**Cheapest decisive check:** intersect `R_all` with the set of functions reachable from
`VpxDecoder::process` *without* passing through `vp8e_init` / `vpx_codec_enc_init`, and re-rank.
Not yet done: **nobody re-derived `reach.py` itself.** A *miss* by `reach.py` is the direction that would
matter, and it is untested.

**#5 — NPL's 10.17 % `.pdata` blind spot.** "Not in the corpus" still is not "does not exist".
**Cheapest decisive check:** the pattern already exists — `scratch/w9/jpeg/rawcall.py` brute-forces every
byte of `.text` for `E8`/`E9` rel32 encodings and closed the blind spot for a call-site census in minutes.
The equivalent for a store-form census is a linear scan for the four store encodings with a `.pdata`-anchored
resynchronisation, not a naive linear disassembly (those desync).

**#6 — Qt6Pdf.dll's libjpeg-turbo is UNPINNED and peer-reachable; FreeType is unpinned; libyuv is unpinned.**
**Cheapest decisive check for all three:** the offline DEPS diff already named in §3.1. Without it, the
honest status of the `139.0.7258.67` claim for the PDF stack stays **UNDETERMINED**, not "covered".

**#7 — The PacketPacer class's remaining unknowns** (§1.4a): the ring pool `0x1800c2980` has nine callers, so
0x900 may not be the only class it serves; and constraint 5 was never reached for it.
**Cheapest decisive check:** disassemble the nine callers' size arguments — an hour — and if another class
appears, run it through constraint 3 before reading any of its stores.

**#8 — Candidate 9's object class** (two callers, one leading to an object of unestablished class ≥ 0x508 B).
Genuinely undetermined and genuinely unimportant: its kill is on value, not on class.

---

## 6. ARTIFACTS

Written this round (all under `E:\tmp\wickr\scratch\`):

* `w10\W10-batch1-triage.json`, `w10\W10-batch9-16-triage.json`, `w10\W10-batch17-24-verdicts.json`,
  `w10\W10-batch25-32-triage.json` — per-candidate evidence for rows 1–32.
* `w10\lattice10.py`, `lattice10_b1.py`, `W10-batch9-16-lattice.py`, `lattice_bind.py`, `robust.py`,
  `w10_lattice_b25_32.py` (+ their JSON) — four independent constraint-3 solvers, each selftested against
  the live-measured configuration (`k=25` → request 1923 → block 1936 → `mi_off` 472 → clean slots
  `[1152, 1912]`).
* `w10\W10-VERIFY-{bytecheck,join_recheck,lattice_verify,chunk_check,coverage_attack}.py|.json`,
  `W10-VERIFY-summary.json` — verifier B: 96/96 instructions re-read exact, list re-derived, `.pdata`
  coverage measured, load-side census.
* `w11\W11-verifier.json`, `w11\{lat11,run11,at,regdef2,idxscan,drefnpl}.py`, `w11\c3_11.json` — verifier A:
  28 instructions re-read, 13 dominance claims re-measured, constraint 3 recomputed over H × delta, plus the
  counterfactual "what if the base binding had been wrong" run.
* **This pass:** `w10\W10-LEAD-join.py` + `W10-LEAD-join.json` (the corrected 37-row join, with the
  chained-chunk walk), `w10\W10-LEAD-pincheck.py` + `W10-LEAD-pincheck.json` (independent re-measurement of
  the PDFium guards, CFG bits and the four libjpeg copies), `w10\W10-LEAD-evidence.json` (the
  `decoding_thread_count` chain, the five rescued rows, my constraint-3 re-runs), `w11\dispscan.py`
  (displacement census over all `.pdata` functions).
* Decoder pinning: `w9\pdfium\` (W9-pdfium-results.json, sweep_pdfium.json, pdis.py, bytefind.py,
  branchto.py, callgraph.py, importcensus.py, …) and `w9\jpeg\` (W9-2b-jpeg-evidence.json, msgtab.txt,
  dumpmsg.py, errexit.py, rawcall.py, closure.py, …).

**My own likeliest bug, for whoever reads this in ten minutes:** `W10-LEAD-join.py`'s chained-chunk
resolution walks `UNWIND_INFO` and reads the trailing `RUNTIME_FUNCTION` at
`unwind + 4 + 2*((CountOfCodes+1) & ~1)`. If that offset is wrong for entries that also carry an exception
handler, some primaries resolve to garbage and the "37" is wrong. It reproduces verifier B's independently
computed counts exactly (4,518 chained; 52 clean-slot stores; 32 by entry, 37 by primary), which is the
check that matters — but that arithmetic is the first thing to re-read. Second: I took `reach.json` on
trust. Nobody in this round re-derived it, and a **miss** by `reach.py` is the one direction that could hide
a survivor.
