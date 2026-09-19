# Consolidated state after W18–W20 — what is proven, what is inferred, what remains

Written 2026-08-04. Supersedes nothing; it indexes W18, W19, W19b and the in-flight W20.
Every line is marked **[M]** measured on shipped code / the live product, or **[I]** inference.

---

## 1. The peer-originated chain, end to end

| stage | state |
|---|---|
| peer sends `.pptx` | **[M]** injection point is real: `pptx2html.worker.js:1189-1200` puts the pptx relationship `Target` into `<a href='…'>` **unescaped** |
| victim opens preview | **[M]** requires `enableFileDownload = false` on the network (W17h) — native admin policy, default **true** |
| sanitiser | **[M]** shipped DOMPurify default profile keeps `form`/`action`/`method`/`button`/`style`, strips `iframe`/`base`/`target`/`formaction`. A form is the *only* way out, and stripping `target` forces the submission to navigate **the frame itself** |
| one click anywhere | **[M]** `style` survives ⇒ `position:fixed;left:0;top:0;width:100vw;height:100vh` covering submit button |
| frame navigates | **[M]** harness A/B on shipped Qt: navigation to a `frame-src`-allow-listed origin **succeeds**, to a non-allow-listed origin is **blocked**. CSP has no `form-action`, no `base-uri`, no `sandbox` |
| **in-product** | **[M]** operator ran `poc-pptx-form-ALLOWED.pptx` in the real client: the preview frame displayed `https://main.d4zeeqgazhley.amplifyapp.com/` |

**⇒ delivery of an attacker-controlled page inside the Wickr window is DONE and demonstrated in the
product.** PoC builder: `scratch/w19/build_poc_pptx.py`; sanitiser proof: `scratch/w19/sanicheck.html`
(run against the recovered `purify.es.mjs`, verdict `CHAIN INTACT`).

## 2. What that page can and cannot reach

| | state |
|---|---|
| native QWebChannel bridge, at the JS level | **[M]** unreachable — cross-origin frames get `typeof qt === "undefined"` (W18 F19, static and injected iframes alike); `parent.qt` is cross-origin |
| bridge via the reported same-origin XSS | **[M]** reachable — `file-preview.html` is a *relative* URL ⇒ same origin ⇒ `parent.qt` works |
| the bridge's own power | **[M]** 148 callable methods swept: **none** executes a program or writes an attacker-chosen path. `openFile` is fail-closed on a native extension hash; `saveFile` ends in `QFileDialog::getSaveFileName`; `saveGeneralFile` is a PNG-only dialog; `activateHyperlink` is gated by `EnvironmentMgr::isURLDenied` |
| `webAppLoadUrl` | **[M]** natively ungated ⇒ full-window, **CSP-free**, cert-validation-off `WebEngineView` at any URL — spoof/phishing, and the best *delivery* position; measured to have **no** transport either |
| camera/mic from an injected iframe | **[M]** granted with no prompt **if the injected tag carries `allow="camera *; microphone *"`** (Wickr's `grantFeaturePermission(...,true)`); control without the attribute → `NotAllowedError`. **Not** available on the pptx path — the preview `<iframe>` has no `allow` attribute |
| host code execution | **not achieved by any route in this assessment** |

## 3. Process and mitigation posture

| | state |
|---|---|
| renderer | **[M]** `QtWebEngineProcess.exe --type=renderer`: IL=**UNTRUSTED**, **restricted token**, in a **job**, **MicrosoftSignedOnly**; dynamic code **allowed** (JIT works) |
| browser | **[M]** `WickrPro.exe`: IL=MEDIUM, unrestricted, dynamic code allowed |
| network service | **[M]** `--enable-features=NetworkServiceInProcess2` and only one QtWebEngineProcess exists ⇒ the network stack runs **inside the unsandboxed browser process**. For URL/HTTP/cookie/WebSocket/TLS/custom-scheme bugs **there is no sandbox to escape** |
| URL parsing | **[M]** `--disable-features=…,StandardCompliantNonSpecialSchemeURLParsing,…` ⇒ **legacy** parser for non-special schemes, the class `wickrweb://` belongs to |
| site isolation | **[I] and under verification (W20)** — with the cross-origin amplify document displayed, **only one renderer process existed**, and no `--site-per-process` / `--disable-site-isolation-trials` on its command line. One process count is **not** proof; W20 is checking it three ways plus two adversarial refutation passes |

## 4. Chromium version gating — the number that decides which n-day is usable

**[M]** disassembled from `Qt6WebEngineCore.dll`:

```
qWebEngineChromiumVersion()              -> "130.0.6723.192"   (base)
qWebEngineChromiumSecurityPatchVersion() -> "139.0.7258.67"    (declared backport level)
```

**⇒ a usable renderer n-day must be a bug fixed AFTER 139.0.7258.67 (≈2025-09), not a 130-era CVE.**
**[I]** the declared level is Qt's own claim; W16c proved this same build lacks Qt's *own* qtsvg CVE
fixes nine months after publication, so the claim must be falsified per-CVE (W20 is testing two
markers).

## 5. Native side (peer-originated, independent of the web chain)

**F9 / CVE-2025-10729 — a use-after-free reaching a CFG-guarded virtual call.**

* **[M]** W16c's `0xC0000409` characterisation is **retracted**: it was `__fastfail` code 7
  (`FATAL_APP_EXIT`) from `QFontDatabase` because *our own harness* had no `QGuiApplication`.
* **[M]** with a `QGuiApplication`, the same 90-byte SVG gives a read AV at `Qt6Svg.dll+0x4D5DF`,
  which is `mov rax,[rcx]` (vptr **out of freed memory**) → `mov rax,[rax+0x10]` →
  `call [GuardCFDispatchFunctionPointer]`.
* **[M]** the same input also produces `STATUS_HEAP_CORRUPTION` under a different heap layout, with a
  control (the already-fixed SVG through the identical harness exits 0) ⇒ something **writes**
  through the dangling pointer.
* **[M]** freed block = **928 bytes**, the only mid-parse free; reclaim is **deterministic** — the
  next allocation in that size class takes the identical address (`freed@12 → retaken@13`).
* **[M]** 53 spray shapes across every allocation family reachable from inside an SVG failed to put
  attacker bytes at offset 0. Structural reason: Qt containers are `QArrayData` (header at offset 0);
  image buffers are the right shape but too heavy and land after a legitimate `QSvgPattern` takes the
  seat.
* **⇒ CWE-416, not "crash", not "RCE".** IP control **not** achieved.

**F8 / CVE-2025-10728** — genuine stack exhaustion, unaffected by the F9 retraction.

## 6. Reportable findings from this session

1. **pptx → form-navigation → third-party origin** (new, demonstrated in-product). One-line fix that
   costs nothing: **`form-action 'none'` + `base-uri 'none'`**; plus escape `linkURL`; plus
   `sandbox="allow-scripts"` on the preview iframe.
2. **Silent camera/mic to an injected third-party iframe** via `grantFeaturePermission(...,true)`.
3. **`webAppLoadUrl` natively unvalidated** ⇒ CSP-free, cert-validation-off full-window view.
4. **CVE-2025-10729 present and materially worse than "DoS"** — UAF with a virtual call on freed
   memory; CVE-2025-10728 present as a stack overflow.
5. Defensive confirmations worth stating: cross-origin frames cannot reach the bridge at the JS
   level; the bridge exposes no program-execution or arbitrary-write method; the renderer is
   genuinely sandboxed.

## 7. What "ready to land a JS n-day" actually requires

Ready **[M]**: a single attacker-controlled page renders inside the app window, at the attacker's own
origin, so **Wickr's CSP does not apply to it**; TLS validation on that view is off; JIT is enabled.

Not ready:

| step | status |
|---|---|
| the n-day itself | **absent** — and it must post-date `139.0.7258.67` |
| what one renderer bug buys | **depends on the site-isolation answer (W20, in flight)**. Isolation off ⇒ **[I]** same-process access to the app document's context, hence the bridge, without a sandbox escape. Isolation on ⇒ renderer exploit **plus** a sandbox escape for anything at host level |
| host code execution | needs the sandbox escape, **unless** the bug is in the network stack, which runs unsandboxed in `WickrPro.exe` **[M]** |
| delivery preconditions | `enableFileDownload=false` network **[M]**, one victim click **[M]** |
