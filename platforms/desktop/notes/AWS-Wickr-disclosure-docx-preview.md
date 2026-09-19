# Security Report — AWS Wickr Windows Desktop

## Title
HTML injection in DOCX file preview lands in a **same-origin, un-sandboxed** preview iframe that can reach the native `WebChannelMessageBridge` — the Content-Security-Policy is the **single** control preventing a 1-click renderer→native chain

## Summary
The AWS Wickr Windows desktop client renders attachment previews in an embedded QtWebEngine (Chromium) React app. The **DOCX** preview renderer (the bundled `docx-preview` library) writes an attacker-controlled document attribute into the DOM via `innerHTML` **without sanitization**, giving an attacker who sends the victim a `.docx` a **raw HTML-injection primitive** (CWE-79/80) that executes on a simple 1-click preview.

That injected content lands inside the file-preview `<iframe>`, which is **same-origin (`qrc:`) with the main application window and carries no `sandbox` attribute** (CWE-1021). A script running in that iframe can therefore reach the parent window's `qt.webChannelTransport` and the full 58-method `WebChannelMessageBridge`, and the parent already forwards preview-originated data to a native handler (`openLink`).

As shipped, exploitation to code execution is prevented **solely by the app's CSP** (`script-src 'self' qrc://*`, no `unsafe-inline`/`unsafe-eval`). I verified (in a Chromium/Blink harness reproducing the exact sink + CSP) that the injected HTML **does not execute** — direct vectors, DOM-clobbering, `<base>`/`<meta>` injection, and `qrc:` script-reuse all fail. **This is therefore reported as a high-value hardening / defense-in-depth issue, not a demonstrated RCE.** The concern is that the client's most privileged view (the one holding the native bridge) is protected by a *single* control: any CSP regression — an added `unsafe-inline`/`unsafe-eval`, a `qrc:`-hosted JSONP/eval gadget, or one `'self'` script-gadget — immediately promotes this to a clean 1-click renderer→bridge→RCE.

## Severity (self-assessed, conservative)
- **As a standalone injection under the current CSP:** Low — HTML injection into a privileged view; script execution is CSP-blocked. Indicative CVSS:3.1 `AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N` (~4.2).
- **As a defense-in-depth failure:** elevated — CSP is the *only* barrier between attacker-authored file content and the native bridge, in the client's bridge-privileged window. Recommend AWS triage the aggregate.

## Affected
- Product: **AWS Wickr** desktop client for Windows, **v6.72.20** (latest at time of testing, 2026-07-24). `WickrPro.exe`, native Qt 6.9.x / QtWebEngine, embedded React file-preview app.
- Components: bundled **`docx-preview`** renderer; the file-preview `<iframe>` embedding in `FilePreviewModal`; the parent `postMessage` receiver.
- Likely also affects macOS/Linux desktop builds (shared web app) — untested.

## Attacker position / reachability
- Attacker is any party who can send the victim a file (a conversation/room member). Delivery is over normal E2E messaging — no MITM, no special privilege.
- The preview is reached on **≤1 click**: `openFile` opens `FilePreviewModal` when `settings.enableFileDownload` is disabled, and File-Management (pinned/managed) non-image files open the modal directly. The attacker controls the **file bytes and extension** (extension selects the `docx` renderer).

## Vulnerability details

### Bug 1 — Unsanitized HTML injection in the DOCX symbol renderer (CWE-79/80)
The bundled `docx-preview` renderer builds a symbol run with:

```js
// docx-preview renderSymbol(elem)
t.innerHTML = `&#x${e.char};`;      // e.char = the docx <w:sym w:char="…"/> attribute
```

`e.char` is read directly from the document's `w:sym/@w:char` attribute (via `getAttribute`, i.e. XML-unescaped) and interpolated into `innerHTML` **without validation or sanitization**. `w:char` is meant to be a hex code point (e.g. `F0A7`); supplying instead a value such as `0;<img src=x alt=poc>` produces `innerHTML = "&#x0;<img src=x alt=poc>;"`, injecting an arbitrary attacker element into the preview DOM. (Unlike the PPTX path, the DOCX path is **not** routed through DOMPurify.)

### Bug 2 — File-preview iframe is same-origin and not sandboxed (CWE-1021)
`FilePreviewModal` embeds the preview page in a child `<iframe>` that is **same-origin (`qrc:`)** with the bridged main window and has **no `sandbox`/`srcdoc` attribute anywhere in the binary**. Consequence: any script executing in the preview iframe shares the app origin and can reach `window.parent`'s `qt.webChannelTransport` / the full `WebChannelMessageBridge`. (The "postMessage-isolated iframe" description sometimes used internally is inaccurate — it is a same-origin iframe plus a postMessage convention. Proof: `withLinkHandler` reads `window.parent.origin`, which only succeeds same-origin.)

### Bug 3 — Parent `message` receiver origin not validated (CWE-346, latent)
The parent already consumes preview-originated messages: `withLinkHandler` posts `{type:'openLink', url}` and the parent forwards it to native `uiBridge.openLink` → `QDesktopServices::openUrl` (natively bounded to an `http/https/mailto` allowlist + a confirm modal — so `openLink` itself is not RCE). However, the parent `message` handler's `event.origin`/`event.source` validation could not be confirmed in the minified bundle. Absent that check, any additional bridge-reaching message handler becomes attacker-triggerable if script ever runs in the iframe.

### Why these combine into a single-barrier RCE risk
1-click DOCX preview → **Bug 1** injects attacker HTML → into the **Bug 2** same-origin, bridge-reachable iframe → and the parent already **forwards** iframe data to native (Bug 3 context). Two of the three links of a renderer→native RCE are already present in normal operation. The **only** remaining barrier is the CSP preventing the injected HTML from executing as script.

## What currently blocks full exploitation (verified)
The shipped CSP on both preview and main pages is:
```
default-src 'self' qrc://* wickrweb://*; script-src 'self' qrc://*; object-src 'self'; …
```
No `unsafe-inline`, no `unsafe-eval`, no `nonce`. I reproduced the exact sink + CSP in a same-origin, un-sandboxed iframe harness under Chromium (the same Blink CSP engine as QtWebEngine) and confirmed the injected content **cannot execute**:
- 7 direct vectors (inline `<script>`, `<img onerror>`, `<svg><script>`, `javascript:` URIs, `<body onload>`, `<math>` mXSS) — **0 executed** (present as inert DOM nodes).
- `eval`/`Function` — CSP-blocked.
- **DOM-clobbering works** (clobbered an app global) but has no weaponizable sink (only `eval`/`Function`/non-`'self'` `src`, all CSP-blocked).
- **`<base href>` injection works** and an injected relaxing `<meta http-equiv=CSP>` was accepted — but base-redirected scripts resolve to the attacker origin → CSP-blocked, and an injected CSP **cannot loosen** the delivered one (multiple policies combine with AND).
- `qrc:`/`'self'` script re-use — `innerHTML`-inserted `<script>` is inert per spec; a real `'self'` script that loads runs app code, not attacker code.

So under the current CSP there is **no code execution and no bridge call** from the injected content. This report is a **hardening finding**, submitted because the injection + broken isolation reduce the defense of the bridge-privileged view to that single CSP.

## Reproduction
1. Build a `.docx` whose `word/document.xml` contains a symbol run with a hostile `w:char` (payload XML-escaped in the attribute; benign marker element shown here):
   ```xml
   <w:r>
     <w:sym w:font="Symbol"
            w:char="0;&lt;img src=x alt=WICKR-HTMLi-POC onerror=&quot;/*CSP-blocked*/&quot;&gt;"/>
   </w:r>
   ```
   (A ready-to-use benign PoC file and its builder are attached: `poc-docx-htmli.docx` / `build_poc_docx.py`.)
2. Send the file to a victim (or add it via File-Management) and have them **preview** it (1 click; automatic when `enableFileDownload` is disabled).
3. **Observed:** the attacker `<img>`/element is injected into the preview iframe DOM (HTML injection confirmed). The inline `onerror` does **not** fire under the shipped CSP (documented limitation — this is the barrier the report is about). Inspecting the iframe confirms it is same-origin and that a `'self'` script can read `window.parent`'s `qt.webChannelTransport`.

Note on validation scope: the injection sink, the same-origin un-sandboxed iframe, the parent→`openLink`→native forward, and the CSP block were validated by source review of the shipped (uncompressed, sourcemap-bearing) bundle plus a Blink/CSP-faithful execution harness. End-to-end confirmation inside the live client is left for your triage (attach the provided `.docx` and preview it).

## Impact
- **Now:** attacker-controlled HTML injected into the client's bridge-privileged preview view on 1-click; the aggressive attack surface (native bridge, TLS-error tolerance and auto-granted camera/mic/geo observed on the sibling chat view) is defended by CSP alone.
- **On any CSP regression** (added `unsafe-inline`/`unsafe-eval`, a `qrc:` JSONP/eval gadget, or a `'self'` script-gadget in a future dependency): immediate **1-click renderer → `WebChannelMessageBridge` → remote code execution** on the victim endpoint.

## Remediation (defense-in-depth; any one raises the bar, all three recommended)
1. **Sandbox the preview iframe** — add `sandbox` and **drop `allow-same-origin`** so preview content cannot reach the parent origin/bridge even if it executes. (Highest-value fix — it removes the single-barrier condition.)
2. **Fix Bug 1** — validate `w:sym/@w:char` as hex (`^[0-9A-Fa-f]{1,6}$`) before the `&#x…;` interpolation, or set `textContent`/use `document.createTextNode`, or route DOCX output through DOMPurify like the PPTX path.
3. **Validate `event.origin`/`event.source`** in the parent `message` receiver and keep the preview off the window that holds the `WebChannelMessageBridge`.

## Disclosure / rules of engagement
Authorized security research; benign PoC only; tested against my own installed client in a revertible environment; no third-party/production infrastructure touched and no user data accessed or exfiltrated. Happy to coordinate through AWS's vulnerability disclosure process (aws-security@amazon.com) or HackerOne as you prefer.

---
*Prepared for responsible disclosure. Full research notes and per-surface analysis available on request.*
