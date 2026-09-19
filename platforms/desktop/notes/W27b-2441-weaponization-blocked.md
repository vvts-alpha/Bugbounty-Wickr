# W27b — CVE-2026-2441 weaponization: primitive + trigger confirmed, reclaim not achieved, blocker isolated

**Goal: control the freed slot so `rdi` (the pointer `RefCounted::ref` dereferences) is attacker-
chosen. Not achieved. Five distinct spray strategies all leave `rdi` holding PartitionAlloc
freelist-encoding — i.e. v1 is never reclaimed before the dangling read. The blocker is now isolated
to one measured fact and one open fact.**

Artifacts: `scratch/w27/cssfault.c` (VEH fault dumper, `--single-process`), `scratch/w27/spray2.py`
(single-rehash, in-loop-window, 192B same-family spray, pre-grown groom maps).

## What is confirmed [MEASURED]

* Fault site `Qt6WebEngineCore.dll+0x3673f50` = `WTF::RefCounted::ref()`: `mov rdi,[rdx];
  mov eax,[rdi+8](FAULT); lock xadd [rdi],eax`. `rdi` is read from the freed HashTable backing.
  `rdi` is the first entry's `AtomicString` key = a `scoped_refptr<StringImpl>`; the ref() is ref'ing
  that StringImpl. ⇒ **control rdi ⇒ controlled-address atomic-add, and rdi must be a fake
  StringImpl\* (not just 0x42) for the object to be usable beyond the increment.**
* The trigger is mine and precise [DIAG]: seeding the styleset with 3 entries reports `size` 3;
  one in-loop `.set()` takes it 3→4 (`sizes:[3,4,5,6,7,8]`), and at 4 keys WTF rehashes 8→16,
  freeing the 192-byte tableSize-8 backing (v1). A plain for-of with no in-loop mutation does **not**
  fault (`DIAG-plain-forof-ok, iters:3`) ⇒ **my in-loop `set()` is the trigger**, exactly as W28-R2
  predicted (loop body runs between native `Next()` reads).
* Backing partition [W28-B1, high-conf]: the HashTable backing is
  `PartitionAllocator::AllocateHashTableBacking → Partitions::FastZeroedMalloc`, the WTF **fast-malloc
  partition**, request = tableSize×24, **no inline header**, v1 = 8×24 = **192 B**.

## The five spray strategies and their identical result

| # | spray | timing | result `rdi` |
|---|---|---|---|
| 1 | V8 `ArrayBuffer` 0x5A | program order | `0x009c4100_643d_0000` freelist |
| 2 | DOM string 0x41 | program order | `0x009c4100_6804_0000` freelist |
| 3 | same-family CSS map values 0x42 | program order | `0x009c4100_c86e_0000` freelist |
| 4 | 192B value-array 0x42, for-of window | in-loop | `0x007a4100_683a_0000` freelist |
| 5 | 192B value-array, pre-grown groom (no hashtable rehash) | in-loop | `0x007c4100_7c56_0000` freelist |

Every `rdi` is PartitionAlloc freelist-encoded (the middle 16 bits byteswap-correlate with RAX; the
high half is per-run ASLR). **v1 is on the freelist, unclaimed, at the moment of the dangling read,
in all five.**

## The blocker, isolated

Two candidate causes remain; both are now specific and testable:

1. **Partition mismatch [most likely].** HashTable backing = `Partitions::FastZeroedMalloc`
   (fast-malloc partition). The styleset **value** `Vector<uint32_t>` backing — my spray — may be
   allocated from a **different** WTF partition (BufferPartition), in which case it can never reclaim
   a fast-malloc slot, identical in kind to the V8-ArrayBuffer failure. **W28-B3 was tasked to
   determine exactly which partition the value backing uses, and w28 stalled at 3/6 — B3/R1/synthesis
   never returned.** This is the single cheapest thing that would unblock or redirect.
2. **No allocation point between free and read.** If the maplike advance reads entry N+1 with no JS
   execution between the `set()`-driven free and that read, no spray can win the slot. R2 says the
   loop body IS that point, but the five identical negatives are also consistent with the read being
   coupled to the free.

## The decisive next instrument (deferred five times, now required)

**PartitionAlloc allocation visibility** — hook the fast-malloc-partition alloc/free in the shipped
`Qt6WebEngineCore.dll` (no PA symbols; reach it via the `Partitions::` accessor or the
`AllocateHashTableBacking` call the backing goes through) and, during the trigger, log: (a) v1's freed
address + bucket, (b) the next allocation that returns that address. That converts "rdi is freelist-
encoded" (blind) into "allocation X won the slot / nothing did" (targeted). This is W19b's own closing
recommendation and is now unavoidable — five blind spray shapes across every partition/timing/bucket
axis have not moved `rdi` off the freelist.

## Honest status for the chain

```
peer .pptx → preview → click → attacker origin      [MEASURED]
  → JS at that origin                                [MEASURED]
  → CVE-2026-2441 faults renderer                    [MEASURED]
  → controlled write primitive                       [SHAPE MEASURED; slot control NOT achieved <-- HERE]
  → renderer code execution                          [NOT ACHIEVED]
  → sandbox escape                                   [known-CVE route ~closed; original research needed]
  → host code execution                              [NOT ACHIEVED]
```

Weaponization is real exploit-development: the bug, the primitive, the trigger and the target bucket
are all measured, but converting the UAF into slot control is blocked on allocator visibility and,
beyond that, on constructing a fake StringImpl / an info leak (the atomic-add alone is not yet code
execution). This is days of work with no convergence guarantee — the position stated before starting,
now with the obstacles measured rather than assumed. **No success to report; nothing overstated.**
