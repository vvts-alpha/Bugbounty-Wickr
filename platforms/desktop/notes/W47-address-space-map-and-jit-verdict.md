# W47 — the renderer's address space, and the verdict on the JIT route

Written 2026-08-05. Reconnaissance only: no primitive was fired, no code was executed, the live
product was never touched. Every line **[M] measured** on the shipped AWS Wickr desktop (Qt
WebEngine 6.9.2, Chromium base 130.0.6723.192, declared patch level 139.0.7258.67) unless marked
**[I] inferred** or **[P] source read**. Harness + pages `scratch/w47/`.

**Bottom line: the JIT route is dead — but not for the reason W43 assumed.** CFG is *not* a
barrier (the bitmap marks every JIT page ALL-VALID), and W^X is *not* in force (JIT pages are
`PAGE_EXECUTE_READWRITE`). The barrier is **reach**: V8's code range is **33,295–109,623 GiB**
from `dispatch_tables`, the origin of A4's ±2 GiB write, in 6 of 6 runs. The ±2 GiB window
contains **nothing but trusted space** — 0.5 MiB committed, no executable memory of any kind.

**The one thing worth writing to is inside that 0.5 MiB, and it is now measured:** committed
trusted space holds **raw wasm code pointers** a few hundred bytes from the write origin
(`dt_elems − 152`, `+796`, `+888` across runs), one of them carrying the exact
`{target, implicit_arg, sig}` shape of a `WasmDispatchTable` entry — the untested lead W43 §8
flagged. In range, 4-byte-writable. **Reachability is measured; steering it is not, and must not
be claimed.**

---

## 0. Method, and three corrections to the inherited tooling [M]

`w47map.exe` runs `w47-map.html` in a `--single-process` Qt WebEngine, so the renderer's memory is
the harness's memory, then walks the whole address space with `VirtualQuery`.

* **The harness is built `/guard:cf`.** Its `DllCharacteristics` is **0xc160 — byte-identical to
  the product's `QtWebEngineProcess.exe`** (`peinfo.py`). Without that the process would have no
  CFG bitmap and Q3 would be unanswerable. (`WickrPro.exe` is 0x8160, no CFG — W17j, re-verified.)
* **JIT code is identified by CONTENT, not guessed.** The page compiles two wasm bodies carrying
  eight unique `i32` immediates and runs a hot JS function carrying three more; whatever
  executable memory contains those bytes *is* code this page caused to be emitted. A
  `Uint32Array` of the same constants acts as a positive control for the scanner.

Three defects in the tooling inherited from W42/W43 had to be fixed first. Each one silently
produces a *false negative*, so they are recorded here:

1. **W43's scanner stops at `0x7ff000000000`.** Every loaded module *and* V8's code range live
   **above** that bound (`Qt6WebEngineCore.dll` at `0x7ffdd8530000`, code range at
   `0x7ffdb6c00000`). The first run of this map, using the inherited bound, reported "0 image
   regions, 4 executable pages, no JIT anywhere" — all three false. **Any negative conclusion
   about code layout drawn with that bound is void.**
2. **The largest reservation in the process is NOT the V8 sandbox.** It is the **2 TiB CFG
   bitmap** (`MEM_MAPPED`). "Largest reservation ≥512 GiB" — W43's heuristic — selects the bitmap.
   The cage must be found as the largest **`MEM_PRIVATE`** reservation, or by containment.
3. **The cage marker must be validated by its V8 string header.** The first match for the marker
   text in ascending address order is a C++-heap copy of the page source, not the in-cage
   `SeqOneByteString`. Require `*(u32*)(p-4) == length`.

## 1. The region map [M]

Whole-process totals, typical run (`w47regions-<port>.csv`, 2055–2069 regions per run):
committed **private 72 MiB, image 342 MiB, mapped 620 MiB**; executable 232 MiB, of which
**231.5 MiB is image** (`Qt6WebEngineCore.dll` .text and friends) and **0.3–0.6 MiB is
non-image — i.e. all of the JIT**.

### 1a. The anchors, 6 runs, distances signed from `dispatch_tables` elements

| run | `dt_elems` (A4 WRITE origin) | V8 code range Δ | wasm code Δ | code-ptr-table Δ | trusted base Δ |
|---|---|---|---|---|---|
| 9113 | `0x5f7a00041898` | **+33 294.9 GiB** | −86 978.8 GiB | — | −0.256 MiB |
| 9115 | `0x44d200041d30` | **+60 590.9 GiB** | −154.1 GiB | −68 651.2 GiB | −0.257 MiB |
| 9121 | `0x54c600041694` | **+44 254.9 GiB** | −81 271.2 GiB | −84 304.7 GiB | −0.256 MiB |
| 9123 | `0x3ef700041b70` | **+66 586.9 GiB** | +6 848.8 GiB | −62 397.3 GiB | −0.257 MiB |
| 9125 | `0x14f000041778` | **+109 622.9 GiB** | +42 674.3 GiB | −19 281.9 GiB | −0.256 MiB |
| 9153 | `0x237c0008144c` | **+94 726.9 GiB** | +83 490.5 GiB | −34 166.7 GiB | −0.505 MiB |

**0 of 6 within ±2 GiB.** The closest any code ever came was run 9115's wasm region at
**154 GiB** — still 77× outside the window.

### 1b. The four structures, measured

| structure | address | size | protections | how identified |
|---|---|---|---|---|
| **V8 code range** (optimised JS) | **`0x7ffdb6c00000` — identical in 6/6 runs** | **512.00 MiB** reserved; `+0x40000` committed **RWX** (256–512 KiB); 4 KiB **R-X** at base | J1/J3 immediates found 9–10× each inside it | content |
| **wasm code** | ASLR per run (e.g. `0x75049fe10000`) | 64 KiB reserved; 1 page **R-X** + 1 page **RWX** | all 8 wasm immediates, twice each (two tiers) | content |
| **trusted space** | `dt_elems − 0.25…0.51 MiB`, 4 GiB-aligned base | **1.00 GiB** reserved, **0.50–0.75 MiB** committed **RW-** | W43's `dispatch_tables` fingerprint | structure |
| **code pointer table** (shape) | ASLR per run (e.g. `0x21e52ae0000`) | 64 KiB region | 13–15 consecutive 16-byte entries whose `+0` qword lands inside a JIT code region | content [M]; *that this is V8's `CodePointerTable` is* **[I]** |
| V8 sandbox / pointer cage | cage base from the in-cage marker, e.g. `0x2e000000000` | 0.969–0.980 TiB reservation | — | marker + containment |
| CFG bitmap | `0x7df5c3690000` | 2 TiB `MEM_MAPPED` | validated against known-good/known-bad targets (§4) | structure |

**The code range's address is a per-boot constant, not per-process ASLR** [M]: `0x7ffdb6c00000`
in every run, always exactly **−537.2 MiB from `Qt6WebEngineCore.dll`'s base**. Consistent with
V8 placing the code range within PC-relative reach of the embedded builtins in the DLL, whose base
Windows randomises per boot, not per process [I]. **Consequence: an attacker needs no info leak to
locate V8's code range on a given machine** — only a primitive that can reach it.

## 2. Q1 — are the code pages inside the write's ±2 GiB window? **NO** [M]

See §1a: 0 of 6, minimum observed distance 154 GiB. This is structural, not luck. Trusted space is
its own 1 GiB reservation placed by per-process ASLR anywhere in the 128 TiB user VA; the code
range is pinned near the DLL. **P(landing within ±2 GiB) ≈ 4 GiB / 128 TiB ≈ 3×10⁻⁵** [I from
measured facts]. Nor is the coupling any help: A4's paired OOB *read* base (`WasmModule::tables`)
sits on the C++ heap at ~0.5 TiB, i.e. ~140 TiB below the code range — and that read reaches only
±32 GiB anyway.

## 3. Q2 — protections: **RWX, no W^X** [M]

* wasm code page e.g. `0x75049fe11000` — `PAGE_EXECUTE_READWRITE`, `MEM_PRIVATE`, containing the
  page's own eight immediates.
* optimised JS at `0x7ffdb6c40000` — `PAGE_EXECUTE_READWRITE`, `MEM_PRIVATE`, 256–512 KiB.
* Both regions also carry one `R-X` page at their base (metadata/header), then RWX for the code.
* Both are **`MEM_PRIVATE`**, so there is exactly one virtual address for those pages: **a
  separate writable alias of executable memory — the shape W^X takes on Windows — does not exist
  here** [M for the type, [I] for the inference].

This is the runtime confirmation of W46's source reading (`platform-win32.cc:892`
`PAGE_EXECUTE_READWRITE`). If you could write there, you could write shellcode. You cannot get
there (§2).

## 4. Q3 — does CFG's bitmap cover the JIT pages? **YES — as ALL-VALID.** [M]

This is the most valuable single result in this note, and it is the opposite of what a defender
would hope for.

* Process mitigation policy, read at runtime: **`EnableControlFlowGuard=1`,
  `EnableExportSuppression=0`, `StrictMode=0`.**
* The bitmap is located by structure and then **validated against ground truth the harness
  controls**: the address-taken `veh()` in our own `/guard:cf` image must be VALID and a stack
  address must not be. Both hold at `0x7df5c3690000`; `LoadLibraryA` and
  `Qt6WebEngineCore.dll+0x1000` are VALID there too.
  Formula used: `word = *(u64*)(bitmap + (addr>>9)*8)`, `bit = (addr>>3)&63`, `|1` if `addr&0xF`.
* **At the exact addresses of the page's own compiled code** — wasm RWX and optimised-JS RWX, the
  bytes we planted via the immediates — the bitmap word is
  **`0xFFFFFFFFFFFFFFFF` → VALID TARGET, in every probe, 6/6 runs.**
* The all-ones coverage tracks commitment exactly: of the first 64 bitmap words spanning JIT
  group 0, **16 are non-zero — precisely the 8 KiB that is committed**; the reserved remainder is
  zero. So the kernel marks executable commits valid and nothing ever clears them.
* Controls, same runs: `dispatch_tables` and the cage base → **bitmap page not committed ⇒
  invalid**. The probe distinguishes code from data.
* Corroboration from the binaries: **no module imports or even contains the string
  `SetProcessValidCallTargets`** (`peinfo.py` over `QtWebEngineProcess.exe`, `WickrPro.exe`,
  `Qt6WebEngineCore.dll`) — V8 has nothing to register because the default is already all-valid.
  `Qt6WebEngineCore.dll` declares **401 422** CFG-valid call targets of its own; none of that
  applies to JIT memory.

**⇒ CFG imposes no constraint on entering JIT code on this build.** Note the tension with W46's
source reading, which found V8 requesting `PAGE_EXECUTE_READWRITE | PAGE_TARGETS_INVALID`: the
measured runtime state is all-valid anyway. Most likely the pages are committed RW and later
`VirtualProtect`ed to RWX without `PAGE_TARGETS_NO_UPDATE`, which re-marks the range valid [I] —
but the *state* above is measured, whatever the mechanism. Two independent lines (W46's
`guard(nocf)` annotation, this bitmap) now agree: **CFG was never the obstacle.**

## 5. Q4 — what is actually reachable by a 4-byte, 4-byte-quantised ±2 GiB write [M]

The window is almost entirely empty. Identical structure in 6/6 runs:

```
=== regions within A4's +-2 GiB write window [dt_elems-2GiB .. dt_elems+2GiB] ===
  0x237c00000000 0x00001000 commit  RW-  private     -0.50 MiB
  0x237c00001000 0x0003f000 reserve -    private     -0.50 MiB
  0x237c00040000 0x00080000 commit  RW-  private     -0.25 MiB
  0x237c000c0000 0x3ff40000 reserve -    private     +0.25 MiB
  -> 4 regions; committed 0.50 MiB, reserved 1023.50 MiB, rest FREE (window is 4 GiB wide)
```

**No executable memory. No image. No mapped memory. No code pointer table. No mojo/IPC state.**
Just V8 trusted space, of which half a megabyte is committed.

Ranked by usefulness, everything the write can actually hit:

1. **Raw wasm code pointers — in range, a few hundred bytes from the write origin, measured.**
   Scanning committed trusted space for values that land inside a JIT code region finds **1–2 of
   them per run**, at `dt_elems + 796`, `dt_elems + 888` and `dt_elems − 152` — full 64-bit raw
   code addresses, all comfortably inside the ±2 GiB window. One carries exactly the shape of a
   `WasmDispatchTable` entry — `{ Address target; ProtectedPointer implicit_arg; int32 sig }`,
   `wasm-objects.h:758-780` [P]:
   ```
   0x635f00041af0 (dt_elems+888) -> 0x4f0b1aba1005      [into the wasm JIT region]
       context: [+0] 00004f0b1aba1005   [+8] 0000000008000001   [+16] 0040480000001ecd
                 ^ target (note +5: past the prologue)  ^ implicit_arg (odd ⇒ tagged) | sig
   ```
   [M for the bytes and the addresses; **[I]** for the field naming.] A4 can overwrite **either
   4-byte half** of such a word: the low half redirects an indirect-call target within a 4 GiB
   neighbourhood of existing code, **without writing a single byte of code**. This is the lead
   W43 §8 flagged and refused to claim; it is now measured to be *in range*, and nothing more.
   Note it does **not** contradict W48's finding that the `Code`-object fallback is closed
   (under `V8_ENABLE_SANDBOX` `Code::kInstructionStartOffset` has size 0) — that is about `Code`;
   wasm dispatch tables keep a raw target.
2. **The `sig` word of the same entry** — the `call_indirect` type check compares it; a chosen
   value is a type-confusion primitive rather than a control-flow one.
3. **`WasmDispatchTable::length` / `capacity` int32s** — already written once in W43 §6b (that is
   how the byte-exact nonce was placed), i.e. a bounds field is demonstrably writable.
4. **`dispatch_tables` elements themselves** — 4-byte compressed trusted pointers, a full-width
   overwrite; this is W43's demonstrated Mode-1/Mode-4 target.

Nothing else is even mapped. **A data-only route that drives the browser process through mojo/IPC
is not supported by this reachable set** — no mojo state is in the window, and mojo's other end is
in `WickrPro.exe`, a different process (W18).

## 6. The page-side column — what the exploit itself can see [M]

The harness seeing something is not the exploit seeing it. W42's out-of-cage read chain was
re-run on this box today, against harness-planted random nonces at `parent_data + T`:

| T | hops | result |
|---|---|---|
| 1.25 TiB | 321 | **byte-exact 2/2** (reproduces W42) |
| **4 TiB** | **1 025** | **byte-exact 2/2 — 3.2× further than W42 ever demonstrated** |
| 16 TiB | 4 097 | forge completes (`forgeOK:true`, 2/2), harness plant never landed → **inconclusive** |
| 128 TiB | 32 769 | page does not reach the forge within 150 s → **does not work** |

Against the measured geometry:

* **The V8 code range is ~32 000 hops from the cage** (31 768 / 32 030 / 32 151 / 32 238 /
  32 302 / 32 626 across the six runs — remarkably stable, because the code range is a per-boot
  constant and the cage is only 0.5–4 TiB up). That is the regime that **failed** above.
* **Trusted space — A4's own write window — is 4 745 to 23 444 hops from the cage** (18.5–91.6
  TiB; above the cage in 6/6 runs). Between the demonstrated 1 025 and the failed 32 769. So the
  page reading its own write window is **plausible but not demonstrated**, and in any case the
  page cannot compute the required `T` on its own: it knows compressed in-cage offsets, not the
  cage base.

**⇒ Both columns agree. The exploit cannot see V8's code, and has not been shown to see the
region it can write to.**

## 7. Verdict

* **Is a JIT/W^X route viable under CFG with a 4-byte quantised ±2 GiB write? NO.** [M]
  Not because of CFG — the bitmap is **all-valid** over every JIT page (§4). Not because of W^X —
  the pages are **RWX** with no writable alias (§3). Purely because of **reach**: the code is
  33 295–109 623 GiB away from the only address A4 can write to, and the page's own read cannot
  span that distance either (§6). W46's claim that *an out-of-cage write is by itself code
  execution on this build* survives intact — but **A4 is not that write.**
* **Best alternative the reachable set actually supports:** the **`WasmDispatchTable` entry at
  `dt_elems+796`** — a raw code pointer, in range, 4-byte-writable (§5.1), plus its `sig` word.
  This is control-flow redirection with no code emission. **Not demonstrated.** The honest gap is
  W43 §6's: address-choice and value-choice have each been demonstrated, never *simultaneously*
  without harness assistance, and a dispatch-table `target` needs both.
* **Data-only via mojo to the browser process: not supported** — nothing of the kind is in the
  window (§5).
* **This does not change the escape claim.** Out-of-cage read (W42) + out-of-cage write (W43) =
  V8 sandbox escape, already held. Code execution remains **not achieved**.

## 8. What would relax the write constraint

1. **A second `K` giving a different origin — no.** The origin is
   `trusted_instance_data->dispatch_tables()`, one array per instance, and **every instance's
   array lives in the same 1.00 GiB trusted-space reservation** (measured: 4 GiB-aligned base,
   exactly `0x40000000` reserved, 6/6 runs). Choosing a different instance moves the origin by at
   most 1 GiB. Same window, same emptiness. (W43 §6c's mode 4 already exploits exactly this: the
   second instance's array is a constant 1052 bytes away.)
2. **A chained write that repositions `dispatch_tables` — no.** W43's second hop (§6b) lands
   anywhere in the 4 GiB trusted compression cage. Still 4 GiB, still ~125 TiB short of the code.
3. **What would actually work: a primitive with unbounded index arithmetic.** W46's top lead —
   **V8 issue 421403261 (no CVE)**, the Liftoff missing `clear_i32_upper_half`, giving
   `array_base + attacker_u64` — has **no window at all**. This map strengthens that
   recommendation: the problem to solve is reach, and that bug is the only candidate on the list
   that solves it.
4. **Free intelligence for whatever primitive comes next:** the code range is at
   **`0x7ffdb6c00000`, constant per boot, 512.00 MiB, RWX** — no leak needed to find it, and
   `−537.2 MiB` from `Qt6WebEngineCore.dll` if the DLL base is known instead.

## 9. Artifacts

`scratch/w47/`:
* `w47map.c` / `.exe` (build with `build.bat`, `/guard:cf`) — the mapper; `w47-map.html` — the
  recon page; `w47run.py` — driver (fresh port per run).
* `w47map-<port>.log` (9113, 9115, 9121, 9123, 9125, 9153 — the runs quoted here),
  `w47regions-<port>.csv` (the full region tables), `w47anchors-<port>.json`.
* `peinfo.py` — PE `DllCharacteristics` / `GuardFlags` / `GuardCFFunctionCount` reader.
* `w47read.c` / `.exe`, `w47read.py`, `w47gen.py`, `w42-forge.tmpl.html`,
  `w47-read-{1_25T,4T,16T,128T}.html`, `w47read-<port>.log` — the page-side reach ladder of §6
  (a fork of W42's stage-2 harness with `T` as an argument).

No third-party exploit code was downloaded or run. Only harness processes were started or
stopped; the live product was never touched. Everything is loopback, one fresh port per run.
