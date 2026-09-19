# W49 — V8 issue 421403261 on the shipped binary: the GATE passes, the AIM does not

Written 2026-08-05. Continues W48 (which closed A4's route to the code range on *reach* and
nominated this bug as the contingency). Every line **[M] measured** on the shipped AWS Wickr
desktop (Qt WebEngine 6.9.2, Chromium base 130.0.6723.192, declared 139.0.7258.67) unless marked
**[I] inferred** or **[P] public source read at the pinned ref** (`branch-heads/13.0`).
Harness / pages / dumps: `scratch/w49/`.

**Measurement only. No primitive was fired, nothing was written to the renderer, no code was
executed.** Every wasm array index used at runtime was small and in bounds; the confused
`call_indirect` probes were compiled and entered, and each trapped on the canonical type check
*before* any array access — the expected pre-corruption behaviour.

---

## 0. Bottom line

| question | answer |
|---|---|
| 1. Does the shipped Liftoff omit the return zero-extension? | **YES — the gate passes. [M]** |
| 2. Does the READ share the WRITE's `k*4 GiB` reach? | **YES, and the reach is not `k*4 GiB` — it is the whole 64-bit space, both directions. [M]** |
| 2b. **Can this primitive locate the code range by itself?** | **NO. [M]** |
| 3. Granularity — can it write a *chosen* JIT page? | **YES, given the target's absolute address: the whole 512 MiB code range is covered by one 512 MiB array. [M+I]** |
| 4. Go / no-go | **NO-GO as it stands.** Reach is solved; aim is not. One absolute-address leak is the entire remaining gap. |

> ### One-line answer to the decisive question
> **No — it cannot aim. The primitive can reach every byte of the address space and can read as
> well as write, but nothing it can read tells it where anything is: the cage holds no absolute
> address at all (0 in-cage copies of the cage base, 0 in-cage runs of raw code pointers, 2 runs),
> so `k` must be guessed from ≥678 candidates with a fatal access violation on every miss.**

This is **not** A4's failure. A4 could not reach the code range by 5402.9 GiB against a ±2 GiB
window. This bug reaches it trivially. What it lacks is the one thing A4 also lacked and that W48
named exactly: **aim**.

---

## 1. The binary gate — MEASURED, with the disassembly [M]

W48 explicitly did not claim this; it was a source-side inference. It is now measured.

Method: `w49-gate.html` builds a wasm module whose probe functions carry unique 32-bit immediates
(`0x47E1C0DE`…`0x47E8C0DE`) forced into the instruction stream by `i32.xor` with a runtime value.
A bare `i32.const` emits **nothing** in Liftoff (`LocalSet`'s `kIntConst` case is pure bookkeeping,
`liftoff-compiler.cc:2889` [P]) — the first attempt used `local.set` markers and found zero hits.
`w49dump.exe` runs the page in a `--single-process` Qt WebEngine, so the renderer's memory is the
harness's memory, then finds those immediates **inside executable memory** and dumps the
surrounding bytes. Disassembly by capstone 5.0.7 (`dis49.py`).

### 1a. The gap: `probe_get`, index = i32 returned by a confused `call_indirect`

Port 9405, RWX private page `0x11b6898f1000`, offsets are into `w49code-9405-GET_A.bin`:

```
11b6898f1b44  260   488b790f       mov rdi, qword ptr [rcx + 0xf]     ; entry.target
11b6898f1b48  264   488955c8       mov qword ptr [rbp - 0x38], rdx    ; spill the array
11b6898f1b4c  268   488945d0       mov qword ptr [rbp - 0x30], rax    ; spill the i64 arg
11b6898f1b50  272   488955d8       mov qword ptr [rbp - 0x28], rdx
11b6898f1b54  276   488bf3         mov rsi, rbx                       ; implicit_arg
11b6898f1b57  279   ffd7           call rdi                           ; <== the call: i32 in EAX
11b6898f1b59  281   488b4dc8       mov rcx, qword ptr [rbp - 0x38]    ; reload array
11b6898f1b5d  285   8b5107         mov edx, dword ptr [rcx + 7]       ; WasmArray::length
11b6898f1b60  288   3bc2           cmp eax, edx                       ; <== 32-BIT bounds check
11b6898f1b62  290   0f8349000000   jae 0x11b6898f1bb1                 ; -> trap
11b6898f1b68  296   0fb654010b     movzx edx, byte ptr [rcx + rax + 0xb]  ; <== FULL 64-BIT RAX
```

**Between `call rdi` (+279) and the use of the returned value (+288, +296) there is no
zero-extension of RAX.** `clear_i32_upper_half` on x64 is `movl(dst,dst)`
(`liftoff-assembler-x64-inl.h:1659` [P]) — a two-byte `8b c0` / `89 c0`. It is absent.
`LiftoffAssembler::FinishCall` (`liftoff-assembler.cc:864-908` [P]) contains no call to it, and the
shipped binary's output agrees. **GATE PASSES.** [M]

The instruction offsets above are contiguous (279+2=281, +4=285, +3=288, +2=290, +6=296) — there is
no gap in which an instruction could hide. ⚠ `dis49.py` does flag a `8b c0 mov eax,eax` further
down at +305; that is **not** a return zero-extension. It follows `mov rax,[rbp-0x30]`, which
reloads the spilled **i64 argument**, and is the `i32.wrap_i64` belonging to closing marker B.
Read the reload that precedes it before treating any `movl reg,reg` as the fix.

### 1b. The positive control: `ctl_get`, index = an i32 *parameter*, same page, ~200 bytes away

```
11b6898f1986  196   e8e5f7ffff     call 0x11b6898f1170
11b6898f198b  201   4881ec08000000 sub rsp, 8
11b6898f1992  208   8bc0           mov eax, eax        ; <== clear_i32_upper_half, PRESENT
11b6898f1994  210   493b65a0       cmp rsp, qword ptr [r13 - 0x60]
...
11b6898f19ab  233   3bcb           cmp ecx, ebx                        ; 32-bit bounds check
11b6898f19b3  241   0fb65c0a0b     movzx ebx, byte ptr [rdx + rcx + 0xb]
```

`ParameterProcessor` is documented to emit exactly this for i32 parameters in registers
(`liftoff-compiler.cc:771-781` [P]) and its comment names this threat model verbatim: *"In-sandbox
corruption can replace one function's code with another's… explicitly clear the high word of any
i32 parameters in 64-bit registers."* The parameter side is hardened; the return side is not.
**Same build, same compiler, same function shape, 200 bytes apart** — so the absence in §1a is a
real absence, not an artefact of how the code was found. [M]

The dumps are Liftoff, not TurboFan: each carries the dynamic-tiering budget decrement
(`sub dword ptr [r10+0x14], 0x99` / `js`), which only Liftoff emits, and each probe was called
≤ 8 times. [M]

### 1c. Not a plain-JS bug — the runtime gate, measured

The emitted `call_indirect` prologue shows the *only* runtime type gate:

```
11b6898f1b2e  238   8b591b         mov ebx, dword ptr [rcx + 0x1b]   ; WasmDispatchTable entry .sig
11b6898f1b31  241   83fb03         cmp ebx, 3                       ; canonical_sig_id of the DECLARED type
11b6898f1b34  244   0f8572000000   jne  -> trap
```

My probe declared its types with the bare `0x60` form, which in the final GC spec is **final**, so
Liftoff emitted the short path (`liftoff-compiler.cc:8664-8668` [P]). For a **non-final** type it
instead emits the constant-time subtyping check that loads
`WasmTypeInfo::kSupertypesOffset + rtt_depth*kTaggedSize` (`liftoff-compiler.cc:8607-8656` [P]) —
**that is precisely the field the vendor regression test corrupts with `set_supertype()`**, and it
is an in-cage 32-bit write, i.e. exactly W35. Confirmed as W48 measured: `validate:true`,
`instantiated:true`, `ctlOk:true`, and all three confused probes trap with
`RuntimeError: null function or function signature mismatch`. [M]

And the backstop behind that check does not distinguish the two types: `SignatureHasher`
(`signature-hashing.h:120-230` [P]) counts only *tagged/untagged × register/stack*. `(i64)->i64`
and `(i64)->i32` are both "1 untagged param in reg, 1 untagged return in reg" ⇒ **identical hash**.
That is the collision the fix's message names.

**Attack shape that follows [I]:** declare the call site's type non-final (`0x50 0x00 0x60 …`),
use W35 to set the real function type's `supertypes[0]` to the declared type's map, then every
`call_indirect` through that entry passes.

---

## 2. Aim — the read shares the write's reach, and the reach is unbounded [M]

### 2a. Read and write are byte-for-byte the same shape

`probe_set`, same page (`w49code-9405-SET_A.bin`):

```
11b6898f1c5c  282   41ffd0         call r8                              ; i32 in EAX
11b6898f1c5f  285   8b4dcc         mov ecx, dword ptr [rbp - 0x34]
11b6898f1c62  288   488b55c0       mov rdx, qword ptr [rbp - 0x40]
11b6898f1c66  292   8b5a07         mov ebx, dword ptr [rdx + 7]
11b6898f1c69  295   3bc3           cmp eax, ebx                         ; 32-bit bounds check
11b6898f1c6b  297   0f8348000000   jae -> trap
11b6898f1c71  303   884c020b       mov byte ptr [rdx + rax + 0xb], cl   ; FULL 64-BIT RAX
```

Read `movzx edx,[rcx+rax+0xb]` vs write `mov [rdx+rax+0xb],cl`: **the same addressing form, the
same 32-bit check, the same unextended RAX.** So the answer to the brief's decisive sub-question is
yes — reads reach whatever writes reach. [M]

This is structural, not incidental: both go through one helper. `ArrayGet` → `LoadObjectField` →
`Load`, `ArraySet` → `StoreObjectField` → `Store`, and both build the operand with
`GetMemOp(assm, addr, offset_reg=index.gp(), imm)` → `Operand(addr, offset_reg, scale, imm32)`
(`liftoff-assembler-x64-inl.h:59-73, 560-660` [P]). An x86-64 SIB index register is always used at
full 64-bit width. The bounds check is `emit_cond_jump(…, kI32, index, length)` → `cmpl`
(`liftoff-compiler.cc:8963-8981`, `liftoff-assembler-x64-inl.h` [P]). `kWasmI8` elements have
`elem_size_shift == 0`, so no shift intervenes. [P+M]

### 2b. The reach is the whole address space — a real improvement over A4

RAX is added to the base at full width and its upper half is the attacker's chosen i64 return
value. Reachable set:

```
    array_data + (K << 32) + low       K = any 32-bit value, low < array.length
```

with `K` interpreted as the top half of a full 64-bit addend, so **both directions**
(`K = 0xFFFFFFFF` reaches ~4 GiB *below*). Effective span ≈ ±8 EiB versus A4's ±2 GiB, and the
element granularity is **1 byte** versus A4's 4-byte-quantised 4-byte store. The code range needs
`K ≈ 32,000`, trivially inside range. **Reach is not the blocker.** [M for the encoding, I for the
arithmetic]

### 2c. But nothing tells it where to point — this is the blocker [M]

The page knows `array_data − cage_base` exactly (W35 `addrof`). To hit an absolute target it needs
`cage_base`. Measured attempt to obtain it:

The emitted code names the field that holds it — every tagged-pointer decompression in the dump is
`or rcx, qword ptr [r13 + 0x1e0]`, i.e. `IsolateData::cage_base_` at `isolate_root + 0x1e0`, a raw
64-bit value. So the harness scanned **all** committed non-image memory for a qword equal to the
cage base, and for runs of ≥64 consecutive raw pointers into executable memory (the shape of
`builtin_entry_table_`):

| | ports 9407 / 9409 / 9415 |
|---|---|
| committed inside the 4 GiB cage | 7 regions, ~2.0–2.6 MiB, compressed `0x0`…`0x295000` |
| qwords == cage base **inside** the cage | **0 / 0 / 0** |
| qwords == cage base outside the cage | 195 / 195 / 172 (C++ heap, ~0.79–0.95 TiB; cage at ~2.2–3.0 TiB) |
| runs of ≥64 raw code pointers **inside** the cage | **0 / 0 / 0** |
| runs outside the cage | 14 / 15 / 14 — all in the C++ heap, all pointing into `windows.storage.dll`, `d3d11.dll`, `vm3dum64_10.dll`, `win32u.dll`; none is V8's builtin table |

**Classifier positive control:** the same scan found 195 copies elsewhere, so it works — the in-cage
zero is a real absence, not a broken scan. Separately, a full-memory scan for the marker immediates
found 35–37 copies and correctly flagged only the 8 in RWX memory as `<-- EXECUTABLE`. [M]

⇒ `IsolateData` — which provably holds the cage base, since generated code ORs it in from
`[r13+0x1e0]` — **is outside the pointer-compression cage** on this build. An in-cage read cannot
reach it. There is no in-cage absolute address of any kind. [M measured, I for the identification]

### 2d. So `k` must be guessed, and a miss is fatal

`k = (code_range − cage_base) >> 32`, code range constant per boot at `0x7ffdb6c00000` (W48 [M],
re-seen here in the executable-region list), cage base re-randomised per process and **4 GiB
aligned in 12 of 12 runs [M]**:

| samples | distinct `k` | min | max | spread |
|---:|---:|---:|---:|---:|
| 13 (6 from W48 + 7 from W49) | **13** | 31878 | 32555 | **677** |

So ≥ **678 candidate `k` values** observed — 13 samples, 13 distinct values, no repeats — and the
true range is at least that wide. Each wrong
`k` reads unmapped memory. That fault is **not** recoverable: V8 registers protected instructions
only where it *omits* the bounds check, and this access has an explicit `cmp`/`jae` to a trap stub,
so it is not in the protected-instruction list and the access violation reaches the process. [I —
structural, from the emitted code; not fired]. A renderer restart re-randomises the cage, so
nothing accumulates across attempts.

**That is the whole no-go.** Same shape as the two-independent-ASLR-sources problem that killed A4
in W48, arriving one step later.

---

## 3. Granularity — GO, given a target address [M]

`WasmArray::MaxLength(1) = (SmiTagging<4>::kSmiMaxValue − kHeaderSize)/1`
(`wasm-objects.h:1343-1349` [P]). The emitted code pins the layout: length at tagged offset 7,
element 0 at tagged offset `0xb` ⇒ `kLengthOffset = 8`, `kHeaderSize = 12` [M] ⇒ predicted limit
`(2^30 − 1) − 12 = 1073741811`. Measured (port 9413):

| length | result |
|---:|---|
| 65536 / 1048576 / 16777216 / 67108864 | ok |
| 268435456 (256 MiB) | ok |
| 536870912 (512 MiB) | **ok — largest actually allocated** |
| 1073741811 (predicted max) | attempted; no beacon returned within the run |
| **1073741812 = predicted max + 1** | **`RuntimeError: requested new array is too large`** |
| 1073741813, 2^30, 0x7fffffff, 0xffffffff | same trap |

So the engine limit is exactly **1073741811 bytes**, bracketed from above by measurement and
matching the source formula to the byte. [M]

Coverage of one 4 GiB window: **25.0 %** at the engine limit, **12.5 %** demonstrated.

But a *chosen* page is still reachable, because the residue is computable and controllable [I on
measured quantities]:

* `cage_base` is 4 GiB aligned (12/12) ⇒ `array_data mod 2^32 = comp + 12`, and `comp` is known to
  the page via `addrof`.
* the code range is 4 GiB aligned (`RoundDown(embedded_blob_code_start, k4GB)`, `code-range.cc:326`
  [P]) ⇒ a target at `code_range + delta` has residue `delta`, with `delta < 512 MiB`.
* required `low = (delta − comp − 12) mod 2^32`; measured committed heap for a light page occupies
  compressed `0x0…0x295000` (≈2.7 MiB), so `comp` is a few MiB.
* with a 512 MiB array, every `delta` in the 512 MiB code range above `comp` satisfies
  `low < len`. **The whole code range is covered by one allocation.**

**Verdict on writing a chosen JIT page: GO on granularity, NO-GO overall** — blocked only by §2c.

---

## 4. Carried forward: firing count

W48 flagged that A4's burst-firing was never measured. For this candidate the question largely
dissolves [I, from the mechanism — not fired]: the corruption is a **one-time** in-cage 32-bit
write to `supertypes[0]`, after which the dispatch-table entry is permanently mis-typed. Each
subsequent `probe_set(arr, k64, byte)` call is one ordinary exported wasm call writing one
attacker-chosen byte at an attacker-chosen address, with **no groom and no per-firing setup** —
unlike A4, which needed a fresh groom and was only ever fired once per page load. An N-byte payload
costs N calls. This is a strictly better write primitive than A4 in every dimension except that it
cannot be aimed.

---

## 5. What would unblock the line

The entire renderer-RCE line now reduces to **one** question: *can the page learn a single absolute
address, or any address at a known offset from the cage?* Everything else is held.

Ranked by what the measurements here say:

1. **A raw in-cage pointer stored anywhere the page can already read.** Measured: none inside the
   cage. Where the addresses were logged (port 9407), **all 64 logged copies lay 1337.7 GiB BELOW
   the cage** — the direction W42's positive-only SlicedString read cannot go. ⚠ That is 64 of 195
   copies in **one** run: "every copy is below the cage, in every run" is **not** established, and
   the systematic above/below counter was added to the harness but its report line was not (the
   patch missed after an intervening edit), so it never printed. **This is the single highest-value
   thing to measure next** — one copy above the cage makes W42 + this bug compose into a complete
   escape.
2. **Trusted space via W42.** W48 measured trusted space 4745–23444 hops above the cage 6/6, and
   W47 found raw code pointers there (`WasmDispatchTable::target` at `dt_elems+796`). But a leak of
   an *absolute* code address still does not yield `cage_base`, so it does not close the gap on its
   own — it needs an in-cage pointer, not a code pointer.
3. Anything that leaks the sandbox base: ArrayBuffer backing stores are sandboxed pointers
   (offsets), so reading one yields `backing_store − sandbox_base`, not an absolute. Worth checking
   whether `cage_base − sandbox_base` is a **constant** — if it is, and any absolute sandbox
   address can be obtained, `k` becomes computable. Not measured here.

---

## 6. Artifacts

* `scratch/w49/w49-gate.html` — codegen probe page (markers, control, confused probes).
* `scratch/w49/w49-gran.html` — granularity page, staged beacons.
* `scratch/w49/w49dump.c` / `.exe` — harness. **Three defects were found and fixed in it; each
  produced a silent false negative, do not re-inherit them:**
  1. the region walk skipped to the end of each MEM_PRIVATE reservation (copied from W48's
     `find_sandbox`), which also skips every committed sub-region inside it — measured effect:
     "1 cage region, 0 marker hits". Track the largest reservation incrementally instead.
  2. `local.set` of an `i32.const` emits **no** code in Liftoff, so constant markers vanish. Force
     the immediate with an arithmetic op on a runtime value.
  3. this build compiles wasm **lazily** — a function that is never called has no machine code.
     Enter every probe once.
  Also: an ascending scan reaches the C++ heap long before the cage, so a shared hit cap fills with
  out-of-cage copies (measured: 64/64 slots taken before the cage was reached). Bucket by
  in-cage/out-of-cage, do not share the cap.
* `scratch/w49/dis49.py` — capstone disassembler; reads BASE/MARKOFF from the run log.
* `scratch/w49/w49code-9405-*.bin` — the eight raw code dumps.
* `scratch/w49/run94*.txt`, `w49dump-94*.log`, `w49anchors-94*.json`.
* Pinned sources under `scratch/w49/src/v8/branch-heads_13.0/`.

**Still NOT achieved: code execution.** Nothing was fired in W49.
