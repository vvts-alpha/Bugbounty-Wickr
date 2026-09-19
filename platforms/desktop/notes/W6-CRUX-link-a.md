# W6 CRUX — link (a), the reclaiming object: narrowed hard, and one escape route CLOSED

Date 2026-07-31. Everything below was produced this session against the **unmodified installed
`NPL.dll`** (no patched binary, no debugger, no allocator hooks) or by disassembling the shipped
image. CONFIRMED = I read the bytes or measured it. INFERRED = reasoned from confirmed facts.

Tools written this session, all in `scratch/w6/`:
`reclaim_scan.py`, `clean_slot_lattice.py`, `allocsite_scan.py`, `slotstore_scan.py`,
`uaf_sweep.py`, `dump_evidence.py`. Evidence: `W6-sweep.log`, `scan2.log`, `sweep_run*.out`.

---

## 0. Two corrections to how the question was posed

**(i) Link (b) is not open.** The re-hunt brief's table lists *"live over-the-wire delivery — OPEN"*.
`W5-CRUX` §15 closed it (`decode#843/844/845`, all three crafted frames decoded in order, arming
geometry `mi − mip = 456`, block 1923 B) and §18 then produced a byte-exact write over a real call.
**Only (a) is open.**

**(ii) The gate row is stated with a figure its own document retracts.** "victim free commit below
~4034 MiB" is superseded by `W5-CRUX` §16a: `commit free` is a snapshot, Windows grows the pagefile.
The live gate was opened with a **Job Object per-process commit cap**. The correct precondition is
*a commit limit that cannot grow*.

## 1. A misattributed piece of evidence in §18a — CONFIRMED by disassembly

§18a concludes the block was still free because *"the dump's `−8` slot holds `0x1acc4e5fae0` … the
shape of a free-list entry"*. That value is `mip − 0x10`, i.e. the block's **own** raw base. It is
what `vpx_memalign` writes there:

```
0x18017f440  vpx_memalign(rcx = align, rdx = size)
0x18017f472    call [rip+0x2a5748]        ; malloc(size + align + 7)   <- this is the "+23"
0x18017f47d    lea  rbx, [rdi + 7]        ; rdi = align = 16 (set at 0x180186268)
0x18017f481    neg  rdi
0x18017f487    and  rbx, rdi              ; round down to `align`
0x18017f48a    mov  qword [rbx - 8], rax  ; <== stores the RAW malloc pointer
0x18017f3e0  vpx_free:  mov rcx,[rcx-8] / jmp free
```

That store happens at **allocation** time and persists across the free. A free-list `Flink` points at
another block or the list head, never at its own base. **The `−8` slot is not evidence of free state.**
The conclusion ("nothing reclaimed it") survives on the *rest* of the dump being zeros; the cited
evidence does not. Free-state evidence would be at `−16`/`−9` (the user area, where the NT heap puts
`_LIST_ENTRY`), which the dump does not discuss.

Two useful by-products, both CONFIRMED from the same 92 bytes:
* `align = 16` and NT-heap user pointers are 16-aligned, so `mip = raw + 16` **always** — never 32.
  `base == mip − 16` is exact, not typical.
* the malloc request is `mip_size + 23`, which is where `76k + 23` comes from.

## 2. Nothing on the decoder's error path competes for the block — CONFIRMED

`VpxDecoder::process` takes its decode-failure arm at `0x180144bc3` and calls `0x180144320`. That
function is 25 bytes of flag reset:

```
0x180144335  mov word  [rdx + r9 + 0x4e1], 0
0x180144340  mov byte  [r9 + rax + 0x4e0], 0
0x18014434a  mov byte  [rdx + r9 + 0x4e2], 0
```

**No allocation.** So the live observation in §17 (four dumps over 3 s, byte-identical) is what the
code predicts: between the free and frame C the wrapper allocates nothing, and a reclaim must be
*engineered* by the attacker rather than waited for.

## 3. `NPLNodeCreate`'s argument convention — §13a's NULLs were a calling-convention error

`NPLNodeCreate(name, a2, a3)` string-matches the table at RVA `0x539540` and **tail-jumps
`factory(rcx = a2, rdx = a3)`** (`0x1803d1e6d jmp r8`). Disassembling all 17 factory prologues:

| factory | arg1 |
|---|---|
| `VideoDecoder 0x1801221f0`, `VideoEncoder 0x1801215f0` | a **codec-name string** — strlen'd at `0x180122227`, handed to the VpxDecoder factory `0x180122040`; the scene is arg2 |
| the other 15 | the scene |

§13a called `NPLNodeCreate(name, scene, NULL)` for everything, so `VideoDecoder` was strlen'ing the
scene pointer. It is **not** true that it "needs other args/a format". With
`NPLNodeCreate("VideoDecoder", "vp8", scene)` the real `Musigy::AV::VpxDecoder` node constructs
(measured: `0xc4c7189750`, 13 new heap blocks). **13 of 16 node types now construct, against 6.**

## 4. The corrected enumeration — and §13b's candidate is now closed structurally

`reclaim_scan.py` re-runs §13's measurement with three defects fixed: the right arg convention (§3),
**all** factorizations of `k` per bucket rather than the first, and VirtualQuery classification of
every pointer found.

```
blocks considered (>=244 B, reachable size class): 12
  with a pointer on a CLEAN partial-overwrite slot : 0
  with a pointer only on writable slots            : 11
```

Two things this changes about §13b:

**(a) It is one object class, not three.** `PacketQueue`, `PacketMonitor` and `Puller` do not each
have a distinct 1702-byte block — **all 17 node types allocate the same 1702-byte `Node` base block**,
with pointers at +248/+256/+264/+272/+280. §13b's "three candidates" is one.

**(b) Its failure is structural, not incidental.** Derived rather than observed:

> clean slot offset = `mi_off + (r·stride + mbc−1)·76 + 72` = `88 + 76·[2·mbc + 1 + r·(mbc+1)]`,
> and `76 ≡ 4 (mod 8)`, `88 ≡ 0 (mod 8)`
> ⇒ **8-aligned iff `mbc` is EVEN and `r` is ODD** (and `r` odd needs `mbr ≥ 2`).

So with `k = (mbc+1)(mbr+1)` fixing the block size, a clean aligned slot exists **iff `k` has an odd
divisor ≥ 3 whose cofactor is ≥ 3**. The `Node` block is 1712 ⇒ `k = 22 = 2 × 11`; its only odd
divisor ≥ 3 is 11, cofactor 2. **No geometry works — the leak-free partial overwrite is impossible
for that size class, not merely unobserved.** §13c checked the two geometries and got the right
answer for the wrong reason.

(The model is pinned by a selftest that reproduces the live configuration: W=H=64 → request 1923,
`mi_off` 472, clean slots `[1152, 1912]` — exactly `e2e-payload/manifest.json`.)

## 5. How much of the size-class space is reachable at all — measured

`clean_slot_lattice.py`, blocks 256 B … 1 MiB:

| | |
|---|---|
| distinct NT block sizes in range | 65,520 |
| reachable as a freed `mip` block under some geometry | **9,895 (15.1 %)** |
| of those, admitting an 8-aligned clean slot | 9,709 (**98.1 % of reachable**) |

⇒ the binding constraint is **not** clean-slot alignment; it is that `76k+23` steps by 76 while NT
buckets step by 16, so the attacker's size lattice is sparse. **A target object whose size the
attacker does not choose has roughly a 1-in-6.7 chance of being addressable at all.**

## 6. Whole-binary sweep of fixed-size classes — NEGATIVE, with its blind spot stated

`allocsite_scan.py` + `slotstore_scan.py`, over all 13,498 `.pdata` functions:

```
1640 constant-size `operator new` sites, 115 distinct sizes
  85 clear the 244-byte mi_off floor
  19 land in an attacker-reproducible NT block size
   5 are CLEAN-CAPABLE            -> sizes 928, 1168, 1540, 1920, 2304
```

Sweeping every function for `mov qword [reg+disp], reg` at those classes' clean slots (+696, +1152,
+1912, +2064) finds store sites, but the only candidate whose constructor installs a vtable resolves
through RTTI to **`.?AVPortAudioManager@AV@Musigy@@`** — an audio-device singleton built at startup,
which an attacker cannot get allocated inside a millisecond-scale window on the video decode thread.
The 1920- and 1540-byte sites are raw zeroed **buffers** (`memset(rax,0,0x780)` at `0x18031179b`;
`[rdi+0x40]=rax, rax+=0x604, [rdi+0x50]=rax` at `0x180398866`), not objects with pointer fields.

**Blind spots, stated rather than implied:**
* a constant-size sweep structurally cannot see **computed-size** allocations — and per §11b the
  target is supposed to be *array-like*, i.e. exactly the computed-size case. This is the real
  residual and §7 line 1 is how to close it.
* `mov qword [reg+disp], reg` does not match a pointer deposited by `movups` of an xmm pair, by
  `xchg`, or via an interior base register — the same residual §12 carried.

## 7. ★ THE MIP-CALLOC REGIME: reach without a reclaimer — and why it still fails

This is the part that matters most, because it is the one route that makes link (a) *unnecessary*.

Every statement of link (a) in the corpus — `W5-CRUX` §9/§11b/§11c/§12/§18b and
`FINAL-REPORT-wave5.md` §4 — is written in the **first-yv12-failure** regime: the geometry stays at
the old 4×4, and the write is confined to the freed 1923-byte block plus 69 bytes. There the question
"what reclaims the block" is the right one.

But **which allocation fails is chosen by the attacker**, via the victim's headroom. The Wave-4
verifier measured the other regime and it never reached any report
(`W4-COMPLETENESS-CRITIC` §C1, `verdict_vp8-mi-uaf-after-alloc-failure.json` §11). **I reproduced it
this session**, cap 1600 MiB, unmodified DLL:

```
[B] 16383x16383 keyframe -> rc=-1   mip=0x0   mi=0x8000e0b4d8 (unchanged, still in the freed block)
[B] committed geometry: mb_rows=1024 mb_cols=1024 stride=1025
[B] => vp8_decode_mode_mvs will target 79,769,600 bytes from mi (76.1 MiB)
[census] first  262144 B of the sweep: 10 BUSY heap blocks, 20911 bytes live, 474 pointer qwords
...
fault at mi+293,673  (286.8 KiB past mi)
```

The geometry is committed at `0x18018619e`..`0x1801861af` **before** the `mip` calloc at `0x1801861c9`,
so a failure there leaves the attacker's 1024×1024 geometry live with `mi` still pointing into the old
small freed block. **The write then marches forward through live heap — no reclaim required at all.**

### 7a. But content control is LOST in that regime. MEASURED, 0/128.

`uaf_sweep.py` fires the W5 SPLITMV encoder into it (the Wave-4 measurement predates `vp8modes.py`,
so it could only ever see *how far*, never *what*):

```
steered macroblocks matching byte-for-byte : 0/128
of those, records PAST the end of the freed block : 0
[NOT DEMONSTRATED] content-controlled write far past the freed block
```

Macroblock **0** already misses, which rules out "it desynced somewhere downstream". The mechanism,
and it is measured not assumed:

> `vp8_decode_mode_mvs` reads the *above* neighbour at `mi − stride·76`. With `stride = 1025` that is
> **`mi − 77,900`** — 78 KB *before* `mi`, unrelated heap, not the border row a healthy decoder has.
> `vp8_find_near_mvs` reads `ref_frame` there to build `cnt[]`, which selects the `vp8_mv_ref`
> probabilities, which selects which mode the tree decodes.

```
[above] the row vp8_find_near_mvs reads at mi-77900 holds 1025 records;
        515 have ref_frame != 0 and 738 have a non-zero mbmi
[above] the LEFT neighbour of mb 0 is that row's last record: mbmi = 24cb0e3eb49f49d93fbfdfdd
```

**Half the neighbour row reads as inter**, and mb 0's left neighbour decodes as `mode=36, ref_frame=14`
— garbage. The arithmetic decoder desyncs from the first macroblock. This is `W5-CRUX` §4b's feedback
constraint, but in a form the attacker cannot escape: in the small regime the neighbour row lies
*inside the freed block*, which a reclaimer controls; in the sweep regime it lies 78 KB before `mi`, in
memory the attacker neither owns, controls, nor can observe.

*(A `--zero-above` control was written and run; a 78 KB memset through live heap metadata triggers a
fail-fast that bypasses vectored handlers, so it produced no data. The non-destructive census above
answers the same question and is what is reported.)*

### 7b. The consequence — this is the load-bearing result

> **The two regimes are mutually exclusive on the two properties RCE needs.**
>
> | regime | selected by | reach | content control |
> |---|---|---|---|
> | fails at first yv12 | headroom < one yv12 buffer | freed block + 69 B — **needs a reclaimer** | **YES** — 4/4 offline, byte-exact live (§18) |
> | fails at the mip calloc | headroom between the yv12 set and the mip array | **~290 KB of live heap, no reclaimer** | **NO** — 0/128, desynced by 78 KB of unknown heap |
>
> You get reach **or** content control, not both.

So the mip-calloc regime does not rescue the chain. It is a much larger **uncontrolled** heap
corruption (a stronger DoS, and worth restating in the F5-1 severity), but it is not a step toward
code execution, and link (a) cannot be side-stepped this way.

## 8. Where link (a) stands now

| sub-question | status |
|---|---|
| does anything reclaim the block *naturally*? | **NO** — measured live (3 s, four identical dumps) and explained by §2 (the error path allocates nothing) |
| do NPL node-construction objects qualify? | **NO** — 0/12 on a clean slot; the one candidate class is structurally impossible (§4) |
| do fixed-size NPL classes qualify? | **NO** — 5 clean-capable classes, none with an attacker-timeable pointer on a clean slot (§6) |
| can the sweep regime avoid needing a reclaimer? | **NO** — reach is real, content control is lost (§7) |
| do **computed-size / array-like** allocations qualify? | **UNKNOWN — the one real residual** (§6 blind spot) |
| can the attacker *force* a chosen allocation into the window? | **PARTLY** — the packet pool takes the peer's byte count as its size (`0x1800e04ad`), so a size-matched allocation is drivable; but the packet itself carries no reachable pointer (§12), so this places a *useless* object |

## 9. Three lines of attack on (a), by cost

1. **Finish the local running-graph enumeration** (cheapest; no call, no second machine, half a day).
   The blocker §13c named is gone: `VideoDecoder` constructs (§3). What remains is
   `NPLAVSourceCreate` / `NPLAVFormatCreate` / `NPLAVPacketCreate` / `NPLSceneStart`, whose argument
   setup is readable at WickrPro's own call sites `0x1406ed9d0`, `0x1406eee80`, `0x1406ed800`. Push
   frames through a started scene and `HeapWalk` per frame. **This is the only way to cover the
   computed-size / array-like corpus that §6 structurally cannot see**, which is the sole remaining
   residual.
2. **A live allocation trace on the victim** (medium; needs the 4 GiB VM and a call). Add a fourth
   passive detour to `victim_probe.c` on the packet pool `0x1800e0490` and on `RtlAllocateHeap`,
   filtered to sizes in the reachable lattice, logging `(size, caller)` for the window after the gate
   opens. `victim_probe` already detects the gate and dumps the block; this turns "nothing reclaimed
   it" into "here is everything that *could* have".
3. **Force the reclaim rather than wait for it** (most expensive, and the only line that could make
   an exploit *reliable*). The peer already controls one allocation's size and lifetime (§8, and FEC
   retains the block). The work is to find a **second** peer-triggerable allocation that carries a
   pointer — the mid-call `kind==1` FORMAT re-parse (equality gate `0x180132ec4`, apply function
   `0x180132d80`, 58 live events) is the one candidate the corpus names and nobody has followed
   (`W4-COMPLETENESS-CRITIC` §E3).

## 9b. CORRECTION to this document — the clean-slot floor is 696, not 244

Found by the W7 surface sweep and re-derived here. **244 and 696 are two different quantities and
§§4/6/8 of this file conflate them.**

* **244** = the minimum *unwritable prefix*: `mi_off = 16 + (mbc+2)·76`, minimised at `mbc = 1`. Below
  it the write reaches nothing at all. That is the right floor for "can the write touch this object".
* **696** = the minimum *8-aligned clean slot*: `88 + 76·[2·mbc + 1 + r·(mbc+1)]` with `mbc` EVEN and
  `r` ODD, minimised at `mbc = 2, mbr = 2, r = 1` (`mi_off = 320`). That is the right floor for
  "can the **leak-free partial overwrite** reach a pointer in this object".

So a target for the leak-free variant must be **≥ 704 bytes** (696 + the 8-byte pointer), not ≥ 244.
`slotstore_scan.py` was already correct — its Q1 list starts at `+696` — only the prose here was
wrong. The error runs in the safe direction: it **shrinks** the candidate set further and strengthens
§10's conclusion rather than weakening it. The §6 sweep is unaffected (it enumerated each class's
actual clean slots, not the floor).

*(The sweep also reports "688 for pool-allocated". That variant depends on the pool block's base
differing from `vpx_memalign`'s `raw + 16`; it is not re-derived here and should be treated as
INFERRED until someone checks it.)*

## 10. Does an RCE path exist? — my answer

**Not on this evidence, and I would not expect one to be reachable with this primitive as it stands.**

What is demonstrated is very strong and should be reported as such: a remote, authenticated call peer
sends 405 bytes of VP8 and obtains a **byte-exact, content-controlled use-after-free write** in the
victim's unsandboxed process, plus a 34-byte remote DoS. The exploit-primitive questions are closed —
content control, density, aim, ASLR-surviving partial overwrite and PC-control-given-a-reclaimer are
all measured.

What is missing is a **target**, and after this session the gap is narrower and better characterised
rather than smaller in the way that matters:

* the reclaiming object must be array-like, **≥ 704 B** (see the correction below), in one of
  **15.1 %** of size classes, holding a pointer on a slot that is clean *and* 8-aligned, pointing into
  memory in a 4 GiB window the attacker can spray, and be allocated inside a millisecond-scale window
  on the decode thread;
* nothing in the media pipeline enumerated so far meets it, and the one class the corpus proposed is
  **structurally excluded**;
* the regime that would remove the reclaim requirement entirely **loses content control** (§7) — the
  two capabilities are mutually exclusive;
* there is still **no information-disclosure path back to the attacker**, so every attempt is blind and
  unverifiable, against a target set that is now measured to be sparse.

The honest label for F5-1 remains **remote content-controlled heap corruption with process death**,
not RCE. Line 1 of §9 is worth running because it closes the last residual cheaply; I do not expect it
to change this conclusion, and a negative there would let the finding be written up as
"not exploitable to code execution on the evidence available" rather than "unknown".
