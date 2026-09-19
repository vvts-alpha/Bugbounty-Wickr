# W64 — Route B: `bufferData(DYNAMIC_DRAW)` → `malloc(0x2B0)` → freed TF block reclaim

Written 2026-08-07. Follows W63 (TF11 UAF source analysis, measurement plan) and M4
(allocator identification). Every claim **[S]** source-confirmed, **[M]** measured, **[I]** inferred.

**Result: Route B is SOURCE-COMPLETE and ALLOCATOR-VERIFIED. A WebGL page calling
`bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)` with `data.length == 0x2B0` triggers
ANGLE's `SystemMemoryStorage` → `MemoryBuffer::resize()` → `malloc(0x2B0)` with page-controlled
content, which reclaims the freed TF11 D3D11 COM block at idx=0 (LIFO). The end-to-end
write-1 landing requires measurement on real Intel GPU hardware (VMware SVGA 3D does not
implement the SO pointer-chase that produces the write-1).**

---

## 1. Source trace: WebGL → malloc  [S]

```
gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
  → Buffer11::setData()
    → updateD3DBufferUsage(DynamicDraw)  →  mUsage = D3DBufferUsage::DYNAMIC
    → setSubData(target, data, size, offset=0)
      → supportsDirectBinding() → false (mUsage != STATIC)
      → getBufferStorage(BUFFER_USAGE_SYSTEM_MEMORY)
        → first call → new SystemMemoryStorage(renderer)  [small obj, different LFH bucket]
      → writeBuffer->resize(size, preserveData=false)
        → MemoryBuffer::resize(size)
          → malloc(sizeof(uint8_t) * size)    ←← RECLAIM TARGET, size passed verbatim
      → memcpy(mSystemCopy.data(), data, size)  ←← CONTENT = page-chosen bytes
```

### Key gates:

| Gate | Source reference | Result |
|---|---|---|
| `DYNAMIC_DRAW` → `mUsage = DYNAMIC` | `BufferD3D.cpp:65-68` | Only `DynamicDraw` and `StreamDraw` produce `DYNAMIC` [S] |
| `supportsDirectBinding() == false` | `Buffer11.cpp:1007-1012` | Only `STATIC` returns true [S] |
| `setSubData` → `BUFFER_USAGE_SYSTEM_MEMORY` | `Buffer11.cpp:404-411` | Non-Uniform + non-direct → SystemMemoryStorage [S] |
| `MemoryBuffer::resize()` → `malloc(size)` | `MemoryBuffer.cpp:46` | `malloc(sizeof(uint8_t) * size)`, no rounding [S] |
| Content = page bytes | `Buffer11.cpp:420+` → `SystemMemoryStorage::copyFromStorage` | `memcpy` from the GL buffer data [S] |

### Usage hint mapping:

| WebGL constant | `gl::BufferUsage` | `mUsage` | `supportsDirectBinding` | Storage path |
|---|---|---|---|---|
| `STATIC_DRAW` | StaticDraw | **STATIC** | true | NativeStorage (staging) |
| `DYNAMIC_DRAW` | DynamicDraw | **DYNAMIC** | **false** | **SystemMemoryStorage → malloc** |
| `STREAM_DRAW` | StreamDraw | **DYNAMIC** | **false** | **SystemMemoryStorage → malloc** |
| `DYNAMIC_COPY` | DynamicCopy | STATIC | true | NativeStorage (staging) |
| `STREAM_COPY` | StreamCopy | STATIC | true | NativeStorage (staging) |
| `STATIC_READ` | StaticRead | STATIC | true | NativeStorage (staging) |

⚠ W56's `mkbuf()` used `DYNAMIC_COPY` — this goes to STATIC/staging, NOT SystemMemoryStorage.
Route B requires `DYNAMIC_DRAW` or `STREAM_DRAW`.

---

## 2. Allocator verification  [M]

### 2a. Static PE analysis (from M4)

`Qt6WebEngineCore.dll` (SHA256 `6617C664...`) imports `malloc`/`free` from UCRT
(`api-ms-win-crt-heap-l1-1-0.dll`). Zero PartitionAlloc symbols. CRT malloc → NT default heap. [M]

### 2b. Dynamic reclaim (from M4 + W64)

| Run | Mode | malloc return | Freed block | Landed? |
|---|---|---|---|---|
| M4 | mallocreclaim | `000000EA83AFBED0` | `000000EA83AFBED0` | **YES, idx=0** |
| W64-1 | mallocwrite:self | `000000D4698BAD70` | `000000D4698BAD70` | **YES** |
| W64-2 | mallocwrite:self | `00000080008F9A50` | `00000080008F9A50` | **YES** |
| W64-3 | mallocwrite:self | `000000CD1AB1C3D0` | `000000CD1AB1C3D0` | **YES** |

**4/4 exact match, always idx=0 (first malloc after free). [M]**

---

## 3. VM limitation: write-1 not testable on VMware SVGA 3D

The write-1 primitive (`mov byte [rax], 1` at `igd10umt64xe.DLL+0xAE138`) was measured on
the Intel UMD on real GPU hardware. On the VMware SVGA 3D virtual GPU:

- `freedwrite:self` (direct block patch + re-fire): **hangs/crashes at SOSetTargets** — the
  VMware UMD does not implement the same pointer-chase for SO binding state.
- `mallocwrite:self` (malloc reclaim + re-fire): **same result** — crashes at SOSetTargets.

This is NOT a defect in the reclaim mechanism. The reclaim itself succeeds (4/4 landed=YES).
The re-fire simply cannot be observed on the VMware driver.

**The end-to-end measurement requires the real-GPU host with Intel UMD.**

---

## 4. WebGL POC

`scratch/w64/g1-reclaim.html` — parameterised by `?mode=X`:

| Mode | What it does |
|---|---|
| `posctl` | Clean TF capture + readback (must pass 256/256) |
| `negctl` | 2-slot TF + re-fire WITHOUT delete (must survive) |
| `base` | Trigger with no spray (same as W56 groom=0) |
| `mal41` | Route B: `bufferData(DYNAMIC_DRAW)` spray, 0x41 fill, 16 copies |
| `mal00` | Route B: `bufferData(DYNAMIC_DRAW)` spray, 0x00 fill, 16 copies |
| `mal42` | Route B: `bufferData(DYNAMIC_DRAW)` spray, 0x42 fill, 16 copies |
| `comctl` | Control: `DYNAMIC_COPY` spray (NativeStorage COM reclaim) |

**Diagnostic key:**
- `mal41` crash at addr containing `0x41` bytes → **RECLAIM CONFIRMED from WebGL** [M]
- `mal00` crash at NULL-derived addr → discrimination vs `0x41`
- `comctl` survived (double-bind) → NativeStorage control (same as W56 groom=32)

Runner: `scratch/w64/w64run.py` — launches one Qt process per mode, collects VEH fault
addresses, pattern-matches crash addresses against fill bytes.

---

## 5. Harness extension

`scratch/w57/w57probe.c` — `mallocwrite` mode added:

```
w57probe.exe mallocwrite:self    # live-template + steering overwrite → re-fire
w57probe.exe mallocwrite:41      # 0x41 fill → diagnostic crash (Intel UMD only)
```

`mallocwrite:self`: copies the live block content via malloc, overwrites only the steering
offsets (iface+0x160..+0x1D0) with the write-target page address. Falls through to the
re-fire + diff flow. On Intel UMD: should produce HIT bytes in the target page. On VMware:
crashes at SOSetTargets (not a reclaim defect).

---

## 6. What this changes

| Before W64 | After W64 (incl. host measurement) |
|---|---|
| "No page-reachable spray puts attacker bytes in the freed block" (W57 blocker) | `bufferData(DYNAMIC_DRAW)` → `malloc(0x2B0)` → reclaim with page content [S][M] |
| Route B status: "needs M4" | **Route B: PROVEN [M].** malloc reclaim → write-1 at supplied+0 (self-2). |
| Spray mechanism: unknown | `DYNAMIC_DRAW` / `STREAM_DRAW` → SystemMemoryStorage → malloc(size) [S] |
| Reclaim reliability: untested | VM: 4/4 idx=0 [M]; Host: 2/5 single-shot [M] — spray required |
| Page template requirement: vtables only? | **Gating fields exist [M]** — uniform fill gates the UMD chase |
| WebGL → UMD chase: unknown | **Reachable [M]** — mal42 faulted inside igd10umt64xe |

### ~~Remaining: real-GPU measurement~~ → DONE (§7)

---

## 7. Host measurement results (2026-08-07) [M]

Host: Intel Arc Pro Graphics (vendor 0x8086, device 0x7D55), UMD `igd10umt64xe.DLL`,
driver 32.0.101.8724. Windows heap: freed block measures 0x2B0 (VM measured 0x400 bucket).

### 7a. Harness bug fix

The host AI discovered `landed` was checked AFTER the content fill, so `landed` was always 0
at fill time — the live-template / vtable-restore branches were dead code. `mallocwrite:self`
was splatting the whole block. Fix: hoisted `HeapValidate` landing check to immediately
after `malloc()`, before any fill.

### 7b. M-A — w57probe.exe mallocwrite (5 runs)

| Run | landed | Outcome |
|---|---|---|
| self-1 | NO | re-fire chased freed content; clean exit, no fault |
| **self-2** | **YES** | **HIT page+0x10000 = supplied+0 : 0x00 → 0x01** — "1 byte(s) written through the attacker-supplied pointer"; main thread survived |
| self-3 | NO | UMD write AV `mov [rdi],rax` at igd10umt64xe+0x9BEA3, target=0x4; exit 0xC0000005 |
| 41-1 | NO | heap-corruption 0xC0000374 at ntdll+0x112165 (process survived) |
| 41-2 | YES | survived: stale SOSetTargets wrote SO bookkeeping into 0x41 block (+0x240/0x248/0x258 = iface+0x160..+0x178); stale Draw inert; no fault |

**★ M-A verdict: SUCCESS [M].** With reclaim + live-template + steering overwrite
(block+0x240..+0x2A8 = wbase), the Intel UMD chase executed the write-1 exactly at the
supplied pointer (displacement +0). **Full chain proven: malloc(0x2B0) reclaim → attacker
steering → write-1 landing.**

### 7c. New facts from M-A

1. **Single-shot reclaim reliability: 2/5 [M]** — this host's LFH is not strict LIFO (VM
   was 4/4 idx=0). Misses landed nearby in-segment. Sprays (as in the WebGL POC, 16×) are
   required for reliability.

2. **0x41-fill + restored vtables does NOT reach the UMD chase [M]** — the Draw pointer-chase
   is gated by fields OUTSIDE the two vtable qwords. The runtime still wrote into the attacker
   block at bind time (primitive (a)). ⇒ the "mal41 crashes at 0x41414141" diagnostic
   assumption is wrong on this UMD; **a page-side template must satisfy the gating fields,
   not just vtables.**

3. **Reclaim misses are unstable on re-fire: 2/3 miss runs faulted** (UMD write AV at 0x4;
   heap corruption) — the UAF re-fire is live with freed/incumbent content [M].

### 7d. M-B — WebGL POC g1-reclaim.html via Qt host (14 page loads)

| Mode | Runs | Result |
|---|---|---|
| posctl | 1 | captured 256/256 ✓ |
| negctl | 1 | survived ✓ |
| base | 2 | CRASHED 2/2 — 0xC0000374 heap corruption, ntdll+0x112165 |
| mal41 | 2 | survived 2/2, TRIG-DONE |
| mal00 | 2 | survived 2/2, TRIG-DONE |
| mal42 | 4 | CRASHED 1/4 — UMD read AV at igd10umt64xe+0x128825, target=0xD0; survived 3/4 |
| comctl | 2 | survived 2/2 ✓ |

**M-B verdict: PARTIAL [M].**

- The DYNAMIC_DRAW spray materially changes the re-fire outcome from the page (base crashes
  2/2 → mal41/mal00 survive 4/4) [M].
- The page spray → stale-object → Intel UMD pointer-chase is reachable end-to-end from WebGL
  [M] (mal42 iter=0 faulted inside the UMD, not in ntdll heap code).
- **Strict criterion NOT met**: no crash address contained the fill pattern (0x41/0x42) [M
  negative]. Consistent with the harness: uniform-fill reclaim gates or deflects the chase
  (fault target 0xD0 is a small residual, not fill-derived). **Page-controlled fault address
  NOT shown.**

### 7e. What this changes (post-host-measurement)

| Before host measurement | After host measurement |
|---|---|
| Write-1 via malloc reclaim: UNPROVEN | **✅ PROVEN [M]** — self-2, supplied+0, 0x00→0x01 |
| Reclaim reliability assumption: 4/4 (VM) | **2/5 single-shot [M]** — spray needed |
| "0x41 in crash addr = reclaim proof" | **WRONG [M]** — uniform fill gates the UMD chase |
| Page-side template requirement | **Gating fields exist** beyond vtables [M] — must map them |
| WebGL → UMD chase path reachable? | **YES [M]** — mal42 faulted inside UMD |

### 7f. Next: map the chase-gating fields

The write-1 path requires more than vtables. Needed: identify which block regions must hold
live-like values for `Draw` to follow the steering offsets into the write-1. Approach: range-fill
harness modes — start from live template, progressively corrupt regions to find fatal ones.
Then construct a minimal page-side template (vtables + gating fields + steering = wbase).

---

## Artifacts

| File | Role |
|---|---|
| `scratch/w64/g1-reclaim.html` | WebGL POC with Route-B spray modes |
| `scratch/w64/w64run.py` | Qt runner (per-mode process, VEH collection) |
| `scratch/w64/mw-self*.out` | mallocwrite:self output logs (VM — reclaim YES, re-fire N/A) |
| `scratch/w57/w57probe.c` | Harness with `mallocwrite` mode added |
| Host: `C:\Temp\wickr\w64\mw-self-{1,2,3}.out` | M-A raw logs (Intel UMD) |
| Host: `C:\Temp\wickr\w64\mw-0x41{,-2}.out` | M-A 0x41-fill logs |
| Host: `C:\Temp\wickr\w64\w64-results.json` | M-B raw logs |
| Host: `C:\Temp\wickr\w57\w57probe.c` | Corrected harness (landing check hoisted) |
