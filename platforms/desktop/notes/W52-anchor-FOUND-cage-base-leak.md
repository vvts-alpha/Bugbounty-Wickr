# W52 — the anchor exists: the cage discloses its own base, 18/18 runs

Written 2026-08-05. Answers the question W49 reduced the whole renderer-RCE line to:
*"can the page leak ONE raw in-cage pointer?"* Every line **[M] measured** on the shipped AWS Wickr
desktop (Qt WebEngine 6.9.2, Chromium base 130.0.6723.192, declared 139.0.7258.67) unless marked
**[I] inferred**. Harness / logs / CSVs: `scratch/w52anchor/`.

**Measurement only. No primitive was fired, nothing was written to the renderer, no code was
executed.** The harness runs the same recon page W47/W48 used (`w52-map.html` == `w48-map.html`) in a
`--single-process` Qt WebEngine and reads its own memory. **18 runs**, ports 9601–9635, one at a
time, ~1000 MiB scanned per run.

---

## 0. Bottom line

| question | answer |
|---|---|
| Can the page leak one raw in-cage pointer? | **YES — and it needs no new bug. [M for the value, I for the read]** |
| Are there in-cage copies of the cage base? | **No — 0 structural copies, 18/18. W49's negative stands.** |
| Full signed distribution of every copy? | §3 — and W49's "all copies lie below the cage" is **wrong** |
| Is a copy inside A4's read window? | Densely — **but A4's read cannot extract a value.** §4 |
| Anything above the cage inside W42's 4 TiB ladder? | Usually nothing at all; **in 5 of 18 runs, both anchors.** §5 |
| Does the cage disclose the code range? | **NO — 0 reproducible out-of-cage addresses, 18/18. [M]** §6 |
| Net effect on V8 issue 421403261 | **One of the two unknowns is solved. The other is not.** |

> ### The finding
> **The cage contains raw 64-bit addresses that point back into the cage, at fixed low offsets, in
> every run.** `cage_base + 0x58` holds `cage_base + 0x68`; `cage_base + 0x48` holds
> `cage_base + 0x40000`; the same pair recurs at `+0x1c0048/+0x1c0058` and `+0x280048/+0x280058`.
> Measured in **18 runs with 18 distinct cage bases** — the stored value tracks the cage base every
> time. Because the cage is 4 GiB aligned, `value & ~0xFFFFFFFF == cage_base` **exactly**.
>
> W49 searched only for qwords *equal to* the cage base and correctly found none. It never searched
> for qwords *pointing into* the cage, which are just as good and which V8 does store.

This does not finish the chain. `k = (code_range − cage_base) >> 32` has two unknowns; this supplies
`cage_base`, and §6 shows the cage discloses nothing about `code_range`.

---

## 1. What was measured, and how it differs from W49

W49's out-of-cage counter was written but its report line never fired, so only 64 of ~195 copies were
ever logged, from one run. This is the repair plus three widenings:

| class | what it matches | why it matters |
|---|---|---|
| **A** | qword `== cage_base` | W49's original target |
| **B** | raw *tagged* pointer into the cage, map→meta-map chain validated | `v & ~0xFFFFFFFF == cage_base` |
| **B2** | 8-aligned raw address into committed cage memory, untagged | same — **and this is where the hit is** |
| **C1/C2/C3** | pointer into executable memory: non-image (V8 code range / JIT) / `Qt6WebEngineCore.dll` / other image | code-range anchor |
| **D** | runs of ≥64 consecutive class-C qwords | W49 comparability |

Every hit carries the signed distance from **three** anchors: `cage_base`, `tables.data()` (A4's
out-of-cage READ base) and `dispatch_tables` (A4's out-of-cage WRITE base). Coverage: **all ~1660
committed readable regions including `MEM_IMAGE`** — W49 skipped image memory and therefore could not
see the copies above the cage (§3). Scanned at **both** 8-byte and 4-byte alignment (W50's defect:
trusted-cage objects are 4-aligned).

**Validator, and why it is needed.** `cage_base >> 32` is a *small integer* (0x39, 0x199, 0x2c5 … in
these runs). Inside the cage, where every tagged value is 32 bits, any 8-byte window whose upper word
holds that integer looks exactly like an in-cage pointer. The first build had no validator and
reported 5 in-cage "raw pointers". Class B now requires `v & 7 == 1` plus a map→meta-map chain that
decompresses into committed cage memory; class B2 requires 8-alignment and a committed target.
**Class B in-cage then falls to 0 in every run** — the survivors are all B2, i.e. *untagged*, which is
what an `Address` field actually is. The decisive discriminator is §2a's reproducibility, not the
validator: everything that recurs is 8-aligned, everything 4-aligned appears once and never again.

---

## 2. The anchor [M]

### 2a. The same four offsets, eighteen different cage bases

All 18 runs carry **all four** 8-aligned in-cage raw in-cage pointers:

```
  cage+0x48       ->  cage+0x40000
  cage+0x58       ->  cage+0x68
  cage+0x1c0058   ->  cage+0x1c0068
  cage+0x280058   ->  cage+0x280068
```

| cage bases observed (18 runs, all distinct) |
|---|
| `0x09e` `0x0ad` `0x0ef` `0x105` `0x134` `0x199` `0x1b4` `0x233` `0x237` `0x255` `0x282` `0x295` `0x298` `0x2b2` `0x2c5` `0x390` `0x3c8` `0x3d5`   (each × 2^32) |

A coincidence would have to hold each run's own `cage_base >> 32` in its upper word, at the same four
offsets, eighteen times running. The only other in-cage hits — 9601 `+0x32c68`, 9611 `+0x34ea4`, 9623
`+0x18931c` — are **4-aligned**, appear in one run each, and are what the noise actually looks like.

### 2b. The byte dump says what it is [M for the bytes, I for the identification]

Port 9617, `cage_base = 0x3d500000000`, three separate pages (little-endian, offsets compressed):

```
    +0040  0000040000000000 00000400d5030000     size_ = 0x40000   end = cage+0x40000
    +0050  0000000000000000 68000000d5030000                       start = cage+0x68

  +1c0040  0020010000000000 00201d00d5030000     size_ = 0x12000   end = cage+0x1d2000
  +1c0050  0000000000000000 68001c00d5030000                       start = cage+0x1c0068

  +280040  0050010000000000 00502900d5030000     size_ = 0x15000   end = cage+0x295000
  +280050  0000000000000000 68002800d5030000                       start = cage+0x280068
```

Three independent pages, one layout: a **size** at `+0x40`, an **end address** at `+0x48` equal to
`page + size`, and a **start address** at `+0x58` equal to `page + 0x68` (the header size). The sizes
match this run's own region table to the byte (`0x390001c0000 size 0x12000`, `…280000 size 0x15000`).
This is a V8 page/chunk metadata header carrying raw `area_start_` / `area_end_` `Address` fields,
allocated **inside** the cage. Naming the exact V8 class is [I]; the layout, the values and their
agreement with the region table are [M].

### 2c. Why W35 can read it — mechanism, not fired [I]

`arbRead64` is **not** an OOB walk, so direction and distance are irrelevant. From W35 §3 (p37):

```js
arbRead64(A) = { vic[0] = fromBits(0x20000, (A-7)); return bitsOf(B[0]); }
```

`vic[0]` overlays the slave array's `{elements@8, length@12}`. The low half sets
`B.elements = A-7` (a compressed tagged pointer ⇒ object at `cage_base + A - 8`) and **the high half
supplies the length itself**, `0x20000`. `B[0]` therefore lands at `(A-7-1)+8 = A`, and index 0 is in
bounds **regardless of anything stored at the target** — there is no dependence on the victim's own
header words. `A = 0x58` is 8-aligned and in range; the page is `R--` and this is a read.

⇒ `arbRead64(0x58)` returns `{hi: cage_base>>32, lo: 0x68}`, so `cage_base = hi << 32`.
**Not fired.** This is a mechanism reading of W35's own helper against a measured value — **[I]**.

---

## 3. Q1 — the full signed distribution of every cage-base copy [M]

Not "64 of 195 in one run": every copy, every run. Clusters below are **8-aligned only** (the
4-aligned residue is noise); the total column counts every hit at either alignment.

| port | total | clusters (signed TiB from cage : count) |
|---|---:|---|
| 9601 | 131* | −2.93T:99  −1.33T:10  +124.43T:5 |
| 9603 | 279 | −1.10T:231  −0.03T:2  +126.39T:5 |
| 9605 | 67 | −2.27T:52  +125.22T:6 |
| 9607 | 87 | −1.89T:52  −0.03T:2  +125.41T:11 |
| 9609 | 124 | −1.83T:105  +125.66T:7 |
| 9611 | 263 | −0.67T:152  **+1.31T:24**  +126.79T:10 |
| 9613 | 124 | −1.71T:80  −0.03T:1  +125.78T:8 |
| 9615 | 189 | −3.20T:165  −1.43T:1  +124.21T:7 |
| 9617 | 91 | −3.33T:62  +124.16T:9 |
| 9619 | 390 | −0.52T:322  **+1.31T:3**  +126.94T:1  +126.97T:12 |
| 9621 | 319 | −1.79T:264  −0.04T:4  +125.30T:5 |
| 9623 | 132 | −0.12T:68  **+1.56T:3**  +127.37T:5  +127.38T:4 |
| 9625 | 116 | −0.43T:80  **+1.41T:2**  +127.06T:8 |
| 9627 | 262 | −1.34T:194  −0.03T:5  +125.79T:7 |
| 9629 | 93 | −2.01T:45  −0.15T:5  +125.48T:5 |
| 9631 | 136 | −1.20T:86  −0.04T:3  +126.29T:6 |
| 9633 | 197 | −0.07T:147  **+1.23T:2**  +127.32T:11 |
| 9635 | 275 | −2.09T:238  −0.69T:2  +125.40T:7 |

\* 9601 ran the first build, whose record array filled with DLL-internal pointers; its aggregate
count (144) is complete but its CSV is truncated. Fixed for every later run.

Corrections to W49's reading:

* **"all 64 logged copies lay below the cage" generalised wrongly.** Every run has copies above it,
  in **DLL `.data` at +94 … +127 TiB**, which W49 could not see because it skipped `MEM_IMAGE`.
* Of those, **five RVAs in `Qt6WebEngineCore.dll` hold a copy in 9 of 9 runs checked**:
  `0x0b272028`, `0x0b272048`, `0x0b3535d0`, `0x0b395850`, `0x0b395960` — genuine globals. The DLL base
  is a per-boot constant (`0x7ffdd8530000` in all 18 runs). Every other DLL RVA appears in one run
  only: the 4-aligned noise class.
* **In-cage copies: 0 in 18/18.** The single in-cage class-A hit (9621, `+0x2cf0c`) is 4-aligned,
  i.e. a two-compressed-slot straddle, and does not recur.
* Totals vary **67 – 390** per run; "~195" was not a stable count.

---

## 4. Q2 — distance from A4's anchors, and a correction [M]

The brief asked for the distance from `dt_elems` on the grounds that "A4's read is ±32 GiB anchored
at `dt_elems`". Two things need fixing before the numbers mean anything:

1. **The ±32 GiB window is around `tables.data()`, not `dispatch_tables`.** W43 §7: the OOB READ is
   `module->tables[K]` based at `tables.data()` (C++ heap, 32-byte granular, ±32 GiB); the OOB WRITE
   is based at `dispatch_tables` (trusted space, 4-byte granular, ±2 GiB). Different objects in
   different reservations, coupled only through `K`.
2. **A4's read cannot extract a value.** It reads the `.shared` byte, and the write proceeds only if
   that byte is zero (W43 §7's coupling constraint). It is a **1-bit oracle at 32-byte stride**,
   destructive per probe. A pointer inside its window cannot be read out of it.

Measured anyway, both windows, per run:

| | class A | class B | class C1 |
|---|---:|---:|---:|
| within ±2 GiB of `dispatch_tables` (A4 WRITE) | **0 in every run** | 0 | 3 |
| within ±32 GiB of `tables.data()` (A4 READ) | 55 – 343 | 4281 – 12520 | 111 – 159 |
| nearest class-A copy to `tables.data()` | **+22 592 B** (9601); +1.067 MiB (9603) | | |

So the brief's instinct about *where* the anchors are was right — the C++ heap around
`WasmModule::tables` is dense with them, the nearest cage-base copy **22 KB** from A4's read base —
and wrong about the primitive. Worth recording as a standing target: **any future value-read anchored
in the C++ heap wins immediately.**

---

## 5. Q3 — above the cage, inside W42's ladder [M]

For most runs the answer is stark: **there is nothing above the cage to read at all** until +5.7 TiB
or beyond. Committed regions above the cage in a typical run (9601):

```
  cage+128 KiB … cage+2.75 MiB   the cage's own 7 committed regions (3.23 MiB total)
  cage+16.000 GiB                one 4 KiB page
  cage+10.9219 TiB               dispatch_tables / trusted space
  cage+12.8996 TiB               3 JIT pages
  … nothing until the DLL cluster at +122 … +127 TiB
```

Every histogram bin from `+<1 GiB` through `+<4 TiB` is **zero for every class**. The V8 sandbox
reservation (992 GiB, `cage+32 GiB … cage+1 TiB`) is committed only in that first 3.23 MiB.

**Five runs of eighteen are different.** In 9611, 9619, 9623, 9625 and 9633 a C++ heap arena landed
**+1.31 / +1.31 / +1.56 / +1.41 / +1.23 TiB** above the cage — inside W42's byte-exact 4 TiB / 1025-hop
ladder — carrying *both* anchors:

| port | 8-aligned cage-base copies in ladder | C1 code-pointer holders in ladder | of which point into the V8 code range |
|---|---:|---:|---:|
| 9611 | 24 | 26 | **20 / 26** |
| 9619 | 3 | 26 | **20 / 26** |
| 9623 | 3 | 26 | **20 / 26** |
| 9625 | 2 | 26 | **20 / 26** |
| 9633 | 2 | 26 | **20 / 26** |
| other 13 runs | 0 | 0 | — |

9611's table is contiguous and unmistakable: `0x282e6530000` → `0x7ffdb6c40040`, `+0x10` →
`0x7ffdb6c40180`, `+0x20` → `0x7ffdb6c40340`, … a 16-byte-stride table of raw code addresses.

In those layouts W42's ladder alone supplies a copy of the cage base *and* the absolute code range —
the entire anchor problem, from a primitive already held. **5 of 18 ≈ 28 %: a per-launch lottery, not
a method** — but a lottery with no fatal cost for losing, unlike guessing `k`. Note the positive
distances cluster tightly (1.23–1.56 TiB) and the negative ones span −0.12 … −3.33 TiB, so the arena
appears to be placed at a *bounded* distance with a random sign; that is worth confirming, because a
bounded distance is what makes the ladder a viable route rather than a coincidence.

---

## 6. Q4 — code pointers, and the second unknown [M]

Class C1 (holders of a raw pointer into non-image executable memory) is a **stable structure**: a
26-entry cluster in every usable run, plus ~110–160 in the main C++ heap. Only its position moves:
−0.03T, −0.32T, −1.43T, −1.94T, **+1.23T / +1.31T / +1.41T / +1.56T**. Class D (runs of ≥64 consecutive code
pointers): ~1799 per run, overwhelmingly DLL import tables at +124 TiB.

The V8 code range is where W48 measured it and is re-confirmed here: **`0x7ffdb6c00000`, allocation
base `0x7ffdb6c00000`, `Qt6WebEngineCore.dll − 537.188 MiB`, an `R-X` page at +0 and an `RWX` 512 KiB
region at +0x40000** — identical in all 18 runs (same boot).

**And the cage tells the page nothing about it.** The decisive pass — every 4-aligned qword in
committed cage memory whose value lands in mapped memory outside the cage — over the 9 runs that
carried it:

| | result |
|---|---|
| strict out-of-cage disclosures per run (9 runs) | **0, 2, 2, 1, 1, 1, 0, 1, 0** |
| how many recur at a fixed compressed offset | **0** — every one appears in exactly one run |
| their values | `0x…00000008`, `0x…00001685`, `0x…00000000` — two adjacent compressed slots whose upper word happens to match some region's 4 GiB base |
| any code pointer / DLL pointer / C++-heap pointer | **none** |
| raw in-cage addresses in the same pass | 7 – 16 per run (§2's four, plus uncommitted-target variants) |

The strict test requires the target to be **committed**, so a pointer into reserved-but-uncommitted or
since-freed memory would be missed. Upper bound with that filter removed — every 8-aligned in-cage
qword with a non-zero high half, whatever it points at (ports 9633 / 9635):

```
  129 198 / 129 218 candidate qwords, 64 distinct high halves
  high 0x00000002 x2496   0x00000775 x1876   0x000001ad x1582   0x0000000c x1313
       0x00000785 x1068   0x00000010 x458    0x00000004 x416    0x000007a9 x312
       0x0000079d x301    0x00000085 x251    0x000004cd x159    0x0000000a x128   …
  every one: "no mapped region at that 4 GiB base"
```

Not one of the 24 most common high halves corresponds to a mapped 4 GiB base, none is the DLL's
`0x00007ffd`, none is the trusted-space base. They are small integers — i.e. the upper compressed slot
of an adjacent pair, exactly the artefact the §1 validator was written for. **The negative survives
with the filter removed.**

Against §2a's four offsets recurring 18/18, the contrast is the whole point: the in-cage anchor is
structural, these are noise.

⇒ **W35 + the §2 offset yields `cage_base`. It does not yield `code_range`.**

---

## 7. What this changes for V8 issue 421403261

`k = (code_range − cage_base) >> 32`. W49's no-go was that both terms were unknown, leaving a lottery
with a fatal access violation per miss. This wave's own samples make the lottery worse, not better:
**18 new cage bases, 18 distinct `k`, spread 823 (31784 … 32607)**; unioned with W48+W49's 13 samples,
**31 samples, 31 distinct values, range 31784 … 32607 ⇒ ≥824 candidates**, no repeat in 31 draws.

| term | status |
|---|---|
| `cage_base` | **available in every run** from a fixed in-cage offset, with a primitive already held (W35, 4/5 on shipped Qt). [M for the value, I for the read] |
| `code_range` | **still unknown.** A per-boot constant, but disclosed nowhere the page can read. Available only in the minority layout of §5 (5 of 18), where W42's ladder reaches a code-pointer table. |

The line has moved from *"the page can learn no absolute address at all"* to *"the page can learn its
own cage base every time, and needs one more disclosure — the code range — which exists but is out of
reach in 13 of 18 layouts."*

**Ranked next steps, by what these measurements say:**

1. **Fire it.** `arbRead64(0x58)` on the shipped build, A/B against patched Chrome 150. This is the
   one claim in §2 that is [I] rather than [M]; it is a single call on an already-demonstrated
   primitive, and it converts the whole of §2 into a fired result. Cheapest high-value step by far.
2. **Re-ask reach now that `cage_base` is known.** With it, 421403261's *read* (`array.get`,
   byte-granular, whole address space — W49 §2a) becomes an **absolute read**, not just an absolute
   write. A miss is still fatal, so the question becomes: *is there any address at a bounded,
   always-mapped offset from `cage_base` that holds a code pointer?* §6 says not inside the cage; the
   sandbox reservation's committed tail and the region immediately following it were not swept for
   this and should be.
3. **Characterise the §5 layout.** Five of eighteen, all positive distances in 1.23–1.56 TiB. If the
   arena is placed at a bounded distance with a random sign, the ladder closes the gap ~28 % of
   launches with no new bug and no fatal cost on a miss — which beats every other open option.
4. **Do not pursue A4's read as a leak** (§4): 1-bit oracle at 32-byte stride, destructive per probe.

---

## 8. Honest boundaries

* **Nothing was fired.** No exploit primitive ran; the harness only read its own memory.
* §2c (that `arbRead64` can read those bytes) is a mechanism reading of W35's helper — **[I]**.
* Identifying the in-cage structure as V8 page metadata is **[I]**. The bytes, values, offsets and
  the 18/18 reproduction are **[M]**.
* The `.shared`-byte reading of A4's read (§4) is from W43's own text, not re-measured here.
* All runs use a light recon page. A real product page has a far larger in-cage heap; `+0x48` and
  `+0x58` sit at the very start of the cage and should be unaffected, but `+0x1c0058` / `+0x280058`
  are layout-dependent and are **not** claimed stable in the product.
* §5's 5-of-18 is a small sample and the runs are on one machine, one boot.
* **Code execution remains NOT achieved.** Nor is any escape beyond what W42+W43 already hold. This
  wave supplies one of two missing inputs to one candidate bug.

---

## 9. Artifacts

* `scratch/w52anchor/w52anchor.c` / `.exe` — the harness (`/guard:cf`, PE `0xc160`, matching
  `QtWebEngineProcess.exe`). `w52anchor.exe SECS PORT`.
* `scratch/w52anchor/w52-map.html` — recon page, byte-identical to `w48-map.html`, so the anchors are
  the same objects W47 and W48 measured.
* `w52run.py`, `batch52.py` (strictly sequential, fresh port per run), `agg52.py` (cross-run).
* Per run: `w52anchor-<port>.log`, `w52hits-<port>.csv` (every hit with all three signed distances),
  `w52above-<port>.csv` (every committed region above the cage), `w52incage-<port>.csv` (§6),
  `w52sum-<port>.json`.

**Harness defects found here — do not re-inherit:**

1. **Record-array priority.** Admitting classes C2/C3 fills the hit array with ~850k
   DLL-`.data`→DLL-`.text` pointers per run and truncates the classes that matter (9601 lost 13 of
   144 class-A records). Record A/B/B2/C1 unconditionally; admit C2/C3 only above the cage and inside
   16 TiB.
2. **The small-integer trap.** `cage_base >> 32` is a small integer, so inside the cage any 8-byte
   window whose upper word holds it looks like a pointer. Validate (map→meta-map) *and* require
   reproducibility across runs with different cage bases. Reproducibility is the stronger test;
   alignment is the cheap tell (everything real here is 8-aligned).
3. **`MEM_IMAGE` must be scanned.** W49 skipped it and so missed every copy above the cage, including
   the five stable `Qt6WebEngineCore.dll` globals.
4. **Rebuilding while a run is live** fails with `LNK1104` — the previous harness process can outlive
   the runner's `taskkill`. Check for a stale `w52anchor.exe` process before building.
5. `cmd //c "build.bat …"` from git-bash does not find the script; use `.\build.bat` from
   PowerShell/cmd. A silently failed rebuild produced one run's worth of data from the old binary.
6. `re.search(r'(\d+)', 'w52hits-9601.csv')` matches `52`, not the port. Anchor the pattern.
7. Carried from W49 and still true: `local.set` of an `i32.const` emits no Liftoff code; this build
   compiles wasm lazily, so an uncalled function has no machine code; region walks must not skip to
   the end of a reservation.
