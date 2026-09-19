# W53 — the DLL base is recoverable from outside the cage, and its address is COMPUTED, not searched

Written 2026-08-06. Answers the question W52b left open: *is the 16 GiB reservation that holds the
`Qt6WebEngineCore.dll` pointers at a fixed delta from `cage_base`, or does it float within the
4–16 GiB band?* Every line **[M] measured** on the shipped AWS Wickr desktop (Qt WebEngine 6.9.2,
Chromium base 130.0.6723.192, declared 139.0.7258.67) unless marked **[I] inferred** or **[P] public
source read at the pinned ref**. Harness / pages / logs: `scratch/w53/`.

**Measurement only. No primitive was fired, nothing was written to the renderer, no code was
executed, the live product was never touched.** The harness is a `--single-process` Qt WebEngine
that reads its *own* process memory; every "read" below is an ordinary load by the harness thread,
standing in for a primitive that was **not** run. Harness processes only, loopback only, a fresh
port per run.

---

## 0. Bottom line

| question | answer |
|---|---|
| **Fixed delta, or floating?** | **Neither — it is a deterministic FUNCTION of `cage_base`.** `pool_base = (cage_base + 16 GiB) & ~(16 GiB − 1)`, **28/28 runs, 28 distinct cage bases**, plus 11/11 of W52b's own logs. **[M]**, and **[P]** derivable from Chromium/V8 source (§2b). |
| Does one read give the DLL base? | **YES.** `dll_base = read64(pool_base + 0x1000) − 0xb4ccac0`. No search, no candidate set. **24/24** runs that have the anchor; **1 608/1 608** super-page copies. |
| Does a wrong probe fault? | **YES — `0xC0000005`** for reserved-but-uncommitted, for free/unmapped, and for `PAGE_NOACCESS`. `PAGE_GUARD` gives `0x80000001` and is one-shot. **[M]**, previously unmeasured. |
| Which of the 4 slots, and is it stable? | **All four occur; `cage_base mod 16 GiB` decides which.** The page already knows `cage_base`, so the question dissolves — there is no lottery and no wrong probe to take. |
| Is the anchor free? | **NO — and this is the one new precondition.** With a page that allocates **no ArrayBuffer**, the pool has **zero committed pages**, 4/4 runs, and the anchor read is a fatal AV. One `new ArrayBuffer(8)` is enough. |
| End-to-end chain | **Simulated, all four steps agree with ground truth, 24/24 runs.** Harness loads standing in for primitives — **nothing was fired.** |
| Code execution | **STILL NOT ACHIEVED.** W53 fired nothing. |

> ### The finding
> The 16 GiB reservation is **PartitionAlloc's ConfigurablePool — the ArrayBuffer partition —
> allocated *inside* the V8 sandbox with alignment == size == 16 GiB, immediately after the 4 GiB
> pointer-compression cage.** Its base is therefore forced to the first 16 GiB boundary above the
> cage. Its first committed page is a PartitionAlloc super-page metadata page whose **first qword is
> `PartitionSuperPageExtentEntry::root`**, a raw pointer to a `PartitionRoot` global in
> `Qt6WebEngineCore.dll`'s `.data`. **[I] for the naming, [M] for every address and value, [P] for
> the allocation call that fixes the base.**

This converts W53's step 2 from "a 12 GiB search whose feasibility turns on whether a wrong probe
faults" into **one read at an address arithmetic already gives you**.

---

## 1. What was measured, and how it differs from W52b

W52b reported the reservation as sitting "a small multiple of 4 GiB above the cage base" with
"4 candidates observed ({4,8,12,16} GiB, mode 8 GiB at 7/13)" and marked the slot choice unknown.
That is the same data this note starts from — but read the other way round.

Two disciplines were imposed, because the formula was found by fitting W52b's data and a post-hoc
fit is worth nothing on its own:

1. **Predict, log, then look.** `w53.c` computes `pool_pred` from `cage_base` and writes it to the
   log *before* it issues a single `VirtualQuery` about the region. The verdict line compares
   `pool_pred` against the observed `AllocationBase`. A fit that had been tuned to the data would
   still pass; what makes it not a fit is that the prediction is made on **fresh runs with fresh
   cage bases** and, independently, that §2b derives the same formula from source.
2. **Independent implementation.** `w53.c` shares only the Qt bootstrap and the marker-finding
   loop with `w52b.c`; the reservation logic, the anchor read, the commit map, the fault probes and
   the chain simulation are new code. The recon pages are new and carry a different marker string.

Added coverage W52b did not have: four page weights (`none` / `one` / `light` / `heavy`), an
enumeration of **every** ~16 GiB reservation in the process, a commit map of the pool, a sweep of
the anchor across **every** committed super page, direct fault probes, and an end-to-end simulation
of the whole two-step chain inside one process.

---

## 2. Q1 — the decisive sub-question: the delta is a FUNCTION of `cage_base` [M, 28/28]

**It is neither fixed nor floating.** `pool_base` is not at a constant distance from the cage — the
distance takes all four values W52b saw — but it is *determined*, exactly, by a quantity the page
already holds:

```
    pool_base = (cage_base + 16 GiB) & ~(16 GiB - 1)        i.e. the first 16 GiB boundary
    delta     = 16 GiB - (cage_base mod 16 GiB)             strictly above the cage base
```

### 2a. Predict-then-test, 28 runs, 28 distinct cage bases

| | result |
|---|---|
| prediction == observed `AllocationBase` | **28 / 28** |
| distinct cage bases | 28 / 28 (per-process randomisation confirmed again) |
| reservation size | **16 GiB in 28/28** — no run hit gin's halving path (§2b) |
| `delta`, GiB | `4 ×7`, `8 ×12`, `12 ×4`, `16 ×5` — **all four slots occur** |
| `cage_base mod 16 GiB`, GiB | `0 ×5`, `4 ×4`, `8 ×12`, `12 ×7` — and `delta = 16 − residue`, every run |
| ~16 GiB reservations in the process | **3 in every run** — so the formula, *not* uniqueness, is what picks the right one |
| same formula re-checked against **W52b's** 13 runs (different harness, different page) | **11 / 11 logs that recorded the reservation** (2 never printed the line — W52b's own defect 1) |

Full table (`super` = committed super-page metadata pages in the pool's first 512 MiB;
`chain` = the four-step end-to-end simulation of §9):

| port | page | `cage_base` | prediction | observed | δ GiB | `dll_from_leak` | super | chain |
|---|---|---|---|---|---:|---|---:|---|
| 9801 | light | `0x020400000000` | `0x020800000000` | `0x020800000000` | 16 | `0x7ffdd8530000` | n/a¹ | PASS |
| 9803 | none | `0x01aa00000000` | `0x01ac00000000` | `0x01ac00000000` | 8 | — | 0 | FAIL² |
| 9805 | heavy | `0x026300000000` | `0x026400000000` | `0x026400000000` | 4 | `0x7ffdd8530000` | 256 | PASS |
| 9807 | one | `0x038600000000` | `0x038800000000` | `0x038800000000` | 8 | `0x7ffdd8530000` | 1 | PASS |
| 9809 | light | `0x013300000000` | `0x013400000000` | `0x013400000000` | 4 | `0x7ffdd8530000` | 2 | PASS |
| 9811 | heavy | `0x03ca00000000` | `0x03cc00000000` | `0x03cc00000000` | 8 | `0x7ffdd8530000` | 150 | PASS |
| 9813 | one | `0x018900000000` | `0x018c00000000` | `0x018c00000000` | 12 | `0x7ffdd8530000` | 1 | PASS |
| 9815 | none | `0x021d00000000` | `0x022000000000` | `0x022000000000` | 12 | — | 0 | FAIL² |
| 9817 | light | `0x02ea00000000` | `0x02ec00000000` | `0x02ec00000000` | 8 | `0x7ffdd8530000` | 2 | PASS |
| 9819 | heavy | `0x009a00000000` | `0x009c00000000` | `0x009c00000000` | 8 | `0x7ffdd8530000` | 256 | PASS |
| 9821 | one | `0x02e200000000` | `0x02e400000000` | `0x02e400000000` | 8 | `0x7ffdd8530000` | 1 | PASS |
| 9823 | light | `0x040200000000` | `0x040400000000` | `0x040400000000` | 8 | `0x7ffdd8530000` | 2 | PASS |
| 9825 | heavy | `0x020b00000000` | `0x020c00000000` | `0x020c00000000` | 4 | `0x7ffdd8530000` | 256 | PASS |
| 9827 | none | `0x020600000000` | `0x020800000000` | `0x020800000000` | 8 | — | 0 | FAIL² |
| 9829 | light | `0x013a00000000` | `0x013c00000000` | `0x013c00000000` | 8 | `0x7ffdd8530000` | 2 | PASS |
| 9831 | heavy | `0x025300000000` | `0x025400000000` | `0x025400000000` | 4 | `0x7ffdd8530000` | 256 | PASS |
| 9833 | one | `0x029a00000000` | `0x029c00000000` | `0x029c00000000` | 8 | `0x7ffdd8530000` | 1 | PASS |
| 9835 | light | `0x035000000000` | `0x035400000000` | `0x035400000000` | 16 | `0x7ffdd8530000` | 2 | PASS |
| 9837 | heavy | `0x03c400000000` | `0x03c800000000` | `0x03c800000000` | 16 | `0x7ffdd8530000` | 150 | PASS |
| 9839 | none | `0x033300000000` | `0x033400000000` | `0x033400000000` | 4 | — | 0 | FAIL² |
| 9841 | light | `0x00e500000000` | `0x00e800000000` | `0x00e800000000` | 12 | `0x7ffdd8530000` | 2 | PASS |
| 9843 | heavy | `0x00bc00000000` | `0x00c000000000` | `0x00c000000000` | 16 | `0x7ffdd8530000` | 256 | PASS |
| 9845 | light | `0x022f00000000` | `0x023000000000` | `0x023000000000` | 4 | `0x7ffdd8530000` | 2 | PASS |
| 9901³ | light | `0x011b00000000` | `0x011c00000000` | `0x011c00000000` | 4 | `0x7ffdd8530000` | 2 | PASS |
| 9903³ | light | `0x03e100000000` | `0x03e400000000` | `0x03e400000000` | 12 | `0x7ffdd8530000` | 2 | PASS |
| 9905³ | light | `0x034600000000` | `0x034800000000` | `0x034800000000` | 8 | `0x7ffdd8530000` | 2 | PASS |
| 9907³ | light | `0x02e600000000` | `0x02e800000000` | `0x02e800000000` | 8 | `0x7ffdd8530000` | 2 | PASS |
| 9909³ | light | `0x01dc00000000` | `0x01e000000000` | `0x01e000000000` | 16 | `0x7ffdd8530000` | 2 | PASS |

¹ port 9801 predates the super-page counter being added to the harness; its P1/P2/P8 results are
unaffected. ² the `none` page has no ArrayBuffer, so there is no anchor to read — §5, and that is
the *expected* result, not a failure of the formula (P1 passed in all four `none` runs).
³ ports 99xx were produced by a **concurrent session** running this same harness; they are listed
because they are independent confirmation, and they agree 5/5. This session's own batch is 23/23.

### 2b. Why the formula is a source-level invariant, not a regularity [P]

The measured constant is not luck, and this is what makes it safe to rely on. Two calls fix it, both
read at the pin (`scratch/w46/pinned/`, Chromium 130 / V8 `branch-heads/13.0`):

**The cage is at the sandbox base, enforced.** `isolate-group.cc:88-91`:

```cpp
Address base = sandbox->address_space()->AllocatePages(
    sandbox->base(), params.reservation_size, params.base_alignment, ...);
CHECK_EQ(sandbox->base(), base);
```

with `kPtrComprCageReservationSize = kPtrComprCageBaseAlignment = 1<<32` (4 GiB,
`v8-internal.h:178-179`) and `kSandboxSize = 1<<40` (1 TiB, `v8-internal.h:245`). So
`cage_base == sandbox_base`, and the cage is exactly the sandbox's first 4 GiB. That is a `CHECK`,
not an observation — and §4's measured reservation chain (4 GiB cage, then the pool, then a tail
that ends exactly `cage_base + 1024 GiB`) agrees to the byte.

**The ArrayBuffer pool is placed next, with alignment equal to its size.**
`gin/v8_initializer.cc:553-576`:

```cpp
// When the sandbox is enabled, ArrayBuffers must be allocated inside of
// it. To achieve that, PA's ConfigurablePool is created inside the sandbox
// and Blink then creates the ArrayBuffer partition in that Pool.
size_t pool_size = max_pool_size;
uintptr_t pool_base = 0;
while (!pool_base && pool_size >= min_pool_size) {
  pool_base = sandbox_address_space->AllocatePages(
      0, pool_size, pool_size, v8::PagePermissions::kNoAccess);   // hint 0, align == size
  if (!pool_base) pool_size /= 2;
}
PartitionAddressSpace::InitConfigurablePool(pool_base, pool_size);
...
ArrayBufferAllocator::InitializePartition();
```

`AllocatePages(hint = 0, size = 16 GiB, alignment = 16 GiB)` against a sandbox subspace whose only
occupied region is the cage at offset 0 leaves exactly one free region, `[4 GiB, 1 TiB)`; the lowest
16 GiB-aligned address in it is `round_up(cage_base + 4 GiB, 16 GiB)` — which, because `cage_base`
is 4 GiB aligned, equals `(cage_base + 16 GiB) & ~(16 GiB − 1)`. **[P] for the two calls and their
arguments; [I] for "the subspace allocator returns the lowest suitable region", which is not read
here but is what the measurements show.**

Two things follow that matter operationally:

* The loop **halves `pool_size` on failure**, and the alignment tracks the size. A run that got
  8 GiB would have an 8 GiB alignment and a *different* formula. §3 therefore reports the observed
  reservation size per run rather than assuming 16 GiB.
* `ArrayBufferAllocator::InitializePartition()` is called immediately after, which is why the pool
  is the **ArrayBuffer** partition and why §5's precondition exists.

---

## 3. Q3 — the "the observed slot is 1 of 4" question dissolves

W52b's third question was *which* of the four slots, and whether the choice is stable. The answer is
that the choice is **neither stable nor random**: it is `16 GiB − (cage_base mod 16 GiB)`, and
`cage_base` is per-process. Across 28 runs all four values occur, with the residue distribution
`{0: 5, 4: 4, 8: 12, 12: 7}` — a visible bias toward residue 8 GiB (12/28), which matches W52b's
7/13, but the bias is irrelevant: the page computes the answer rather than sampling it.

**There is therefore no probe to get wrong**, and W52b's "4 slot candidates → is this a scan or a
1-in-4 lottery?" is answered by removing the question. §7 measures the fault behaviour anyway,
because the answer matters for the failure mode of the *other* precondition (§5).

---

## 4. The address-space map the formula rests on [M]

Every run walks the reservation chain upward from `cage_base` to the first `MEM_FREE` hole. It is
the same in every run (port 9803, `cage_base = 0x01aa00000000`):

```
    0x01aa00000000     4.000 GiB   cage +0 GiB       private COMMIT    <- the pointer-compression cage
    0x01ab00000000     4.000 GiB   cage +4 GiB       private RESERVE   <- gap to the 16 GiB boundary
    0x01ac00000000    16.000 GiB   cage +8 GiB       private RESERVE   <- THE POOL
    0x01b000000000  1000.000 GiB   cage +24 GiB      private RESERVE   <- the rest of the sandbox
    0x02aa00000000    32.000 GiB   cage +1024 GiB    private RESERVE   <- the sandbox guard region
```

Two things fall out, and both are checks on the §2b derivation rather than new claims:

* **The cage, the gap and the pool all lie inside one 1 TiB extent that ends exactly at
  `cage_base + 1024 GiB`** — so `sandbox_base == cage_base` and `kSandboxSize == 1 TiB`, as
  `isolate-group.cc`'s `CHECK_EQ` and `v8-internal.h:245` say. The pool is a *sub-reservation of the
  V8 sandbox*, not an unrelated neighbour that happened to land nearby.
* The 32 GiB immediately above is `kSandboxGuardRegionSize` (`v8-internal.h:262`) — the same guard
  region W42 measured its stage-1 read landing 16.02 GiB into. The total contiguous extent is
  **1056 GiB in 23 of 27 runs** (1057 GiB in the other 4, an unrelated 1 GiB neighbour).

When `cage_base mod 16 GiB == 12 GiB` the gap reservation disappears entirely and the pool starts
exactly at `cage_top` (ports 9805, 9809, 9825, 9831, 9839, 9845 …). The formula covers that case
without a special case, and it is the tightest test of it.

---

## 5. The one new precondition: the page must allocate an ArrayBuffer [M]

This is the finding that was not anticipated, and it is a real cost. Four page weights were run:

| page | what it allocates | committed in the pool | super pages | anchor read | chain |
|---|---|---|---|---:|---|
| `none` | no ArrayBuffer / TypedArray / DataView at all | **0.00 MiB** | **0** | **fatal `0xC0000005`** | 0/4 |
| `one` | **one `new ArrayBuffer(8)`** | 0.01 MiB | 1 | **PASS** | 4/4 |
| `light` | 50 × 64 KiB + 100 × `Float64Array(256)` | 3.33 MiB | 2 | PASS | 13/13 |
| `heavy` | ~2 000 buffers, 8 size classes, plus churn | 310 – 551 MiB | 150 – 256 | PASS | 7/7 |

* **With no ArrayBuffer the pool is entirely uncommitted** — `MEM_RESERVE`, 0 bytes committed, 4/4
  runs — and the anchor read is an access violation. The reservation still exists and the P1
  prediction still passes; there is simply nothing in it.
* **One 8-byte ArrayBuffer is enough** to bring the anchor into existence, 4/4 runs. This follows
  directly from §2b: `ArrayBufferAllocator::InitializePartition()` puts Blink's ArrayBuffer
  partition in this pool, so the first ArrayBuffer commits the first super page and writes its
  metadata page — including the `root` pointer at `+0x1000`.
* **The anchor scales with allocation**, and every copy agrees: across all runs the sweep read
  **1 608 committed super-page metadata pages and got the DLL base from every one, 0 mismatches.**

An exploit page allocates its own ArrayBuffers, so this is a line of setup rather than a barrier —
but it must be stated, because it is the only way to land on an uncommitted page and take the fault
§7 measures. It also means **the anchor is not a property of the process; it is a property of what
the page has done.**

For completeness: no *other* computable above-cage anchor exists. Re-examining W52b's CSVs, the
remaining above-cage holders of `Qt6WebEngineCore.dll` pointers sit in the C++ heap at
cage+1377 GiB, cage+1486 GiB, cage+4764 GiB in three different runs — placed independently of the
cage, so not derivable from `cage_base`. **[M]**

---

## 6. Q2 — the anchor read, and a correction to W52b

```
    dll_base   = read64(pool_base + 0x1000) - 0x0b4ccac0
    code_range = dll_base - 0x21930000                     (W48's constant, re-tested here)
```

### 6a. The metadata page, byte by byte [M]

`pool_base + 0x1000` is the first committed page of the reservation in every run that has one. Its
layout is stable in *shape* and its first qword is stable in *value*:

Port 9801, `light` page, `cage_base = 0x020400000000`, `pool_base = 0x020800000000`:

```
  +0x1000   0x00007ffde39fcac0   -> Qt6WebEngineCore.dll + 0x0b4ccac0    <== THE ANCHOR
  +0x1008   0x0000020800201000   -> pool + 0x201000   (the next super page in the extent)
  +0x1010   0x00000000001f0001      two small counters
  +0x1018   0x0000000000000000
  +0x1020   0x0000000000000000
  +0x1028   0x0000000000000000
  +0x1030   0x00007ffde39fd9d8   -> Qt6WebEngineCore.dll + 0x0b4cd9d8    <== NOT invariant, §6b
```

Port 9807, `one` page, same build, same offsets — note `+0x1008 = 0` (there is no second super
page) and a *different* pointer at `+0x1030`:

```
  +0x1000   0x00007ffde39fcac0   -> Qt6WebEngineCore.dll + 0x0b4ccac0    <== identical
  +0x1008   0x0000000000000000
  +0x1010   0x0000000000010001
  +0x1020   0x0000038800004010   -> pool + 0x4010
  +0x1030   0x00007ffde39fcb08   -> Qt6WebEngineCore.dll + 0x0b4ccb08    <== different
```

### 6b. ⚠ Correction: only `+0x1000` is invariant — `+0x1030` and the other 110 offsets are not

W52b measured "**111 (offset, value-offset) pairs byte-identical in 13/13 runs**" and I reproduced
that exactly from its CSVs. It is true — **and it is an artefact of running one page thirteen
times.** Change the page and the value at `+0x1030` changes:

| page | ArrayBuffers allocated | value at `pool+0x1030` |
|---|---|---|
| W52b's `w52b-anchor.html` | 50 × 64 KiB | `DLL+0x0b4cd258` |
| `w53-light.html` | 50 × 64 KiB + 100 × Float64Array | `DLL+0x0b4cd9d8` |
| `w53-one.html` | one 8-byte buffer | `DLL+0x0b4ccb08` |

All three are **different globals inside the same object** — the deltas from `+0x1000`'s value are
`0x798`, `0xF18` and `0x48`. That is exactly a bucket array indexed by size class: `+0x1030` is
`SlotSpanMetadata::bucket`, so it moves with the *allocation size*. `+0x1000` is the extent entry's
`root`, which is the partition itself and cannot move. **Use `+0x1000`. Do not use the other 110.**

### 6c. The PE evidence for the identification [M, static]

Every observed value RVA lands in `Qt6WebEngineCore.dll`'s `.data`, `READ|WRITE`, **past the
section's raw size** — i.e. in the zero-filled tail, so these are runtime-initialised globals, which
is what a `PartitionRoot` singleton is:

```
  .data   VA 0x0b245000  VSize 0x002d0abc  Raw 0x0b243400 / 0x000e8200  Char 0xc0000040
  RVA 0x0b4ccac0 -> .data +0x287ac0  READ,WRITE  ZERO-FILLED at load
  RVA 0x0b4ccb08 / 0x0b4cd0d8 / 0x0b4cd258 / 0x0b4cce98 / 0x0b4cd9d8 -> same section, span 0xF18
```

A single object spanning `0xF18` bytes whose interior fields are what slot-span metadata points at.

### 6d. Redundancy [M]

The extent-entry root pointer is at `+0x1000` of **every** committed 2 MiB super page, not just the
first: **1 608 metadata pages swept across all runs, 1 608 yielded the DLL base, 0 mismatches** (§5).
So a page that has committed *k* super pages has *k* independent copies of the same anchor and can
pick whichever one its read primitive can reach — which turns out to matter (§8b).

### 6e. The whole chain, simulated inside one process [M for the values, [I] for "a primitive could do this"]

Every run replays all four steps using only values the page could hold, and compares each against
ground truth afterwards. Port 9801:

```
  1. cage_base   = read64(cage+0x58) & ~0xFFFFFFFF   = 0x020400000000   [PASS]
  2. pool_base   = (cage_base + 16G) & ~(16G-1)      = 0x020800000000   [PASS]
  3. dll_base    = read64(pool+0x1000) - 0x0b4ccac0  = 0x7ffdd8530000   [PASS]
  4. code_range  = dll_base - 0x21930000             = 0x7ffdb6c00000   [PASS]
```

**24 of 24 runs that have the anchor pass all four steps**; the 4 `none` runs pass steps 1–2 and
stop at step 3 for the reason in §5. Step 4's constant held in **28/28** runs
(`code_range = 0x7ffdb6c00000`, a 512 MiB RWX reservation at `Qt6WEC − 0x21930000`), re-confirming
W48's 6/6.

**These are harness loads, not primitives.** Steps 1 and 3 stand in for W35's in-cage read and for
W42/421403261's out-of-cage read respectively. Neither was run.

---

## 7. Fault behaviour — measured, in the renderer process [M]

W52b listed this as "**UNMEASURED**". It is now measured, in the same process, with a guarded read
at each address class:

| target | state | result |
|---|---|---|
| reserved-but-uncommitted, inside the pool (`pool + 8 GiB`) | `MEM_RESERVE` | **`0xC0000005` ACCESS_VIOLATION** |
| free / unmapped (a real `MEM_FREE` hole above the cage) | `MEM_FREE` | **`0xC0000005` ACCESS_VIOLATION** |
| `PAGE_NOACCESS` (harness-owned page) | `MEM_COMMIT` | **`0xC0000005` ACCESS_VIOLATION** |
| `PAGE_GUARD` (harness-owned page) | `MEM_COMMIT` | **`0x80000001` GUARD_PAGE_VIOLATION**, and the *second* read of the same page succeeds — the guard is one-shot |

So the three classes the task asked to distinguish do **not** behave differently: reserved,
uncommitted and unmapped are all a plain access violation. Only a guard page differs, and no guard
page is involved on this path.

**What this does and does not settle.** These are **OS semantics [M]**. Whether a fault taken
*inside wasm code* reaches the process depends on the faulting PC being absent from V8's
protected-instruction list — W49 measured an explicit `cmp`/`jae` trap stub on precisely this
access, so it is not a protected instruction, and the AV should propagate. That last step is still
**[I]**, and W53 did not fire anything to check it.

**The practical consequence is small, and that is the point:** with §2's formula there is no wrong
probe to take. The only way to land on an uncommitted page is to read the pool before allocating an
ArrayBuffer (§5), which is entirely under the page's control.

---

## 8. Can the two candidate out-of-cage READ primitives actually reach it? [I]

Arithmetic on measured quantities. **Neither primitive was fired in W53.**

### 8a. W42 (SlicedString offset overflow) — comfortably, and far more cheaply than before

W42's read is `parent_data + accumulated_offset` with `parent_data` in-cage and the accumulator a
positive 64-bit sum of per-hop values in `[0, 2^32)`. The target is **4–16 GiB above the cage base**
(§3), so the sum needed is 4–16 GiB — i.e. **4–5 slices**, against the 261-hop chain W42 fired to
cross the guard region and the 1025-hop ladder it demonstrated at 4 TiB. The read is positive-only,
and the target is above; it is byte-granular via `charCodeAt`, so recovering the 8-byte anchor is
8 reads at consecutive offsets.

This is the cheaper route by a wide margin — but note what W52b already flagged and W53 does not
change: **W42 was never fired at this address.** Reachability here is [I].

### 8b. 421403261's own read — reachable, but only via a super page k ≥ 1

W49 measured the emitted form as `movzx edx, byte [rcx + rax + 0xb]` with `rcx` the array object,
`rax = (K<<32) | low` at full 64-bit width, and a 32-bit `cmp eax, length` bounds check. So

```
    target = array_obj + 0xb + (K<<32) + low ,      0 <= low < array.length
```

Both the cage (4 GiB aligned) and the pool (16 GiB aligned) are 4 GiB aligned, so the target's
residue mod 2^32 is just its offset **inside** the pool. Writing `comp` for the array object's
compressed offset (which the page knows from W35's `addrof`) and taking the anchor in super page
*k*:

```
    low = k*2 MiB + 0x1000 - comp - 0xb        must lie in [0, array.length)
```

`K` then absorbs the whole 4–16 GiB delta, which is what W49's ±8 EiB reach is for. The constraint
is therefore **`comp ≲ k*2 MiB < comp + length`** — a *lower* bound on k, not an upper one:

* **k = 0 does not work** for any realistic page. The measured `comp` for a marker string allocated
  early is **0x14330c (1.27 MiB)** in every run, and `0x1000 − comp − 0xb` is negative; the wrap
  puts `low` just under 4 GiB, far past the engine's `1073741811`-byte array limit (W49 [M]).
* **k = 1 works** as soon as a second super page exists — `low ≈ 2 MiB − 1.27 MiB ≈ 0.73 MiB`, so
  even a 1 MiB array suffices. §5 measures how much allocation that takes.

So 421403261 can read its own anchor, provided the page commits at least two super pages — which
`w53-light.html` already does with 50 × 64 KiB. The `one`-ArrayBuffer minimum that makes the anchor
*exist* is **not** enough to make it reachable by this particular primitive; it is enough for W42.

⚠ This is the reachability question only. It says nothing about whether the rest of 421403261's
chain works: that still needs the non-final-type `call_indirect` setup and an in-cage
`set_supertype` write (W49 §1c), neither of which was attempted here.

---

## 9. Where this leaves the renderer-RCE line

The line reduced, at W49, to one question: *can the page learn a single absolute address?* W52
answered half of it (`cage_base`, from `cage+0x58`). This wave answers the other half.

| input to 421403261 | status before W53 | status now |
|---|---|---|
| `cage_base` (per-process) | `cage+0x58`, fixed offset, 31 runs across two harnesses | unchanged, **re-confirmed by a third harness, 28/28 here** |
| `pool_base` (per-process) | "4–16 GiB above the cage, 4 candidates, slot choice unknown" | **computed from `cage_base`; no candidates, no search — 28/28** |
| `dll_base` (per-boot) | layout [M], reachability [I], never read | **one qword at a computed address; 24/24 runs that have the anchor** |
| `code_range` | `dll_base − 0x21930000`, W48 6/6 | re-confirmed, **28/28**, same constant |
| `k = (code_range − cage_base) >> 32` | ≥824 candidates, fatal AV per miss (W49/W52) | **computable — the lottery is gone** |
| *new:* the anchor's existence | not known to be conditional | **conditional on the page allocating ≥1 ArrayBuffer (§5)** |

What is still open, in the order that matters:

1. **Fire step 1.** `arbRead64(0x58)` on the shipped build via W35. Still the cheapest unfired step;
   it converts W52 §2c from [I] to [M].
2. **Fire step 2.** W42's read at `pool_base + 0x1000`, ~5 slices, 8 `charCodeAt` calls. This is the
   step W53 makes safe to attempt, because the address is computed rather than guessed.
3. **Then, and only then**, 421403261's chain: the non-final-type `call_indirect`, the in-cage
   `set_supertype` write, and the write into a JIT page. **None of that is touched here.**

A miss at step 2 is still a renderer crash, and with site isolation off (W17j) that takes the whole
web UI with it. The formula is what removes the need to take that risk — not a claim that the risk
became acceptable.

---

## 10. Honest boundaries

* **Nothing was fired.** No exploit primitive ran. W35's in-cage read, W42's out-of-cage read and
  421403261's read/write were all *stood in for* by harness loads. **Code execution remains NOT
  achieved**, and no new escape is claimed beyond what W42 + W43 already held.
* The step-1 anchor (`cage+0x58`) is re-measured here, but the claim that **W35** can read it is
  still W52's mechanism reading — **[I]**.
* Identifying the 16 GiB region as PartitionAlloc's ConfigurablePool and `+0x1000` as
  `PartitionSuperPageExtentEntry::root` is **[I]**; the addresses, values, offsets and the
  run-to-run reproduction are **[M]**; the allocation call that forces the base is **[P]**.
* **One boot.** Every run in this wave is from the boot of 2026-08-05 14:20 (uptime 10.4–11.1 h),
  so `Qt6WebEngineCore.dll = 0x7ffdd8530000` throughout. The per-boot claim itself is W52b's, from
  a second boot on 2026-07-30. W53 adds no independent boot sample, and **the DLL-base entropy was
  not estimated** — brute force is not claimed to be practical.
* The `0xb4ccac0` and `0x21930000` constants are **per-build**, tied to this exact
  `Qt6WebEngineCore.dll`. Nothing here survives a Qt WebEngine update unchanged.
* The runs use recon pages under a harness-hosted Qt WebEngine, not the product's own UI. The pool
  base is fixed at V8 init and cannot depend on the page; the *commit* state of the pool does, which
  is exactly what §5 measures.
* **28 runs, of which 5 (ports 99xx) were produced by a concurrent session** running this same
  harness while this batch was in flight. They are independent confirmation, not this session's
  measurements, and they are marked as such in §2a. That session also rebuilt `w53.exe` at 00:51
  from the *unchanged* `w53.c` (same source mtime, same binary size), so all runs are the same code;
  strict one-run-at-a-time serialisation was this session's discipline and was broken by that
  overlap. Port 9801 predates one harness counter being added and reports `n/a` for it.
* All runs are on one machine.
* §8's reachability arithmetic uses `comp = 0x14330c`, the compressed offset of *this* recon page's
  marker string, which was byte-identical in all 28 runs. A real exploit would use its own array's
  `comp` from W35's `addrof`; the arithmetic is stated in terms of `comp`, not that constant.

---

## 11. Artifacts

* `scratch/w53/w53.c` / `.exe` — the harness (`/guard:cf`, matching `QtWebEngineProcess.exe`).
  `w53.exe SECS PORT TAG`.
* `scratch/w53/w53-{none,one,light,heavy}.html` — the four recon pages; they differ only in how much
  ArrayBuffer they allocate.
* `w53run.py` (fresh-port server + runner), `batch.py` (strictly sequential), `agg53.py` (cross-run).
* Per run: `w53-<port>.log` (P0–P8 in full), `w53sum-<port>.json`.

**Tooling notes — carried and added:**

1. Carried from W52 §9: rebuilding while a run is live fails with `LNK1104`; `cmd //c "build.bat"`
   from git-bash does not find the script — use `.\build.bat` from PowerShell.
2. Carried from W49: this build compiles wasm lazily and `local.set` of an `i32.const` emits no
   Liftoff code. Not exercised here (W53 uses no wasm), but still true.
3. **New, and it is the W52-family trap in a new place:** a scan-based harness would have found this
   reservation by searching for "a 16 GiB region above the cage" and reported a 4-candidate lottery,
   which is what W52b did. The fix was not a better scan — it was to **compute a prediction from a
   value already in hand and test it**. Where a candidate set appears, check first whether one of
   the values you already have determines the answer.
4. When a constant "reproduces in 13/13 runs", check what was held fixed across those 13 runs. Here
   110 of 111 constants were properties of the *page*, not of the *build* (§6b).
