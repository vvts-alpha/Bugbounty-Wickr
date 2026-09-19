# W36 — the patch gate is now MEASURED, not inferred

Written 2026-08-05. Every line **[M]** measured by me this wave unless marked **[I]**.

**Bottom line: the shipped Chromium tree is pinned to an exact public commit, and Qt publishes a
per-CVE backport ledger for it. Gate G1 stops being an inference from a version string and becomes
a lookup. Gate G2 stops being a check against upstream `branch-heads` and becomes a check against
the actual compiled source.**

---

## 1. The pin [M]

| fact | value | how measured |
|---|---|---|
| `Qt6WebEngineCore.dll` PE TimeDateStamp | **2025-09-17T12:45:48Z** | PE header parse |
| UA string | `QtWebEngine/6.9.2 Chrome/130.0.0.0` | live page probe in the shipped engine |
| V8 version | **13.0.245.25** | string in the DLL (`qtwebengine_chromium_v8_version` neighbourhood) |
| Chromium base | 130.0.6723.192 | prior wave; re-confirmed below |
| declared security patch level | 139.0.7258.67 | prior wave |

`qt/qtwebengine` tag **`v6.9.2`** → submodule `src/3rdparty` →
**`qt/qtwebengine-chromium` commit `136d7fe8aa41c9d4cd764a6b890af9699f5141dd`**.

That commit is `2025-08-12  [Backport] CVE-2025-8582` — the head of the Chrome **139.0.7258.66/67**
backport batch. It sits on branch `130-based`, whose `chromium/chrome/VERSION` reads exactly
`MAJOR=130 MINOR=0 BUILD=6723 PATCH=192`.

**Two independent facts agree:** the submodule pin lands on the 139.0.7258.67 batch, and the binary
declares 139.0.7258.67. The tree that was compiled is therefore known exactly.

## 2. The gate, restated mechanically [M]

```
G1 (fix NOT in the shipped build)  <=>  the fix commit is not an ancestor of 136d7fe8aa
                                        i.e. absent from the ledger, or dated after 2025-08-12
G2 (vulnerable code present)       <=>  the pre-fix construct is in the tree AT 136d7fe8aa
```

Both halves check against the **same ref, which is the source that was built**. This is strictly
better evidence than upstream `branch-heads/13.0` (V8) or `branch-heads/6723` (Chromium), because it
also captures Qt's own hand-picked backports, which upstream refs cannot show.

Fetch a file from the shipped tree:

```bash
gh api "repos/qt/qtwebengine-chromium/contents/chromium/<PATH>?ref=136d7fe8aa41c9d4cd764a6b890af9699f5141dd" --jq '.content' | base64 -d
```

## 3. The ledger [M]

Every security fix Qt applied is an explicit commit on `130-based`:
`[Backport] CVE-XXXX-YYYY` or `[Backport] Security bug <chromium-bug-id>`.
Full dump: `scratch/w36/qt130-commits.tsv` (921 commits), `qt130-backports.txt`.

**68 distinct CVEs** are backported at or before the pin. The complete list is in the tsv; the
boundary is what matters:

```
last IN the build   2025-08-12  CVE-2025-8582 / 8580 / 8578 / 8576, Security bug 421544815
--------------------------------- 136d7fe8aa — THE PIN ---------------------------------
first OUT           2025-08-19  CVE-2025-8879 (libaom), CVE-2025-8880 (Race in V8), CVE-2025-8881
                    2025-08-20  CVE-2025-8901  Out of bounds write in ANGLE
                    2025-09-16  CVE-2025-9866, CVE-2025-10200 (Critical, Serviceworker UAF),
                                CVE-2025-10201 (Mojo, $30k)
                    2025-09-17  Security bug 445380761 == CVE-2025-10585 (V8 type confusion, ITW)
                    2025-09-18  CVE-2025-10500 (Dawn), CVE-2025-10501 (WebRTC UAF)
                    2025-09-19  CVE-2025-10502 (Heap buffer overflow in ANGLE)
                    ... and everything later, through 2026-03-20 CVE-2026-4441.
```

Note the branch kept receiving backports until 2026-03-20 — **long after this build was cut**. So
the branch HEAD is *not* the shipped tree; only the pinned commit is.

### The method is validated in both directions, four times [M]

| CVE | ledger | independent earlier measurement | agrees? |
|---|---|---|---|
| CVE-2025-2783 (Mojo SBX) | backported ≤ pin | W26 disassembly: fix PRESENT at `0x1804f7930` | ✓ |
| CVE-2025-4609 (Mojo) | backported ≤ pin | W26 correction: fix PRESENT | ✓ |
| CVE-2025-6554 (V8) | backported 2025-07-08 | behavioural A/B: Qt == patched Chrome | ✓ |
| CVE-2026-2441 (Blink CSS UAF) | backported 2026-02-17, **after** pin | W20: **fires** on the shipped build | ✓ |

## 4. Two corrections to earlier waves [M]

**(a) WebGL2 works here.** W31/W20-W32 recorded "WebGL2 stays NULL on this host even with
`--ignore-gpu-blocklist`". Measured false. The earlier A/B ran through `ab.py`, which **hardcodes
`env["WGLFLAGS"] = ""`** and silently discards the caller's flags. With the flag actually delivered
(`ab36.py`):

```
webgl1 = OK renderer=ANGLE (VMware, VMware SVGA 3D (0x00000405) Direct3D11 vs_5_0 ps_5_0, D3D11)
webgl2 = OK renderer=ANGLE (VMware, VMware SVGA 3D (0x00000405) Direct3D11 vs_5_0 ps_5_0, D3D11)
```

⇒ **WebGL2-only ANGLE bugs are locally testable after all**, and the D3D11 backend is the one in
play. (CVE-2025-6558 stays dead — it was backported 2025-08-04, which is the reason that survives.)

**(b) WebGPU is genuinely dead, not merely blocklisted.** `navigator.gpu` is an object and
`GPUAdapter` is a constructor, but `navigator.gpu.requestAdapter()` returns **NULL** even with
`--ignore-gpu-blocklist --enable-unsafe-webgpu --enable-features=Vulkan,WebGPUService`. No
`third_party/dawn/**` or `src/tint/**` `__FILE__` paths exist in the DLL (only Dawn's C proc-table
names and Blink's IDL bindings). ⇒ **all Dawn / Tint / WGSL CVEs are not_affected**, including
CVE-2025-10500, CVE-2026-5281, CVE-2026-6310, CVE-2026-11687, CVE-2025-11205, CVE-2025-12725,
CVE-2026-3062, CVE-2026-2315.

## 4b. "No GPU process" re-verified under active WebGL load [M]

W17j's finding that ANGLE runs in-process was measured without WebGL actually running. Re-tested
this wave with WebGL1 **and** WebGL2 live (ANGLE / VMware SVGA 3D / D3D11), sampling the process
tree mid-run:

```
wglprobe.exe             type=(browser)      <- the Qt embedder, WickrPro.exe's equivalent
QtWebEngineProcess.exe   type=renderer
```

Two processes, and **no `--type=gpu-process`**. So GL command submission and the ANGLE D3D11
translator execute inside the browser process even when a page is driving them hard. This is the
strongest form of that test and it is what makes stage B (ANGLE / command-buffer bugs) a
*browser-process* compromise with no sandbox escape in the chain.

## 5. Component presence, re-derived from embedded source paths [M]

3,368 distinct Chromium source paths are embedded in the DLL (`scratch/w36/srcpaths.txt`).

**PRESENT:** ANGLE (104 paths — D3D 41, Vulkan 25, GL 14), gpu/command_buffer (59, incl.
`raster_decoder`), gpu/ipc (17), net (55), services/network (60), mojo (31), Skia (109), media (56),
WebRTC (384), Blink core/bindings, WebCodecs (17), WebAudio (14), MediaStream (19), IndexedDB (4),
PeerConnection (36), storage (64), extensions (91 — Qt builds a limited extensions set for PDF).

**ABSENT:** SwiftShader, Dawn/Tint, PDFium (it lives in the separate `Qt6Pdf.dll`), SafeBrowsing,
Cast, sqlite/icu/freetype paths.

V8 sandbox sub-features confirmed compiled in: `external_pointer_table`,
`shared_external_pointer_table`, `cpp_heap_pointer_table`, `trusted_pointer_table`,
`trusted_cage_base`, `trusted_space`/`trusted_lo_space`, and **`V8.JSDispatchTableEntriesCount`** —
that counter only exists in the sandbox counter block, and at tag 13.0.245.25 `BUILD.gn` sets
`use_leaptiering = v8_enable_sandbox && !v8_disable_leaptiering` with the disable defaulting false.
⇒ **leaptiering is ON and JSDispatchTable is a live sandbox-escape target.**

## 6. A structural finding about V8 sandbox bugs [M + I]

**[M]** Grepping all 921 commits on `130-based` for "sandbox" returns only OS-sandbox and build
plumbing. **Not one V8-sandbox hardening commit was ever backported.**

**[I]** V8 does not classify sandbox bypasses as security bugs, so they get no CVE, no severity, and
— the part that matters — **no merge request to a release branch**. Qt's ledger is CVE-driven.
Therefore a V8 sandbox bypass fixed in V8 *main* at any point after the 13.0 branch point
(~Sept 2024) is almost certainly still live in this build, **including ones fixed long before the
139.0.7258.67 patch level**. For this one bug class the standing "fixed ≤139 ⇒ patched" rule does
not apply. Being an inference, each candidate still needs its own G2 check against the pin.

## 7. Renderer capability surface, measured in the shipped engine [M]

`SharedArrayBuffer` is **undefined** by default (`crossOriginIsolated = false`) — but the attacker
serves their own origin, and with `COOP: same-origin` + `COEP: require-corp` on their own page
**`crossOriginIsolated = true` and `SharedArrayBuffer` becomes a function**. Measured. So SAB is
available to the attacker whenever their page is the top-level document.

Also available: resizable `ArrayBuffer`, `ArrayBuffer.prototype.transfer`, shared
`WebAssembly.Memory`, `Worker`, `WebTransport`, `RTCPeerConnection`, `VideoDecoder`, `AudioDecoder`,
`OffscreenCanvas`, service workers, `createImageBitmap`, `WebAssembly.compileStreaming`.

## 8. Artifacts

`scratch/w36/` — `METHOD.md` (the gate recipe), `qt130-commits.tsv`, `qt130-backports.txt`,
`srcpaths.txt` + `srcpaths.py` (component map), `probe.py` / `ctx.py` (marker + context dumps),
`srcget.py` (upstream fetch), `caps.html`.
`scratch/w33/` — `ab36.py` (ab.py that actually honours `WGLFLAGS`), `ab36coi.py` (adds
COOP/COEP so SAB can be tested), `w36caps.html`, `w36caps2.html`.
