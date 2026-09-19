# W52 — the stride-4 anchor re-scan: W49's negative STANDS, but the anchor exists just ABOVE the cage

Harness `scratch/w52b/` (`w52b.c`, `w52b-anchor.html`, `batch.py`, `w52brun.py`).
13 runs, ports 9701–9725, harness processes only, loopback only, fresh port each run.
**Reconnaissance only — nothing was written to the renderer, no primitive was fired, no code was
executed. Code execution remains NOT achieved.**

Every claim below is marked **[M]** measured / **[I]** inferred.

---

## 0. Why this harness was written twice

A concurrent session produced `scratch/w52anchor/` (run 9601) reporting **5 in-cage raw pointers**.
That is the single most consequential number in this task, so it was not inherited: `w52b.c` is an
independent implementation. The independent run reproduces the *appearance* of in-cage hits
(7–282 per run) — and then **refutes** them with a negative control the first harness did not have
(§2). Do not report the 9601 in-cage numbers as disclosures.

---

## 1. Coverage — W49's zero now has a denominator [M]

W49 never printed how much of the cage it actually scanned, and it skipped every region > 64 MiB
and capped the whole scan at 2 GiB. Both limits are removed here.

| | W49 | W52 |
|---|---|---|
| stride | 8 | **4** |
| region size cap | ≤ 64 MiB | none |
| total budget | 2 GiB | none (≈1.0 GiB actual) |
| in-cage coverage reported | never | **5.98 MiB of 5.98 MiB, 8/8 regions, 13/13 runs** |
| images scanned | no | yes (own image + own stack excluded by address) |

**100% of committed in-cage memory was scanned at 4-byte stride in every run** [M]. The page was
also loaded with ~3 000 live JS objects of a dozen shapes so the cage held a real heap
(5.98 MiB committed, vs the ~2 MiB W49 measured).

---

## 2. ★★ W49's negative IS overturned — but by the PREDICATE, not the stride [M, 13/13]

| class | test | in-cage result |
|---|---|---|
| A | qword `== cage_base` (**W49's only test**) | **2 hits in 13 runs** — noise, §2b |
| B | qword is a raw pointer **into** the 4 GiB cage | 7–282/run, of which **6 are structural**, §2c |
| T | qword points into trusted space | 0–6 per run — noise |
| X | qword is a raw pointer into executable memory | **0 in all 13 runs** |
| — | runs of ≥64 consecutive raw code pointers | **0 in all 13 runs** |

**The stride hypothesis is excluded.** All six structural holders sit at offsets `0x48`/`0x58`
mod 0x40 — every one is **8-aligned**, so W49's 8-stepping scan would have walked straight over
them. `w49dump.c:386` shows the actual defect: its only in-cage predicate is `if (v == g_cage_base)`.
It hunted qwords *equal to* the cage base and never qwords *pointing into* it. **Wrong predicate,
not wrong stride** — the stride-4 re-run this task called for was worth doing and is now excluded as
the cause.

### 2a. The negative control that kills classes B and T [M]

In a pointer-compressed heap **every field is 4 bytes, so any two adjacent tagged fields read as one
8-byte value** — and **alignment does not discriminate**, because an 8-aligned object's fields at
+0 and +4 straddle exactly like a 4-mod-8 pair. A "raw pointer into the cage" is therefore
indistinguishable from a coincidence in which the *upper* word happens to equal `cage_base>>32`
(0x15c, 0x232, 0x3ca … — small numbers that occur constantly as compressed pointers and Smis).

So the identical test was run against **decoy bases: 4 GiB windows that do not exist**.

| run | REAL cage | decoy `cage_hi+1` | decoy `cage_hi−1` | decoy `cage_hi+2` | decoy 0x4d2 |
|---|---|---|---|---|---|
| 9709 | 7 | **264** | **264** | 1 | 17 |
| 9711 | 7 | **265** | **273** | 1 | 17 |
| 9717 | 8 | **270** | **284** | 2 | 17 |
| 9725 | 7 | **263** | **263** | 1 | 17 |
| 9719 | 276 | 2 | 2 | **276** | 17 |
| 9721 | 282 | 2 | 2 | **292** | 17 |
| 9723 | 269 | 1 | 1 | **266** | 17 |

Nonexistent windows score **equal to or up to 40× higher than** the true cage base, over ~1.45 M
in-cage probe positions per run. ⇒ **the bulk of the class-B count is compressed-field-pair
coincidence** [M]. Without this control one would report 282 disclosures in run 9721 where there
are 6. It does **not**, however, say anything about a small structural subset, which the ~270-hit
blob swamps — see §2c, which is what actually matters.

### 2b. Class A is noise too [M]

The 2 in-cage `== cage_base` hits landed at `cage+0x2e7710` (align 0) and `cage+0x3248c`
(align 4) — different offsets, different alignments, 2 of 13 runs. Not structural. Combined with
W49's 0/3, that is 2 hits in 16 runs at non-reproducing addresses.

### 2c. ★★ The structural subset that survives every test — the cage DOES hold its own address [M]

Filtering the class-B in-cage hits by reproducibility rather than by count, **six holders recur in
13/13 runs across 13 distinct cage bases, at fixed ABSOLUTE compressed offsets, with constant
deltas**:

| compressed offset of holder | value − holder | present |
|---|---|---|
| `cage+0x48` | `+0x3ffb8` | 13/13 |
| `cage+0x58` | `+0x10` | 13/13 |
| `cage+0x1c0048` | `+0x11fb8` | 13/13 |
| `cage+0x1c0058` | `+0x10` | 13/13 |
| `cage+0x280048` | `+0x14fb8` | 13/13 |
| `cage+0x280058` | `+0x10` | 13/13 |

Every one masks correctly: `value & ~0xFFFFFFFF == cage_base`, 13/13 runs, verified per run. Nothing
else in the class-B set appears in more than 3 of 13 runs (the coincidence background of §2a).

⇒ **`cage_base = read64(cage + 0x58) & ~0xFFFFFFFF`** — one in-cage read at a hard-coded compressed
offset, no search. W35's arbitrary in-cage read addresses by compressed offset, so `0x58` is
directly addressable [I: W35 was not re-fired here].

The shape (a chunk header at +0x40/+0x48/+0x58 whose +0x58 points 0x10 ahead, repeating at three
chunk bases) is consistent with V8 page metadata. A concurrent independent harness
(`scratch/w52anchor/`, note `W52-anchor-FOUND-cage-base-leak.md`) reports the same four offsets over
18 runs and byte-dumped three pages to identify them as `size_`@+0x40 / `area_end_`@+0x48 /
`area_start_`@+0x58. Two independent implementations, 31 runs, same offsets.

### 2d. Verdict

**W49's blocking negative is OVERTURNED for the cage base** [M] — but its *code-range* negative
stands: **0 raw executable pointers and 0 code-pointer runs in the cage, 13/13 runs**. So the page
can learn `cage_base` cheaply and still cannot learn the code range from inside the cage.

---

## 3. ★★ But the anchor exists 4–16 GiB ABOVE the cage, byte-identical every run [M]

W49 asked the wrong question by asking only about *in-cage*. W42's A2 gives an **out-of-cage,
positive-only read**, so the anchor only has to be *above* the cage and inside W42's ladder.

In **all 13 runs** a **16 GiB `MEM_PRIVATE` reservation** sits a small multiple of 4 GiB above the
cage base, and its first committed page holds a structure that is **byte-identical across every
run**:

* **111 holders** of full 64-bit pointers into `Qt6WebEngineCore.dll`
* holder offsets within the reservation: **0x1000 … 0x401130**, identical 13/13
* strides: **0x20, 0x30, 0x80, 0x1ff0b0, 0x1ff0d0**, identical 13/13
* value offsets *within the DLL*, identical 13/13:
  **`+0xb4cd258` ×50, `+0xb4cd9d8` ×50, `+0xb4cd0d8` ×7, `+0xb4ccac0` ×3, `+0xb4cce98` ×1**

⇒ reading **one** of those qwords yields `Qt6WebEngineCore.dll base = value − 0xb4cd258`, and per
[[W48]] the V8 code range is a fixed **−0.526 GiB** from it (`0x7ffdd8530000` → `0x7ffdb6c00000`).

**Distance above the cage base**, 13 runs: `{4 GiB ×1, 8 GiB ×7, 12 GiB ×4, 16 GiB ×1}` — i.e.
**0–12 GiB above the cage *top***, which is ~350× inside W42's byte-exact ladder (4 TiB / 1025
hops), and far inside W42's demonstrated plant at cage+1.25 TiB.

Unlike the in-cage classes, this is **not** a coincidence artefact: the same value repeats 50× at a
regular stride, points to committed memory, and both the holder offsets and the value offsets are
build constants across 13 runs. A random-pair coincidence cannot do that.

### What is NOT established

* **W42 was NOT fired at this address.** Reachability is **[I]**, inferred from W42's measured
  ladder, not demonstrated. Firing it is the obvious next step.
* **The 4 GiB slot is not known a priori** — 4 candidates observed ({4,8,12,16} GiB, mode 8 GiB at
  7/13). The rest of the 16 GiB reservation is reserved-but-uncommitted, so a wrong probe reads an
  uncommitted page. **Whether that faults or is safely rejected is UNMEASURED.**
* The owning class/allocator of the 16 GiB reservation was **not identified**.
* No raw *code* pointer was found above the cage within 4 TiB (0/13). The 111 pointers are into the
  DLL's **RW- data**, not its code — which is sufficient, since the code range is a fixed offset
  from the DLL base, but it is not the same claim.

---

## 4. Premise correction: A4's read is not a disclosure window, and it is not anchored at dt_elems [M]

The brief states "A4's read is ±32 GiB anchored at `dt_elems`". `W43-A4-oob-write-ACHIEVED.md`'s own
measured identities say otherwise:

* **WRITE** — `fault_target == dt_elems + 4*K`, `K` an int32, exact in 6/6 runs
  ⇒ **±2 GiB anchored at `dt_elems`**, 4-byte quantised.
* **READ** — `cmp byte [rax+rcx+0Eh]` at `Qt6WebEngineCore+0x17e61ec` with `RAX = tables.data()`,
  `RCX = K*32` (`module->tables[K].shared`) ⇒ **`tables.data() + 32*K`, ±64 GiB, 32-byte stride**.
  W43 records this read as a **survivability precondition** — it must not fault — **not** an
  observable read. Its result goes into a `cmp`, never to the page.

So "a copy inside A4's read window is a cheaper anchor" does not follow: A4 has no read output, and
`K` is *shared* between the read and the write, so the two windows cannot be aimed independently.

Measured against both anchors and both bounds anyway:

| | within ±2 GiB | within ±32 GiB |
|---|---|---|
| cage-base copies near **`dt_elems`** | **0, every run** | **0, every run** |
| cage-base copies near **`tables.data()`** | 74–429 per run | same |

---

## 5. ★ The DLL-base unknown is PER-BOOT, categorically [M]

| scope | evidence |
|---|---|
| constant across renderer restarts | `Qt6WebEngineCore.dll = 0x7ffdd8530000` in **102 recorded runs** across W47/W48/W49/W50/W52b, 16:10→21:2x on 2026-08-05, all after the 14:20:24 boot |
| changes across boots | `scratch/w4/transport/live_modules_fresh.txt`, **2026-07-30**, different boot: `Qt6WebEngineCore.dll = 0x7FFB23B50000` |
| per-**process** by contrast | `cage_base` differs in **all 13** runs; so do `tables.data()` and the trusted base |

⇒ W50's import-wrapper unknown (`Qt6WebEngineCore.dll+0x2743e24`, high32 `0x00007ffd`, same 4 GiB
block as the RWX code range) **persists across renderer restarts within a boot**, so a miss is
informative rather than re-randomised. This is the categorical opposite of W49's `k`, which
re-randomises every process.

**Explicitly NOT concluded:** that this makes brute force practical. Entropy was not estimated
(n = 2 boots), a miss is a fatal AV, and the feasibility question is separate.

---

## 6. Tooling defects — a 6th and a 7th, on top of W47 §0's three and W50's fifth

6. **A shared hit-recording array re-creates W49's defect 4 even when the *counters* are bucketed.**
   The scan ascends, so the C++ heap (~0.8 TiB) is reached long before the cage (~1–4 TiB) and a
   single 32 768-entry array filled before the cage existed. Run 9701 printed *"0 in-cage hits"*
   while its own uncapped counters said **13**. Give every analytic bucket its own array and its own
   cap. (Fixed in `w52b.c`; run 9701's per-hit dump is void, its counters are not.)
7. **In a pointer-compressed heap, an 8-byte "this looks like a pointer" test is worthless without a
   decoy-base control.** Alignment does not discriminate (§2a). Measured false-positive rate:
   1–292 hits per 1.45 M in-cage positions per nonexistent 4 GiB window.

---

## 7. Where this leaves the line

The single question W49/W50 converged on — *can the page learn ONE absolute address?* — now has a
split answer, and the two halves are complementary:

| anchor wanted | where it is | cost | status |
|---|---|---|---|
| **`cage_base`** (per-process) | `cage+0x58`, fixed offset, 13/13 runs | one W35 in-cage read, no search | **[M] found** |
| **DLL base → code range** (per-boot) | 16 GiB reservation 4–16 GiB *above* the cage, 111 pointers, offsets constant 13/13 | one W42 out-of-cage read, ≤4 slot candidates | layout **[M]**, reachability **[I]** |

The in-cage route does **not** yield the code range (0 exec pointers in-cage, 13/13); the above-cage
route does, because the DLL base fixes it at −0.526 GiB and §5 shows the DLL base is per-boot.

Highest-value next measurement, in order:

1. **Fire W35's `read64` at compressed offset `0x58`** and mask. One call, no search, no groom —
   the cheapest open step, and it converts §2c's [I] into an [M].
2. **Fire W42's out-of-cage read at `cage_top + {0,4,8,12} GiB + 0x1000`** and see whether a
   `Qt6WebEngineCore.dll` pointer comes back byte-exact. With §5 that hands the page the DLL base
   *and* the code range.
3. **Measure what a wrong probe does** (uncommitted page inside the 16 GiB reservation): fatal AV, or
   safely rejected the way W35's misses were? That decides whether 4 candidates is a scan or a
   1-in-4 lottery.
4. Only then revisit W50's `target` route, which needs exactly the DLL base and nothing else.
