# W27 — weaponising CVE-2026-2441: the primitive is characterised, control is not yet achieved

**Decision this wave was set to make: is CVE-2026-2441 steerable on this build, with evidence, or is
it the W19b outcome again?** Answer so far: the fault is a **write-primitive-shaped UAF**, but the
freed slot is reclaimed by a deterministic Blink-internal allocation, and two spray strategies failed
to place attacker content there. Not won; the reason is measured, which is more than W19b had.

Artifacts: `scratch/w27/` — `cssfault.c` (VEH fault-dumping harness, `--single-process`),
`sprayfault.py` (synchronous trigger + spray), `fault.log`.

---

## §1 The fault, captured

W20 had only the exit code. `cssfault.exe` installs a vectored handler and dumps the context. The
trigger (free the FontFeatureAliases backing by rehashing mid-iteration, then use the iterator) is
synchronous — rAF does **not** tick in the pumped harness, so the crash lands in the same
straight-line path W20 saw.

Fault site **`Qt6WebEngineCore.dll+0x3673f50`**, disassembled:

```
0x…3f30  mov  rdi, [rdx]          ; rdi = pointer READ FROM THE FREED SLOT   <- attacker target
         test rdi, rdi / je
         mov  rdx,rdi ; mov rcx,rdi ; call …e3d140
0x…3f50  mov  eax, [rdi+8]        ; <<< FAULT: read flags at obj+8
         test al, 2 / jne
         mov  eax, 1
0x…3f5c  lock xadd dword ptr [rdi], eax   ; refcount++ at obj+0
```

This is `WTF::RefCounted::ref()` (a `Ref<T>` assignment). **`rdi` is loaded from the dangling slot.**

**⇒ the primitive shape: if the 8 bytes at that slot are attacker-controlled, `rdi` is an
attacker-chosen pointer, and `lock xadd [rdi],eax` is an atomic increment of an attacker-chosen
address — a controlled-address write primitive.** That is a materially better shape than W19b's
vptr→vcall (which needed CFG-legal targets); an atomic-add-to-arbitrary-address is a classic
exploitation primitive.

## §2 ★ But the slot is not attacker-controlled yet — measured, twice

| run | spray | allocator | `rdi` observed |
|---|---|---|---|
| 1 | JS `ArrayBuffer` filled 0x5A | V8 ArrayBuffer allocator | `0x009c4100`**`643d0000`** |
| 2 | DOM `setAttribute` value `'A'×N` (0x41) | WTF PartitionAlloc buffer partition | `0x009c4100`**`68040000`** |

**The tell: the high half `0x009c4100` is IDENTICAL across both runs**, although run 1 sprayed 0x5A
and run 2 sprayed 0x41. If the slot held my bytes it would differ. It does not. **Neither spray
reclaims the freed FontFeatureAliases backing store.** The value is intrinsic — the slot is reclaimed
by a deterministic Blink-internal allocation (or still holds PartitionAlloc freelist metadata; the
`0x009c4100…0000` shape, non-canonical as a pointer, is consistent with an encoded freelist entry).

This is the W19b result one level deeper: there, 53 spray shapes failed to control offset 0; here the
same failure is **explained** —

* run 1 failed because a **V8 ArrayBuffer cannot reclaim a WTF PartitionAlloc slot** (different
  allocator entirely). That was the naive attempt and it is now ruled out with evidence.
* run 2 used the right *partition* (WTF strings) but still failed, which means the reclaim is
  **synchronous inside the freeing operation** — a legitimate same-class allocation takes the slot
  during `map.set`/style-recalc, before the next JS statement (the spray) runs. Program-order
  spraying loses the race.

## §3 What is and is not established

**Established [MEASURED]:**
- CVE-2026-2441 faults deterministically at a `RefCounted::ref()` reading a pointer from freed memory.
- The primitive, if the slot were controlled, is a controlled-address atomic write (`lock xadd`).
- Two reclaim strategies do not control the slot, and the reason for each is identified.

**NOT established:**
- **No control of the freed slot** ⇒ no arbitrary read/write ⇒ **no renderer code execution.** The
  chain's link 6 (weaponise 2441) remains open.
- Everything downstream (the CVE-2025-4609 sandbox escape, host code execution) is untouched and
  depends on this.

## §4 The realistic path, and the honest cost

The reclaim being synchronous-and-deterministic is the crux. The techniques that beat it are real but
are multi-session exploit-development, not a next-command result:

1. **Make the rehash itself place attacker data.** The freed store is replaced by a *new* HashMap
   backing during the same rehash. Control the new backing's *contents* by choosing the map's keys
   and values so their bit patterns act as the fake pointer at the read offset — i.e. spray via
   sibling `@font-feature-values` maps / map entries, not foreign objects. This keeps everything in
   the same allocator AND the same operation.
2. **Win the race with a reentrant allocation.** If any step between free and use invokes JS (a
   callback, a getter, a microtask drained mid-operation), allocate there. Needs an audit of the
   iteration path for a JS-visible callback.
3. **Determine the exact freed size class** by hooking PartitionAlloc (`ShimMalloc`/the bucket) so
   the spray targets one bucket instead of twelve guesses — the W19b note's own closing
   recommendation ("allocator-level visibility of which allocation wins the block"), still the right
   next instrument and now doubly justified.

Effort estimate, stated plainly: **days, with a real chance of not converging** — this class of Blink
iterator-invalidation UAF is exploitable in principle (it was exploited in the wild), but public
weaponisation detail is thin and the reclaim discipline here is unfriendly. The primitive is good;
the grooming is the work.

## §5 Bottom line for the chain

```
peer .pptx -> preview -> click -> attacker origin  [MEASURED]
  -> JS at that origin                             [MEASURED]
  -> CVE-2026-2441 faults renderer                 [MEASURED, W20]
  -> controlled-address write primitive            [SHAPE MEASURED, control NOT achieved  <-- HERE]
  -> renderer code execution                       [NOT ACHIEVED]
  -> CVE-2025-4609 (fix measured absent, W26)       -> sandbox escape   [NOT ATTEMPTED, gated by above]
  -> code execution in WickrPro.exe                [NOT ACHIEVED]
```

Two of the remaining three links are still open, and the first of them is where all the difficulty
concentrated, exactly as predicted before starting.
