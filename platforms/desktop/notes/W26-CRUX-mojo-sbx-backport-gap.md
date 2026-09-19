# W26 — the declared Chromium backport level is NOT trustworthy, and CVE-2025-4609's fix is missing

**The sandbox-escape link had exactly one thing going for it: a CVE whose precondition is "the
attacker has already compromised the renderer", which is the link this engagement already holds
(CVE-2026-2441, reproduced in W20). This wave found one, and measured its fix to be absent.**

Artifacts: `scratch/w26/` — `gpuprobe.py` / `gpuprobe.c` (WebGL & WebGPU reachability),
`gpu-hits.log`.

---

## §1 The candidate: CVE-2025-4609

Mojo IPC on Windows. A **compromised renderer can duplicate a privileged browser-process handle**,
escape the sandbox and run commands. CVSS 9.6. Google paid the maximum Chrome award, **$250,000**.
Public reporting describes ~70–80% exploitation reliability. Fixed in **Chrome 136** (May 2025).

Because Qt 6.9.2 declares a security-patch level of **139.0.7258.67**, a fix that landed in Chrome
136 is **below the line and should already be present**. That expectation is exactly what makes the
test worth running — and it failed.

## §2 The fix, from the vendor's own commit

Located through the GitHub Chromium mirror (`issues.chromium.org` requires sign-in and returns 403):

```
3cb6f6c2e3de  2025-05-08  Add handle type allowlist for transfer to untrusted process
  mojo/core/embedder/features.cc                          +9/-0
  mojo/core/embedder/features.h                           +5/-0
  mojo/core/ipcz_driver/transport.cc                      +1/-1
  mojo/core/platform_handle_in_transit.cc                 +1/-1
  mojo/public/cpp/platform/platform_handle_security_util_win.cc  +30/-1
```

The CL adds an allowlist of handle types transferable to an untrusted process —
**Section, File, Directory, DxgkSharedResource** — behind a default-enabled kill-switch feature
**`MojoHandleTypeProtections`**. Both the feature name and the allowlist entry `DxgkSharedResource`
are string literals, i.e. **binary-observable markers**.

(The related CVE-2025-2783 fix is `36dbbf38697d`, *"Avoid receiving or sending sentinel handle
values"*, bug 405143032, 2025-03-21 — mostly inline code in `base/win/win_util.h`, so no clean
string marker; not tested here.)

## §3 ★ The measurement

| marker | shipped `Qt6WebEngineCore.dll` | control: `chrome.dll` 150.0.7871.187 |
|---|---|---|
| **`MojoHandleTypeProtections`** — the fix's feature | **ABSENT** | **FOUND** |
| **`DxgkSharedResource`** — allowlist entry the fix adds | **ABSENT** | **FOUND** (UTF-16) |
| `MojoIpczMemV2` — sibling `BASE_FEATURE` in the **same file** | FOUND | FOUND |
| `MojoUseEventFd` — sibling, POSIX-only | absent | absent (consistent both sides) |
| `ipcz_driver`, `mojo/core` — mojo present at all | FOUND | FOUND |

**Why the control matters.** `kMojoHandleTypeProtections` is declared in
`mojo/core/embedder/features.cc` (line 34), the *same file*, *same `BASE_FEATURE` macro* and *same
string-emission path* as `kMojoIpczMemV2`, which **is** present in the Qt build. So the marker's
absence is not "this build strips those strings" — the strings from that file are there. Two
independent markers from the same CL are both missing, and both are present in patched Chrome.

**⇒ the CVE-2025-4609 fix is not in this build, despite landing three minor versions BELOW the
declared backport level.**

## §4 What this means beyond one CVE — the bigger finding

**The declared `qWebEngineChromiumSecurityPatchVersion() = "139.0.7258.67"` cannot be relied on
per-CVE.** W16c already proved Qt shipped this build without Qt's *own* qtsvg CVE fixes nine months
after publication. This is the same failure, now demonstrated on the **Chromium backport pipeline**.

Practical consequence for the inventory: **every** Chromium CVE in the 130→139 window that was
assumed covered has to be treated as *unverified* rather than *fixed*. That materially enlarges the
exposure surface and it is a stronger report point than any single CVE.

## §5 Where it sits in the chain

```
peer .pptx -> preview -> one click -> attacker origin page      [MEASURED, in-product]
  -> arbitrary JS at that origin                                [MEASURED]
  -> CVE-2026-2441 faults the renderer                          [MEASURED, W20]
  -> weaponise to renderer code execution                       [NOT DONE -- engineering]
  -> CVE-2025-4609: compromised renderer duplicates a
     privileged browser-process handle -> sandbox escape        [FIX MEASURED ABSENT; not exploited]
  -> code execution in WickrPro.exe (IL=MEDIUM, CFG inert)      [NOT DEMONSTRATED]
```

The two CVEs compose cleanly: 2026-2441's output is *renderer compromise*, which is exactly
2025-4609's stated precondition.

## §6 What is NOT established — read before reporting

* **String absence is evidence, not proof.** A backport could implement the same check without the
  feature flag and without the type-name strings (e.g. by numeric type id). Two independent markers
  and a same-file control make that unlikely, but it is not excluded. **The behavioural test has not
  been run** and would require a compromised renderer.
* **Nothing was exploited.** No handle was duplicated, no escape attempted.
* **The renderer half is still unweaponised** — CVE-2026-2441 produced `0xC0000005`, not control.
* CVE-2025-2783 was **not** tested (no clean marker).

## §7 Also settled this wave: the GPU/ANGLE class is closed for the page-driven route

Measured with `gpuprobe`, same page, same host, same minute:

| | shipped Qt WebEngine 6.9.2 | Chrome 150.0.7871.187 |
|---|---|---|
| WebGL 1 / experimental-webgl | **NULL** | **OK** — ANGLE, D3D11 |
| WebGL 2 | NULL | NULL |
| `navigator.gpu.requestAdapter()` | NULL_ADAPTER | NULL_ADAPTER |
| canvas2d | OK | (headless quirk) |

The first run was **confounded** — the harness passed `--disable-gpu`. Re-run without it: unchanged.
Chrome succeeding on the same host proves the machine *can* do WebGL, so **the failure is a property
of the Qt build, not the host**. This corrects W17j's "blocklisted on the only host tried".

⇒ **CVE-2026-6304 (Skia Graphite), 13775, 6314, 11672 (GPU) and 5281 (Dawn) cannot be driven from a
page on this build.** The "no GPU process, so ANGLE bugs land unsandboxed" argument is real but
unreachable from web content. *(WebGPU is NULL_ADAPTER in Chrome too on this host — a
`Microsoft Basic Render Driver` VM — so the Dawn question is **undetermined in general** and would
need re-testing on a GPU-equipped machine.)*
