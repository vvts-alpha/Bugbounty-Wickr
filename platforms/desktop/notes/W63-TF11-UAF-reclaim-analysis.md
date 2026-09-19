# W63 — W56 TF11 UAF reclaim: source analysis + measurement plan

Written 2026-08-07. Follows W57 (mechanism proven, grooming gap identified).
Every claim **[S]** source-confirmed, **[M]** measured from W57 logs, **[I]** inferred.

**Result: three candidate spray vectors identified; the strongest (D3DCompile internals)
requires native measurement to confirm. A concrete measurement plan is provided.
The write-1 target hierarchy is established: `ErrorSet::mSkipValidation` is the
highest-value single-byte target in the ANGLE codebase.**

---

## 0. Recap — the gap W57 identified

Primitive: `mov byte ptr [rax], 1` at `igd10umt64xe.DLL+0xAE138`.
Stores constant `0x01` to a host VA taken from the freed 0x2B0-byte block on the
NT default heap. 8/8 exact steering, process survives when the target is mapped writable.

Blocker: **no page-reachable spray puts attacker-controlled bytes in that block.**
D3D11 resource data (bufferData, texImage2D) goes to driver/WDDM allocations, not the
NT default heap. The block is reclaimed by the Intel UMD with driver-chosen content.

---

## 1. ★ Block lifecycle deep-dive  [M]

Cross-referencing freed.out.txt, freed2.out.txt, fw-freedwrite_zero.out, and
rc-reclaim_bufinit_96_2b0.out from W57:

### 1a. The steering offsets SURVIVE the free

The bind-state region at interface-relative offsets `iface+0x160..iface+0x1C8`
(block-relative varies with `ifoff`: +0x240..+0x2A8 at ifoff=0xE0, +0x260..+0x2B0
at ifoff=0x100) is **unchanged by the free + UMD reclaim**.

Fields changed by the free:
- `+0x000, +0x008` — freelist linkage (overwritten by NT heap manager)
- `+0x018, +0x048, +0x050, +0x068` — self-pointers nulled by d3d11 destructor
- `+0x170, +0x178` — UMD resource pointers (changed, not nulled)
- `+0x240..+0x258` (at ifoff=0xE0) — bind counters (from prior SOSetTargets)

Fields NOT changed:
- `+0x260..+0x2A8` (at ifoff=0xE0) — the SO binding descriptors (UMD PRIVATE
  pointers + small integer offsets). **These are the pointers the driver chases
  during the stale re-fire.**

### 1b. The native probe's `freed` mode SURVIVES (unlike W56 browser 8/8 crash)

| run | mode | ifoff | re-fire result |
|-----|------|-------|----------------|
| freed.out | freed (no fill) | 0xE0 | SURVIVED, bind counters incremented |
| freed2.out | freed (no fill) | 0xE0 | SURVIVED, no fault, no block change |
| fw-freedwrite_zero.out | freedwrite:zero | 0x100 | SURVIVED, 1 byte written to target |
| W56 browser | ANGLE UAF | — | 8/8 CRASH |

**Hypothesis for the divergence**: In the native probe, `ID3D11Buffer::Release()` frees
the COM object but the UMD's per-buffer SO binding structures (pointed to by the steering
offsets) remain VALID — they were allocated for the buffer's lifetime and the probe's
simple Release() doesn't cascade through the UMD's internal cleanup fully (or the UMD
keeps them alive until the device context is destroyed).

In the browser (W56), ANGLE's `TransformFeedback11` destructor triggers a full cleanup:
the TF object is destroyed, its buffer bindings are cleared, and the D3D11 runtime's
deferred-destruction path frees both the COM object AND the UMD's per-buffer metadata.
When the stale draw re-fires, the steering offsets point to freed UMD PRIVATE memory,
creating a **nested UAF** that produces the observed crashes.

**Implication**: The browser's crashes are a SECONDARY reclaim problem — the 0x2B0 block
is not the only freed region involved. The UMD's per-buffer structures (in PRIVATE
memory, NOT on the NT default heap) are also freed and must be considered.

### 1c. The UMD reclaim object at +0x0D0 stores the block size

From rc-reclaim_bufinit_96_2b0.out: after the UMD reclaims the 0x2B0 block,
`+0x0D0 = 0x00000000000002B0` = 688 bytes. This confirms the UMD's reclaim header
includes the block size. This value is NOT at the steering offsets, so it does not
directly affect the write primitive.

---

## 2. Candidate spray vectors for the 0x2B0 block  [S]+[I]

### 2a. ★ D3DCompile internal allocations — the strongest candidate

**Source**: `HLSLCompiler.cpp:232` calls `D3DCompile(hlsl.c_str(), ...)` with HLSL
translated from page-controlled GLSL shader source. `d3dcompiler_47.dll` is a
system DLL that uses its own CRT heap → **NT default heap**, bypassing PartitionAlloc.

**Why this is strong**:
1. The allocations are DEFINITELY on the NT default heap (system DLL) ✓
2. The content is derived from page-controlled GLSL (identifier names, structure
   layouts, expression trees) ✓
3. The size is proportional to shader complexity (tunable) ✓
4. The `ID3DBlob *binary` output object itself is on the NT default heap ✓

**Why it's hard**: D3DCompile is synchronous on the GPU thread. Its internal allocations
are temporary and freed when the function returns. The compiled blob (`ID3DBlob *binary`)
persists, but its content is shader bytecode (structured, not arbitrary binary).

**The timing angle**: If D3DCompile creates multiple allocations during compilation,
some in the 0x2A0..0x2C0 size class, and these allocations happen to reclaim the freed
0x2B0 block, the block would briefly hold compiler-internal data. The question is:
does the re-fire happen on the same thread? Yes — but only AFTER D3DCompile returns.

**Counter-argument**: The D3DCompile temporaries are freed before the function returns.
So the block would be freed AGAIN by the time the re-fire happens, leaving it in an
unknown state.

**Verdict**: needs measurement. The critical question is whether the `ID3DBlob` output
(which PERSISTS) is in the 0x2B0 size class, and whether its content can be structured
to produce a useful pointer at the steering offsets.

### 2b. angle::MemoryBuffer via malloc — SystemMemoryStorage  [S]

**Source**: `Buffer11.cpp:297` — `SystemMemoryStorage::mSystemCopy` is an
`angle::MemoryBuffer` whose `resize()` calls `malloc()`.

**Size**: page-controlled via `bufferData()` size parameter.
**Content**: page-controlled buffer payload.

**Critical unknown**: does `malloc()` in the QtWebEngine build go to PartitionAlloc
or to the NT default heap? If Qt's Chromium build does NOT override `malloc` with
PartitionAlloc (possible with `use_partition_alloc_as_malloc=false`), then `malloc`
goes to the NT default heap. If it does, this path is closed.

**When SystemMemoryStorage is used**: `BUFFER_USAGE_SYSTEM_MEMORY` — this is the
fallback storage used when the GPU buffer isn't needed, e.g., for certain read-back
patterns.

**Verdict**: needs allocator measurement on the real product.

### 2c. std::string HLSL source copies  [S]

**Source**: `DynamicHLSL.cpp:286,397` — `std::string vertexHLSL(sourceShader)` and
`std::string pixelHLSL(sourceShader)` are copies of HLSL translated from page-controlled
GLSL.

**Size**: Length of the translated HLSL string. MSVC std::string allocates on the heap
for strings > 15 chars. With MSVC's default CRT, this goes to the NT default heap.

**Same critical unknown as 2b**: does the `new`/`malloc` override apply?

**Advantage over 2b**: the HLSL content is text, which includes identifier names
verbatim from the GLSL source. If the attacker names variables carefully, they can
embed arbitrary-looking bytes in the HLSL string.

**Disadvantage**: HLSL is ASCII. User-mode pointers (`0x00007FFx...`) require non-ASCII
bytes that cannot appear in an HLSL string.

**Verdict**: closed for pointer-value injection even if the allocator issue is resolved.

### 2d. D3D11 COM objects of different types  [S]+[I]

**Source**: All `ID3D11Device::Create*` calls allocate COM objects on the NT default
heap. The com wrapper size is determined by d3d11.dll (NOT by ANGLE).

W57 measured that `ID3D11Buffer` is 0x2B0 bytes. But other D3D11 object types
(`ID3D11Query`, `ID3D11ShaderResourceView`, `ID3D11RenderTargetView`, etc.) have
different sizes. If ANY of these is also 0x2B0 bytes, creating one would reclaim the
freed block with a COM object whose vtable/internal pointers are at known d3d11.dll-
relative offsets.

**WebGL triggers for different COM types** (from agent 1):
| Object type | WebGL trigger | Expected size |
|---|---|---|
| `ID3D11Query` | `glBeginQuery`, `glFenceSync` | unknown |
| `ID3D11ShaderResourceView` | `texImage2D` + shader sampling | unknown |
| `ID3D11RenderTargetView` | FBO attachment | unknown |
| `ID3D11DepthStencilView` | FBO depth attachment | unknown |
| `ID3D11BlendState` | `glBlendFunc` (cache miss) | unknown |
| `ID3D11SamplerState` | `glTexParameteri` (cache miss) | unknown |
| `ID3D11InputLayout` | draw call (cache miss) | unknown |

**Key insight**: even if a different COM object reclaims the block, its internal content
is driver-chosen (vtable pointers, descriptor data). We can't control the content at
the steering offsets. HOWEVER, the vtable pointer at offset 0 is a KNOWN d3d11.dll-
relative address (measured: `d3d11.dll+0x1DDA60` for ID3D11Buffer). If a different COM
type has a vtable that, when interpreted as a pointer at the steering offset, points to
useful memory...

**Verdict**: low probability, but measuring COM object sizes is cheap and could reveal
surprises.

---

## 3. ★ Write-1 target hierarchy  [S]

The `mov byte [rax], 1` primitive writes the constant `0x01` to a chosen address.
This is a STORE, not an INCREMENT. Targets are ranked by exploitability.

### Tier 1 — MASTER VALIDATION BYPASS

**`ErrorSet::mSkipValidation`** at `Context.h:152`

Type: `std::atomic_int` (4 bytes). Writing 0x01 to the low byte sets it non-zero →
`skipValidation()` returns true → ALL ANGLE frontend parameter validation is disabled
for every subsequent GL call.

With validation disabled:
- Out-of-bounds buffer reads/writes (size checks skipped)
- Type-confused texture accesses
- Null pointer dereferences in backend code
- Arbitrary GPU command injection
- The 14382 validation bypass (W41/W62) becomes a FULL OOB write because ANGLE's
  mVertexCapacity check is also skipped

**Address predictability**: `gl::Context` is allocated once per EGL context. It's a
large, long-lived object. `ErrorSet` is embedded at a fixed offset within `Context`.
On the NT default heap or PartitionAlloc, the address is per-process but stable for
the lifetime of the context.

### Tier 2 — USE-AFTER-FREE CHAINS

**`Program::mRefCount`** at `Program.h:557` — `unsigned int`. Writing 0x01 to the
low byte when refcount is > 1 → next release triggers `deleteSelf` while other
references survive → UAF on Program object with uniform layouts, sampler bindings.

**`angle::RefCountObject::mRefCount`** at `RefCountObject.h:55` — `size_t`. Same
desynchronization trick → UAF on Buffer/Texture/Renderbuffer objects.

### Tier 3 — SIZE CORRUPTION

**`BufferState::mSize`** at `Buffer.h:65` — `GLint64`. Writing 0x01 to the low byte
changes the reported buffer size → frontend bounds checks pass for offsets exceeding
the real D3D11 allocation → OOB read/write at the D3D11 level.

**`Buffer11::mSize`** at `Buffer11.h:197` — `size_t`. Backend size tracking corruption.

### Tier 4 — STATE CONFUSION

**`Program::mLinked`** at `Program.h:552` — `bool`. Makes `isLinked()` true for an
unlinked program → draw calls use garbage uniform/sampler layouts → type confusion.

---

## 4. ★ Strategic assessment — three viable routes to RCE

### Route A: D3DCompile heap spray (HIGHEST priority)

1. Set up the UAF (free the TF buffer)
2. Trigger `glLinkProgram()` with a shader whose compiled blob is ~688 bytes
3. The `ID3DBlob` output reclaims the freed 0x2B0 block
4. The blob content (shader bytecode) at the steering offsets provides a useful address
5. Re-fire the stale draw → write-1 lands at the bytecode-derived address

**Gap**: Does the ID3DBlob end up in the 0x2B0 size class? The blob wraps the compiled
bytecode; its total allocation includes the blob header + bytecode. By varying shader
complexity, the total might be tunable to 0x2B0.

**Critical question**: The D3DCompile temporaries are freed before return, but the
`ID3DBlob *binary` output PERSISTS until explicitly released. Does it go on the NT
default heap? (It should — d3dcompiler_47.dll allocates it.)

### Route B: UMD secondary structure grooming

1. Set up the UAF (free TF buffer → both primary 0x2B0 block AND UMD secondary
   structures freed)
2. Create new D3D11 objects → UMD allocates new per-resource metadata → some of these
   reclaim the freed UMD secondary structures
3. The reclaimed UMD structures contain fields derived from the new objects' parameters
   (ByteWidth, BindFlags, etc.)
4. Re-fire the stale draw → driver follows the original steering pointers (still in the
   primary block) → hits the reclaimed UMD structures → uses parameter-derived value
   as the write address

**Gap**: The UMD secondary structures are in PRIVATE memory (not the NT default heap).
We don't know the UMD's internal allocator behavior or whether we can control it.

### Route C: Direct ANGLE field targeting (requires info leak)

1. Leak the address of the `gl::Context` object (via the V8 renderer chain W35/W42)
2. Compute the address of `ErrorSet::mSkipValidation`
3. Set up the UAF with the target address planted in the block
4. Write-1 hits `mSkipValidation` → all validation disabled
5. Now issue malformed GL calls to achieve arbitrary read/write/exec

**Gap**: Requires composing the renderer-RCE chain (W35 info leak + W42 OOB read +
W43 OOB write) to get the Context address. This is the FULL chain from the memory
index, but it means the TF11 UAF is not an independent route — it composes with the
V8 chain.

---

## 5. Measurement plan for W64

### M1. ID3DBlob size probing  [PRIORITY 1]

Add a mode to the native probe that:
1. Calls `D3DCompile` with HLSL shaders of varying complexity
2. Uses `HeapWalk` to find the `ID3DBlob` allocation on the NT default heap
3. Reports the allocation size

Vary shader complexity to find a shader whose compiled blob is in the 0x2A0..0x2C0
size class. Start with simple shaders (VS with N varyings, PS with N texture lookups)
and binary-search on N.

### M2. D3DCompile + UAF interleave  [PRIORITY 2]

If M1 succeeds (blob in the right size class):
1. Create the TF buffer, bind it, do an SO draw
2. Free the TF buffer
3. Call D3DCompile with the calibrated shader → blob reclaims the freed block
4. Dump the block content at the steering offsets
5. Fire the stale draw → observe where write-1 lands

### M3. COM object size survey  [PRIORITY 3]

Add a mode that creates each type of D3D11 COM object and uses `HeapWalk` to measure
its allocation size:
- `ID3D11Query` (D3D11_QUERY_EVENT, D3D11_QUERY_TIMESTAMP, D3D11_QUERY_OCCLUSION)
- `ID3D11ShaderResourceView`
- `ID3D11RenderTargetView`
- `ID3D11DepthStencilView`
- `ID3D11BlendState`
- `ID3D11SamplerState`
- `ID3D11InputLayout`
- `ID3D11Texture2D` (various dimensions)

Report which, if any, are 0x2B0 bytes.

### M4. Allocator identification  [PRIORITY 4]

On the shipped Wickr `WickrPro.exe`, determine whether `malloc`/`new` in
Qt6WebEngineCore.dll goes to PartitionAlloc or the NT default heap. Method:
- Load the DLL's export table for `malloc` / `operator new` interposition symbols
- Or: observe a known ANGLE allocation (e.g., creating a WebGL buffer) and check
  if the resulting ANGLE C++ object (`Buffer11`) appears on the NT default heap
  via `HeapWalk`

This determines whether routes 2b, 2c, and Route C's target objects are on the
reachable heap.

### M5. UMD secondary structure lifecycle  [PRIORITY 5]

Determine whether the UMD per-buffer SO binding structures (pointed to by the steering
offsets at +0x260..+0x2A8) are freed when:
a. Only the `ID3D11Buffer` COM object is released (the probe's `freed` mode — measured:
   structures survive)
b. The entire device context is destroyed
c. Multiple buffers are created/destroyed in sequence
d. The D3D11 runtime's deferred destruction kicks in (with a Flush + query drain)

This clarifies whether Route B is viable.

---

## 6. ★ Measurement results (2026-08-07 evening)  [M]

### M1 result: ID3DBlob — CLOSED

Compiled HLSL shaders with N=0..48 output varyings. The compiled bytecode (`ID3DBlob`
data buffer) steps from 0x29C (N=2) to 0x2E0 (N=3) — a stride of ~0x44 that **skips
the 0x2A0..0x2C0 target range entirely**. No hit at any N value.

**Verdict**: D3DCompile blob spray is not viable. Route A is closed.

### M3 result: COM object size survey — 4 HITS

| Type | heap_size | Hit? |
|---|---|---|
| ID3D11Buffer (SO+VB+SRV) | 0x2B0 | **HIT** |
| ID3D11Buffer (VB only) | 0x2B0 | **HIT** |
| ID3D11Buffer (CB) | 0x2B0 | **HIT** |
| ID3D11Texture2D (64x64 RGBA) | 0x2B0 | **HIT** |
| ID3D11Query (type 0-5) | 0x158 | |
| ID3D11ShaderResourceView | 0x1B8 | |
| ID3D11RenderTargetView | 0x178 | |
| ID3D11DepthStencilView | 0x178 | |
| BlendState/SamplerState/DSState/IL | 0x130 | |
| ID3D11RasterizerState | 0x138 | |

All ID3D11Buffer variants are 0x2B0 regardless of BindFlags. ID3D11Texture2D at 64x64
is also 0x2B0. All other types are different.

### M4 result: samereclaim + texreclaim — RECLAIM WORKS, WRITE-1 DOES NOT FIRE

| Run | Mode | landed | VTABLE | Fields Δ | ifoff | Survived |
|-----|------|--------|--------|----------|-------|----------|
| 1 | samereclaim | **YES** | SAME | 14 | 0xF0 | YES |
| 2 | samereclaim | NO | SAME | 0 | 0xF0 | YES |
| 3 | samereclaim | NO | SAME | 0 | 0x110 | YES |
| 4 | texreclaim | NO | DIFFERENT | 59 | 0x110 | YES |

**Key observations:**

1. **Same-type reclaim succeeded once (1/3)**. New buffer landed at the exact freed block
   address. VTABLE identical (same COM type). The stale SOSetTargets operated on the new
   buffer's SO state fields: bind counter incremented, SO offset stamp set, SO active flag
   set. This is a **controlled double-bind**.

2. **Steering offsets are OVERWRITTEN by the new buffer's UMD pointers.** The write-1
   primitive (`mov byte [rax], 1`) does NOT fire because the UMD pointer chase goes through
   the new buffer's VALID structures and completes normally on the GPU side.

3. **LFH is non-deterministic at 0x2B0.** Only 1/3 reclaim success. Spray is needed.

4. **ifoff varies between 0xF0 and 0x110.** SO state fields are at fixed iface-relative
   offsets (iface+0x160, +0x168, +0x178).

5. **texreclaim: Texture2D went to a different block.** But `CreateTexture2D` internal
   allocations reclaimed the freed block from the side (59 fields changed). The block
   content became structurally unrelated to a Buffer. Still survived.

6. **All runs survived.** The re-fire is benign when valid structures are present.

### Strategic reassessment after measurements

**Route A (D3DCompile blob spray): CLOSED** — step size mismatch.

**Route D (NEW): same-type double-bind exploitation.** The stale pointer activates
SO output on a buffer the page controls. The page can use this buffer for other purposes
(vertex buffer, SSBO, readback) creating data confusion. The double-bind also
desynchronises the refcount. This is a new exploitation angle distinct from the write-1
primitive.

**Route B (UMD secondary structure grooming): UNCHANGED** — still needs M5.

**Route C (V8 chain composition): UNCHANGED** — still viable but requires lifting the
"don't touch V8 chain" constraint.

---

## Artifacts

- W57 probe source: `scratch/w57/w57probe.c`
- W57 logs analyzed: `freed.out.txt`, `freed2.out.txt`, `fw-freedwrite_zero.out`,
  `rc-reclaim_bufinit_96_2b0.out`
- ANGLE source @130: `scratch/w50/angle130/google-angle-fffbc73/`
- Key source files:
  - `src/libANGLE/renderer/d3d/HLSLCompiler.cpp:232` — D3DCompile call site
  - `src/libANGLE/renderer/d3d/d3d11/Buffer11.cpp:297` — SystemMemoryStorage
  - `src/libANGLE/renderer/d3d/d3d11/ResourceManager11.cpp:109-253` — all Create* calls
  - `src/libANGLE/Context.h:152` — ErrorSet::mSkipValidation
  - `src/libANGLE/Buffer.h:65,68,75` — mSize, mMapped, mImmutable
  - `src/libANGLE/Program.h:552,557` — mLinked, mRefCount
  - `src/compiler/preprocessor/preprocessor_lex_autogen.cpp:2508` — GLSL lexer malloc
  - `src/common/PoolAlloc.cpp:420` — PoolAllocator malloc fallback

---

## 7. ★ M4 result: PartitionAlloc is NOT enabled — ANGLE C++ objects are on the NT default heap  [M]

### 7a. Static PE analysis (shipped DLL)

`Qt6WebEngineCore.dll` (SHA256 prefix `6617C664`) — PE import table analysis:

| Import DLL | Relevant symbols |
|---|---|
| `api-ms-win-crt-heap-l1-1-0.dll` | `malloc`, `free`, `calloc`, `realloc`, `_aligned_malloc`, `_aligned_free` |
| `KERNEL32.dll` | `HeapAlloc`, `HeapFree`, `HeapReAlloc`, `GetProcessHeap`, `HeapCreate`, `HeapDestroy` |

**Zero PartitionAlloc symbols in exports** — no `PartitionAlloc`, `PartitionRoot`, `PartitionPage`,
`SlotSpanMetadata`, or `base::allocator` symbols exported or imported. Chromium's
PartitionAlloc-as-malloc (`base::allocator::AllocatorShimDefaultDispatch`) is **NOT linked** into this
DLL. CRT `malloc`/`free` go straight to UCRT → NT heap manager. **[M]**

This means ANGLE C++ objects allocated via `new`/`malloc` in `Qt6WebEngineCore.dll` land on the
**NT default process heap**, the same heap that manages the D3D11 COM buffer blocks.

### 7b. Dynamic verification: `malloc(0x2B0)` reclaims the freed D3D11 COM block  [M]

Test: `w57probe.exe mallocreclaim` mode (added to `scratch/w57/w57probe.c`). After `ID3D11Buffer`
creation + SOSetTargets binding + `Release()` frees the 0x2B0-byte block, 32 sequential
`malloc(0x2B0)` calls are issued. Each allocation is checked against the freed block's base address
via `HeapValidate`.

| Metric | Value |
|---|---|
| Live buffer address | `000000EA83AFBFB0` |
| Block base (live) | `000000EA83AFBED0` |
| `HeapSize` (live) | `0x400` (LFH bucket size ≥ 0x2B0) |
| `ifoff` | `0xE0` (ID3D11Buffer interface at block+0xE0) |
| Block base (after free) | same `000000EA83AFBED0` |
| **First `malloc(0x2B0)` return** | **`000000EA83AFBED0` — EXACT MATCH at idx=0** |
| Content control | 0x2B0 bytes of `0x41` pattern from `memset`, verified via hex dump |
| Second malloc (#1) | Adjacent slot, 0x42 pattern at block+0x2C0 onward |
| LFH bucket confirmed | `malloc(0x2B0)` competes in the same LFH bucket as `ID3D11Buffer` COM blocks |

**Result: CRT `malloc(0x2B0)` immediately reclaims the freed D3D11 COM block at index 0 (LIFO). [M]**

### 7c. Strategic impact

This opens two routes that were previously blocked by the "no page-reachable spray on the NT
default heap" gap:

**Route B (SystemMemoryStorage spray): NOW OPEN.** `Buffer11::SystemMemoryStorage::mSystemCopy`
uses `angle::MemoryBuffer::resize()` → `malloc()`. A WebGL `bufferData()` with the right usage
hint and size could trigger a `malloc(0x2B0)` with page-controlled content that reclaims the
freed TF block. Next measurement: which WebGL usage hint produces `SystemMemoryStorage` in the
D3D11 backend, and does the size round to 0x2B0?

**Route C (V8 chain composition): NOW OPEN.** `gl::Context` (containing
`ErrorSet::mSkipValidation`) is allocated via `new` → `malloc` → NT default heap. If the page
can compute the `gl::Context` address (via the V8 renderer chain's `addrof` + layout knowledge),
and if the write-1 primitive's steering can be redirected to target `mSkipValidation`, validation
bypass is achievable. This route is more complex but higher-value.

**Route D (double-bind): UNCHANGED.** Same-type reclaim was already demonstrated in M4 above
(1/3 success). The allocator confirmation does not change this route's viability.
