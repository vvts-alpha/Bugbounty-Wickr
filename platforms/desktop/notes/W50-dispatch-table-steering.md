# W50 — the in-window `WasmDispatchTable` entry is STEERABLE; A4 still cannot deliver the value

Written 2026-08-05. Continues W43 (A4 out-of-cage write), W47/W48 (address-space map, JIT verdict).
Every line **[M] measured** on the shipped AWS Wickr desktop (Qt WebEngine 6.9.2, Chromium base
130.0.6723.192, declared patch level 139.0.7258.67) unless marked **[I] inferred** or **[P] public
source read at the pinned ref** (`v8 branch-heads/13.0`, fetched by W43 to
`scratch/w43/src/v8/branch-heads_13.0/`). Harness/pages `scratch/w50/`.

16 runs, one fresh port each, loopback only. The live product was never touched: every run is a
harness process (`w50steer.exe`, `--single-process` Qt WebEngine) serving its own page.

---

## 0. Bottom line

> ### The field is steerable. **A redirected `call_indirect` was observed landing exactly where it was aimed, 10/10** — by a single 4-byte store that changes only the LOW HALF of a `WasmDispatchTable` entry's `target`. The `sig` twin works too, 10/10, giving a calling-convention type confusion. The entry survives to the call: it is re-read raw on every call, with no re-derivation, no re-validation, and no cache — including after the callee has tiered up.
>
> ### But **A4 cannot deliver that write.** A4's address-controlled mode writes a value V8 chooses; its value-controlled mode cannot be aimed at any of these fields — **0 usable aiming words for 22 fields, 4/4 runs**, plus an independent structural block from the source. So W43 §6c's boundary (address-choice and value-choice never demonstrated *simultaneously* without harness help) **still stands, and is now measured rather than assumed for this specific target.**

**The 4-byte write in every steering result below was performed by the harness, not by A4.** That is
the deliberate design: it isolates *steerability of the field* (this note's contribution) from
*delivery of the write* (W43's). Do not read this note as a chain.

**Still NOT achieved: code execution.** What is demonstrated is redirection of a call to *other
existing, legitimately compiled* wasm code, and a signature confusion. No shellcode, no ROP, no
attacker-authored instructions.

Also corrected here: **W47's identification of the `dt−152 / +796 / +888` pointers as a
`WasmDispatchTable` entry is wrong** — they are not dispatch-table entries at all (§2).

---

## 1. What the source says the call actually does [P]

`LiftoffCompiler::CallIndirectImpl` (`liftoff-compiler.cc:8422-8757`), pinned. In order:

1. load the dispatch table (protected pointer from the instance data);
2. bounds-check the index against **`WasmDispatchTable::kLengthOffset`** (int32, `:8492`);
3. load **`sig`** (int32) at `entry + kSigBias` and compare it against
   `canonical_sig_id`, a **constant baked into the compiled code** (`:8581`, `:8590`) — with an RTT
   supertype walk only when the declared type is non-final, and that walk is itself short-circuited
   by an equality fast path on the same word;
4. load `implicit_arg` (protected pointer) and **`target`** — `__ Load(..., kTargetBias,
   LoadType::ForValueKind(kIntPtrKind))`, i.e. a **raw full-width pointer** (`:8686-8690`);
5. `__ CallIndirect(&sig, call_descriptor, target)` (`:8752`).

So the target is a raw address read out of the entry at call time. **There is no
`WasmCodePointerTable` indirection in this version**, nothing re-derives the target, and nothing
validates it. Layout (`wasm-objects.h:758-784`) [P]:

| offset | field |
|---|---|
| +0 | map |
| +4 | `kLengthOffset` (int32) |
| +8 | `kCapacityOffset` (int32) |
| +12 | `kProtectedOffheapDataOffset` |
| **+16** | **`kEntriesOffset`** |
| entry +0 | `Address target` (8 B) — `kTargetBias` |
| entry +8 | `ProtectedPointer implicit_arg` (4 B) — `kImplicitArgBias` |
| entry +12 | `int32 sig` — `kSigBias` |
| | `kEntrySize = 16` |

Every one of those offsets is confirmed by measurement in §2, not assumed.

## 2. Q1 — identification, and a correction to W47 [M]

The page (`w50-steer.html`) builds two modules: W43/W47/W48's 33-table **anchor** (so the proven
fingerprint scan finds `dt_elems`, the origin A4's ±2 GiB is measured from) and a **steer** module
with an 11-entry funcref table whose elem segment is `[f0 f1 f2 g0 jsf f0 f1 f2 g0 jsf f0]`.

The harness identifies the table by that repeat structure — the 11 targets must fall into exactly
the groups `{0,5,10} {1,6} {2,7} {3,8} {4,9}`, pairwise distinct, all inside committed executable
memory. Matching that at stride 16 with the target at +0 **is** the confirmation of
`kEntrySize` / `kTargetBias`; the `sig` vector then comes out as an observation:

```
entry offsets from dt_elems : 3464 3480 3496 3512 3528 3544 3560 3576 3592 3608 3624
stride                      : 16 16 16 16 16 16 16 16 16 16      == kEntrySize [P] confirmed [M]
sig vector                  : 4 4 4 3 4 4 4 4 3 4 4              == the elem type pattern [M]
                                    ^        ^   g0 is (i32)->i32, everything else ()->i32
```

### 2a. The W47 offsets reproduce — and are NOT dispatch-table entries

| offset from `dt_elems` | reproduced | classified |
|---|---|---|
| `dt−152` | **16/16 runs** | **not a dispatch-table entry** |
| `dt+888` | **16/16 runs** | **not a dispatch-table entry** |
| `dt+796` | **10/10 runs with the fixed scanner** (see 2c) | **not a dispatch-table entry** |

Two independent tests, both in the harness log for every run:

* **(a) map word.** A hit is an entry only if an object carrying the *confirmed* dispatch table's
  map word sits at `hit − 16 − 16i` with `i < length`. Measured dispatch-table map `0x0000205d`;
  none of the three hits has it at any `i` up to 512.
* **(b) self-refutation, independent of any other object's layout.** If the hit were an entry, the
  word at `hit+8` would be `implicit_arg`, a compressed trusted pointer that must decompress into
  committed trusted space. For `dt+888` that word is `0x08000001`, decompressing to
  `trusted_base + 0x08000000` = 128 MiB into a reservation with **0.50 MiB committed** →
  **not committed, impossible.**

What they actually are: in **20 of 30** non-entry hits across the fixed-scanner runs, the word at
`hit − 20` is the same value `0x00001ef5`, i.e. one object type, whose raw pointer field sits at
object+20 and is followed at +28 by an 8-byte quantity. That matches `WasmInternalFunction`
(`wasm-objects.tq:55-76` [P]: `ExposedTrustedObject` header, `protected_implicit_arg`, `external`,
`function_index`, **`call_target`**, **`signature_hash`**). Corroborating [M]: one such hit's value
is exactly module B's jump-table base **+25**, the slot of the exported `ci2` — a function that is
in no table at all, so no dispatch table can hold it.

**⇒ W47's `dt+888` reading of `{target, implicit_arg, sig}` was the field triple
`{call_target, signature_hash}` of a `WasmInternalFunction`.** Its `0x08000001` "odd ⇒ tagged
implicit_arg" is the low half of the 8-byte `signature_hash`, and its "sig = 0" is that hash's high
half. The *lead* survives — a raw code pointer really is sitting a few hundred bytes from the write
origin — but the object was misnamed, and the actual dispatch-table entries are elsewhere.

### 2b. Real entries are in the window, but their offset is NOT a layout constant

Module B's dispatch table object, offset from `dt_elems` across 16 runs:

```
2788 x7    3448 x2    3552 x6    4212 x1        -> four distinct values, no constant
```

Entries then run from that +16 in steps of 16, i.e. `dt+2804 … dt+3728` depending on the run.
Every one is inside A4's ±2 GiB window and 4-byte aligned (typical `K = +701 … +932`). But because
the object's offset moves, **a page cannot hard-code `K` for this target the way W43 §6c hard-coded
263** — it would need a scan or a leak first. That is a real limitation and it is measured, not
assumed.

The window itself re-measures exactly as W47 §5 / W48 §2: **4 regions, 0.50 MiB committed
(0.75 in 1 of 16), all of it trusted space, no executable memory** [M, 16/16].

### 2c. A scanner defect of this harness's own, recorded so it is not re-inherited

Objects in the trusted compression cage are **4-aligned, not 8-aligned**. A dispatch table whose
base is `4 mod 8` has every 8-byte `target` at a `4 mod 8` address, so a scan stepping 8 bytes
misses all of them — measured: **3 hits instead of 15**, and it is what hid `dt+796` in the first
6 runs. The scan must step 4 and read unaligned. This is the same class of silent false negative as
W47 §0's three inherited defects.

## 3. Q2 — VALUE CHOICE: a low-half-only write retargets the call [M, 10/10]

The write is one 4-byte store at a 4-byte-aligned address, i.e. exactly A4's shape, and the value
is **computed, not copied**: `f2` is two declared-function indices past `f0` and the targets are
jump-table slots, so `low32(dest) = low32(entry0.target) + 2 × kJumpTableSlotSize`. Representative
run (port 9491):

```
[t= 16328ms] === Q2: TARGET WRITE -- redirect entry[0] (f0) to entry[2]'s code (f2) ===
    entry[0].target before = 0x00002ce4007d1000
    entry[2].target        = 0x00002ce4007d100a
    measured jump-table slot size = 5 B; value COMPUTED as low32(entry0.target) + 2*5 = 0x007d100a
        -> MATCHES ground truth 0x007d100a
    high halves: entry0 0x00002ce4  entry2 0x00002ce4 -> EQUAL, so a LOW-HALF-ONLY write suffices
    write address 0x4afc000423b0
      distance from dt_elems = +2804 B => A4 index K = +701, 4-aligned: YES, inside +-2 GiB: YES
    entry[0].target after  = 0x00002ce4007d100a  == entry[2].target  (high half preserved)
    bytes changed: 4 (low half only).  neighbours: implicit=0x000422c9 sig=4 (untouched)
```

and the page, which holds no primitive and only calls `call_indirect` on in-bounds indices:

```
[t= 15637ms] {"n":26,"ci0":"50a0c0de","ci1":"50b0c0de","ci2_":"50c0c0de","ci4":"50e0c0de",...}
                     ^^^^^^^^ f0
[t= 18858ms] {"n":34,"ci0":"50c0c0de","ci1":"50b0c0de","ci2_":"50c0c0de","ci4":"50e0c0de",...}
                     ^^^^^^^^ f2 -- the call to table entry 0 now enters f2's code
```

**Answers to the three sub-questions asked:**

* **(a) is the low half independently writable at that alignment — YES [M].** 4 bytes changed, the
  high half verified byte-identical afterwards, `implicit_arg` and `sig` untouched, renderer alive.
* **(b) is a displaced target actually entered — YES [M, 10/10].** The page's own observable
  return value changes to the other function's constant. The three untouched call sites
  (`ci(2)`, `ci(4)`, `ci2(3,·)`) are unchanged in **16/16** runs, and in **6/6 control runs with no
  write at all, nothing changes** (§6).
* **(c) what displacement can the page compute for itself — the RELATIVE one, always; the
  ABSOLUTE one, only in one specific case:**
  * Entry targets are **jump-table slots spaced 5 bytes apart** (`kJumpTableSlotSize`, x64
    `jmp rel32`), measured 5 in 10/10 runs, and the slot order follows the declared function index.
    So the page knows every *displacement* without any leak.
  * The **absolute low32 is per-process ASLR** — different in every run (`0x007d1000`,
    `0x49481000`, …) [M]. A low-half write is absolute, not relative, so relative knowledge alone
    is not enough.
  * **The exception, and it is the interesting one.** An entry holding an *imported JS function*
    points at a wasm-to-JS wrapper inside the image:
    **`Qt6WebEngineCore.dll+0x2743e24`, the identical offset in 16/16 runs**, high32 `0x00007ffd`.
    The **V8 code range is at `0x7ffdb6c00000`** (16/16, 512.00 MiB, RWX — reconfirming W47/W48)
    and the DLL at `0x7ffdd8530000`: **the same high32.** So a low-half write on such an entry
    ranges over `0x00007ffd_00000000 … 0x00007ffd_ffffffff`, which contains the whole DLL *and*
    the whole V8 code range, and the low32 it needs is a **per-boot** constant rather than a
    per-process one. Harness output states this per run:
    ```
    V8 code range 0x7ffdb6c00000 (high32 0x00007ffd, low32 0xb6c00000, RWX):
        reachable from entry 0..3? no ; from entry 4? YES
    Qt6WebEngineCore.dll 0x7ffdd8530000 (high32 0x00007ffd): reachable from entry 4? YES
    ```
    **Not fired.** No write was aimed into the DLL or the code range; this is arithmetic over
    measured addresses, and the per-boot constant would still have to come from somewhere.

## 4. Q3 — the `sig` twin: type confusion, and it is the easier of the two [M, 10/10]

One 4-byte store at `entry[1] + 12`, `sig: 4 → 3` (the canonical id of `(i32)->i32`, read from a
sibling entry). No address knowledge of any kind is required — unlike `target`, the value that has
to be written is a small canonical index the page's own module already fixes.

```
[t= 23422ms] entry[1].sig before = 4   entry[3].sig = 3
    write address 0x4afc000423cc  => A4 index K = +708, 4-aligned: YES, inside +-2 GiB: YES
    entry[1].sig after  = 3   target untouched = 0x00002ce4007d1005
```

The page's two call sites swap acceptance in the same tick, 10/10:

| call site | declared type | before | after |
|---|---|---|---|
| `ci(1)` | `() -> i32` | `50b0c0de` | **`RuntimeError: null function or function signature mismatch`** |
| `ci2(1,0)` | `(i32) -> i32` | **same RuntimeError** | **`50b0c0de`** |

So `f1`, a `() -> i32` function, is now reachable through a `(i32) -> i32` call site: the callee
runs under a calling convention with an extra incoming parameter it never declared. Both directions
flipping together is what proves the compared quantity is exactly this word and nothing else.

**Which is easier to steer: `sig`, clearly.** `target` needs an absolute 32-bit code address the
page does not have; `sig` needs a small integer the page already knows. `sig` is also the more
general primitive — it is a *type* confusion, so the same trick turns `externref`/`i64` parameter
mismatches into raw-value/reference confusion, which is a well-trodden road to worse. That was not
explored here and is not claimed.

## 5. Q4 — the entry survives to the call [M]

* **It is not overwritten.** After both writes the redirect held for the remainder of every run
  (100+ observation ticks each, ~40 s), and the harness's post-write dump shows the edited words
  still in place.
* **It is not re-derived.** Source (§1): the target is loaded raw from the entry on every call.
* **It is not defeated by tier-up.** A hot variant (`w50-steer-hot.html`) hammers the *same call
  site under test* 200 000 times per tick. Measured tier-up evidence: `f0`'s unique immediate
  appears **twice** in executable memory in that run (Liftoff + TurboFan) versus **once** in every
  cold run. The redirect still fired. [M, 1/1 hot run; 9/9 cold]
* **Structural reason it cannot be undone by tier-up [M+I]:** the entry points at a *jump-table
  slot*, not at a function body, so when a function tiers up V8 patches the **slot**. An entry
  redirected to a different slot is untouched by that.

## 6. Controls

| control | runs | result |
|---|---|---|
| no write performed (mode 0) | **6/6** | `ci(0)`, `ci(1)`, `ci2(1,·)` all unchanged end-to-end |
| untouched call sites `ci(2)`, `ci(4)`, `ci2(3,·)` | **16/16** | unchanged in every run, write or no write |
| computed value vs ground truth | **10/10** | `low32(f0)+2×5` equals `entry[2].target`'s low half |
| high half after a low-half write | **10/10** | byte-identical |
| renderer survival | **16/16** | page keeps beaconing to the end of the run |

## 7. The composition question, measured — and this is where it stops

Steering the field needs a write that is **both** aimed at the field **and** value-controlled. A4
has two modes (W43 §6) and neither is both:

**Mode 1 — address chosen, value not.** `dispatch_tables()->set(K, *new_dispatch_table)` writes at
`dt_elems + 4K`, which reaches every entry field measured above. The value is a compressed
trusted-space pointer, `~0x0004xxxx`. Into `target`'s low half of the import entry that produces
`0x00007ffd0004xxxx` — inside the right 4 GiB block but matching neither the DLL (`…d8530000`) nor
the code range (`…b6c00000`), i.e. a wild target. Into `sig` it produces a huge value matching no
canonical id, i.e. a trap rather than a confusion. **[I, arithmetic over measured addresses; not
fired.]**

**Mode 3 — value chosen, address not.** `RELEASE_WRITE_INT32_FIELD(*old, kLengthOffset, new_length)`
writes the page's own grow argument, but at `decompress(*(u32*)(dt_elems+4K)) + 4`. So the page must
find a word *already in the window* that decompresses to `field − 4`. The harness surveys all 22
fields of the confirmed table against every committed word in the ±2 GiB window:

```
    entry[0].target.lo : need W in {0x000423ac,0x000423ad} -- NONE present in the window
    entry[0].sig       : need W in {0x000423b8,0x000423b9} -- NONE present in the window
    ... (22 fields)
    => 0 usable mode-3 aiming words for 22 fields
```

**0 for 22, in 4/4 runs.** [M]

And for `target` specifically there is a second, independent block that no aiming word would fix
[P]: `EnsureMinimumDispatchTableSize` early-returns on `old->length() >= minimum_size`, and with
`old = target_addr − 4` that read *is* the current target low half — measured ~`0x007d1000`
(≈ 8.2×10⁶) to `0x49481000` (≈ 1.2×10⁹) — against `minimum_size ≤ kV8MaxWasmTableSize = 10 000 000`
(`wasm-limits.h:57`). In the runs measured here the low half exceeded that bound, so the write is
skipped entirely.

**⇒ The honest position: the field is steerable, and A4 is not the thing that steers it.**

## 8. Carried forward

* **Burst firing — [P] only, still not measured.** `WasmTableObject::Grow` iterates the *forged*
  `uses` array, and that array is an ordinary JS array the page builds
  (`for (i = 0; i < uses->length(); i += TableUses::kNumElements)`, the `DCHECK` on its length being
  a multiple of 2 compiled out in release). So `[winst,K1,winst,K2,…,winst,Kn]` should drive **n
  out-of-cage writes with n independently chosen indices from a single `grow()` call** — a stronger
  statement than "fire A4 twice", and the shape a steering chain would need. **Not fired in W50**;
  it requires the full W35+W43 chain, which this note deliberately did not run.
* W35's `arbRead64` allocates (`bitsOf`) — allocation-free helpers only inside any burst. Unchanged.
* The `sig` route is the one to develop next if this line is continued: it is value-cheap, needs no
  address disclosure, and is a type confusion rather than a control-flow edit. Its blocker is the
  same one §7 measures — mode-3 aiming.

## 9. Artifacts

`scratch/w50/`:
* `w50steer.c` / `.exe` (`build.bat`, `/guard:cf`, `DllCharacteristics = 0xc160`, byte-identical to
  `QtWebEngineProcess.exe`) — locate by fingerprint, classify by map word, survey, write, re-dump.
  Modes: `0` observe only, `1` target then sig, `2` sig only, `3` target only.
* `w50-steer.html` — the observer page (no primitive; only in-bounds `call_indirect`).
  `w50-steer-hot.html` — the tier-up variant.
* `w50run.py` (one fresh port per run, beacons timestamped on the harness's own time origin),
  `batch50.py`, `agg50.py`.
* `w50steer-<port>.log` × 16 (9413, 9421, 9431–9437, 9451–9459, 9471, 9481, 9491–9495),
  `run<port>.txt` (beacon streams), `w50beacons-<port>.txt`, `w50anchors-<port>.json`,
  `batch-m0.jsonl`, `batch-m1.jsonl`.

No third-party exploit code was downloaded or run; the wasm modules and the trigger logic are
written from the pinned V8 source. Only harness processes were started or stopped; the live product
was never touched. Everything is loopback, one fresh port per run.
