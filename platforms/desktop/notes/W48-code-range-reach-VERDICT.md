# W48 — is the V8 code range writable by A4's out-of-cage write?

Written 2026-08-05. Continues W43 (out-of-cage WRITE), W42 (out-of-cage READ), W46 (A1 class
empty; an out-of-cage write is by itself enough for code execution on this build).
Every line **[M] measured** on the shipped AWS Wickr desktop (Qt WebEngine 6.9.2, Chromium base
130.0.6723.192, declared patch level 139.0.7258.67) unless marked **[I] inferred** or **[P]
public source read at the pinned ref**. Harness/pages `scratch/w48/`.

**Reconnaissance only. No primitive was fired, nothing was written to the renderer, no code was
executed.** The one page-side probe (§6) uses only in-bounds indices.

---

## 0. Bottom line

> ### **NO. The V8 code range is not within A4's ±2 GiB window — not in any run, and not by a small margin.**
> Closest of 6 runs: **+5402.9 GiB**. Furthest: **+98098.9 GiB**. A4's reach is ±2 GiB.
> The gap is ~2700× the entire reach at its narrowest. **[M, 6/6]**

The same holds for every other code-bearing structure: the wasm code space, the
`CodePointerTable`, and the `WasmCodePointerTable` are all out, in all 6 runs.
**The only thing inside A4's window is trusted space itself** — 0.50–0.75 MiB committed.

The contingency (V8 issue 421403261) **passes both gates at the pinned ref and its reach does
close the gap** — but with an important correction to how it was characterised (§6).

---

## 1. Why the answer is structural, not incidental [M + P]

`v8/src/heap/code-range.cc` (pinned, `branch-heads/13.0`) places the code range **near the
embedded blob**, i.e. keyed to the DLL's load address:

```cpp
Address four_gb_cage_start = RoundDown(embedded_blob_code_start, k4GB);   // line 326
```

`dt_elems` is keyed to V8's **per-process** trusted-space reservation. So the two anchors come
from **two independent ASLR sources**, and this is exactly what the runs show:

| | address across 6 runs | distance from `dt_elems` |
|---|---|---|
| V8 code range | `0x7ffdb6c00000` — **CONSTANT** | **varies, spread 92,696 GiB** |
| Qt6WebEngineCore.dll | `0x7ffdd8530000` — **CONSTANT** | varies identically |
| trusted space base | 6 distinct values | **CONSTANT** (`dt_elems` is inside it) |

The code range does not move because a DLL's load base is randomised **once per boot**, not per
process. `dt_elems` moves every run. Their distance is therefore never small and never
controllable — there is no run to wait for and no groom to attempt. **[M]**

Corollary worth keeping: `code range − Qt6WebEngineCore.dll base = −563281920 (−0.52 GiB)`,
**identical in all 6 runs [M]** (across boots: [I], but it follows from the algorithm above). So
a leak of the DLL base yields the code range exactly — relevant to any later stage, useless to A4.

---

## 2. The distance table — harness column [M, 6 runs]

Signed byte distance from `dt_elems`. A4 reach = **±2 GiB, 4-byte quantised** (W43 §7).

| anchor | min (GiB) | max (GiB) | in ±2 GiB |
|---|---:|---:|---|
| V8 code range start | +5402.9 | +98098.9 | **0 of 6** |
| V8 code range end | +5403.4 | +98099.4 | **0 of 6** |
| wasm code space | −112094.1 | +61368.8 | **0 of 6** |
| `CodePointerTable` | −123364.4 | −31291.1 | **0 of 6** |
| `WasmCodePointerTable` | −125148.0 | −32452.0 | **0 of 6** |
| pointer-compression cage base | −122972.0 | −31256.0 | 0 of 6 |
| `WasmModule::tables` (READ base) | −125147.9 | −32451.9 | 0 of 6 |
| Qt6WebEngineCore.dll | +5403.4 | +98099.4 | 0 of 6 |
| **trusted space base** | −0.0 | −0.0 | **6 of 6 ✓** |
| **trusted space committed hi** | +0.0 | +0.0 | **6 of 6 ✓** |

Raw per-run addresses: `scratch/w48/w48anchors-92{01,03,05,07,09,11}.json`;
regenerate with `python scratch/w48/agg48.py`.

### What is actually inside the ±2 GiB window
Identical in all 6 runs — **4 regions, and all of them are trusted space**:

```
0x..00000000  0x1000      commit  RW-  private     (trusted space head)
0x..00001000  0x3f000     reserve
0x..00040000  0x80000     commit  RW-  private     (contains dispatch_tables)
0x..000c0000  0x3ff40000  reserve
-> committed 0.50 MiB (0.75 MiB in one run), reserved 1023.5 MiB
```

No image, no JIT, no pointer table, no C++ heap. **A4 can write to trusted space and to nothing
else.** [M]

---

## 3. Identification evidence (so the table is not guesswork)

* **V8 code range** — the 512 MiB reservation at `0x7ffdb6c00000`; `kMaximalCodeRangeSize =
  512 * MB` on x64 (`globals.h:447`, pinned) [P]. Contains the page's own optimised-JS
  immediates (`0x47b1c0de`, `0x47b3c0de`) in **RWX** pages at `0x7ffdb6c4xxxx` [M].
* **wasm code space** — a separate, much smaller `WasmCodeManager` reservation holding the
  page's wasm body immediates `0x47a1c0de..0x47a8c0de`, again **RWX** [M].
* **`CodePointerTable`** — found by its exact documented layout, not a heuristic. Entry is
  16 bytes `{ entrypoint_ ; code_ }` where `code_` is a **full 64-bit pointer to a `Code`
  object**, and `Code : public ExposedTrustedObject` ⇒ trusted space (`code-pointer-table.h`,
  `code.h:62`, pinned) [P]. Measured entry 0, all 6 runs:
  `entrypoint_ = 0x7ffdb6c40040` (inside the code range, constant) and
  `code_ = trusted_base + 0x80044` (tracks trusted space per run) [M]. That is the signature and
  essentially nothing else has it.

**The `CodePointerTable` matters more than the code range**, and it is also out of reach: under
`V8_ENABLE_SANDBOX`, `Code::kInstructionStartOffset` has **size 0** — a `Code` object holds no
raw entrypoint at all; the entrypoint exists only in the CPT (`code.h:384-389`, pinned) [P]. So
"corrupt a `Code` object in trusted space to redirect execution" is **not available**: the field
isn't there. The one field that would do it lives 31,291–123,364 GiB outside A4's window. [M+P]

---

## 4. The page column — what the *exploit* can see, not just the harness

The usable set is the intersection, and it is **smaller** than the harness column. Neither
page-side read primitive can reach any code-bearing structure, for structural reasons already
measured in earlier waves:

| primitive | anchor | reach | reaches code range? |
|---|---|---|---|
| W42 SlicedString OOB read | cage base | positive only; ≤4096 hops × ≤4 GiB ⇒ **≤16 TiB**; demonstrated 1.25 TiB | **No** |
| A4 OOB read (`tables[K]`) | `tables.data()` | **±32 GiB**, 32-byte granular (W43 §7) | **No** |

The code range sits at `0x7ffd…`, i.e. **~139 TiB above the cage base** in these runs [M]. W42 §7
already recorded this exact limitation for the same address band: landing on a loaded module's
header is *"impractical here… ~127 TiB away… ~32,000 hops at ≤4 GiB each, over the per-call hop
cap"*. The code range is 0.52 GiB below Qt6WebEngineCore.dll, so it is in that same unreachable
band. **[M addresses; M reach caps from W42 §7 / W43 §7; I the composition.]**

No new W42 chain was fired in this task — the reach caps are quoted from where they were
measured, not re-measured here.

**Consequence: even if the write could reach the code range, the page could not locate it.** Both
halves fail independently.

---

## 5. Write-count feasibility — NOT measured here [honest gap]

The brief asked to confirm burst-firing (K re-chosen per firing, renderer survival across
repeated firings, per-firing cost). **This was not measured in W48** — it requires firing the A4
primitive repeatedly, which is the next task's work, not reconnaissance. What is already known:

* W43 measured **one** firing per page load: renderer survives, 5/6 byte-exact [M, W43 §6b].
* Repeated firings **within a single page load were never measured** — do not assume them.
* Recorded pitfall that still applies: **W35's `arbRead64` allocates** (`bitsOf`), so
  allocation-free helpers are required inside any burst or the groom is disturbed.

This is moot for the code-range route (§0) but not for a trusted-space-only route (§2).

---

## 6. Contingency: V8 issue 421403261 — **gates PASS, reach closes the gap**

Fix commit **`df3874776c39`, 2025-06-02, "[liftoff] Ensure zero-extension of returned i32
values", `Bug: 421403261`, no CVE** (found via GitHub commit search; gitiles path-filtered `+log`
401s as recorded).

**Gate 1 — fix absent from this build.** `clear_i32_upper_half` occurs **0 times** in
`src/wasm/baseline/liftoff-assembler.cc` at `branch-heads/13.0`; `FinishCall`'s return-handling
loop has no zero-extension [P]. The fix postdates the V8 G1 cutoff (`branch-heads/13.0` @
2025-01-06) and carries **no CVE**, so Qt's CVE-keyed backport ledger cannot have picked it up
(the same structural argument that held for W43's own bug). **PASS** [P/I].

**Gate 2 — vulnerable code present in the base.** Both premises verified at the pinned ref [P]:
* `SignatureHasher` buckets only *tagged/untagged × register/stack* — **i32 and i64 hash
  identically**, exactly the collision the fix message describes.
* `LiftoffCompiler::ParameterProcessor` **already** calls `clear_i32_upper_half`
  (`liftoff-compiler.cc:779`) — the parameter side was hardened, which is what makes the
  unhardened *return* side a real gap rather than an unreachable one.
* `SignatureHasher::Hash` is live in the dispatch path (`wasm-objects.cc:1709, 2755`).
**PASS.**

### ⚠ Correction to how this lead was characterised
It is **not** a plain-JS bug. The regression test lives in `test/mjsunit/sandbox/` and runs with
`--expose-memory-corruption-api`. Before the confused call it performs an **in-cage 32-bit
write** to make the signature check pass:

```js
// typeinfo_sub.supertypes[0] = map_sup   -- set $sig_l_l <: $sig_i_l
setField(typeinfo_sub, kTypeInfoSupertypesOffset, map_sup);
```

Only *after* that corruption does the hash collision matter. **Measured on the shipped build
[M]** (`scratch/w48/w48-gc.html`, port 9223), with the uncorrupted path:

```
validate:true  instantiated:true  gc:true         <- WasmGC i8 arrays work
ctlOk:true                                        <- CONTROL: call_indirect declaring the TRUE
                                                     (i64)->i64 type succeeds => table populated,
                                                     encoding correct
collisionAllowed:false                            <- same entry declared (i64)->i32 TRAPS
   "RuntimeError: null function or function signature mismatch"
```

The control matters because V8's trap message conflates *empty table* with *rejected signature*;
`ctlOk:true` proves it is the latter. **This negative is the expected pre-corruption behaviour
and does NOT refute the bug** — it confirms the canonical subtype check is the gate that the
in-cage write is there to defeat.

**This is good news, not bad:** the precondition is an in-cage 32-bit arbitrary write, which is
exactly what W35 holds.

### Reach — this is what closes the gap
Bounds check sees only the low 32 bits (`kI32`); the address computation uses the full 64-bit
value; `kWasmI8` elements avoid a shift. So reachable = `array_base + (k<<32) + low`, with
`low < array_length` and `k` a full 32-bit value:

* **stride 4 GiB, fine window = the array length** (the test uses `0x100000` = 1 MiB) — a
  completely different shape from A4's *4-byte quantised, ±2 GiB*. Not a duplicate. [P]
* code range is ~139 TiB above the cage ⇒ **k ≈ 35,660**, trivially inside `k`'s range [M+I].
* residue condition `(target − array_base) mod 2^32 < length`: `array_base` is knowable via W35
  `addrof`, and the code range address is **constant**, so the required `low` is computable;
  tuning it means choosing among array allocations across the 4 GiB cage. **[I — not measured.]**
* Liftoff-only (the bug is in the baseline compiler), so the function must not have tiered up —
  true for early calls. **[I]**

**NOT measured and must not be claimed:** that the shipped *binary* omits the return
zero-extension, and that the corrupted path actually yields an out-of-bounds access. Both need
the primitive fired. Source-level gates only.

---

## 7. Verdict and what the next stage should target

1. **Is the V8 code range writable by A4's primitive? — NO.** 0 of 6 runs, closest +5402.9 GiB
   against a ±2 GiB reach, and the distance is unstable by ~92,696 GiB because the two anchors
   have independent ASLR. Not a near miss; do not plan around it. **[M]**
2. **A4's window contains only trusted space** (0.50–0.75 MiB committed, 6/6). Any A4-only plan
   must be a trusted-space data-only attack. Note that the obvious such target is closed:
   `Code` has **no** `instruction_start` field under the sandbox [P].
3. **The page cannot even see the code range** with either read primitive (§4) — an independent
   second failure.
4. **Pivot to V8 issue 421403261.** Both gates pass at the pinned ref, its 4 GiB-stride reach
   spans the ~139 TiB to the code range, and its precondition (in-cage 32-bit write) is already
   held by W35. Its target — the code range — is **RWX** [M], which with W46's findings (no
   bytecode verifier, no `GeneratedCodeValidator`, PKU compiled out, C++→JIT edge `guard(nocf)`)
   is the route that does not need a control-flow hijack.
   Confirmed here for the CFG question: JIT pages report **VALID TARGET** with all-ones bitmap
   words, so CFG does not constrain calls into JIT code [M].

**Still NOT achieved: code execution.** Nothing in W48 was fired.

---

## 8. Artifacts
* `scratch/w48/w48map.c` / `w48map.exe` — the mapper. Derived from W47's, with three fixes:
  `find_mark` now runs **before** `find_sandbox` and validates the reservation against the cage
  (W47 accepted the 2 TiB MEM_MAPPED CFG bitmap as "the V8 sandbox" in **4 of its 7 runs**);
  JIT identification scans **executable memory only** (W47 scanned 1013 MiB and was killed by the
  pump before the decisive sections ran — 9109/9111/9113 all truncate mid-scan); every constant
  hit is re-queried on its own address (W47 classified hits from a stale MBI, which is why its
  output appeared to show JIT constants "in MEM_IMAGE" — they were the harness's **own** image).
* `scratch/w48/w48-map.html` — recon page (unchanged from W47's).
* `scratch/w48/w48-gc.html` — WasmGC / signature-collision capability probe, in-bounds only.
* `scratch/w48/agg48.py`, `batch48.py` — aggregation and the 6-run driver.
* Logs `w48map-92*.log`, region CSVs `w48regions-92*.csv`, anchors `w48anchors-92*.json`.
