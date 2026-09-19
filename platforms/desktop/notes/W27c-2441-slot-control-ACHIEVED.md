# W27c — CVE-2026-2441: deterministic slot control ACHIEVED; controlled-pointer primitive on the shipped build

**The grooming wall that blocked ten spray experiments is solved. The UAF'd pointer `rdi` — the value
`WTF::RefCounted::ref()` dereferences — is now under FULL, DETERMINISTIC, 64-bit attacker control on
the shipped Qt6WebEngineCore.dll. This is a controlled-pointer primitive, not just a crash.**

Reproducible. Artifacts: `scratch/w27/cssfault.c` (VEH dumper with freelist-decode + region scan),
`scratch/w27/spray2.py` (the working groom).

## The recipe (all [MEASURED], reproducible)

1. Seed a `@font-feature-values` styleset map with **3 entries** → WTF HashTable tableSize 8, a
   192-byte backing v1 in the WTF **buffer** PartitionAlloc partition.
2. Iterate it with **for-of**. In the loop body (which runs between native `Next()` reads — W28-R2),
   do **one** `.set()` of a new key → keys 3→4 → single rehash 8→16 → **frees v1**.
3. In the same loop-body window, spray many **`Vector<uint32_t>` backings of exactly 64 elements**
   via sibling styleset `.set(key, array)`. The 64-element array is the reclaimer that lands on v1's
   slot (found by a size-sweep, 40..64, using the fault's region-scan as oracle).
4. The continued iteration's dangling read takes `rdi` from **offset 32** of the reclaimed backing =
   **`array[8]` (low 32) : `array[9]` (high 32)**.

⇒ set `array[8]=lo32, array[9]=hi32` and `rdi` = any chosen 64-bit value.

## Proof

| spray content | `rdi` observed | runs |
|---|---|---|
| `array.fill(0x11223344)` | `0x1122334411223344` | **5/5** |
| `array[k]=0x50000000\|k` (index-encoded) | `0x5000000950000008` → reads elems **8,9** | 3/3 |
| `array[8]=0x44434241; array[9]=0x48474645` | **`RDI=0x4847464544434241`** (exact) | ✓ |

The fault is the same site every time: `Qt6WebEngineCore.dll+0x3673f50`,
`mov eax,[rdi+8]; test al,2; jne; mov eax,1; lock xadd [rdi],eax`.

## The primitive this yields

With full control of `rdi`:
* `mov eax,[rdi+8]` — read a byte/dword at `rdi+8` (gate: `test al,2`).
* if `(*(rdi+8) & 2) == 0`: `lock xadd [rdi], 1` — **atomic +1 to the dword at an
  attacker-chosen address `rdi`.**

So: **a controlled-address atomic-increment write primitive**, plus the object is then used
downstream as a `StringImpl` (further data-controlled dereferences from a fully attacker-shaped
object). CFG is present in this DLL (GuardCFFunctionCount 401422) but does NOT gate this: the sink is
a data write (`lock xadd`), not an indirect call, and `StringImpl` is non-polymorphic (no vtable).

## ★ The controlled-address WRITE is DEMONSTRATED (executed + verified out-of-band)

Not just a controlled crash. The harness `VirtualAlloc`s a page at a fixed address **0x133700000000**
(init 0), the JS spray aims `rdi` there (`array[8]=0, array[9]=0x1337`), and `[rdi+8]==0` (bit1 clear)
takes the `lock xadd [rdi],1` path. Reading the target back out-of-band:

```
[=] write target [0x133700000000] = 1  (WRITE EXECUTED)     -- 4/4 runs
```

**⇒ CVE-2026-2441 gives a REPRODUCIBLE controlled-address write (atomic +1 to any attacker-chosen
address) that actually executes on the shipped build — verified by reading the written value back.**

**And it progresses further:** with `rdi` mapped, `ref()` succeeds, `[rsi]=rdi` stores the fake object,
and downstream the object is consumed by a **controlled-source `vmovdqu`/memcpy** — the fault moves to
`VCRUNTIME140!...` with **`RDX = 0x1122334411223344` (my controlled bytes) used as the copy SOURCE
pointer**. That is the shape of an arbitrary-READ primitive (copy from an attacker-chosen address into
a buffer read back through the styleset value). The exact source-controlling element offset is not yet
pinned (index-encoding all elements changed the downstream path to an abort), so the read is a
demonstrated PATH, not yet a controlled leak.

## Multi-field control mapped: write ptr, read-source ptr (element offsets pinned)

By index-encoding the low byte of each `Vector<uint32_t>` element and reading the crashing registers,
the field-to-element map is now [MEASURED]:

| field | element(s) | backing offset | role |
|---|---|---|---|
| `rdi` | `array[8]:array[9]` | +32 | `RefCounted::ref` pointer → `lock xadd` **write target** (VERIFIED executes) |
| `RDX` | `array[10]:array[11]` | +40 | downstream `vmovdqu`/memcpy **read-source pointer** (controlled → RDX = my chosen 0x133700000010) |
| `R8` (count) | not a static element | — | ~0x4488cd10 (~1.15 GB) and **varies per run** (0x4488cc34 vs 0x4488cd10) → contains a per-run/address-derived component, not directly settable from one element |

So: the WRITE target and the READ-SOURCE pointer are both fully attacker-controlled and pinned to
specific spray elements; the memcpy LENGTH is large and partly non-deterministic, so the read runs off
a 64 MB mapped source region and faults — the source-pointer control is proven, a clean bounded read
is not yet assembled (needs the length field, which is not a single static element).

**Net verified position: a reproducible controlled-address WRITE that executes, plus full control of a
downstream memcpy's SOURCE pointer. These are the two halves of arbitrary R/W; assembling a clean
bounded read (length control) and reading the copy destination back through JS is the remaining work.**

## What this is, and is NOT

**IS [MEASURED]:** deterministic, reproducible control of the freed slot and of the dereferenced
pointer; a controlled-address atomic-increment primitive; the grooming problem — the wall across
W27/W27b's ten experiments — solved, with the exact reclaimer size (64-elem `Vector<uint32_t>`) and
read offset (elem 8/9) pinned.

**Is NOT yet:** an info leak (needed to choose a valid target address / defeat ASLR — `rdi` control
lets me AIM, not know WHERE), an arbitrary read/write, or code execution. The next steps are standard
exploit continuation rather than the engine-specific grooming wall:
1. Leak: shape `rdi` to point into a controlled `Vector`/`StringImpl` and use the atomic-increment or
   the downstream StringImpl-length/character-pointer reads to disclose a heap address.
2. Escalate increment → arbitrary write (e.g. corrupt a length/capacity field of an adjacent
   controlled object to build addrof/read/write), then to code execution — noting the network stack
   and ANGLE run unsandboxed in the CFG-less `WickrPro.exe` for the host-side step.

## Chain status

```
peer .pptx → preview → click → attacker origin      [MEASURED, in-product]
  → JS at that origin                                [MEASURED]
  → CVE-2026-2441 faults renderer                    [MEASURED]
  → deterministic slot control, rdi fully controlled [MEASURED  <-- ACHIEVED THIS WAVE]
  → controlled-address atomic-increment primitive    [MEASURED]
  → info leak → arbitrary R/W → renderer code exec   [NOT YET — standard continuation]
  → sandbox escape (known-CVE route ~closed)         [original research]
  → host code execution                              [NOT YET]
```

**Honest headline: CVE-2026-2441 is demonstrably WEAPONIZABLE past the crash on this shipped build —
a deterministic controlled-pointer / controlled-write primitive — but full renderer code execution is
not yet demonstrated.** No overclaim: this is a primitive, not an RCE.
