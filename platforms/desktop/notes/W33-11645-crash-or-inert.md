# W33 — CVE-2026-11645 on the shipped build: crash-or-inert, and why

Written 2026-08-05. Goal in force: **an observable info-leak** (an address value readable
from JS on the attacker's page), which is the single missing piece for composing with W27c's
verified controlled write. Every line below is **[M] measured** on the shipped Qt WebEngine
(Chromium base 130.0.6723.192) unless marked **[I] inferred**.

**Bottom line: no info-leak. What CVE-2026-11645 gives on this build is a deterministic,
flagless, remote renderer abort — or nothing at all — depending on a value the attacker
selects from a fixed menu but does not control.** That is a sharper and less favourable
result than W31's "corruption stays in-object", which was an artifact of testing only one
configuration.

---

## 1. Harness (reusable) [M]

`scratch/w33/ab.py` — serves one page on 127.0.0.1:8495 (and :8496 for the fault dumper),
runs it on BOTH the shipped Qt WebEngine and the patched Chrome 150 control, collects the
page's beacons per side, reports the process exit code, and greps the Qt runner's stdout for
`onRenderProcessTerminated`.

Two harness traps found and fixed, worth remembering:
* **Stale listeners silently hijack the port.** Windows `SO_REUSEADDR` lets a second process
  bind an already-LISTENING port; a leftover server from the previous session swallowed every
  request and the run looked like "the page never executed" (curl returned the *old* page's
  byte count — that was the tell). `ab.py` now binds with `SO_EXCLUSIVEADDRUSE` and fails loudly.
* **W27's `cssfault.c` VEH only logged AV-class exceptions**, so a deliberate abort produced an
  empty fault report. `scratch/w33/w33fault.c` widens the filter to `EXCEPTION_BREAKPOINT`,
  illegal instruction, `0xC0000409`, `0xC0000420`.

Baseline re-verified through the new runner [M]: shipped Qt → `o2.AA` undefined, 199/200
anomalies; Chrome 150 → `1.1`, 0/200. Unchanged from W31.

---

## 2. ★ The new measurement: it kills the renderer [M]

Trigger shape (self-written from the vendor regression test), `nPad` = number of computed
class fields declared BEFORE the reconfigured one:

```js
class extends Function { [K[0]]=V[0]; ... [K[nPad]]=T; }   // T: 2 then 1.1
```

* `nPad = 0` → survives. `o2.AA` undefined, **`ownF = 0`** (the property is simply gone),
  everything else intact.
* `nPad = 1` → **renderer dies**, deterministically, product-like flags (`WGLFLAGS=""`),
  plain page over HTTP, both sentinel values tried. Exit code **`0x80000003`
  (STATUS_BREAKPOINT)** — a deliberate abort, not a wild write.

W31's "no crash, corruption contained in-object" came from the `nPad = 0` case only. One
padding field changes the outcome completely.

### The abort site, identified without symbols [M]

`w33fault.exe` (VEH, `--single-process`) caught it:

```
FAULT #1  code=0x80000003 (int3)  Qt6WebEngineCore.dll+0x1ac19f6
RAX=8 RBX=8 RCX=4 RDX=7 R9=7 R12=8 R15=8
```

Disassembling backwards (`scratch/w33/pestr.py`, RVA→file-offset + rip-relative string
extraction) the int3 is the trap arm of a 6-case jump table whose cases load the strings
**`'v' 't' 's' 'd' 'h' 'w'`**. That is exactly V8's

```cpp
Representation::Mnemonic()   // kNone kTagged kSmi kDouble kHeapObject kWasmValue
  default: UNREACHABLE();    // <-- Qt6WebEngineCore+0x1ac19f6
```

and the faulting **`RDX = 7`** is the representation kind — **out of range (valid 0..5)**.

⇒ **Measured proof that the out-of-bounds `GetDetails` returns garbage `PropertyDetails`**,
and a measured value of the garbage: representation kind 7.

---

## 3. The knob, and its limit [M]

The descriptor index consumed by the out-of-bounds read is the reconfigured field's position,
i.e. `nPad`. So `nPad` selects **which** out-of-bounds bytes are read — a real, tunable knob
that W31 concluded did not exist.

Sweep, one configuration per process (a crash ends the run, so the sweep must be driven from
outside the page):

| nPad | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 16 | 24 | 32 | 48 | 64 | 96 | 128 | 192 | 256 | 384 | 512 | 768 | 1000 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | ok | **X** | **X** | ok | **X** | ok | ok | ok | ok | **X** | ok | **X** | ok | **X** | **X** | ok | ok | **X** | ok | ok | **X** | ok | ok | ok | **X** |

Structured, reproducible, and still firing at `nPad = 1000` (≈12 KB past the empty descriptor
array). **X** = renderer abort; **ok** = property silently vanishes.

**But the knob only selects; it does not control.** The bytes being read are past V8's shared
**empty descriptor array, which lives in read-only space** — fixed at build time and not
attacker-writable. The attacker picks an entry from a fixed menu; the menu's contents are the
build's.

---

## 4. Why "inert": no write happens on the surviving indices [M]

Two independent hunts, both negative:

* `p5-hunt.html` — 4,000 boxed doubles before the trigger, 4,000 more between the two
  instantiations, 200 PACKED_DOUBLE arrays, 200 length probes. **0 hits**, nPad ∈ {3,5,6}.
  (Design flaw, noted: every victim was allocated *before* the firing instance, so a store
  running off the end of the object would land in fresh unallocated space. This run could not
  have seen a hit even if one occurred.)
* `p6-neighbour.html` — fixes that: 300 rounds of *instance, then marker* interleaved, so every
  firing instance is immediately followed by an identifiable object (three distinct doubles +
  a 2-element array). Scanned all markers, all instances' every field. **0 hits**,
  nPad ∈ {5, 8, 16, 64}.

⇒ On the surviving indices the whole observable effect is that the reconfigured property is
lost. No adjacent smash, no changed length, no stray `1.1`.

**[I] Reading that fits all of it:** the garbage details are inconsistent; when the
representation is valid the property-addition path bails without storing, and when it is
invalid V8 trips a check whose *failure-message formatting* calls `Mnemonic()` on the garbage
and dies in the reporter. The `int3` is a defensive abort catching the confusion, not a
memory-safety fault. Not proven — the caller chain (`+0x1b32255`, `+0x1b30bf2`, `+0x1b08734`,
`+0x1983595`, `+0x198001e`, `+0x1b08918`, `+0x1c0205b`, `+0x6f6ded2`) has no strings that name
it; the nearest are formatter-looking fragments `'min2'`, `'on-aligned'`, `'/w'`.

---

## 4b. ★★ REVISION — it is NOT inert. The store primitive is real, and measured [M]

Section 4's "crash-or-inert" verdict was drawn before the source was pinned. It is **superseded**:
the store *does* execute, with a fully attacker-controlled value, and only the destination is
still out of reach. What changed the picture was reading the actual V8 source and one prior
disclosure.

### The published blueprint: CVE-2024-5830 [PUBLIC-SOURCE]
The **same defect in the same function** was disclosed in 2024 by buptsb (Bohan Liu) and, with a
full renderer-RCE chain, by Man Yue Mo / GitHub Security Lab. Fix commit `3c869652b039`'s own
regression-test comment confirms 11645 is that defect reachable through a *second* entry path
(`Map::PrepareForDataProperty`, guarded only after `Map::Update`). buptsb states the primitive
outright: *"a Smi value in user controlled dict can be taken as a boxed HeapNumber, and trigger a
OOB write at any address."*
⇒ **Weaponization does not depend on the withheld 11645 ITW exploit.** W32's "no public technique"
finding was scoped to *post-139 CVEs*; it missed that a 2024 CVE documents this exact code path.

### Source-verified mechanics (v8 branch-heads/13.0) [M]
`JSObject::WriteToField` is in **js-objects-inl.h:471-497** (not js-objects.cc):
```cpp
FieldIndex index = FieldIndex::ForDetails(map(), details);   // no bounds check
if (details.representation().IsDouble()) {
  auto box = Cast<HeapNumber>(RawFastPropertyAt(index));     // casting.h:58 — DCHECK ONLY
  box->set_value_as_bits(bits);                              // value_ at offset 4
} else FastPropertyAtPut(index, value);
```
* `Cast<>` is DCHECK-only ⇒ in the shipped release build it is a **bare reinterpret**. This is the
  load-bearing fact.
* `FieldIndexField` is **10 bits ⇒ field_index ∈ [0,1023]** — a bounded relative slot read, a
  constraint absent from both public writeups.
* A **Smi** in the slot decompresses unconditionally (`ptr-compr-inl.h:104`) to `cage_base + 2n`,
  so the store lands at `cage_base + 2n + 3` = **arbitrary in-cage write**.

### ★ The primitive, caught executing [M]
`w33fault.exe` on the shipped build, at the descriptor indices found below:
```
FAULT  code=0xC0000005  WRITE  target = 0xf50000006c
insn: 4c 89 40 03   =   mov [rax+3], r8
RAX = 0x000000f500000069   ; cage_base + slot content, decompressed
R8  = 0x3ff199999999999a   ; the bits of 1.1 — OUR value, verbatim
```
`(0x69 - 1) + 4` = `0x6c` ✓. This *is* `box->set_value_as_bits()`. **The 64 bits written are
fully attacker-chosen; the destination is one dereference away.**

### The two knobs, and the wall between them [M]
Disassembly of the load feeding it (`Qt6WebEngineCore+0x1b322f0`):
```
sar eax,2 ; and eax,0x7ff      ; field_index from the garbage details
sub eax,edx                    ; minus in-object property count
lea eax,[rax*4+8]              ; offset = 8 + 4k   (PropertyArray::OffsetOfElementAt)
mov eax,[rdx+rcx-1]            ; RCX = properties backing store
add rax,[rip+...]              ; + cage_base
mov [rax+3],r8                 ; the store
```
* **kDouble descriptor indices on the 130 snapshot: 4, 24, 68** [M] — the analogue of buptsb's
  index 121 on the 126 snapshot. Found by sweeping and watching for `0xC0000005` (double branch)
  versus `0x80000003` (invalid representation → `Mnemonic()` UNREACHABLE).
* **`RDX = 0x348` in every single fault** ⇒ `k = (0x348-8)/4 = **208**`, constant across indices
  4/24/68 ⇒ `class extends Function` instances carry no in-object property slots, so all fields
  live in the PropertyArray and every kDouble occurrence shares one details value.
* ⇒ the slot read is **PropertyArray element 208**, always. With ~69 properties that is the
  `undefined`-filled tail — measured: the slot holds `undefined` (the RO oddball at cage+0x68,
  its `to_number_raw` NaN visible in the dump) or 0. Hence the write goes to read-only space and
  faults. **That is the entire reason this is a crash and not a write we aim.**

### What was tried against that wall, and failed [M]
* **Name-hash rerolling** (buptsb's own knob — 32 distinct property-name prefixes): moves the read
  between the two useless values, never onto an occupied entry.
* **Heap grooming**: 24,000 same-size-class arrays sprayed with the double `0x40000000_40000000`
  (every 32-bit half reads as `Smi(0x20000000)`), aged, alternate holes punched, then triggered —
  backing store did relocate into the sprayed region (RCX moved from cage+0x213da0 to
  cage+0x14f1c50) but element 208 still read `undefined`.
* **Decoupling instance size from descriptor index** (300 declared fields, reconfigure only #68):
  no change — the map's in-object count is not what gates this.
* **Object-valued fields** (each field a distinct JSArray, so a hit would overwrite
  `properties@4`+`elements@8` in one store): slot still not ours.

### The one remaining requirement, stated exactly [M/I]
`descriptor_index == number of properties added before the reconfigured one` is **intrinsic** to
every front end (the reconfigured property is always the last added). So element 208 is a real,
attacker-written slot **iff the kDouble descriptor index is ≥ 209**. Sampling found kDouble at
3 of ~40 indices below 100 but **0 of ~50 sampled at/above 209**. An exhaustive sweep of
231..1020 is running (`scratch/w33/sweep209.sh` → `sweep209.log`; a hit prints a fault address
ending in neither `003` nor `06c`). **If a kDouble index ≥ 209 exists, the write becomes aimable
and the published chain (smash a FixedDoubleArray length → OOB read → addrof) applies directly.
If none exists, this front end cannot aim the write and the leak must come from elsewhere.**

### Scope, if it does land [M]
**The V8 sandbox IS enabled in this Qt build** — measured by string/section evidence in the
shipped `Qt6WebEngineCore.dll`: `"Failed to reserve the virtual address space for the V8 sandbox"`,
the isolate fields `external_pointer_table` / `shared_external_pointer_table` /
`trusted_pointer_table` / `trusted_cage_base`, `"When the V8 Sandbox is enabled, ArrayBuffer
backing stores must be allocated..."`, and the `V8.SandboxedCppHeapPointersCount` /
`V8.JSDispatchTableEntriesCount` histograms. (This closes the open question the source analysis
flagged as potentially impact-changing: Qt did **not** disable it.)

The write is therefore **in-cage only** (compressed slots cannot address outside `[cage_base, +4 GiB)`), so
by itself it is not process memory corruption. But **site isolation is off here — one shared
v8::Isolate (W17j)** — so in-cage arbitrary R/W reaches the tagged objects of *every document in
that isolate, including the Wickr app document*, from the attacker's cross-origin frame. That is
full cross-origin data compromise **without** a sandbox escape.

---

## 4c. ★★★ THE WRITE IS NOW AIMABLE — attacker-chosen in-cage destination [M]

Section 4b's wall fell. The requirement was never "a kDouble index >= 209"; it was
"attacker-controlled bytes at the confused slot", and **heap grooming supplies them**.

**Recipe (measured, reproducible 4/4):** descriptor index **4** (a kDouble index), spray ~16 MB of
double arrays whose filler is the double `0xNNNNNNNN_NNNNNNNN` (so every 32-bit half reads as the
tagged word `N`), age it with two garbage waves, punch alternating holes, then trigger. The
victim's NameDictionary lands in a hole and the confused slot — byte `0x348` of that dictionary —
falls in sprayed memory.

```
RAX    = 0x0000014b40000000     ; cage_base + 0x40000000  <- OUR sprayed word
TARGET = 0x14b40000003          ; = cage_base + 2n + 3, exactly as predicted
```
4/4 runs: `RAX = cage_base + 0x40000000` with a spray of `Smi(0x20000000)`; the cage base changes
每 run (ASLR) but the OFFSET is always the one chosen.

⇒ **CVE-2026-11645 on this build yields a write of 8 attacker-chosen bytes to an attacker-chosen
in-cage address.** Both halves of the primitive are now measured, not inferred:
* value — `R8 = 0x3ff199999999999a`, the bits of the JS double assigned to the field
* destination — `mov [rax+3], r8` with `rax = cage_base + (the sprayed tagged word)`

### Structure of the confused slot, dumped [M]
A wide slot dump (`dump_slots` in `w33fault.c`) shows the backing store is a **NameDictionary**,
entries from word 8, stride 3 (key, value, details):
```
[  8] 00146bd9  40000000  00004200   <- key, VALUE = our Smi, details
[208] 00000069  00000069  00000069*  <- word 210 = entry 67's VALUE slot (undefined when unoccupied)
```
`0x69` is the read-only `undefined` oddball at cage+0x68 (its `to_number_raw` NaN is visible in the
dump) — that is what the ungroomed slot was reading, and why the store faulted into read-only space.

### What remains, and the one number that was wrong [M]
The leak needs the write aimed at a `FixedDoubleArray`'s `length` (offset 4, which coincides with
`HeapNumber::value_` at offset 4 — the reason this store can smash a length at all). Aiming failed
for a while for a mundane reason, now fixed: **the spray does not live where it was assumed to.**
A whole-address-space scan of the harness process (walking committed regions, not guessing the cage
by reservation size — the first >=4 GiB region is NOT the cage) found the sprayed backings at
**cage+0x40018 and up**, i.e. ~256 KB into the cage, while the aim was set at 0x1300000 (~19 MB).
Aimed writes at the corrected region now land in mapped memory without faulting, but no
out-of-bounds array has been produced yet: the surviving runs report `hit:-1`.

### Which length must be smashed [M, corrects the first attempt]
Aiming at the **FixedDoubleArray's** length is wrong for this victim shape. For a **JSArray**
receiver the element load's bounds check is against `JSArray::length` at **+12**, not the elements'
length -- so smashing the backing's length changes nothing observable, which is exactly what 8
phase-swept aimed runs showed (all `hit:-1`, all surviving). The aim point is the **JSArray object**
(`map@0 properties@4 elements@8 length@12`).
Parity is not an obstacle: an ODD sprayed word is treated as a tagged pointer, `Cast<HeapNumber>`
subtracts the tag and adds 4, so the destination is `word + 3` either way. Therefore
**MARK = JSArray_base + 9** lands the store exactly on `length@12`, and the payload becomes the
length Smi in the LOW four bytes (`p16-leak.html`).

Verified spray geometry [M]: backings at `cage+0x40518 + k*0x508` (0x508 = 8 + 160*8 exactly),
`map=0x00cbe07c`, `lenword=0x140 = Smi(160)`. Layout drifts ~8 bytes between runs.

**Still open:** the scanner's JSArray pattern is too loose — its current matches
(`elems=0x70636d73` = "smcp", `0x746c6163` = "calt") are font-table bytes, not JSArrays. It must
validate that the elements pointer actually resolves to one of our backings (`w[1] == 0x140`)
before reporting a base.

**Not achieved: the observable leak.** Open: pin a verified backing base (a filler run preceded by a
real header, `w[-1]` = the length word) and aim exactly there; the payload already encodes
`byte0 = 0` (preserving the map's high byte) with the length Smi in bytes 1..4.

## 5. W32's negative, which makes this the only V8 line [M]

The W32 sweep (24 agents) closed the "just use a different CVE" option:

> **{post-139 V8 CVE with publicly documented weaponization} ∩ {vulnerable code present in the
> 130 base} = ∅**

* CVE-2026-5865 (Maglev, full public addrof/fakeobj writeup) — regressing CL `6469250a`
  @2025-09-26 `main@{#102805}`, **not in `branch-heads/13.0`**. nebusec's "introduced in Chrome
  130" is contradicted by the fix's own regressor date.
* CVE-2025-12428 — reachable only via the Wasm custom-descriptors **origin trial**, a post-130
  feature.
* The 130-resident ones (11645, CVE-2025-13223) are ITW zero-days with **withheld** technique.

---

## 6. Where this leaves the goal

**Not achieved: no observable leak.** What is now measured, and is reportable on its own:

* **CVE-2026-11645 is present, unpatched, and remotely triggerable from a plain page with no
  flags, and it deterministically kills the renderer.** A peer-delivered page (the pptx →
  allow-listed-origin chain) is a reliable remote renderer DoS. That is a concrete, verified
  impact claim that does not depend on cracking the technique.
* The bug's out-of-bounds read is **confirmed by direct measurement** (garbage representation
  kind 7 at a symbol-identified `UNREACHABLE`), not merely by behavioural divergence.

Honest assessment of this route: selecting from a fixed read-only menu is a weak primitive.
Unless the source-level analysis (W33 workflow, pending) shows a reachable menu entry with
`location == kField` and a large `field_index`, **11645 is crash-or-inert here** and the leak
must come from elsewhere.

Open, in rough order of promise:
1. W33 workflow verdict — does `WriteToField`'s double path (`Cast<HeapNumber>` on a slot,
   unchecked in release) sit downstream of these details at all? If the menu can be shown to
   contain a kField/kDouble entry, the grooming target is the PropertyArray backing store.
2. A WebGL1-driven, post-139, 130-resident ANGLE OOB — lands **unsandboxed** in the CFG-less
   `WickrPro.exe` (W31 correction: WebGL is host-blocklisted here, ON for real victims).
3. Non-V8 renderer n-days already measured (W20 CVE-2026-2441, W19b CVE-2025-10729).

Artifacts: `scratch/w33/{ab.py, w33fault.c, pestr.py, p0-baseline.html, p1-map.html,
p2-narrow.html, p3-fault.html, p4-sweep.html, p5-hunt.html, p6-neighbour.html}`.
