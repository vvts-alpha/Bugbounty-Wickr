# AWS Wickr Desktop — BBP Security Engagement

## Target

**AWS Wickr Desktop** (Windows x64)
- Qt WebEngine 6.9.2 / Chromium base **130.0.6723.192**
- Declared patch level **139.0.7258.67** (sub-139 CVE fixes ARE backported)
- Version gate: USABLE = {fix AFTER 139.0.7258.67} ∩ {vuln code IN the 130 base}

## Goal

Authorized Bug Bounty Program (BBP) research. Demonstrate exploitable vulnerabilities
with proof-of-concept, report through the vendor's official disclosure channel.

**Ultimate deliverable**: a PoC that proves severity — ideally RCE from a WebGL page,
but any demonstrated impact (info-leak, SOP bypass, validation bypass, arb R/W) is
reportable at its corresponding severity tier.

## Why This Target Is Interesting

| Property | Chrome | Wickr | Impact |
|---|---|---|---|
| GPU process | Sandboxed child | **In-process** (`--in-process-gpu`) | ANGLE bugs → main process corruption |
| CFG (Control Flow Guard) | Enabled | **Disabled** (PE flags 0x8160) | vtable hijack = code execution |
| Site isolation | Per-origin processes | **OFF** (one `v8::Isolate`) | Cross-origin read trivial after arb R/W |
| Integrity level | LOW (renderer) | **MEDIUM** (WickrPro.exe) | No sandbox to escape for ANGLE bugs |
| WebGL | Sandboxed GPU process | **Unsandboxed main process** | WebGL page → WickrPro.exe memory corruption |

## Attack Lines

### 1. ANGLE / GPU (PRIMARY — highest impact, shortest chain)

ANGLE runs inside WickrPro.exe. A WebGL page can corrupt memory in the unsandboxed,
CFG-less main process without needing renderer RCE or sandbox escape.

**Core finding: TransformFeedback11 UAF (W56)**
- `TransformFeedback11::getSOBuffers()` missing NULL-out after `deleteBuffer()`
- Stale `ID3D11Buffer*` → Intel UMD `mov byte [rax], 1` (write-1 primitive)
- 8/8 on shipped DLL, Chrome 150 clean 8/8
- malloc(0x2B0) reclaim proven, content page-controlled
- **Current goal: W67 — write-1 → mSkipValidation → validation bypass → arb R/W → RCE**

Other ANGLE findings:
- CVE-2026-14382: TF validation defeated (Stage 1), but Stage 2 OOB is a structural negative
- CVE-2026-16413: DEAD on WebGL (requires desktop GL API)

### 2. Renderer RCE (V8 chain — COMPLETE on paper)

Full in-cage arb R/W + addrof + out-of-cage read, chained from CVE-2026-11645.

| Capability | Status | Wave |
|---|---|---|
| In-cage arb R/W + addrof | ✅ ~43% | W35 |
| cage_base leak | ✅ 7/7 byte-exact | W52/W53 |
| Out-of-cage read (SlicedString) | ✅ 8/8 byte-exact | W42/W54 |
| Out-of-cage read (421403261) | ✅ 9/9 byte-exact | W49/W55 |
| dll_base recovery | ✅ 8/8 | W54 |
| Cross-origin SOP-defeating read | ✅ byte-exact | W35 |
| V8 sandbox escape (A2+A4) | ✅ on paper | W42/W43 |

**Limitation**: operates in renderer process (QtWebEngineProcess.exe). Cannot directly
reach ANGLE objects in WickrPro.exe. The renderer chain provides out-of-cage read/write
but needs a sandbox escape to affect the browser process.

### 3. Sandbox / SBX

- CVE-2026-2441: deterministic slot control achieved (W27c), but ASLR bootstrap blocks
- Known-CVE SBX route ~closed (CVE-2025-2783 fix PRESENT)
- Not actively pursued — the ANGLE line bypasses the sandbox entirely

### 4. Web / Delivery Surface

- `wickrweb:///awsCredentials` not feature-gated (W44) — AWS creds readable after renderer RCE
- .pptx chat delivery → arbitrary-URL iframe (W17k)
- Site isolation OFF (W17j) — cross-origin trivial
- SOP is ON despite `--disable-web-security` in argv (W39)
- Chat-delivered .pptx → form navigation (W19)

### 5. Deep Links / argv

- `wickrpro://` argument injection measured but path CLOSED (W37)
- `--datalocation` profile hijack: mechanism real, interception withdrawn
- Deep-link chain WITHDRAWN (W17g)

### 6. Native / Peer-Originated

- One frame → instruction-pointer control (F6), but needs live MITM — not over the wire
- F9/CVE-2025-10729: UAF → CFG-guarded vcall (reportable as CWE-416, no bypass)

## Architecture Reference

```
┌──────────────────────────────────────────────────────┐
│  WickrPro.exe  (MEDIUM IL, NO CFG)                   │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Qt / App    │  │ ANGLE D3D11  │  │ Network     │ │
│  │ UI, bridge  │  │ (in-process) │  │ stack       │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│         ▲                ▲                           │
│         │ IPC            │ GPU cmd buf               │
│         ▼                ▼                           │
│  ┌──────────────────────────────────────────────┐    │
│  │  QtWebEngineProcess.exe  (renderer)          │    │
│  │  V8, Blink, one shared v8::Isolate           │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

WebGL calls: JS (renderer) → GPU command buffer IPC → ANGLE (browser/main process).
The TF11 UAF + write-1 executes entirely in WickrPro.exe.

## Reporting Priority

1. **ANGLE TF11 UAF → RCE** (W67) — highest severity, shortest chain, skips sandbox
2. **Renderer RCE chain** (W35+W42+W43) — V8 sandbox escape, needs SBX for full impact
3. **AWS creds exposure** (W44) — needs renderer RCE first, but high impact
4. **TF validation bypass** (W41/14382) — Stage 1 only, lower severity without OOB
5. **Web delivery surface** (W17k, W19) — defense-in-depth findings
