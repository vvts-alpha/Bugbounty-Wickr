# W53 — the anchor is FIRED, and the code range turns out to be COMPUTABLE, not searchable

Written 2026-08-06. Answers the two things W52/W52b left open: *does the page-side read actually
work?* and *is the 16 GiB pool at a fixed delta from the cage base, or does it float?*
Every line **[M] measured** on the shipped AWS Wickr desktop (Qt WebEngine 6.9.2, Chromium base
130.0.6723.192, declared 139.0.7258.67) unless marked **[I] inferred**.
Harness / logs / CSVs: `scratch/w53/`.

**An exploit primitive WAS fired this wave** — W35's in-cage `arbRead64`, against a harness process
on loopback. The live product was never touched (the `WickrPro.exe` / `QtWebEngineProcess.exe` pair
from 2026-08-05 14:41 were left alone). **Code execution remains NOT achieved, and nothing in this
wave attempts it.**

---

## 0. Bottom line

| question | answer |
|---|---|
| Does `arbRead64(0x58)` actually return the cage base from the page? | **YES — fired, 7/7 byte-exact vs blind ground truth. [M]** §1 |
| Is the 16 GiB pool at a fixed delta from `cage_base`? | **Neither fixed nor floating — it is COMPUTABLE. 16/16 predict-then-test, two workloads. [M]** §2 |
| Does a wrong probe fault? | **Yes, fatally, at both levels. Fired 3/3, byte-exact attribution. [M]** §3 |
| Is the code range reachable now? | **Computable from a fired anchor — but the reading primitive is NOT fired.** §4 |
| Net effect on V8 issue 421403261 | **Both unknowns are now expressible in closed form. Neither out-of-cage read has been fired.** |

> ### ⚠ Read together with the concurrent session
> `desktop/notes/W53-dll-base-from-outside-the-cage.md` (memory:
> [[w53-dll-base-computable-from-cage-base]]) ran the **same wave number in parallel** and reached
> §2's formula independently at **28/28**, with a **source-level derivation** this note does not
> have. **It fired nothing.** This note's unique contribution is the opposite half: **§1 and §3b are
> fired**. Where the two overlap (§2, §3a) they agree; where they differ, prefer theirs on *why* the
> pool is where it is and this one on *what the page actually did*. Three of its findings are folded
> in below and marked as theirs: the `[P]` identification (§2b), the **ArrayBuffer precondition**
> (§2d — which materially qualifies §2's run counts, including this note's), and a third measured
> value for the `+0x1030` slot (§2c).

> ### The two findings
> **1. The anchor fires.** `cage_base = arbRead64(0x58) & ~0xFFFFFFFF`, page-side, on the shipped
> build. Seven runs, seven distinct cage bases, every one byte-exact against a ground truth the page
> was never given. W52's `[I]` is now `[M]`.
>
> **2. There is no lottery.** W52b framed the pool as "1 of 4 slots, not known a priori, a wrong
> probe may be fatal". Both halves are now settled and they point opposite ways: the wrong probe
> **is** fatal (§3), and it **never has to be taken**, because
> `pool_base = (cage_base + 16 GiB) & ~(16 GiB − 1)` — predicted before looking, **16/16** across two workloads, across
> all four possible residues of `cage_base mod 16 GiB`.

---

## 1. Step 0 — FIRED [M]

### 1a. Method, and why the comparison is blind

`w53fire.exe` loads Qt WebEngine **in-process** (`--single-process`), points a `WebEngineView` at
`http://127.0.0.1:PORT/`, and runs a worker thread that derives the true cage base **by content**
from a marker string the page plants (`W53CAGEMARK_…`, a flat `SeqOneByteString`, located by its
length word at −4). The page beacons the value **it** recovered; the harness writes its ground truth
to `w53fire-PORT.json`; the Python runner compares them **after the run**. The harness never serves
the page anything but the page. So the match is not a page checking its own arithmetic.

The page is W35's `p37-helpers.html` **verbatim** through phase A and FIRE 1. Three additions, each
forced by a measured W35 constraint:

* the marker is planted **before** `S` — W35 §2 says nothing may be allocated *between* `S` and
  `near`; before `S` is fine, and the leak rate bears that out;
* the eleven results are read into **preallocated** `Uint32Array`s, and `bitsOf()` is **inlined**,
  because it returns a fresh array — i.e. it allocates, and W35 §7 says an allocation while
  `vic.elements` points at a non-`FixedDoubleArray` risks a `CHECK` at the next safepoint;
* two post-groom fires only (FIRE 1 overlap, FIRE 2 park), inside W35's measured ≤3 bound.

### 1b. Result — 7/7 byte-exact, 7 distinct cage bases

| port | page `cageHi` from `arbRead64(0x58)` | harness ground truth | verdict |
|---|---|---|---|
| 9801 | `0x1ef` | `0x1ef00000000` | MATCH |
| 9803 | `0x165` | `0x16500000000` | MATCH |
| 9805 | `0x206` | `0x20600000000` | MATCH |
| 9807 | `0xff`  | `0xff00000000`  | MATCH |
| 9809 | `0x242` | `0x24200000000` | MATCH |
| 9811 | `0x8c`  | `0x8c00000000`  | MATCH |
| 9931 | `0x22c` | `0x22c00000000` | MATCH (probe page's control read) |
| 9813 | — | `0x18b00000000` | **no value produced** — phase-A leak miss |

**7 of 8 end-to-end; the one failure produced no value at all**, not a wrong one: `addrofS=0x69`
(the undefined-oddball miss W35 documents by name), `consistent:false`, safety-rejected before the
chain started. That is W35's own failure mode and rate (p37: 4/5), unchanged.

### 1c. All eight offsets, byte-exact against the harness dump

Every successful run returned the same low halves — **build constants** — with only the high half
tracking that run's cage base:

```
  page 0x40      -> 0x0:0x40000        harness 0x0000000000040000   size_
  page 0x48      -> HI:0x40000         harness 0x000001ef00040000   area_end_  = page + size_
  page 0x50      -> 0x0:0x0            harness 0x0000000000000000
  page 0x58      -> HI:0x68            harness 0x000001ef00000068   area_start_ = page + 0x68   <-- ANCHOR
  page 0x1c0048  -> HI:0x1d2000        harness 0x000001ef001d2000
  page 0x1c0058  -> HI:0x1c0068        harness 0x000001ef001c0068
  page 0x280048  -> HI:0x295000        harness 0x000001ef00295000
  page 0x280058  -> HI:0x280068        harness 0x000001ef00280068
```

Primitive controls passed in every successful run (`S.{data,length}` = `0x41414141:0x100`;
`near.backing[0..1]` = `addrofS:addrofB`; `near.backing[2..3]` = `addrofS:addrofS`; `B` restored).
Without those a matching `cageHi` would prove nothing.

### 1d. ★ This widens W52's claim: the anchor survives a 15× bigger heap [M]

W52 §8 explicitly declined to claim `+0x1c0058` / `+0x280058` stable, because all 18 of its runs used
a light recon page (5.98 MiB committed in-cage). The exploit page here commits **90.4–91.2 MB in 8
regions** — ~15× more, with 24 000 sprayed arrays and repeated forced GC. All four offsets held, and
`rep1OK` / `rep2OK` were true in **6/6**. Still **not** a claim about the product's own heap, which
is larger again and differently shaped; but the two offsets W52 flagged as layout-dependent survived
the largest workload change measured so far.

---

## 2. Step 1 route (a) — the pool position is computable, and the mechanism is visible [M]

### 2a. Predict-then-test, 16/16

`w53.c` **logs the prediction before it looks**, and enumerates every ~16 GiB `MEM_PRIVATE`
reservation in the process so that "there were several and the fitting one was picked" is excluded
(there are exactly **3**, and the predicted one is unambiguous in every run).

Run in **two workloads**: the light recon page (11 runs, ~6 MiB in-cage heap) and the exploit page
(5 runs, ~90 MB). That second workload is the point — see defect 10.

| | light (11) | exploit page (5) | total |
|---|---|---|---|
| `pool_base = (cage_base + 16 GiB) & ~(16 GiB − 1)` | 11/11 | 5/5 | **16/16**, 16 distinct cage bases |
| residues of `cage_base mod 16 GiB` observed | 0, 4, 8, 12 | 0, 4, 8, 12 | **all four, in both** |
| resulting deltas above the cage base | 16, 12, 8, 4 | 16, 12, 8, 4 | **all four, in both** |
| `read64(pool+0x1000) − 0x0b4ccac0` == true `Qt6WebEngineCore.dll` base | 11/11 | 5/5 | **16/16** |
| every committed super-page metadata page `pool + k·2 MiB + 0x1000` | 22 ok / 0 bad | 5 ok / 0 bad | **27 / 0** |
| code range == `dll_base − 0x21930000` == `0x7ffdb6c00000` | 11/11 | 5/5 | **16/16** — W48's constant holds |

The concurrent session reports **28/28** for the same formula on its own harness, plus 11/11 from
re-analysing W52b's logs. Two independent implementations, ~44 runs, no disagreement.

The four observed deltas are **exactly W52b's four slots** `{4, 8, 12, 16}` GiB. The formula does not
merely fit them, it **explains** them — so W52b's "the 4 GiB slot is not known a priori, 4 candidates"
is superseded: the slot is a function of a value the page can now read.

### 2b. Why it is not a numeric coincidence — the padding is visible [M]

The reservation chain from the cage base is contiguous for 1056 GiB in 5–6 separate private
reservations, and the gap between the cage top and the pool is filled by a **padding reservation of
exactly the size alignment requires**:

| run | `cage_base mod 16 GiB` | cage | padding reservation | pool |
|---|---|---|---|---|
| 9919 | 12 GiB | 4 GiB | *none — cage top already 16 GiB-aligned* | cage+4 GiB |
| 9903 | 4 GiB | 4 GiB | **8 GiB** | cage+12 GiB |
| 9909 | 0 GiB | 4 GiB | **12 GiB** | cage+16 GiB |

So the rule is *"reserve the 16 GiB pool at the first 16 GiB-aligned address at or above the cage
top, and pad the gap"*. Because `cage_base` is 4 GiB-aligned and the cage is 4 GiB, that is
algebraically identical to the formula for every residue — including `r = 12`, where the cage top is
already aligned and the padding is zero.

From this note's measurements alone, identifying the pool would be **[I]** (a 2 MiB super-page stride
with metadata at `+0x1000` is the signature). **The concurrent session settles it from source [P]:**
it is PartitionAlloc's **ConfigurablePool — Blink's ArrayBuffer partition** — allocated *inside* the
V8 sandbox by `AllocatePages(hint 0, size 16 GiB, alignment 16 GiB)` (`gin/v8_initializer.cc:566`),
immediately after the 4 GiB cage, which `isolate-group.cc:88-91` `CHECK_EQ`s to the sandbox base.
**Alignment == size is what forces the round-up** — i.e. the padding measured above is the
allocator's own alignment slack, and the formula is the allocation contract, not a fitted curve.

### 2c. ★ Correction to W52b — one of its two "13/13 build constants" is workload-dependent [M]

W52b reported `pool+0x1030 → Qt6WebEngineCore.dll+0x0b4cd258` in **13/13** runs. Measured here:
`pool+0x1030 → DLL+0x0b4cd9d8`, and the W52b value is **0/16** across both workloads. W52b's 13 runs
were 13 runs of **one page**; the offset tracks the workload, not the build.

The concurrent session reaches the same correction and names the field: `+0x1030` is
`SlotSpanMetadata::bucket`, which **moves with allocation size** — it measured a *third* value
(`DLL+0xb4ccb08`) on a third page, and generalises the point to all 110 of W52b's other offsets.
Only **`pool+0x1000 → DLL+0x0b4ccac0`** (`PartitionSuperPageExtentEntry::root`) is invariant.
**A chain keyed on `+0x1030` would break.** (See defect 10 in §6 — this is a methodological failure,
not just a wrong number.)

### 2d. ⚠ The precondition this note's own numbers cannot see [M, theirs]

The concurrent session measured what this one could not: **with a page that allocates no
ArrayBuffer, the pool has zero committed pages (4/4) and the read at `pool+0x1000` is a fatal
`0xC0000005`.** One `new ArrayBuffer(8)` suffices (4/4).

**Both workloads used here allocate ArrayBuffers** — the light page 50 × `ArrayBuffer(65536)` plus
100 `Float64Array`, the exploit page its `Float64Array`/`Uint32Array`/`Uint8Array` scratch buffers.
So **16/16 above is 16/16 *given the precondition*, and says nothing about whether it holds
without.** Never state the pool anchor as unconditional. An exploit page allocates typed arrays
anyway, so this is setup rather than a barrier — but it is a real precondition and it was invisible
to this note's design.

---

## 3. The wrong probe is fatal — measured twice, at two different levels [M]

### 3a. OS level, harness-side (`w53.c` P6)

| target | result |
|---|---|
| reserved-but-uncommitted (inside the 16 GiB pool) | `0xC0000005` ACCESS_VIOLATION |
| FREE / unmapped | `0xC0000005` |
| `PAGE_NOACCESS` | `0xC0000005` |
| `PAGE_GUARD` | `0x80000001` GUARD_PAGE_VIOLATION — and **one-shot**: the second read of the same page succeeds |

The concurrent session measured this independently and agrees line for line, including the point
that the first three **do not differ** — so a probe cannot use the fault code to tell "reserved" from
"unmapped". Only `PAGE_GUARD` is distinguishable, and only once.

### 3b. ★ Primitive level, FIRED, 3/3 — and the attribution is byte-exact

The question that actually matters is what happens to *the primitive we hold*. `w53-probe.html` is
stripped to three control reads, one anchor read, and then **one** read at a chosen offset, so a
crash can only come from that read; the harness VEH logs the faulting PC and the faulting **data**
address.

| port | `cage_base` | probe | faulting data address | = `cage_base + probe`? |
|---|---|---|---|---|
| 9933 | `0x23a00000000` | `0x40000000` | `0x23a40000000` | **yes** |
| 9935 | `0x11400000000` | `0x40000000` | `0x11440000000` | **yes** |
| 9937 | `0x1f600000000` | `0x40000000` | `0x1f640000000` | **yes** |

`0xC0000005`, same faulting PC every time (`Qt6WebEngineCore+0x26f3cd5`), process exit
`0xC0000005`, and the beacon stream stops **exactly** after `PROBE-ARMED`. Negative control at the
committed offset `0x58` survives and returns the correct value (port 9931, §1b).

**Two conclusions, and the second is the more useful one:**

1. There is no safe rejection. **Searching with this primitive is not available** — one wrong probe
   ends the renderer. Since §2 removes the need to search for route (a), this is not blocking there,
   but it closes "just scan for it" as a fallback anywhere.
2. The fault address is `cage_base + offset`, which **directly demonstrates the confinement**:
   `arbRead64` writes a 32-bit value into a *compressed* `elements` field, so its reachable set is
   exactly `[cage_base, cage_base + 4 GiB)`. **W35's read structurally cannot reach `pool+0x1000`,
   which lies above the cage top.** That is not a limitation of aim; it is the address width.

---

## 4. Where the chain actually stands — what is fired and what is not

```
  step 1   cage_base  = read64(cage+0x58) & ~0xFFFFFFFF        FIRED    [M]  7/7   §1
  step 2   pool_base  = (cage_base + 16G) & ~(16G-1)           arithmetic [M] 16/16 §2
  step 3   dll_base   = read64(pool+0x1000) - 0x0b4ccac0       NOT FIRED  [M as data] §2a
  step 4   code_range = dll_base - 0x21930000                  arithmetic [M] 16/16 §2a
```

`w53.c`'s P8 runs all four end-to-end using only values the page could obtain and checks each
against ground truth: **all four agree, 16/16**. But **step 3 is a harness read standing in for an
out-of-cage read that was not fired**, and §3b shows W35's primitive cannot be that read. Step 3
still requires W42's ladder or 421403261's own read.

So the honest statement of the change: W49's `k = (code_range − cage_base) >> 32` had two unknown
terms and ≥824 candidates. **Both terms are now closed-form functions of one value the page can read
today.** The remaining gap is not knowledge — it is a single out-of-cage read, at
`cage_base + {4,8,12,16} GiB + 0x1000`, which is 4–16 GiB above the cage and therefore ~350× inside
W42's demonstrated ladder — **but W42 has never been fired at that distance ([I], carried unchanged
from W52b).**

Two reachability notes from the concurrent session, both **[I], nothing fired**: W42 needs only
~4–5 slices for a 4–16 GiB target (against its demonstrated 261- and 1025-hop runs), making it the
cheap route; and 421403261's own read needs the target super page `k ≥ 1`, so **one** ArrayBuffer
(one super page) is *not* enough for it — roughly 3 MiB of ArrayBuffers is. That interacts with §2d:
the two candidate primitives have *different* setup requirements on the same anchor.

---

## 5. Honest boundaries

* **Code execution remains NOT achieved**, and no step toward it was attempted.
* Only **step 1** was fired. Step 3 is measured as data and unfired as a capability; steps 2 and 4
  are arithmetic on measured constants.
* **§2's 16/16 is conditional on the page having allocated at least one ArrayBuffer** (§2d). Both
  workloads here did, so this note cannot see the failure mode; the concurrent session measured it
  (4/4 fatal AV without one). Do not quote 16/16 as unconditional.
* Constants `0x0b4ccac0` and `0x21930000` are **per-build**, and `+0x1030` is not a constant at all
  (§2c). The formula in §2a is a consequence of an allocation contract; the *offsets* are not.
* Route **(b)** (W52's C++ arena at +1.23–1.56 TiB, where W42 *has* fired byte-exact) was **not
  touched this wave**. Route (a) now looks better because its position is computable, but route (b)
  retains the only firing record at any out-of-cage distance. That trade is unresolved.
* The DLL base was `0x7ffdd8530000` in all 11 runs — **same boot**. The per-boot scope claim is
  inherited from W52b §5 (n = 2 boots), not re-established here.
* One machine, one boot, one page family. §1d widens W52's heap-size caveat but does not remove it:
  the product's own heap was not tested.
* The `PAGE_GUARD` one-shot behaviour (§3a) is OS semantics measured in the renderer process.
  Whether a fault taken inside wasm code is swallowed depends on the faulting PC being in V8's
  protected-instruction list — W49 measured an explicit `cmp`/`jae` trap stub on that access, so it
  is not protected. **Not fired.**
* Identifying the 16 GiB reservation as PartitionAlloc's configurable pool is **[I]**.

---

## 6. Tooling defects — an 8th, 9th and 10th, on top of W47 §0's three, W50's fifth, W52's sixth and seventh

8. **Never take the first non-image executable region as the V8 code range.** `w53fire.c`'s own
   walk latched onto the first non-image exec `AllocationBase` it met while ascending — a 64 KiB
   RWX region *below* the cage (e.g. `0x1e69f7d0000`) — and never restarted, reporting a code range
   that was off by 128 TiB. It was caught only because it disagreed with W48's constant, which
   `w53.c`'s P7 then confirmed 16/16 by enumerating **all** such reservations and selecting by size.
   A walk that reports the first match is not a locator.
9. **Do not annotate a fault with a delta from a global the fault may precede.** The first VEH
   printed `(cage+0)` for the probe crash, because the marker scan had not yet resolved
   `g_cage_base` when the page faulted — which reads as *"faulted at the cage base"*, the exact
   opposite of the truth. Print the absolute address, and say explicitly when the base is unknown.
10. **★ Reproducibility across runs of ONE page is not reproducibility.** W52b's own rule —
    "filter by reproducibility across distinct bases, never by count" — is necessary but *not
    sufficient*: 13 runs of one page share a workload, so a workload-dependent offset passes it
    cleanly and is reported as a build constant (§2c). The filter has to be reproducibility across
    **distinct workloads as well as distinct bases**. This wave ran two workloads that differ ~15×
    in committed heap; that is what separated the real invariant (`+0x1000`) from the false one
    (`+0x1030`). The concurrent session reached the same defect from three pages *and* from source,
    which is the stronger form: **the only durable test of an offset is what the code says it is.**
    Two independent lines finding the same false constant in W52b is itself the evidence that
    run-count is the wrong currency.

Carried and re-confirmed: W35's `arbRead64` allocates (hence the preallocated arrays and inlined
`bitsOf` in §1a); trusted-cage objects are 4-aligned; `local.set` of an `i32.const` emits no Liftoff
code and this build compiles wasm lazily; a shared hit-recording array re-creates the bucketing
defect; `MEM_IMAGE` must be scanned; in a compressed heap alignment does not discriminate;
`cmd //c "build.bat …"` from git-bash silently fails — use `.\build.bat` from PowerShell.

---

## 7. Artifacts

`scratch/w53/`

* `w53fire.c` / `.exe` — Step-0 ground-truth harness (`/guard:cf`, matching `QtWebEngineProcess.exe`).
  Marker-based cage base, byte dump of all three chunk headers, attributing VEH.
* `w53-fire.html` — W35 p37 + the eight anchor reads, preallocated burst. `w53firerun.py` (blind
  comparison), `batchfire.py` (sequential, fresh port per run).
* `w53-probe.html` — the minimal wrong-probe page, `__PROBE__` substituted per run.
* `w53.c` / `.exe` — the predict-then-test recon harness (P0–P8), written by the preceding session
  and run here. `w53run.py`, `batch53.py`.
* Per run: `w53fire-<port>.{log,json,out}`, `w53-<port>.{log,out}`, `w53sum-<port>.json`.
* Ports used: fire 9801–9813, probe 9931–9937, recon 9901–9921 (light) and 9941–9949 (exploit-page
  workload). One at a time, fresh port each, loopback only, harness processes only.
