# W46 — hunting an A1-class bug: make the JIT emit attacker-controlled native code

Written 2026-08-05. Target: AWS Wickr desktop, Qt WebEngine 6.9.2, Chromium base **130.0.6723.192**,
declared security patch level **139.0.7258.67**, V8 **13.0.245.25**.
Provenance per claim: **[M]** measured this wave · **[P]** public source read in full · **[I]** inferred.

Artifacts: `scratch/w46/` — `AGENT-CONTEXT.md` (the shared brief), `pin.py` / `c.py` / `log.py` /
`map.py` (tooling), `pinned/` (source fetched AT THE PIN), `logs/`, `cve_to_v8commit.json`,
`bugs.txt`, `wxprobe.py`.

---

## 0. The headline, stated before the table

**The A1 class — "the JIT emits attacker-controlled native code" — is EMPTY at this pin for a
single-threaded, in-cage-only attacker.** Nothing found in this sweep reproduces A1's property of
turning validation state into attacker-chosen code emission without either a concurrent writer or a
prior out-of-cage write.

Two candidates come close and are worth more than the empty verdict suggests, but neither *is* A1:
**row 1** (Liftoff i32 zero-extension, no CVE) is a genuine JIT miscompilation whose emitted code
drops the effective bounds check, and it yields the **out-of-cage write** — but the write's content
is data, not instructions; **row 3** (CVE-2025-10891) is a control-flow hijack at the **bytecode**
level, not the machine-code level. Neither makes the compiler emit attacker-chosen instructions.

**But the sweep answered a bigger question than the one it was asked**, and the answer changes the
plan: on this target **an out-of-cage write is, by itself, native code execution.** There is no
second mitigation behind it. So the value A1 would have delivered — skipping the manual
control-flow-hijack conversion and bypassing CFG — is *already* available to anyone holding an
out-of-cage write. **A1's whole reason for existing does not apply to this build.**

> ### ⚠ Updated mid-wave: W43 landed A4, so that write already exists
> This hunt was briefed while the out-of-cage write was still "in progress". **W43 achieved it**
> (crbug 350628675, `WasmTableObject::uses` → unbounded `table_index`, 5/6 byte-exact, renderer
> survives). W43's own verdict was *"the next stage must be JIT/W^X or data-only, not a vtable
> hijack"*, because it treated the renderer's CFG as a live barrier.
>
> **§0 is the answer to exactly that question, and it is more permissive than W43 assumed:** the
> JIT/W^X route is not merely the right choice, it is unobstructed — pages are RWX for their whole
> lifetime, there is no verifier, and CFG does not apply on the V8 path because V8 marks its one
> C++→JIT edge `guard(nocf)`. The move is: **overwrite the body of a JITted function you can call,
> then call it.**
>
> **The remaining obstacle is reach, not capability.** A4's write is `dt_elems + (int32)(8+4K)` ⇒
> **±2 GiB, 4-byte granular**. The V8 code range is a *separate* reservation (≤512 MB on x64) taken
> from `GetPlatformPageAllocator()`. **Whether it lands within ±2 GiB of the trusted-space dispatch
> table is one measurement, and it is now the single decisive next step.** If it does not, table
> row 1 below is the complement, not a duplicate: its write reaches `array_base + k·4 GiB` for
> freely chosen `k`, i.e. **far longer reach than A4**, at the cost of needing `low32 <u len`.

### Why: the JIT-page state at the pin [P, with [M] binary corroboration]

| fact | evidence |
|---|---|
| V8/wasm JIT pages are committed **`PAGE_EXECUTE_READWRITE` for their whole lifetime** | `memory-allocator.cc:572` `RecommitPages(..., kReadWriteExecute)`; `wasm-code-manager.cc` `WasmCodeManager::Commit` identical; `platform-win32.cc:892` `return PAGE_EXECUTE_READWRITE \| PAGE_TARGETS_INVALID;` |
| **ThreadIsolation / PKU is compiled out** on Windows | `build_config.h:46-50` — `#if defined(V8_OS_LINUX) && defined(V8_HOST_ARCH_X64)` … `#else #define V8_HAS_PKU_JIT_WRITE_PROTECT 0`. `RwxMemoryWriteScope::SetWritable() {}`, `ThreadIsolation::Enabled(){return false;}`. `pkey_alloc`/`pkey_mprotect` absent from the shipped DLL [M] |
| `--write-protect-code-memory` **does not exist** at the pin | 0 hits in `flag-definitions.h`, `BUILD.gn`, `v8.gni` |
| the code range is **outside the cage** | `code-range.cc:106-108` routes it through `GetPlatformPageAllocator()` |
| **CFG is bypassed by construction** at the C++→JIT edge | `simulator.h:159` `DISABLE_CFI_ICALL Return Call(Args...)`; `macros.h:197-200` expands that to `__declspec(guard(nocf))` on Windows. Neither `QtWebEngineProcess.exe` (0xc160) nor `Qt6WebEngineCore.dll` (0x4160) imports `SetProcessValidCallTargets` [M] |
| **no bytecode verifier, no GeneratedCodeValidator** | `src/sandbox/` at the pin has neither file; neither string is in the DLL [M]. Both are 2026 mitigations (`1267199531e5`, `c1e157cc3461`), ~11 months post-pin |

⇒ **Overwrite the body of a JITted JS or wasm function you can call, then call it.** No permission
flip, no re-protect race, no verifier, no CFG check.

### The two corrections this forces

1. **"The renderer has CFG enabled, unlike `WickrPro.exe`" is true but not load-bearing for V8.**
   CFG *is* set on `QtWebEngineProcess.exe` and `Qt6WebEngineCore.dll` [M] — but V8 explicitly
   annotates its single C++→generated-code transition `guard(nocf)`, and JIT-emitted indirect
   branches carry no CFG instrumentation at all. State the process every time, but do not treat
   renderer CFG as a barrier on the V8 path.
2. **Drop the entire `[cfi]` / `WritableJit*` commit family from candidate lists.** On Windows x64
   `RwxMemoryWriteScope` is an empty no-op and `ThreadIsolation::Enabled()` is compile-time `false`,
   so every "route write X through `WritableJitAllocation`" commit protects nothing here. That is
   ~8 commits eliminated at zero cost, including `2f0b3b923890`, `6142bd18c973`, `867eb8b21b4c`
   and its reverts (which, checked to `main` today, **never re-landed** [M]).

---

## 1. Method — and the two things that made it work

Gate, per the W36 ground truth:
```
G1  fix is NOT an ancestor of qt/qtwebengine-chromium@136d7fe8aa   (absent from the shipped build)
G2  the pre-fix construct IS present at that same ref              (read the code at the pin)
```
The V8 tree is vendored at `chromium/v8/` in that repo [M, new this wave] — so **G2 is a read of the
exact source that was compiled**, not an upstream `branch-heads` proxy. `pin.py` does it in one call.

**(a) Path-filtered git history via the GitHub API.** Gitiles `+log` with a path filter returns
**HTTP 401** — the recipe every prior wave used silently fails for this query shape. `log.py` uses
`repos/v8/v8/commits?path=…&since=…` instead, which is what made a 20-month, per-file sweep of
`src/wasm`, `src/compiler`, `src/maglev`, `src/sandbox`, `src/codegen` and `src/common` affordable.

**(b) ★ CVE → fix-commit mapping via commit search.** `map.py` resolves each Chrome CVE's
issuetracker id to the V8 commit that fixed it (`search/commits?q=repo:v8/v8+<bugid>`). This turns
an opaque list of 76 "Type Confusion in V8" rows into a *classified* list — it is how the largest V8
bounty in the window was identified as a wasm JIT miscompilation rather than another type confusion.
**This should be standard for every future CVE triage in this engagement.**

### ★ G1 calibration — a correction to how this engagement has been computing the V8 cutoff [M]

Prior waves (and the first half of this one) reasoned *"V8 13.0 branched ~2024-09-05, so a fix on
`main` after that date is absent."* **That is not sufficient.** The pin's V8 is 13.0.245.25, i.e.
`branch-heads/13.0 @ 3551594a5f66` "Version 13.0.245.25", dated **2025-01-06** — and that branch
**did take merges** (e.g. `6661a068e593`, 2024-12-16, "Merged: WasmGCTypeAnalyzer: Fix single-block
loops properly", which is present at the pin verbatim).

```
correct rule:  a V8 fix is absent iff it is not an ancestor of branch-heads/13.0 @ 3551594a5f66
practical:     fix after 2025-01-06        ⇒ absent
               fix between 2024-09 and that date ⇒ MUST be checked by reading the pinned file
```
This wave caught one candidate that way (`c84e01e92bfd` — looked live by date, was merged and is
fixed at the pin). **Every G1 PASS in this note rests on a read of the pinned source, not on date
arithmetic**, so the conclusions stand — but propagate the corrected rule.

**(c) The Qt ledger is a G1 oracle in both directions [M].** Post-pin `[Backport]` commits show what
Qt *later* judged applicable to this exact branch — strong independent evidence for both gates, and
the backport diff shows the pre-fix code as it existed on `130-based`. Positive controls confirm the
check works: bug `420637585` and `397187119` are both present in the ledger. Every candidate id
below returns **0 ledger hits**.

### Coverage gap closed
W36 enumerated Chrome M146→M151. The pin is at **139**, so **M140–M145 had never been swept.** Qt's
own post-pin ledger closes it: 13 V8 backports in that window, 4 of them in class (§3).

---

## 2. Ranked table

Ranked by *what it actually buys this engagement*, which — given §0 — means: does it move us toward
the **out-of-cage write**, or is it another way to re-derive in-cage corruption we already hold?

| # | id | component / defect | G1 | G2 | payoff | prereqs vs the hard filter | technique | prov |
|---|---|---|---|---|---|---|---|---|
| **1** | **V8 issue 421403261 — no CVE** | `wasm/baseline/liftoff-assembler.cc::FinishCall` (root) + `liftoff-compiler.cc::BoundsCheckArray`/`ArrayGet`/`ArraySet` (sink). Liftoff pushes a callee's `i32` return straight out of `rax` **without clearing bits 32-63**; a signature-hash-colliding `(i64)→(i64)` callee reached through an `(i64)→(i32)` `call_indirect` therefore leaves a fully attacker-chosen 64-bit value in the register that `array.get_u`/`array.set` on an **i8** array uses *unshifted* as the x64 index — while the bounds check compares only the low 32 bits | **PASS.** Fix `df3874776c39`, 2025-06-02 = **+147 d** past the branch cutoff (2025-01-06). Proved by code, not date: `clear_i32_upper_half` → **0 hits** in the pinned `liftoff-assembler.cc` [M, cross-checked by me] | **PASS, three independent constructs** [M, all cross-checked by me]: ① the asymmetry — `liftoff-compiler.cc:777-779` *does* clear it on the **parameter** path, with V8's own comment *"certain signature mismatches can violate security-relevant invariants later"*, while the return path does not; ② `:8973-8979` `Load(length, …, LoadType::kI32Load)` then `emit_cond_jump(kUnsignedGreaterThanEqual, trap_label, **kI32**, index.gp(), length.gp())` — 32-bit compare; ③ `:6765-6768` / `:6794-6797` `if (elem_size_shift != 0) { emit_i32_shli(…) }` — for `i8` the shift, which would have truncated to 32 bits, is **skipped** | **★ OUT-OF-CAGE READ *and* WRITE.** `array.set` on `(array i8)` stores one attacker byte at `array_base + attacker_u64`. This is exactly the capability the engagement is blocked on. Honest constraint: `low32 <u len` must still hold, so the reachable set is `array_base + k·4 GiB + [0,len)` for freely chosen `k`. Byte-granular arbitrary targeting needs `array_base mod 4 GiB` groomed; as a 4-GiB-stride scanner it is usable immediately | **Clears all four rules.** Plain wasm-GC + `call_indirect` — both unconditional at the pin (no `V(gc,…)`/`V(typed_funcref,…)` flag remains; wasm-GC graduated in v11.9) [M]. No SAB/COI, **no Worker, single-threaded**, no origin trial, no switch. **x64-specific in our favour.** Needs the in-cage write — **we have it (W35)**. Function must still be in the Liftoff tier (always entered first) | ★ complete upstream PoC ships with the fix: `test/mjsunit/sandbox/liftoff-wasmarray-i64-indexing.js`, whose own comments name the mechanism (*"confuse i64 into i32 with a signature hash compatible function"*, *"array indexing, uses full 64bit regs as is on x86-64 (+ kWasmI8 avoids i32 shl)"*). Read only — not downloaded or run | [M] gates + my cross-check; [P] commit + test |
| **2** | **CVE-2025-12429** (crbug 450618029) + sibling **CVE-2025-12433** (crbug 449760249) | `interpreter/bytecode-generator.cc` — the hole-check-elision bitmap is not merged at non-local exits (`continue` out of a loop body into `next`; `break` out of a switch clause), so the generator believes a TDZ variable was hole-checked on all paths when a jump skipped it, and omits `ThrowReferenceErrorIfHole` ⇒ raw `the_hole` lands in an ordinary JS binding | **PASS.** Fixes `1f5fbf682408` (2025-10-10) and `b371b4f8ba07` (2025-10-09), both after the pin (2025-08-12). Qt backported them 2026-02-06 — **6 months after the pin** — which is independent confirmation that Qt read this exact branch and judged them applicable | **PASS** [M]. `bytecode-generator.cc:2923-2928` has one `HoleCheckElisionScope` spanning body *and* `next`; `ControlScopeForIteration::Execute(CMD_CONTINUE)` is `PopContextToExpectedDepth(); loop_builder_->Continue(); return true;` with **no `MergeBranch`** and no `merge_elider_` member at all. Gate on: `flag-definitions.h:925` `DEFINE_BOOL(ignition_elide_redundant_tdz_checks, **true**, …)`, and the embedder defers (`gin_features.cc:266` `kFeatureDefaultStateControlledByV8`) | **In-cage corruption only** — a real `Hole` HeapObject in a normal binding, converted by the standard hole→`OrderedHashTable`-sentinel / PACKED-elements confusions. Google rates 12429 *"arbitrary read/write via a crafted HTML page"*, **US$50,000** [P]. **No sandbox escape, no code emission** | **Clears all four rules.** Pure JS, arch-independent, **fires in the interpreter on first execution** — no tier-up, no grooming, no spray | ★★ V8 shipped **complete minimal triggers** with the fixes: `test/message/fail/for-of-uninitialized.js` and `test/message/fail/switch-labels.js` (the latter carrying the author's comment *"crash here due to seeing a hole"*), plus a `.golden` bytecode diff showing the hole checks being re-added. Read only | [M] pin reads; [P] CLs, tests, CVE text |
| **3** | **CVE-2025-10891** (crbug 443765373) | `codegen/handler-table.cc::SetRangeHandler` — the **range-based (interpreter)** exception table stores the catch handler's **bytecode** offset in a 28-bit field with no range check, and `BitField::encode` shifts without masking, so any handler target ≥ 2²⁸ is silently truncated **mod 256 MiB** | **PASS.** Upstream `a5f18bb86c3b` 2025-09-12 = pin **+31 d**; Qt backport `3a7f39c9cf` 2025-09-24 = pin +43 d. Fix is literally **+1/-0** on one file, no test | **PASS** [M, mine + agent] — pinned `handler-table.cc:142-149` begins straight at `int value = HandlerOffsetField::encode(handler_offset) \| …` with no `CHECK`; `handler-table.h:151` `HandlerOffsetField = HandlerWasUsedField::Next<int, 28>` (28 bits at shift 4 ⇒ kMax 268,435,455) and `:154` `kLazyDeopt = HandlerOffsetField::kMax`. `bit-field.h:41-68` `encode()` is `static_cast<U>(value) << kShift` — **no mask**, and the `DCHECK(is_valid())` is compiled out in release. Since the field sits at the *top* of the uint32, overflow drops off the high end rather than corrupting the neighbours: `encode(2²⁸+X)` decodes back to **X** | **Bytecode-level control-flow hijack from plain JS with NO prior primitive.** `PatchBytecodeOffset` (`frames.cc:3283`) applies the truncated offset with **no bounds check and no instruction-boundary check**, then `InterpreterEnterAtBytecode` resumes dispatch there ⇒ entry lands mid-instruction in the attacker's own bytecode. Interpreter register operands are **signed** (`bytecode-register.h:265-271`) and `Register::FromOperand` maps across the whole frame incl. `caller_pc()` ⇒ a plausible path to out-of-cage **stack** writes. **[I] on the escalation — not built** | Clears all four rules: plain JS, no flag (Ignition is unconditional), no switch, arch-independent. **The real gate is size:** needs one JS function whose `BytecodeArray` exceeds **256 MiB**. `bytecode-array.h:128` `kMaxSize = 512 * MB` — **exactly 2× the field capacity**, which is presumably why the bug exists. Must also stay un-tiered (interpreted) | **None public.** One-line CL, no regression test, crbug restricted. Cheapest lead for the size gate: quadratic bytecode blowup via `return`/`break` inside N nested `try{}finally{}` | [M] code at the pin; [P] commits; **[I]/UNRESOLVED** the >256 MiB construction |
| **4** | **crbug 516509161 + 427949833 — no CVE** | `sandbox/js-dispatch-table-inl.h::GetNextFreelistEntryIndex` + `external-entity-table-inl.h`. A freed JSDispatchTable entry whose `entrypoint_` has been overwritten with a real code address yields a **full unshifted uint32** as the next freelist index, which `SegmentedTable::at()` uses as `base_[index]` | **PASS.** `fa2ce16dcdea` 2026-01-27 and `286f66bfc9c8` 2026-06-19 = pin +168 d / +311 d; both no-CVE ⇒ structurally absent from a CVE-keyed ledger | **PASS** [M]. Pin reads `return static_cast<uint32_t>(entrypoint_.load(…));` with no `SBXCHECK(IsFreelistEntry(...))` and no bound on `kMaxJSDispatchEntries` | **Out-of-cage 16-byte write** (plus a preceding OOB read) at `jdt_base + low32(instruction_start)·16`; the 16-bit `parameter_count` half is attacker-chosen (function arity). Address is **semi**-chosen, not arbitrary — whether anything useful is mapped there is UNRESOLVED | Needs in-cage write (have). `--flush-bytecode` default **true**. No SAB/Worker/flag/switch. x64 verified | No public PoC. **The trigger was resolved this wave:** `JSDispatchTable::SetCode`'s only freelist guard sits inside `GetParameterCount()`, on the **right** of a `\|\|` whose left disjunct `new_code->parameter_count() == kDontAdaptArgumentsSentinel` is `0` — and **every builtin Code object at the pin has `parameter_count == 0`**, so the guard is short-circuited away. Reached from JS via bytecode flush → `ResetIfCodeFlushed` → `UpdateCode` | [M] guards absent + short-circuit; [I] end-to-end |
| **5** | **crbug 384844209 — no CVE** | `builtins/js-to-wasm.tq` — the generic js-to-wasm wrapper marshals converted parameters through an **in-cage `ByteArray`** whenever the wasm function has **>10 parameters**, then loads them into registers and stack slots for the callee | **PASS.** `17ecc8cb1e24`, 2024-12-20; bug 384844209 → **0 hits** in Qt's 921-commit ledger [M] | **PASS, byte-exact** [M, mine] — pinned `js-to-wasm.tq:576-614`: `if (paramCount <= 10) { … NewOffHeapReference(stackSlots) } else { const slice = &AllocateByteArray(…).bytes; … }` | V8's own words: *"The ByteArray, however, can be used for a **V8 heap sandbox escape**"* [P]. An in-cage attacker controls raw 64-bit values entering a wasm frame. **Not code emission**; the precise escape mechanism is **[I], untraced** | Plain JS calling any wasm export with >10 params. `wasm_generic_wrapper` = `DEFINE_BOOL(…, true, …)` at `flag-definitions.h:1506` [M]. No SAB/Worker/flag/switch. Needs the in-cage write (have) | None public — hardening CL, no test | [M] gates; [P] impact claim |
| **6** | **crbug 40931165 / 342297062 — no CVE** (**not** 344343031 — that id does not exist in V8 history [M]) | `codegen/x64/macro-assembler-x64.cc::CallJSFunction`, site `code-generator-x64.cc:1564`. The optimized direct-call path loads the entrypoint from an **in-cage** `JSFunction::dispatch_handle` (a bare `int32` field) and `call`s it **without comparing the entry's parameter count to the arguments the caller pushed** | **PASS.** Fix `f26f63804b31` 2024-10-03 + `cb4d40770a92` 2024-10-11; tag-verified **13.0.245.25 = absent, 13.1.201.8 = present** [M] | **PASS** [M]. Pinned `CallJSFunction` is exactly `movl rcx,[fn+kDispatchHandleOffset]; LoadCodeEntrypointFromJSDispatchTable(rcx,rcx); call rcx` — no parameter-count load, no compare | Execution of an existing-but-**wrong** code entry. **Corrected from the prior wave's expectation: there is NO rsp desync** — `AssembleReturn` reloads argc from the callee's own frame, so rsp self-corrects. The callee instead reads `[rbp+16+i·8]` for parameters never pushed ⇒ caller-frame native stack data consumed as tagged JS values. In-cage type confusion + partial native-address disclosure | In-cage write (have). No SAB/Worker/flag/switch. x64 verified | ★ in-tree regression tests `test/mjsunit/sandbox/regress/regress-342297062-{1,2}.js` supply the technique | [M] |
| **7** | **crbug 458679939 — no CVE** | `compiler/js-create-lowering.cc::ReduceJSCreateArguments` — TurboFan takes the `arguments` object's parameter count from the **in-cage `SharedFunctionInfo`** instead of the trusted frame state | **PASS.** `a1fa446efe15`, 2026-01-15 = pin +156 d; bug 458679939 → 0 ledger hits [M] | **PASS** [M, mine] — pinned `:203-205` still reads `shared.internal_formal_parameter_count_without_receiver()`, and `TryAllocateAliasedArguments` at `:172` takes the pre-fix argument list | In-cage corruption. The emitted code's view of the frame disagrees with the real frame — genuinely "the JIT emits code violating its own invariant", but the yield is what W35 already gives | Clean on all four rules; plain JS | None public | [M] |
| **8** | **CVE-2025-13042** (crbug 457351015) | `maglev/maglev-regalloc.cc::AllocateRegisters()` never clears `registers_with_result_`, so at codegen `ValueNode::allocation()` reports a **register** for nodes that are actually spilled, and the exception-handler trampoline emits a move from a live CPU register instead of a load from the spill slot | **PASS.** Fix `7ef5ae531a9e` 2025-11-05 (pick `6b93f91665ff`); Qt backported 2026-02-06, both after the pin | **PASS** [M, mine] — pinned `AllocateRegisters()` ends `AllocateControlNode(block->control_node(), block); } }` with no `ClearRegisters()`; the header declares only `SpillAndClearRegisters` | In-cage corruption. The DEBUG-only `DCHECK(!source->allocation().IsRegister())` is inert in release; `kReturnRegister0` (**rax**, holding the thrown exception object) is allocatable, so a stale allocation substitutes an attacker-chosen object for the node the compiler expects ⇒ type confusion. Google: *"potentially exploit heap corruption"* | Clean on all four rules; Maglev is `DEFINE_BOOL(maglev, **true**, …)` at `flag-definitions.h:514`, embedder defers | **None** — the fix ships **zero test files** [M]. No writeup, no PoC. Weaponising means reverse-engineering Maglev block ordering and register pressure from scratch. **UNRESOLVED:** the JS shape that reliably strands a value in rax | [M] pin reads; [I] exploitation shape |

---

## 3. Candidates I gated personally [M]

### 3a. crbug 384844209 — generic js-to-wasm wrapper marshals parameters through an **in-cage `ByteArray`**

V8's own words, from the fix message `17ecc8cb1e24` (2024-12-20, **no CVE**) [P]:

> "A WebAssembly function is allowed to have 1000 parameters … Therefore a ByteArray was allocated
> on the heap so far if the number of parameters exceeded 10. **The ByteArray, however, can be used
> for a V8 heap sandbox escape.** With this CL, a byte buffer gets allocated and stored in the
> IsolateData … and is therefore not accessible through memory corruption in the V8 heap."

**G1 PASS** — 2024-12-20 is ~106 days after the V8 13.0 branch point (~2024-09-05); no CVE, and bug
`384844209` returns **0 hits** in Qt's 921-commit ledger.
**G2 PASS, byte-exact** — pinned `v8/src/builtins/js-to-wasm.tq:576-614`:
```
let paramBuffer: &intptr;
// 10 here is an arbitrary number. The analysis of signatures of exported …
if (paramCount <= 10) {
  … StackSlotPtr(144, …) …
  paramBuffer = torque_internal::unsafe::NewOffHeapReference(stackSlots);
} else {
  const bufferSize = …;
  const slice = &AllocateByteArray(Convert<uintptr>(bufferSize)).bytes;   // <-- IN-CAGE
  paramBuffer = torque_internal::unsafe::NewReference<intptr>(…);
}
let locationAllocator = LocationAllocatorForParams(paramBuffer);
…
const paramStart = paramBuffer.GCUnsafeRawPtr();
```
**Prereqs:** plain JS calling any wasm export with **>10 parameters**; `wasm_generic_wrapper` is
`DEFINE_BOOL(..., true, ...)` at `flag-definitions.h:1506` [M] — default on. No SAB, no Worker, no
flag, no switch, x64 fine. Needs the in-cage arbitrary write, which this engagement **has** (W35).
**Payoff:** NOT code emission. The wrapper loads the buffer's contents into registers and stack
slots for the wasm callee, so an in-cage attacker controls raw 64-bit values entering a wasm frame.
V8 labels the consequence a heap-sandbox escape [P]; the exact escape mechanism is **[I], untraced**.

### 3b. crbug 458679939 — TurboFan takes `parameter_count` for `arguments` from the **in-cage SFI**

Fix `a1fa446efe15` (2026-01-15, `Fixed: 458679939`, **no CVE**, reviewed by Samuel Groß), subject
"[compiler] Fix sandbox violation with RestParameters" [P]. The fix threads
`state_info.parameter_count_without_receiver()` (trusted frame state) into
`TryAllocateAliasedArguments` and drops the `SharedFunctionInfo` read, adding the TODO
*"get the BytecodeArray from a trusted place rather than from the SharedFunctionInfo"*.

**G1 PASS** — 2026-01-15 = pin + 156 days; bug `458679939` → 0 ledger hits.
**G2 PASS** — pinned `v8/src/compiler/js-create-lowering.cc:203-205` still reads
`shared.internal_formal_parameter_count_without_receiver()`, and `TryAllocateAliasedArguments` at
`:172` takes the pre-fix argument list with no frame-state parameter.
**Payoff:** an in-cage-controlled parameter count drives allocation and aliasing of the `arguments`
backing store, so the emitted code's view of the frame disagrees with the real frame — the JIT emits
code that violates its own invariant. **In class**, but the yield is corruption, not code emission,
and this engagement already holds in-cage arbitrary R/W. Prereqs clean on all four reject rules.

---

## 4. Refuted / rejected, with the reason that kills each [M]

| candidate | verdict |
|---|---|
| **crbug 432289371** — "[wasm] Fix sandbox escape via manipulated WasmSuspendingObject", `49e49f879a60`, 2025-07-24, no CVE. In-cage `WasmSuspendingObject::callable` swapped to a wasm function ⇒ import processed as both suspending and exported-wasm. Ships a `--sandbox-testing` regression test, i.e. it presumes exactly W35's primitive | **REJECT — reject-rule 2.** JSPI is **staged-off** at the pin: `wasm-feature-flags.h:111` `V(jspi, "javascript promise integration", false)`, inside `FOREACH_WASM_STAGING_FEATURE_FLAG`. `WebAssembly.Suspending` is unreachable without a flag or an origin trial. Worth revisiting only if the JSPI origin trial is live for an attacker-registrable origin |
| **crbug 376071292** — "[sandbox][wasm] Always copy Wasm wire bytes", `25a0b90ae84e`. G1 PASS, **G2 PASS byte-exact** (pin still declares `SyncCompile(..., ModuleWireBytes)` and `AsyncCompile(..., ModuleWireBytes, bool is_shared, ...)`) | **REJECT — reject-rule 1.** No same-thread window exists. `SyncCompile` reads the caller's in-cage buffer three times (`DecodeWasmModule` `wasm-engine.cc:674`, `ValidateAndSetBuiltinImports` `:683`, the copy `module-compiler.cc:2421`) with **no JS in between**; the copy is the first statement of `CompileToNativeModule` and nothing reads the caller buffer after it. Lazy compilation reads the owned out-of-cage copy via `NativeModuleWireBytesStorage`. `AsyncCompile` already copies unconditionally at the pin |
| **asm.js → `AsmWasmData`** (my own lead, tested hard) | **REFUTED at link 4.** Links 1–3 all hold — including that V8 *does* skip all function-body validation for asm.js: `module-compiler.cc:2222-2224` *"Never validate asm.js modules as these are valid by construction"*, and `ValidateFunctions` opens with `DCHECK_EQ(module->origin, kWasmOrigin)`. But `AsmWasmData` holds a `Managed<wasm::NativeModule>` — **already-compiled, out-of-cage code**, never the translated bytes, which live in a malloc'd `wasm::ZoneBuffer`. Compilation completes before the in-cage object exists (`wasm-engine.cc:596-648`, straight-line), and re-instantiation is a pure `shared_ptr` hand-off (`:651-659`). An in-cage write has nothing unvalidated to inject |
| **wasm deserialization / code cache** (crbug 538378084, 509674461, 441221187) | **REFUTED for our position.** The deserializer *is* a direct code-emission surface — `ReadCode` reads 15 attacker-positioned ints then `CopyAndRelocate` memcpys into RWX pages with only DCHECKs, zero SBXCHECKs — and it **never validates function bodies** (`DecodeWasmModule(..., validate_functions=false, ..., kDeserialize)`, with a single blob-supplied `all_functions_validated_` bit). But every input byte is out-of-cage: the blob is a Blink `CachedMetadata` (PartitionAlloc / mojo `BigBuffer`), the wire bytes an `OwnedVector` (`new T[]`). postMessage never serializes (out-of-band `shared_ptr`); IndexedDB throws `DataCloneError`. **Becomes top-tier the moment A4 lands** |
| **crbug 350292240** — "[sandbox][wasm] add signature checks to the code pointer table", `58f407806ad0` | **REJECT.** G1 PASS, but it is a **relocation, not a bypass**: all three checks the CL removes are present at the pin (`wasm.tq:734-738`, `turboshaft-graph-interface.cc:240-252`, `liftoff-compiler.cc:8833`). The `WasmCodePointerTable` exists at the pin but is **write-only** — entries are allocated and populated, nothing ever reads one. And every operand (`WasmDispatchTable`, `WasmInternalFunction`) is in **trusted space**, so it needs an out-of-cage write we do not have |
| `e73eec269930`, `855d374701f6`, `2f0b3b923890`, `6142bd18c973`, `867eb8b21b4c` family | **No payoff on this target** — see §0 correction 2. `867eb8b21b4c` was reverted and never re-landed [M]; `2f0b3b923890`/`6142bd18c973` are G2 FAIL (the `enforce_write_api` parameter and the jump-table writer methods do not exist at the pin) |
| `51b324c6d189`, `f016ba8f4725` (JSDispatchHandle in RelocInfo) | **G2 FAIL — construct absent.** `JS_DISPATCH_HANDLE` is not a RelocInfo mode at the pin (0 hits; enum still ends `FULL_EMBEDDED_OBJECT, // LAST_GCED_ENUM`); it is introduced *by* `51b324c6d189` |
| `4a3d24cd677f`, `a6d544399d12` (JSDispatchEntry CAS) | **G2 FAIL** — the CAS loops are **already present** at the pin; they were removed *after* it and re-introduced by these CLs |
| crbug 433068894, 396463255, 428055720 (TurboFan) | **G2 FAIL — code absent at the pin.** `kAdditiveSafeInteger`, `ReduceTypedArrayLength`/`TypedArrayLength`, and `kNotAdditiveSafeInteger` all return 0 hits; each arrives post-branch |
| crbug 420637585 (`CheckBounds` typing) | **G1 FAIL — Qt took it.** Ledger line 176: `2025-06-10  d55e428cf6  [Backport] Security bug 420637585`, before the pin. A live reminder that ledger-absence must be checked **by bug id**, not only by CVE |
| **CVE-2026-7337, -14431, -17725, -8540, -8570** (Maglev) | **G2 FAIL ×5 — "the 2026 Maglev refactor wall".** Every one of these fixes lands on machinery that does not exist at the pin. `MapInference`/`InsertMapChecks` → 0 hits (introduced `8a41470735aa`, 2026-02-20); `maglev-known-node-aspects.cc` is not even in the pinned `src/maglev/` listing; `OsrPrewalk`, `SetUseRequiresSmi`, `RecordSmiUse` → 0 hits each. CVE-2026-7337's *regressing* commit is `6469250a` (2025-09-26, **45 days after the pin**) — the same commit W32 flagged, re-confirmed here by code read rather than memory. **Structural lesson: post-2026 Maglev CVEs are mostly unreachable on a 13.0 base, and the cheapest test is a grep for the fix's identifiers at the pin** |
| `3e0b8e7d953e` "[arm64] Omit bounds checks for byte stores" | **REJECT — wrong direction.** It is a *perf* CL that *removes* a check; the stricter code is what the pin has |
| `72568bdf374d` (wide-arith), `019208ccdeb7` (shared-everything), `8fbd496e043a` (custom-descriptors), `553df4469122` + others (memory64), CVE-2026-7999 (stringref) | **REJECT — reject-rule 2, flag-gated at the pin** [M]. `wasm-feature-flags.h`: `V(shared, …, false)`, `V(memory64, …, false)`, `V(stringref, …, false)`, `V(exnref, …, false)`; wide-arith and custom-descriptors do not exist at the pin at all. Confirmed complementarily: **wasm-GC and typed-funcref have no flag left** (graduated in v11.9), which is what makes table row 1 reachable |
| `bd10ccc8f3ef`, `820137e84121`, `dca830faffa1` (Liftoff OOL-trap tagged-slot clobber) | **REJECT on reachability** — all three gated on `for_debugging_` ("when debugging mode is enabled, Liftoff spills temporary registers"), i.e. they need DevTools/inspector attached to the attacker frame |
| CVE-2026-9938, -15770, -14407, -2025-10585 | **REJECT — arm64/arm only.** CVE-2026-7902 is 32-bit-platform only. Target PE machine = 0x8664 |
| `7f6e1abfad42` / crbug 432289371 family (JSPI) | **REJECT — reject-rule 2**, see the JSPI row above |
| **CVE-2026-7899 ($55,000, the largest V8 award in the window) and CVE-2026-9973** — `turboshaft/wasm-load-elimination-reducer.h::ProcessPhi`, stale `replacements_[phi]` across a loop revisit ⇒ WasmGC array bounds check computed against the wrong base | **REJECT — reject-rules 2+3. The code is present and byte-exact pre-fix, but it never runs.** `flag-definitions.h:1379` `DEFINE_BOOL(turboshaft_wasm, **false**, …)` and `:1382` `DEFINE_BOOL(turboshaft_wasm_load_elimination, **false**, …)` [M]; `function-compiler.cc:164` `bool use_turboshaft = v8_flags.turboshaft_wasm;` … else `ExecuteTurbofanWasmCompilation(…)`. Every wasm tier-up at the pin goes to classic TurboFan, and `wasm_turboshaft_mask_for_testing` defaults 0. The only overrides are a command line (closed, W37) or a Finch override of `features::kWebAssemblyTurboshaft`, which QtWebEngine has no service for. **The $55k resolves cleanly and is not evidence of a stronger primitive:** `--turboshaft-wasm` was made default-on by `b34e0aa98b28` (2024-10-23) and the flag deleted by `80f6f63f33e4` (2024-12-12) — **both post-date the 13.0 branch**, so in Chrome 148 this is a plain-page no-flag bug and prices accordingly, while in this tree the same source is dead code. Payoff would have been in-cage only anyway (the public repro forges a *compressed*, i.e. in-cage, reference). The shipped TurboFan `wasm-load-elimination.cc` has **no value-Phi replacement table**, so there is no analogue on the live path either |
| **CVE-2026-11211** — `Assembler::GrowBuffer` `int new_size = 2 * old_size` signed-overflows, so the `new_size > kMaximalBufferSize` guard is skipped and `MemMove` copies the whole emitted code buffer into a 128-byte allocation | **REJECT on payoff — DoS only.** G1 PASS (fix `19b8e4cb5e83` 2026-04-27 = pin +8.5 months; the fix's new OOM string `"BaselineCompiler::AllocateBuffer"` has **0 occurrences** in the shipped DLL while `"Assembler::GrowBuffer"` is present once [M]). **G2 PASS byte-exact in the shipped binary** [M] — RVA `0x1e86bb0`: `lea edi,[r14+r14]` (**32-bit, truncating**) / `cmp edi,20000000h` / **`jg`** (signed, falls through on negative) / `call [rax+18h]` / `movsxd r14,edi`. The buffer is genuinely **out-of-cage** (`DefaultAssemblerBuffer` → `OwnedVector::NewForOverwrite` = `new T[]`) and the content is attacker-influenced (`LdaSmi` immediates land as `movabs rax,<Smi>`). **But both write parameters are pinned by the arithmetic:** `old_size ∈ [2³⁰,2³¹)` ⇒ `new_size` is *always* negative ⇒ destination is *always* a 128-byte slot, and the length is `pc_offset()` ≈ hundreds of MB and **cannot be tuned down**. A ~1 GiB forward memmove out of a 128-byte slot is a guaranteed AV. It cannot be aimed or shortened, so it composes with nothing |
| **CVE-2026-10987** — Sparkplug's `EstimateInstructionSize` computes `length * 7` in plain `int` | **REJECT — provably no payoff at this pin, not merely unresolved.** G1/G2 PASS byte-exact (shipped binary: `imul r12d, eax, 7` then `add [rdi], r12d`, **no `seto`/`jo`** [M]). But `BytecodeArray::kMaxLength ≈ 536,870,880`, so across the *entire* reachable overflow range `L ∈ [306,783,379 , kMaxLength]` the product `7L` lies wholly in `[2³¹,2³²)` ⇒ int32 is **always negative**, and a negative size is *safe*: `DefaultAssemblerBuffer` clamps to `max(128, size)`. **There is no positive wrap**, so it cannot even feed CVE-2026-11211 |
| Liftoff/Turbofan/Maglev/RegExp analogues of the above | **REFUTED** — Sparkplug's `AllocateBuffer` is the **sole** uncapped user-scaled initial buffer at the pin. `NewLiftoffAssemblerBuffer` has the identical shape but `kV8MaxWasmFunctionSize = 7,654,321` × `kLiftoffCodeSizeMultiplier = 4` caps it at ~41 MB, two orders of magnitude short; Turbofan/Maglev/RegExp start from fixed sizes and growth is hard-capped at 512 MB |
| **CVE-2025-10892** — Maglev `VisitSuspendGenerator` stores an unchecked `input_count` into a 17-bit field (`kMaxInputs = 131,071`) | **REJECT — unreachable on x64 by ~4% of the stack budget.** G1/G2 both PASS [M, mine + agent], and the overflow is **not** a zone overflow: the block is allocated from the TRUE count while only the *field* truncates, and the spill bits land in `ReservedField`, which `GeneratorStore` never claims ⇒ inert miscompile, not corruption. Reachability dies anyway: `Code::kMaxArguments = 65,526`, so parameters alone can never overflow (that is what the in-tree `static_assert(kMaxInputs >= kFixedInputCount + Code::kMaxArguments)` encodes); the register file must supply ≥65,544 more, and `args` is `AllLiveRegisters()`, so the frame must be ≥1,048,560 bytes against `V8_DEFAULT_STACK_SIZE_KB 984` = 1,007,616 bytes. The function throws `RangeError` before executing one bytecode, so it never tiers up to Maglev. Only lever is `--stack-size` ⇒ reject-rule 3. **Side-finding:** `should_abort_compilation_` does not exist at the pin, so Qt's own cherry-pick would not apply cleanly |
| **CVE-2026-6363** (crbug 495751197) — Maglev `TryReduceArrayIteratorPrototypeNext` / `TryGetNonEscapingArgumentsObject` gate on the **non-transitive** `InlinedAllocation::IsEscaping()` | **LIVE (the sole C13 survivor) but duplicates capability we own.** G1 PASS (2026-03-26 = pin +226 d), **G2 PASS** [M, cross-checked by me] — the transitive helper `IsEscaping(Graph*, InlinedAllocation*)` exists at `maglev-graph-builder.cc:4362` but is called only from `:4417`; the reducer at `:7755` and the arguments path at `:9693` both call the non-transitive member, and the reducer takes `map = array->map()` from the VirtualObject with **no `CheckMaps`**. Yields the classic double↔tagged elements-kind confusion ⇒ addrof + fakeobj ⇒ **in-cage** arb R/W. Clears all four reject rules, ships a complete upstream trigger (`regress-495751197.js`). **Value is reason (i) only — a deterministic, groom-free replacement bootstrap for W35's ~43% spray. It reaches no trusted space and no out-of-cage state, so it is not progress toward the escape** |
| **CVE-2026-10910** — `turboshaft/late-load-elimination-reducer.cc::ProcessCall` never wipes `object_maps_` across a call | **LIVE but low value.** G1 PASS (2026-05-06 = pin +267 d), **G2 PASS** [M] — pinned `ProcessCall` ends `InvalidateAllNonAliasingInputs(op); memory_.InvalidateMaybeAliasing(); }` with no `WipeAllMaps()`, and the reducer *is* default-on (`turboshaft`=true → `turbo_store_elimination`=true → `StoreStoreEliminationPhase`). Clears all four reject rules, plain-page JS. **But two corrections to the framing:** it is **not** a dropped map check — `object_maps_` is used only as an alias filter inside `InvalidateAtOffset`, so the emitted consequence is a stale load, not a removed deopt; and trusted loads aren't handled at the pin at all (`a2de10e947d7` is 2025-12-09). In-cage only. The fix landed **zero regression tests** and the bounty was **$500**, the floor for a High — suggesting no functional exploit was demonstrated. UNRESOLVED whether a memory-corrupting trigger exists |

---

## 5. What to do next — the plan this sweep implies

**The A1 substitute is not needed. Finish the out-of-cage write instead.** §0 shows that on this
build the write *is* the whole remaining gap: RWX JIT pages, no PKU, no bytecode verifier, no
GeneratedCodeValidator, and a `guard(nocf)` C++→JIT edge. There is no second mitigation to defeat
after it, so the manual-conversion cost that made A1 attractive upstream does not exist here.

Ranked by expected value:

1. **Measure whether the V8 code range is within A4's ±2 GiB reach of `dt_elems`.** This is the
   whole game now. A4's write already exists (W43); §0 says an out-of-cage write into JIT memory is
   code execution; the only question left is whether A4 can *address* JIT memory. One run with the
   existing W43 harness settles it. If yes, the chain is complete and nothing in this table is on
   the critical path.
2. **If it is out of reach, table row 1 (V8 issue 421403261) is the complement.** Its write is
   `array_base + attacker_u64` constrained to `low32 <u len`, i.e. reachable set
   `array_base + k·4 GiB + [0,len)` for freely chosen `k` — **much longer reach than A4's ±2 GiB**,
   at the cost of 4-GiB-stride quantisation until `array_base mod 4 GiB` is groomed (measure it with
   the `addrof` from W34/W35). It needs only the in-cage write we already hold, is single-threaded,
   needs no flag or switch, is x64-specific in our favour, and — unlike A4 — a **complete upstream
   trigger ships in-tree** (`test/mjsunit/sandbox/liftoff-wasmarray-i64-indexing.js`). The fix is
   9 lines across two files and has **no CVE**, so Qt's CVE-keyed ledger could never have caught it.
3. **Consider swapping the bootstrap.** Table row 2 (CVE-2025-12429) is a deterministic,
   groom-free, pure-**interpreter** hole leak with V8's own minimal trigger shipped in-tree, rated
   by Google as arbitrary R/W at US$50k. W35's CVE-2026-11645 route currently runs at ~43% (6/14),
   leak-limited, with heap spraying. If row 2 reproduces it replaces the flakiest link in the chain.
   **Caveat: it is specific to this shipped tree** — Qt's remediation was to flip
   `ignition_elide_redundant_tdz_checks` to `false`, so any Wickr build carrying Qt's Feb-2026 batch
   kills it.
4. **Do not spend more effort enumerating post-2026 V8 CVEs for this class.** The Maglev sweep
   returned 5 G2 FAILs out of 6, all traceable to the 2026 `MapInference` / scope-info / Turbolev
   refactors; the Turbofan sweep returned 4 evidenced eliminations. The 130 base is far enough back
   that most modern V8 CVEs land on code that does not exist here. The productive axis is the
   opposite one: **no-CVE sandbox-hardening commits between 2025-01-06 and now**, which is how both
   W42 and this wave's row 1 were found.

### Measurements worth one run each
* **`array_base mod 4 GiB` controllability** for row 1 — decides its exploit shape (above).
* **Can V8 build a >256 MiB `BytecodeArray` here?** This single experiment decides table row 3
  (CVE-2025-10891) outright. Everything else about that row is confirmed at the pin; the only open
  question is whether the compile completes or dies on OOM first. Cheapest construction lead:
  quadratic bytecode blowup — `return`/`break` inside N nested `try{}finally{}` makes
  `ControlScope::PerformCommand` emit O(N) bytecode per abrupt completion, so N·M bytecode from
  O(N+M) AST nodes. If it completes, row 3 is a plain-JS, zero-prerequisite lead.

  **★ Cross-candidate interaction — found by combining two independent verifications, and it
  constrains the experiment.** The CVE-2026-11211 analysis established the surrounding limits for
  large `BytecodeArray`s and they are *permissive*: `kMaxLength ≈ 536,870,880`, **no size gate in
  `CanCompileWithBaseline`**, and `max_optimized_bytecode_size` (60 KB) gates **Maglev/TurboFan
  only, not Sparkplug** — so a huge function is legal and *does* tier up to baseline. But that is
  also a hazard for row 3:

  ```
  L < 146.3 MiB              Sparkplug estimate stays below 2^30 — safe, but row 3 needs L > 256 MiB
  146.3 MiB ≤ L ≤ 292.6 MiB  CVE-2026-11211 fires on Sparkplug tier-up  ⇒ renderer AV before row 3 runs
  L > 292.6 MiB              7L wraps NEGATIVE ⇒ clamped to a 128-byte buffer that grows through the
                             capped path — safe again, and row 3's >256 MiB is satisfied
  ```
  ⇒ **aim for `L > 292.6 MiB`, or keep the function cold so Sparkplug never compiles it.** Row 3
  additionally needs the frame to stay *interpreted* at throw time (the baseline path goes through
  `BaselineFrame::GetPCForBytecodeOffset`), which points the same way: keep it cold.
* **Is `EnableWebAssemblyTrapHandler` actually called in this renderer?** `V8_TRAP_HANDLER_SUPPORTED`
  is true for win64 and the SEH entry point is compiled in (`api.cc:6541`), but Chromium's call site
  was not found at the pin — currently **[I]**. A string/import check on the shipped DLL settles it,
  and it decides whether linear-memory accesses carry any explicit check at all.
* **Can the attacker iframe create a `Worker`?** Not needed for row 1, but it decides whether the
  hard filter's rule 1 is as tight as assumed — see §6.
* **Row 3's landing zone:** is anything mapped at `jdt_base + low32(instruction_start)·16`?

---

## 6. A standing assumption worth revisiting — the Worker clause [M on the facts, [I] on the conclusion]

The hard filter rejects "a Worker as a concurrent writer", on the reasoning that killed A1. That
reasoning was **SAB-shaped**: A1 needed shared memory, and `crossOriginIsolated` is unreachable from
an iframe. But the V8 cage is **process-wide** — `sandbox.cc:303`
`DEFINE_LAZY_LEAKY_OBJECT_GETTER(Sandbox, GetProcessWideSandbox)`, one lazily-created static
`Sandbox` per *process*, with no per-Isolate sandbox anywhere [M]. A dedicated Worker runs on its own
thread in the **same renderer process**, hence the same cage. So a Worker running its own copy of
the CVE-2026-11645 primitive **is** a concurrent in-cage writer with **no SharedArrayBuffer and no
COOP/COEP**.

If that is right, crbug 376071292 (the wire-bytes TOCTOU, table-adjacent above) comes back into
scope — and it is the one candidate in this whole sweep whose payoff really is **attacker-controlled
code emission**, because the bytes validated are not the bytes compiled.

**I have not measured whether the attacker iframe can create a Worker**, so this stays [I] and
376071292 stays REJECTED as the brief specifies. It is one measurement, and it would change the
answer to the question this wave was asked.
