# W54 — step 3 is FIRED: the DLL base is recovered by an OUT-OF-CAGE read, and the chain closes on paper

Written 2026-08-06. Fires the one step W53 left unfired: `dll_base = read64(pool_base + 0x1000)
− 0xb4ccac0`, at an address **4–16 GiB above the cage base**, i.e. outside the 4 GiB
pointer-compression cage. Every line **[M] measured** on the shipped AWS Wickr desktop (Qt WebEngine
6.9.2, Chromium base 130.0.6723.192, declared 139.0.7258.67) unless marked **[I] inferred** or **[P]
public source at the pin**. Harness / pages / logs: `scratch/w54/`.

**Two exploit primitives WERE fired this wave** — W35's in-cage `arbRead64` and W42's out-of-cage
SlicedString read — against a harness process on loopback. The live product was never touched
(`WickrPro.exe` 13184 / `QtWebEngineProcess.exe` 5104, started 2026-08-05 14:41, confirmed unchanged
afterwards). **Code execution remains NOT achieved, and nothing in this wave attempts it.**

---

## 0. Bottom line

| question | answer |
|---|---|
| Did the out-of-cage read land? | **YES. `dll_base` byte-exact vs the harness's MODULE LIST. [M]** §2 |
| Hit rate | **8/8 of the runs that produced a value — zero wrong values in 20 runs.** End-to-end **8/20**; **8/11** on the workloads that can run at all. §3 |
| Which tool fired it? | **W42** (crbug 519768343 SlicedString offset overflow), **4–7 forged slices**. §2b |
| Did the other one (421403261) also work? | **NOT ATTEMPTED — its gate is still unfired.** Its *reachability* precondition is now measured, not inferred. §5 |
| Is `code_range = dll_base − 0x21930000` confirmed against the region map? | **YES, 8/8 page-side and 17/17 harness-side, 512.000 MiB RWX at `0x7ffdb6c00000`. [M]** §4 |
| Net | **Every input to V8 issue 421403261 is now a value the page has demonstrably read or computed. The chain is complete on paper.** §6 |

> ### The finding
> A page holding only CVE-2026-11645 reads `cage+0x58` to get `cage_base`, computes
> `pool_base = (cage_base + 16 GiB) & ~(16 GiB − 1)`, forges a 4–7-hop `SlicedString` chain aimed at
> `pool_base + 0x1000`, and `charCodeAt`s back the eight bytes of
> `PartitionSuperPageExtentEntry::root` — a **raw 64-bit pointer into `Qt6WebEngineCore.dll`**. All
> eight runs that got past W35's phase-A leak recovered the true DLL base byte-exactly, over eight
> distinct cage bases. **W53's step 3 is no longer a harness load standing in for a primitive; it is
> the primitive.**

---

## 1. Method — why the comparison is blind, and what the page was and was not given

`w54.exe` loads Qt WebEngine **in-process** (`--single-process`, so renderer memory == harness
memory), serves `w54-read.html` from a fresh loopback port, and independently derives:

* `cage_base` **by content**, from the parent string the page plants, located by its length word at
  −4 (W49 defect 3: a raw content hit can be a C++-heap copy of the page source);
* **`Qt6WebEngineCore.dll`'s base from the module list** (`GetModuleHandleA` +
  `GetModuleInformation`) — this is the ground truth the deliverable is graded against;
* `pool_base`, **logged as a prediction before the first `VirtualQuery` about the region**, then
  checked against the observed `AllocationBase`, with every ≥8 GiB reservation in the process
  enumerated so that "there were several and the fitting one was picked" is excluded;
* the true qword at `pool_base + 0x1000`, and the code range by full enumeration.

The harness writes this to `w54-PORT.json`. **The HTTP server has exactly two behaviours: serve the
page bytes, and swallow `/r?` beacons.** There is no endpoint that could return ground truth. The
comparison happens in `w54run.py` *after* the page has beaconed.

**What the page WAS given:** two per-build constants compiled into it — the anchor RVA `0xb4ccac0`
and the code-range delta `0x21930000`. Both are recoverable offline from the shipped DLL (W53 §6c
verifies the first statically in the PE). **What it was NOT given: any runtime address.**

★ **The strongest form of the result needs no constant at all.** The page reports the **raw anchor
qword** it read, before any subtraction. That value — `0x7ffde39fcac0` — matched the harness's dump
of `pool_base + 0x1000` byte-exactly in 8/8 runs. `dll_base` is that number minus a build constant;
the *reading* is what was demonstrated.

### 1a. One page, two structurally different primitives — which is itself the argument

The same page performs both reads. `rd64(A)` (W35) takes a **uint32** `A` and writes it into a
*compressed* elements field, so its reachable set is exactly `[cage_base, cage_base + 4 GiB)` —
W53 §3b fired a probe at `cage+0x40000000` and got a fatal `0xC0000005` whose faulting data address
was that run's `cage_base + 0x40000000` byte-exact, 3/3. **The page that recovered `pool+0x1000`
therefore could not have done so with its own in-cage primitive**; the out-of-cage value came from
`slices[0].charCodeAt(k)`, whose offset accumulator is 64-bit. The two primitives sitting side by
side in one page is the cleanest available demonstration that the confinement is real and that the
second read genuinely left the cage.

---

## 2. The read — FIRED [M]

### 2a. Result: 8/8 byte-exact, across all four delta slots

**20 runs**, one at a time, fresh port each, **workload varied per run** (W53 defect 10). Every run
that produced a value:

| port | WL | delta | `cage_base` | `comp` | M | super | page `dll_base` | truth (module list) | |
|---|---|---:|---|---|---:|---:|---|---|---|
| 9611 | 0 | 4 GiB | `0x23700000000` | `0x148764` | 4 | 1 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9613 | 1 | **16 GiB** | `0x28000000000` | `0x148764` | 7 | 2 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9619 | 0 | 4 GiB | `0x2bf00000000` | `0x14a08c` | 4 | 1 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9621 | 1 | **8 GiB** | `0x3b600000000` | `0x148764` | 5 | 2 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9623 | 2 | **12 GiB** | `0x10900000000` | `0x148764` | 6 | 6 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9651 | 1 | **8 GiB** | `0x27200000000` | `0x1488c0` | 5 | 2 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9663 | 1 | **8 GiB** | `0x24200000000` | `0x1488c0` | 5 | 2 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |
| 9667 | 2 | 4 GiB | `0x3ab00000000` | `0x14a1e8` | 4 | 6 | `0x7ffdd8530000` | `0x7ffdd8530000` | **EXACT** |

**8 distinct cage bases, 4 distinct `comp` values, all four residues of `cage_base mod 16 GiB`** — so
all four of W52b's delta slots {4, 8, 12, 16} GiB were fired, not just the nearest one, and the read
was aimed as far as **16 GiB above the cage base**. In every successful run **five** quantities
matched: `cage_base`, `pool_base`, the raw anchor qword, `dll_base`, and `code_range`.
`faults = 0` in all eight, and the renderer survived to `hb = 240` — a landed read, not a fault
misread as one.

**Zero wrong values in 20 runs.** Every non-productive run failed *before* the read and produced
nothing (§3).

Harness-side, independently of whether the page got that far: the **predict-then-test pool formula
held 18/18**, over **18 distinct cage bases**, with residues of `cage_base mod 16 GiB` spread
`{0: 4, 4: 5, 8: 4, 12: 5}`. Added to W53's 44, that is **62/62** for
`pool_base = (cage_base + 16 GiB) & ~(16 GiB − 1)` across three independent harnesses.

### 2b. The tool: W42, at 4–7 hops

`T = pool_base + 0x1000 − (cage_base + comp)` where `comp = (addrof(P) − 1) + 12` is P's char data.
Built as `D−1` hops of `0xFFFFFFFF` plus a 32-bit tail in ≤`0x3FFFFFFF` chunks — **4 to 7 slices**,
against W42's demonstrated **261-hop** guard-region firing and **1025-hop** ladder. The brief's
estimate of ~4–5 slices was right.

### 2c. Three things that make the result hard to explain any other way

1. **The `+0x1008` field.** The read returns 32 bytes, so it also picks up the next-super-page
   pointer. In the single-super-page run it is **exactly 0** (9611); in multi-super-page runs it is
   `pool + 0x201000` (9613, 9621) or `pool + 0x601000` (9623) — **a pointer whose high half is the
   pool base**. Nothing in the cage encodes that, and W53 §6a predicts precisely this split.
2. **`comp` is recomputed, not constant.** Run 9619 drew `comp = 0x14a08c` where the others drew
   `0x148764`, and the harness's independent marker scan reported the same changed value. The aim
   tracked it and the read still landed.
3. **The anchor value is not in-cage-derivable.** `0x7ffde39fcac0` is a raw absolute pointer; W49
   measured **0** in-cage copies of any absolute address, 3 runs.

Byte dump, port 9623 (6 super pages), page vs harness:

```
  page   : c0ca9fe3fd7f0000 001060000c010000 01000f0000000000 0000000000000000
  harness: pool+0x1000 = 00007ffde39fcac0  -> Qt6WebEngineCore.dll + 0xb4ccac0
           value - 0xb4ccac0 = 0x7ffdd8530000  == TRUE DLL BASE (module list)
```

---

## 3. The twelve misses — all page-side, all before the read, none a wrong value

| outcome | n | where it fails |
|---|---:|---|
| produced a value (**all byte-exact**) | **8** | — |
| W35 phase-A leak miss, safety-rejected | 9 | before the chain starts |
| died in the FIRE-1 burst | 3 | before the read |

by workload:

| WL | in-cage ballast | ArrayBuffers | n | value | leak miss | burst death |
|---|---|---|---:|---:|---:|---:|
| 0 | none | 1 × 8 B | 2 | **2** | 0 | 0 |
| 1 | 8 MiB post-leak | 150 (~3.3 MiB) | 5 | **4** | 1 | 0 |
| 2 | 24 MiB post-leak | 32 (~7.3 MiB) | 4 | **2** | 2 | 0 |
| 3 | 64 MiB post-leak | ~50 MiB | 2 | 0 | 0 | **2** |
| 4 | none | ~50 MiB | 2 | 0 | 1 | **1** |
| 5 | 64 MiB **pre-S** | ~50 MiB | 5 | 0 | **5** | 0 |

**On the workloads that can run at all (WL 0/1/2): 8 of 11 = 73%** — which is W35's phase-A leak
rate, not a property of the out-of-cage read. Every one of the 8 that got past phase A read
correctly.

**The 9 leak misses are W35's documented phase-A failure**, with its named signatures:
`addrofS = 0x69` (the undefined-oddball miss), `addrofB = 0x280` / `0x3000` (even, so the tag check
rejects), `addrofS = addrofB = 0x0`. All are `consistent:false`, safety-rejected **before the chain
started**: no forge, no read, renderer survives, `faults = 0`. Never a wrong value.

**Ports 9617 / 9625 / 9645 — a page-construction defect of mine, and it is worth carrying.** All
three died with a **write** access violation at a tiny cage offset (`cage+0x794` ×2, `cage+0x1003`),
**same PC** (`Qt6WebEngineCore+0x1b32316`), with `ALLOC` as the last beacon — i.e. **in the FIRE-1
burst, long before the read**. The leaked values (`nearElem`, `emptyFA`, `addrofB`) are captured
before the workload is allocated; a large enough allocation relocates the objects they name, and
`setElements(addrofB)` then writes through a stale compressed pointer into the bottom of the cage.

★ **WL=4 isolates the variable: it is the ArrayBuffers, not the in-cage ballast.** WL=3 allocates
50 MiB of ArrayBuffers *and* 64 MiB of in-cage ballast post-leak; WL=4 allocates the same
ArrayBuffers and **zero** ballast — and dies identically (`abCount:224, ballastMiB:0`, then the same
faulting PC). So ~50 MiB of *external* allocation is by itself enough to break the primitive,
presumably via V8's external-memory pressure forcing a major GC that compacts old space. **[M], 3/3.**

★ **And moving the workload earlier does not rescue it — it breaks the other end.** WL=5 allocates
the same 64 MiB of in-cage ballast **before `S`**, which W53 §1a measured to be the one safe place
to allocate ahead of the groom. It **failed 5/5, every time in phase A** (`addrofS = 0x0` ×2,
`0x69` ×1, `addrofB = 0x280` ×2) — the ballast perturbs the very heap layout the p37 groom is tuned
for. So on this page there is **no** placement that survives a heavy workload: after the leak it
kills the burst (3/4), before `S` it kills the leak (5/5). **[M], 9 runs, 0 reached the read.**

⚠ **Attribution matters here.** None of these is a failure of the out-of-cage read; the read was
never reached in any of them. §7 states what it costs the workload coverage.

---

## 4. `code_range` — confirmed against the harness's own region map [M]

Page-side `code_range = dll_base − 0x21930000` matched the harness in **8/8**. Harness-side, in
**17/17** runs carrying the fixed locator (an 18th, port 9601, ran the pre-fix build — defect 11):

```
  [G5] 2 non-image reservations contain executable pages;
       LARGEST = 0x7ffdb6c00000  size 512.000 MiB  prot=RWX
  [G5] dll_base - code_range = 0x21930000  (expected 0x21930000)  MATCH
```

Same constant and same address as W48 (6/6) and W53 (16/16 and 28/28) — now also confirmed from a
page-side value rather than only from a harness one.

---

## 5. The other tool — 421403261's own read was NOT attempted, and why

**It was not fired, and nothing here claims it works.** Its blocker is not reach and not aim; it is
the **gate**. W49 measured all three confused `call_indirect` probes trapping with
`RuntimeError: null function or function signature mismatch` — the canonical type check held. Firing
its read first requires the non-final-type `call_indirect` plus an in-cage `set_supertype` write
(W49 §1c), which W49 and W50 both left unfired. That is a wave of work with a fatal failure mode,
and W42 had already delivered the deliverable.

What this wave *does* add is that its **reachability** precondition moves from [I] to [M]. W53 §8b
computed it from a recon page's `comp = 0x14330c`; these runs measure the **exploit page's own**:

```
    low = k*2 MiB + 0x1000 - comp - 0xb        must lie in [0, array.length)
    comp = 0x148764 (1.283 MiB), measured, identical in 5 of 6 runs
      k=0  low = 0xffeb8891 = 4094.7 MiB   > the 1073741811-byte engine limit  -> UNREACHABLE
      k=1  low = 0x000b8891 =    0.721 MiB -> a 0.721 MiB WasmArray suffices
```

and the committed super-page counts make it a **measured property of each workload**, not an
assumption:

| WL | ArrayBuffers | pool committed | super pages | max usable `k` | 421403261 could reach the anchor? |
|---|---|---|---:|---|---|
| 0 | 1 × 8 B | 0.020 MiB | **1** | 0 | **NO** |
| 1 | 150 (~3.3 MiB) | 3.344 MiB | 2 | 1 | yes |
| 2 | 32 (~7.3 MiB) | 7.375 MiB | 6 | 5 | yes |

So W53 §8b's "one ArrayBuffer is enough for W42 but not for 421403261" is now measured on both
sides: **WL=0 fired W42 byte-exactly with a single super page (2/2), and is exactly the case where
421403261 could not have reached the same qword.** That is a real capability difference between the
two candidate readers, not a preference — and it argues for W42 independently of which is easier to
build.

---

## 6. Where the chain stands

```
  step 1  cage_base  = read64(cage+0x58) & ~0xFFFFFFFF     FIRED  [M]  W53 7/7 + W54 8/8
  step 2  pool_base  = (cage_base + 16G) & ~(16G-1)        arithmetic [M] 44/44 + 17/17, and [P]
  step 3  dll_base   = read64(pool+0x1000) - 0xb4ccac0     FIRED  [M]  W54 8/8   <-- THIS WAVE
  step 4  code_range = dll_base - 0x21930000               arithmetic [M] 8/8 page, 17/17 harness
  step 5  421403261 write into a JIT page                  gate/reach/granularity [M], NEVER FIRED
  step 6  RWX + CFG all-valid + no bytecode verifier       [M] (W46)
```

**Steps 1–4 are now all page-side capabilities.** W49's `k = (code_range − cage_base) >> 32` had two
unknown terms and ≥824 candidates with a fatal AV per miss; it is now a closed-form function of one
value the page reads, and every term in it has been fired.

**The chain is complete on paper.** Steps 5 and 6 were not touched and step 5 has never been fired —
its own gate (the non-final-type `call_indirect` + `set_supertype` write) remains the unfired piece,
exactly where W49 and W50 left it. **Code execution remains NOT achieved.**

---

## 7. Honest boundaries

* **Code execution remains NOT achieved.** No step toward it was attempted. Both primitives fired
  here are **reads**.
* 8/8 is *of the runs that produced a value*; **8/20 end-to-end**, **8/11** restricted to workloads
  that can run. No miss produced a wrong value, but the end-to-end rate is the honest one to quote
  for a chain, and it is gated by W35's phase-A leak, which this wave did not improve.
* **The anchor is conditional on the page having allocated an ArrayBuffer** (W53 §5, 4/4 fatal AV
  without one). Every workload here allocates one, so **this wave cannot see that failure mode
  either**; WL=0's single 8-byte buffer is the smallest case tested and it worked. Never state the
  pool anchor as unconditional.
* `0xb4ccac0` and `0x21930000` are **per-build**; nothing here survives a Qt WebEngine update. Only
  `pool+0x1000` is invariant — W53 §6b's correction stands, do not use the other 110 offsets.
* **One boot** (2026-08-05 14:20), so `Qt6WebEngineCore.dll = 0x7ffdd8530000` throughout. The
  per-boot scope claim is inherited from W52b, not re-established. DLL-base entropy was not
  estimated and brute force is not claimed to be practical.
* One machine, one page family, recon/exploit pages under a harness-hosted Qt WebEngine — **not the
  product's own UI**, whose heap is larger and differently shaped.
* ⚠ **The workload variation is narrower than intended, and that is the main methodological gap.**
  The three heavy workloads (WL=3/4/5, 9 runs) **never once reached the read** — they fail by page
  construction, not by anything about the product. Workloads actually fired span **8 B – 7.3 MiB of
  ArrayBuffers (1–6 committed super pages) and 0 – 24 MiB of in-cage ballast**. So W53 defect 10's
  requirement — vary the workload, not just the run — is met, but over a ~900× ArrayBuffer range
  rather than the ~6000× intended. A page that can carry a 50 MiB workload through phase A and the
  burst has not been built.
* `comp` took only **4 distinct values** across 8 successful runs (`0x1488c0`, `0x148764`,
  `0x14a08c`, `0x14a1e8`), all within 7 KiB. The aim was re-derived every run and the harness
  confirmed each, but this is not a wide sample of parent placements.
* 421403261 was **not fired**. Its gate is unfired and this note makes no claim that it works.

---

## 8. Tooling defects — an 11th and 12th, on top of W47's three, W50's fifth, W52's sixth/seventh, W53's eighth–tenth

11. **★ A bounded group table is not an enumeration.** W53 defect 8 said a walk that reports the
    *first* match is not a locator. My first `find_code_range` had the sibling defect: a fixed
    64-entry `AllocationBase` table. The low heap filled all 64 slots before the walk ever reached
    the code range, and it reported **"0 non-image reservations contain executable pages"** — a
    confident zero, not an error. Caught only because W48's constant said otherwise. Close each
    group as its `AllocationBase` run ends; never accumulate into a fixed array.
12. **★ Gate on the invariant, not on the construction.** The aim built `T` as `D−1` full hops plus
    `rem32 = ((D-1) - r) >>> 0`, which silently drops a 2³² carry when `r ≤ D−1`. Unreachable for
    any real `comp` (≥ 1 MiB) — but **a wrong `T` is a fatal probe**, so "unreachable in practice"
    is not a safety argument. Caught by an **offline BigInt cross-check before anything fired**
    (15,360 cage_base × comp cases). The fix was not to patch the proxy condition but to gate on
    `Σ hops == D·2³² + 0x1000 − comp` — the thing that actually has to be true. Re-run: 0 failures.
13. **Where a workload is allocated is part of the workload.** Allocating 64 MiB in-cage *after* the
    phase-A leak but *before* FIRE 1 invalidates the leaked addresses and kills the renderer in the
    burst (2/2, write AV at `cage+0x794`). Varying "the workload" per W53 defect 10 means varying it
    somewhere the primitive survives — before S, per W53 §1a.

Carried and re-confirmed: W35's `bitsOf` allocates (hence the preallocated `RD`/`HOPS`/`SADDR`/`CTL`
arrays and the burst that returns nothing); `cmd //c "build.bat …"` from git-bash silently fails —
use `.\build.bat` from PowerShell; `tail -f` under git-bash does **not** see a file PowerShell is
writing through `*>` redirection, so a monitor armed on it stays silent while the run proceeds.

---

## 9. Artifacts

`scratch/w54/`

* `w54.c` / `.exe` — the blind ground-truth harness (`/guard:cf`, matching `QtWebEngineProcess.exe`).
  Marker-by-content cage base, module-list DLL base, predict-then-test pool, pool commit map, the
  true anchor qword, full non-image executable enumeration, attributing VEH. `w54.exe SECS PORT`.
* `w54-read.tmpl.html` — the page: W35 bootstrap → `rd64(0x58)` → computed `pool_base` → W42 forge →
  `charCodeAt` out-of-cage read. `__WL__` selects the workload.
* `w54run.py` (fresh-port server + blind comparison), `batch54.py` (strictly sequential, cycles the
  workload), `agg54.py` (cross-run table), `_aimtest.js` (the offline BigInt aim check).
* Per run: `w54-<port>.{log,json,out}`. Ports 9601, 9611–9625, 9641–9651. One at a time, fresh port
  each, loopback only, harness processes only.
