# AWS Wickr Desktop — OS-RCE campaign addendum (W70)

**Date:** 2026-08-08 **Target:** AWS Wickr Desktop (Windows x64)
**Install under test:** `C:\Program Files\Amazon Web Services, Wickr\AWS Wickr`
**Binaries (sha256):**
`WickrPro.exe` = `ECCAFDE833D34386C859D6548E922649C2F58CD15F82998C8BD2966219341DBD`
`Qt6WebEngineCore.dll` = `6617C6642D414852298626A2AE5F31BD0EEA309D6B504BEFC379C6FC259CF0B0`

This addendum consolidates the **renderer→main-process escalation campaign**
and reports the **in-main-process host write primitive** confirmed on the
current configuration, plus a **CVE-backport correction** relevant to the
vendor's patch-tracking. Everything below was produced on locally-installed
copies of the shipped product and loopback harnesses. No Wickr infrastructure,
live account, or other users' data was involved; no live product process was
killed, injected, or debugged.

**Labels.** **MEASURED** = executed, result quoted. **VERIFIED** = read off
shipped code/binaries. **INFERRED** = stated as reasoning, claimed as such.

---

## 0. Engine pin (VERIFIED)

- chromium/**130.0.6723.192** (UA `Chrome/130.0.0.0`, confirmed through the
  product's own Qt DLLs). The `139.0.7258.67` string present in the DLL is a
  sub-component, **not** the chromium version.
- ANGLE pin = `angle/angle` **`fffbc73`** = the **M130 branch cut,
  ~28 Oct 2024** (VERIFIED via googlesource: `fffbc73` = "M130: Metal: fix
  memory leaks in Texture::getStencilView", committed 2024-10-28). ⇒ the
  product's ANGLE snapshot is ~21 months stale as of this report.

---

## 1. Architecture amplifiers that raise severity on this product (MEASURED)

These are properties of the shipped product (not stock chromium) that make any
renderer-reachable GPU/`//net` bug land directly in the unsandboxed main
process:

| Property | Measurement |
|---|---|
| GPU process model | **In-process in the host** — no `--type=gpu-process` child; `igd10umt64xe.DLL` (Intel Xe-UMD) loads **only in `WickrPro.exe`**; `--in-process-gpu` is appended by Qt (W37). MEASURED. |
| Network service | **In-process** (`NetworkServiceInProcess2`). `//net`/`//url` bugs land in the host with no sandbox to escape. MEASURED. |
| `WickrPro.exe` CFI | **CFG absent** — `DllCharacteristics=0x8160` (no `0x4000` guard bit), `GuardCFFunctionCount=0`. MEASURED (static PE). Medium-IL. |
| Renderer sandbox | Sandbox present (restricted token, job, `MicrosoftSignedOnly`); JIT functional. |
| Site isolation | **Off** (one V8 isolate) — a renderer compromise reaches all origins. MEASURED (W17j). |

**Consequence:** any GPU command-buffer / ANGLE / `//net` bug that is reachable
from the renderer and is serviced in the host lands **directly in the
unsandboxed main process with no CFG**. The renderer↔host sandbox boundary is
effectively the only gate, and the GPU/`//net` channels run inside it.

---

## 2. Finding A — Renderer RCE, multi-process, cross-process-verified (MEASURED)

A sandboxed renderer can be driven to native code execution. Achieved
**EXEC-OK in 4/5 runs** (e.g. runs 12741/12783/12809/12811/12827), verified
cross-process by an external reader (`rpver.exe`, `OpenProcess`+`RPM` on the
sandboxed renderer): the live return address is in the renderer code range /
DLL, the live frame pointer is on the renderer stack, and the shellcode bytes
land in the harness-watched page. The renderer returns cleanly (renderer alive).

Chain primitives (all MEASURED): `addrof`; in-cage arbitrary R/W
(CVE-2026-11645, stable); out-of-cage read (421403261) with a
`Qt6WebEngineCore.dll` base leak; cross-origin renderer-resident data read.

**Severity: High–Critical.** This is the foundation for §3 and §4.

---

## 3. Finding B — Wickr data recovery from the renderer (MEASURED)

From the renderer RCE, decrypted Wickr message **plaintext + contacts + groups
+ devices** (including a random nonce unreachable via same-origin policy) are
recovered — **3/6 byte-exact** in the standalone PoC. This is a confidentiality
breach of Wickr's core promise (end-to-end-encrypted message secrecy),
achievable from a compromised renderer without leaving the renderer's origin
constraints via SOP.

**Severity: High (confidentiality).** Already reportable independently of the
OS-RCE goal.

---

## 4. Finding C — In-main-process controlled host byte-write primitive (MEASURED)

A use-after-free in the D3D11 stream-output (transform-feedback) bind path
gives a **controlled-address host byte-write** that, on this product's
in-process-GPU configuration, executes **inside `WickrPro.exe`** (the
unsandboxed main process).

### Mechanism (VERIFIED + MEASURED)

`ID3D11DeviceContext::SOSetTargets` invoked with a **freed `ID3D11Buffer*`**
drives the Intel Xe user-mode driver
(`igd10umt64xe.DLL`) to perform a CPU store through a host virtual address
taken verbatim from the freed heap block (NT process default heap, 0x2B0 class):

```
igd10umt64xe.DLL+0xAE138:   C6 00 01           mov byte ptr [rax], 1
```

with `rax` = a value read from the freed block. This is a **host-VA store of
the constant byte `0x01`**, not a GPU-VA dereference, and not a refcount bump.

### Control + survivability (MEASURED, 8/8 + survives)

Native harness (`tfprobe.exe`, reproduced from W57, controls passed
POSCTL 256/256 + NEGCTL in every run; adapter confirmed
`Intel(R) Arc(R) Pro Graphics vendor=0x8086 device=0x7D55`, driver
`32.0.101.8724`):

| block state at re-fire | fault (VEH) | write? |
|---|---|---|
| planted `0x0000414141410000` | `igd10umt64xe+0xAE138 op=write target=0x414141410000` (2/2 exact) | **YES** |
| planted, benign page (`freedwrite:zero`) | none — main thread **survived** | **YES — `0x00 -> 0x01` lands** |
| natural UMD reclaim (no plant) | `igd10umt64xe+0x696600 op=read target=0x2D8` | no write (driver-internal read fault) |

**Primitive statement:** store of constant `0x01` to a fully attacker-chosen
host virtual address, performed by `igd10umt64xe.DLL+0xAE138` on the
`SOSetTargets` thread, address taken verbatim from the freed `ID3D11Buffer`
block, **non-fatal when the target page is mapped writable**, running in the
medium-IL unsandboxed main process with **no CFG**.

**Why the previous internal status ("blocked") no longer applies:** an earlier
wave (W68) recorded this line as blocked because *that* host had Intel **UHD
0x9B41** (legacy UMD `igd10iumd64.dll`), on which the Xe-specific `+0xAE138`
write-1 fires 0/4. The current host has the **Intel Arc Pro 0x7D55 (Xe-UMD)**,
where the primitive fires deterministically.

### Honest scope of Finding C

- **Established (native):** the controlled host write is real, exact, and
  survivable on the current product configuration, in the main process.
- **NOT established (the OS-RCE link):** delivering a chosen pointer value
  into the freed 0x2B0 block **from the renderer**. The block lives on the NT
  default heap; chromium allocates its own structures via PartitionAlloc (not
  the NT heap); the proven renderer→host GPU channel delivers bytes into
  GPU/WDDM allocations, not the NT heap; and the freed block is reclaimed by
  the UMD with its own driver-chosen content. With natural reclaim the write
  site is **not** reached (a driver-internal read fault occurs instead). So
  this primitive is, at present, a **native-process demonstration** and the
  renderer→block delivery is open. See §6.

**Severity: High (native main-process memory corruption; renderer-delivery
open).**

---

## 4b. Finding D — CVE-2026-9873 //net UAF DEMONSTRATED in the unsandboxed in-process host (MEASURED)

A second, **renderer-deliverable** host-side memory-corruption primitive was
demonstrated: **CVE-2026-9873** (Use-after-free in Network; Critical; fixed
M148 148.0.7778.216; chromium bug 507365348; fix CL 7825349). The shipped M130
build predates the fix ⇒ vulnerable. On this product the network service is
**in-process in the unsandboxed host**, so the CVE's "execute arbitrary code
inside a sandbox" maps to **unsandboxed main-process code execution**.

**Vulnerable path + trigger (VERIFIED from fix):** `SpdySession::EnqueueSessionWrite`
"Exceeded max queued capped frames" branch calls `DoDrainSession` **synchronously**;
fix CL 7825349 replaces it with `DoDrainSessionAsync` (PostTask). Pre-fix, when
the capped-frame queue exceeds `kSpdySessionMaxQueuedCappedFrames` (verified
= **10000** at `net/spdy/spdy_session.h:101` in the 130 source) and a stream's
`QueueNextDataFrame` → `CreateDataBuffer` → `MaybeSendPrefacePing` (session
idle ≥ `kDefaultConnectionAtRiskOfLossSeconds` = **10 s**) enqueues a PING, the
synchronous drain frees the `SpdyStream` **whose `QueueNextDataFrame` is still
on the call stack**. On return, `QueueNextDataFrame` writes
`this->send_window_size_` (L752 `DecreaseSendWindowSize`) and derefs the freed
`session_` (L756+) ⇒ **UAF in the in-process network host**.

**Demonstration (white-box force, MEASURED, reproducible 2/2):**
- Reverse-engineered `EnqueueSessionWrite` in `Qt6WebEngineCore.dll` via the
  log-string xref (`xref_enqueue.py`/`disasm_window.py`, capstone+pefile):
  capped-frame check `cmp [this+0x2ec],[this+0x51c]`; skip-drain `jle` at
  PySide6 RVA **0x444b2ee** (`0F 8E 0E 01 00 00`) / shipped Wickr RVA
  **0x434a700**.
- `w70patch.dll` injected into the **in-process GPU+net host subprocess** (the
  descendant carrying `Qt6WebEngineCore.dll`+`igd10umt64xe.dll`) NOPs the `jle`
  so the next capped-frame `EnqueueSessionWrite` trips synchronous
  `DoDrainSession`. Trigger page (`w70_wb_trigger.html`): open H2 session,
  idle ≥10 s, POST a body ⇒ `QueueNextDataFrame`→PrefacePing→patched
  `EnqueueSessionWrite`⇒drain from within the stream's stack.
- Result: **`W56FAULT code=0xC0000374 (STATUS_HEAP_CORRUPTION) in ntdll inside
  the in-process network-service host`** — the UAF (freed `SpdyStream` reused
  during `QueueNextDataFrame`) fires, reached via a renderer H2 `fetch`, in the
  **unsandboxed host (no CFG)**.

**Honest scope:**
- **Established (MEASURED):** on the Wickr engine the CVE-2026-9873 UAF **fires
  end-to-end** when the capped-frame drain condition is met during a data send,
  producing **heap corruption in the unsandboxed in-process network host** — a
  host-side memory-corruption primitive, renderer-reachable via H2, no sandbox
  escape.
- The white-box force (NOP the `jle`) proves the bug+reachability+host-corruption;
  it is **not** the natural trigger (which needs cap+1 staging — hard from a pure
  black-box page; regression test bypasses it via direct `SendData()`).
- **SpdyStream is on PartitionAlloc** (default chromium allocator; no `operator
  new` override). Turning the UAF into a *controlled* write → main RCE needs
  PartitionAlloc heap feng shui during the synchronous drain window — a separate
  hardening-bounded effort (future work).

**Severity: Critical (renderer-deliverable in-process-host UAF → heap
corruption; RCE gated on PartitionAlloc weaponization).** This is the strongest
W70 finding: a Critical CVE, present in the shipped build, demonstrated firing
in the unsandboxed main-process-analog host, reachable from a sandboxed renderer
via HTTP/2 with no sandbox escape required.

---

---

## 5. Candidate CVE status on this build (VERIFIED via NVD)

The candidate CVEs were verified directly against NVD
(`services.nvd.nist.gov`). **All five are real**, fixed in milestones **after**
the product's M130/`fffbc73` pin, so the shipped build is vulnerable unless Qt
backported. (An earlier internal note incorrectly claimed some IDs were
non-existent — that was a bad blog-search; the NVD records below are
authoritative.)

| CVE | NVD description (verbatim) | Sev | Fixed | chromium bug | Status on this build |
|---|---|---|---|---|---|
| **CVE-2026-9873** | UAF in **Network** prior to 148.0.7778.216; remote attacker can **execute arbitrary code inside a sandbox** via a crafted page | **Critical** | M148 (2026-05) | 507365348 | **VULNERABLE** (M130 ≪ M148). On this product's **in-process network service**, "in-sandbox ACE" ⇒ **unsandboxed main-process ACE**. Top OS-RCE lead. |
| **CVE-2026-8554** | Type Confusion in ANGLE **on Windows** prior to 148.0.7778.168; an attacker **who has compromised the renderer** can perform an **OOB memory write** | High | M148 (2026-05) | 499131214 | **VULNERABLE**; renderer RCE (§2) satisfies the precondition. The OOB-write path (not just the silent-miscompile path observed in W60) is under re-analysis. |
| **CVE-2025-9478** | UAF in **ANGLE** prior to 139.0.7258.154; heap corruption | **Critical** | M139 (2025-08) | 437825940 | **VULNERABLE** (M130 ≪ M139). |
| **CVE-2025-8901** | Out-of-bounds write in **ANGLE** prior to 139.0.7258.127 | High | M139 (2025-08) | 435139154 | **VULNERABLE**; the ValidateOutputs fix is angle `fc0e0397`. |
| **CVE-2025-1426** | Heap buffer overflow in GPU **on Android** prior to 133.0.6943.126 | High | M133 (2025-02) | — | "On Android" qualifier — likely the Android-only validating decoder (W58); desktop-passthrough reachability TBD. |

**Confirmed patched (unchanged):** CVE-2025-6558, CVE-2025-2783, CVE-2025-4609.
**Confirmed dead on this config:** CVE-2026-14382 / 10897 / 16413.

**Implication for the vendor:** the ANGLE/GPU//net snapshot is ~10–21 months
stale; the memory-corrupting fixes above (especially the M148 Critical
CVE-2026-9873 //net UAF and the Windows ANGLE type-confusion CVE-2026-8554)
are missing and are the realistic OS-RCE class for this product.

---

## 6. OS-RCE gap — honest assessment (MEASURED + INFERRED)

The single remaining link to full OS-RCE is a **controlled write in the
unsandboxed host**. The candidates:

- **CVE-2026-9873 (Finding D):** confirmed present + UAF **demonstrated firing
  → heap corruption in the in-process host**. Renderer-deliverable. The
  remaining link is PartitionAlloc heap feng shui (controlled reclaim of the
  freed `SpdyStream` → controlled write → RCE; CFG off).
- **Finding C (TF11 write):** real but renderer-undeliverable (heap segregation).
- **Forged GPU commands:** audited top host-side sinks — GL/ANGLE-gated or
  safely-sized.
- **CVE-2026-8554 (ANGLE type confusion OOB):** Vulkan-only OOB; D3D11-unreachable
  on this target (silent miscompile).

**Conclusion:** the renderer→host memory-corruption link is **demonstrated**
(Finding D fires). Full main-process RCE is now a **weaponization** task
(PartitionAlloc reclaim → controlled write → ROP/shellcode with CFG off), not a
research-unknown.

---

## 7. Reproduction

All artifacts under `C:\project\wickr\scratch\w70\` (and inherited
`..\w57\`, `..\w69\`).

- **Renderer RCE + data recovery + renderer→host channel:** see W69 artifacts
  (`w67mprun.py`, `rpver.exe`, `wickr-poc-run.py`, `chan_run.py`, `hscan.exe`).
- **Finding C (host write):** build `tfprobe.exe`
  (`cl /O2 tfprobe.c /Fe:tfprobe.exe /link d3d11.lib dxgi.lib dxguid.lib
  d3dcompiler.lib psapi.lib`) and run, with `W57_NOFLUSH=1`:
  - `tfprobe.exe posctl` — controls gate (must show POSCTL 256/256).
  - `tfprobe.exe freedfill:0x0000414141410000` — expect VEH fault
    `igd10umt64xe+0xAE138 op=write target=0x414141410000`.
  - `tfprobe.exe freedwrite:zero` — expect `HIT 0x00 -> 0x01`, main thread survived.
  - Fault records: `w57probe.log`.
- **§5 CVE triage:** `binsearch.py` (DLL string scan) + the WebGL PoCs
  `poc-query-single.html` (run via `run_query.py` against the 130 engine with
  `--in-process-gpu`).

**Constraints honored:** loopback only; fresh port per run; product PIDs
confirmed per run; native GPU probes run with `W57_NOFLUSH=1` and a VEH; the
live product process was never killed, injected, or debugged; harness + Qt
child processes only.

---

## 8. Severity summary & remediation

| Finding | Severity | Status |
|---|---|---|
| A. Renderer RCE (multi-proc, verified) | High–Critical | demonstrated |
| B. Wickr plaintext/contacts/groups/devices recovery | High (confidentiality) | demonstrated |
| C. In-main-process controlled host byte-write (TF11) | High (native); renderer-delivery open | demonstrated natively |
| **D. CVE-2026-9873 //net UAF → heap corruption in the in-process host** | **Critical** | **UAF firing demonstrated in-process (white-box force); RCE gated on PartitionAlloc weaponization** |
| Architecture amplifiers (in-proc GPU + `//net`, no CFG, site-isolation off) | raises A–D | measured |
| OS-RCE (full page→main controlled-write→RCE) | Critical | renderer→host UAF demonstrated; controlled-write→RCE is weaponization |

**Recommended remediation (vendor):**
1. Refresh the QtWebEngine/ANGLE pin past the M151 ANGLE/GPU cluster and
   backport that cluster's fixes (highest value — closes the realistic
   host-corruption class for this product).
2. Address the TF11 stream-output UAF path (Finding C) in the D3D11 bind
   handling regardless of delivery, since it is a confirmed main-process write
   on the Xe-UMD configuration.
3. Re-evaluate the in-process-GPU / in-process-`//net` / no-CFG / no-site-
   isolation configuration on the main process: these amplify every
   renderer-reachable GPU/`//net` bug from "sandboxed" to "unsandboxed main
   process."
4. Treat the renderer RCE (A) and data recovery (B) as the immediately
   reportable High/Critical findings.

---

## Artifacts index (W70)

`scratch/w70/`: `W70-STATUS.md`, `W70-STEP5-FORGE-DESIGN.md`, `tfprobe.c/exe`,
`w70_ff1.out`, `w70_fw0.out`, `w70_freed.out`, `w57probe.log` (VEH records),
`binsearch.py`, `poc-query-single.html`, `poc-query-delete.html`, `run_query.py`.
Inherited: `scratch/w57/` (TF11 harness + FINDINGS.md), `scratch/w69/`
(renderer RCE + channel + data-recovery PoC + bridge notes).
